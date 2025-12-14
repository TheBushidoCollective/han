#![deny(clippy::all)]

use arrow_array::{Array, RecordBatch, RecordBatchIterator, StringArray};
use arrow_schema::{DataType, Field, Schema};
use futures::TryStreamExt;
use ignore::WalkBuilder;
use lancedb::index::scalar::{FtsIndexBuilder, FullTextSearchQuery};
use lancedb::index::Index;
use lancedb::query::{ExecutableQuery, QueryBase};
use napi_derive::napi;
use rayon::prelude::*;
use sha2::{Digest, Sha256};
use std::collections::HashMap;
use std::fs;
use std::io::Read;
use std::path::Path;
use std::sync::Arc;

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
    // Canonicalize the root path to get absolute path
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    // Build glob matchers
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

    // Walk directory respecting gitignore
    // Note: hidden(true) skips hidden files/dirs to match globby default behavior
    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(|entry| {
            // Skip .git directory
            entry.file_name() != ".git"
        })
        .build();

    for entry in walker.flatten() {
        if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            let path = entry.path();
            // Get path relative to root for glob matching
            if let Ok(relative) = path.strip_prefix(&root) {
                let relative_str = relative.to_string_lossy();
                if glob_set.is_match(relative_str.as_ref()) {
                    // Canonicalize the full path for consistent absolute paths
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

/// Find directories containing marker files or directories (e.g., mix.exs, Cargo.toml, *.xcodeproj)
/// Returns absolute directory paths
#[napi]
pub fn find_directories_with_markers(root_dir: String, markers: Vec<String>) -> Vec<String> {
    // Canonicalize the root path to get absolute path
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => return Vec::new(),
    };

    // Build glob matchers for markers (root-level only, for matching single names)
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

    // Build glob matchers for full path matching
    let mut glob_builder = globset::GlobSetBuilder::new();
    for marker in &markers {
        // Add pattern for root level (e.g., "mix.exs", "*.xcodeproj")
        if let Ok(glob) = globset::Glob::new(marker) {
            glob_builder.add(glob);
        }
        // Add pattern for nested levels (e.g., "**/mix.exs", "**/*.xcodeproj")
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

    // Clone for use in filter closure
    let filter_root = root.clone();
    let filter_globs = root_level_globs.clone();

    // Walk directory respecting gitignore
    // Note: hidden(true) skips hidden files/dirs to match globby default behavior
    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(move |entry| {
            let name = entry.file_name().to_string_lossy();
            // Skip .git
            if name == ".git" {
                return false;
            }
            // For directories, check if we're inside a matched marker directory
            // This is smarter than hardcoding - it uses the search patterns themselves
            if entry.file_type().map(|ft| ft.is_dir()).unwrap_or(false) {
                if let Ok(rel) = entry.path().strip_prefix(&filter_root) {
                    // Check each parent component to see if it matches our marker patterns
                    let rel_str = rel.to_string_lossy();
                    for component in rel_str.split('/') {
                        // Skip empty components and the current entry itself
                        if component.is_empty() || component == name {
                            continue;
                        }
                        // If a parent directory matches our marker patterns, we're inside a matched dir
                        // (e.g., inside HanDemo.xcodeproj when searching for *.xcodeproj)
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

        // Match both files and directories (for bundle dirs like *.xcodeproj, *.xcworkspace)
        if is_file || is_dir {
            let path = entry.path();
            if let Ok(relative) = path.strip_prefix(&root) {
                let relative_str = relative.to_string_lossy();
                if glob_set.is_match(relative_str.as_ref()) {
                    // For files, use parent directory; for directories, use the directory itself's parent
                    let target_dir = if is_file {
                        path.parent()
                    } else {
                        // For directory markers (like *.xcodeproj), the parent is the project dir
                        path.parent()
                    };

                    if let Some(parent) = target_dir {
                        // Canonicalize the directory path
                        if let Ok(abs_dir) = fs::canonicalize(parent) {
                            // Ensure target directory is not inside a matched marker
                            if let Ok(rel_target) = abs_dir.strip_prefix(&root) {
                                let rel_target_str = rel_target.to_string_lossy();
                                let mut inside_marker = false;
                                for component in rel_target_str.split('/') {
                                    if !component.is_empty() && root_level_globs.is_match(component) {
                                        inside_marker = true;
                                        break;
                                    }
                                }
                                if inside_marker {
                                    continue;
                                }
                            }

                            if let Some(dir_str) = abs_dir.to_str() {
                                // Also ensure the directory itself doesn't match the marker pattern
                                // (we want the PARENT of the marker, not the marker itself)
                                let dir_name = abs_dir.file_name()
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
/// Returns a map of relative path to hash
#[napi]
pub fn build_manifest(files: Vec<String>, root_dir: String) -> HashMap<String, String> {
    // Canonicalize the root path to get absolute path
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => Path::new(&root_dir).to_path_buf(),
    };

    files
        .par_iter()
        .filter_map(|file| {
            let path = Path::new(file);
            let relative = path.strip_prefix(&root).ok()?;
            let relative_str = relative.to_string_lossy().to_string();
            let hash = compute_file_hash(file.clone());
            Some((relative_str, hash))
        })
        .collect()
}

/// Check if any files have changed compared to a cached manifest
/// Returns true if changes detected, false if no changes
/// Uses streaming with early exit on first change
#[napi]
pub fn has_changes(
    root_dir: String,
    patterns: Vec<String>,
    cached_manifest: HashMap<String, String>,
) -> bool {
    if cached_manifest.is_empty() {
        return true;
    }

    // Canonicalize the root path to get absolute path
    let root = match fs::canonicalize(&root_dir) {
        Ok(p) => p,
        Err(_) => return true,
    };

    // Build glob matchers
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

    // Walk directory respecting gitignore
    // Note: hidden(true) skips hidden files/dirs to match globby default behavior
    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(|entry| {
            entry.file_name() != ".git"
        })
        .build();

    for entry in walker.flatten() {
        if entry.file_type().map(|ft| ft.is_file()).unwrap_or(false) {
            let path = entry.path();
            if let Ok(relative) = path.strip_prefix(&root) {
                let relative_str = relative.to_string_lossy().to_string();
                if glob_set.is_match(&relative_str) {
                    seen_paths.insert(relative_str.clone());

                    // Compute current hash
                    let current_hash = if let Some(abs_path) = path.to_str() {
                        compute_file_hash(abs_path.to_string())
                    } else {
                        String::new()
                    };

                    // Check against cached hash
                    let cached_hash = cached_manifest.get(&relative_str);
                    if cached_hash.map(|h| h.as_str()) != Some(&current_hash) {
                        // File is new or modified - exit immediately
                        return true;
                    }
                }
            }
        }
    }

    // Check for deleted files (files in cache but not found)
    for cached_path in cached_manifest.keys() {
        if !seen_paths.contains(cached_path) {
            return true;
        }
    }

    false
}

/// Combined function: find files, build manifest, and optionally check for changes
/// Returns (has_changes: bool, manifest: HashMap) for efficiency
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
    // Canonicalize the root path to get absolute path
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

    // Build glob matchers
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

    // Walk directory respecting gitignore and collect files
    // Note: hidden(true) skips hidden files/dirs to match globby default behavior
    let walker = WalkBuilder::new(&root)
        .hidden(true)
        .git_ignore(true)
        .git_global(true)
        .git_exclude(true)
        .filter_entry(|entry| {
            entry.file_name() != ".git"
        })
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

    // Build manifest in parallel
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

    // Determine if changes occurred
    let has_changes = if !has_cache {
        true
    } else {
        // Check for new or modified files
        let mut changed = false;
        for (path, hash) in &manifest {
            if cache.get(path) != Some(hash) {
                changed = true;
                break;
            }
        }
        // Check for deleted files
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
// LanceDB Full-Text Search (FTS) Functions
// ============================================================================

/// A document record for FTS indexing
#[napi(object)]
pub struct FtsDocument {
    /// Unique identifier for the document
    pub id: String,
    /// The text content to index
    pub content: String,
    /// Optional metadata as JSON string
    pub metadata: Option<String>,
}

/// A search result from FTS query
#[napi(object)]
pub struct FtsSearchResult {
    /// Document ID
    pub id: String,
    /// The matched content
    pub content: String,
    /// Optional metadata as JSON string
    pub metadata: Option<String>,
    /// BM25 relevance score
    pub score: f64,
}

/// Initialize or open an FTS index at the given path
/// Creates the table if it doesn't exist
#[napi]
pub async fn fts_init(db_path: String, table_name: String) -> napi::Result<bool> {
    let result = tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().map_err(|e| {
            napi::Error::from_reason(format!("Failed to create runtime: {}", e))
        })?;

        rt.block_on(async {
            let db = lancedb::connect(&db_path)
                .execute()
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to connect: {}", e)))?;

            // Check if table exists
            let tables = db.table_names().execute().await.map_err(|e| {
                napi::Error::from_reason(format!("Failed to list tables: {}", e))
            })?;

            if tables.contains(&table_name) {
                return Ok::<bool, napi::Error>(true);
            }

            // Create table with schema: id (string), content (string), metadata (string)
            let schema = Arc::new(Schema::new(vec![
                Field::new("id", DataType::Utf8, false),
                Field::new("content", DataType::Utf8, false),
                Field::new("metadata", DataType::Utf8, true),
            ]));

            // Create empty table
            let empty_batch = RecordBatch::try_new(
                schema.clone(),
                vec![
                    Arc::new(StringArray::from(Vec::<&str>::new())),
                    Arc::new(StringArray::from(Vec::<&str>::new())),
                    Arc::new(StringArray::from(Vec::<Option<&str>>::new())),
                ],
            )
            .map_err(|e| napi::Error::from_reason(format!("Failed to create batch: {}", e)))?;

            let batches = RecordBatchIterator::new(vec![Ok(empty_batch)], schema);

            db.create_table(&table_name, Box::new(batches))
                .execute()
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to create table: {}", e)))?;

            Ok(true)
        })
    })
    .await
    .map_err(|e| napi::Error::from_reason(format!("Task failed: {}", e)))??;

    Ok(result)
}

/// Index documents for FTS
/// Adds documents to the table and creates/updates the FTS index
#[napi]
pub async fn fts_index(
    db_path: String,
    table_name: String,
    documents: Vec<FtsDocument>,
) -> napi::Result<u32> {
    if documents.is_empty() {
        return Ok(0);
    }

    let count = documents.len() as u32;

    let result = tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().map_err(|e| {
            napi::Error::from_reason(format!("Failed to create runtime: {}", e))
        })?;

        rt.block_on(async {
            let db = lancedb::connect(&db_path)
                .execute()
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to connect: {}", e)))?;

            let table = db
                .open_table(&table_name)
                .execute()
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to open table: {}", e)))?;

            // Build arrays from documents
            let ids: Vec<&str> = documents.iter().map(|d| d.id.as_str()).collect();
            let contents: Vec<&str> = documents.iter().map(|d| d.content.as_str()).collect();
            let metadata: Vec<Option<&str>> = documents
                .iter()
                .map(|d| d.metadata.as_deref())
                .collect();

            let schema = Arc::new(Schema::new(vec![
                Field::new("id", DataType::Utf8, false),
                Field::new("content", DataType::Utf8, false),
                Field::new("metadata", DataType::Utf8, true),
            ]));

            let batch = RecordBatch::try_new(
                schema.clone(),
                vec![
                    Arc::new(StringArray::from(ids)),
                    Arc::new(StringArray::from(contents)),
                    Arc::new(StringArray::from(metadata)),
                ],
            )
            .map_err(|e| napi::Error::from_reason(format!("Failed to create batch: {}", e)))?;

            let batches = RecordBatchIterator::new(vec![Ok(batch)], schema);

            // Add documents to table
            table
                .add(Box::new(batches))
                .execute()
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to add documents: {}", e)))?;

            // Create or update FTS index on content column
            table
                .create_index(&["content"], Index::FTS(FtsIndexBuilder::default()))
                .execute()
                .await
                .map_err(|e| {
                    napi::Error::from_reason(format!("Failed to create FTS index: {}", e))
                })?;

            Ok::<u32, napi::Error>(count)
        })
    })
    .await
    .map_err(|e| napi::Error::from_reason(format!("Task failed: {}", e)))??;

    Ok(result)
}

/// Search documents using FTS (BM25)
#[napi]
pub async fn fts_search(
    db_path: String,
    table_name: String,
    query: String,
    limit: Option<u32>,
) -> napi::Result<Vec<FtsSearchResult>> {
    let limit = limit.unwrap_or(10) as usize;

    let result = tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().map_err(|e| {
            napi::Error::from_reason(format!("Failed to create runtime: {}", e))
        })?;

        rt.block_on(async {
            let db = lancedb::connect(&db_path)
                .execute()
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to connect: {}", e)))?;

            let table = db
                .open_table(&table_name)
                .execute()
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to open table: {}", e)))?;

            // Execute FTS query
            let results = table
                .query()
                .full_text_search(FullTextSearchQuery::new(query))
                .limit(limit)
                .execute()
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to execute query: {}", e)))?
                .try_collect::<Vec<_>>()
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to collect results: {}", e)))?;

            // Convert results to FtsSearchResult
            let mut search_results = Vec::new();
            for batch in results {
                let id_col = batch
                    .column_by_name("id")
                    .and_then(|c| c.as_any().downcast_ref::<StringArray>());
                let content_col = batch
                    .column_by_name("content")
                    .and_then(|c| c.as_any().downcast_ref::<StringArray>());
                let metadata_col = batch
                    .column_by_name("metadata")
                    .and_then(|c| c.as_any().downcast_ref::<StringArray>());
                let score_col = batch
                    .column_by_name("_score")
                    .and_then(|c| c.as_any().downcast_ref::<arrow_array::Float32Array>());

                if let (Some(ids), Some(contents)) = (id_col, content_col) {
                    for i in 0..batch.num_rows() {
                        let id = ids.value(i).to_string();
                        let content = contents.value(i).to_string();
                        let metadata = metadata_col.and_then(|m| {
                            if m.is_null(i) {
                                None
                            } else {
                                Some(m.value(i).to_string())
                            }
                        });
                        let score = score_col.map(|s| s.value(i) as f64).unwrap_or(0.0);

                        search_results.push(FtsSearchResult {
                            id,
                            content,
                            metadata,
                            score,
                        });
                    }
                }
            }

            Ok::<Vec<FtsSearchResult>, napi::Error>(search_results)
        })
    })
    .await
    .map_err(|e| napi::Error::from_reason(format!("Task failed: {}", e)))??;

    Ok(result)
}

/// Delete documents by ID from the FTS index
#[napi]
pub async fn fts_delete(
    db_path: String,
    table_name: String,
    ids: Vec<String>,
) -> napi::Result<u32> {
    if ids.is_empty() {
        return Ok(0);
    }

    let result = tokio::task::spawn_blocking(move || {
        let rt = tokio::runtime::Runtime::new().map_err(|e| {
            napi::Error::from_reason(format!("Failed to create runtime: {}", e))
        })?;

        rt.block_on(async {
            let db = lancedb::connect(&db_path)
                .execute()
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to connect: {}", e)))?;

            let table = db
                .open_table(&table_name)
                .execute()
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to open table: {}", e)))?;

            // Build delete predicate: id IN ('id1', 'id2', ...)
            let id_list: Vec<String> = ids.iter().map(|id| format!("'{}'", id.replace("'", "''"))).collect();
            let predicate = format!("id IN ({})", id_list.join(", "));

            table
                .delete(&predicate)
                .await
                .map_err(|e| napi::Error::from_reason(format!("Failed to delete: {}", e)))?;

            Ok::<u32, napi::Error>(ids.len() as u32)
        })
    })
    .await
    .map_err(|e| napi::Error::from_reason(format!("Task failed: {}", e)))??;

    Ok(result)
}

// ============================================================================
// Text Embedding Functions (using fastembed)
// ============================================================================

use fastembed::{EmbeddingModel, InitOptions, TextEmbedding};
use std::sync::{Mutex, OnceLock};

// Global embedding model instance (lazy initialized with fallible init)
static EMBEDDING_MODEL: OnceLock<Mutex<Option<TextEmbedding>>> = OnceLock::new();

fn get_embedding_model() -> napi::Result<std::sync::MutexGuard<'static, Option<TextEmbedding>>> {
    let cell = EMBEDDING_MODEL.get_or_init(|| Mutex::new(None));
    let mut guard = cell
        .lock()
        .map_err(|e| napi::Error::from_reason(format!("Lock poisoned: {}", e)))?;

    if guard.is_none() {
        let model = TextEmbedding::try_new(InitOptions::new(EmbeddingModel::AllMiniLML6V2))
            .map_err(|e| napi::Error::from_reason(format!("Failed to initialize embedding model: {}", e)))?;
        *guard = Some(model);
    }

    Ok(guard)
}

/// Generate embeddings for a list of texts
/// Returns a 2D array of embeddings (one per text)
#[napi]
pub fn generate_embeddings(texts: Vec<String>) -> napi::Result<Vec<Vec<f32>>> {
    if texts.is_empty() {
        return Ok(Vec::new());
    }

    let guard = get_embedding_model()?;
    let model = guard.as_ref().ok_or_else(|| {
        napi::Error::from_reason("Embedding model not initialized".to_string())
    })?;

    let embeddings = model
        .embed(texts, None)
        .map_err(|e| napi::Error::from_reason(format!("Failed to generate embeddings: {}", e)))?;

    Ok(embeddings)
}

/// Generate embedding for a single text
/// Returns a 1D array (the embedding vector)
#[napi]
pub fn generate_embedding(text: String) -> napi::Result<Vec<f32>> {
    let guard = get_embedding_model()?;
    let model = guard.as_ref().ok_or_else(|| {
        napi::Error::from_reason("Embedding model not initialized".to_string())
    })?;

    let embeddings = model
        .embed(vec![text], None)
        .map_err(|e| napi::Error::from_reason(format!("Failed to generate embedding: {}", e)))?;

    embeddings
        .into_iter()
        .next()
        .ok_or_else(|| napi::Error::from_reason("No embedding returned".to_string()))
}

/// Get the embedding dimension (384 for all-MiniLM-L6-v2)
#[napi]
pub fn get_embedding_dimension() -> u32 {
    384 // all-MiniLM-L6-v2 produces 384-dimensional embeddings
}
