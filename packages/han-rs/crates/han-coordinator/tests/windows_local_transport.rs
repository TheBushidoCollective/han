#![cfg(windows)]

use std::{
    io::Write,
    path::Path,
    process::{Child, Command, Output, Stdio},
    time::{Duration, Instant},
};
use serde_json::{json, Value};

const BIN: &str = env!("CARGO_BIN_EXE_han-coordinator");

struct TestDir {
    _temp: tempfile::TempDir,
    data: std::path::PathBuf,
}
impl TestDir {
    fn new() -> Self {
        let temp = tempfile::tempdir().unwrap();
        let data = temp.path().join("han-data");
        Self { _temp: temp, data }
    }
    fn path(&self) -> &Path { &self.data }
}

struct Process(Child);
impl Drop for Process {
    fn drop(&mut self) {
        let _ = self.0.kill();
        let _ = self.0.wait();
    }
}

fn helper_raw(input: &[u8]) -> Output {
    let mut child = Command::new(BIN).arg("--local-runtime")
        .stdin(Stdio::piped()).stdout(Stdio::piped()).stderr(Stdio::piped()).spawn().unwrap();
    // Oversized requests can close the pipe before the whole request is written.
    let _ = child.stdin.take().unwrap().write_all(input);
    child.wait_with_output().unwrap()
}

fn call(dir: &Path, op: &str, extra: Value) -> Value {
    let mut request = json!({"version": 1, "dataDir": dir, "op": op});
    request.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
    let out = helper_raw(&serde_json::to_vec(&request).unwrap());
    assert!(out.status.success(), "helper {op} failed");
    assert!(out.stdout.len() <= 128 * 1024);
    let response: Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(response["version"], 1);
    assert_eq!(response["ok"], true);
    response["result"].clone()
}

fn read_descriptor(dir: &Path, target: Value) -> Value {
    call(dir, "descriptor.read", json!({"target": target}))
}

fn acquire(dir: &Path) -> Value {
    let result = call(dir, "supervisor.acquire", json!({}));
    assert_eq!(result["status"], "owned");
    let claim = result["claim"].clone();
    assert_eq!(claim["process"]["pid"], std::process::id());
    assert!(claim["process"]["creationTime"].as_str().unwrap().parse::<u64>().unwrap() > 0);
    assert!(claim["process"]["userSid"].as_str().unwrap().starts_with("S-"));
    for field in ["reservation", "ownerFile", "pidFile"] {
        assert!(!claim[field]["volumeSerial"].as_str().unwrap().is_empty());
        assert!(!claim[field]["fileId"].as_str().unwrap().is_empty());
    }
    claim
}

fn spawn(dir: &Path, claim: &Value, generation: &str) -> Process {
    Process(Command::new(BIN)
        .args(["--foreground", "--port", "0", "--grpc-port", "0", "--no-watcher", "--data-dir"])
        .arg(dir)
        .args(["--supervisor-pid", &std::process::id().to_string(), "--supervisor-nonce", claim["nonce"].as_str().unwrap(), "--supervisor-generation", generation])
        .env("HAN_DATA_DIR", dir).env("CLAUDE_CONFIG_DIR", dir.join("claude"))
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().unwrap())
}

async fn wait_descriptor(dir: &Path, daemon: &mut Process) -> Value {
    let deadline = Instant::now() + Duration::from_secs(45);
    loop {
        let result = read_descriptor(dir, json!({"kind":"active"}));
        if !result.is_null() && result["descriptor"]["pid"] == daemon.0.id() { return result["descriptor"].clone(); }
        assert!(daemon.0.try_wait().unwrap().is_none(), "coordinator exited before publishing");
        assert!(Instant::now() < deadline, "coordinator did not publish");
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

async fn wait_exit(process: &mut Process) {
    let deadline = Instant::now() + Duration::from_secs(15);
    loop {
        if let Some(status) = process.0.try_wait().unwrap() {
            assert!(status.success(), "coordinator exited unsuccessfully: {status}");
            return;
        }
        assert!(Instant::now() < deadline, "process did not exit");
        tokio::time::sleep(Duration::from_millis(50)).await;
    }
}

fn client(d: &Value) -> reqwest::Client {
    let cert = reqwest::Certificate::from_pem(d["certificatePem"].as_str().unwrap().as_bytes()).unwrap();
    reqwest::Client::builder().tls_built_in_root_certs(false).add_root_certificate(cert)
        .http1_only().no_proxy().timeout(Duration::from_secs(5)).build().unwrap()
}

async fn shutdown(dir: &Path, d: &Value, binding: &Value) {
    let http = client(d);
    let url = format!("https://127.0.0.1:{}/han.coordinator.CoordinatorService/Shutdown", d["grpcPort"]);
    let body = vec![0, 0, 0, 0, 4, 8, 1, 16, 2];
    let response = http.post(&url).header("content-type", "application/grpc-web+proto")
        .bearer_auth(d["bearerToken"].as_str().unwrap()).body(body).send().await.unwrap();
    assert_eq!(response.status(), reqwest::StatusCode::OK);
    assert_eq!(response.bytes().await.unwrap()[0], 0);
    assert!(read_descriptor(dir, json!({"kind":"active"})).is_null());
    let intent = read_descriptor(dir, json!({"kind":"stopping", "binding":binding}));
    assert!(intent["descriptor"] == *d);
}

fn remove_intent(dir: &Path, d: &Value, binding: &Value) {
    let result = call(dir, "intent.remove", json!({"binding":binding, "childPid":d["pid"], "descriptor":d}));
    assert_eq!(result["status"], "removed");
    assert!(read_descriptor(dir, json!({"kind":"stopping", "binding":binding})).is_null());
}

#[test]
fn windows_helper_rejects_malformed_and_oversized_input() {
    let dir = TestDir::new();
    let valid = json!({"version":1,"dataDir":dir.path(),"op":"supervisor.acquire"});
    let inputs = vec![b"{".to_vec(), vec![b' '; 128 * 1024 + 1],
        serde_json::to_vec(&json!({"version":2,"dataDir":dir.path(),"op":"supervisor.acquire"})).unwrap(),
        serde_json::to_vec(&json!({"version":1,"dataDir":dir.path(),"op":"supervisor.acquire","claim":null})).unwrap(),
        serde_json::to_vec(&json!({"version":1,"dataDir":"relative","op":"supervisor.acquire"})).unwrap(),
        serde_json::to_vec(&json!({"version":1,"dataDir":dir.path(),"op":"unknown"})).unwrap()];
    for input in inputs { assert!(!helper_raw(&input).status.success()); }
    assert!(!dir.path().join("runtime").exists());
    assert!(helper_raw(&serde_json::to_vec(&valid).unwrap()).status.success());
}

#[test]
fn runtime_prepare_recovers_missing_lock_without_readers_creating_it() {
    let dir = TestDir::new();
    assert_eq!(call(dir.path(), "runtime.prepare", json!({}))["status"], "prepared");
    let lock = dir.path().join("runtime/descriptor-publication.lock");
    std::fs::remove_file(&lock).unwrap();
    for (op, extra) in [("supervisor.read", json!({})), ("descriptor.read", json!({"target":{"kind":"active"}}))] {
        let mut request = json!({"version":1,"dataDir":dir.path(),"op":op});
        request.as_object_mut().unwrap().extend(extra.as_object().unwrap().clone());
        assert!(!helper_raw(&serde_json::to_vec(&request).unwrap()).status.success());
        assert!(!lock.exists());
    }
    assert_eq!(call(dir.path(), "runtime.prepare", json!({}))["status"], "prepared");
    assert_eq!(call(dir.path(), "runtime.prepare", json!({}))["status"], "prepared");
    assert_eq!(call(dir.path(), "supervisor.read", json!({}))["status"], "absent");
}

#[test]
fn malformed_request_reports_only_safe_diagnostic() {
    let out = helper_raw(br#"{"secret":"sentinel-secret"}"#);
    assert!(!out.status.success());
    let response: Value = serde_json::from_slice(&out.stdout).unwrap();
    assert_eq!(response["version"], 1);
    assert_eq!(response["ok"], false);
    assert_eq!(response["error"]["stage"], "input_validation");
    assert_eq!(response["error"]["kind"], "invalid_data");
    assert!(!String::from_utf8_lossy(&out.stdout).contains("sentinel-secret"));
    assert!(!String::from_utf8_lossy(&out.stderr).contains("sentinel-secret"));
}

#[tokio::test]
async fn windows_supervised_wire_shutdown_and_successor_isolation() {
    let dir = TestDir::new();
    let claim = acquire(dir.path());
    let status = call(dir.path(), "supervisor.read", json!({}));
    assert_eq!(status["status"], "present");
    assert!(status["process"] == claim["process"]);
    assert!(status["nonce"] == claim["nonce"]);
    assert_eq!(call(dir.path(), "supervisor.check", json!({"claim":claim}))["status"], "owned");
    assert_eq!(call(dir.path(), "supervisor.acquire", json!({}))["status"], "blocked");
    let generation = uuid::Uuid::new_v4().to_string();
    let binding = json!({"pid":std::process::id(),"nonce":claim["nonce"],"generationId":generation});
    let mut daemon = spawn(dir.path(), &claim, &generation);
    let d = wait_descriptor(dir.path(), &mut daemon).await;
    assert_eq!(d["pid"], daemon.0.id());
    assert_eq!(d["process"]["pid"], daemon.0.id());
    assert_eq!(call(dir.path(), "process.state", json!({"process":d["process"]}))["status"], "alive");
    let mut old_process = d["process"].clone();
    let time = old_process["creationTime"].as_str().unwrap().parse::<u64>().unwrap();
    old_process["creationTime"] = json!((time + 1).to_string());
    assert_eq!(call(dir.path(), "process.state", json!({"process":old_process}))["status"], "gone");
    let mut wrong_sid = d["process"].clone();
    wrong_sid["userSid"] = if wrong_sid["userSid"] == "S-1-5-18" { json!("S-1-5-19") } else { json!("S-1-5-18") };
    let request = json!({"version":1, "dataDir":dir.path(), "op":"process.state", "process":wrong_sid});
    assert!(!helper_raw(&serde_json::to_vec(&request).unwrap()).status.success());
    assert!(d["supervisor"] == binding);
    let http = client(&d);
    let url = format!("https://127.0.0.1:{}/health", d["httpsPort"]);
    let token = d["bearerToken"].as_str().unwrap();
    let good = http.get(&url).bearer_auth(token).send().await.unwrap();
    assert_eq!(good.status(), reqwest::StatusCode::OK);
    assert_eq!(good.json::<Value>().await.unwrap()["pid"], d["pid"]);
    assert_eq!(http.get(&url).send().await.unwrap().status(), reqwest::StatusCode::UNAUTHORIZED);
    assert_eq!(http.get(&url).bearer_auth("wrong").send().await.unwrap().status(), reqwest::StatusCode::UNAUTHORIZED);
    assert_eq!(http.get(&url).bearer_auth(token).header("origin", "https://example.com").send().await.unwrap().status(), reqwest::StatusCode::FORBIDDEN);
    assert_eq!(http.get(&url).bearer_auth(token).header("host", format!("localhost:{}", d["httpsPort"])).send().await.unwrap().status(), reqwest::StatusCode::MISDIRECTED_REQUEST);
    let untrusted = reqwest::Client::builder().tls_built_in_root_certs(false).no_proxy().timeout(Duration::from_secs(5)).build().unwrap();
    assert!(untrusted.get(&url).bearer_auth(token).send().await.is_err());
    let grpc = format!("https://127.0.0.1:{}/han.coordinator.CoordinatorService/Health", d["grpcPort"]);
    let good = http.post(&grpc).header("content-type", "application/grpc-web+proto").bearer_auth(token).body(vec![0u8;5]).send().await.unwrap();
    assert_eq!(good.status(), reqwest::StatusCode::OK);
    assert_eq!(good.bytes().await.unwrap()[0], 0);
    let denied = http.post(&grpc).header("content-type", "application/grpc-web+proto").bearer_auth("wrong").body(vec![0u8;5]).send().await.unwrap();
    assert_eq!(denied.headers().get("grpc-status").unwrap(), "16");
    let stop = format!("https://127.0.0.1:{}/han.coordinator.CoordinatorService/Shutdown", d["grpcPort"]);
    let denied = http.post(&stop).header("content-type", "application/grpc-web+proto").bearer_auth("wrong").body(vec![0u8;5]).send().await.unwrap();
    assert_eq!(denied.headers().get("grpc-status").unwrap(), "16");
    let denied = http.post(&stop).header("content-type", "application/grpc-web+proto").header("origin", "https://example.com").bearer_auth(token).body(vec![0u8;5]).send().await.unwrap();
    assert_eq!(denied.status(), reqwest::StatusCode::FORBIDDEN);
    let denied = http.post(&stop).header("content-type", "application/grpc-web+proto").header("host", format!("evil.example:{}", d["grpcPort"])).bearer_auth(token).body(vec![0u8;5]).send().await.unwrap();
    assert_eq!(denied.status(), reqwest::StatusCode::MISDIRECTED_REQUEST);
    assert!(read_descriptor(dir.path(), json!({"kind":"active"}))["descriptor"] == d);
    shutdown(dir.path(), &d, &binding).await;
    wait_exit(&mut daemon).await;
    remove_intent(dir.path(), &d, &binding);
    assert_eq!(call(dir.path(), "supervisor.release", json!({"claim":claim}))["status"], "released");
    let successor = acquire(dir.path());
    assert!(successor["nonce"] != claim["nonce"]);
    assert_eq!(call(dir.path(), "supervisor.release", json!({"claim":claim}))["status"], "changed");
    assert_eq!(call(dir.path(), "supervisor.check", json!({"claim":successor}))["status"], "owned");
    let next_generation = uuid::Uuid::new_v4().to_string();
    let next_binding = json!({"pid":std::process::id(),"nonce":successor["nonce"],"generationId":next_generation});
    let mut next = spawn(dir.path(), &successor, &next_generation);
    let next_d = wait_descriptor(dir.path(), &mut next).await;
    assert_ne!(d["instanceId"], next_d["instanceId"]);
    assert!(read_descriptor(dir.path(), json!({"kind":"stopping","binding":binding})).is_null());
    let stale = json!({"version":1,"dataDir":dir.path(),"op":"intent.remove","binding":binding,"childPid":d["pid"],"descriptor":d});
    assert!(!helper_raw(&serde_json::to_vec(&stale).unwrap()).status.success());
    assert!(read_descriptor(dir.path(), json!({"kind":"active"}))["descriptor"] == next_d);
    shutdown(dir.path(), &next_d, &next_binding).await;
    wait_exit(&mut next).await;
    remove_intent(dir.path(), &next_d, &next_binding);
    assert_eq!(call(dir.path(), "supervisor.release", json!({"claim":successor}))["status"], "released");
}

// Runs only when explicitly invoked as a child by the recovery test. The test
// executable is the helper's actual parent, just as the Han supervisor is.
#[test]
fn windows_claim_owner_child() {
    let Some(dir) = std::env::var_os("HAN_WINDOWS_CLAIM_CHILD") else { return };
    let dir = std::path::PathBuf::from(dir);
    let claim = acquire(&dir);
    std::fs::write(dir.join("child-ready.json"), serde_json::to_vec(&claim).unwrap()).unwrap();
    loop { std::thread::sleep(Duration::from_millis(100)); }
}

#[tokio::test]
async fn windows_crashed_coordinator_is_replaced_by_fresh_generation() {
    let dir = TestDir::new();
    let claim = acquire(dir.path());
    let old_generation = uuid::Uuid::new_v4().to_string();
    let mut old = spawn(dir.path(), &claim, &old_generation);
    let old_descriptor = wait_descriptor(dir.path(), &mut old).await;
    old.0.kill().unwrap();
    old.0.wait().unwrap();
    let generation = uuid::Uuid::new_v4().to_string();
    let binding = json!({"pid":std::process::id(),"nonce":claim["nonce"],"generationId":generation});
    let mut replacement = spawn(dir.path(), &claim, &generation);
    let descriptor = wait_descriptor(dir.path(), &mut replacement).await;
    assert_ne!(old_descriptor["instanceId"], descriptor["instanceId"]);
    assert!(descriptor["supervisor"] == binding);
    let url = format!("https://127.0.0.1:{}/health", descriptor["httpsPort"]);
    assert_eq!(client(&descriptor).get(url).bearer_auth(descriptor["bearerToken"].as_str().unwrap()).send().await.unwrap().status(), reqwest::StatusCode::OK);
    shutdown(dir.path(), &descriptor, &binding).await;
    wait_exit(&mut replacement).await;
    remove_intent(dir.path(), &descriptor, &binding);
    assert_eq!(call(dir.path(), "supervisor.release", json!({"claim":claim}))["status"], "released");
}

#[test]
fn windows_partial_claim_crash_recovers_from_dead_owner() {
    let dir = TestDir::new();
    let mut child = Process(Command::new(std::env::current_exe().unwrap())
        .args(["--exact", "windows_claim_owner_child", "--nocapture"])
        .env("HAN_WINDOWS_CLAIM_CHILD", dir.path())
        .stdin(Stdio::null()).stdout(Stdio::null()).stderr(Stdio::null()).spawn().unwrap());
    let deadline = Instant::now() + Duration::from_secs(30);
    let ready = dir.path().join("child-ready.json");
    while !ready.exists() {
        assert!(child.0.try_wait().unwrap().is_none(), "claim owner exited prematurely");
        assert!(Instant::now() < deadline, "claim owner did not become ready");
        std::thread::sleep(Duration::from_millis(50));
    }
    let old: Value = serde_json::from_slice(&std::fs::read(ready).unwrap()).unwrap();
    assert_eq!(old["process"]["pid"], child.0.id());
    std::fs::remove_file(dir.path().join("runtime/supervisor.owner.json")).unwrap();
    assert_eq!(call(dir.path(), "supervisor.acquire", json!({}))["status"], "blocked");
    child.0.kill().unwrap();
    child.0.wait().unwrap();
    let reservation = std::fs::read(dir.path().join("runtime/supervisor.reservation.json")).unwrap();
    assert_eq!(call(dir.path(), "supervisor.read", json!({}))["status"], "recoverable");
    assert!(std::fs::read(dir.path().join("runtime/supervisor.reservation.json")).unwrap() == reservation);
    let replacement = acquire(dir.path());
    assert!(old["nonce"] != replacement["nonce"]);
    assert_eq!(call(dir.path(), "supervisor.check", json!({"claim":replacement}))["status"], "owned");
    assert_eq!(call(dir.path(), "supervisor.release", json!({"claim":replacement}))["status"], "released");
}
