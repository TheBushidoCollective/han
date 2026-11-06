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
