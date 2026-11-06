//! Han Coordinator Daemon
//!
//! Binary that serves GraphQL over HTTP/WS, gRPC for CLI communication,
//! runs the hook execution engine, and manages real-time JSONL indexing.

mod grpc;
mod hooks;
mod lock;
mod runtime;
mod rpc_guard;
mod server;
mod tls;
mod watcher_bridge;

use clap::Parser;
use grpc::{
    CoordinatorServiceImpl, CoordinatorState, HookServiceImpl, IndexerServiceImpl,
    MemoryServiceImpl, SessionServiceImpl, SlotServiceImpl,
};
use han_api::context::DbChangeEvent;
use han_db::migration::Migrator;
use han_db::{establish_connection, DbConfig};
use han_proto::coordinator::{
    coordinator_service_server::CoordinatorServiceServer, hook_service_server::HookServiceServer,
    indexer_service_server::IndexerServiceServer, memory_service_server::MemoryServiceServer,
    session_service_server::SessionServiceServer, slot_service_server::SlotServiceServer,
};
use hooks::HookEngine;
use lock::CoordinatorLock;
use sea_orm_migration::MigratorTrait;
use std::collections::HashMap;
#[cfg(unix)]
use std::future::Future;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{broadcast, Mutex, RwLock};
use tokio_rustls::TlsAcceptor;
use tonic::transport::Server as TonicServer;

#[derive(Parser, Debug)]
#[command(name = "han-coordinator", version, about = "Han coordinator daemon")]
struct Cli {
    /// Port for HTTPS/WebSocket server.
    #[arg(long, default_value = "41957")]
    port: u16,

    /// Port for gRPC server.
    #[arg(long, default_value = "41958")]
    grpc_port: u16,

    /// Run in foreground (don't daemonize).
    #[arg(long)]
    foreground: bool,

    #[arg(long, hide = true)]
    supervisor_pid: Option<u32>,
    #[arg(long, hide = true)]
    supervisor_nonce: Option<String>,
    #[arg(long, hide = true)]
    supervisor_generation: Option<String>,

    /// Database file path.
    #[arg(long)]
    db_path: Option<String>,
    /// Shared Han data directory (locks, database and runtime descriptor).
    #[arg(long)]
    data_dir: Option<std::path::PathBuf>,

    /// Project path for hook discovery.
    #[arg(long)]
    project_path: Option<String>,

    /// Skip gRPC server.
    #[arg(long)]
    no_grpc: bool,

    /// Skip file watcher.
    #[arg(long)]
    no_watcher: bool,

    /// Run initial full scan on startup.
    #[arg(long)]
    scan_on_start: bool,

    /// Write PID to file (daemon mode).
    #[arg(long)]
    pid_file: Option<String>,
}

/// How long a peer gets to finish its TLS handshake before being dropped.
const TLS_HANDSHAKE_TIMEOUT: std::time::Duration = std::time::Duration::from_secs(10);

/// TLS-wrapped TCP listener for axum::serve.
///
/// Handshakes run in their own tasks. Doing one inline here would serialize the
/// accept loop: a peer that completes the TCP handshake and then sends no
/// ClientHello would block every later connection, and browsers open
/// speculative sockets exactly like that. Each handshake is also bounded, so a
/// stalled peer is dropped instead of accumulating.
struct TlsListener {
    inner: tokio::net::TcpListener,
    acceptor: TlsAcceptor,
    handshakes: tokio::task::JoinSet<Option<(TlsStreamOf<tokio::net::TcpStream>, SocketAddr)>>,
}

type TlsStreamOf<S> = tokio_rustls::server::TlsStream<S>;

impl axum::serve::Listener for TlsListener {
    type Io = TlsStreamOf<tokio::net::TcpStream>;
    type Addr = SocketAddr;

    async fn accept(&mut self) -> (Self::Io, Self::Addr) {
        loop {
            tokio::select! {
                // Bias the completed handshakes so a busy listener still drains
                // them instead of only ever taking new connections.
                biased;

                Some(joined) = self.handshakes.join_next(), if !self.handshakes.is_empty() => {
                    match joined {
                        Ok(Some(ready)) => return ready,
                        Ok(None) => {}
                        Err(e) => tracing::debug!("TLS handshake task failed: {}", e),
                    }
                }

                result = self.inner.accept() => match result {
                    Ok((tcp_stream, addr)) => {
                        let acceptor = self.acceptor.clone();
                        self.handshakes.spawn(async move {
                            match tokio::time::timeout(
                                TLS_HANDSHAKE_TIMEOUT,
                                acceptor.accept(tcp_stream),
                            )
                            .await
                            {
                                Ok(Ok(tls_stream)) => Some((tls_stream, addr)),
                                Ok(Err(e)) => {
                                    tracing::debug!("TLS handshake failed from {}: {}", addr, e);
                                    None
                                }
                                Err(_) => {
                                    tracing::debug!("TLS handshake from {} timed out", addr);
                                    None
                                }
                            }
                        });
                    }
                    Err(e) => {
                        tracing::error!("TCP accept error: {}", e);
                        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                    }
                },
            }
        }
    }

    fn local_addr(&self) -> std::io::Result<Self::Addr> {
        self.inner.local_addr()
    }
}
#[cfg(unix)]
fn shutdown_signal() -> impl Future<Output = ()> {
    let mut terminate = tokio::signal::unix::signal(tokio::signal::unix::SignalKind::terminate())
        .expect("install SIGTERM handler");
    async move {
        tokio::select! {
            _ = tokio::signal::ctrl_c() => {},
            _ = terminate.recv() => {},
        }
    }
}

#[cfg(not(unix))]
async fn shutdown_signal() {
    let _ = tokio::signal::ctrl_c().await;
}


fn resolve_db_path(cli_path: Option<&str>, data_dir: &std::path::Path) -> String {
    cli_path.map(str::to_owned)
        .unwrap_or_else(|| data_dir.join("han.db").to_string_lossy().into_owned())
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse CLI args
    let cli = Cli::parse();
    let supervisor = match (&cli.supervisor_pid, &cli.supervisor_nonce, &cli.supervisor_generation) {
        (None, None, None) => None,
        (Some(&pid), Some(nonce), Some(generation)) if cli.foreground => {
            let binding = runtime::SupervisorBinding::validate(pid, nonce.clone(), generation.clone())?;
            #[cfg(unix)]
            if unsafe { libc::getppid() } as u32 != pid {
                return Err(std::io::Error::new(std::io::ErrorKind::PermissionDenied, "supervisor is not the parent process").into());
            }
            #[cfg(not(unix))]
            return Err(std::io::Error::new(std::io::ErrorKind::Unsupported, "supervisor verification unavailable").into());
            #[cfg(unix)]
            Some(binding)
        }
        _ => return Err(std::io::Error::new(std::io::ErrorKind::InvalidInput, "supervisor arguments must be supplied together with --foreground").into()),
    };

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    // Install ring crypto provider for rustls (must be before any TLS operations)
    let _ = rustls::crypto::ring::default_provider().install_default();

    tracing::info!("Han Coordinator v{} starting", env!("CARGO_PKG_VERSION"));

    // Daemon mode: fork if not --foreground
    if !cli.foreground {
        tracing::info!("Daemonizing...");
        daemonize(&cli).await?;
        return Ok(());
    }

    // Claim the HTTPS port before anything else. `bind` is an atomic,
    // kernel-enforced singleton, so it is the primary mutual exclusion; the
    // lock file is the secondary record of which pid and port won.
    //
    // Order matters, and reversing these two reintroduces the bug this file
    // exists to prevent. Acquiring the lock first means a starter that then
    // loses the bind has already published a lock naming itself, and its
    // owner-checked release deletes that lock on the way out, leaving the
    // coordinator that actually owns the port with no record on disk. It
    // also opens the database and runs migrations before finding out it was
    // never needed.
    let server_addr: SocketAddr = ([127, 0, 0, 1], cli.port).into();
    let tls_listener = tokio::net::TcpListener::bind(server_addr).await?;
    let https_port = tls_listener.local_addr()?.port();
    let grpc_listener = if cli.no_grpc {
        None
    } else {
        Some(tokio::net::TcpListener::bind(SocketAddr::from(([127, 0, 0, 1], cli.grpc_port))).await?)
    };
    let grpc_port = grpc_listener.as_ref().map(|listener| listener.local_addr().map(|addr| addr.port())).transpose()?;
    let data_dir = runtime::data_dir(cli.data_dir.as_deref())?;
    let runtime_dir = runtime::prepare(&data_dir)?;

    // Acquire coordinator lock. Another live coordinator already holding it
    // is not an error: exit cleanly (status 0) so the TypeScript supervisor's
    // retry logic sees a normal, quiet exit rather than a failure to retry.
    // Nothing has been published at this point, so an exit here leaves no
    // trace: the listener drops and releasing a lock we never owned is a
    // no-op.
    let lock = CoordinatorLock::with_path(runtime_dir.join("coordinator.lock"));
    match lock.acquire(Some(https_port)) {
        Ok(()) => {}
        Err(lock::LockError::AlreadyLocked { pid, port }) => {
            tracing::info!(
                "Coordinator already running (pid={}, port={:?}); exiting",
                pid,
                port
            );
            return Ok(());
        }
        Err(e) => return Err(e.into()),
    }

    // Start heartbeat task
    let lock_path = lock.lock_path().to_path_buf();
    tokio::spawn(async move {
        let heartbeat_lock = lock::CoordinatorLock::with_path(lock_path);
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
            match heartbeat_lock.heartbeat() {
                Ok(true) => {}
                Ok(false) => {
                    tracing::warn!("Lock no longer owned by this process; stopping heartbeat");
                    break;
                }
                Err(e) => {
                    tracing::warn!("Heartbeat failed: {}", e);
                }
            }
        }
    });

    // Initialize database
    let db_path = resolve_db_path(cli.db_path.as_deref(), &data_dir);
    tracing::info!("Database: {}", db_path);

    let db = establish_connection(DbConfig::Sqlite {
        path: db_path.clone(),
    })
    .await?;

    // Run migrations
    Migrator::up(&db, None).await?;
    tracing::info!("Migrations applied");

    // Build GraphQL schema
    let (event_tx, _) = broadcast::channel::<DbChangeEvent>(1024);
    let schema = han_api::build_schema(db.clone(), event_tx.clone());

    // Defer initial scan to after server starts (runs in background)
    let scan_on_start = cli.scan_on_start;
    let scan_db = db.clone();

    // Start file watcher bridge
    let watcher_handle = if !cli.no_watcher {
        Some(watcher_bridge::start_watcher_bridge(
            db.clone(),
            event_tx.clone(),
        ))
    } else {
        None
    };

    // Build hook engine
    let project_path = cli.project_path.map(std::path::PathBuf::from);
    let hook_engine = Arc::new(Mutex::new(HookEngine::new(project_path)));

    let (shutdown_tx, mut shutdown_rx) = broadcast::channel(1);

    // Serve on the listener claimed at startup, above.
    let certs = tls::generate_identity()?;
    let bearer = runtime::random_token();
    let descriptor = runtime::Descriptor {
        transport_version: runtime::LOCAL_TRANSPORT_VERSION,
        instance_id: runtime::random_token(),
        pid: std::process::id(),
        https_port,
        grpc_port,
        certificate_pem: certs.cert_pem.clone(),
        bearer_token: bearer.clone(),
        supervisor,
    };
    let published_descriptor = runtime::PublishedDescriptor::publish(&runtime_dir, &descriptor)?;
    let coordinator_state = Arc::new(CoordinatorState {
        db: db.clone(),
        start_time: Instant::now(),
        hook_engine: hook_engine.clone(),
        slots: Arc::new(RwLock::new(HashMap::new())),
        shutdown: shutdown_tx,
        shutdown_context: Some(runtime::ShutdownContext { runtime: runtime_dir.clone(), descriptor: descriptor.clone() }),
        shutdown_committed: std::sync::Mutex::new(false),
    });
    let router = server::build_router(schema.clone(), coordinator_state.start_time, https_port, bearer.clone());
    let tls_config = tls::build_tls_config(&certs)?;
    let acceptor = TlsAcceptor::from(Arc::new(tls_config));
    let grpc_acceptor = acceptor.clone();

    tracing::info!("HTTPS server listening on {}", server_addr);

    let mut server_handle = tokio::spawn(async move {
        let listener = TlsListener {
            inner: tls_listener,
            acceptor,
            handshakes: tokio::task::JoinSet::new(),
        };
        if let Err(e) = axum::serve(listener, router).await {
            tracing::error!("HTTPS server error: {}", e);
        }
    });

    // Start gRPC server
    let mut grpc_handle = if let Some(grpc_listener) = grpc_listener {
        let state = coordinator_state.clone();
        let rpc_guard = rpc_guard::GuardLayer::new(grpc_port.expect("bound port"), &bearer);
        let server = TonicServer::builder();
        tracing::info!("gRPC server listening on 127.0.0.1:{}", grpc_port.expect("bound port"));
        Some(tokio::spawn(async move {
            let listener = TlsListener {
                inner: grpc_listener,
                acceptor: grpc_acceptor,
                handshakes: tokio::task::JoinSet::new(),
            };
            let incoming = futures_util::stream::unfold(listener, |mut listener| async move {
                let (stream, _) = axum::serve::Listener::accept(&mut listener).await;
                Some((Ok::<_, std::io::Error>(stream), listener))
            });
            server.accept_http1(true)
                .layer(rpc_guard)
                .layer(tonic_web::GrpcWebLayer::new())
                .add_service(CoordinatorServiceServer::new(CoordinatorServiceImpl {
                    state: state.clone(),
                }))
                .add_service(SessionServiceServer::new(SessionServiceImpl {
                    state: state.clone(),
                }))
                .add_service(IndexerServiceServer::new(IndexerServiceImpl {
                    state: state.clone(),
                }))
                .add_service(HookServiceServer::new(HookServiceImpl {
                    state: state.clone(),
                }))
                .add_service(SlotServiceServer::new(SlotServiceImpl {
                    state: state.clone(),
                }))
                .add_service(MemoryServiceServer::new(MemoryServiceImpl {
                    state: state.clone(),
                }))
                .serve_with_incoming(incoming)
                .await
                .unwrap();
        }))
    } else {
        None
    };
    let shutdown = shutdown_signal();
    tokio::pin!(shutdown);

    // Write PID file
    if let Some(pid_path) = &cli.pid_file {
        std::fs::write(pid_path, std::process::id().to_string())?;
    }

    tracing::info!(
        "Coordinator ready (HTTPS={}, gRPC={})",
        cli.port,
        if cli.no_grpc {
            "disabled".to_string()
        } else {
            cli.grpc_port.to_string()
        },
    );

    // Run initial full scan in background (after server is listening)
    if scan_on_start {
        tokio::spawn(async move {
            tracing::info!("Running initial full scan in background...");
            match han_indexer::full_scan_and_index(&scan_db).await {
                Ok(results) => {
                    let total: u32 = results.iter().map(|r| r.messages_indexed).sum();
                    tracing::info!(
                        "Initial scan complete: {} sessions, {} messages indexed",
                        results.len(),
                        total
                    );
                }
                Err(e) => {
                    tracing::warn!("Initial scan failed: {}", e);
                }
            }
        });
    }

    // Fill the dashboard aggregate tables in the background. Only does work the
    // first time, but a full rebuild is far too slow to sit on the startup path.
    {
        let backfill_db = db.clone();
        tokio::spawn(async move {
            match han_indexer::backfill_aggregates_if_empty(&backfill_db).await {
                Ok(true) => tracing::info!("Dashboard aggregates ready"),
                Ok(false) => {}
                Err(e) => tracing::warn!("Aggregate backfill failed: {}", e),
            }
        });
    }

    tokio::select! {
        _ = &mut shutdown => {
            tracing::info!("Received shutdown signal");
        }
        _ = &mut server_handle => {
            tracing::info!("Server stopped");
        }
        _ = async {
            match grpc_handle.as_mut() {
                Some(handle) => { let _ = handle.await; }
                None => std::future::pending::<()>().await,
            }
        } => {
            tracing::error!("gRPC server stopped");
        }
        _ = shutdown_rx.recv() => {
            tracing::info!("Received authenticated shutdown request");
        }
        _ = tokio::time::sleep(std::time::Duration::from_secs(23 * 60 * 60)) => {
            tracing::info!("Rotating coordinator identity before certificate expiry");
        }
    }

    // Cleanup
    tracing::info!("Shutting down...");
    server_handle.abort();
    if let Some(handle) = watcher_handle {
        handle.abort();
    }
    if let Some(handle) = grpc_handle {
        handle.abort();
    }
    if let Some(pid_path) = &cli.pid_file {
        let _ = std::fs::remove_file(pid_path);
    }
    drop(published_descriptor);
    lock.release()?;

    tracing::info!("Coordinator stopped");
    Ok(())
}

/// Daemonize by forking and waiting for the child to be healthy.
async fn daemonize(cli: &Cli) -> Result<(), Box<dyn std::error::Error>> {
    use std::process::Command;

    let exe = std::env::current_exe()?;
    let mut args = vec!["--foreground".to_string()];
    args.push("--port".to_string());
    args.push(cli.port.to_string());
    args.push("--grpc-port".to_string());
    args.push(cli.grpc_port.to_string());
    let data_dir = runtime::data_dir(cli.data_dir.as_deref())?;
    let runtime_dir = runtime::prepare(&data_dir)?;
    args.push("--data-dir".to_string());
    args.push(data_dir.to_string_lossy().into_owned());

    if let Some(ref db) = cli.db_path {
        args.push("--db-path".to_string());
        args.push(db.clone());
    }
    if let Some(ref project) = cli.project_path {
        args.push("--project-path".to_string());
        args.push(project.clone());
    }
    if cli.no_grpc {
        args.push("--no-grpc".to_string());
    }
    if cli.no_watcher {
        args.push("--no-watcher".to_string());
    }
    if cli.scan_on_start {
        args.push("--scan-on-start".to_string());
    }

    if let Some(pid_path) = &cli.pid_file {
        args.push("--pid-file".to_string());
        args.push(pid_path.clone());
    }

    let mut child = Command::new(exe)
        .args(&args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .stdin(std::process::Stdio::null())
        .spawn()?;

    tracing::info!("Daemon started with PID {}", child.id());

    let deadline = tokio::time::Instant::now() + std::time::Duration::from_secs(30);
    loop {
        if let Some(status) = child.try_wait()? {
            return Err(format!("coordinator exited before readiness: {status}").into());
        }
        match runtime::read_descriptor(&runtime_dir) {
            Ok(descriptor) if descriptor.pid == child.id() => {
                if descriptor.transport_version != runtime::LOCAL_TRANSPORT_VERSION {
                    return Err("unsupported coordinator transport version".into());
                }
                let cert = reqwest::Certificate::from_pem(descriptor.certificate_pem.as_bytes())?;
                let client = reqwest::Client::builder()
                    .tls_built_in_root_certs(false)
                    .add_root_certificate(cert)
                    .no_proxy()
                    .timeout(std::time::Duration::from_secs(3))
                    .build()?;
                let response = client.get(format!("https://127.0.0.1:{}/health", descriptor.https_port))
                    .bearer_auth(&descriptor.bearer_token).send().await?;
                if !response.status().is_success() {
                    return Err(format!("coordinator health rejected: {}", response.status()).into());
                }
                let health: serde_json::Value = response.json().await?;
                if health.get("pid").and_then(|v| v.as_u64()) != Some(child.id() as u64) {
                    return Err("coordinator health PID does not match spawned process".into());
                }
                tracing::info!("Daemon is healthy");
                return Ok(());
            }
            Ok(_) => {}
            Err(e) if e.kind() == std::io::ErrorKind::NotFound => {}
            Err(e) => return Err(e.into()),
        }
        if tokio::time::Instant::now() >= deadline {
            return Err("coordinator did not publish its descriptor before the startup deadline".into());
        }
        tokio::time::sleep(std::time::Duration::from_millis(100)).await;
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_db_path() {
        let data = std::path::Path::new("/tmp/isolated-han");
        assert_eq!(resolve_db_path(Some("./custom.db"), data), "./custom.db");
        assert_eq!(resolve_db_path(None, data), "/tmp/isolated-han/han.db");
    }

    #[test]
    fn test_cli_parse_defaults() {
        let cli = Cli::parse_from(["han-coordinator", "--foreground"]);
        assert_eq!(cli.port, 41957);
        assert_eq!(cli.grpc_port, 41958);
        assert!(cli.foreground);
        assert!(!cli.no_grpc);
        assert!(!cli.no_watcher);
    }

    #[test]
    fn test_cli_parse_custom() {
        let cli = Cli::parse_from([
            "han-coordinator",
            "--foreground",
            "--port",
            "8080",
            "--no-grpc",
            "--db-path",
            "/tmp/test.db",
        ]);
        assert_eq!(cli.port, 8080);
        assert!(cli.no_grpc);
        assert_eq!(cli.db_path, Some("/tmp/test.db".to_string()));
    }

}
