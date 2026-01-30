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
    // 719469 is the offset to make 1970-01-01 = day 0 (Unix epoch)
    let days = 365 * y + y / 4 - y / 100 + y / 400 + (153 * (m - 3) + 2) / 5 + d - 719469;

    Some(days)
}

// ============================================================================
// Unit Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    // ========================================================================
    // Helper Functions for Tests
    // ========================================================================

    /// Create a temporary JSONL file with the given content
    fn create_temp_jsonl(content: &str) -> NamedTempFile {
        let mut file = NamedTempFile::new().expect("Failed to create temp file");
        file.write_all(content.as_bytes())
            .expect("Failed to write to temp file");
        file.flush().expect("Failed to flush temp file");
        file
    }

    /// Create sample JSONL content with multiple events
    fn sample_jsonl_content() -> &'static str {
        r#"{"type":"user","message":"Hello world","timestamp":"2024-01-15T10:30:00Z"}
{"type":"assistant","message":"Hi there!","timestamp":"2024-01-15T10:30:05Z"}
{"type":"tool_use","name":"read_file","input":{"path":"/test.txt"},"timestamp":"2024-01-15T10:30:10Z"}
{"type":"tool_result","content":"file contents here","timestamp":"2024-01-15T10:30:11Z"}
{"type":"assistant","message":"I found the file.","timestamp":"2024-01-15T10:30:15Z"}
"#
    }

    // ========================================================================
    // Line Counting Tests
    // ========================================================================

    #[test]
    fn test_count_lines_empty_file() {
        let file = create_temp_jsonl("");
        let count = jsonl_count_lines(file.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(count, 0);
    }

    #[test]
    fn test_count_lines_single_line_with_newline() {
        let file = create_temp_jsonl("{\"type\":\"test\"}\n");
        let count = jsonl_count_lines(file.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_count_lines_single_line_no_newline() {
        let file = create_temp_jsonl("{\"type\":\"test\"}");
        let count = jsonl_count_lines(file.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(count, 1);
    }

    #[test]
    fn test_count_lines_multiple_lines() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let count = jsonl_count_lines(file.path().to_string_lossy().to_string()).unwrap();
        assert_eq!(count, 5);
    }

    #[test]
    fn test_count_lines_nonexistent_file() {
        let result = jsonl_count_lines("/nonexistent/path/file.jsonl".to_string());
        assert!(result.is_err());
    }

    // ========================================================================
    // Stats Tests
    // ========================================================================

    #[test]
    fn test_stats_basic() {
        let content = sample_jsonl_content();
        let file = create_temp_jsonl(content);
        let stats = jsonl_stats(file.path().to_string_lossy().to_string()).unwrap();

        assert_eq!(stats.line_count, 5);
        assert_eq!(stats.file_size, content.len() as i64);
        assert!(!stats.has_index);
        assert!(!stats.index_stale);
    }

    #[test]
    fn test_stats_with_index() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let path = file.path().to_string_lossy().to_string();

        // Build and save index
        let index = jsonl_build_index(path.clone()).unwrap();
        jsonl_save_index(index).unwrap();

        // Check stats now shows index exists
        let stats = jsonl_stats(path.clone()).unwrap();
        assert!(stats.has_index);

        // Clean up index file
        let index_path = format!("{}.idx", path);
        std::fs::remove_file(&index_path).ok();
    }

    // ========================================================================
    // Pagination Tests
    // ========================================================================

    #[test]
    fn test_read_page_first_page() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_read_page(file.path().to_string_lossy().to_string(), 0, 2).unwrap();

        assert_eq!(result.lines.len(), 2);
        assert_eq!(result.total_lines, 5);
        assert!(result.has_more);
        assert_eq!(result.next_offset, 2);
        assert_eq!(result.lines[0].line_number, 0);
        assert_eq!(result.lines[1].line_number, 1);
    }

    #[test]
    fn test_read_page_middle_page() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_read_page(file.path().to_string_lossy().to_string(), 2, 2).unwrap();

        assert_eq!(result.lines.len(), 2);
        assert!(result.has_more);
        assert_eq!(result.lines[0].line_number, 2);
        assert_eq!(result.lines[1].line_number, 3);
    }

    #[test]
    fn test_read_page_last_page() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_read_page(file.path().to_string_lossy().to_string(), 4, 10).unwrap();

        assert_eq!(result.lines.len(), 1);
        assert!(!result.has_more);
        assert_eq!(result.lines[0].line_number, 4);
    }

    #[test]
    fn test_read_page_offset_beyond_file() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_read_page(file.path().to_string_lossy().to_string(), 100, 10).unwrap();

        assert_eq!(result.lines.len(), 0);
        assert!(!result.has_more);
    }

    #[test]
    fn test_read_page_empty_file() {
        let file = create_temp_jsonl("");
        let result = jsonl_read_page(file.path().to_string_lossy().to_string(), 0, 10).unwrap();

        assert_eq!(result.lines.len(), 0);
        assert_eq!(result.total_lines, 0);
        assert!(!result.has_more);
    }

    #[test]
    fn test_read_page_skips_empty_lines() {
        let content = "{\"type\":\"a\"}\n\n{\"type\":\"b\"}\n";
        let file = create_temp_jsonl(content);
        let result = jsonl_read_page(file.path().to_string_lossy().to_string(), 0, 10).unwrap();

        // Should skip the empty line in the middle
        assert_eq!(result.lines.len(), 2);
    }

    #[test]
    fn test_read_page_file_without_trailing_newline() {
        let content = "{\"type\":\"a\"}\n{\"type\":\"b\"}";
        let file = create_temp_jsonl(content);
        let result = jsonl_read_page(file.path().to_string_lossy().to_string(), 0, 10).unwrap();

        assert_eq!(result.lines.len(), 2);
        assert_eq!(result.total_lines, 2);
    }

    // ========================================================================
    // Reverse Reading Tests
    // ========================================================================

    #[test]
    fn test_read_reverse_basic() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let lines = jsonl_read_reverse(file.path().to_string_lossy().to_string(), 3).unwrap();

        assert_eq!(lines.len(), 3);
        // Lines should be in reverse order (most recent first)
        assert_eq!(lines[0].line_number, 4);
        assert_eq!(lines[1].line_number, 3);
        assert_eq!(lines[2].line_number, 2);
    }

    #[test]
    fn test_read_reverse_limit_exceeds_file() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let lines = jsonl_read_reverse(file.path().to_string_lossy().to_string(), 100).unwrap();

        assert_eq!(lines.len(), 5);
    }

    #[test]
    fn test_read_reverse_empty_file() {
        let file = create_temp_jsonl("");
        let lines = jsonl_read_reverse(file.path().to_string_lossy().to_string(), 10).unwrap();

        assert_eq!(lines.len(), 0);
    }

    // ========================================================================
    // Index Building and Loading Tests
    // ========================================================================

    #[test]
    fn test_build_index() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let path = file.path().to_string_lossy().to_string();
        let index = jsonl_build_index(path.clone()).unwrap();

        assert_eq!(index.file_path, path);
        assert_eq!(index.line_offsets.len(), 5);
        assert_eq!(index.line_offsets[0], 0);
        assert!(index.file_size > 0);
        assert!(index.file_mtime > 0);
    }

    #[test]
    fn test_save_and_load_index() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let path = file.path().to_string_lossy().to_string();

        // Build and save
        let index = jsonl_build_index(path.clone()).unwrap();
        jsonl_save_index(index.clone()).unwrap();

        // Load
        let loaded = jsonl_load_index(path.clone()).unwrap();
        assert!(loaded.is_some());

        let loaded = loaded.unwrap();
        assert_eq!(loaded.file_path, path);
        assert_eq!(loaded.line_offsets, index.line_offsets);
        assert_eq!(loaded.file_mtime, index.file_mtime);
        assert_eq!(loaded.file_size, index.file_size);

        // Clean up
        let index_path = format!("{}.idx", path);
        std::fs::remove_file(&index_path).ok();
    }

    #[test]
    fn test_load_index_nonexistent() {
        let result = jsonl_load_index("/nonexistent/file.jsonl".to_string()).unwrap();
        assert!(result.is_none());
    }

    #[test]
    fn test_load_index_invalid_magic() {
        let file = create_temp_jsonl("not a valid index");
        let path = file.path().to_string_lossy().to_string();

        // Create a fake .idx file
        let index_path = format!("{}.idx", path);
        std::fs::write(&index_path, b"FAKE").unwrap();

        let result = jsonl_load_index(path).unwrap();
        assert!(result.is_none());

        std::fs::remove_file(&index_path).ok();
    }

    // ========================================================================
    // Indexed Reading Tests
    // ========================================================================

    #[test]
    fn test_read_indexed_specific_lines() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let path = file.path().to_string_lossy().to_string();

        let index = jsonl_build_index(path.clone()).unwrap();
        let lines = jsonl_read_indexed(path, index, vec![0, 2, 4]).unwrap();

        assert_eq!(lines.len(), 3);
        assert_eq!(lines[0].line_number, 0);
        assert_eq!(lines[1].line_number, 2);
        assert_eq!(lines[2].line_number, 4);
    }

    #[test]
    fn test_read_indexed_out_of_bounds() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let path = file.path().to_string_lossy().to_string();

        let index = jsonl_build_index(path.clone()).unwrap();
        let lines = jsonl_read_indexed(path, index, vec![0, 100, 200]).unwrap();

        // Only line 0 should be returned, others are out of bounds
        assert_eq!(lines.len(), 1);
        assert_eq!(lines[0].line_number, 0);
    }

    // ========================================================================
    // Filter Tests
    // ========================================================================

    #[test]
    fn test_filter_eq() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "type".to_string(),
                operator: "eq".to_string(),
                value: "assistant".to_string(),
            }],
            None,
        )
        .unwrap();

        assert_eq!(result.matched_count, 2);
        assert_eq!(result.scanned_count, 5);
        assert_eq!(result.lines.len(), 2);
    }

    #[test]
    fn test_filter_ne() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "type".to_string(),
                operator: "ne".to_string(),
                value: "assistant".to_string(),
            }],
            None,
        )
        .unwrap();

        assert_eq!(result.matched_count, 3);
    }

    #[test]
    fn test_filter_contains() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "message".to_string(),
                operator: "contains".to_string(),
                value: "Hello".to_string(),
            }],
            None,
        )
        .unwrap();

        assert_eq!(result.matched_count, 1);
    }

    #[test]
    fn test_filter_with_limit() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "type".to_string(),
                operator: "ne".to_string(),
                value: "invalid".to_string(),
            }],
            Some(2),
        )
        .unwrap();

        // matched_count should be total matches found
        assert_eq!(result.matched_count, 5);
        // But lines should be limited
        assert_eq!(result.lines.len(), 2);
    }

    #[test]
    fn test_filter_nested_field() {
        let content = r#"{"type":"tool_use","input":{"path":"/test.txt"}}
{"type":"tool_use","input":{"path":"/other.txt"}}
"#;
        let file = create_temp_jsonl(content);
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "input.path".to_string(),
                operator: "eq".to_string(),
                value: "/test.txt".to_string(),
            }],
            None,
        )
        .unwrap();

        assert_eq!(result.matched_count, 1);
    }

    #[test]
    fn test_filter_multiple_conditions() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![
                JsonlFilter {
                    field_path: "type".to_string(),
                    operator: "eq".to_string(),
                    value: "assistant".to_string(),
                },
                JsonlFilter {
                    field_path: "message".to_string(),
                    operator: "contains".to_string(),
                    value: "file".to_string(),
                },
            ],
            None,
        )
        .unwrap();

        // Only one assistant message contains "file"
        assert_eq!(result.matched_count, 1);
    }

    #[test]
    fn test_filter_numeric_comparison_gt() {
        let content = r#"{"value":10}
{"value":20}
{"value":30}
"#;
        let file = create_temp_jsonl(content);
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "value".to_string(),
                operator: "gt".to_string(),
                value: "15".to_string(),
            }],
            None,
        )
        .unwrap();

        assert_eq!(result.matched_count, 2);
    }

    #[test]
    fn test_filter_numeric_comparison_lt() {
        let content = r#"{"value":10}
{"value":20}
{"value":30}
"#;
        let file = create_temp_jsonl(content);
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "value".to_string(),
                operator: "lt".to_string(),
                value: "25".to_string(),
            }],
            None,
        )
        .unwrap();

        assert_eq!(result.matched_count, 2);
    }

    #[test]
    fn test_filter_gte_lte() {
        let content = r#"{"value":10}
{"value":20}
{"value":30}
"#;
        let file = create_temp_jsonl(content);

        let result_gte = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "value".to_string(),
                operator: "gte".to_string(),
                value: "20".to_string(),
            }],
            None,
        )
        .unwrap();
        assert_eq!(result_gte.matched_count, 2);

        let result_lte = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "value".to_string(),
                operator: "lte".to_string(),
                value: "20".to_string(),
            }],
            None,
        )
        .unwrap();
        assert_eq!(result_lte.matched_count, 2);
    }

    #[test]
    fn test_filter_missing_field() {
        let content = r#"{"type":"a"}
{"type":"b","extra":"data"}
"#;
        let file = create_temp_jsonl(content);
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "extra".to_string(),
                operator: "eq".to_string(),
                value: "data".to_string(),
            }],
            None,
        )
        .unwrap();

        assert_eq!(result.matched_count, 1);
    }

    #[test]
    fn test_filter_invalid_json_line() {
        let content = r#"{"type":"valid"}
not valid json
{"type":"also_valid"}
"#;
        let file = create_temp_jsonl(content);
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "type".to_string(),
                operator: "ne".to_string(),
                value: "nothing".to_string(),
            }],
            None,
        )
        .unwrap();

        // Should skip invalid JSON and process valid ones
        assert_eq!(result.matched_count, 2);
        assert_eq!(result.scanned_count, 3);
    }

    #[test]
    fn test_filter_unknown_operator() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "type".to_string(),
                operator: "unknown_op".to_string(),
                value: "test".to_string(),
            }],
            None,
        )
        .unwrap();

        // Unknown operator should match nothing
        assert_eq!(result.matched_count, 0);
    }

    // ========================================================================
    // Time Range Filter Tests
    // ========================================================================

    #[test]
    fn test_filter_time_range_basic() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_filter_time_range(
            file.path().to_string_lossy().to_string(),
            "timestamp".to_string(),
            "2024-01-15T10:30:00Z".to_string(),
            "2024-01-15T10:30:10Z".to_string(),
            None,
        )
        .unwrap();

        // Should match first 3 events (10:30:00, 10:30:05, 10:30:10)
        assert_eq!(result.matched_count, 3);
    }

    #[test]
    fn test_filter_time_range_with_limit() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_filter_time_range(
            file.path().to_string_lossy().to_string(),
            "timestamp".to_string(),
            "2024-01-15T10:00:00Z".to_string(),
            "2024-01-15T11:00:00Z".to_string(),
            Some(2),
        )
        .unwrap();

        assert_eq!(result.matched_count, 5);
        assert_eq!(result.lines.len(), 2);
    }

    #[test]
    fn test_filter_time_range_no_matches() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let result = jsonl_filter_time_range(
            file.path().to_string_lossy().to_string(),
            "timestamp".to_string(),
            "2025-01-01T00:00:00Z".to_string(),
            "2025-12-31T23:59:59Z".to_string(),
            None,
        )
        .unwrap();

        assert_eq!(result.matched_count, 0);
    }

    // ========================================================================
    // Helper Function Tests
    // ========================================================================

    #[test]
    fn test_get_field_value_simple() {
        let json: serde_json::Value = serde_json::json!({
            "type": "test",
            "count": 42,
            "active": true
        });

        assert_eq!(get_field_value(&json, "type"), Some("test".to_string()));
        assert_eq!(get_field_value(&json, "count"), Some("42".to_string()));
        assert_eq!(get_field_value(&json, "active"), Some("true".to_string()));
    }

    #[test]
    fn test_get_field_value_nested() {
        let json: serde_json::Value = serde_json::json!({
            "outer": {
                "inner": {
                    "value": "deep"
                }
            }
        });

        assert_eq!(
            get_field_value(&json, "outer.inner.value"),
            Some("deep".to_string())
        );
    }

    #[test]
    fn test_get_field_value_missing() {
        let json: serde_json::Value = serde_json::json!({"type": "test"});

        assert_eq!(get_field_value(&json, "missing"), None);
        assert_eq!(get_field_value(&json, "missing.nested"), None);
    }

    #[test]
    fn test_compare_values_numeric() {
        assert_eq!(compare_values("10", "5"), 1);
        assert_eq!(compare_values("5", "10"), -1);
        assert_eq!(compare_values("10", "10"), 0);
        assert_eq!(compare_values("10.5", "10.1"), 1);
    }

    #[test]
    fn test_compare_values_string() {
        assert_eq!(compare_values("apple", "banana"), -1);
        assert_eq!(compare_values("banana", "apple"), 1);
        assert_eq!(compare_values("test", "test"), 0);
    }

    #[test]
    fn test_parse_iso8601_valid() {
        let ts = parse_iso8601("2024-01-15T10:30:00Z").unwrap();
        // Should be a valid Unix timestamp for 2024-01-15 10:30:00 UTC
        assert!(ts > 0);
    }

    #[test]
    fn test_parse_iso8601_with_milliseconds() {
        let ts = parse_iso8601("2024-01-15T10:30:00.123Z").unwrap();
        assert!(ts > 0);
    }

    #[test]
    fn test_parse_iso8601_invalid() {
        assert!(parse_iso8601("not a date").is_none());
        assert!(parse_iso8601("2024-01-15").is_none()); // Missing time
        assert!(parse_iso8601("10:30:00").is_none()); // Missing date
    }

    #[test]
    fn test_days_from_epoch() {
        // Unix epoch is 1970-01-01
        assert_eq!(days_from_epoch(1970, 1, 1), Some(0));
        // 2024-01-15 should be a positive number
        let days = days_from_epoch(2024, 1, 15).unwrap();
        assert!(days > 0);
    }

    #[test]
    fn test_chrono_parse_valid() {
        let result = chrono_parse("2024-01-15T10:30:00Z");
        assert!(result.is_ok());
    }

    #[test]
    fn test_chrono_parse_invalid() {
        let result = chrono_parse("invalid");
        assert!(result.is_err());
    }

    // ========================================================================
    // Edge Case Tests
    // ========================================================================

    #[test]
    fn test_unicode_content() {
        let content = r#"{"message":"Hello 世界 🌍"}
{"message":"Привет мир"}
"#;
        let file = create_temp_jsonl(content);
        let result = jsonl_read_page(file.path().to_string_lossy().to_string(), 0, 10).unwrap();

        assert_eq!(result.lines.len(), 2);
        assert!(result.lines[0].content.contains("世界"));
        assert!(result.lines[1].content.contains("Привет"));
    }

    #[test]
    fn test_large_line() {
        let large_value = "x".repeat(10000);
        let content = format!("{{\"data\":\"{}\"}}\n", large_value);
        let file = create_temp_jsonl(&content);
        let result = jsonl_read_page(file.path().to_string_lossy().to_string(), 0, 10).unwrap();

        assert_eq!(result.lines.len(), 1);
        assert!(result.lines[0].content.len() > 10000);
    }

    #[test]
    fn test_byte_offset_accuracy() {
        let content = "abc\ndef\n";
        let file = create_temp_jsonl(content);
        let result = jsonl_read_page(file.path().to_string_lossy().to_string(), 0, 10).unwrap();

        assert_eq!(result.lines[0].byte_offset, 0);
        assert_eq!(result.lines[1].byte_offset, 4); // "abc\n" = 4 bytes
    }

    #[test]
    fn test_filter_with_file_without_trailing_newline() {
        let content = r#"{"type":"first"}
{"type":"second"}"#;
        let file = create_temp_jsonl(content);
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "type".to_string(),
                operator: "eq".to_string(),
                value: "second".to_string(),
            }],
            None,
        )
        .unwrap();

        assert_eq!(result.matched_count, 1);
    }

    #[test]
    fn test_filter_time_range_with_file_without_trailing_newline() {
        let content = r#"{"timestamp":"2024-01-15T10:30:00Z"}
{"timestamp":"2024-01-15T10:31:00Z"}"#;
        let file = create_temp_jsonl(content);
        let result = jsonl_filter_time_range(
            file.path().to_string_lossy().to_string(),
            "timestamp".to_string(),
            "2024-01-15T10:30:30Z".to_string(),
            "2024-01-15T10:32:00Z".to_string(),
            None,
        )
        .unwrap();

        assert_eq!(result.matched_count, 1);
    }

    // ========================================================================
    // Boolean Value Tests
    // ========================================================================

    #[test]
    fn test_filter_boolean_field() {
        let content = r#"{"active":true,"name":"a"}
{"active":false,"name":"b"}
{"active":true,"name":"c"}
"#;
        let file = create_temp_jsonl(content);
        let result = jsonl_filter(
            file.path().to_string_lossy().to_string(),
            vec![JsonlFilter {
                field_path: "active".to_string(),
                operator: "eq".to_string(),
                value: "true".to_string(),
            }],
            None,
        )
        .unwrap();

        assert_eq!(result.matched_count, 2);
    }

    // ========================================================================
    // Index Version Tests
    // ========================================================================

    #[test]
    fn test_load_index_unsupported_version() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let path = file.path().to_string_lossy().to_string();

        // Create an index file with unsupported version
        let index_path = format!("{}.idx", path);
        let mut data = vec![];
        data.extend_from_slice(b"JIDX");
        data.push(99); // Unsupported version
        std::fs::write(&index_path, &data).unwrap();

        let result = jsonl_load_index(path).unwrap();
        assert!(result.is_none());

        std::fs::remove_file(&index_path).ok();
    }

    // ========================================================================
    // Concurrent Access Simulation Tests
    // ========================================================================

    #[test]
    fn test_multiple_reads_same_file() {
        let file = create_temp_jsonl(sample_jsonl_content());
        let path = file.path().to_string_lossy().to_string();

        // Perform multiple reads
        for _ in 0..10 {
            let result = jsonl_read_page(path.clone(), 0, 5).unwrap();
            assert_eq!(result.lines.len(), 5);
        }
    }
}
