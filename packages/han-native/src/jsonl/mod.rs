//! High-performance JSONL (JSON Lines) file operations using memory-mapped I/O.
//!
//! This module provides efficient reading, pagination, indexing, and filtering
//! for JSONL files commonly used in Claude Code transcripts and metrics.

use memmap2::Mmap;
use napi::threadsafe_function::{ThreadsafeFunction, ThreadsafeFunctionCallMode};
use napi_derive::napi;
// rayon available for parallel processing if needed
use serde::{Deserialize, Serialize};
use std::fs::{self, File};
use std::io::{BufWriter, Read, Write};
use std::path::Path;

// ============================================================================
// Types
// ============================================================================

/// Statistics about a JSONL file
#[napi(object)]
#[derive(Debug, Clone)]
pub struct JsonlStats {
    /// Number of lines in the file
    pub line_count: u32,
    /// File size in bytes
    pub file_size: i64,
    /// Whether an index file exists for fast access
    pub has_index: bool,
    /// Whether the index is stale (file modified after index)
    pub index_stale: bool,
}

/// A single line from a JSONL file
#[napi(object)]
#[derive(Debug, Clone)]
pub struct JsonlLine {
    /// Line number (0-indexed)
    pub line_number: u32,
    /// Byte offset in the file
    pub byte_offset: i64,
    /// Raw content of the line
    pub content: String,
}

/// Result of a paginated read operation
#[napi(object)]
#[derive(Debug, Clone)]
pub struct PaginatedResult {
    /// Lines returned
    pub lines: Vec<JsonlLine>,
    /// Total number of lines in the file
    pub total_lines: u32,
    /// Whether there are more lines after this page
    pub has_more: bool,
    /// Offset for the next page
    pub next_offset: u32,
}

/// Index for fast random access to JSONL lines
#[napi(object)]
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct JsonlIndex {
    /// Original file path
    pub file_path: String,
    /// Byte offsets of each line start
    pub line_offsets: Vec<i64>,
    /// File modification time when index was built (Unix timestamp)
    pub file_mtime: i64,
    /// File size when index was built
    pub file_size: i64,
}

/// Filter specification for querying JSONL
#[napi(object)]
#[derive(Debug, Clone)]
pub struct JsonlFilter {
    /// JSON path to the field (e.g., "type" or "metadata.timestamp")
    pub field_path: String,
    /// Comparison operator: "eq", "ne", "gt", "lt", "gte", "lte", "contains"
    pub operator: String,
    /// Value to compare against (as string, will be parsed based on field type)
    pub value: String,
}

/// Result of a filter operation
#[napi(object)]
#[derive(Debug, Clone)]
pub struct FilterResult {
    /// Matching lines
    pub lines: Vec<JsonlLine>,
    /// Number of lines that matched
    pub matched_count: u32,
    /// Number of lines scanned
    pub scanned_count: u32,
}

// ============================================================================
// Core Functions
// ============================================================================

/// Count the number of lines in a JSONL file (fast, uses mmap + SIMD)
#[napi]
pub fn jsonl_count_lines(file_path: String) -> napi::Result<u32> {
    let file = File::open(&file_path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?;

    let mmap = unsafe { Mmap::map(&file) }
        .map_err(|e| napi::Error::from_reason(format!("Failed to mmap file: {}", e)))?;

    // Use SIMD-accelerated newline counting
    let count = bytecount::count(&mmap, b'\n');

    // If file doesn't end with newline, add 1 for the last line
    let has_trailing_newline = mmap.last().map(|&b| b == b'\n').unwrap_or(true);
    let total = if has_trailing_newline || mmap.is_empty() {
        count as u32
    } else {
        (count + 1) as u32
    };

    Ok(total)
}

/// Get statistics about a JSONL file
#[napi]
pub fn jsonl_stats(file_path: String) -> napi::Result<JsonlStats> {
    let metadata = fs::metadata(&file_path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to stat file: {}", e)))?;

    let line_count = jsonl_count_lines(file_path.clone())?;

    // Check for index file
    let index_path = format!("{}.idx", file_path);
    let has_index = Path::new(&index_path).exists();

    let index_stale = if has_index {
        if let Ok(index_meta) = fs::metadata(&index_path) {
            index_meta.modified().ok() < metadata.modified().ok()
        } else {
            true
        }
    } else {
        false
    };

    Ok(JsonlStats {
        line_count,
        file_size: metadata.len() as i64,
        has_index,
        index_stale,
    })
}

/// Read a page of lines from a JSONL file
#[napi]
pub fn jsonl_read_page(
    file_path: String,
    offset: u32,
    limit: u32,
) -> napi::Result<PaginatedResult> {
    let file = File::open(&file_path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?;

    let mmap = unsafe { Mmap::map(&file) }
        .map_err(|e| napi::Error::from_reason(format!("Failed to mmap file: {}", e)))?;

    let mut lines = Vec::with_capacity(limit as usize);
    let mut line_number = 0u32;
    let mut byte_start = 0usize;
    let mut collected = 0u32;

    for (i, &byte) in mmap.iter().enumerate() {
        if byte == b'\n' {
            if line_number >= offset && collected < limit {
                let line_content = String::from_utf8_lossy(&mmap[byte_start..i]).to_string();
                if !line_content.trim().is_empty() {
                    lines.push(JsonlLine {
                        line_number,
                        byte_offset: byte_start as i64,
                        content: line_content,
                    });
                    collected += 1;
                }
            }
            line_number += 1;
            byte_start = i + 1;

            // Early exit if we've collected enough
            if collected >= limit {
                // Continue counting total lines
                let remaining_newlines = bytecount::count(&mmap[i + 1..], b'\n');
                let total_lines = line_number + remaining_newlines as u32;
                let has_trailing = mmap.last().map(|&b| b == b'\n').unwrap_or(true);
                let total = if has_trailing {
                    total_lines
                } else {
                    total_lines + 1
                };

                return Ok(PaginatedResult {
                    lines,
                    total_lines: total,
                    has_more: offset + limit < total,
                    next_offset: offset + limit,
                });
            }
        }
    }

    // Handle last line without trailing newline
    if byte_start < mmap.len() {
        let line_content = String::from_utf8_lossy(&mmap[byte_start..]).to_string();
        if !line_content.trim().is_empty() && line_number >= offset && collected < limit {
            lines.push(JsonlLine {
                line_number,
                byte_offset: byte_start as i64,
                content: line_content,
            });
            collected += 1;
        }
        line_number += 1;
    }

    Ok(PaginatedResult {
        lines,
        total_lines: line_number,
        has_more: offset + collected < line_number,
        next_offset: offset + collected,
    })
}

/// Read lines in reverse order (for recent-first access)
#[napi]
pub fn jsonl_read_reverse(file_path: String, limit: u32) -> napi::Result<Vec<JsonlLine>> {
    let file = File::open(&file_path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?;

    let mmap = unsafe { Mmap::map(&file) }
        .map_err(|e| napi::Error::from_reason(format!("Failed to mmap file: {}", e)))?;

    // Build line offsets first (we need them for reverse iteration)
    let mut line_offsets: Vec<usize> = vec![0];
    for (i, &byte) in mmap.iter().enumerate() {
        if byte == b'\n' && i + 1 < mmap.len() {
            line_offsets.push(i + 1);
        }
    }

    let total_lines = line_offsets.len();
    let mut lines = Vec::with_capacity(limit.min(total_lines as u32) as usize);

    // Iterate from end
    for i in (0..total_lines).rev() {
        if lines.len() >= limit as usize {
            break;
        }

        let start = line_offsets[i];
        let end = if i + 1 < total_lines {
            line_offsets[i + 1] - 1 // Exclude newline
        } else {
            mmap.len()
        };

        let line_content = String::from_utf8_lossy(&mmap[start..end]).to_string();
        if !line_content.trim().is_empty() {
            lines.push(JsonlLine {
                line_number: i as u32,
                byte_offset: start as i64,
                content: line_content,
            });
        }
    }

    Ok(lines)
}

// ============================================================================
// Indexing Functions
// ============================================================================

/// Build a byte offset index for fast random access
#[napi]
pub fn jsonl_build_index(file_path: String) -> napi::Result<JsonlIndex> {
    let metadata = fs::metadata(&file_path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to stat file: {}", e)))?;

    let file = File::open(&file_path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?;

    let mmap = unsafe { Mmap::map(&file) }
        .map_err(|e| napi::Error::from_reason(format!("Failed to mmap file: {}", e)))?;

    let mut line_offsets: Vec<i64> = vec![0];
    for (i, &byte) in mmap.iter().enumerate() {
        if byte == b'\n' && i + 1 < mmap.len() {
            line_offsets.push((i + 1) as i64);
        }
    }

    let mtime = metadata
        .modified()
        .map(|t| t.duration_since(std::time::UNIX_EPOCH).unwrap().as_secs() as i64)
        .unwrap_or(0);

    Ok(JsonlIndex {
        file_path,
        line_offsets,
        file_mtime: mtime,
        file_size: metadata.len() as i64,
    })
}

/// Save an index to disk for later use
#[napi]
pub fn jsonl_save_index(index: JsonlIndex) -> napi::Result<()> {
    let index_path = format!("{}.idx", index.file_path);
    let file = File::create(&index_path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to create index file: {}", e)))?;

    let mut writer = BufWriter::new(file);

    // Write header: magic, version, mtime, size, count
    writer
        .write_all(b"JIDX")
        .map_err(|e| napi::Error::from_reason(format!("Failed to write index: {}", e)))?;
    writer
        .write_all(&[1u8])
        .map_err(|e| napi::Error::from_reason(format!("Failed to write index: {}", e)))?;
    writer
        .write_all(&index.file_mtime.to_le_bytes())
        .map_err(|e| napi::Error::from_reason(format!("Failed to write index: {}", e)))?;
    writer
        .write_all(&index.file_size.to_le_bytes())
        .map_err(|e| napi::Error::from_reason(format!("Failed to write index: {}", e)))?;
    writer
        .write_all(&(index.line_offsets.len() as u32).to_le_bytes())
        .map_err(|e| napi::Error::from_reason(format!("Failed to write index: {}", e)))?;

    // Write offsets
    for offset in &index.line_offsets {
        writer
            .write_all(&offset.to_le_bytes())
            .map_err(|e| napi::Error::from_reason(format!("Failed to write index: {}", e)))?;
    }

    writer
        .flush()
        .map_err(|e| napi::Error::from_reason(format!("Failed to flush index: {}", e)))?;

    Ok(())
}

/// Load an index from disk
#[napi]
pub fn jsonl_load_index(file_path: String) -> napi::Result<Option<JsonlIndex>> {
    let index_path = format!("{}.idx", file_path);

    if !Path::new(&index_path).exists() {
        return Ok(None);
    }

    let mut file = File::open(&index_path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open index: {}", e)))?;

    // Read header
    let mut magic = [0u8; 4];
    file.read_exact(&mut magic)
        .map_err(|e| napi::Error::from_reason(format!("Failed to read index magic: {}", e)))?;

    if &magic != b"JIDX" {
        return Ok(None); // Invalid index
    }

    let mut version = [0u8; 1];
    file.read_exact(&mut version)
        .map_err(|e| napi::Error::from_reason(format!("Failed to read index version: {}", e)))?;

    if version[0] != 1 {
        return Ok(None); // Unsupported version
    }

    let mut mtime_bytes = [0u8; 8];
    file.read_exact(&mut mtime_bytes)
        .map_err(|e| napi::Error::from_reason(format!("Failed to read index mtime: {}", e)))?;
    let file_mtime = i64::from_le_bytes(mtime_bytes);

    let mut size_bytes = [0u8; 8];
    file.read_exact(&mut size_bytes)
        .map_err(|e| napi::Error::from_reason(format!("Failed to read index size: {}", e)))?;
    let file_size = i64::from_le_bytes(size_bytes);

    let mut count_bytes = [0u8; 4];
    file.read_exact(&mut count_bytes)
        .map_err(|e| napi::Error::from_reason(format!("Failed to read index count: {}", e)))?;
    let count = u32::from_le_bytes(count_bytes);

    // Read offsets
    let mut line_offsets = Vec::with_capacity(count as usize);
    for _ in 0..count {
        let mut offset_bytes = [0u8; 8];
        file.read_exact(&mut offset_bytes)
            .map_err(|e| napi::Error::from_reason(format!("Failed to read index offset: {}", e)))?;
        line_offsets.push(i64::from_le_bytes(offset_bytes));
    }

    Ok(Some(JsonlIndex {
        file_path,
        line_offsets,
        file_mtime,
        file_size,
    }))
}

/// Read specific lines by number using an index (O(1) per line)
#[napi]
pub fn jsonl_read_indexed(
    file_path: String,
    index: JsonlIndex,
    line_numbers: Vec<u32>,
) -> napi::Result<Vec<JsonlLine>> {
    let file = File::open(&file_path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?;

    let mmap = unsafe { Mmap::map(&file) }
        .map_err(|e| napi::Error::from_reason(format!("Failed to mmap file: {}", e)))?;

    let mut lines = Vec::with_capacity(line_numbers.len());

    for line_num in line_numbers {
        if (line_num as usize) >= index.line_offsets.len() {
            continue;
        }

        let start = index.line_offsets[line_num as usize] as usize;
        let end = if (line_num as usize + 1) < index.line_offsets.len() {
            (index.line_offsets[line_num as usize + 1] - 1) as usize // Exclude newline
        } else {
            // Last line - find end
            let mut end = start;
            while end < mmap.len() && mmap[end] != b'\n' {
                end += 1;
            }
            end
        };

        if start < mmap.len() {
            let actual_end = end.min(mmap.len());
            let line_content = String::from_utf8_lossy(&mmap[start..actual_end]).to_string();
            lines.push(JsonlLine {
                line_number: line_num,
                byte_offset: start as i64,
                content: line_content,
            });
        }
    }

    Ok(lines)
}

// ============================================================================
// Streaming Functions
// ============================================================================

/// Stream lines with a callback (memory efficient for large files)
#[napi]
pub async fn jsonl_stream(
    file_path: String,
    callback: ThreadsafeFunction<Vec<JsonlLine>>,
    batch_size: u32,
) -> napi::Result<u32> {
    let file = File::open(&file_path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?;

    let mmap = unsafe { Mmap::map(&file) }
        .map_err(|e| napi::Error::from_reason(format!("Failed to mmap file: {}", e)))?;

    let mut batch = Vec::with_capacity(batch_size as usize);
    let mut line_number = 0u32;
    let mut byte_start = 0usize;

    for (i, &byte) in mmap.iter().enumerate() {
        if byte == b'\n' {
            let line_content = String::from_utf8_lossy(&mmap[byte_start..i]).to_string();
            if !line_content.trim().is_empty() {
                batch.push(JsonlLine {
                    line_number,
                    byte_offset: byte_start as i64,
                    content: line_content,
                });

                if batch.len() >= batch_size as usize {
                    let batch_to_send = std::mem::take(&mut batch);
                    batch = Vec::with_capacity(batch_size as usize);
                    callback.call(Ok(batch_to_send), ThreadsafeFunctionCallMode::Blocking);
                }
            }
            line_number += 1;
            byte_start = i + 1;
        }
    }

    // Handle last line without trailing newline
    if byte_start < mmap.len() {
        let line_content = String::from_utf8_lossy(&mmap[byte_start..]).to_string();
        if !line_content.trim().is_empty() {
            batch.push(JsonlLine {
                line_number,
                byte_offset: byte_start as i64,
                content: line_content,
            });
        }
        line_number += 1;
    }

    // Send remaining batch
    if !batch.is_empty() {
        callback.call(Ok(batch), ThreadsafeFunctionCallMode::Blocking);
    }

    Ok(line_number)
}

// ============================================================================
// Filtering Functions
// ============================================================================

/// Filter JSONL lines by field value
#[napi]
pub fn jsonl_filter(
    file_path: String,
    filters: Vec<JsonlFilter>,
    limit: Option<u32>,
) -> napi::Result<FilterResult> {
    let file = File::open(&file_path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?;

    let mmap = unsafe { Mmap::map(&file) }
        .map_err(|e| napi::Error::from_reason(format!("Failed to mmap file: {}", e)))?;

    let max_results = limit.unwrap_or(u32::MAX);
    let mut lines = Vec::new();
    let mut matched_count = 0u32;
    let mut scanned_count = 0u32;
    let mut line_number = 0u32;
    let mut byte_start = 0usize;

    for (i, &byte) in mmap.iter().enumerate() {
        if byte == b'\n' {
            let line_bytes = &mmap[byte_start..i];
            scanned_count += 1;

            if let Ok(json) = serde_json::from_slice::<serde_json::Value>(line_bytes) {
                let matches = filters.iter().all(|f| filter_matches(&json, f));
                if matches {
                    matched_count += 1;
                    if (matched_count as usize) <= max_results as usize {
                        lines.push(JsonlLine {
                            line_number,
                            byte_offset: byte_start as i64,
                            content: String::from_utf8_lossy(line_bytes).to_string(),
                        });
                    }
                }
            }

            line_number += 1;
            byte_start = i + 1;

            if matched_count >= max_results {
                // Continue counting but stop collecting
            }
        }
    }

    // Handle last line
    if byte_start < mmap.len() {
        let line_bytes = &mmap[byte_start..];
        scanned_count += 1;

        if let Ok(json) = serde_json::from_slice::<serde_json::Value>(line_bytes) {
            let matches = filters.iter().all(|f| filter_matches(&json, f));
            if matches {
                matched_count += 1;
                if (matched_count as usize) <= max_results as usize {
                    lines.push(JsonlLine {
                        line_number,
                        byte_offset: byte_start as i64,
                        content: String::from_utf8_lossy(line_bytes).to_string(),
                    });
                }
            }
        }
    }

    Ok(FilterResult {
        lines,
        matched_count,
        scanned_count,
    })
}

/// Filter with time range (common use case, optimized)
#[napi]
pub fn jsonl_filter_time_range(
    file_path: String,
    timestamp_field: String,
    start_time: String,
    end_time: String,
    limit: Option<u32>,
) -> napi::Result<FilterResult> {
    // Parse ISO8601 timestamps
    let start = chrono_parse(&start_time)?;
    let end = chrono_parse(&end_time)?;

    let file = File::open(&file_path)
        .map_err(|e| napi::Error::from_reason(format!("Failed to open file: {}", e)))?;

    let mmap = unsafe { Mmap::map(&file) }
        .map_err(|e| napi::Error::from_reason(format!("Failed to mmap file: {}", e)))?;

    let max_results = limit.unwrap_or(u32::MAX);
    let mut lines = Vec::new();
    let mut matched_count = 0u32;
    let mut scanned_count = 0u32;
    let mut line_number = 0u32;
    let mut byte_start = 0usize;

    for (i, &byte) in mmap.iter().enumerate() {
        if byte == b'\n' {
            let line_bytes = &mmap[byte_start..i];
            scanned_count += 1;

            if let Ok(json) = serde_json::from_slice::<serde_json::Value>(line_bytes) {
                if let Some(ts_str) = get_field_value(&json, &timestamp_field) {
                    if let Ok(ts) = chrono_parse(&ts_str) {
                        if ts >= start && ts <= end {
                            matched_count += 1;
                            if (matched_count as usize) <= max_results as usize {
                                lines.push(JsonlLine {
                                    line_number,
                                    byte_offset: byte_start as i64,
                                    content: String::from_utf8_lossy(line_bytes).to_string(),
                                });
                            }
                        }
                    }
                }
            }

            line_number += 1;
            byte_start = i + 1;
        }
    }

    // Handle last line
    if byte_start < mmap.len() {
        let line_bytes = &mmap[byte_start..];
        scanned_count += 1;

        if let Ok(json) = serde_json::from_slice::<serde_json::Value>(line_bytes) {
            if let Some(ts_str) = get_field_value(&json, &timestamp_field) {
                if let Ok(ts) = chrono_parse(&ts_str) {
                    if ts >= start && ts <= end {
                        matched_count += 1;
                        if (matched_count as usize) <= max_results as usize {
                            lines.push(JsonlLine {
                                line_number,
                                byte_offset: byte_start as i64,
                                content: String::from_utf8_lossy(line_bytes).to_string(),
                            });
                        }
                    }
                }
            }
        }
    }

    Ok(FilterResult {
        lines,
        matched_count,
        scanned_count,
    })
}

// ============================================================================
// Helper Functions
// ============================================================================

/// Get a field value from JSON by dot-separated path
fn get_field_value(json: &serde_json::Value, path: &str) -> Option<String> {
    let parts: Vec<&str> = path.split('.').collect();
    let mut current = json;

    for part in parts {
        current = current.get(part)?;
    }

    match current {
        serde_json::Value::String(s) => Some(s.clone()),
        serde_json::Value::Number(n) => Some(n.to_string()),
        serde_json::Value::Bool(b) => Some(b.to_string()),
        _ => Some(current.to_string()),
    }
}

/// Check if a JSON value matches a filter
fn filter_matches(json: &serde_json::Value, filter: &JsonlFilter) -> bool {
    let field_value = match get_field_value(json, &filter.field_path) {
        Some(v) => v,
        None => return false,
    };

    match filter.operator.as_str() {
        "eq" => field_value == filter.value,
        "ne" => field_value != filter.value,
        "contains" => field_value.contains(&filter.value),
        "gt" => compare_values(&field_value, &filter.value) > 0,
        "lt" => compare_values(&field_value, &filter.value) < 0,
        "gte" => compare_values(&field_value, &filter.value) >= 0,
        "lte" => compare_values(&field_value, &filter.value) <= 0,
        _ => false,
    }
}

/// Compare two values (try numeric first, fall back to string)
fn compare_values(a: &str, b: &str) -> i32 {
    // Try numeric comparison
    if let (Ok(a_num), Ok(b_num)) = (a.parse::<f64>(), b.parse::<f64>()) {
        return if a_num > b_num {
            1
        } else if a_num < b_num {
            -1
        } else {
            0
        };
    }

    // Fall back to string comparison
    a.cmp(b) as i32
}

/// Parse an ISO8601 timestamp to Unix timestamp
fn chrono_parse(s: &str) -> napi::Result<i64> {
    // Simple ISO8601 parsing without external chrono crate
    // Format: 2024-01-15T10:30:00Z or 2024-01-15T10:30:00.000Z

    // Try to extract timestamp from common formats
    if let Some(ts) = parse_iso8601(s) {
        return Ok(ts);
    }

    Err(napi::Error::from_reason(format!(
        "Failed to parse timestamp: {}",
        s
    )))
}

/// Simple ISO8601 parser
fn parse_iso8601(s: &str) -> Option<i64> {
    // Remove Z suffix if present
    let s = s.trim_end_matches('Z');

    // Split by T
    let parts: Vec<&str> = s.split('T').collect();
    if parts.len() != 2 {
        return None;
    }

    // Parse date
    let date_parts: Vec<&str> = parts[0].split('-').collect();
    if date_parts.len() != 3 {
        return None;
    }

    let year: i32 = date_parts[0].parse().ok()?;
    let month: u32 = date_parts[1].parse().ok()?;
    let day: u32 = date_parts[2].parse().ok()?;

    // Parse time (ignore milliseconds)
    let time_str = parts[1].split('.').next()?;
    let time_parts: Vec<&str> = time_str.split(':').collect();
    if time_parts.len() < 2 {
        return None;
    }

    let hour: u32 = time_parts[0].parse().ok()?;
    let minute: u32 = time_parts[1].parse().ok()?;
    let second: u32 = time_parts.get(2).and_then(|s| s.parse().ok()).unwrap_or(0);

    // Convert to Unix timestamp (simplified, assumes UTC)
    // Days from epoch (1970-01-01)
    let days = days_from_epoch(year, month, day)?;
    let seconds = days * 86400 + (hour * 3600 + minute * 60 + second) as i64;

    Some(seconds)
}

/// Calculate days from Unix epoch to given date
fn days_from_epoch(year: i32, month: u32, day: u32) -> Option<i64> {
    // Simplified calculation
    let y = year as i64;
    let m = month as i64;
    let d = day as i64;

    // Adjust for months (Jan/Feb are months 13/14 of previous year)
    let (y, m) = if m <= 2 { (y - 1, m + 12) } else { (y, m) };

    // Days calculation (formula for Gregorian calendar)
    let days = 365 * y + y / 4 - y / 100 + y / 400 + (153 * (m - 3) + 2) / 5 + d - 719528;

    Some(days)
}
