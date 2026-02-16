//! File-based coordinator lock to prevent multiple instances.
//!
//! Lock file at `~/.han/coordinator.lock` contains JSON with pid, timestamps.
//! A lock is considered stale after 30 seconds without a heartbeat or if the
//! owning process no longer exists.

use serde::{Deserialize, Serialize};
use std::fs;
use std::path::{Path, PathBuf};
use thiserror::Error;

const STALE_TIMEOUT_SECS: i64 = 30;

#[derive(Error, Debug)]
pub enum LockError {
    #[error("Lock held by another process (pid={pid})")]
    AlreadyLocked { pid: u32 },
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("JSON error: {0}")]
    Json(#[from] serde_json::Error),
    #[error("Home directory not found")]
    NoHomeDir,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LockData {
    pub pid: u32,
    pub acquired_at: String,
    pub heartbeat_at: String,
    pub port: Option<u16>,
}

/// Coordinator lock manager.
pub struct CoordinatorLock {
    lock_path: PathBuf,
}

impl CoordinatorLock {
    /// Create a new lock manager using the default path (~/.han/coordinator.lock).
    pub fn new() -> Result<Self, LockError> {
        let home = dirs::home_dir().ok_or(LockError::NoHomeDir)?;
        let lock_path = home.join(".han").join("coordinator.lock");
        Ok(Self { lock_path })
    }

    /// Create a new lock manager with a custom path.
    pub fn with_path(path: PathBuf) -> Self {
        Self { lock_path: path }
    }

    /// Try to acquire the lock. Returns Ok(()) if acquired, Err if held by another process.
    pub fn acquire(&self, port: Option<u16>) -> Result<(), LockError> {
        if let Some(parent) = self.lock_path.parent() {
            fs::create_dir_all(parent)?;
        }

        // Check for existing lock
        if self.lock_path.exists() {
            if let Ok(existing) = self.read_lock() {
                if !self.is_stale(&existing) {
                    return Err(LockError::AlreadyLocked { pid: existing.pid });
                }
                tracing::info!(
                    "Stale lock found (pid={}), removing",
                    existing.pid
                );
            }
            // Remove stale or corrupted lock
            let _ = fs::remove_file(&self.lock_path);
        }

        let now = chrono::Utc::now().to_rfc3339();
        let data = LockData {
            pid: std::process::id(),
            acquired_at: now.clone(),
            heartbeat_at: now,
            port,
        };

        let json = serde_json::to_string_pretty(&data)?;
        fs::write(&self.lock_path, json)?;

        tracing::info!("Lock acquired at {:?}", self.lock_path);
        Ok(())
    }

    /// Update the heartbeat timestamp.
    pub fn heartbeat(&self) -> Result<(), LockError> {
        if let Ok(mut data) = self.read_lock() {
            data.heartbeat_at = chrono::Utc::now().to_rfc3339();
            let json = serde_json::to_string_pretty(&data)?;
            fs::write(&self.lock_path, json)?;
        }
        Ok(())
    }

    /// Release the lock (remove the file).
    pub fn release(&self) -> Result<(), LockError> {
        if self.lock_path.exists() {
            fs::remove_file(&self.lock_path)?;
            tracing::info!("Lock released");
        }
        Ok(())
    }

    /// Check if a lock exists and is held by a running process.
    pub fn is_locked(&self) -> bool {
        if let Ok(data) = self.read_lock() {
            !self.is_stale(&data)
        } else {
            false
        }
    }

    /// Get the current lock data if it exists.
    pub fn read_lock(&self) -> Result<LockData, LockError> {
        let contents = fs::read_to_string(&self.lock_path)?;
        let data: LockData = serde_json::from_str(&contents)?;
        Ok(data)
    }

    /// Get the lock file path.
    pub fn lock_path(&self) -> &Path {
        &self.lock_path
    }

    /// Check if a lock is stale (process dead or heartbeat too old).
    fn is_stale(&self, data: &LockData) -> bool {
        // Check if process still exists
        if !process_exists(data.pid) {
            return true;
        }

        // Check heartbeat age
        if let Ok(heartbeat) = chrono::DateTime::parse_from_rfc3339(&data.heartbeat_at) {
            let age = chrono::Utc::now()
                .signed_duration_since(heartbeat.with_timezone(&chrono::Utc));
            if age.num_seconds() > STALE_TIMEOUT_SECS {
                return true;
            }
        } else {
            // Can't parse heartbeat, consider stale
            return true;
        }

        false
    }
}

impl Drop for CoordinatorLock {
    fn drop(&mut self) {
        let _ = self.release();
    }
}

/// Check if a process with the given PID exists.
fn process_exists(pid: u32) -> bool {
    use nix::sys::signal;
    use nix::unistd::Pid;

    // kill(pid, 0) checks process existence without sending a signal
    signal::kill(Pid::from_raw(pid as i32), None).is_ok()
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn test_lock(dir: &TempDir) -> CoordinatorLock {
        CoordinatorLock::with_path(dir.path().join("test.lock"))
    }

    #[test]
    fn test_acquire_and_release() {
        let dir = TempDir::new().unwrap();
        let lock = test_lock(&dir);

        lock.acquire(Some(41956)).unwrap();
        assert!(lock.is_locked());

        let data = lock.read_lock().unwrap();
        assert_eq!(data.pid, std::process::id());
        assert_eq!(data.port, Some(41956));

        lock.release().unwrap();
        assert!(!lock.is_locked());
    }

    #[test]
    fn test_double_acquire_fails() {
        let dir = TempDir::new().unwrap();
        let lock = test_lock(&dir);

        lock.acquire(None).unwrap();

        // Second acquire should fail since our process owns it
        let result = lock.acquire(None);
        assert!(result.is_err());
        assert!(matches!(result.unwrap_err(), LockError::AlreadyLocked { .. }));

        lock.release().unwrap();
    }

    #[test]
    fn test_stale_lock_removed() {
        let dir = TempDir::new().unwrap();
        let lock = test_lock(&dir);

        // Write a lock with a non-existent PID
        let stale_data = LockData {
            pid: 99999999,
            acquired_at: chrono::Utc::now().to_rfc3339(),
            heartbeat_at: chrono::Utc::now().to_rfc3339(),
            port: None,
        };
        let json = serde_json::to_string_pretty(&stale_data).unwrap();
        fs::write(lock.lock_path(), json).unwrap();

        // Should be able to acquire since the PID doesn't exist
        lock.acquire(None).unwrap();
        assert!(lock.is_locked());
        lock.release().unwrap();
    }

    #[test]
    fn test_heartbeat() {
        let dir = TempDir::new().unwrap();
        let lock = test_lock(&dir);

        lock.acquire(None).unwrap();

        let before = lock.read_lock().unwrap().heartbeat_at;
        std::thread::sleep(std::time::Duration::from_millis(10));
        lock.heartbeat().unwrap();
        let after = lock.read_lock().unwrap().heartbeat_at;

        assert_ne!(before, after);
        lock.release().unwrap();
    }

    #[test]
    fn test_corrupted_lock_overwritten() {
        let dir = TempDir::new().unwrap();
        let lock = test_lock(&dir);

        // Write garbage to lock file
        fs::write(lock.lock_path(), "not json").unwrap();

        // Should acquire despite corruption
        lock.acquire(None).unwrap();
        assert!(lock.is_locked());
        lock.release().unwrap();
    }

    #[test]
    fn test_process_exists_current() {
        assert!(process_exists(std::process::id()));
    }

    #[test]
    fn test_process_exists_nonexistent() {
        assert!(!process_exists(99999999));
    }
}
