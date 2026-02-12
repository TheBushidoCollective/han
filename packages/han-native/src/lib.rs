#![deny(clippy::all)]

mod coordinator;
mod crud;
mod db;
mod download;
mod embedding;
mod git;
mod indexer;
mod jsonl;
mod schema;
mod sentiment;
mod task_timeline;
mod transcript;
mod watcher;

use ignore::WalkBuilder;
use napi_derive::napi;
use rayon::prelude::*;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::Path;

// Re-export database types (VectorDocument is internal, use VectorDocumentInput for napi)
pub use db::{FtsDocument, FtsSearchResult, VectorSearchResult};

// Re-export schema types for unified data store
pub use schema::{
    // Config dirs registry (multi-environment support)
    ConfigDir,
    ConfigDirInput,
    // File validation status (for stale detection)
    FileValidationStatus,
    // Frustration tracking
    FrustrationEvent,
    FrustrationEventInput,
    FrustrationMetrics,
    // Generated session summaries (LLM-analyzed)
    GeneratedSessionSummary,
    GeneratedSessionSummaryInput,
    // Hook attempt tracking (for deferred execution)
    HookAttemptInfo,
    // Hook execution tracking
    HookExecution,
    HookExecutionInput,
    HookStats,
    Message,
    MessageBatch,
    MessageInput,
    // Native tasks (Claude Code's built-in task system)
    NativeTask,
    NativeTaskInput,
    NativeTaskUpdate,
    // Orchestration (group hook executions by orchestrate run)
    Orchestration,
    OrchestrationInput,
    OrchestrationUpdate,
    // Pending hooks queue
    PendingHookInput,
    Project,
    ProjectInput,
    // Queued hooks (for --check mode)
    QueuedHook,
    QueuedHookInput,
    Repo,
    RepoInput,
    Session,
    SessionCompact,
    SessionCompactInput,
    // Session file changes
    SessionFileChange,
    SessionFileChangeInput,
    // Session file validations
    SessionFileValidation,
    SessionFileValidationInput,
    SessionInput,
    // Session summaries and compacts (event-sourced)
    SessionSummary,
    SessionSummaryInput,
    // Session todos (event-sourced)
    SessionTodos,
    SessionTodosInput,
    Task,
    TaskCompletion,
    TaskFailure,
    TaskInput,
    TaskMetrics,
    TodoItem,
};

// Re-export JSONL types and functions
pub use jsonl::{
    jsonl_build_index, jsonl_count_lines, jsonl_filter, jsonl_filter_time_range, jsonl_load_index,
    jsonl_read_indexed, jsonl_read_page, jsonl_read_reverse, jsonl_save_index, jsonl_stats,
    jsonl_stream, FilterResult, JsonlFilter, JsonlIndex, JsonlLine, JsonlStats, PaginatedResult,
};

// Re-export transcript processing functions
pub use transcript::{
    extract_file_operations, extract_file_operations_batch, list_jsonl_files, list_session_files,
    ExtractionResult, FileOperation, SessionFile,
};

// ============================================================================
// File Utility Functions (unchanged)
// ============================================================================

/// Compute SHA256 hash of a file's contents
/// Returns empty string if file cannot be read
#[napi]
pub fn compute_file_hash(file_path: String) -> String {
    match fs::File::open(&file_path) {
        Ok(mut file) => {
            let mut hasher = Sha256::new();
            let mut buffer = [0u8; 8192];
            loop {
                match file.read(&mut buffer) {
                    Ok(0) => break,
                    Ok(n) => hasher.update(&buffer[..n]),
                    Err(_) => return String::new(),
                }
            }
            format!("{:x}", hasher.finalize())
        }
        Err(_) => String::new(),
    }
}

/// Compute SHA256 hashes for multiple files in parallel
/// Returns a map of file path to hash
#[napi]
pub fn compute_file_hashes_parallel(file_paths: Vec<String>) -> HashMap<String, String> {
    file_paths
        .par_iter()
        .map(|path| {
            let hash = compute_file_hash(path.clone());
            (path.clone(), hash)
        })
        .collect()
}

/// Find files matching glob patterns in a directory, respecting gitignore
/// Returns absolute file paths
#[napi]
pub fn find_files_with_glob(root_dir: String, patterns: Vec<String>) -> Vec<String> {
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    let mut glob_builder = globset::GlobSetBuilder::new();
    for pattern in &patterns {
        if let Ok(glob) = globset::Glob::new(pattern) {
            glob_builder.add(glob);
        }
    }
    let glob_set = match glob_builder.build() {
        Ok(gs) => gs,
        Err(_) => return Vec::new(),
    };

    let mut results = Vec::new();

    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(|entry| entry.file_name() != ".git")
        .build();

    for entry in walker.flatten() {
        if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            let path = entry.path();
            if let Ok(relative) = path.strip_prefix(&root) {
                let relative_str = relative.to_string_lossy();
                if glob_set.is_match(relative_str.as_ref()) {
                    if let Ok(abs_path) = fs::canonicalize(path) {
                        if let Some(abs_str) = abs_path.to_str() {
                            results.push(abs_str.to_string());
                        }
                    }
                }
            }
        }
    }

    results
}

/// Find directories containing marker files or directories
/// Returns absolute directory paths
#[napi]
pub fn find_directories_with_markers(root_dir: String, markers: Vec<String>) -> Vec<String> {
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    let mut root_glob_builder = globset::GlobSetBuilder::new();
    for marker in &markers {
        if let Ok(glob) = globset::Glob::new(marker) {
            root_glob_builder.add(glob);
        }
    }
    let root_level_globs = match root_glob_builder.build() {
        Ok(gs) => gs,
        Err(_) => return Vec::new(),
    };

    let mut glob_builder = globset::GlobSetBuilder::new();
    for marker in &markers {
        if let Ok(glob) = globset::Glob::new(marker) {
            glob_builder.add(glob);
        }
        let nested_pattern = format!("**/{}", marker);
        if let Ok(glob) = globset::Glob::new(&nested_pattern) {
            glob_builder.add(glob);
        }
    }
    let glob_set = match glob_builder.build() {
        Ok(gs) => gs,
        Err(_) => return Vec::new(),
    };

    let mut seen_dirs = std::collections::HashSet::new();
    let mut results = Vec::new();

    let filter_root = root.clone();
    let filter_globs = root_level_globs.clone();

    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(move |entry| {
            let name = entry.file_name().to_string_lossy();
            if name == ".git" {
                return false;
            }
            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                if let Ok(rel) = entry.path().strip_prefix(&filter_root) {
                    let rel_str = rel.to_string_lossy();
                    for component in rel_str.split('/') {
                        if component.is_empty() || component == name {
                            continue;
                        }
                        if filter_globs.is_match(component) {
                            return false;
                        }
                    }
                }
            }
            true
        })
        .build();

    for entry in walker.flatten() {
        let file_type = entry.file_type();
        let is_file = file_type.map(|ft| ft.is_file()).unwrap_or(false);
        let is_dir = file_type.map(|ft| ft.is_dir()).unwrap_or(false);

        if is_file || is_dir {
            let path = entry.path();
            if let Ok(relative) = path.strip_prefix(&root) {
                let relative_str = relative.to_string_lossy();
                if glob_set.is_match(relative_str.as_ref()) {
                    let target_dir = path.parent();

                    if let Some(parent) = target_dir {
                        if let Ok(abs_dir) = fs::canonicalize(parent) {
                            if let Ok(rel_target) = abs_dir.strip_prefix(&root) {
                                let rel_target_str = rel_target.to_string_lossy();
                                let mut inside_marker = false;
                                for component in rel_target_str.split('/') {
                                    if !component.is_empty() && root_level_globs.is_match(component)
                                    {
                                        inside_marker = true;
                                        break;
                                    }
                                }
                                if inside_marker {
                                    continue;
                                }
                            }

                            if let Some(dir_str) = abs_dir.to_str() {
                                let dir_name = abs_dir
                                    .file_name()
                                    .map(|n| n.to_string_lossy().to_string())
                                    .unwrap_or_default();
                                if root_level_globs.is_match(&dir_name) {
                                    continue;
                                }

                                if seen_dirs.insert(dir_str.to_string()) {
                                    results.push(dir_str.to_string());
                                }
                            }
                        }
                    }
                }
            }
        }
    }

    results
}

/// Build a manifest of file hashes for given files
#[napi]
pub fn build_manifest(files: Vec<String>, root_dir: String) -> HashMap<String, String> {
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => Path::new(&root_dir).to_path_buf(),
    };

    files
        .par_iter()
        .filter_map(|file| {
            // Canonicalize the file path to resolve symlinks and different mounts
            // (e.g., /Volumes/dev vs /Users/name/dev pointing to the same location)
            let canonical_path = fs::canonicalize(file).ok()?;
            let relative = canonical_path.strip_prefix(&root).ok()?;
            let relative_str = relative.to_string_lossy().to_string();
            let hash = compute_file_hash(file.clone());
            Some((relative_str, hash))
        })
        .collect()
}

/// Check if any files have changed compared to a cached manifest
#[napi]
pub fn has_changes(
    root_dir: String,
    patterns: Vec<String>,
    cached_manifest: HashMap<String, String>,
) -> bool {
    if cached_manifest.is_empty() {
        return true;
    }

    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => return true,
    };

    let mut glob_builder = globset::GlobSetBuilder::new();
    for pattern in &patterns {
        if let Ok(glob) = globset::Glob::new(pattern) {
            glob_builder.add(glob);
        }
    }
    let glob_set = match glob_builder.build() {
        Ok(gs) => gs,
        Err(_) => return true,
    };

    let mut seen_paths = std::collections::HashSet::new();

    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(|entry| entry.file_name() != ".git")
        .build();

    for entry in walker.flatten() {
        if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            let path = entry.path();
            if let Ok(relative) = path.strip_prefix(&root) {
                let relative_str = relative.to_string_lossy().to_string();
                if glob_set.is_match(&relative_str) {
                    seen_paths.insert(relative_str.clone());

                    let current_hash = if let Some(abs_path) = path.to_str() {
                        compute_file_hash(abs_path.to_string())
                    } else {
                        String::new()
                    };

                    let cached_hash = cached_manifest.get(&relative_str);
                    if cached_hash.map(|h| h.as_str()) != Some(&current_hash) {
                        return true;
                    }
                }
            }
        }
    }

    for cached_path in cached_manifest.keys() {
        if !seen_paths.contains(cached_path) {
            return true;
        }
    }

    false
}

#[napi(object)]
pub struct CheckResult {
    pub has_changes: bool,
    pub manifest: HashMap<String, String>,
    pub files: Vec<String>,
}

/// Efficiently check for changes and build manifest in one pass
#[napi]
pub fn check_and_build_manifest(
    root_dir: String,
    patterns: Vec<String>,
    cached_manifest: Option<HashMap<String, String>>,
) -> CheckResult {
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => {
            return CheckResult {
                has_changes: true,
                manifest: HashMap::new(),
                files: Vec::new(),
            }
        }
    };

    let mut glob_builder = globset::GlobSetBuilder::new();
    for pattern in &patterns {
        if let Ok(glob) = globset::Glob::new(pattern) {
            glob_builder.add(glob);
        }
    }
    let glob_set = match glob_builder.build() {
        Ok(gs) => gs,
        Err(_) => {
            return CheckResult {
                has_changes: true,
                manifest: HashMap::new(),
                files: Vec::new(),
            }
        }
    };

    let cache = cached_manifest.unwrap_or_default();
    let has_cache = !cache.is_empty();
    let mut files = Vec::new();

    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(|entry| entry.file_name() != ".git")
        .build();

    for entry in walker.flatten() {
        if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            let path = entry.path();
            if let Ok(relative) = path.strip_prefix(&root) {
                let relative_str = relative.to_string_lossy().to_string();
                if glob_set.is_match(&relative_str) {
                    if let Some(abs_path) = path.to_str() {
                        files.push(abs_path.to_string());
                    }
                }
            }
        }
    }

    let manifest: HashMap<String, String> = files
        .par_iter()
        .filter_map(|file| {
            let path = Path::new(file);
            let relative = path.strip_prefix(&root).ok()?;
            let relative_str = relative.to_string_lossy().to_string();
            let hash = compute_file_hash(file.clone());
            Some((relative_str, hash))
        })
        .collect();

    let has_changes = if !has_cache {
        true
    } else {
        let mut changed = false;
        for (path, hash) in &manifest {
            if cache.get(path) != Some(hash) {
                changed = true;
                break;
            }
        }
        if !changed {
            for cached_path in cache.keys() {
                if !manifest.contains_key(cached_path) {
                    changed = true;
                    break;
                }
            }
        }
        changed
    };

    CheckResult {
        has_changes,
        manifest,
        files,
    }
}

// ============================================================================
// Database Functions (SQLite)
// ============================================================================

/// Initialize or open a database at the given path
/// Note: db_path is kept for API compatibility but the singleton uses ~/.han/han.db
#[napi]
pub fn db_init(db_path: String) -> napi::Result<bool> {
    db::init(&db_path)
}

/// Check if database needs reindex (after schema upgrade or version change)
/// Call this on coordinator startup and trigger fullScanAndIndex if true
#[napi]
pub fn needs_reindex() -> napi::Result<bool> {
    db::needs_reindex()
}

/// Clear the needs_reindex flag after successful reindex
#[napi]
pub fn clear_reindex_flag() -> napi::Result<()> {
    db::clear_reindex_flag()
}

/// Index documents for FTS
#[napi]
pub fn fts_index(
    db_path: String,
    table_name: String,
    documents: Vec<FtsDocument>,
) -> napi::Result<u32> {
    db::fts_index(&db_path, &table_name, documents)
}

/// Search documents using FTS (BM25)
#[napi]
pub fn fts_search(
    db_path: String,
    table_name: String,
    query: String,
    limit: Option<u32>,
) -> napi::Result<Vec<FtsSearchResult>> {
    db::fts_search(&db_path, &table_name, &query, limit)
}

/// Delete documents by ID
#[napi]
pub fn fts_delete(db_path: String, table_name: String, ids: Vec<String>) -> napi::Result<u32> {
    db::fts_delete(&db_path, &table_name, ids)
}

/// Input for vector document indexing (napi-compatible)
#[napi(object)]
pub struct VectorDocumentInput {
    pub id: String,
    pub content: String,
    pub vector: Vec<f64>, // JS numbers are f64
    pub metadata: Option<String>,
}

/// Index documents with vectors
#[napi]
pub fn vector_index(
    db_path: String,
    table_name: String,
    documents: Vec<VectorDocumentInput>,
) -> napi::Result<u32> {
    // Convert from napi types to internal types
    let docs: Vec<db::VectorDocument> = documents
        .into_iter()
        .map(|d| db::VectorDocument {
            id: d.id,
            content: d.content,
            vector: d.vector.into_iter().map(|v| v as f32).collect(),
            metadata: d.metadata,
        })
        .collect();
    db::vector_index(&db_path, &table_name, docs)
}

/// Search documents using vector similarity
#[napi]
pub fn vector_search(
    db_path: String,
    table_name: String,
    query_vector: Vec<f64>, // JS numbers are f64
    limit: Option<u32>,
) -> napi::Result<Vec<VectorSearchResult>> {
    let query: Vec<f32> = query_vector.into_iter().map(|v| v as f32).collect();
    db::vector_search(&db_path, &table_name, query, limit)
}

// ============================================================================
// Embedding Functions (ort with runtime download)
// ============================================================================

/// Check if ONNX Runtime is available (downloaded)
#[napi]
pub async fn embedding_is_available() -> napi::Result<bool> {
    embedding::is_available().await
}

/// Ensure ONNX Runtime and model are downloaded
/// Returns path to the ONNX Runtime library
#[napi]
pub async fn embedding_ensure_available() -> napi::Result<String> {
    embedding::ensure_available().await
}

/// Generate embeddings for a list of texts
#[napi]
pub async fn generate_embeddings(texts: Vec<String>) -> napi::Result<Vec<Vec<f32>>> {
    embedding::generate_embeddings(texts).await
}

/// Generate embedding for a single text
#[napi]
pub async fn generate_embedding(text: String) -> napi::Result<Vec<f32>> {
    embedding::generate_embedding(text).await
}

/// Get the embedding dimension (384 for all-MiniLM-L6-v2)
#[napi]
pub fn get_embedding_dimension() -> u32 {
    384
}

// ============================================================================
// Unified Data Store Functions (SQLite)
// ============================================================================

// Note: init_schema is no longer needed - schema auto-applies on first db access

// ============================================================================
// Repo Operations
// ============================================================================

/// Create or update a repo record
#[napi]
pub fn upsert_repo(_db_path: String, input: RepoInput) -> napi::Result<Repo> {
    crud::upsert_repo(input)
}

/// Get a repo by its remote URL
#[napi]
pub fn get_repo_by_remote(_db_path: String, remote: String) -> napi::Result<Option<Repo>> {
    crud::get_repo_by_remote(&remote)
}

/// List all repos
#[napi]
pub fn list_repos(_db_path: String) -> napi::Result<Vec<Repo>> {
    crud::list_repos()
}

// ============================================================================
// Project Operations
// ============================================================================

/// Create or update a project record
#[napi]
pub fn upsert_project(_db_path: String, input: ProjectInput) -> napi::Result<Project> {
    crud::upsert_project(input)
}

/// Get a project by its slug
#[napi]
pub fn get_project_by_slug(_db_path: String, slug: String) -> napi::Result<Option<Project>> {
    crud::get_project_by_slug(&slug)
}

/// Get a project by its absolute path
#[napi]
pub fn get_project_by_path(_db_path: String, path: String) -> napi::Result<Option<Project>> {
    crud::get_project_by_path(&path)
}

/// List projects, optionally filtered by repo
#[napi]
pub fn list_projects(_db_path: String, repo_id: Option<String>) -> napi::Result<Vec<Project>> {
    crud::list_projects(repo_id)
}

// ============================================================================
// Session Operations
// ============================================================================

/// Create or update a session record
#[napi]
pub fn upsert_session(_db_path: String, input: SessionInput) -> napi::Result<Session> {
    crud::upsert_session(input)
}

/// Mark a session as completed
#[napi]
pub fn end_session(_db_path: String, session_id: String) -> napi::Result<bool> {
    crud::end_session(&session_id)
}

/// Get a session by ID
#[napi]
pub fn get_session(_db_path: String, session_id: String) -> napi::Result<Option<Session>> {
    crud::get_session(&session_id)
}

/// List sessions with optional filters
#[napi]
pub fn list_sessions(
    _db_path: String,
    project_id: Option<String>,
    status: Option<String>,
    limit: Option<u32>,
) -> napi::Result<Vec<Session>> {
    crud::list_sessions(project_id, status, limit)
}

/// Reset all sessions for re-indexing
/// Sets last_indexed_line to 0 so all messages will be re-processed
/// Use this when you need to backfill raw_json or other fields
#[napi]
pub fn reset_all_sessions_for_reindex(_db_path: String) -> napi::Result<u32> {
    crud::reset_all_sessions_for_reindex()
}

// ============================================================================
// Config Dir Registry Operations (Multi-Environment Support)
// ============================================================================

/// Register a config directory for multi-environment indexing
#[napi]
pub fn register_config_dir(_db_path: String, input: ConfigDirInput) -> napi::Result<ConfigDir> {
    crud::register_config_dir(input)
}

/// Get a config directory by path
#[napi]
pub fn get_config_dir_by_path(_db_path: String, path: String) -> napi::Result<Option<ConfigDir>> {
    crud::get_config_dir_by_path(path)
}

/// List all registered config directories
#[napi]
pub fn list_config_dirs(_db_path: String) -> napi::Result<Vec<ConfigDir>> {
    crud::list_config_dirs()
}

/// Update the last indexed timestamp for a config directory
#[napi]
pub fn update_config_dir_last_indexed(_db_path: String, path: String) -> napi::Result<bool> {
    crud::update_config_dir_last_indexed(path)
}

/// Remove a config directory from the registry
#[napi]
pub fn unregister_config_dir(_db_path: String, path: String) -> napi::Result<bool> {
    crud::unregister_config_dir(path)
}

/// Get the default config directory
#[napi]
pub fn get_default_config_dir(_db_path: String) -> napi::Result<Option<ConfigDir>> {
    crud::get_default_config_dir()
}

// ============================================================================
// Message Operations
// ============================================================================

/// Insert a batch of messages for a session
#[napi]
pub fn insert_messages_batch(
    _db_path: String,
    session_id: String,
    messages: Vec<MessageInput>,
) -> napi::Result<u32> {
    crud::insert_messages_batch(&session_id, messages)
}

/// Get a message by ID
#[napi]
pub fn get_message(_db_path: String, message_id: String) -> napi::Result<Option<Message>> {
    crud::get_message(&message_id)
}

/// List messages for a session with optional type filter, agent filter, and pagination
/// agent_id_filter behavior:
///   - undefined/null: returns all messages (main + agent)
///   - empty string "": returns only main conversation (agent_id IS NULL)
///   - non-empty string: returns only messages from that specific agent
#[napi]
pub fn list_session_messages(
    _db_path: String,
    session_id: String,
    message_type: Option<String>,
    agent_id_filter: Option<String>, // "" = main only, Some(id) = specific agent, None = all
    limit: Option<u32>,
    offset: Option<u32>,
) -> napi::Result<Vec<Message>> {
    // Convert the JS-friendly Option<String> to our internal Option<Option<String>>
    // None (undefined/null in JS) -> None (all messages)
    // Some("") -> Some(None) (main conversation only, where agent_id IS NULL)
    // Some("xyz") -> Some(Some("xyz")) (specific agent only)
    let agent_filter = agent_id_filter.map(|s| if s.is_empty() { None } else { Some(s) });
    crud::list_session_messages(&session_id, message_type, agent_filter, limit, offset)
}

/// Get message count for a session
#[napi]
pub fn get_message_count(_db_path: String, session_id: String) -> napi::Result<u32> {
    crud::get_message_count(&session_id)
}

/// Get message counts for multiple sessions in a single query
/// Returns a map of session_id -> count
#[napi]
pub fn get_message_counts_batch(
    _db_path: String,
    session_ids: Vec<String>,
) -> napi::Result<std::collections::HashMap<String, u32>> {
    crud::get_message_counts_batch(session_ids)
}

/// Get the last indexed line number for incremental indexing
#[napi]
pub fn get_last_indexed_line(_db_path: String, session_id: String) -> napi::Result<i32> {
    crud::get_last_indexed_line(&session_id)
}

/// Session timestamps returned by get_session_timestamps_batch
#[napi(object)]
pub struct SessionTimestamps {
    pub session_id: String,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
}

/// Get first/last message timestamps for multiple sessions in a single query
/// Returns a map of session_id -> SessionTimestamps
#[napi]
pub fn get_session_timestamps_batch(
    _db_path: String,
    session_ids: Vec<String>,
) -> napi::Result<std::collections::HashMap<String, SessionTimestamps>> {
    let result = crud::get_session_timestamps_batch(session_ids)?;
    Ok(result
        .into_iter()
        .map(|(k, v)| {
            (
                k,
                SessionTimestamps {
                    session_id: v.session_id,
                    started_at: v.started_at,
                    ended_at: v.ended_at,
                },
            )
        })
        .collect())
}

/// Search messages using FTS
#[napi]
pub fn search_messages(
    _db_path: String,
    query: String,
    session_id: Option<String>,
    limit: Option<u32>,
) -> napi::Result<Vec<Message>> {
    crud::search_messages(&query, session_id, limit)
}

// ============================================================================
// Task Operations (Metrics)
// ============================================================================

/// Create a new task record
#[napi]
pub fn create_task(_db_path: String, input: TaskInput) -> napi::Result<Task> {
    crud::create_task(input)
}

/// Mark a task as completed with outcome
#[napi]
pub fn complete_task(_db_path: String, completion: TaskCompletion) -> napi::Result<Task> {
    crud::complete_task(completion)
}

/// Mark a task as failed
#[napi]
pub fn fail_task(_db_path: String, failure: TaskFailure) -> napi::Result<Task> {
    crud::fail_task(failure)
}

/// Get a task by ID
#[napi]
pub fn get_task(_db_path: String, task_id: String) -> napi::Result<Option<Task>> {
    crud::get_task(&task_id)
}

/// Query task metrics with optional filters
#[napi]
pub fn query_task_metrics(
    _db_path: String,
    task_type: Option<String>,
    outcome: Option<String>,
    period: Option<String>,
) -> napi::Result<TaskMetrics> {
    crud::query_task_metrics(task_type, outcome, period)
}

// ============================================================================
// NOTE: Hook Cache Operations removed - replaced by session_file_validations
// NOTE: Marketplace Cache Operations removed - not used
// ============================================================================

// ============================================================================
// Hook Execution Operations
// ============================================================================

/// Record a hook execution
#[napi]
pub fn record_hook_execution(
    _db_path: String,
    input: HookExecutionInput,
) -> napi::Result<HookExecution> {
    crud::record_hook_execution(input)
}

/// Query hook statistics
#[napi]
pub fn query_hook_stats(_db_path: String, period: Option<String>) -> napi::Result<HookStats> {
    crud::query_hook_stats(period)
}

// ============================================================================
// Orchestration Operations (group hook executions by orchestrate run)
// ============================================================================

/// Create a new orchestration, cancelling any existing running orchestration for the same session
#[napi]
pub fn create_orchestration(input: OrchestrationInput) -> napi::Result<Orchestration> {
    crud::create_orchestration(input)
}

/// Get an orchestration by ID
#[napi]
pub fn get_orchestration(id: String) -> napi::Result<Option<Orchestration>> {
    crud::get_orchestration(id)
}

/// Update an orchestration's counters and status
#[napi]
pub fn update_orchestration(update: OrchestrationUpdate) -> napi::Result<()> {
    crud::update_orchestration(update)
}

/// Cancel an orchestration and all its pending/running hooks
#[napi]
pub fn cancel_orchestration(id: String) -> napi::Result<()> {
    crud::cancel_orchestration(id)
}

/// Get all hooks for an orchestration
#[napi]
pub fn get_orchestration_hooks(orchestration_id: String) -> napi::Result<Vec<HookExecution>> {
    crud::get_orchestration_hooks(orchestration_id)
}

// ============================================================================
// Pending Hooks Queue (for --check mode orchestrations)
// ============================================================================

/// Queue a hook for later execution during --wait
#[napi]
pub fn queue_hook(input: QueuedHookInput) -> napi::Result<String> {
    crud::queue_hook(input)
}

/// Get all queued hooks for an orchestration
#[napi]
pub fn get_queued_hooks(orchestration_id: String) -> napi::Result<Vec<QueuedHook>> {
    crud::get_queued_hooks(orchestration_id)
}

/// Delete queued hooks after they've been executed
#[napi]
pub fn delete_queued_hooks(orchestration_id: String) -> napi::Result<u32> {
    crud::delete_queued_hooks(orchestration_id)
}

// ============================================================================
// Deferred Hook Operations (for background execution)
// ============================================================================

/// Queue a pending hook for background execution
#[napi]
pub fn queue_pending_hook(input: PendingHookInput) -> napi::Result<String> {
    crud::queue_pending_hook(input)
}

/// Get all pending hooks ready to run
#[napi]
pub fn get_pending_hooks() -> napi::Result<Vec<HookExecution>> {
    crud::get_pending_hooks()
}

/// Get pending/running/failed hooks for a specific session
#[napi]
pub fn get_session_pending_hooks(session_id: String) -> napi::Result<Vec<HookExecution>> {
    crud::get_session_pending_hooks(session_id)
}

/// Update hook execution status
#[napi]
pub fn update_hook_status(id: String, status: String) -> napi::Result<()> {
    crud::update_hook_status(id, status)
}

/// Complete a hook execution
#[napi]
pub fn complete_hook_execution(
    id: String,
    success: bool,
    output: Option<String>,
    error: Option<String>,
    duration_ms: i32,
) -> napi::Result<()> {
    crud::complete_hook_execution(id, success, output, error, duration_ms)
}

/// Mark a hook as failed with an error message
#[napi]
pub fn fail_hook_execution(id: String, error_message: String) -> napi::Result<()> {
    crud::fail_hook_execution(id, error_message)
}

// ============================================================================
// Hook Attempt Tracking (for deferred execution)
// ============================================================================

/// Get or create hook attempt info for tracking consecutive failures
#[napi]
pub fn get_or_create_hook_attempt(
    session_id: String,
    plugin: String,
    hook_name: String,
    directory: String,
) -> napi::Result<HookAttemptInfo> {
    crud::get_or_create_hook_attempt(session_id, plugin, hook_name, directory)
}

/// Increment consecutive_failures for a hook
#[napi]
pub fn increment_hook_failures(
    session_id: String,
    plugin: String,
    hook_name: String,
    directory: String,
) -> napi::Result<HookAttemptInfo> {
    crud::increment_hook_failures(session_id, plugin, hook_name, directory)
}

/// Reset consecutive_failures to 0 (on success)
#[napi]
pub fn reset_hook_failures(
    session_id: String,
    plugin: String,
    hook_name: String,
    directory: String,
) -> napi::Result<()> {
    crud::reset_hook_failures(session_id, plugin, hook_name, directory)
}

/// Increase max_attempts for a hook (user override via MCP tool)
#[napi]
pub fn increase_hook_max_attempts(
    session_id: String,
    plugin: String,
    hook_name: String,
    directory: String,
    increase: i32,
) -> napi::Result<()> {
    crud::increase_hook_max_attempts(session_id, plugin, hook_name, directory, increase)
}

// ============================================================================
// Frustration Event Operations
// ============================================================================

/// Record a frustration event
#[napi]
pub fn record_frustration(
    _db_path: String,
    input: FrustrationEventInput,
) -> napi::Result<FrustrationEvent> {
    crud::record_frustration(input)
}

/// Query frustration metrics
#[napi]
pub fn query_frustration_metrics(
    _db_path: String,
    period: Option<String>,
    total_tasks: i64,
) -> napi::Result<FrustrationMetrics> {
    crud::query_frustration_metrics(period, total_tasks)
}

// ============================================================================
// NOTE: Checkpoint Operations removed - not used
// ============================================================================

// ============================================================================
// Session File Change Operations
// ============================================================================

/// Record a file change in a session
#[napi]
pub fn record_file_change(
    _db_path: String,
    input: SessionFileChangeInput,
) -> napi::Result<SessionFileChange> {
    crud::record_file_change(input)
}

/// Get file changes for a session, optionally filtered by agent_id
#[napi]
pub fn get_session_file_changes(
    _db_path: String,
    session_id: String,
    agent_id: Option<String>,
) -> napi::Result<Vec<SessionFileChange>> {
    crud::get_session_file_changes(&session_id, agent_id.as_deref())
}

/// Check if a session has any file changes, optionally filtered by agent_id
#[napi]
pub fn has_session_changes(
    _db_path: String,
    session_id: String,
    agent_id: Option<String>,
) -> napi::Result<bool> {
    crud::has_session_changes(&session_id, agent_id.as_deref())
}

// ============================================================================
// Session File Validation Operations
// ============================================================================

/// Record a file validation (upserts based on session/file/plugin/hook)
#[napi]
pub fn record_file_validation(
    _db_path: String,
    input: SessionFileValidationInput,
) -> napi::Result<SessionFileValidation> {
    crud::record_file_validation(input)
}

/// Get a specific file validation
#[napi]
pub fn get_file_validation(
    _db_path: String,
    session_id: String,
    file_path: String,
    plugin_name: String,
    hook_name: String,
    directory: String,
) -> napi::Result<Option<SessionFileValidation>> {
    crud::get_file_validation(
        &session_id,
        &file_path,
        &plugin_name,
        &hook_name,
        &directory,
    )
}

/// Get all validations for a session and plugin/hook/directory combo
#[napi]
pub fn get_session_validations(
    _db_path: String,
    session_id: String,
    plugin_name: String,
    hook_name: String,
    directory: String,
) -> napi::Result<Vec<SessionFileValidation>> {
    crud::get_session_validations(&session_id, &plugin_name, &hook_name, &directory)
}

/// Check if files need validation (any changed since last validation or command changed)
#[napi]
pub fn needs_validation(
    _db_path: String,
    session_id: String,
    plugin_name: String,
    hook_name: String,
    directory: String,
    command_hash: String,
) -> napi::Result<bool> {
    crud::needs_validation(
        &session_id,
        &plugin_name,
        &hook_name,
        &directory,
        &command_hash,
    )
}

/// Get ALL file validations for a session (not filtered by plugin/hook)
/// Useful for showing validation status across all hooks for file changes
#[napi]
pub fn get_all_session_validations(
    _db_path: String,
    session_id: String,
) -> napi::Result<Vec<SessionFileValidation>> {
    crud::get_all_session_validations(&session_id)
}

/// Get files this session modified along with their validation status.
/// Used for stale detection: compare current disk hash against modification_hash
/// and validation_hash to determine if validation is needed.
#[napi]
pub fn get_files_for_validation(
    _db_path: String,
    session_id: String,
    plugin_name: String,
    hook_name: String,
    directory: String,
) -> napi::Result<Vec<FileValidationStatus>> {
    crud::get_files_for_validation(&session_id, &plugin_name, &hook_name, &directory)
}

/// Delete stale validation records for files that no longer exist.
/// This prevents "ghost" validations from causing infinite re-validation loops.
#[napi]
pub fn delete_stale_validations(
    _db_path: String,
    session_id: String,
    plugin_name: String,
    hook_name: String,
    directory: String,
    current_file_paths: Vec<String>,
) -> napi::Result<u32> {
    crud::delete_stale_validations(
        &session_id,
        &plugin_name,
        &hook_name,
        &directory,
        current_file_paths,
    )
}

// ============================================================================
// Session Summary Operations (event-sourced)
// ============================================================================

/// Upsert a session summary (keeps the latest by timestamp)
#[napi]
pub fn upsert_session_summary(
    _db_path: String,
    input: SessionSummaryInput,
) -> napi::Result<SessionSummary> {
    crud::upsert_session_summary(input)
}

/// Get session summary by session ID
#[napi]
pub fn get_session_summary(
    _db_path: String,
    session_id: String,
) -> napi::Result<Option<SessionSummary>> {
    crud::get_session_summary(&session_id)
}

// ============================================================================
// Session Compact Operations (event-sourced)
// ============================================================================

/// Upsert a session compact (keeps the latest by timestamp)
#[napi]
pub fn upsert_session_compact(
    _db_path: String,
    input: SessionCompactInput,
) -> napi::Result<SessionCompact> {
    crud::upsert_session_compact(input)
}

/// Get session compact by session ID
#[napi]
pub fn get_session_compact(
    _db_path: String,
    session_id: String,
) -> napi::Result<Option<SessionCompact>> {
    crud::get_session_compact(&session_id)
}

/// Upsert session todos (keeps the latest by timestamp)
#[napi]
pub fn upsert_session_todos(
    _db_path: String,
    input: SessionTodosInput,
) -> napi::Result<SessionTodos> {
    crud::upsert_session_todos(input)
}

/// Get session todos by session ID
#[napi]
pub fn get_session_todos(
    _db_path: String,
    session_id: String,
) -> napi::Result<Option<SessionTodos>> {
    crud::get_session_todos(&session_id)
}

// ============================================================================
// Generated Session Summary Functions (LLM-analyzed summaries)
// ============================================================================

/// Upsert a generated session summary (creates or updates based on session_id)
#[napi]
pub fn upsert_generated_summary(
    _db_path: String,
    input: GeneratedSessionSummaryInput,
) -> napi::Result<GeneratedSessionSummary> {
    crud::upsert_generated_summary(input)
}

/// Get generated summary by session ID
#[napi]
pub fn get_generated_summary(
    _db_path: String,
    session_id: String,
) -> napi::Result<Option<GeneratedSessionSummary>> {
    crud::get_generated_summary(&session_id)
}

/// Search generated summaries using FTS
#[napi]
pub fn search_generated_summaries(
    _db_path: String,
    query: String,
    limit: Option<u32>,
) -> napi::Result<Vec<GeneratedSessionSummary>> {
    crud::search_generated_summaries(&query, limit)
}

/// List sessions that don't have generated summaries yet
/// Returns session IDs ordered by most recent first
#[napi]
pub fn list_sessions_without_summaries(
    _db_path: String,
    limit: Option<u32>,
) -> napi::Result<Vec<String>> {
    crud::list_sessions_without_summaries(limit)
}

// ============================================================================
// Native Task Functions (Claude Code's built-in task system)
// ============================================================================

/// Get all native tasks for a session
#[napi]
pub fn get_session_native_tasks(
    _db_path: String,
    session_id: String,
) -> napi::Result<Vec<NativeTask>> {
    crud::get_session_native_tasks(&session_id)
}

/// Get a specific native task by session ID and task ID
#[napi]
pub fn get_native_task(
    _db_path: String,
    session_id: String,
    task_id: String,
) -> napi::Result<Option<NativeTask>> {
    crud::get_native_task(&session_id, &task_id)
}

// ============================================================================
// Coordinator Functions (Lock File Mechanism)
// ============================================================================

// Re-export coordinator types
pub use coordinator::{CoordinatorStatus, LockInfo};

/// Try to acquire the coordinator lock (single-instance indexer pattern)
#[napi]
pub fn try_acquire_coordinator_lock() -> napi::Result<bool> {
    coordinator::try_acquire_coordinator_lock()
}

/// Release the coordinator lock
#[napi]
pub fn release_coordinator_lock() -> napi::Result<bool> {
    coordinator::release_coordinator_lock()
}

/// Update coordinator heartbeat (call periodically while coordinating)
#[napi]
pub fn update_coordinator_heartbeat() -> napi::Result<bool> {
    coordinator::update_coordinator_heartbeat()
}

/// Get current coordinator status
#[napi]
pub fn get_coordinator_status() -> napi::Result<coordinator::CoordinatorStatus> {
    coordinator::get_coordinator_status()
}

/// Check if this process is the coordinator
#[napi]
pub fn is_coordinator() -> bool {
    coordinator::is_coordinator()
}

/// Get the heartbeat interval in seconds
#[napi]
pub fn get_heartbeat_interval() -> u32 {
    coordinator::get_heartbeat_interval()
}

/// Get the stale lock timeout in seconds
#[napi]
pub fn get_stale_lock_timeout() -> u32 {
    coordinator::get_stale_lock_timeout()
}

/// Clean up a stale coordinator lock file
/// Returns true if a stale lock was cleaned up, false otherwise
#[napi]
pub fn cleanup_stale_coordinator_lock() -> napi::Result<bool> {
    coordinator::cleanup_stale_coordinator_lock()
}

// ============================================================================
// File Watcher Functions
// ============================================================================

// Re-export watcher types and functions (they have #[napi] in watcher.rs)
pub use watcher::{
    add_watch_path, clear_index_callback, get_default_watch_path, get_watched_paths,
    is_watcher_running, poll_index_results, remove_watch_path, set_index_callback,
    start_file_watcher, stop_file_watcher, FileEvent, FileEventType,
};

// ============================================================================
// Session Indexer Functions (JSONL → SQLite)
// ============================================================================

// Re-export indexer types
pub use indexer::IndexResult;

/// Index a single JSONL session file incrementally
/// Only processes lines after the last indexed line
/// Task association for sentiment events is loaded from SQLite automatically
#[napi]
pub fn index_session_file(
    _db_path: String,
    file_path: String,
    source_config_dir: Option<String>,
) -> napi::Result<indexer::IndexResult> {
    indexer::index_session_file(file_path, source_config_dir)
}

/// Index all JSONL files in a project directory
#[napi]
pub fn index_project_directory(
    _db_path: String,
    project_dir: String,
    source_config_dir: Option<String>,
) -> napi::Result<Vec<indexer::IndexResult>> {
    indexer::index_project_directory(project_dir, source_config_dir)
}

/// Handle a file event from the watcher (coordinator use only)
#[napi]
pub fn handle_file_event(
    _db_path: String,
    event_type: watcher::FileEventType,
    file_path: String,
    session_id: Option<String>,
    project_path: Option<String>,
) -> napi::Result<Option<indexer::IndexResult>> {
    indexer::handle_file_event(event_type, file_path, session_id, project_path)
}

/// Perform a full scan and index of all Claude Code sessions
/// Should be called on coordinator startup
#[napi]
pub fn full_scan_and_index(_db_path: String) -> napi::Result<Vec<indexer::IndexResult>> {
    indexer::full_scan_and_index()
}

// ============================================================================
// Git Utility Functions (using gitoxide - pure Rust)
// ============================================================================

// Re-export git types and functions from git module
pub use git::{
    get_git_branch, get_git_common_dir, get_git_info, get_git_remote_url, get_git_root,
    git_create_branch, git_diff_stat, git_log, git_ls_files, git_show_file, git_worktree_add,
    git_worktree_list, git_worktree_remove, GitDiffStat, GitInfo, GitLogEntry, GitWorktree,
};

// ============================================================================
// Async Hook Queue Functions (for PostToolUse async hook execution)
// ============================================================================

// Re-export async hook queue types
pub use crud::{AsyncHookQueueEntry, AsyncHookQueueInputNative};

/// Enqueue a hook for async execution
/// First cancels any pending hooks with the same dedup key and merges file paths
#[napi]
pub fn enqueue_async_hook(
    db_path: String,
    input: AsyncHookQueueInputNative,
) -> napi::Result<String> {
    crud::enqueue_async_hook(db_path, input)
}

/// List pending async hooks for a session
#[napi]
pub fn list_pending_async_hooks(
    db_path: String,
    session_id: String,
) -> napi::Result<Vec<AsyncHookQueueEntry>> {
    crud::list_pending_async_hooks(db_path, session_id)
}

/// Check if the async hook queue is empty for a session
#[napi]
pub fn is_async_hook_queue_empty(db_path: String, session_id: String) -> napi::Result<bool> {
    crud::is_async_hook_queue_empty(db_path, session_id)
}

/// Drain the queue - get all pending hooks and mark as running
#[napi]
pub fn drain_async_hook_queue(
    db_path: String,
    session_id: String,
) -> napi::Result<Vec<AsyncHookQueueEntry>> {
    crud::drain_async_hook_queue(db_path, session_id)
}

/// Cancel pending hooks matching dedup key and return merged file paths
#[napi]
pub fn cancel_pending_async_hooks(
    db_path: String,
    session_id: String,
    cwd: String,
    plugin: String,
    hook_name: String,
) -> napi::Result<Vec<String>> {
    crud::cancel_pending_async_hooks(db_path, session_id, cwd, plugin, hook_name)
}

/// Complete an async hook execution
#[napi]
pub fn complete_async_hook(
    db_path: String,
    id: String,
    success: bool,
    result: Option<String>,
    error: Option<String>,
) -> napi::Result<()> {
    crud::complete_async_hook(db_path, id, success, result, error)
}

/// Cancel a specific async hook by ID
#[napi]
pub fn cancel_async_hook(db_path: String, id: String) -> napi::Result<()> {
    crud::cancel_async_hook(db_path, id)
}

/// Clear all async hooks for a session (used on SessionEnd to clean up)
/// Returns the number of hooks that were cleared
#[napi]
pub fn clear_async_hook_queue_for_session(
    db_path: String,
    session_id: String,
) -> napi::Result<u32> {
    crud::clear_async_hook_queue_for_session(db_path, session_id)
}

// ============================================================================
// Dashboard SQL Aggregation Functions
// ============================================================================

// Re-export aggregate result types
pub use schema::{
    ActivityAggregates, DailyActivityRow, DailyCostRow, DashboardAggregates, HookHealthRow,
    HourlyActivityRow, SessionCompactionRow, SessionSentimentRow, SessionStatsRow,
    SubagentUsageRow, ToolUsageRow,
};

/// Query all dashboard analytics via SQL aggregation (replaces ~850 DB round-trips)
#[napi]
pub fn query_dashboard_aggregates(
    _db_path: String,
    cutoff_date: String,
) -> napi::Result<DashboardAggregates> {
    crud::query_dashboard_aggregates(&cutoff_date)
}

/// Query all activity data via SQL aggregation (replaces ~425 DB round-trips)
#[napi]
pub fn query_activity_aggregates(
    _db_path: String,
    cutoff_date: String,
) -> napi::Result<ActivityAggregates> {
    crud::query_activity_aggregates(&cutoff_date)
}

// ============================================================================
// Database Reset Functions
// ============================================================================

/// Truncate all derived tables (those populated from JSONL logs).
/// This is used during reindex to rebuild the database from scratch.
/// Preserves: repos, projects (discovered from disk/git, not from logs)
/// Returns: Number of rows deleted across all tables
#[napi]
pub fn truncate_derived_tables(_db_path: String) -> napi::Result<u32> {
    crud::truncate_derived_tables()
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::env;
    use std::fs::{self, File};
    use std::io::Write;
    use std::path::PathBuf;

    /// Create a temporary test directory with a unique name
    fn setup_test_dir(prefix: &str) -> PathBuf {
        let test_dir = env::temp_dir().join(format!(
            "han-native-test-{}-{}-{}",
            prefix,
            std::process::id(),
            std::time::SystemTime::now()
                .duration_since(std::time::UNIX_EPOCH)
                .unwrap()
                .as_nanos()
        ));
        fs::create_dir_all(&test_dir).expect("Failed to create test directory");
        test_dir
    }

    /// Cleanup a test directory
    fn cleanup_test_dir(path: &PathBuf) {
        let _ = fs::remove_dir_all(path);
    }

    // ============================================================================
    // File Hash Tests
    // ============================================================================

    #[test]
    fn test_compute_file_hash_valid_file() {
        let test_dir = setup_test_dir("hash-valid");
        let file_path = test_dir.join("test.txt");

        // Create a file with known content
        let mut file = File::create(&file_path).expect("Failed to create test file");
        file.write_all(b"hello world")
            .expect("Failed to write to test file");
        drop(file);

        let hash = compute_file_hash(file_path.to_string_lossy().to_string());

        // SHA256 of "hello world" is well-known
        assert_eq!(
            hash,
            "b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9"
        );

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_compute_file_hash_empty_file() {
        let test_dir = setup_test_dir("hash-empty");
        let file_path = test_dir.join("empty.txt");

        File::create(&file_path).expect("Failed to create empty file");

        let hash = compute_file_hash(file_path.to_string_lossy().to_string());

        // SHA256 of empty string
        assert_eq!(
            hash,
            "e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855"
        );

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_compute_file_hash_nonexistent_file() {
        let hash = compute_file_hash("/nonexistent/path/to/file.txt".to_string());
        assert_eq!(hash, ""); // Returns empty string for non-existent files
    }

    #[test]
    fn test_compute_file_hash_large_file() {
        let test_dir = setup_test_dir("hash-large");
        let file_path = test_dir.join("large.bin");

        // Create a file larger than the internal buffer (8192 bytes)
        let mut file = File::create(&file_path).expect("Failed to create large file");
        let data: Vec<u8> = (0..=255).cycle().take(20000).collect();
        file.write_all(&data).expect("Failed to write large file");
        drop(file);

        let hash = compute_file_hash(file_path.to_string_lossy().to_string());

        // Should produce a valid 64-character hex hash
        assert_eq!(hash.len(), 64);
        assert!(hash.chars().all(|c| c.is_ascii_hexdigit()));

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_compute_file_hashes_parallel_multiple_files() {
        let test_dir = setup_test_dir("hash-parallel");

        // Create multiple test files
        let mut paths = Vec::new();
        for i in 0..5 {
            let file_path = test_dir.join(format!("file{}.txt", i));
            let mut file = File::create(&file_path).expect("Failed to create file");
            file.write_all(format!("content {}", i).as_bytes())
                .expect("Failed to write");
            paths.push(file_path.to_string_lossy().to_string());
        }

        let hashes = compute_file_hashes_parallel(paths.clone());

        // Should have all files
        assert_eq!(hashes.len(), 5);

        // Each hash should be valid and unique
        let unique_hashes: std::collections::HashSet<_> = hashes.values().collect();
        assert_eq!(unique_hashes.len(), 5);

        // Each hash should be 64 hex characters
        for hash in hashes.values() {
            assert_eq!(hash.len(), 64);
        }

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_compute_file_hashes_parallel_empty_input() {
        let hashes = compute_file_hashes_parallel(Vec::new());
        assert!(hashes.is_empty());
    }

    #[test]
    fn test_compute_file_hashes_parallel_mixed_existence() {
        let test_dir = setup_test_dir("hash-mixed");

        let valid_path = test_dir.join("exists.txt");
        let mut file = File::create(&valid_path).expect("Failed to create file");
        file.write_all(b"test").expect("Failed to write");
        drop(file);

        let paths = vec![
            valid_path.to_string_lossy().to_string(),
            "/nonexistent/file.txt".to_string(),
        ];

        let hashes = compute_file_hashes_parallel(paths);

        assert_eq!(hashes.len(), 2);
        assert!(!hashes
            .get(&valid_path.to_string_lossy().to_string())
            .unwrap()
            .is_empty());
        assert_eq!(hashes.get("/nonexistent/file.txt").unwrap(), "");

        cleanup_test_dir(&test_dir);
    }

    // ============================================================================
    // Glob/File Finding Tests
    // ============================================================================

    #[test]
    fn test_find_files_with_glob_basic() {
        let test_dir = setup_test_dir("glob-basic");

        // Create some test files
        File::create(test_dir.join("file1.txt")).unwrap();
        File::create(test_dir.join("file2.txt")).unwrap();
        File::create(test_dir.join("file3.rs")).unwrap();

        let results = find_files_with_glob(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string()],
        );

        assert_eq!(results.len(), 2);
        assert!(results.iter().all(|p| p.ends_with(".txt")));

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_find_files_with_glob_nested() {
        let test_dir = setup_test_dir("glob-nested");

        // Create nested structure
        let sub_dir = test_dir.join("subdir");
        fs::create_dir_all(&sub_dir).unwrap();

        File::create(test_dir.join("root.txt")).unwrap();
        File::create(sub_dir.join("nested.txt")).unwrap();

        let results = find_files_with_glob(
            test_dir.to_string_lossy().to_string(),
            vec!["**/*.txt".to_string()],
        );

        assert_eq!(results.len(), 2);

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_find_files_with_glob_multiple_patterns() {
        let test_dir = setup_test_dir("glob-multi");

        File::create(test_dir.join("file.txt")).unwrap();
        File::create(test_dir.join("file.rs")).unwrap();
        File::create(test_dir.join("file.md")).unwrap();

        let results = find_files_with_glob(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string(), "*.rs".to_string()],
        );

        assert_eq!(results.len(), 2);

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_find_files_with_glob_nonexistent_dir() {
        let results = find_files_with_glob(
            "/nonexistent/directory".to_string(),
            vec!["*.txt".to_string()],
        );

        assert!(results.is_empty());
    }

    #[test]
    fn test_find_files_with_glob_empty_patterns() {
        let test_dir = setup_test_dir("glob-empty");
        File::create(test_dir.join("file.txt")).unwrap();

        let results = find_files_with_glob(test_dir.to_string_lossy().to_string(), Vec::new());

        assert!(results.is_empty());

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_find_files_with_glob_no_matches() {
        let test_dir = setup_test_dir("glob-nomatch");
        File::create(test_dir.join("file.txt")).unwrap();

        let results = find_files_with_glob(
            test_dir.to_string_lossy().to_string(),
            vec!["*.xyz".to_string()],
        );

        assert!(results.is_empty());

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_find_directories_with_markers_basic() {
        let test_dir = setup_test_dir("markers-basic");

        // Create a directory with a package.json marker
        let proj_dir = test_dir.join("my-project");
        fs::create_dir_all(&proj_dir).unwrap();
        File::create(proj_dir.join("package.json")).unwrap();

        let results = find_directories_with_markers(
            test_dir.to_string_lossy().to_string(),
            vec!["package.json".to_string()],
        );

        assert_eq!(results.len(), 1);
        assert!(results[0].ends_with("my-project"));

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_find_directories_with_markers_nested() {
        let test_dir = setup_test_dir("markers-nested");

        // Create nested project structure
        let proj1 = test_dir.join("proj1");
        let proj2 = test_dir.join("level1").join("proj2");

        fs::create_dir_all(&proj1).unwrap();
        fs::create_dir_all(&proj2).unwrap();

        File::create(proj1.join("Cargo.toml")).unwrap();
        File::create(proj2.join("Cargo.toml")).unwrap();

        let results = find_directories_with_markers(
            test_dir.to_string_lossy().to_string(),
            vec!["Cargo.toml".to_string()],
        );

        assert_eq!(results.len(), 2);

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_find_directories_with_markers_multiple_markers() {
        let test_dir = setup_test_dir("markers-multi");

        let npm_proj = test_dir.join("npm-proj");
        let cargo_proj = test_dir.join("cargo-proj");

        fs::create_dir_all(&npm_proj).unwrap();
        fs::create_dir_all(&cargo_proj).unwrap();

        File::create(npm_proj.join("package.json")).unwrap();
        File::create(cargo_proj.join("Cargo.toml")).unwrap();

        let results = find_directories_with_markers(
            test_dir.to_string_lossy().to_string(),
            vec!["package.json".to_string(), "Cargo.toml".to_string()],
        );

        assert_eq!(results.len(), 2);

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_find_directories_with_markers_directory_marker() {
        let test_dir = setup_test_dir("markers-dir");

        // Create a directory with a .git directory marker
        let repo_dir = test_dir.join("my-repo");
        let git_dir = repo_dir.join(".git");

        fs::create_dir_all(&git_dir).unwrap();

        // Note: .git directories are filtered out by WalkBuilder
        // This tests the directory marker pattern
        let results = find_directories_with_markers(
            test_dir.to_string_lossy().to_string(),
            vec!["node_modules".to_string()],
        );

        // Should not find anything since we didn't create node_modules
        assert!(results.is_empty());

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_find_directories_with_markers_nonexistent_dir() {
        let results = find_directories_with_markers(
            "/nonexistent/directory".to_string(),
            vec!["package.json".to_string()],
        );

        assert!(results.is_empty());
    }

    // ============================================================================
    // Manifest Tests
    // ============================================================================

    #[test]
    fn test_build_manifest_basic() {
        let test_dir = setup_test_dir("manifest-basic");

        let file1 = test_dir.join("file1.txt");
        let file2 = test_dir.join("file2.txt");

        let mut f1 = File::create(&file1).unwrap();
        f1.write_all(b"content 1").unwrap();

        let mut f2 = File::create(&file2).unwrap();
        f2.write_all(b"content 2").unwrap();

        let files = vec![
            file1.to_string_lossy().to_string(),
            file2.to_string_lossy().to_string(),
        ];

        let manifest = build_manifest(files, test_dir.to_string_lossy().to_string());

        assert_eq!(manifest.len(), 2);
        assert!(manifest.contains_key("file1.txt"));
        assert!(manifest.contains_key("file2.txt"));

        // Hashes should be 64-char hex strings
        for hash in manifest.values() {
            assert_eq!(hash.len(), 64);
        }

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_build_manifest_nested_files() {
        let test_dir = setup_test_dir("manifest-nested");

        let sub_dir = test_dir.join("subdir");
        fs::create_dir_all(&sub_dir).unwrap();

        let file1 = test_dir.join("root.txt");
        let file2 = sub_dir.join("nested.txt");

        File::create(&file1).unwrap();
        File::create(&file2).unwrap();

        let files = vec![
            file1.to_string_lossy().to_string(),
            file2.to_string_lossy().to_string(),
        ];

        let manifest = build_manifest(files, test_dir.to_string_lossy().to_string());

        assert_eq!(manifest.len(), 2);
        assert!(manifest.contains_key("root.txt"));
        assert!(manifest.contains_key("subdir/nested.txt"));

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_build_manifest_empty_files() {
        let test_dir = setup_test_dir("manifest-empty");
        let manifest = build_manifest(Vec::new(), test_dir.to_string_lossy().to_string());
        assert!(manifest.is_empty());
        cleanup_test_dir(&test_dir);
    }

    // ============================================================================
    // Has Changes Tests
    // ============================================================================

    #[test]
    fn test_has_changes_empty_cache() {
        let test_dir = setup_test_dir("changes-empty");
        File::create(test_dir.join("file.txt")).unwrap();

        let result = has_changes(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string()],
            HashMap::new(),
        );

        assert!(result); // Empty cache = always has changes

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_has_changes_no_changes() {
        let test_dir = setup_test_dir("changes-none");

        let file_path = test_dir.join("file.txt");
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"content").unwrap();
        drop(file);

        // Build cache with current state
        let files = vec![file_path.to_string_lossy().to_string()];
        let cache = build_manifest(files, test_dir.to_string_lossy().to_string());

        let result = has_changes(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string()],
            cache,
        );

        assert!(!result); // Same content = no changes

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_has_changes_content_modified() {
        let test_dir = setup_test_dir("changes-modified");

        let file_path = test_dir.join("file.txt");
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"original").unwrap();
        drop(file);

        // Build cache with original state
        let files = vec![file_path.to_string_lossy().to_string()];
        let cache = build_manifest(files, test_dir.to_string_lossy().to_string());

        // Modify the file
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"modified").unwrap();
        drop(file);

        let result = has_changes(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string()],
            cache,
        );

        assert!(result); // Content changed

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_has_changes_file_added() {
        let test_dir = setup_test_dir("changes-added");

        let file_path = test_dir.join("file1.txt");
        File::create(&file_path).unwrap();

        // Build cache with original file
        let files = vec![file_path.to_string_lossy().to_string()];
        let cache = build_manifest(files, test_dir.to_string_lossy().to_string());

        // Add a new file
        File::create(test_dir.join("file2.txt")).unwrap();

        let result = has_changes(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string()],
            cache,
        );

        assert!(result); // New file added

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_has_changes_file_deleted() {
        let test_dir = setup_test_dir("changes-deleted");

        let file1 = test_dir.join("file1.txt");
        let file2 = test_dir.join("file2.txt");
        File::create(&file1).unwrap();
        File::create(&file2).unwrap();

        // Build cache with both files
        let files = vec![
            file1.to_string_lossy().to_string(),
            file2.to_string_lossy().to_string(),
        ];
        let cache = build_manifest(files, test_dir.to_string_lossy().to_string());

        // Delete one file
        fs::remove_file(&file2).unwrap();

        let result = has_changes(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string()],
            cache,
        );

        assert!(result); // File deleted

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_has_changes_nonexistent_dir() {
        let result = has_changes(
            "/nonexistent/directory".to_string(),
            vec!["*.txt".to_string()],
            HashMap::from([("file.txt".to_string(), "abc123".to_string())]),
        );

        assert!(result); // Nonexistent dir = has changes (error case)
    }

    // ============================================================================
    // Check and Build Manifest Tests
    // ============================================================================

    #[test]
    fn test_check_and_build_manifest_no_cache() {
        let test_dir = setup_test_dir("check-nocache");

        let file_path = test_dir.join("file.txt");
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"content").unwrap();
        drop(file);

        let result = check_and_build_manifest(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string()],
            None,
        );

        assert!(result.has_changes);
        assert_eq!(result.manifest.len(), 1);
        assert_eq!(result.files.len(), 1);

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_check_and_build_manifest_with_cache_no_changes() {
        let test_dir = setup_test_dir("check-cache-nochange");

        let file_path = test_dir.join("file.txt");
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"content").unwrap();
        drop(file);

        // Build initial manifest
        let initial = check_and_build_manifest(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string()],
            None,
        );

        // Check with same manifest
        let result = check_and_build_manifest(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string()],
            Some(initial.manifest),
        );

        assert!(!result.has_changes);

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_check_and_build_manifest_with_changes() {
        let test_dir = setup_test_dir("check-cache-change");

        let file_path = test_dir.join("file.txt");
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"original").unwrap();
        drop(file);

        // Build initial manifest
        let initial = check_and_build_manifest(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string()],
            None,
        );

        // Modify file
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"modified").unwrap();
        drop(file);

        // Check with old manifest
        let result = check_and_build_manifest(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string()],
            Some(initial.manifest),
        );

        assert!(result.has_changes);

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_check_and_build_manifest_nonexistent_dir() {
        let result = check_and_build_manifest(
            "/nonexistent/directory".to_string(),
            vec!["*.txt".to_string()],
            None,
        );

        assert!(result.has_changes);
        assert!(result.manifest.is_empty());
        assert!(result.files.is_empty());
    }

    #[test]
    fn test_check_and_build_manifest_invalid_glob() {
        let test_dir = setup_test_dir("check-badglob");
        File::create(test_dir.join("file.txt")).unwrap();

        // Empty patterns should produce valid result with empty manifest
        let result =
            check_and_build_manifest(test_dir.to_string_lossy().to_string(), Vec::new(), None);

        assert!(result.has_changes);
        assert!(result.manifest.is_empty());

        cleanup_test_dir(&test_dir);
    }

    // ============================================================================
    // CheckResult Struct Tests
    // ============================================================================

    #[test]
    fn test_check_result_fields() {
        let result = CheckResult {
            has_changes: true,
            manifest: HashMap::from([("file.txt".to_string(), "hash123".to_string())]),
            files: vec!["/path/to/file.txt".to_string()],
        };

        assert!(result.has_changes);
        assert_eq!(result.manifest.len(), 1);
        assert_eq!(result.files.len(), 1);
    }

    // ============================================================================
    // VectorDocumentInput Tests
    // ============================================================================

    #[test]
    fn test_vector_document_input_construction() {
        let doc = VectorDocumentInput {
            id: "doc-1".to_string(),
            content: "test content".to_string(),
            vector: vec![0.1, 0.2, 0.3],
            metadata: Some(r#"{"key": "value"}"#.to_string()),
        };

        assert_eq!(doc.id, "doc-1");
        assert_eq!(doc.content, "test content");
        assert_eq!(doc.vector.len(), 3);
        assert!(doc.metadata.is_some());
    }

    #[test]
    fn test_vector_document_input_no_metadata() {
        let doc = VectorDocumentInput {
            id: "doc-2".to_string(),
            content: "test".to_string(),
            vector: vec![0.5],
            metadata: None,
        };

        assert!(doc.metadata.is_none());
    }

    // ============================================================================
    // SessionTimestamps Tests
    // ============================================================================

    #[test]
    fn test_session_timestamps_construction() {
        let ts = SessionTimestamps {
            session_id: "session-123".to_string(),
            started_at: Some("2024-01-01T00:00:00Z".to_string()),
            ended_at: Some("2024-01-01T01:00:00Z".to_string()),
        };

        assert_eq!(ts.session_id, "session-123");
        assert!(ts.started_at.is_some());
        assert!(ts.ended_at.is_some());
    }

    #[test]
    fn test_session_timestamps_partial() {
        let ts = SessionTimestamps {
            session_id: "session-456".to_string(),
            started_at: Some("2024-01-01T00:00:00Z".to_string()),
            ended_at: None,
        };

        assert_eq!(ts.session_id, "session-456");
        assert!(ts.started_at.is_some());
        assert!(ts.ended_at.is_none());
    }

    // ============================================================================
    // Constant/Config Function Tests
    // ============================================================================

    #[test]
    fn test_get_embedding_dimension() {
        let dim = get_embedding_dimension();
        assert_eq!(dim, 384); // all-MiniLM-L6-v2 produces 384-dimensional vectors
    }

    #[test]
    fn test_get_heartbeat_interval() {
        let interval = get_heartbeat_interval();
        assert_eq!(interval, 10); // 10 seconds
    }

    #[test]
    fn test_get_stale_lock_timeout() {
        let timeout = get_stale_lock_timeout();
        assert_eq!(timeout, 30); // 30 seconds
    }

    // ============================================================================
    // Type Conversion Tests (VectorDocumentInput -> VectorDocument)
    // ============================================================================

    #[test]
    fn test_f64_to_f32_vector_conversion() {
        // Test the conversion logic used in vector_index
        let input_vector: Vec<f64> = vec![1.0, 2.5, 3.14159265358979];
        let output_vector: Vec<f32> = input_vector.into_iter().map(|v| v as f32).collect();

        assert_eq!(output_vector.len(), 3);
        assert!((output_vector[0] - 1.0_f32).abs() < f32::EPSILON);
        assert!((output_vector[1] - 2.5_f32).abs() < f32::EPSILON);
        // f32 has less precision
        assert!((output_vector[2] - 3.14159265358979_f32).abs() < 0.0001);
    }

    // ============================================================================
    // Edge Cases and Error Handling
    // ============================================================================

    #[test]
    fn test_compute_file_hash_special_characters_in_path() {
        let test_dir = setup_test_dir("hash-special");

        let file_path = test_dir.join("file with spaces.txt");
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"test").unwrap();
        drop(file);

        let hash = compute_file_hash(file_path.to_string_lossy().to_string());
        assert_eq!(hash.len(), 64);

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_compute_file_hash_unicode_filename() {
        let test_dir = setup_test_dir("hash-unicode");

        let file_path = test_dir.join("arquivo_\u{00E9}.txt");
        let mut file = File::create(&file_path).unwrap();
        file.write_all(b"unicode content").unwrap();
        drop(file);

        let hash = compute_file_hash(file_path.to_string_lossy().to_string());
        assert_eq!(hash.len(), 64);

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_find_files_with_glob_hidden_files() {
        let test_dir = setup_test_dir("glob-hidden");

        // Create regular and hidden files
        File::create(test_dir.join("visible.txt")).unwrap();
        File::create(test_dir.join(".hidden.txt")).unwrap();

        let results = find_files_with_glob(
            test_dir.to_string_lossy().to_string(),
            vec!["*.txt".to_string()],
        );

        // WalkBuilder with hidden(true) should find hidden files
        // But they need to match the glob pattern
        assert!(!results.is_empty());

        cleanup_test_dir(&test_dir);
    }

    #[test]
    fn test_build_manifest_handles_symlinks() {
        let test_dir = setup_test_dir("manifest-symlink");

        let real_file = test_dir.join("real.txt");
        let mut file = File::create(&real_file).unwrap();
        file.write_all(b"real content").unwrap();
        drop(file);

        // Note: This test may behave differently on Windows
        #[cfg(unix)]
        {
            let link_path = test_dir.join("link.txt");
            std::os::unix::fs::symlink(&real_file, &link_path).unwrap();

            let files = vec![
                real_file.to_string_lossy().to_string(),
                link_path.to_string_lossy().to_string(),
            ];

            let manifest = build_manifest(files, test_dir.to_string_lossy().to_string());

            // build_manifest canonicalizes paths, so symlinks resolve to their targets.
            // Both paths resolve to real.txt, so manifest has one entry with that key.
            // The hash should be computed from the symlink path but stored under canonical key.
            assert!(
                manifest.contains_key("real.txt"),
                "manifest should contain real.txt"
            );

            // Since both files resolve to same canonical path, manifest should have one entry
            // (HashMap deduplicates by key)
            assert!(!manifest.is_empty());
        }

        cleanup_test_dir(&test_dir);
    }

    // ============================================================================
    // Integration-style Tests
    // ============================================================================

    #[test]
    fn test_full_workflow_build_check_manifest() {
        let test_dir = setup_test_dir("workflow");

        // Step 1: Create initial files
        let file1 = test_dir.join("src").join("main.rs");
        let file2 = test_dir.join("src").join("lib.rs");
        fs::create_dir_all(test_dir.join("src")).unwrap();

        let mut f1 = File::create(&file1).unwrap();
        f1.write_all(b"fn main() {}").unwrap();
        drop(f1);

        let mut f2 = File::create(&file2).unwrap();
        f2.write_all(b"pub fn foo() {}").unwrap();
        drop(f2);

        // Step 2: Find files with glob
        let found = find_files_with_glob(
            test_dir.to_string_lossy().to_string(),
            vec!["**/*.rs".to_string()],
        );
        assert_eq!(found.len(), 2);

        // Step 3: Build initial manifest
        let manifest1 = check_and_build_manifest(
            test_dir.to_string_lossy().to_string(),
            vec!["**/*.rs".to_string()],
            None,
        );
        assert!(manifest1.has_changes);
        assert_eq!(manifest1.manifest.len(), 2);

        // Step 4: Check again with same state - should report no changes
        let manifest2 = check_and_build_manifest(
            test_dir.to_string_lossy().to_string(),
            vec!["**/*.rs".to_string()],
            Some(manifest1.manifest.clone()),
        );
        assert!(!manifest2.has_changes);

        // Step 5: Modify a file
        let mut f1 = File::create(&file1).unwrap();
        f1.write_all(b"fn main() { println!(\"hello\"); }").unwrap();
        drop(f1);

        // Step 6: Check again - should report changes
        let manifest3 = check_and_build_manifest(
            test_dir.to_string_lossy().to_string(),
            vec!["**/*.rs".to_string()],
            Some(manifest1.manifest),
        );
        assert!(manifest3.has_changes);

        // Step 7: Verify hash changed for modified file
        assert_ne!(
            manifest2.manifest.get("src/main.rs"),
            manifest3.manifest.get("src/main.rs")
        );

        cleanup_test_dir(&test_dir);
    }

    // ============================================================================
    // Agent ID Filter Logic Tests (list_session_messages conversion)
    // ============================================================================

    #[test]
    fn test_agent_id_filter_conversion_logic() {
        // Test the conversion logic used in list_session_messages
        // None (undefined/null in JS) -> None (all messages)
        let input1: Option<String> = None;
        let result1 = input1.map(|s| if s.is_empty() { None } else { Some(s) });
        assert!(result1.is_none()); // All messages

        // Some("") -> Some(None) (main conversation only)
        let input2: Option<String> = Some("".to_string());
        let result2 = input2.map(|s| if s.is_empty() { None } else { Some(s) });
        assert_eq!(result2, Some(None)); // Main only

        // Some("xyz") -> Some(Some("xyz")) (specific agent)
        let input3: Option<String> = Some("agent-123".to_string());
        let result3 = input3.map(|s| if s.is_empty() { None } else { Some(s) });
        assert_eq!(result3, Some(Some("agent-123".to_string()))); // Specific agent
    }

    // ============================================================================
    // Parallel Processing Consistency Tests
    // ============================================================================

    #[test]
    fn test_parallel_hash_determinism() {
        let test_dir = setup_test_dir("parallel-determinism");

        // Create multiple files
        for i in 0..10 {
            let file_path = test_dir.join(format!("file{}.txt", i));
            let mut file = File::create(&file_path).unwrap();
            file.write_all(format!("content for file {}", i).as_bytes())
                .unwrap();
        }

        let files: Vec<String> = (0..10)
            .map(|i| {
                test_dir
                    .join(format!("file{}.txt", i))
                    .to_string_lossy()
                    .to_string()
            })
            .collect();

        // Run parallel hash multiple times and verify consistency
        let result1 = compute_file_hashes_parallel(files.clone());
        let result2 = compute_file_hashes_parallel(files.clone());
        let result3 = compute_file_hashes_parallel(files);

        assert_eq!(result1, result2);
        assert_eq!(result2, result3);

        cleanup_test_dir(&test_dir);
    }
}
