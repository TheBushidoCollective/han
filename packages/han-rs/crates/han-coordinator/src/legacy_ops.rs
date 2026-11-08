use crate::legacy_identity;
#[allow(unused_imports)]
use crate::legacy_identity::Escalation;
use han_proto::coordinator::coordinator_service_client::CoordinatorServiceClient;
use han_proto::coordinator::ShutdownRequest;
use serde::{Deserialize, Serialize};
use serde_json::{json, Value};
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::Duration;
use tonic::transport::Channel;
use uuid::Uuid;

#[derive(Debug, Clone, PartialEq, Eq, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct LegacyIdentity {
    pub pid: u32,
    pub start_time: String,
    pub https_port: u16,
    pub grpc_port: u16,
    pub exe: String,
}

fn home_dir() -> Option<PathBuf> {
    #[cfg(windows)]
    {
        std::env::var_os("USERPROFILE")
            .map(PathBuf::from)
            .or_else(dirs::home_dir)
    }
    #[cfg(not(windows))]
    {
        std::env::var_os("HOME")
            .map(PathBuf::from)
            .or_else(dirs::home_dir)
    }
}

pub fn inspect(data_dir: &str, port: u16) -> io::Result<Value> {
    // 1. Check listeners on port
    let discovered = legacy_identity::listeners(port)?;
    if discovered.is_empty() {
        return Ok(json!({ "status": "absent" }));
    }

    // 2. Check for modern coordinator descriptor
    let descriptor_path = Path::new(data_dir).join("runtime").join("coordinator.json");
    if descriptor_path.exists() {
        if let Ok(content) = fs::read_to_string(&descriptor_path) {
            if let Ok(desc) = serde_json::from_str::<Value>(&content) {
                if let Some(dpid) = desc.get("pid").and_then(|p| p.as_u64()) {
                    let dpid_u32 = dpid as u32;
                    if discovered.iter().any(|l| l.owners.contains(&dpid_u32)) {
                        return Ok(json!({ "status": "modern", "pid": dpid_u32 }));
                    }
                }
            }
        }
    }

    // 3. Ensure exactly one owner across all sockets on port
    let mut all_owners: Vec<u32> = Vec::new();
    for l in &discovered {
        for o in &l.owners {
            if !all_owners.contains(o) {
                all_owners.push(*o);
            }
        }
    }

    if all_owners.len() != 1 {
        return Ok(json!({
            "status": "foreign",
            "reason": "ambiguous",
            "pid": null,
            "exe": null
        }));
    }

    let owner_pid = all_owners[0];

    // 4. Pin process and gather facts
    let pinned = match legacy_identity::pin(owner_pid) {
        Ok(p) => p,
        Err(_) => {
            return Ok(json!({
                "status": "foreign",
                "reason": "unattributable",
                "pid": owner_pid,
                "exe": null
            }))
        }
    };

    let facts = match legacy_identity::facts(&pinned) {
        Ok(f) => f,
        Err(_) => {
            return Ok(json!({
                "status": "foreign",
                "reason": "unattributable",
                "pid": owner_pid,
                "exe": null
            }))
        }
    };

    let exe_str = facts.exe.to_string_lossy().to_string();

    // 5. Check same user
    if !facts.same_user {
        return Ok(json!({
            "status": "foreign",
            "reason": "other-user",
            "pid": owner_pid,
            "exe": exe_str
        }));
    }

    // Check starting coordinator
    let is_localhost = discovered.iter().all(|l| l.addr.is_loopback());
    let data_dir_arg = format!("--data-dir={data_dir}");
    let has_data_dir = facts.argv.iter().any(|a| {
        let s = a.to_string_lossy();
        s == "--data-dir" || s == data_dir_arg
    });
    if is_localhost && has_data_dir {
        return Ok(json!({ "status": "starting", "pid": owner_pid }));
    }

    // 6. Check executable basename is exactly han-coordinator[.exe]
    let exe_name = facts
        .exe
        .file_name()
        .map(|n| n.to_string_lossy().to_string())
        .unwrap_or_default();
    if exe_name != "han-coordinator" && exe_name != "han-coordinator.exe" {
        return Ok(json!({
            "status": "foreign",
            "reason": "not-legacy",
            "pid": owner_pid,
            "exe": exe_str
        }));
    }

    // 7. Check legacy argv shape
    let mut has_foreground = false;
    let mut has_port = false;
    let mut has_pid_file = false;
    let mut forbidden_flag = false;
    let mut grpc_port: u16 = 41958;

    let args: Vec<String> = facts.argv.iter().map(|a| a.to_string_lossy().to_string()).collect();
    let mut i = 0;
    while i < args.len() {
        let arg = &args[i];
        if arg == "--foreground" {
            has_foreground = true;
        } else if arg == "--port" && i + 1 < args.len() {
            if let Ok(p) = args[i + 1].parse::<u16>() {
                if p == port {
                    has_port = true;
                }
            }
            i += 1;
        } else if arg.starts_with("--port=") {
            if let Ok(p) = arg["--port=".len()..].parse::<u16>() {
                if p == port {
                    has_port = true;
                }
            }
        } else if arg == "--pid-file" && i + 1 < args.len() {
            has_pid_file = true;
            i += 1;
        } else if arg.starts_with("--pid-file=") {
            has_pid_file = true;
        } else if arg == "--grpc-port" && i + 1 < args.len() {
            if let Ok(gp) = args[i + 1].parse::<u16>() {
                grpc_port = gp;
            }
            i += 1;
        } else if arg.starts_with("--grpc-port=") {
            if let Ok(gp) = arg["--grpc-port=".len()..].parse::<u16>() {
                grpc_port = gp;
            }
        } else if arg == "--data-dir"
            || arg.starts_with("--data-dir=")
            || arg == "--supervisor-pid"
            || arg.starts_with("--supervisor-pid=")
            || arg == "--supervisor-nonce"
            || arg.starts_with("--supervisor-nonce=")
            || arg == "--supervisor-generation"
            || arg.starts_with("--supervisor-generation=")
            || arg == "--startup-receipt"
            || arg.starts_with("--startup-receipt=")
            || arg == "--local-runtime"
        {
            forbidden_flag = true;
            break;
        }
        i += 1;
    }

    if !has_foreground || !has_port || !has_pid_file || forbidden_flag {
        return Ok(json!({
            "status": "foreign",
            "reason": "not-legacy",
            "pid": owner_pid,
            "exe": exe_str
        }));
    }

    // 8. Check 0.0.0.0 listeners for both HTTPS and gRPC
    let has_unspecified_https = discovered.iter().any(|l| l.addr.is_unspecified());
    if !has_unspecified_https {
        return Ok(json!({
            "status": "foreign",
            "reason": "not-legacy",
            "pid": owner_pid,
            "exe": exe_str
        }));
    }

    let grpc_discovered = legacy_identity::listeners(grpc_port)?;
    let has_unspecified_grpc = grpc_discovered
        .iter()
        .any(|l| l.addr.is_unspecified() && l.owners.contains(&owner_pid));
    if !has_unspecified_grpc {
        return Ok(json!({
            "status": "foreign",
            "reason": "not-legacy",
            "pid": owner_pid,
            "exe": exe_str
        }));
    }

    // 9. Confirm pin
    let confirmed = legacy_identity::confirm(&pinned, &facts)?;
    if !confirmed {
        return Ok(json!({
            "status": "foreign",
            "reason": "unattributable",
            "pid": owner_pid,
            "exe": exe_str
        }));
    }

    Ok(json!({
        "status": "legacy",
        "identity": {
            "pid": owner_pid,
            "startTime": facts.start_time,
            "httpsPort": port,
            "grpcPort": grpc_port,
            "exe": exe_str
        }
    }))
}

async fn send_shutdown_grpc(grpc_port: u16) -> io::Result<()> {
    let endpoint = format!("http://127.0.0.1:{grpc_port}");
    let channel = Channel::from_shared(endpoint)
        .map_err(|e| io::Error::new(io::ErrorKind::InvalidInput, e))?
        .connect_timeout(Duration::from_secs(2))
        .timeout(Duration::from_secs(2))
        .connect()
        .await
        .map_err(|e| io::Error::new(io::ErrorKind::ConnectionRefused, e))?;

    let mut client = CoordinatorServiceClient::new(channel);
    let req = ShutdownRequest {
        graceful: false,
        timeout_seconds: 0,
    };
    let _ = client.shutdown(req).await;
    Ok(())
}

pub async fn stop(
    data_dir: &str,
    port: u16,
    expected_identity: LegacyIdentity,
    escalate: bool,
) -> io::Result<Value> {
    // 1. Pin coordinator process handle FIRST before inspecting
    let pinned = legacy_identity::pin(expected_identity.pid)?;

    // 2. Read facts directly through this pinned handle
    let initial_facts = legacy_identity::facts(&pinned)?;

    // 3. Verify handle facts match expected_identity exactly
    if initial_facts.start_time != expected_identity.start_time
        || !initial_facts.same_user
        || initial_facts.exe.to_string_lossy() != expected_identity.exe
    {
        return Ok(json!({ "status": "changed" }));
    }

    // 4. Verify listener ownership on port and grpcPort through this held handle
    let discovered = legacy_identity::listeners(port)?;
    if !discovered.iter().any(|l| l.addr.is_unspecified() && l.owners.contains(&expected_identity.pid)) {
        return Ok(json!({ "status": "changed" }));
    }
    let grpc_discovered = legacy_identity::listeners(expected_identity.grpc_port)?;
    if !grpc_discovered.iter().any(|l| l.addr.is_unspecified() && l.owners.contains(&expected_identity.pid)) {
        return Ok(json!({ "status": "changed" }));
    }

    // 5. Ensure modern descriptor hasn't appeared
    let descriptor_path = Path::new(data_dir).join("runtime").join("coordinator.json");
    if descriptor_path.exists() {
        return Ok(json!({ "status": "changed" }));
    }

    // 6. Confirm pinned handle is still valid and un-reused
    if !legacy_identity::confirm(&pinned, &initial_facts)? {
        return Ok(json!({ "status": "changed" }));
    }

    // 7. Send unauthenticated gRPC shutdown request
    let _ = send_shutdown_grpc(expected_identity.grpc_port).await;

    // 8. Wait up to 5s for exit
    let mut exited = legacy_identity::wait_exit(&pinned, Duration::from_secs(5))?;
    let mut escalation_used = "none";

    // 9. Escalate if not exited
    if !exited && escalate {
        #[cfg(feature = "proof-legacy-barrier")]
        {
            // Barrier pause for testing
            tokio::time::sleep(Duration::from_millis(500)).await;
        }

        #[cfg(target_os = "linux")]
        {
            // Check through same pidfd
            if legacy_identity::confirm(&pinned, &initial_facts)? {
                let _ = legacy_identity::signal(&pinned, Escalation::Term);
                if legacy_identity::wait_exit(&pinned, Duration::from_secs(3))? {
                    exited = true;
                    escalation_used = "pidfd";
                } else if legacy_identity::confirm(&pinned, &initial_facts)? {
                    let _ = legacy_identity::signal(&pinned, Escalation::Kill);
                    if legacy_identity::wait_exit(&pinned, Duration::from_secs(2))? {
                        exited = true;
                        escalation_used = "pidfd";
                    }
                }
            }
        }

        #[cfg(windows)]
        {
            if legacy_identity::confirm(&pinned, &initial_facts)? {
                let _ = legacy_identity::signal(&pinned, Escalation::Kill);
                if legacy_identity::wait_exit(&pinned, Duration::from_secs(2))? {
                    exited = true;
                    escalation_used = "handle";
                }
            }
        }
    }

    if !exited {
        return Ok(json!({
            "status": "stuck",
            "pid": expected_identity.pid,
            "exe": expected_identity.exe
        }));
    }

    // 6. Clean up records
    let mut retired: Vec<String> = Vec::new();
    let data_path = Path::new(data_dir);
    let pid_path = data_path.join("coordinator.pid");
    let takeover_path = data_path.join("coordinator.pid.takeover");
    let descriptor_path = data_path.join("runtime").join("coordinator.json");

    if pid_path.is_file() && !pid_path.is_symlink() && !takeover_path.exists() && !descriptor_path.exists() {
        if let Ok(content) = fs::read_to_string(&pid_path) {
            if let Ok(stored_pid) = content.trim().parse::<u32>() {
                let should_rename = if stored_pid == expected_identity.pid {
                    true
                } else if legacy_identity::pin(stored_pid).is_err() {
                    true
                } else if let Ok(pinned_sup) = legacy_identity::pin(stored_pid) {
                    if let Ok(facts) = legacy_identity::facts(&pinned_sup) {
                        let exe_name = facts.exe.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                        exe_name == "han" || exe_name == "han.exe" || exe_name == "bun" || exe_name == "node"
                    } else {
                        false
                    }
                } else {
                    false
                };

                if should_rename {
                    let legacy_uuid = Uuid::new_v4();
                    let new_name = format!("coordinator.pid.legacy.{legacy_uuid}");
                    let target_path = data_path.join(&new_name);
                    if fs::rename(&pid_path, target_path).is_ok() {
                        retired.push("coordinator.pid".to_string());
                    }
                }
            }
        }
    }

    if let Some(home) = home_dir() {
        let home_han = home.join(".han");
        let home_lock = home_han.join("coordinator.lock");
        if home_lock.is_file() && !home_lock.is_symlink() {
            if let Ok(content) = fs::read_to_string(&home_lock) {
                if let Ok(parsed) = serde_json::from_str::<Value>(&content) {
                    if parsed.get("pid").and_then(|p| p.as_u64()) == Some(expected_identity.pid as u64) {
                        let _ = fs::remove_file(&home_lock);
                        retired.push("home:.han/coordinator.lock".to_string());
                    }
                }
            }
        }

        let home_pid = home_han.join("coordinator.pid");
        if home_pid.is_file() && !home_pid.is_symlink() {
            if let Ok(content) = fs::read_to_string(&home_pid) {
                if content.trim().parse::<u32>().ok() == Some(expected_identity.pid) {
                    let _ = fs::remove_file(&home_pid);
                    retired.push("home:.han/coordinator.pid".to_string());
                }
            }
        }

        let cert_files = [
            (home_han.join("certs").join("coordinator.pem"), "home:.han/certs/coordinator.pem"),
            (home_han.join("certs").join("coordinator-key.pem"), "home:.han/certs/coordinator-key.pem"),
            (home.join(".claude").join("han").join("certs").join("coordinator.crt"), "home:.claude/han/certs/coordinator.crt"),
            (home.join(".claude").join("han").join("certs").join("coordinator.key"), "home:.claude/han/certs/coordinator.key"),
            (home.join(".claude").join("han").join("certs").join("metadata.json"), "home:.claude/han/certs/metadata.json"),
        ];

        for (path, name) in cert_files {
            if path.is_file() && !path.is_symlink() {
                if let Ok(meta) = path.metadata() {
                    if meta.len() <= 64 * 1024 {
                        let _ = fs::remove_file(&path);
                        retired.push(name.to_string());
                    }
                }
            }
        }
    }

    Ok(json!({
        "status": "stopped",
        "escalation": escalation_used,
        "retired": retired
    }))
}

pub fn retire(data_dir: &str, port: u16) -> io::Result<Value> {
    // 1. If anything listens on port, return listener-present
    let discovered = legacy_identity::listeners(port)?;
    if !discovered.is_empty() {
        return Ok(json!({ "status": "listener-present" }));
    }

    let mut retired: Vec<String> = Vec::new();
    let mut supervisor_pid: Option<u32> = None;
    let data_path = Path::new(data_dir);
    let pid_path = data_path.join("coordinator.pid");
    let takeover_path = data_path.join("coordinator.pid.takeover");
    let descriptor_path = data_path.join("runtime").join("coordinator.json");

    if pid_path.is_file() && !pid_path.is_symlink() && !takeover_path.exists() && !descriptor_path.exists() {
        if let Ok(content) = fs::read_to_string(&pid_path) {
            let trimmed = content.trim();
            if let Ok(pid) = trimmed.parse::<u32>() {
                if pid > 0 && pid <= i32::MAX as u32 {
                    // Check if PID is alive
                    match legacy_identity::pin(pid) {
                        Err(_) => {
                            // Dead PID -> rename aside
                            let legacy_uuid = Uuid::new_v4();
                            let target = data_path.join(format!("coordinator.pid.legacy.{legacy_uuid}"));
                            if fs::rename(&pid_path, target).is_ok() {
                                retired.push("coordinator.pid".to_string());
                            }
                        }
                        Ok(pinned) => {
                            if let Ok(facts) = legacy_identity::facts(&pinned) {
                                let exe_name = facts.exe.file_name().map(|n| n.to_string_lossy().to_string()).unwrap_or_default();
                                let is_han = exe_name == "han" || exe_name == "han.exe" || exe_name == "bun" || exe_name == "node";
                                let args_str: Vec<String> = facts.argv.iter().map(|a| a.to_string_lossy().to_string()).collect();
                                let is_old_supervisor = is_han && args_str.windows(2).any(|w| w[0] == "coordinator" && w[1] == "start");

                                if is_old_supervisor {
                                    let legacy_uuid = Uuid::new_v4();
                                    let target = data_path.join(format!("coordinator.pid.legacy.{legacy_uuid}"));
                                    if fs::rename(&pid_path, target).is_ok() {
                                        retired.push("coordinator.pid".to_string());
                                        supervisor_pid = Some(pid);
                                    }
                                } else if !facts.same_user || !is_han {
                                    // Another user or non-han process -> stale record, rename aside
                                    let legacy_uuid = Uuid::new_v4();
                                    let target = data_path.join(format!("coordinator.pid.legacy.{legacy_uuid}"));
                                    if fs::rename(&pid_path, target).is_ok() {
                                        retired.push("coordinator.pid".to_string());
                                    }
                                } else {
                                    // Live han-coordinator or other -> blocked
                                    return Ok(json!({
                                        "status": "blocked",
                                        "pid": pid,
                                        "exe": facts.exe.to_string_lossy()
                                    }));
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    // Clean up $HOME certificates
    if let Some(home) = home_dir() {
        let home_han = home.join(".han");
        let cert_files = [
            (home_han.join("certs").join("coordinator.pem"), "home:.han/certs/coordinator.pem"),
            (home_han.join("certs").join("coordinator-key.pem"), "home:.han/certs/coordinator-key.pem"),
            (home.join(".claude").join("han").join("certs").join("coordinator.crt"), "home:.claude/han/certs/coordinator.crt"),
            (home.join(".claude").join("han").join("certs").join("coordinator.key"), "home:.claude/han/certs/coordinator.key"),
            (home.join(".claude").join("han").join("certs").join("metadata.json"), "home:.claude/han/certs/metadata.json"),
        ];

        for (path, name) in cert_files {
            if path.is_file() && !path.is_symlink() {
                if let Ok(meta) = path.metadata() {
                    if meta.len() <= 64 * 1024 {
                        let _ = fs::remove_file(&path);
                        retired.push(name.to_string());
                    }
                }
            }
        }
    }

    if let Some(sp) = supervisor_pid {
        Ok(json!({
            "status": "retired",
            "retired": retired,
            "supervisorPid": sp
        }))
    } else {
        Ok(json!({
            "status": "clean",
            "retired": retired
        }))
    }
}
