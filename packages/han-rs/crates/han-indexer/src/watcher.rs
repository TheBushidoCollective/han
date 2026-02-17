//! File watcher module for monitoring Claude Code session JSONL files.
//!
//! Monitors `~/.claude/projects/` for JSONL file changes using the `notify` crate.
//! Unlike the NAPI version, this uses tokio channels and owned structs instead
//! of global statics and ThreadsafeFunction callbacks.

use crate::types::FileEventType;
use notify::{
    event::{CreateKind, ModifyKind, RemoveKind},
    Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum WatcherError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Notify error: {0}")]
    Notify(#[from] notify::Error),
    #[error("Home directory not found")]
    NoHomeDir,
    #[error("Watcher is not running")]
    NotRunning,
}

pub type WatcherResult<T> = Result<T, WatcherError>;

/// File change event.
#[derive(Debug, Clone)]
pub struct FileEvent {
    /// Type of file event.
    pub event_type: FileEventType,
    /// Absolute path to the file.
    pub path: String,
    /// Session ID extracted from the filename (if applicable).
    pub session_id: Option<String>,
    /// Project slug extracted from the directory structure.
    pub project_path: Option<String>,
}

/// Extract session ID from a JSONL filename.
/// Format: `{uuid}.jsonl` or `{uuid}_messages.jsonl`
pub fn extract_session_id(path: &Path) -> Option<String> {
    let filename = path.file_stem()?.to_str()?;
    let session_id = if filename.ends_with("_messages") {
        filename.strip_suffix("_messages")?
    } else {
        filename
    };
    if session_id.len() >= 32
        && session_id
            .chars()
            .all(|c| c.is_ascii_hexdigit() || c == '-')
    {
        Some(session_id.to_string())
    } else {
        None
    }
}

/// Extract project slug from the directory structure.
/// Structure: `~/.claude/projects/{encoded-path}/`
pub fn extract_project_path(path: &Path) -> Option<String> {
    let components: Vec<_> = path.components().collect();
    for (i, comp) in components.iter().enumerate() {
        if let std::path::Component::Normal(s) = comp {
            if s.to_str() == Some("projects") {
                if let Some(std::path::Component::Normal(project_slug)) = components.get(i + 1) {
                    if let Some(slug) = project_slug.to_str() {
                        return Some(slug.to_string());
                    }
                }
            }
        }
    }
    None
}

/// Convert a notify event to our FileEvent type.
fn convert_event(event: &Event) -> Option<FileEvent> {
    let event_type = match &event.kind {
        EventKind::Create(CreateKind::File) => FileEventType::Created,
        EventKind::Modify(ModifyKind::Data(_)) | EventKind::Modify(ModifyKind::Any) => {
            FileEventType::Modified
        }
        EventKind::Remove(RemoveKind::File) => FileEventType::Removed,
        _ => return None,
    };

    let path = event.paths.first()?;

    if path.extension().and_then(|e| e.to_str()) != Some("jsonl") {
        return None;
    }

    let session_id = extract_session_id(path);
    let project_path = extract_project_path(path);

    Some(FileEvent {
        event_type,
        path: path.to_string_lossy().to_string(),
        session_id,
        project_path,
    })
}

/// File system watcher service.
///
/// Owns a `notify::RecommendedWatcher` and exposes an async `next_event()` method.
/// No global statics or NAPI callbacks.
pub struct WatcherService {
    watcher: RecommendedWatcher,
    event_rx: tokio::sync::mpsc::Receiver<FileEvent>,
    running: Arc<AtomicBool>,
    _thread: Option<std::thread::JoinHandle<()>>,
    watched_paths: HashMap<String, String>,
}

impl WatcherService {
    /// Create a new watcher service.
    /// Defaults to `~/.claude/projects` if no path is given.
    pub fn new(watch_path: Option<PathBuf>) -> WatcherResult<Self> {
        let path = if let Some(p) = watch_path {
            p
        } else {
            let home = dirs::home_dir().ok_or(WatcherError::NoHomeDir)?;
            home.join(".claude").join("projects")
        };

        if !path.exists() {
            std::fs::create_dir_all(&path)?;
        }

        let running = Arc::new(AtomicBool::new(true));
        let running_clone = running.clone();

        let (notify_tx, notify_rx) = std::sync::mpsc::channel::<Event>();
        let (event_tx, event_rx) = tokio::sync::mpsc::channel::<FileEvent>(1024);

        let mut watcher = RecommendedWatcher::new(
            move |res: notify::Result<Event>| {
                if let Ok(event) = res {
                    let _ = notify_tx.send(event);
                }
            },
            Config::default().with_poll_interval(Duration::from_secs(2)),
        )?;

        watcher.watch(&path, RecursiveMode::Recursive)?;

        let thread = std::thread::spawn(move || {
            let mut seen_paths: HashSet<String> = HashSet::new();
            let debounce_duration = Duration::from_millis(100);
            let mut last_event_time = std::time::Instant::now();

            while running_clone.load(Ordering::Relaxed) {
                match notify_rx.recv_timeout(Duration::from_secs(1)) {
                    Ok(event) => {
                        if let Some(file_event) = convert_event(&event) {
                            let now = std::time::Instant::now();
                            if now.duration_since(last_event_time) > debounce_duration
                                || !seen_paths.contains(&file_event.path)
                            {
                                seen_paths.insert(file_event.path.clone());
                                last_event_time = now;
                                let _ = event_tx.try_send(file_event);
                            }
                        }
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                        seen_paths.clear();
                    }
                    Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                        break;
                    }
                }
            }
        });

        let mut watched_paths = HashMap::new();
        let config_dir = path
            .parent()
            .map(|p| p.to_string_lossy().to_string())
            .unwrap_or_else(|| path.to_string_lossy().to_string());
        watched_paths.insert(config_dir, path.to_string_lossy().to_string());

        Ok(Self {
            watcher,
            event_rx,
            running,
            _thread: Some(thread),
            watched_paths,
        })
    }

    /// Add an additional watch path.
    pub fn add_watch_path(
        &mut self,
        config_dir: &str,
        projects_path: Option<&Path>,
    ) -> WatcherResult<bool> {
        let path = if let Some(p) = projects_path {
            p.to_path_buf()
        } else {
            PathBuf::from(config_dir).join("projects")
        };

        if self.watched_paths.contains_key(config_dir) {
            return Ok(false);
        }

        if !path.exists() {
            std::fs::create_dir_all(&path)?;
        }

        self.watcher.watch(&path, RecursiveMode::Recursive)?;
        self.watched_paths
            .insert(config_dir.to_string(), path.to_string_lossy().to_string());
        Ok(true)
    }

    /// Remove a watch path.
    pub fn remove_watch_path(&mut self, config_dir: &str) -> WatcherResult<bool> {
        let path_str = match self.watched_paths.remove(config_dir) {
            Some(p) => p,
            None => return Ok(false),
        };

        let path = PathBuf::from(&path_str);
        self.watcher.unwatch(&path)?;
        Ok(true)
    }

    /// Receive the next file event (async). Returns None if the watcher is stopped.
    pub async fn next_event(&mut self) -> Option<FileEvent> {
        self.event_rx.recv().await
    }

    /// Get all currently watched paths.
    pub fn watched_paths(&self) -> Vec<String> {
        self.watched_paths.values().cloned().collect()
    }

    /// Stop the watcher.
    pub fn stop(&mut self) {
        self.running.store(false, Ordering::Relaxed);
    }

    /// Check if the watcher is running.
    pub fn is_running(&self) -> bool {
        self.running.load(Ordering::Relaxed)
    }

    /// Get the default watch path (`~/.claude/projects`).
    pub fn default_watch_path() -> Option<PathBuf> {
        dirs::home_dir().map(|h| h.join(".claude").join("projects"))
    }
}

impl Drop for WatcherService {
    fn drop(&mut self) {
        self.stop();
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_session_id_uuid() {
        let path = Path::new(
            "/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678.jsonl",
        );
        assert_eq!(
            extract_session_id(path),
            Some("abc12345-1234-5678-9abc-def012345678".to_string())
        );
    }

    #[test]
    fn test_extract_session_id_with_messages_suffix() {
        let path = Path::new(
            "/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678_messages.jsonl",
        );
        assert_eq!(
            extract_session_id(path),
            Some("abc12345-1234-5678-9abc-def012345678".to_string())
        );
    }

    #[test]
    fn test_extract_session_id_too_short() {
        let path = Path::new("/home/user/.claude/projects/test/short.jsonl");
        assert_eq!(extract_session_id(path), None);
    }

    #[test]
    fn test_extract_project_path() {
        let path =
            Path::new("/home/user/.claude/projects/Volumes-dev-src-myproject/session.jsonl");
        assert_eq!(
            extract_project_path(path),
            Some("Volumes-dev-src-myproject".to_string())
        );
    }

    #[test]
    fn test_extract_project_path_no_projects_dir() {
        let path = Path::new("/home/user/random/session.jsonl");
        assert_eq!(extract_project_path(path), None);
    }
}
