#![cfg(unix)]

use std::{process::{Child, Command, Stdio}, time::Duration};

struct Daemon(Child);
impl Drop for Daemon {
    fn drop(&mut self) { let _ = self.0.kill(); let _ = self.0.wait(); }
}

fn spawn(dir: &std::path::Path, grpc_port: u16) -> Daemon {
    Daemon(Command::new(env!("CARGO_BIN_EXE_han-coordinator"))
        .args(["--foreground", "--port", "0", "--grpc-port", &grpc_port.to_string(), "--no-watcher", "--data-dir"])
        .arg(dir)
        .env("HAN_DATA_DIR", dir)
        .env("CLAUDE_CONFIG_DIR", dir.join("claude"))
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
        .spawn().unwrap())
}

async fn descriptor(dir: &std::path::Path, child: &mut Child) -> serde_json::Value {
    let deadline = tokio::time::Instant::now() + Duration::from_secs(45);
    loop {
        if let Ok(data) = std::fs::read(dir.join("runtime/coordinator.json")) {
            return serde_json::from_slice(&data).unwrap();
        }
        assert!(child.try_wait().unwrap().is_none(), "coordinator exited before publishing descriptor");
        assert!(tokio::time::Instant::now() < deadline, "descriptor was not published");
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

#[tokio::test]
async fn descriptor_pins_https_and_grpc_web_and_guards_requests() {
    let dir = tempfile::tempdir().unwrap();
    let mut daemon = spawn(dir.path(), 0);
    let d = descriptor(dir.path(), &mut daemon.0).await;
    assert_eq!(d["transportVersion"], 1);
    assert_eq!(d["pid"].as_u64(), Some(daemon.0.id() as u64));
    assert!(d["supervisor"].is_null());
    let https_port = d["httpsPort"].as_u64().unwrap();
    let grpc_port = d["grpcPort"].as_u64().unwrap();
    let token = d["bearerToken"].as_str().unwrap();
    let cert = reqwest::Certificate::from_pem(d["certificatePem"].as_str().unwrap().as_bytes()).unwrap();
    let h2 = reqwest::Client::builder().tls_built_in_root_certs(false).add_root_certificate(cert.clone())
        .http2_prior_knowledge().no_proxy().timeout(Duration::from_secs(5)).build().unwrap();
    let client = reqwest::Client::builder().tls_built_in_root_certs(false).add_root_certificate(cert)
        .http1_only().no_proxy().timeout(Duration::from_secs(5)).build().unwrap();
    let url = format!("https://127.0.0.1:{https_port}/health");
    let response = client.get(&url).bearer_auth(token).send().await.unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    assert_eq!(response.json::<serde_json::Value>().await.unwrap()["pid"], d["pid"]);
    let h2_health = h2.get(&url).bearer_auth(token).send().await.unwrap();
    assert_eq!(h2_health.version(), reqwest::Version::HTTP_2);
    assert_eq!(h2_health.status(), reqwest::StatusCode::OK);
    assert_eq!(client.get(&url).send().await.unwrap().status(), reqwest::StatusCode::UNAUTHORIZED);
    assert_eq!(client.get(&url).bearer_auth("wrong").send().await.unwrap().status(), reqwest::StatusCode::UNAUTHORIZED);
    assert_eq!(client.get(&url).header("host", format!("localhost:{https_port}")).bearer_auth(token).send().await.unwrap().status(), reqwest::StatusCode::MISDIRECTED_REQUEST);
    assert_eq!(client.get(&url).header("origin", "https://example.com").bearer_auth(token).send().await.unwrap().status(), reqwest::StatusCode::FORBIDDEN);
    let untrusted = reqwest::Client::builder().tls_built_in_root_certs(false).no_proxy().build().unwrap();
    assert!(untrusted.get(&url).bearer_auth(token).send().await.is_err());
    let graphql = format!("https://127.0.0.1:{https_port}/graphql");
    let result = client.post(&graphql).bearer_auth(token).json(&serde_json::json!({"query":"{ __typename }"})).send().await.unwrap();
    assert_eq!(result.status(), reqwest::StatusCode::OK);
    assert_eq!(result.json::<serde_json::Value>().await.unwrap()["data"]["__typename"], "Query");
    let grpc = format!("https://127.0.0.1:{grpc_port}/han.coordinator.CoordinatorService/Health");
    let response = client.post(&grpc).header("content-type", "application/grpc-web+proto").bearer_auth(token).body(vec![0u8; 5]).send().await.unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    let payload = response.bytes().await.unwrap();
    assert!(!payload.is_empty() && payload[0] == 0, "missing gRPC-web response message");
    let h2_response = h2.post(&grpc).header("content-type", "application/grpc-web+proto").bearer_auth(token).body(vec![0u8; 5]).send().await.unwrap();
    assert_eq!(h2_response.version(), reqwest::Version::HTTP_2);
    assert_eq!(h2_response.status(), reqwest::StatusCode::OK);
    assert_eq!(h2_response.bytes().await.unwrap()[0], 0);
    let response = client.post(&grpc).header("content-type", "application/grpc-web+proto").bearer_auth("wrong").body(vec![0u8; 5]).send().await.unwrap();
    assert_eq!(response.headers().get("grpc-status").unwrap(), "16");
    assert_eq!(client.post(&grpc).header("content-type", "application/grpc-web+proto").header("origin", "http://127.0.0.1:1234").bearer_auth(token).body(vec![0u8; 5]).send().await.unwrap().status(), reqwest::StatusCode::FORBIDDEN);
    assert_eq!(client.post(&grpc).header("content-type", "application/grpc-web+proto").header("host", format!("evil.example:{grpc_port}")).bearer_auth(token).body(vec![0u8; 5]).send().await.unwrap().status(), reqwest::StatusCode::MISDIRECTED_REQUEST);
}

#[tokio::test]
async fn occupied_grpc_port_does_not_publish_readiness() {
    let dir = tempfile::tempdir().unwrap();
    let occupied = std::net::TcpListener::bind((std::net::Ipv4Addr::LOCALHOST, 0)).unwrap();
    let port = occupied.local_addr().unwrap().port();
    let mut daemon = spawn(dir.path(), port);
    let deadline = tokio::time::Instant::now() + Duration::from_secs(10);
    loop {
        if let Some(status) = daemon.0.try_wait().unwrap() { assert!(!status.success()); break; }
        assert!(tokio::time::Instant::now() < deadline, "failed bind did not stop daemon");
        tokio::time::sleep(Duration::from_millis(25)).await;
    }
    assert!(!dir.path().join("runtime/coordinator.json").exists());
}

#[tokio::test]
async fn sigterm_removes_the_owned_descriptor() {
    let dir = tempfile::tempdir().unwrap();
    let mut daemon = spawn(dir.path(), 0);
    let _ = descriptor(dir.path(), &mut daemon.0).await;
    nix::sys::signal::kill(nix::unistd::Pid::from_raw(daemon.0.id() as i32), nix::sys::signal::Signal::SIGTERM).unwrap();
    let deadline = tokio::time::Instant::now() + Duration::from_secs(10);
    loop {
        if let Some(status) = daemon.0.try_wait().unwrap() { assert!(status.success()); break; }
        assert!(tokio::time::Instant::now() < deadline, "coordinator did not stop");
        tokio::time::sleep(Duration::from_millis(25)).await;
    }
    assert!(!dir.path().join("runtime/coordinator.json").exists());
}

#[tokio::test]
async fn supervised_shutdown_is_authenticated_and_commits_intent_before_response() {
    use std::os::unix::fs::PermissionsExt;
    let dir = tempfile::tempdir().unwrap();
    let nonce = uuid::Uuid::new_v4().to_string();
    let generation = uuid::Uuid::new_v4().to_string();
    let mut daemon = Daemon(Command::new(env!("CARGO_BIN_EXE_han-coordinator"))
        .args(["--foreground", "--port", "0", "--grpc-port", "0", "--no-watcher", "--data-dir"])
        .arg(dir.path())
        .args(["--supervisor-pid", &std::process::id().to_string(), "--supervisor-nonce", &nonce, "--supervisor-generation", &generation])
        .env("HAN_DATA_DIR", dir.path())
        .env("CLAUDE_CONFIG_DIR", dir.path().join("claude"))
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null())
        .spawn().unwrap());
    let d = descriptor(dir.path(), &mut daemon.0).await;
    assert_eq!(d["supervisor"], serde_json::json!({ "pid": std::process::id(), "nonce": nonce, "generationId": generation }));
    let marker = dir.path().join("runtime").join(format!("coordinator.stopping.{}.{}.json", nonce, generation));
    let active = dir.path().join("runtime/coordinator.json");
    let cert = reqwest::Certificate::from_pem(d["certificatePem"].as_str().unwrap().as_bytes()).unwrap();
    let client = reqwest::Client::builder().tls_built_in_root_certs(false).add_root_certificate(cert)
        .http1_only().no_proxy().timeout(Duration::from_secs(5)).build().unwrap();
    let url = format!("https://127.0.0.1:{}/han.coordinator.CoordinatorService/Shutdown", d["grpcPort"].as_u64().unwrap());
    // graceful=true, timeout_seconds=2: leave time to send a duplicate.
    let body = vec![0, 0, 0, 0, 4, 8, 1, 16, 2];
    let rejected = client.post(&url).header("content-type", "application/grpc-web+proto")
        .bearer_auth("wrong").body(body.clone()).send().await.unwrap();
    assert_eq!(rejected.headers().get("grpc-status").unwrap(), "16");
    assert!(active.exists());
    assert!(!marker.exists());
    let accepted = client.post(&url).header("content-type", "application/grpc-web+proto")
        .bearer_auth(d["bearerToken"].as_str().unwrap()).body(body.clone()).send().await.unwrap();
    assert_eq!(accepted.status(), reqwest::StatusCode::OK);
    assert_eq!(accepted.bytes().await.unwrap()[0], 0);
    assert!(!active.exists());
    assert_eq!(serde_json::from_slice::<serde_json::Value>(&std::fs::read(&marker).unwrap()).unwrap(), d);
    assert_eq!(std::fs::metadata(&marker).unwrap().permissions().mode() & 0o777, 0o600);
    let duplicate = client.post(&url).header("content-type", "application/grpc-web+proto")
        .bearer_auth(d["bearerToken"].as_str().unwrap()).body(body).send().await.unwrap();
    assert_eq!(duplicate.bytes().await.unwrap()[0], 0);
    let deadline = tokio::time::Instant::now() + Duration::from_secs(10);
    while daemon.0.try_wait().unwrap().is_none() {
        assert!(tokio::time::Instant::now() < deadline);
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
    assert!(marker.exists());
}

#[test]
fn supervisor_arguments_require_complete_valid_parent_binding() {
    let dir = tempfile::tempdir().unwrap();
    let run = |args: &[&str]| Command::new(env!("CARGO_BIN_EXE_han-coordinator"))
        .args(args).arg("--data-dir").arg(dir.path())
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).status().unwrap();
    let uuid = uuid::Uuid::new_v4().to_string();
    assert!(!run(&["--foreground", "--supervisor-pid", "1"]).success());
    assert!(!run(&["--foreground", "--supervisor-pid", "1", "--supervisor-nonce", &uuid, "--supervisor-generation", &uuid]).success());
    assert!(!run(&["--supervisor-pid", "1", "--supervisor-nonce", &uuid, "--supervisor-generation", &uuid]).success());
    assert!(!run(&["--foreground", "--supervisor-pid", "1", "--supervisor-nonce", "../bad", "--supervisor-generation", &uuid]).success());
    assert!(!dir.path().join("runtime/coordinator.json").exists());
}

#[tokio::test]
async fn supervised_shutdown_refuses_a_replaced_descriptor() {
    let dir = tempfile::tempdir().unwrap();
    let nonce = uuid::Uuid::new_v4().to_string();
    let generation = uuid::Uuid::new_v4().to_string();
    let mut daemon = Daemon(Command::new(env!("CARGO_BIN_EXE_han-coordinator"))
        .args(["--foreground", "--port", "0", "--grpc-port", "0", "--no-watcher", "--data-dir"])
        .arg(dir.path())
        .args(["--supervisor-pid", &std::process::id().to_string(), "--supervisor-nonce", &nonce, "--supervisor-generation", &generation])
        .env("HAN_DATA_DIR", dir.path()).env("CLAUDE_CONFIG_DIR", dir.path().join("claude"))
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().unwrap());
    let d = descriptor(dir.path(), &mut daemon.0).await;
    let active = dir.path().join("runtime/coordinator.json");
    let marker = dir.path().join("runtime").join(format!("coordinator.stopping.{}.{}.json", nonce, generation));
    let mut replacement = d.clone();
    replacement["instanceId"] = serde_json::json!("replacement");
    std::fs::write(&active, serde_json::to_vec(&replacement).unwrap()).unwrap();
    let cert = reqwest::Certificate::from_pem(d["certificatePem"].as_str().unwrap().as_bytes()).unwrap();
    let client = reqwest::Client::builder().tls_built_in_root_certs(false).add_root_certificate(cert)
        .http1_only().no_proxy().timeout(Duration::from_secs(5)).build().unwrap();
    let url = format!("https://127.0.0.1:{}/han.coordinator.CoordinatorService/Shutdown", d["grpcPort"].as_u64().unwrap());
    let response = client.post(url).header("content-type", "application/grpc-web+proto")
        .bearer_auth(d["bearerToken"].as_str().unwrap()).body(vec![0u8; 5]).send().await.unwrap();
    let header_status = response.headers().get("grpc-status").and_then(|v| v.to_str().ok()).map(str::to_owned);
    let body = response.bytes().await.unwrap();
    assert!(header_status.as_deref() == Some("9") || String::from_utf8_lossy(&body).contains("grpc-status: 9"));
    assert_eq!(serde_json::from_slice::<serde_json::Value>(&std::fs::read(&active).unwrap()).unwrap(), replacement);
    assert!(!marker.exists());
    assert!(daemon.0.try_wait().unwrap().is_none());
}
