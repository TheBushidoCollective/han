#![deny(clippy::all)]

mod db;
mod download;
mod embedding;

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
            let path = Path::new(file);
            let relative = path.strip_prefix(&root).ok()?;
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
// Database Functions (SurrealDB)
// ============================================================================

/// Initialize or open a database at the given path
#[napi]
pub async fn db_init(db_path: String) -> napi::Result<bool> {
    db::init(&db_path).await
}

/// Index documents for FTS
#[napi]
pub async fn fts_index(db_path: String, table_name: String, documents: Vec<FtsDocument>) -> napi::Result<u32> {
    db::fts_index(&db_path, &table_name, documents).await
}

/// Search documents using FTS (BM25)
#[napi]
pub async fn fts_search(
    db_path: String,
    table_name: String,
    query: String,
    limit: Option<u32>,
) -> napi::Result<Vec<FtsSearchResult>> {
    db::fts_search(&db_path, &table_name, &query, limit).await
}

/// Delete documents by ID
#[napi]
pub async fn fts_delete(db_path: String, table_name: String, ids: Vec<String>) -> napi::Result<u32> {
    db::fts_delete(&db_path, &table_name, ids).await
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
pub async fn vector_index(
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
    db::vector_index(&db_path, &table_name, docs).await
}

/// Search documents using vector similarity
#[napi]
pub async fn vector_search(
    db_path: String,
    table_name: String,
    query_vector: Vec<f64>, // JS numbers are f64
    limit: Option<u32>,
) -> napi::Result<Vec<VectorSearchResult>> {
    let query: Vec<f32> = query_vector.into_iter().map(|v| v as f32).collect();
    db::vector_search(&db_path, &table_name, query, limit).await
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
