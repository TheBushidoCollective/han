//! JSONL line reader using memory-mapped I/O.
//!
//! Provides efficient reading of JSONL files via `memmap2` with SIMD-accelerated
//! newline counting via `bytecount`.

use std::path::Path;
use thiserror::Error;

#[derive(Error, Debug)]
pub enum ParserError {
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("File is empty: {0}")]
    EmptyFile(String),
    #[error("Offset {offset} exceeds total lines {total}")]
    OffsetOutOfBounds { offset: u32, total: u32 },
}

pub type ParserResult<T> = Result<T, ParserError>;

/// A single line from a JSONL file.
#[derive(Debug, Clone)]
pub struct JsonlLine {
    pub line_number: u32,
    pub byte_offset: i64,
    pub content: String,
}

/// Result of paginated JSONL reading.
#[derive(Debug, Clone)]
pub struct PaginatedResult {
    pub lines: Vec<JsonlLine>,
    pub total_lines: u32,
    pub has_more: bool,
    pub next_offset: u32,
}

/// Count the number of lines in a JSONL file using mmap + SIMD.
pub fn jsonl_count_lines(file_path: &Path) -> ParserResult<u32> {
    use bytecount::count;
    use memmap2::Mmap;
    use std::fs::File;

    let file = File::open(file_path)?;
    let metadata = file.metadata()?;

    if metadata.len() == 0 {
        return Ok(0);
    }

    // SAFETY: We only read the file and don't modify it.
    let mmap = unsafe { Mmap::map(&file)? };
    let newline_count = count(&mmap, b'\n') as u32;

    // If the file doesn't end with newline, there's one more line
    let has_trailing = mmap.last() == Some(&b'\n');
    if has_trailing {
        Ok(newline_count)
    } else {
        Ok(newline_count + 1)
    }
}

/// Read a page of lines from a JSONL file.
pub fn jsonl_read_page(
    file_path: &Path,
    offset: u32,
    limit: u32,
) -> ParserResult<PaginatedResult> {
    use memmap2::Mmap;
    use std::fs::File;

    let file = File::open(file_path)?;
    let metadata = file.metadata()?;

    if metadata.len() == 0 {
        return Ok(PaginatedResult {
            lines: vec![],
            total_lines: 0,
            has_more: false,
            next_offset: 0,
        });
    }

    let mmap = unsafe { Mmap::map(&file)? };
    let total_lines = count_lines_in_mmap(&mmap);

    if offset >= total_lines {
        return Ok(PaginatedResult {
            lines: vec![],
            total_lines,
            has_more: false,
            next_offset: offset,
        });
    }

    let mut lines = Vec::new();
    let mut current_line: u32 = 0;
    let mut byte_offset: i64 = 0;
    let mut line_start: usize = 0;

    for (i, &byte) in mmap.iter().enumerate() {
        if byte == b'\n' {
            if current_line >= offset && current_line < offset + limit {
                let content = String::from_utf8_lossy(&mmap[line_start..i]).to_string();
                if !content.trim().is_empty() {
                    lines.push(JsonlLine {
                        line_number: current_line,
                        byte_offset,
                        content,
                    });
                }
            }
            current_line += 1;
            byte_offset = (i + 1) as i64;
            line_start = i + 1;

            if current_line >= offset + limit {
                break;
            }
        }
    }

    // Handle last line without trailing newline
    if line_start < mmap.len() && current_line >= offset && current_line < offset + limit {
        let content = String::from_utf8_lossy(&mmap[line_start..]).to_string();
        if !content.trim().is_empty() {
            lines.push(JsonlLine {
                line_number: current_line,
                byte_offset,
                content,
            });
        }
        let _ = current_line; // suppress unused assignment warning
    }

    let next_offset = offset + limit;
    let has_more = next_offset < total_lines;

    Ok(PaginatedResult {
        lines,
        total_lines,
        has_more,
        next_offset,
    })
}

/// Read lines from a JSONL file in reverse order (newest first).
pub fn jsonl_read_reverse(file_path: &Path, limit: u32) -> ParserResult<Vec<JsonlLine>> {
    use memmap2::Mmap;
    use std::fs::File;

    let file = File::open(file_path)?;
    let metadata = file.metadata()?;

    if metadata.len() == 0 {
        return Ok(vec![]);
    }

    let mmap = unsafe { Mmap::map(&file)? };

    // Collect all line start positions
    let mut line_starts: Vec<(u32, usize)> = Vec::new();
    let mut line_num: u32 = 0;
    line_starts.push((0, 0));

    for (i, &byte) in mmap.iter().enumerate() {
        if byte == b'\n' && i + 1 < mmap.len() {
            line_num += 1;
            line_starts.push((line_num, i + 1));
        }
    }

    // Read lines in reverse
    let mut lines = Vec::new();
    let total = line_starts.len();

    for idx in (0..total).rev() {
        if lines.len() >= limit as usize {
            break;
        }

        let (line_number, start) = line_starts[idx];
        let end = if idx + 1 < total {
            line_starts[idx + 1].1 - 1 // Before the \n
        } else {
            let len = mmap.len();
            if mmap[len - 1] == b'\n' {
                len - 1
            } else {
                len
            }
        };

        let content = String::from_utf8_lossy(&mmap[start..end]).to_string();
        if !content.trim().is_empty() {
            lines.push(JsonlLine {
                line_number,
                byte_offset: start as i64,
                content,
            });
        }
    }

    Ok(lines)
}

/// Count lines in an mmap using SIMD-accelerated byte counting.
fn count_lines_in_mmap(mmap: &[u8]) -> u32 {
    let newline_count = bytecount::count(mmap, b'\n') as u32;
    let has_trailing = mmap.last() == Some(&b'\n');
    if has_trailing {
        newline_count
    } else {
        newline_count + 1
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::io::Write;
    use tempfile::NamedTempFile;

    fn write_temp_jsonl(lines: &[&str]) -> NamedTempFile {
        let mut f = NamedTempFile::new().unwrap();
        for line in lines {
            writeln!(f, "{}", line).unwrap();
        }
        f.flush().unwrap();
        f
    }

    #[test]
    fn test_count_lines_empty_file() {
        let f = NamedTempFile::new().unwrap();
        assert_eq!(jsonl_count_lines(f.path()).unwrap(), 0);
    }

    #[test]
    fn test_count_lines_single_line() {
        let f = write_temp_jsonl(&[r#"{"type":"user"}"#]);
        assert_eq!(jsonl_count_lines(f.path()).unwrap(), 1);
    }

    #[test]
    fn test_count_lines_multiple() {
        let f = write_temp_jsonl(&[
            r#"{"type":"user"}"#,
            r#"{"type":"assistant"}"#,
            r#"{"type":"tool_use"}"#,
        ]);
        assert_eq!(jsonl_count_lines(f.path()).unwrap(), 3);
    }

    #[test]
    fn test_read_page_basic() {
        let f = write_temp_jsonl(&[
            r#"{"line":0}"#,
            r#"{"line":1}"#,
            r#"{"line":2}"#,
            r#"{"line":3}"#,
            r#"{"line":4}"#,
        ]);

        let result = jsonl_read_page(f.path(), 0, 3).unwrap();
        assert_eq!(result.lines.len(), 3);
        assert_eq!(result.total_lines, 5);
        assert!(result.has_more);
        assert_eq!(result.next_offset, 3);
        assert_eq!(result.lines[0].line_number, 0);
        assert_eq!(result.lines[2].line_number, 2);
    }

    #[test]
    fn test_read_page_offset() {
        let f = write_temp_jsonl(&[
            r#"{"line":0}"#,
            r#"{"line":1}"#,
            r#"{"line":2}"#,
            r#"{"line":3}"#,
        ]);

        let result = jsonl_read_page(f.path(), 2, 10).unwrap();
        assert_eq!(result.lines.len(), 2);
        assert!(!result.has_more);
    }

    #[test]
    fn test_read_page_empty() {
        let f = NamedTempFile::new().unwrap();
        let result = jsonl_read_page(f.path(), 0, 10).unwrap();
        assert_eq!(result.lines.len(), 0);
        assert_eq!(result.total_lines, 0);
    }

    #[test]
    fn test_read_reverse() {
        let f = write_temp_jsonl(&[
            r#"{"line":0}"#,
            r#"{"line":1}"#,
            r#"{"line":2}"#,
        ]);

        let lines = jsonl_read_reverse(f.path(), 2).unwrap();
        assert_eq!(lines.len(), 2);
        assert_eq!(lines[0].line_number, 2);
        assert_eq!(lines[1].line_number, 1);
    }

    #[test]
    fn test_read_reverse_empty() {
        let f = NamedTempFile::new().unwrap();
        let lines = jsonl_read_reverse(f.path(), 10).unwrap();
        assert!(lines.is_empty());
    }

    #[test]
    fn test_read_page_skips_empty_lines() {
        let mut f = NamedTempFile::new().unwrap();
        writeln!(f, r#"{{"line":0}}"#).unwrap();
        writeln!(f, "").unwrap(); // empty line
        writeln!(f, r#"{{"line":2}}"#).unwrap();
        f.flush().unwrap();

        let result = jsonl_read_page(f.path(), 0, 10).unwrap();
        // Empty lines are skipped in output
        assert_eq!(result.lines.len(), 2);
    }
}
