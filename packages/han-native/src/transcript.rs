//! Transcript processing utilities
//!
//! High-performance extraction of file operations from transcript content
//! and session file listing.

use napi_derive::napi;
use regex::Regex;
use std::collections::HashSet;
use std::fs;
use std::path::Path;
use std::sync::LazyLock;

// ============================================================================
// Types
// ============================================================================

/// A file operation extracted from transcript content
#[napi(object)]
#[derive(Debug, Clone)]
pub struct FileOperation {
    /// File path
    pub path: String,
    /// Operation type: "read", "write", "edit", "delete"
    pub operation: String,
}

/// Result of file operation extraction
#[napi(object)]
#[derive(Debug, Clone)]
pub struct ExtractionResult {
    /// Extracted file operations
    pub operations: Vec<FileOperation>,
    /// Number of patterns matched
    pub pattern_matches: u32,
}

/// Session file info
#[napi(object)]
#[derive(Debug, Clone)]
pub struct SessionFile {
    /// File name (without directory)
    pub name: String,
    /// Full path
    pub path: String,
    /// File size in bytes
    pub size: i64,
    /// Last modified timestamp (Unix ms)
    pub modified: i64,
}

// ============================================================================
// Compiled Regex Patterns (lazy static for performance)
// ============================================================================

static READ_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?i)(?:Reading|Read|reading)\s+[`"']?([^\s`"'\n]+\.[a-z]+)[`"']?"#).unwrap()
});

static WRITE_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r#"(?i)(?:Writing|Write|writing|Created|created|Creating)\s+(?:to\s+)?[`"']?([^\s`"'\n]+\.[a-z]+)[`"']?"#,
    )
    .unwrap()
});

static EDIT_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(
        r#"(?i)(?:Editing|Edit|editing|Updated|updated|Updating|Modified|modified)\s+[`"']?([^\s`"'\n]+\.[a-z]+)[`"']?"#,
    )
    .unwrap()
});

static FILE_REF_PATTERN: LazyLock<Regex> = LazyLock::new(|| {
    Regex::new(r#"(?i)(?:file|File|FILE)[:\s]+[`"']?([^\s`"'\n]+\.[a-z]+)[`"']?"#).unwrap()
});

static VALID_PATH_PATTERN: LazyLock<Regex> =
    LazyLock::new(|| Regex::new(r#"^[\w./-]+\.[a-z]{1,10}$"#).unwrap());

// ============================================================================
// Core Functions
// ============================================================================

/// Extract file operations from transcript message content
///
/// This is a high-performance replacement for the TypeScript regex extraction.
/// Uses compiled regex patterns for speed.
#[napi]
pub fn extract_file_operations(content: String) -> ExtractionResult {
    let mut operations: Vec<FileOperation> = Vec::new();
    let mut seen_paths: HashSet<String> = HashSet::new();
    let mut pattern_matches: u32 = 0;

    // Extract Read operations
    for cap in READ_PATTERN.captures_iter(&content) {
        if let Some(path_match) = cap.get(1) {
            let path = path_match.as_str().to_string();
            if is_valid_file_path(&path) && seen_paths.insert(path.clone()) {
                operations.push(FileOperation {
                    path,
                    operation: "read".to_string(),
                });
                pattern_matches += 1;
            }
        }
    }

    // Extract Write operations
    for cap in WRITE_PATTERN.captures_iter(&content) {
        if let Some(path_match) = cap.get(1) {
            let path = path_match.as_str().to_string();
            if is_valid_file_path(&path) && seen_paths.insert(path.clone()) {
                operations.push(FileOperation {
                    path,
                    operation: "write".to_string(),
                });
                pattern_matches += 1;
            }
        }
    }

    // Extract Edit operations
    for cap in EDIT_PATTERN.captures_iter(&content) {
        if let Some(path_match) = cap.get(1) {
            let path = path_match.as_str().to_string();
            if is_valid_file_path(&path) && seen_paths.insert(path.clone()) {
                operations.push(FileOperation {
                    path,
                    operation: "edit".to_string(),
                });
                pattern_matches += 1;
            }
        }
    }

    // Extract file references (infer operation from context)
    for cap in FILE_REF_PATTERN.captures_iter(&content) {
        if let Some(path_match) = cap.get(1) {
            let path = path_match.as_str().to_string();
            if is_valid_file_path(&path) && seen_paths.insert(path.clone()) {
                let operation = infer_operation_from_context(&content);
                operations.push(FileOperation { path, operation });
                pattern_matches += 1;
            }
        }
    }

    ExtractionResult {
        operations,
        pattern_matches,
    }
}

/// Extract file operations from multiple messages (batch processing)
#[napi]
pub fn extract_file_operations_batch(contents: Vec<String>) -> Vec<ExtractionResult> {
    contents.into_iter().map(extract_file_operations).collect()
}

/// Check if a string looks like a valid file path
fn is_valid_file_path(path: &str) -> bool {
    // Must have a file extension
    if !path.contains('.') {
        return false;
    }

    // Must not be a URL
    if path.starts_with("http://") || path.starts_with("https://") {
        return false;
    }

    // Must not be too short or too long
    if path.len() < 3 || path.len() > 500 {
        return false;
    }

    // Should look like a path
    VALID_PATH_PATTERN.is_match(path)
}

/// Infer file operation type from surrounding context
fn infer_operation_from_context(content: &str) -> String {
    let lower = content.to_lowercase();

    if lower.contains("created") || lower.contains("writing") || lower.contains("new file") {
        return "write".to_string();
    }
    if lower.contains("edited") || lower.contains("updated") || lower.contains("modified") {
        return "edit".to_string();
    }
    if lower.contains("deleted") || lower.contains("removed") {
        return "delete".to_string();
    }

    "read".to_string()
}

/// List JSONL session files in a directory
///
/// Returns files sorted by modification time (newest first).
#[napi]
pub fn list_session_files(dir_path: String) -> napi::Result<Vec<SessionFile>> {
    let path = Path::new(&dir_path);

    if !path.exists() || !path.is_dir() {
        return Ok(Vec::new());
    }

    let mut files: Vec<SessionFile> = Vec::new();

    let entries = fs::read_dir(path).map_err(|e| {
        napi::Error::from_reason(format!("Failed to read directory {}: {}", dir_path, e))
    })?;

    for entry in entries.flatten() {
        let file_path = entry.path();

        // Only include .jsonl files
        if let Some(ext) = file_path.extension() {
            if ext != "jsonl" {
                continue;
            }
        } else {
            continue;
        }

        // Get file metadata
        if let Ok(metadata) = entry.metadata() {
            let name = entry.file_name().to_string_lossy().to_string();
            let path_str = file_path.to_string_lossy().to_string();
            let size = metadata.len() as i64;

            // Get modification time as Unix timestamp in milliseconds
            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);

            files.push(SessionFile {
                name,
                path: path_str,
                size,
                modified,
            });
        }
    }

    // Sort by modification time (newest first)
    files.sort_by(|a, b| b.modified.cmp(&a.modified));

    Ok(files)
}

/// List JSONL files matching a pattern in a directory
///
/// More flexible than list_session_files - allows custom prefix/suffix matching.
#[napi]
pub fn list_jsonl_files(
    dir_path: String,
    prefix: Option<String>,
    suffix: Option<String>,
) -> napi::Result<Vec<SessionFile>> {
    let path = Path::new(&dir_path);

    if !path.exists() || !path.is_dir() {
        return Ok(Vec::new());
    }

    let mut files: Vec<SessionFile> = Vec::new();

    let entries = fs::read_dir(path).map_err(|e| {
        napi::Error::from_reason(format!("Failed to read directory {}: {}", dir_path, e))
    })?;

    for entry in entries.flatten() {
        let file_path = entry.path();
        let file_name = entry.file_name().to_string_lossy().to_string();

        // Must be a .jsonl file
        if !file_name.ends_with(".jsonl") {
            continue;
        }

        // Check prefix if specified
        if let Some(ref p) = prefix {
            if !file_name.starts_with(p) {
                continue;
            }
        }

        // Check suffix (before .jsonl) if specified
        if let Some(ref s) = suffix {
            let base_name = file_name.trim_end_matches(".jsonl");
            if !base_name.ends_with(s) {
                continue;
            }
        }

        // Get file metadata
        if let Ok(metadata) = entry.metadata() {
            let path_str = file_path.to_string_lossy().to_string();
            let size = metadata.len() as i64;

            let modified = metadata
                .modified()
                .ok()
                .and_then(|t| t.duration_since(std::time::UNIX_EPOCH).ok())
                .map(|d| d.as_millis() as i64)
                .unwrap_or(0);

            files.push(SessionFile {
                name: file_name,
                path: path_str,
                size,
                modified,
            });
        }
    }

    // Sort by modification time (newest first)
    files.sort_by(|a, b| b.modified.cmp(&a.modified));

    Ok(files)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_extract_read_operations() {
        let content = "Reading src/main.ts and then Read lib/utils.js";
        let result = extract_file_operations(content.to_string());
        assert_eq!(result.operations.len(), 2);
        assert_eq!(result.operations[0].path, "src/main.ts");
        assert_eq!(result.operations[0].operation, "read");
    }

    #[test]
    fn test_extract_write_operations() {
        let content = "Writing to output.json and Created new-file.ts";
        let result = extract_file_operations(content.to_string());
        assert_eq!(result.operations.len(), 2);
        assert!(result.operations.iter().any(|o| o.operation == "write"));
    }

    #[test]
    fn test_extract_edit_operations() {
        let content = "Editing config.json, Updated package.json";
        let result = extract_file_operations(content.to_string());
        assert_eq!(result.operations.len(), 2);
        assert!(result.operations.iter().all(|o| o.operation == "edit"));
    }

    #[test]
    fn test_is_valid_file_path() {
        assert!(is_valid_file_path("src/main.ts"));
        assert!(is_valid_file_path("lib/utils.js"));
        assert!(is_valid_file_path("package.json"));
        assert!(!is_valid_file_path("https://example.com/file.js"));
        assert!(!is_valid_file_path("no-extension"));
        assert!(!is_valid_file_path("x")); // too short
    }

    #[test]
    fn test_deduplicate_paths() {
        let content = "Reading file.ts, Reading file.ts again";
        let result = extract_file_operations(content.to_string());
        assert_eq!(result.operations.len(), 1);
    }
}
