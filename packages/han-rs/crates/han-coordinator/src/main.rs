//! Han Coordinator Daemon
//!
//! Binary that serves GraphQL over HTTP/WS, gRPC for CLI communication,
//! runs the hook execution engine, and manages real-time JSONL indexing.

mod grpc;
mod hooks;
mod lock;
mod server;
mod tls;
mod watcher_bridge;

use clap::Parser;
use grpc::{
    CoordinatorServiceImpl, CoordinatorState, HookServiceImpl, IndexerServiceImpl,
    MemoryServiceImpl, SessionServiceImpl, SlotServiceImpl,
};
use han_api::context::DbChangeEvent;
use han_db::{DbConfig, establish_connection};
use han_db::migration::Migrator;
use han_proto::coordinator::{
    coordinator_service_server::CoordinatorServiceServer,
    hook_service_server::HookServiceServer,
    indexer_service_server::IndexerServiceServer,
    memory_service_server::MemoryServiceServer,
    session_service_server::SessionServiceServer,
    slot_service_server::SlotServiceServer,
};
use hooks::HookEngine;
use lock::CoordinatorLock;
use sea_orm_migration::MigratorTrait;
use std::collections::HashMap;
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{Mutex, RwLock, broadcast};
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

    /// Database file path.
    #[arg(long)]
    db_path: Option<String>,

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

/// TLS-wrapped TCP listener for axum::serve.
///
/// Accepts TCP connections, performs TLS handshake, and yields TLS streams.
/// Failed handshakes are logged and retried (the listener keeps accepting).
struct TlsListener {
    inner: tokio::net::TcpListener,
    acceptor: TlsAcceptor,
}

impl axum::serve::Listener for TlsListener {
    type Io = tokio_rustls::server::TlsStream<tokio::net::TcpStream>;
    type Addr = SocketAddr;

    async fn accept(&mut self) -> (Self::Io, Self::Addr) {
        loop {
            match self.inner.accept().await {
                Ok((tcp_stream, addr)) => match self.acceptor.accept(tcp_stream).await {
                    Ok(tls_stream) => return (tls_stream, addr),
                    Err(e) => {
                        tracing::debug!("TLS handshake failed from {}: {}", addr, e);
                    }
                },
                Err(e) => {
                    tracing::error!("TCP accept error: {}", e);
                    tokio::time::sleep(std::time::Duration::from_millis(100)).await;
                }
            }
        }
    }

    fn local_addr(&self) -> std::io::Result<Self::Addr> {
        self.inner.local_addr()
    }
}

/// Resolve the database path.
fn resolve_db_path(cli_path: Option<&str>) -> String {
    if let Some(path) = cli_path {
        return path.to_string();
    }
    if let Some(home) = dirs::home_dir() {
        let han_dir = home.join(".han");
        let _ = std::fs::create_dir_all(&han_dir);
        return han_dir.join("han.db").to_string_lossy().to_string();
    }
    "han.db".to_string()
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    // Parse CLI args
    let cli = Cli::parse();

    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| tracing_subscriber::EnvFilter::new("info")),
        )
        .init();

    // Install ring crypto provider for rustls (must be before any TLS operations)
    let _ = rustls::crypto::ring::default_provider().install_default();

    tracing::info!(
        "Han Coordinator v{} starting",
        env!("CARGO_PKG_VERSION")
    );

    // Daemon mode: fork if not --foreground
    if !cli.foreground {
        tracing::info!("Daemonizing...");
        daemonize(&cli)?;
        return Ok(());
    }

    // Acquire coordinator lock
    let lock = CoordinatorLock::new()?;
    lock.acquire(Some(cli.port))?;

    // Start heartbeat task
    let lock_path = lock.lock_path().to_path_buf();
    tokio::spawn(async move {
        let heartbeat_lock = lock::CoordinatorLock::with_path(lock_path);
        loop {
            tokio::time::sleep(std::time::Duration::from_secs(10)).await;
            if let Err(e) = heartbeat_lock.heartbeat() {
                tracing::warn!("Heartbeat failed: {}", e);
            }
        }
    });

    // Initialize database
    let db_path = resolve_db_path(cli.db_path.as_deref());
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

    // Initial scan
    if cli.scan_on_start {
        tracing::info!("Running initial full scan...");
        match han_indexer::full_scan_and_index(&db).await {
            Ok(results) => {
                let total: u32 = results.iter().map(|r| r.messages_indexed).sum();
                tracing::info!(
                    "Initial scan: {} sessions, {} messages",
                    results.len(),
                    total
                );
            }
            Err(e) => tracing::warn!("Initial scan failed: {}", e),
        }
    }

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

    // Shared gRPC state
    let coordinator_state = Arc::new(CoordinatorState {
        db: db.clone(),
        start_time: Instant::now(),
        hook_engine: hook_engine.clone(),
        slots: Arc::new(RwLock::new(HashMap::new())),
    });

    // Start HTTPS server
    let server_addr: SocketAddr = ([0, 0, 0, 0], cli.port).into();
    let router = server::build_router(schema.clone());

    let certs = tls::ensure_certificates()?;
    let tls_config = tls::build_tls_config(&certs)?;
    let acceptor = TlsAcceptor::from(Arc::new(tls_config));
    let tls_listener = tokio::net::TcpListener::bind(server_addr).await?;

    tracing::info!("HTTPS server listening on {}", server_addr);

    let server_handle = tokio::spawn(async move {
        let listener = TlsListener {
            inner: tls_listener,
            acceptor,
        };
        if let Err(e) = axum::serve(listener, router).await {
            tracing::error!("HTTPS server error: {}", e);
        }
    });

    // Start gRPC server
    let grpc_handle = if !cli.no_grpc {
        let grpc_addr: SocketAddr = ([0, 0, 0, 0], cli.grpc_port).into();
        let state = coordinator_state.clone();

        tracing::info!("gRPC server listening on {}", grpc_addr);
        Some(tokio::spawn(async move {
            TonicServer::builder()
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
                .serve(grpc_addr)
                .await
                .unwrap();
        }))
    } else {
        None
    };

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

    // Setup signal handling
    let shutdown = tokio::signal::ctrl_c();

    tokio::select! {
        _ = shutdown => {
            tracing::info!("Received shutdown signal");
        }
        _ = server_handle => {
            tracing::info!("Server stopped");
        }
    }

    // Cleanup
    tracing::info!("Shutting down...");
    if let Some(handle) = watcher_handle {
        handle.abort();
    }
    if let Some(handle) = grpc_handle {
        handle.abort();
    }
    if let Some(pid_path) = &cli.pid_file {
        let _ = std::fs::remove_file(pid_path);
    }
    lock.release()?;

    tracing::info!("Coordinator stopped");
    Ok(())
}

/// Daemonize by forking and waiting for the child to be healthy.
fn daemonize(cli: &Cli) -> Result<(), Box<dyn std::error::Error>> {
    use std::process::Command;

    let exe = std::env::current_exe()?;
    let mut args = vec!["--foreground".to_string()];
    args.push("--port".to_string());
    args.push(cli.port.to_string());
    args.push("--grpc-port".to_string());
    args.push(cli.grpc_port.to_string());

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

    // Write PID file for daemon tracking
    let pid_path = if let Some(home) = dirs::home_dir() {
        let han_dir = home.join(".han");
        let _ = std::fs::create_dir_all(&han_dir);
        han_dir.join("coordinator.pid").to_string_lossy().to_string()
    } else {
        "coordinator.pid".to_string()
    };
    args.push("--pid-file".to_string());
    args.push(pid_path.clone());

    let child = Command::new(exe)
        .args(&args)
        .stdout(std::process::Stdio::null())
        .stderr(std::process::Stdio::null())
        .stdin(std::process::Stdio::null())
        .spawn()?;

    tracing::info!("Daemon started with PID {}", child.id());

    // Wait a bit and check health
    std::thread::sleep(std::time::Duration::from_secs(2));

    let health_url = format!("https://coordinator.local.han.guru:{}/health", cli.port);
    match std::process::Command::new("curl")
        .args(["-sk", "-o", "/dev/null", "-w", "%{http_code}", &health_url])
        .output()
    {
        Ok(output) => {
            let status = String::from_utf8_lossy(&output.stdout);
            if status.trim() == "200" {
                tracing::info!("Daemon is healthy");
            } else {
                tracing::warn!("Daemon health check returned: {}", status);
            }
        }
        Err(_) => {
            tracing::warn!("Could not check daemon health (curl not available)");
        }
    }

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_resolve_db_path_explicit() {
        assert_eq!(resolve_db_path(Some("/tmp/test.db")), "/tmp/test.db");
    }

    #[test]
    fn test_resolve_db_path_default() {
        let path = resolve_db_path(None);
        assert!(path.ends_with("han.db"));
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

    #[test]
    fn test_resolve_db_path_explicit_absolute() {
        assert_eq!(
            resolve_db_path(Some("/custom/path/data.db")),
            "/custom/path/data.db"
        );
    }

    #[test]
    fn test_resolve_db_path_explicit_relative() {
        assert_eq!(resolve_db_path(Some("./local.db")), "./local.db");
    }

    #[test]
    fn test_resolve_db_path_none_falls_back() {
        // When no explicit path is given, should resolve to something ending in han.db
        let path = resolve_db_path(None);
        assert!(
            path.ends_with("han.db"),
            "Expected path ending with han.db, got: {}",
            path
        );
        // On a system with a home dir, it should contain .han directory
        if dirs::home_dir().is_some() {
            assert!(
                path.contains(".han"),
                "Expected path containing .han, got: {}",
                path
            );
        }
    }

    #[test]
    fn test_resolve_db_path_explicit_empty_string() {
        // An empty string is still an explicit path
        assert_eq!(resolve_db_path(Some("")), "");
    }
}
