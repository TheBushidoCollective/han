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
    // File validation status (for stale detection)
    FileValidationStatus,
    // Frustration tracking
    FrustrationEvent,
    FrustrationEventInput,
    FrustrationMetrics,
    // Hook execution tracking
    HookExecution,
    HookExecutionInput,
    HookStats,
    Message,
    MessageBatch,
    MessageInput,
    Project,
    ProjectInput,
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
/// Note: db_path is kept for API compatibility but the singleton uses ~/.claude/han/han.db
#[napi]
pub fn db_init(db_path: String) -> napi::Result<bool> {
    db::init(&db_path)
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

/// Get file changes for a session
#[napi]
pub fn get_session_file_changes(
    _db_path: String,
    session_id: String,
) -> napi::Result<Vec<SessionFileChange>> {
    crud::get_session_file_changes(&session_id)
}

/// Check if a session has any file changes
#[napi]
pub fn has_session_changes(_db_path: String, session_id: String) -> napi::Result<bool> {
    crud::has_session_changes(&session_id)
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

// ============================================================================
// File Watcher Functions
// ============================================================================

// Re-export watcher types and functions (they have #[napi] in watcher.rs)
pub use watcher::{
    clear_index_callback, get_default_watch_path, is_watcher_running, poll_index_results,
    set_index_callback, start_file_watcher, stop_file_watcher, FileEvent, FileEventType,
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
) -> napi::Result<indexer::IndexResult> {
    indexer::index_session_file(file_path)
}

/// Index all JSONL files in a project directory
#[napi]
pub fn index_project_directory(
    _db_path: String,
    project_dir: String,
) -> napi::Result<Vec<indexer::IndexResult>> {
    indexer::index_project_directory(project_dir)
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
    git_diff_stat, git_log, git_ls_files, git_show_file, git_worktree_list, GitDiffStat, GitInfo,
    GitLogEntry, GitWorktree,
};

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
