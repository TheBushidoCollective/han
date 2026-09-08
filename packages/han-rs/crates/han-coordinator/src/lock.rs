//! File-based coordinator lock to prevent multiple instances.
//!
//! Lock file at `~/.han/coordinator.lock` contains JSON with pid, timestamps.
//! The lock is machine-global: it guards one live coordinator per machine,
//! not one per port. A lock is considered stale after 30 seconds without a
//! heartbeat or if the owning process no longer exists.
//!
//! Both writers publish atomically, never in place. Acquisition writes the
//! full contents to a private temp file first, then publishes it under the
//! real lock path with `hard_link`, which fails atomically if the path
//! already exists. The heartbeat refresh does the same via a temp file plus
//! `fs::rename`, which atomically replaces the directory entry on the same
//! filesystem. Either way, the lock path's directory entry always points at
//! a fully-written inode: a racing reader can never observe a lock file
//! that exists but is only partially written, and a racing `acquire` can
//! never mistake an in-flight heartbeat write for corruption and delete a
//! live incumbent's lock (an in-place `fs::write` truncate-then-write would
//! reopen exactly that window).
//!
//! Takeover of a stale or corrupted lock is serialized via an exclusive
//! marker file (`coordinator.lock.takeover`). Only the single caller that
//! wins the marker race may remove the stale lock and retry publishing.
//! All other callers back off, clean up the marker if it was abandoned
//! (e.g. if the marker holder died), and retry. This prevents the blind
//! delete race where multiple racing processes could otherwise remove each
//! other's newly-published locks and both claim to hold the lock.
//!
//! `release` and `heartbeat` are owner-checked: both read the lock file
//! first and act only when it still names our own pid, so a process can
//! never delete or refresh a lock it does not own.

use serde::{Deserialize, Serialize};
use std::fs;
use std::io::ErrorKind;
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicU64, Ordering};
use thiserror::Error;

const STALE_TIMEOUT_SECS: i64 = 30;

/// How long a takeover marker remains valid before another caller considers
/// it abandoned (e.g. if the taking-over process crashed).
const TAKEOVER_TIMEOUT_SECS: i64 = 5;

/// Bound on retries when taking over a lock that looks stale.
const MAX_ACQUIRE_ATTEMPTS: u32 = 6;
/// Disambiguates temp file names across concurrent `acquire` calls within
/// the same process (distinct processes are already disambiguated by pid).
static TMP_COUNTER: AtomicU64 = AtomicU64::new(0);

#[derive(Error, Debug)]
pub enum LockError {
    #[error("coordinator already running (pid={pid}, port={port:?})")]
    AlreadyLocked { pid: u32, port: Option<u16> },
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

#[derive(Debug, Clone, Serialize, Deserialize)]
struct TakeoverData {
    pub pid: u32,
    pub created_at: String,
}

/// RAII guard that holds the exclusive takeover marker file. When dropped,
/// it deletes the marker file if and only if it still belongs to our own pid.
struct TakeoverGuard<'a> {
    lock: &'a CoordinatorLock,
    active: bool,
}

impl<'a> TakeoverGuard<'a> {
    fn new(lock: &'a CoordinatorLock) -> Self {
        Self { lock, active: true }
    }
}

impl<'a> Drop for TakeoverGuard<'a> {
    fn drop(&mut self) {
        if self.active {
            if let Ok(contents) = fs::read_to_string(self.lock.takeover_path()) {
                if let Ok(data) = serde_json::from_str::<TakeoverData>(&contents) {
                    if data.pid != std::process::id() {
                        return;
                    }
                }
            }
            let _ = fs::remove_file(self.lock.takeover_path());
        }
    }
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

    /// Build a private temp file path alongside the lock file, unique per
    /// process and per call so concurrent attempts (including from multiple
    /// threads in this same process) never collide with each other.
    fn unique_tmp_path(&self) -> PathBuf {
        let file_name = self
            .lock_path
            .file_name()
            .map(|n| n.to_os_string())
            .unwrap_or_else(|| std::ffi::OsString::from("coordinator.lock"));
        let counter = TMP_COUNTER.fetch_add(1, Ordering::Relaxed);
        let mut tmp_name = file_name;
        tmp_name.push(format!(".tmp.{}.{}", std::process::id(), counter));
        self.lock_path.with_file_name(tmp_name)
    }

    /// Try to acquire the lock. Returns Ok(()) if acquired, Err::AlreadyLocked
    /// if another live process already holds it.
    ///
    /// The lock content is written to a private temp file, then published at
    /// the real path with `hard_link`. The link either succeeds (a brand new
    /// directory entry that already points at a fully-written inode) or
    /// fails with `AlreadyExists`; there is no window in between where two
    /// processes can both believe they hold the lock, and no window where a
    /// concurrent reader can see a lock file that exists but isn't fully
    /// written yet.
    ///
    /// When a lock is found to be stale or corrupted, takeover is serialized
    /// via an exclusive `takeover` marker so racing claimants never blindly
    /// delete each other's fresh locks.
    pub fn acquire(&self, port: Option<u16>) -> Result<(), LockError> {
        if let Some(parent) = self.lock_path.parent() {
            fs::create_dir_all(parent)?;
        }

        let mut last_seen: Option<LockData> = None;

        for _ in 0..MAX_ACQUIRE_ATTEMPTS {
            let now = chrono::Utc::now().to_rfc3339();
            let data = LockData {
                pid: std::process::id(),
                acquired_at: now.clone(),
                heartbeat_at: now,
                port,
            };
            let json = serde_json::to_string_pretty(&data)?;

            let tmp_path = self.unique_tmp_path();
            fs::write(&tmp_path, json.as_bytes())?;
            let link_result = fs::hard_link(&tmp_path, &self.lock_path);
            let _ = fs::remove_file(&tmp_path);

            match link_result {
                Ok(()) => {
                    tracing::info!("Lock acquired at {:?}", self.lock_path);
                    return Ok(());
                }
                Err(e) if e.kind() == ErrorKind::AlreadyExists => {
                    match self.read_lock() {
                        Ok(existing) => {
                            if !self.is_stale(&existing) {
                                return Err(LockError::AlreadyLocked {
                                    pid: existing.pid,
                                    port: existing.port,
                                });
                            }
                            last_seen = Some(existing);
                        }
                        Err(_) => {
                            last_seen = None;
                        }
                    }

                    // Stale or corrupted lock found. Serialize the takeover via
                    // an exclusive takeover marker so two racing processes
                    // cannot both remove the file and both claim to hold it.
                    match self.try_claim_takeover() {
                        Ok(Some(guard)) => {
                            // Re-check: did someone publish a fresh lock while we were
                            // claiming the takeover marker?
                            if let Ok(current) = self.read_lock() {
                                if !self.is_stale(&current) {
                                    drop(guard);
                                    return Err(LockError::AlreadyLocked {
                                        pid: current.pid,
                                        port: current.port,
                                    });
                                }
                                last_seen = Some(current);
                            }

                            tracing::info!("Removing stale lock under takeover marker");
                            let _ = fs::remove_file(&self.lock_path);

                            // Attempt to publish our lock while holding the marker
                            let tmp_path = self.unique_tmp_path();
                            fs::write(&tmp_path, json.as_bytes())?;
                            let publish_result = fs::hard_link(&tmp_path, &self.lock_path);
                            let _ = fs::remove_file(&tmp_path);

                            drop(guard);

                            match publish_result {
                                Ok(()) => {
                                    tracing::info!(
                                        "Lock acquired via takeover at {:?}",
                                        self.lock_path
                                    );
                                    return Ok(());
                                }
                                Err(e) if e.kind() == ErrorKind::AlreadyExists => {
                                    if let Ok(current) = self.read_lock() {
                                        if !self.is_stale(&current) {
                                            return Err(LockError::AlreadyLocked {
                                                pid: current.pid,
                                                port: current.port,
                                            });
                                        }
                                        last_seen = Some(current);
                                    }
                                }
                                Err(e) => return Err(e.into()),
                            }
                        }
                        Ok(None) => {
                            // Another process is currently executing the takeover.
                            if self.is_takeover_abandoned() {
                                tracing::info!("Clearing abandoned takeover marker");
                                let _ = fs::remove_file(self.takeover_path());
                            }
                            std::thread::sleep(std::time::Duration::from_millis(20));
                        }
                        Err(e) => return Err(e.into()),
                    }
                }
                Err(e) => return Err(e.into()),
            }
        }

        // Ran out of takeover attempts. Report what we last observed.
        let (pid, port) = last_seen.map(|d| (d.pid, d.port)).unwrap_or((0, None));
        Err(LockError::AlreadyLocked { pid, port })
    }

    /// Path to the exclusive takeover marker file beside the lock file.
    fn takeover_path(&self) -> PathBuf {
        let name = self
            .lock_path
            .file_name()
            .map(|n| n.to_string_lossy().into_owned())
            .unwrap_or_else(|| "coordinator.lock".to_string());
        self.lock_path.with_file_name(format!("{name}.takeover"))
    }

    /// Try to claim the exclusive takeover marker. Returns `Ok(Some(guard))` if
    /// claimed, `Ok(None)` if another caller already holds it.
    fn try_claim_takeover(&self) -> Result<Option<TakeoverGuard<'_>>, LockError> {
        let data = TakeoverData {
            pid: std::process::id(),
            created_at: chrono::Utc::now().to_rfc3339(),
        };
        let json = serde_json::to_string_pretty(&data)?;

        let tmp_path = self.unique_tmp_path();
        fs::write(&tmp_path, json.as_bytes())?;
        let link_result = fs::hard_link(&tmp_path, self.takeover_path());
        let _ = fs::remove_file(&tmp_path);

        match link_result {
            Ok(()) => Ok(Some(TakeoverGuard::new(self))),
            Err(e) if e.kind() == ErrorKind::AlreadyExists => Ok(None),
            Err(e) => Err(e.into()),
        }
    }

    /// Check if an existing takeover marker was abandoned by its creator
    /// (creator process is dead, or the marker is older than TAKEOVER_TIMEOUT_SECS).
    fn is_takeover_abandoned(&self) -> bool {
        let takeover_path = self.takeover_path();
        if let Ok(contents) = fs::read_to_string(&takeover_path) {
            if let Ok(data) = serde_json::from_str::<TakeoverData>(&contents) {
                if !process_exists(data.pid) {
                    return true;
                }
                if let Ok(created) = chrono::DateTime::parse_from_rfc3339(&data.created_at) {
                    let age = chrono::Utc::now()
                        .signed_duration_since(created.with_timezone(&chrono::Utc));
                    if age.num_seconds() > TAKEOVER_TIMEOUT_SECS {
                        return true;
                    }
                } else {
                    return true;
                }
                return false;
            }
        }
        if let Ok(meta) = fs::metadata(&takeover_path) {
            if let Ok(modified) = meta.modified() {
                if let Ok(age) = modified.elapsed() {
                    if age.as_secs() > TAKEOVER_TIMEOUT_SECS as u64 {
                        return true;
                    }
                }
            }
        }
        false
    }

    /// Refresh the heartbeat timestamp if, and only if, we still own the
    /// lock. Returns `Ok(true)` when the heartbeat was refreshed, `Ok(false)`
    /// when the lock is missing, corrupted, or owned by another process (in
    /// which case nothing was written). Never writes to a lock file that
    /// names a different pid.
    ///
    /// Publishes atomically via a temp file plus `fs::rename`, not an
    /// in-place `fs::write`. An in-place write truncates before it writes,
    /// so a concurrent `acquire` racing a stale takeover could `read_lock`
    /// mid-truncate, see empty or partial JSON, treat it as corruption, and
    /// delete a lock we still legitimately hold. `rename` replaces the
    /// directory entry atomically, so the path is always either the old,
    /// complete content or the new, complete content.
    pub fn heartbeat(&self) -> Result<bool, LockError> {
        let mut data = match self.read_lock() {
            Ok(data) if data.pid == std::process::id() => data,
            _ => return Ok(false),
        };
        data.heartbeat_at = chrono::Utc::now().to_rfc3339();
        let json = serde_json::to_string_pretty(&data)?;

        let tmp_path = self.unique_tmp_path();
        fs::write(&tmp_path, json.as_bytes())?;
        let rename_result = fs::rename(&tmp_path, &self.lock_path);
        if rename_result.is_err() {
            let _ = fs::remove_file(&tmp_path);
        }
        rename_result?;
        Ok(true)
    }

    /// Release the lock, but only if we own it. Reads the lock file first
    /// and removes it only when its pid equals our own; otherwise this is a
    /// silent no-op, so a losing racer (or a stale `Drop`) can never delete
    /// a live incumbent's lock.
    pub fn release(&self) -> Result<(), LockError> {
        match self.read_lock() {
            Ok(data) if data.pid == std::process::id() => {
                fs::remove_file(&self.lock_path)?;
                tracing::info!("Lock released");
                Ok(())
            }
            Ok(data) => {
                tracing::debug!(
                    "Not releasing lock owned by pid={} (we are pid={})",
                    data.pid,
                    std::process::id()
                );
                Ok(())
            }
            Err(_) => Ok(()),
        }
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
            let age =
                chrono::Utc::now().signed_duration_since(heartbeat.with_timezone(&chrono::Utc));
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
#[cfg(unix)]
fn process_exists(pid: u32) -> bool {
    use nix::sys::signal;
    use nix::unistd::Pid;

    // kill(pid, 0) checks process existence without sending a signal
    signal::kill(Pid::from_raw(pid as i32), None).is_ok()
}

#[cfg(windows)]
fn process_exists(pid: u32) -> bool {
    use std::process::Command;
    Command::new("tasklist")
        .args(["/FI", &format!("PID eq {pid}"), "/NH"])
        .output()
        .map(|o| String::from_utf8_lossy(&o.stdout).contains(&pid.to_string()))
        .unwrap_or(false)
}

#[cfg(test)]
mod tests {
    use super::*;
    use tempfile::TempDir;

    fn test_lock(dir: &TempDir) -> CoordinatorLock {
        CoordinatorLock::with_path(dir.path().join("test.lock"))
    }

    /// Spawns a short-lived child process so tests can write a lock file that
    /// names a real, live pid other than our own.
    fn spawn_other_process() -> std::process::Child {
        std::process::Command::new("sleep")
            .arg("5")
            .spawn()
            .expect("failed to spawn helper process")
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
        assert!(matches!(
            result.unwrap_err(),
            LockError::AlreadyLocked { .. }
        ));

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
    fn test_stale_heartbeat_takeover() {
        let dir = TempDir::new().unwrap();
        let lock = test_lock(&dir);

        // Live pid (ours), but the heartbeat is well past the staleness
        // window, so this must still be taken over.
        let old = chrono::Utc::now() - chrono::Duration::seconds(STALE_TIMEOUT_SECS + 5);
        let stale_data = LockData {
            pid: std::process::id(),
            acquired_at: old.to_rfc3339(),
            heartbeat_at: old.to_rfc3339(),
            port: Some(41957),
        };
        let json = serde_json::to_string_pretty(&stale_data).unwrap();
        fs::write(lock.lock_path(), json).unwrap();

        lock.acquire(Some(41958)).unwrap();
        assert!(lock.is_locked());
        let data = lock.read_lock().unwrap();
        assert_eq!(data.port, Some(41958));

        lock.release().unwrap();
    }

    #[test]
    fn test_heartbeat() {
        let dir = TempDir::new().unwrap();
        let lock = test_lock(&dir);

        lock.acquire(None).unwrap();

        let before = lock.read_lock().unwrap().heartbeat_at;
        std::thread::sleep(std::time::Duration::from_millis(10));
        assert!(lock.heartbeat().unwrap());
        let after = lock.read_lock().unwrap().heartbeat_at;

        assert_ne!(before, after);
        lock.release().unwrap();
    }

    #[test]
    fn test_concurrent_heartbeat_never_visible_as_torn() {
        use std::sync::atomic::AtomicBool;
        use std::sync::Arc;

        let dir = TempDir::new().unwrap();
        let lock = test_lock(&dir);
        lock.acquire(None).unwrap();

        let lock_path = lock.lock_path().to_path_buf();
        let stop = Arc::new(AtomicBool::new(false));
        let stop_writer = stop.clone();
        let writer_path = lock_path.clone();

        // Hammer the heartbeat in one thread while another thread reads the
        // same file hundreds of times. An in-place fs::write truncates
        // before writing, so a reader lands in that window often enough to
        // observe empty or partial JSON within a few hundred iterations; an
        // atomic temp-file-plus-rename publish never has that window.
        let writer = std::thread::spawn(move || {
            let heartbeat_lock = CoordinatorLock::with_path(writer_path);
            while !stop_writer.load(Ordering::Relaxed) {
                heartbeat_lock.heartbeat().unwrap();
            }
        });

        let reader = CoordinatorLock::with_path(lock_path);
        for _ in 0..500 {
            let data = reader
                .read_lock()
                .expect("read must never observe a torn heartbeat write");
            assert_eq!(data.pid, std::process::id());
        }

        stop.store(true, Ordering::Relaxed);
        writer.join().unwrap();

        lock.release().unwrap();
    }

    #[test]
    fn test_heartbeat_by_non_owner_is_refused() {
        let dir = TempDir::new().unwrap();
        let lock = test_lock(&dir);
        let mut other = spawn_other_process();
        let other_pid = other.id();

        let original_heartbeat = chrono::Utc::now().to_rfc3339();
        let data = LockData {
            pid: other_pid,
            acquired_at: original_heartbeat.clone(),
            heartbeat_at: original_heartbeat.clone(),
            port: Some(41957),
        };
        fs::write(
            lock.lock_path(),
            serde_json::to_string_pretty(&data).unwrap(),
        )
        .unwrap();

        std::thread::sleep(std::time::Duration::from_millis(10));
        let refreshed = lock.heartbeat().unwrap();
        assert!(
            !refreshed,
            "heartbeat must refuse to refresh a lock we do not own"
        );

        let still = lock.read_lock().unwrap();
        assert_eq!(still.pid, other_pid);
        assert_eq!(still.heartbeat_at, original_heartbeat);

        let _ = other.kill();
        let _ = other.wait();
        // This lock never belonged to us; strip it manually so Drop doesn't
        // try (and correctly fail) to remove someone else's file.
        let _ = fs::remove_file(lock.lock_path());
    }

    #[test]
    fn test_release_by_non_owner_is_noop() {
        let dir = TempDir::new().unwrap();
        let lock = test_lock(&dir);
        let mut other = spawn_other_process();
        let other_pid = other.id();

        let data = LockData {
            pid: other_pid,
            acquired_at: chrono::Utc::now().to_rfc3339(),
            heartbeat_at: chrono::Utc::now().to_rfc3339(),
            port: Some(41957),
        };
        fs::write(
            lock.lock_path(),
            serde_json::to_string_pretty(&data).unwrap(),
        )
        .unwrap();

        lock.release().unwrap();

        assert!(
            lock.lock_path().exists(),
            "release must not remove a lock we do not own"
        );
        let still = lock.read_lock().unwrap();
        assert_eq!(still.pid, other_pid);

        let _ = other.kill();
        let _ = other.wait();
        let _ = fs::remove_file(lock.lock_path());
    }

    #[test]
    fn test_concurrent_acquire_only_one_winner() {
        let dir = TempDir::new().unwrap();
        let path = dir.path().join("test.lock");

        // All threads run in this one test process, so every lock instance
        // shares the same pid: release()/Drop is a no-op only for a *foreign*
        // pid, not a foreign lock *instance*. Keep every CoordinatorLock
        // alive (never let one Drop) until after the assertions below, so no
        // thread can release the file mid-race and let a second thread win.
        let handles: Vec<_> = (0..8)
            .map(|_| {
                let lock_path = path.clone();
                std::thread::spawn(move || {
                    let lock = CoordinatorLock::with_path(lock_path);
                    let result = lock.acquire(Some(41957));
                    (result, lock)
                })
            })
            .collect();

        let mut ok_count = 0;
        let mut locked_count = 0;
        let mut guards = Vec::new();
        for handle in handles {
            let (result, lock) = handle.join().expect("thread panicked");
            match result {
                Ok(()) => ok_count += 1,
                Err(LockError::AlreadyLocked { .. }) => locked_count += 1,
                Err(e) => panic!("unexpected error racing acquire: {e}"),
            }
            guards.push(lock);
        }

        assert_eq!(ok_count, 1, "exactly one thread should acquire the lock");
        assert_eq!(locked_count, 7);
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

    #[test]
    #[ignore]
    fn takeover_worker() {
        let lock_path = match std::env::var("HAN_TEST_TAKEOVER_CHILD_LOCK") {
            Ok(p) => PathBuf::from(p),
            Err(_) => return,
        };
        let ready_path = PathBuf::from(std::env::var("HAN_TEST_TAKEOVER_READY").unwrap());
        let start_path = PathBuf::from(std::env::var("HAN_TEST_TAKEOVER_START").unwrap());
        let result_path = PathBuf::from(std::env::var("HAN_TEST_TAKEOVER_RESULT").unwrap());

        let lock = CoordinatorLock::with_path(lock_path);

        // Signal readiness
        fs::write(&ready_path, "ready").unwrap();

        // Spin until start file appears
        while !start_path.exists() {
            std::hint::spin_loop();
        }

        match lock.acquire(Some(41957)) {
            Ok(()) => {
                fs::write(&result_path, "WON").unwrap();
                // Hold the lock until killed by parent
                std::thread::sleep(std::time::Duration::from_secs(10));
            }
            Err(LockError::AlreadyLocked { .. }) => {
                fs::write(&result_path, "BLOCKED").unwrap();
            }
            Err(e) => {
                fs::write(&result_path, format!("ERR:{e}")).unwrap();
            }
        }
    }

    #[test]
    fn test_concurrent_stale_takeover_cross_process() {
        use std::process::{Command, Stdio};

        let dir = TempDir::new().unwrap();
        let lock_path = dir.path().join("test.lock");

        // Seed with a dead pid so every racer sees it stale immediately
        let stale_data = LockData {
            pid: 99999999,
            acquired_at: chrono::Utc::now().to_rfc3339(),
            heartbeat_at: chrono::Utc::now().to_rfc3339(),
            port: Some(41957),
        };
        fs::write(
            &lock_path,
            serde_json::to_string_pretty(&stale_data).unwrap(),
        )
        .unwrap();

        let start_file = dir.path().join("start");
        let n = 8;
        let mut children = Vec::new();

        let exe = std::env::current_exe().expect("could not determine test binary");

        for i in 0..n {
            let ready_file = dir.path().join(format!("ready_{i}"));
            let result_file = dir.path().join(format!("result_{i}"));
            let child = Command::new(&exe)
                .arg("lock::tests::takeover_worker")
                .arg("--exact")
                .arg("--ignored")
                .env("HAN_TEST_TAKEOVER_CHILD_LOCK", lock_path.to_str().unwrap())
                .env("HAN_TEST_TAKEOVER_READY", ready_file.to_str().unwrap())
                .env("HAN_TEST_TAKEOVER_START", start_file.to_str().unwrap())
                .env("HAN_TEST_TAKEOVER_RESULT", result_file.to_str().unwrap())
                .stdout(Stdio::null())
                .stderr(Stdio::null())
                .spawn()
                .expect("failed to spawn takeover worker");

            children.push(child);
        }

        // Wait until all children signal ready (timeout after 5 seconds)
        let ready_start = std::time::Instant::now();
        for i in 0..n {
            let ready_file = dir.path().join(format!("ready_{i}"));
            while !ready_file.exists() {
                if ready_start.elapsed() > std::time::Duration::from_secs(5) {
                    for mut child in children {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                    panic!("timed out waiting for worker {i} to be ready");
                }
                std::thread::sleep(std::time::Duration::from_millis(5));
            }
        }

        // Release all claimants simultaneously
        fs::write(&start_file, "go").unwrap();

        // Wait until all children write their result (timeout after 5 seconds)
        let result_start = std::time::Instant::now();
        for i in 0..n {
            let result_file = dir.path().join(format!("result_{i}"));
            while !result_file.exists() {
                if result_start.elapsed() > std::time::Duration::from_secs(5) {
                    for mut child in children {
                        let _ = child.kill();
                        let _ = child.wait();
                    }
                    panic!("timed out waiting for worker {i} result");
                }
                std::thread::sleep(std::time::Duration::from_millis(5));
            }
        }

        let mut won_count = 0;
        let mut blocked_count = 0;

        for i in 0..n {
            let result_file = dir.path().join(format!("result_{i}"));
            let content = fs::read_to_string(&result_file).unwrap();
            if content == "WON" {
                won_count += 1;
            } else if content == "BLOCKED" {
                blocked_count += 1;
            } else {
                panic!("unexpected worker {i} output: {content}");
            }
        }

        // Clean up children
        for mut child in children {
            let _ = child.kill();
            let _ = child.wait();
        }

        assert_eq!(
            won_count, 1,
            "exactly one process must win the takeover race"
        );
        assert_eq!(blocked_count, n - 1, "all other processes must be blocked");
    }
}
