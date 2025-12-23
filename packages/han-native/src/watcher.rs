//! File watcher module for monitoring Claude Code session JSONL files
//!
//! This module provides file system watching capabilities using the notify crate.
//! It monitors `~/.claude/projects/` for JSONL file changes and emits events
//! that can be processed by the coordinator.

use napi::bindgen_prelude::*;
use napi_derive::napi;
use notify::{
    event::{CreateKind, ModifyKind, RemoveKind},
    Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use std::collections::HashSet;
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;

/// Event type for file changes
#[derive(Debug)]
#[napi(string_enum)]
pub enum FileEventType {
    Created,
    Modified,
    Removed,
}

/// File change event
#[napi(object)]
#[derive(Debug, Clone)]
pub struct FileEvent {
    /// Type of file event
    pub event_type: FileEventType,
    /// Absolute path to the file
    pub path: String,
    /// Session ID extracted from the filename (if applicable)
    pub session_id: Option<String>,
    /// Project path extracted from the directory structure
    pub project_path: Option<String>,
}

/// Extract session ID from a JSONL filename
/// Format: `{uuid}.jsonl` or `{uuid}_messages.jsonl`
fn extract_session_id(path: &std::path::Path) -> Option<String> {
    let filename = path.file_stem()?.to_str()?;
    // Handle both `{uuid}.jsonl` and `{uuid}_messages.jsonl`
    let session_id = if filename.ends_with("_messages") {
        filename.strip_suffix("_messages")?
    } else {
        filename
    };
    // Validate it looks like a UUID (basic check)
    if session_id.len() >= 32 && session_id.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        Some(session_id.to_string())
    } else {
        None
    }
}

/// Extract project path from the directory structure
/// Structure: `~/.claude/projects/{encoded-path}/`
fn extract_project_path(path: &std::path::Path) -> Option<String> {
    // Find the "projects" component and get the next component as the project slug
    let components: Vec<_> = path.components().collect();
    for (i, comp) in components.iter().enumerate() {
        if let std::path::Component::Normal(s) = comp {
            if s.to_str() == Some("projects") {
                // Next component is the project slug
                if let Some(std::path::Component::Normal(project_slug)) = components.get(i + 1) {
                    // Decode the project path (URL-encoded)
                    if let Some(slug) = project_slug.to_str() {
                        // The slug is URL-encoded path like "Volumes-dev-src-github-com-..."
                        // Return as-is for now; decoding happens in TypeScript
                        return Some(slug.to_string());
                    }
                }
            }
        }
    }
    None
}

/// Convert notify event to our FileEvent type
fn convert_event(event: &Event) -> Option<FileEvent> {
    let event_type = match &event.kind {
        EventKind::Create(CreateKind::File) => FileEventType::Created,
        EventKind::Modify(ModifyKind::Data(_)) | EventKind::Modify(ModifyKind::Any) => {
            FileEventType::Modified
        }
        EventKind::Remove(RemoveKind::File) => FileEventType::Removed,
        _ => return None,
    };

    // Get the first path (there should be exactly one for file events)
    let path = event.paths.first()?;

    // Only process .jsonl files
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

/// Active watcher handle
struct WatcherHandle {
    _watcher: RecommendedWatcher,
    running: Arc<AtomicBool>,
}

/// Global watcher state (only one watcher can be active)
static WATCHER_HANDLE: std::sync::OnceLock<std::sync::Mutex<Option<WatcherHandle>>> =
    std::sync::OnceLock::new();

fn get_watcher_state() -> &'static std::sync::Mutex<Option<WatcherHandle>> {
    WATCHER_HANDLE.get_or_init(|| std::sync::Mutex::new(None))
}

/// Start watching the Claude projects directory for JSONL changes
/// Returns a channel receiver for file events
pub async fn start_file_watcher(
    watch_path: Option<String>,
) -> Result<bool> {
    let state = get_watcher_state();
    let mut guard = state.lock().map_err(|e| {
        napi::Error::from_reason(format!("Failed to acquire watcher lock: {}", e))
    })?;

    // Already running
    if guard.is_some() {
        return Ok(false);
    }

    // Determine watch path
    let path = if let Some(p) = watch_path {
        PathBuf::from(p)
    } else {
        // Default: ~/.claude/projects
        let home = dirs::home_dir().ok_or_else(|| {
            napi::Error::from_reason("Could not determine home directory".to_string())
        })?;
        home.join(".claude").join("projects")
    };

    // Ensure the directory exists
    if !path.exists() {
        std::fs::create_dir_all(&path).map_err(|e| {
            napi::Error::from_reason(format!("Failed to create watch directory: {}", e))
        })?;
    }

    let running = Arc::new(AtomicBool::new(true));
    let running_clone = running.clone();

    // Create the watcher
    let (tx, mut rx) = mpsc::channel::<Event>(1000);

    let watcher = RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            if let Ok(event) = res {
                // Send events through the channel (non-blocking)
                let _ = tx.try_send(event);
            }
        },
        Config::default()
            .with_poll_interval(Duration::from_secs(2))
            .with_compare_contents(false),
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to create watcher: {}", e)))?;

    // Start watching in a background task
    let path_clone = path.clone();
    tokio::spawn(async move {
        // Process events as they come in
        let mut seen_paths: HashSet<String> = HashSet::new();
        let debounce_duration = Duration::from_millis(100);
        let mut last_event_time = std::time::Instant::now();

        while running_clone.load(Ordering::Relaxed) {
            match tokio::time::timeout(Duration::from_secs(1), rx.recv()).await {
                Ok(Some(event)) => {
                    if let Some(file_event) = convert_event(&event) {
                        let now = std::time::Instant::now();
                        // Simple debouncing: skip if we've seen this path recently
                        if now.duration_since(last_event_time) > debounce_duration
                            || !seen_paths.contains(&file_event.path)
                        {
                            seen_paths.insert(file_event.path.clone());
                            last_event_time = now;

                            // Log the event (will be replaced with actual processing)
                            tracing::info!(
                                "File event: {:?} - {} (session: {:?}, project: {:?})",
                                file_event.event_type,
                                file_event.path,
                                file_event.session_id,
                                file_event.project_path
                            );
                        }
                    }
                }
                Ok(None) => break, // Channel closed
                Err(_) => {
                    // Timeout - clear seen paths periodically
                    seen_paths.clear();
                }
            }
        }

        tracing::info!("File watcher stopped for {:?}", path_clone);
    });

    // Actually start watching the path
    // Note: We need to do this after spawning the task to avoid race conditions
    let mut watcher = watcher;
    watcher
        .watch(&path, RecursiveMode::Recursive)
        .map_err(|e| napi::Error::from_reason(format!("Failed to watch path: {}", e)))?;

    *guard = Some(WatcherHandle {
        _watcher: watcher,
        running,
    });

    tracing::info!("Started file watcher for {:?}", path);
    Ok(true)
}

/// Stop the file watcher
pub fn stop_file_watcher() -> Result<bool> {
    let state = get_watcher_state();
    let mut guard = state.lock().map_err(|e| {
        napi::Error::from_reason(format!("Failed to acquire watcher lock: {}", e))
    })?;

    if let Some(handle) = guard.take() {
        handle.running.store(false, Ordering::Relaxed);
        tracing::info!("Stopped file watcher");
        Ok(true)
    } else {
        Ok(false) // Not running
    }
}

/// Check if the file watcher is running
pub fn is_watcher_running() -> Result<bool> {
    let state = get_watcher_state();
    let guard = state.lock().map_err(|e| {
        napi::Error::from_reason(format!("Failed to acquire watcher lock: {}", e))
    })?;
    Ok(guard.is_some())
}

/// Get the default watch path (~/.claude/projects)
pub fn get_default_watch_path() -> Result<String> {
    let home = dirs::home_dir().ok_or_else(|| {
        napi::Error::from_reason("Could not determine home directory".to_string())
    })?;
    let path = home.join(".claude").join("projects");
    Ok(path.to_string_lossy().to_string())
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::path::Path;

    #[test]
    fn test_extract_session_id() {
        let path = Path::new("/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678.jsonl");
        let session_id = extract_session_id(path);
        assert_eq!(session_id, Some("abc12345-1234-5678-9abc-def012345678".to_string()));

        let path2 = Path::new("/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678_messages.jsonl");
        let session_id2 = extract_session_id(path2);
        assert_eq!(session_id2, Some("abc12345-1234-5678-9abc-def012345678".to_string()));

        // Invalid session ID (too short)
        let path3 = Path::new("/home/user/.claude/projects/test/short.jsonl");
        let session_id3 = extract_session_id(path3);
        assert_eq!(session_id3, None);
    }

    #[test]
    fn test_extract_project_path() {
        let path = Path::new("/home/user/.claude/projects/Volumes-dev-src-myproject/session.jsonl");
        let project = extract_project_path(path);
        assert_eq!(project, Some("Volumes-dev-src-myproject".to_string()));
    }
}
