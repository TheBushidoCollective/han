//! File watcher module for monitoring Claude Code session JSONL files
//!
//! This module provides file system watching capabilities using the notify crate.
//! It monitors `~/.claude/projects/` for JSONL file changes and automatically
//! triggers re-indexing to keep the database in sync with the filesystem.

use crate::indexer;
use crate::indexer::IndexResult;
use napi::bindgen_prelude::*;
use napi::threadsafe_function::{ErrorStrategy, ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
use notify::{
    event::{CreateKind, ModifyKind, RemoveKind},
    Config, Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher,
};
use std::collections::{HashSet, VecDeque};
use std::path::PathBuf;
use std::sync::atomic::{AtomicBool, Ordering};
use std::sync::Arc;
use std::time::Duration;

/// Thread-safe callback for notifying JavaScript of new index results
type IndexCallback = ThreadsafeFunction<IndexResult, ErrorStrategy::Fatal>;

/// Queue of recently indexed results for TypeScript to poll
static RESULT_QUEUE: std::sync::OnceLock<std::sync::Mutex<VecDeque<IndexResult>>> =
    std::sync::OnceLock::new();

/// Global callback for event-driven notifications
static INDEX_CALLBACK: std::sync::OnceLock<std::sync::Mutex<Option<IndexCallback>>> =
    std::sync::OnceLock::new();

fn get_result_queue() -> &'static std::sync::Mutex<VecDeque<IndexResult>> {
    RESULT_QUEUE.get_or_init(|| std::sync::Mutex::new(VecDeque::new()))
}

fn get_callback_holder() -> &'static std::sync::Mutex<Option<IndexCallback>> {
    INDEX_CALLBACK.get_or_init(|| std::sync::Mutex::new(None))
}

/// Push an index result - calls callback if registered, otherwise queues for polling
fn push_result(result: IndexResult) {
    // Try to call the callback first (instant notification)
    if let Ok(guard) = get_callback_holder().lock() {
        if let Some(callback) = guard.as_ref() {
            // Clone result for callback since we may also queue it
            callback.call(result.clone(), ThreadsafeFunctionCallMode::NonBlocking);
            return; // Callback handles it, no need to queue
        }
    }

    // Fallback to queue-based polling
    if let Ok(mut queue) = get_result_queue().lock() {
        // Limit queue size to prevent unbounded growth
        const MAX_QUEUE_SIZE: usize = 1000;
        while queue.len() >= MAX_QUEUE_SIZE {
            queue.pop_front();
        }
        queue.push_back(result);
    }
}

/// Get all pending index results and clear the queue
/// TypeScript calls this periodically to get results and publish subscription events
#[napi]
pub fn poll_index_results() -> Result<Vec<IndexResult>> {
    let queue = get_result_queue();
    let mut guard = queue.lock().map_err(|e| {
        napi::Error::from_reason(format!("Failed to acquire result queue lock: {}", e))
    })?;
    let results: Vec<IndexResult> = guard.drain(..).collect();
    Ok(results)
}

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
    _thread: std::thread::JoinHandle<()>,
}

/// Global watcher state (only one watcher can be active)
static WATCHER_HANDLE: std::sync::OnceLock<std::sync::Mutex<Option<WatcherHandle>>> =
    std::sync::OnceLock::new();

fn get_watcher_state() -> &'static std::sync::Mutex<Option<WatcherHandle>> {
    WATCHER_HANDLE.get_or_init(|| std::sync::Mutex::new(None))
}

/// Start watching the Claude projects directory for JSONL changes
/// Returns true if watcher was started, false if already running
#[napi]
pub fn start_file_watcher(watch_path: Option<String>) -> Result<bool> {
    let state = get_watcher_state();
    let mut guard = state
        .lock()
        .map_err(|e| napi::Error::from_reason(format!("Failed to acquire watcher lock: {}", e)))?;

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

    // Create a channel for events
    let (tx, rx) = std::sync::mpsc::channel::<Event>();

    // Create the watcher with a synchronous callback
    let watcher = RecommendedWatcher::new(
        move |res: notify::Result<Event>| {
            if let Ok(event) = res {
                // Send events through the channel (non-blocking)
                let _ = tx.send(event);
            }
        },
        Config::default()
            .with_poll_interval(Duration::from_secs(2))
            .with_compare_contents(false),
    )
    .map_err(|e| napi::Error::from_reason(format!("Failed to create watcher: {}", e)))?;

    // Start watching the path
    let mut watcher = watcher;
    watcher
        .watch(&path, RecursiveMode::Recursive)
        .map_err(|e| napi::Error::from_reason(format!("Failed to watch path: {}", e)))?;

    // Spawn a dedicated thread for processing events
    let thread = std::thread::spawn(move || {
        let mut seen_paths: HashSet<String> = HashSet::new();
        let debounce_duration = Duration::from_millis(100);
        let mut last_event_time = std::time::Instant::now();

        while running_clone.load(Ordering::Relaxed) {
            // Use recv_timeout to allow checking the running flag periodically
            match rx.recv_timeout(Duration::from_secs(1)) {
                Ok(event) => {
                    if let Some(file_event) = convert_event(&event) {
                        let now = std::time::Instant::now();
                        // Simple debouncing: skip if we've seen this path recently
                        if now.duration_since(last_event_time) > debounce_duration
                            || !seen_paths.contains(&file_event.path)
                        {
                            seen_paths.insert(file_event.path.clone());
                            last_event_time = now;

                            // Process the file event by triggering indexing
                            let event_type = file_event.event_type.clone();
                            let path = file_event.path.clone();
                            let session_id = file_event.session_id.clone();
                            let project_path = file_event.project_path.clone();

                            // Run indexing synchronously - errors are logged but don't stop the watcher
                            match indexer::handle_file_event(
                                event_type,
                                path.clone(),
                                session_id,
                                project_path,
                            ) {
                                Ok(Some(result)) => {
                                    // Push result to queue for TypeScript to poll
                                    push_result(result);
                                }
                                Ok(None) => {
                                    // No result (e.g., file removed)
                                }
                                Err(e) => {
                                    eprintln!("[watcher] Failed to index {}: {}", path, e);
                                }
                            }
                        }
                    }
                }
                Err(std::sync::mpsc::RecvTimeoutError::Timeout) => {
                    // Timeout - clear seen paths periodically to allow re-processing
                    seen_paths.clear();
                }
                Err(std::sync::mpsc::RecvTimeoutError::Disconnected) => {
                    break;
                }
            }
        }
    });

    *guard = Some(WatcherHandle {
        _watcher: watcher,
        running,
        _thread: thread,
    });

    Ok(true)
}

/// Stop the file watcher
#[napi]
pub fn stop_file_watcher() -> Result<bool> {
    // Clear the callback first
    if let Ok(mut callback_guard) = get_callback_holder().lock() {
        *callback_guard = None;
    }

    let state = get_watcher_state();
    let mut guard = state
        .lock()
        .map_err(|e| napi::Error::from_reason(format!("Failed to acquire watcher lock: {}", e)))?;

    if let Some(handle) = guard.take() {
        handle.running.store(false, Ordering::Relaxed);
        Ok(true)
    } else {
        Ok(false) // Not running
    }
}

/// Register a callback to be called when new index results are ready
/// This enables event-driven updates instead of polling
/// The callback receives IndexResult objects directly
#[napi(ts_args_type = "callback: (result: IndexResult) => void")]
pub fn set_index_callback(callback: JsFunction) -> Result<()> {
    let tsfn: IndexCallback = callback.create_threadsafe_function(0, |ctx| Ok(vec![ctx.value]))?;

    let holder = get_callback_holder();
    let mut guard = holder
        .lock()
        .map_err(|e| napi::Error::from_reason(format!("Failed to acquire callback lock: {}", e)))?;
    *guard = Some(tsfn);

    Ok(())
}

/// Clear the index callback (revert to polling mode)
#[napi]
pub fn clear_index_callback() -> Result<()> {
    let holder = get_callback_holder();
    let mut guard = holder
        .lock()
        .map_err(|e| napi::Error::from_reason(format!("Failed to acquire callback lock: {}", e)))?;
    *guard = None;
    Ok(())
}

/// Check if the file watcher is running
#[napi]
pub fn is_watcher_running() -> Result<bool> {
    let state = get_watcher_state();
    let guard = state
        .lock()
        .map_err(|e| napi::Error::from_reason(format!("Failed to acquire watcher lock: {}", e)))?;
    Ok(guard.is_some())
}

/// Get the default watch path (~/.claude/projects)
#[napi]
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
        let path = Path::new(
            "/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678.jsonl",
        );
        let session_id = extract_session_id(path);
        assert_eq!(
            session_id,
            Some("abc12345-1234-5678-9abc-def012345678".to_string())
        );

        let path2 = Path::new(
            "/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678_messages.jsonl",
        );
        let session_id2 = extract_session_id(path2);
        assert_eq!(
            session_id2,
            Some("abc12345-1234-5678-9abc-def012345678".to_string())
        );

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
