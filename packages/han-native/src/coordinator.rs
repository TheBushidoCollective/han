//! Coordinator module for single-instance session indexing
//!
//! This module implements a coordinator pattern where only one Han process
//! owns the lock and becomes the indexer of all Claude Code sessions.
//! Other processes can still write their own data (metrics, observations, etc.)
//! but only the coordinator indexes session data from JSONL files.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use std::fs::{self, File, OpenOptions};
use std::io::{Read, Write};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::{Duration, SystemTime, UNIX_EPOCH};

/// Lock file contents
#[napi(object)]
#[derive(Debug, Clone)]
pub struct LockInfo {
    /// Process ID holding the lock
    pub pid: i64,
    /// Timestamp when lock was acquired (Unix epoch seconds)
    pub acquired_at: i64,
    /// Last heartbeat timestamp (Unix epoch seconds)
    pub heartbeat_at: i64,
    /// Whether this process is the coordinator
    pub is_coordinator: bool,
}

/// Coordinator status
#[napi(object)]
#[derive(Debug, Clone)]
pub struct CoordinatorStatus {
    /// Whether this process is the active coordinator
    pub is_coordinator: bool,
    /// Whether a coordinator is running (possibly another process)
    pub coordinator_running: bool,
    /// Lock info if available
    pub lock_info: Option<LockInfo>,
}

/// Lock file path (~/.han/coordinator.lock)
/// Uses same resolution as get_han_data_dir in db.rs
fn get_lock_path() -> PathBuf {
    // Explicit override
    if let Ok(dir) = std::env::var("HAN_DATA_DIR") {
        return PathBuf::from(dir).join("coordinator.lock");
    }

    // Legacy override for testing
    if let Ok(dir) = std::env::var("CLAUDE_CONFIG_DIR") {
        return PathBuf::from(dir).join("han").join("coordinator.lock");
    }

    let home = dirs::home_dir().unwrap_or_else(|| PathBuf::from("."));
    let new_dir = home.join(".han");
    let old_dir = home.join(".claude").join("han");

    if new_dir.exists() {
        return new_dir.join("coordinator.lock");
    }
    if old_dir.exists() {
        return old_dir.join("coordinator.lock");
    }
    new_dir.join("coordinator.lock")
}

/// Lock file stale timeout (seconds)
const LOCK_STALE_TIMEOUT: u64 = 30;

/// Heartbeat interval (seconds)
const HEARTBEAT_INTERVAL: u64 = 10;

/// Read lock file contents
fn read_lock_file(path: &PathBuf) -> Option<LockInfo> {
    if !path.exists() {
        return None;
    }

    let mut file = File::open(path).ok()?;
    let mut contents = String::new();
    file.read_to_string(&mut contents).ok()?;

    // Parse JSON
    let value: serde_json::Value = serde_json::from_str(&contents).ok()?;
    Some(LockInfo {
        pid: value.get("pid")?.as_i64()?,
        acquired_at: value.get("acquired_at")?.as_i64()?,
        heartbeat_at: value.get("heartbeat_at")?.as_i64()?,
        is_coordinator: value.get("is_coordinator")?.as_bool()?,
    })
}

/// Write lock file contents
fn write_lock_file(path: &PathBuf, info: &LockInfo) -> std::io::Result<()> {
    // Ensure parent directory exists
    if let Some(parent) = path.parent() {
        fs::create_dir_all(parent)?;
    }

    let json = serde_json::json!({
        "pid": info.pid,
        "acquired_at": info.acquired_at,
        "heartbeat_at": info.heartbeat_at,
        "is_coordinator": info.is_coordinator,
    });

    let mut file = OpenOptions::new()
        .write(true)
        .create(true)
        .truncate(true)
        .open(path)?;
    file.write_all(json.to_string().as_bytes())?;
    file.sync_all()?;
    Ok(())
}

/// Get current timestamp in seconds
fn now_secs() -> i64 {
    SystemTime::now()
        .duration_since(UNIX_EPOCH)
        .unwrap_or(Duration::ZERO)
        .as_secs() as i64
}

/// Check if a process is still running
#[cfg(unix)]
fn process_exists(pid: i64) -> bool {
    // On Unix, we can use kill with signal 0 to check if process exists
    unsafe { libc::kill(pid as i32, 0) == 0 }
}

#[cfg(windows)]
fn process_exists(pid: i64) -> bool {
    use std::ptr::null_mut;
    unsafe {
        let handle = winapi::um::processthreadsapi::OpenProcess(
            winapi::um::winnt::PROCESS_QUERY_LIMITED_INFORMATION,
            0,
            pid as u32,
        );
        if handle.is_null() {
            false
        } else {
            winapi::um::handleapi::CloseHandle(handle);
            true
        }
    }
}

#[cfg(not(any(unix, windows)))]
fn process_exists(_pid: i64) -> bool {
    // Fallback: assume process exists
    true
}

/// Check if lock is stale (process dead or heartbeat too old)
fn is_lock_stale(info: &LockInfo) -> bool {
    // Check if process still exists first (immediate staleness detection)
    if !process_exists(info.pid) {
        return true;
    }

    // Process exists, check if heartbeat is too old
    let current_time = now_secs();
    let heartbeat_age = current_time - info.heartbeat_at;
    heartbeat_age > LOCK_STALE_TIMEOUT as i64
}

/// Global coordinator state
static COORDINATOR_RUNNING: std::sync::OnceLock<Arc<AtomicBool>> = std::sync::OnceLock::new();

fn get_coordinator_flag() -> &'static Arc<AtomicBool> {
    COORDINATOR_RUNNING.get_or_init(|| Arc::new(AtomicBool::new(false)))
}

/// Try to acquire the coordinator lock
/// Returns true if this process became the coordinator
pub fn try_acquire_coordinator_lock() -> Result<bool> {
    let lock_path = get_lock_path();
    let current_pid = std::process::id() as i64;

    // Check existing lock
    if let Some(info) = read_lock_file(&lock_path) {
        // Already holding the lock
        if info.pid == current_pid && info.is_coordinator {
            return Ok(true);
        }

        // Check if lock is stale
        if !is_lock_stale(&info) {
            // Another process holds the lock
            return Ok(false);
        }

        // Lock is stale, we can take over
        tracing::info!("Taking over stale coordinator lock from PID {}", info.pid);
    }

    // Acquire the lock
    let now = now_secs();
    let lock_info = LockInfo {
        pid: current_pid,
        acquired_at: now,
        heartbeat_at: now,
        is_coordinator: true,
    };

    write_lock_file(&lock_path, &lock_info)
        .map_err(|e| napi::Error::from_reason(format!("Failed to write lock file: {}", e)))?;

    get_coordinator_flag().store(true, Ordering::SeqCst);
    tracing::info!("Acquired coordinator lock (PID: {})", current_pid);
    Ok(true)
}

/// Release the coordinator lock
pub fn release_coordinator_lock() -> Result<bool> {
    let lock_path = get_lock_path();
    let current_pid = std::process::id() as i64;

    // Check if we hold the lock
    if let Some(info) = read_lock_file(&lock_path) {
        if info.pid == current_pid {
            // Remove the lock file
            fs::remove_file(&lock_path).map_err(|e| {
                napi::Error::from_reason(format!("Failed to remove lock file: {}", e))
            })?;

            get_coordinator_flag().store(false, Ordering::SeqCst);
            tracing::info!("Released coordinator lock (PID: {})", current_pid);
            return Ok(true);
        }
    }

    Ok(false) // We didn't hold the lock
}

/// Update heartbeat timestamp (call periodically while coordinating)
pub fn update_coordinator_heartbeat() -> Result<bool> {
    let lock_path = get_lock_path();
    let current_pid = std::process::id() as i64;

    // Check if we hold the lock
    if let Some(mut info) = read_lock_file(&lock_path) {
        if info.pid == current_pid {
            info.heartbeat_at = now_secs();
            write_lock_file(&lock_path, &info).map_err(|e| {
                napi::Error::from_reason(format!("Failed to update heartbeat: {}", e))
            })?;
            return Ok(true);
        }
    }

    Ok(false) // We don't hold the lock
}

/// Get current coordinator status
pub fn get_coordinator_status() -> Result<CoordinatorStatus> {
    let lock_path = get_lock_path();
    let current_pid = std::process::id() as i64;

    if let Some(info) = read_lock_file(&lock_path) {
        let is_stale = is_lock_stale(&info);
        let is_us = info.pid == current_pid;

        Ok(CoordinatorStatus {
            is_coordinator: is_us && info.is_coordinator,
            coordinator_running: !is_stale,
            lock_info: if !is_stale { Some(info) } else { None },
        })
    } else {
        Ok(CoordinatorStatus {
            is_coordinator: false,
            coordinator_running: false,
            lock_info: None,
        })
    }
}

/// Check if this process is the coordinator
pub fn is_coordinator() -> bool {
    get_coordinator_flag().load(Ordering::SeqCst)
}

/// Get the heartbeat interval in seconds
pub fn get_heartbeat_interval() -> u32 {
    HEARTBEAT_INTERVAL as u32
}

/// Get the stale lock timeout in seconds
pub fn get_stale_lock_timeout() -> u32 {
    LOCK_STALE_TIMEOUT as u32
}

/// Clean up a stale coordinator lock file
/// Returns true if a stale lock was cleaned up, false otherwise
pub fn cleanup_stale_coordinator_lock() -> Result<bool> {
    let lock_path = get_lock_path();

    // Read existing lock file
    if let Some(info) = read_lock_file(&lock_path) {
        // Check if lock is stale (process dead OR heartbeat too old)
        if is_lock_stale(&info) {
            // Remove the stale lock file
            match std::fs::remove_file(&lock_path) {
                Ok(()) => {
                    tracing::info!(
                        "Cleaned up stale coordinator lock from PID {} (heartbeat age: {}s)",
                        info.pid,
                        now_secs() - info.heartbeat_at
                    );
                    return Ok(true);
                }
                Err(e) => {
                    tracing::warn!("Failed to remove stale lock file: {}", e);
                    return Err(napi::Error::from_reason(format!(
                        "Failed to remove stale lock file: {}",
                        e
                    )));
                }
            }
        }
    }

    Ok(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs;

    fn setup_test_lock_dir() -> PathBuf {
        let test_dir = env::temp_dir().join(format!("han-test-{}", std::process::id()));
        fs::create_dir_all(&test_dir).unwrap();
        test_dir
    }

    #[test]
    fn test_lock_info_roundtrip() {
        let test_dir = setup_test_lock_dir();
        let lock_path = test_dir.join("coordinator.lock");

        let info = LockInfo {
            pid: 12345,
            acquired_at: 1700000000,
            heartbeat_at: 1700000010,
            is_coordinator: true,
        };

        write_lock_file(&lock_path, &info).unwrap();
        let read_info = read_lock_file(&lock_path).unwrap();

        assert_eq!(read_info.pid, 12345);
        assert_eq!(read_info.acquired_at, 1700000000);
        assert_eq!(read_info.heartbeat_at, 1700000010);
        assert!(read_info.is_coordinator);

        // Cleanup
        fs::remove_dir_all(test_dir).ok();
    }
}
