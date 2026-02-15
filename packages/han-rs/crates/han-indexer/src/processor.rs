//! Main indexing pipeline: JSONL files → database.
//!
//! Two-pass parsing approach:
//! 1. Parse all lines into intermediate form, build uuid→timestamp map.
//! 2. Finalize messages using the timestamp map (summary messages need this).
//!
//! Side-effects extracted during indexing:
//! - File changes (Write/Edit/NotebookEdit tools)
//! - Todos (TodoWrite tool)
//! - Native tasks (TaskCreate/TaskUpdate tools)
//! - Sentiment analysis (user messages)
//! - Session summaries and compacts
//! - Han events from `-han.jsonl` files
//! - Task events (task_start/task_complete/task_fail)
//! - File validation cache events

use crate::parser::{jsonl_read_page, JsonlLine};
use crate::sentiment;
use crate::task_timeline::{build_task_timeline, TaskTimeline};
use crate::types::{
    FileEventType, IndexResult, IntermediateParsedLine, MessageType, ParsedHanEvent, ParsedMessage,
};
use chrono::{DateTime, Duration, Utc};
use han_db::crud;
use han_db::entities::messages;
use sea_orm::{DatabaseConnection, Set};
use serde_json::Value;
use std::collections::{HashMap, HashSet};
use std::path::Path;
use thiserror::Error;
use uuid::Uuid;

#[derive(Error, Debug)]
pub enum ProcessorError {
    #[error("Database error: {0}")]
    Database(#[from] han_db::DbError),
    #[error("I/O error: {0}")]
    Io(#[from] std::io::Error),
    #[error("Parser error: {0}")]
    Parser(#[from] crate::parser::ParserError),
    #[error("{0}")]
    Other(String),
}

pub type ProcessorResult<T> = Result<T, ProcessorError>;

// ============================================================================
// JSONL Parsing helpers
// ============================================================================

/// Extract timestamp from a message based on its type.
fn extract_timestamp(
    parsed: &IntermediateParsedLine,
    uuid_to_timestamp: &HashMap<String, String>,
) -> Option<String> {
    if let Some(ts) = &parsed.direct_timestamp {
        return Some(ts.clone());
    }

    match parsed.message_type {
        MessageType::FileHistorySnapshot => parsed
            .json
            .get("snapshot")
            .and_then(|s| s.get("timestamp"))
            .and_then(|t| t.as_str())
            .map(|s| s.to_string()),
        MessageType::Summary => parsed
            .leaf_uuid
            .as_ref()
            .and_then(|leaf_id| uuid_to_timestamp.get(leaf_id).cloned()),
        _ => None,
    }
}

/// Parse a single JSONL line into an intermediate representation.
fn parse_jsonl_line_intermediate(line: &JsonlLine) -> Option<IntermediateParsedLine> {
    let json: Value = serde_json::from_str(&line.content).ok()?;

    let msg_type = json.get("type")?.as_str()?;
    let message_type = MessageType::from_str(msg_type);

    let uuid = json
        .get("uuid")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    let direct_timestamp = json
        .get("timestamp")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let leaf_uuid = json
        .get("leafUuid")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    Some(IntermediateParsedLine {
        line_number: line.line_number as i32,
        json,
        raw_content: line.content.clone(),
        message_type,
        uuid,
        direct_timestamp,
        leaf_uuid,
    })
}

/// Convert intermediate parsed line to final ParsedMessage.
fn finalize_parsed_message(
    parsed: IntermediateParsedLine,
    uuid_to_timestamp: &HashMap<String, String>,
    fallback_timestamp: Option<&str>,
) -> Option<ParsedMessage> {
    let timestamp = extract_timestamp(&parsed, uuid_to_timestamp)
        .or_else(|| fallback_timestamp.map(|s| s.to_string()))?;

    let json = &parsed.json;
    let message_type = parsed.message_type;

    let (role, content) = match message_type {
        MessageType::User => {
            let content = extract_message_content(json);
            (Some("user".to_string()), content)
        }
        MessageType::Assistant => {
            let content = extract_message_content(json);
            (Some("assistant".to_string()), content)
        }
        MessageType::Summary => {
            let summary = json
                .get("summary")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            (None, summary)
        }
        MessageType::System => {
            let content = extract_message_content(json);
            (Some("system".to_string()), content)
        }
        MessageType::FileHistorySnapshot => (None, None),
        _ => (None, None),
    };

    let (tool_name, tool_input, tool_result) = match message_type {
        MessageType::ToolUse => {
            let name = json
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let input = json.get("input").map(|v| v.to_string());
            (name, input, None)
        }
        MessageType::ToolResult => {
            let name = json
                .get("name")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string());
            let result = json
                .get("result")
                .and_then(|v| v.as_str())
                .map(|s| s.to_string())
                .or_else(|| json.get("result").map(|v| v.to_string()));
            (name, None, result)
        }
        _ => (None, None, None),
    };

    let agent_id = json
        .get("agentId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    let parent_id = match message_type {
        MessageType::ToolResult => json
            .get("toolUseId")
            .or_else(|| json.get("tool_use_id"))
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        MessageType::Progress => json
            .get("parentToolUseID")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        _ => None,
    };

    let (input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens) =
        if message_type == MessageType::Assistant {
            extract_token_usage(json)
        } else {
            (None, None, None, None)
        };

    let (lines_added, lines_removed, files_changed) = if message_type == MessageType::Assistant {
        extract_line_changes(json)
    } else {
        (None, None, None)
    };

    Some(ParsedMessage {
        message_type,
        role,
        content,
        tool_name,
        tool_input,
        tool_result,
        raw_json: parsed.raw_content,
        timestamp,
        uuid: parsed.uuid,
        agent_id,
        parent_id,
        input_tokens,
        output_tokens,
        cache_read_tokens,
        cache_creation_tokens,
        lines_added,
        lines_removed,
        files_changed,
    })
}

/// Extract message content from various JSON structures.
fn extract_message_content(json: &Value) -> Option<String> {
    if let Some(msg) = json.get("message") {
        if let Some(content) = msg.get("content") {
            if let Some(s) = content.as_str() {
                return Some(s.to_string());
            }
            if let Some(arr) = content.as_array() {
                let text_parts: Vec<String> = arr
                    .iter()
                    .filter_map(|item| {
                        let item_type = item.get("type").and_then(|t| t.as_str());
                        if item_type == Some("text") {
                            return item
                                .get("text")
                                .and_then(|t| t.as_str())
                                .map(|s| s.to_string());
                        }
                        if item_type == Some("thinking") {
                            return item
                                .get("thinking")
                                .and_then(|t| t.as_str())
                                .map(|s| s.to_string());
                        }
                        if item_type == Some("tool_use") {
                            let tool_name = item
                                .get("name")
                                .and_then(|n| n.as_str())
                                .unwrap_or("unknown");
                            return Some(format!("[Tool: {}]", tool_name));
                        }
                        if item_type == Some("tool_result") {
                            if let Some(inner) = item.get("content") {
                                if let Some(s) = inner.as_str() {
                                    return Some(s.to_string());
                                }
                                if let Some(inner_arr) = inner.as_array() {
                                    let inner_text: Vec<String> = inner_arr
                                        .iter()
                                        .filter_map(|i| {
                                            if i.get("type").and_then(|t| t.as_str())
                                                == Some("text")
                                            {
                                                i.get("text")
                                                    .and_then(|t| t.as_str())
                                                    .map(|s| s.to_string())
                                            } else {
                                                None
                                            }
                                        })
                                        .collect();
                                    if !inner_text.is_empty() {
                                        return Some(inner_text.join("\n"));
                                    }
                                }
                            }
                        }
                        None
                    })
                    .collect();
                if !text_parts.is_empty() {
                    return Some(text_parts.join("\n"));
                }
            }
        }
    }

    // Fallback: root "content" field
    if let Some(content) = json.get("content") {
        if let Some(s) = content.as_str() {
            return Some(s.to_string());
        }
        if let Some(arr) = content.as_array() {
            let text_parts: Vec<String> = arr
                .iter()
                .filter_map(|item| {
                    if item.get("type").and_then(|t| t.as_str()) == Some("text") {
                        item.get("text")
                            .and_then(|t| t.as_str())
                            .map(|s| s.to_string())
                    } else {
                        None
                    }
                })
                .collect();
            if !text_parts.is_empty() {
                return Some(text_parts.join("\n"));
            }
        }
    }

    None
}

/// Extract token usage from message.usage.
fn extract_token_usage(json: &Value) -> (Option<i64>, Option<i64>, Option<i64>, Option<i64>) {
    let usage = json
        .get("message")
        .and_then(|m| m.get("usage"))
        .or_else(|| json.get("usage"));

    match usage {
        Some(u) => {
            let input = u.get("input_tokens").and_then(|v| v.as_i64());
            let output = u.get("output_tokens").and_then(|v| v.as_i64());
            let cache_read = u.get("cache_read_input_tokens").and_then(|v| v.as_i64());
            let cache_creation = u
                .get("cache_creation_input_tokens")
                .and_then(|v| v.as_i64());
            if input.is_some() || output.is_some() {
                (input, output, cache_read, cache_creation)
            } else {
                (None, None, None, None)
            }
        }
        None => (None, None, None, None),
    }
}

/// Extract line changes from assistant messages with tool_use content blocks.
fn extract_line_changes(json: &Value) -> (Option<i32>, Option<i32>, Option<i32>) {
    let content = json
        .get("message")
        .and_then(|m| m.get("content"))
        .or_else(|| json.get("content"));

    let arr = match content.and_then(|c| c.as_array()) {
        Some(a) => a,
        None => return (None, None, None),
    };

    let mut lines_added: i32 = 0;
    let mut lines_removed: i32 = 0;
    let mut files = HashSet::new();
    let mut found_any = false;

    for block in arr {
        if block.get("type").and_then(|t| t.as_str()) != Some("tool_use") {
            continue;
        }
        let tool_name = block
            .get("name")
            .and_then(|n| n.as_str())
            .unwrap_or("")
            .to_lowercase();
        let input = match block.get("input") {
            Some(i) => i,
            None => continue,
        };

        match tool_name.as_str() {
            "edit" => {
                if let Some(fp) = input.get("file_path").and_then(|v| v.as_str()) {
                    files.insert(fp.to_string());
                    found_any = true;
                    let old_str = input
                        .get("old_string")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let new_str = input
                        .get("new_string")
                        .and_then(|v| v.as_str())
                        .unwrap_or("");
                    let old_lines = old_str.split('\n').count() as i32;
                    let new_lines = new_str.split('\n').count() as i32;
                    if new_lines > old_lines {
                        lines_added += new_lines - old_lines;
                    } else if old_lines > new_lines {
                        lines_removed += old_lines - new_lines;
                    }
                }
            }
            "write" => {
                if let Some(fp) = input.get("file_path").and_then(|v| v.as_str()) {
                    files.insert(fp.to_string());
                    found_any = true;
                    let content_str = input.get("content").and_then(|v| v.as_str()).unwrap_or("");
                    lines_added += content_str.split('\n').count() as i32;
                }
            }
            _ => {}
        }
    }

    if found_any {
        (
            Some(lines_added),
            Some(lines_removed),
            Some(files.len() as i32),
        )
    } else {
        (None, None, None)
    }
}

// ============================================================================
// File classification
// ============================================================================

/// Classification result with extracted IDs.
#[derive(Debug, Clone, PartialEq)]
pub enum ClassifiedFile {
    Main { session_id: String },
    Agent { agent_id: String },
    HanEvents { session_id: String },
    Unknown,
}

fn is_valid_uuid(s: &str) -> bool {
    s.len() >= 32 && s.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

fn is_valid_cli_session_id(s: &str) -> bool {
    s.strip_prefix("cli-").map_or(false, is_valid_uuid)
}

pub fn classify_file(file_path: &Path) -> ClassifiedFile {
    let filename = match file_path.file_stem().and_then(|s| s.to_str()) {
        Some(f) => f,
        None => return ClassifiedFile::Unknown,
    };

    if let Some(agent_id) = filename.strip_prefix("agent-") {
        if !agent_id.is_empty() && agent_id.len() <= 16 {
            return ClassifiedFile::Agent {
                agent_id: agent_id.to_string(),
            };
        }
    }

    if let Some(session_id) = filename.strip_suffix("-han") {
        if is_valid_uuid(session_id) || is_valid_cli_session_id(session_id) {
            return ClassifiedFile::HanEvents {
                session_id: session_id.to_string(),
            };
        }
    }

    let session_id = filename.strip_suffix("_messages").unwrap_or(filename);
    if is_valid_uuid(session_id) {
        return ClassifiedFile::Main {
            session_id: session_id.to_string(),
        };
    }

    ClassifiedFile::Unknown
}

/// Extract session ID from file by classification.
fn extract_session_id(file_path: &Path) -> Option<String> {
    match classify_file(file_path) {
        ClassifiedFile::Main { session_id } => Some(session_id),
        ClassifiedFile::HanEvents { session_id } => Some(session_id),
        ClassifiedFile::Agent { .. } => extract_session_id_from_agent_file(file_path),
        ClassifiedFile::Unknown => None,
    }
}

/// Read first line of an agent file to extract the session ID.
fn extract_session_id_from_agent_file(file_path: &Path) -> Option<String> {
    use std::io::{BufRead, BufReader};
    let file = std::fs::File::open(file_path).ok()?;
    let reader = BufReader::new(file);
    let first_line = reader.lines().next()?.ok()?;
    let json: Value = serde_json::from_str(&first_line).ok()?;
    json.get("sessionId")?.as_str().map(|s| s.to_string())
}

/// Extract project slug from file path.
fn extract_project_slug(file_path: &Path) -> Option<String> {
    let components: Vec<_> = file_path.components().collect();
    for (i, comp) in components.iter().enumerate() {
        if let std::path::Component::Normal(s) = comp {
            if s.to_str() == Some("projects") {
                if let Some(std::path::Component::Normal(slug)) = components.get(i + 1) {
                    return slug.to_str().map(|s| s.to_string());
                }
            }
        }
    }
    None
}

/// Decode project path from slug.
fn decode_project_path(slug: &str) -> String {
    let naive_path = slug.replace('-', "/");
    if Path::new(&naive_path).exists() {
        return naive_path;
    }

    let domain_patterns = [
        ("/github/com/", "/github.com/"),
        ("/gitlab/com/", "/gitlab.com/"),
        ("/bitbucket/org/", "/bitbucket.org/"),
    ];

    let mut candidate = naive_path;
    for (from, to) in domain_patterns {
        if candidate.contains(from) {
            let fixed = candidate.replace(from, to);
            if Path::new(&fixed).exists() {
                return fixed;
            }
            candidate = fixed;
        }
    }
    candidate
}

// ============================================================================
// Han Events
// ============================================================================

fn parse_han_event_line(line: &JsonlLine, ref_base_dir: Option<&Path>) -> Option<ParsedHanEvent> {
    let json: Value = serde_json::from_str(&line.content).ok()?;

    let resolved_json = if let Some(ref_path) = json.get("ref").and_then(|v| v.as_str()) {
        if let Some(base_dir) = ref_base_dir {
            let full_path = base_dir.join(ref_path);
            let content = std::fs::read_to_string(&full_path).ok()?;
            serde_json::from_str(&content).ok()?
        } else {
            json.clone()
        }
    } else {
        json.clone()
    };

    let id = resolved_json
        .get("uuid")
        .or_else(|| resolved_json.get("id"))
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())?;
    let event_type = resolved_json.get("type")?.as_str()?.to_string();
    let timestamp = resolved_json.get("timestamp")?.as_str()?.to_string();
    let agent_id = resolved_json
        .get("agentId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());
    let data = resolved_json.get("data").cloned().unwrap_or(Value::Null);
    let raw_json = serde_json::to_string(&resolved_json).unwrap_or_else(|_| line.content.clone());

    Some(ParsedHanEvent {
        id,
        event_type,
        timestamp,
        agent_id,
        data,
        raw_json,
    })
}

/// Get the Han events file path for a session.
fn get_han_events_path(session_file: &Path) -> Option<std::path::PathBuf> {
    let session_id = extract_session_id(session_file)?;

    // Check same directory first
    let parent = session_file.parent()?;
    let local = parent.join(format!("{}-han.jsonl", session_id));
    if local.exists() {
        return Some(local);
    }

    // Check han memory sessions directory
    let config_dir = std::env::var("CLAUDE_CONFIG_DIR")
        .ok()
        .map(std::path::PathBuf::from)
        .or_else(|| dirs::home_dir().map(|h| h.join(".claude")))?;

    let sessions_dir = config_dir
        .join("han")
        .join("memory")
        .join("personal")
        .join("sessions");

    if !sessions_dir.exists() {
        return None;
    }

    let pattern = format!("-{}-han.jsonl", session_id);
    let entries = std::fs::read_dir(&sessions_dir).ok()?;
    for entry in entries.flatten() {
        let file_name = entry.file_name();
        let file_name_str = file_name.to_string_lossy();
        if file_name_str.ends_with(&pattern) {
            return Some(entry.path());
        }
    }

    None
}

fn read_han_events(han_file: &Path, session_id: &str) -> Vec<ParsedHanEvent> {
    let mut events = Vec::new();
    let mut offset = 0u32;
    let batch_size = 1000u32;

    let ref_base_dir = han_file.parent().map(|p| p.join(session_id));

    while let Ok(result) = jsonl_read_page(han_file, offset, batch_size) {
        if result.lines.is_empty() {
            break;
        }
        for line in &result.lines {
            if let Some(event) = parse_han_event_line(line, ref_base_dir.as_deref()) {
                events.push(event);
            }
        }
        offset = result.next_offset;
        if !result.has_more {
            break;
        }
    }

    events
}

// ============================================================================
// Side-effect helpers
// ============================================================================

fn is_file_modification_tool(tool_name: &str) -> bool {
    matches!(tool_name, "Write" | "Edit" | "NotebookEdit")
}

fn detect_compact_type(raw_json: &str, content: Option<&str>) -> Option<String> {
    if let Ok(json) = serde_json::from_str::<Value>(raw_json) {
        if let Some(msg_type) = json.get("type").and_then(|t| t.as_str()) {
            if msg_type == "auto_compact" || msg_type == "compact" {
                return Some(msg_type.to_string());
            }
        }
        if json
            .get("is_compact")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return Some("compact".to_string());
        }
        if json
            .get("isCompact")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return Some("compact".to_string());
        }
        if json
            .get("auto_compacted")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return Some("auto_compact".to_string());
        }
    }
    if let Some(text) = content {
        if text.contains("This session is being continued from a previous conversation") {
            return Some("continuation".to_string());
        }
    }
    None
}

fn extract_file_path_from_tool_input(tool_name: &str, tool_input: &str) -> Option<String> {
    let input: Value = serde_json::from_str(tool_input).ok()?;
    match tool_name {
        "Write" | "Edit" => input
            .get("file_path")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        "NotebookEdit" => input
            .get("notebook_path")
            .and_then(|v| v.as_str())
            .map(|s| s.to_string()),
        _ => None,
    }
}

async fn record_file_change_from_tool(
    db: &DatabaseConnection,
    session_id: &str,
    tool_name: &str,
    tool_input: &str,
    agent_id: Option<&str>,
) {
    if let Some(raw_path) = extract_file_path_from_tool_input(tool_name, tool_input) {
        let file_path = std::fs::canonicalize(&raw_path)
            .ok()
            .and_then(|p| p.to_str().map(|s| s.to_string()))
            .unwrap_or(raw_path);

        let action = match tool_name {
            "Write" => "created",
            "Edit" | "NotebookEdit" => "modified",
            _ => "modified",
        };

        // Compute SHA256 hash of file after change
        let file_hash_after = compute_file_hash(&file_path);

        let _ = crud::file_changes::record(
            db,
            session_id.to_string(),
            file_path,
            action.to_string(),
            None,
            file_hash_after,
            Some(tool_name.to_string()),
            agent_id.map(|s| s.to_string()),
        )
        .await;
    }
}

fn compute_file_hash(file_path: &str) -> Option<String> {
    use sha2::{Digest, Sha256};
    use std::io::Read;

    let mut file = std::fs::File::open(file_path).ok()?;
    let mut hasher = Sha256::new();
    let mut buffer = [0u8; 8192];
    loop {
        match file.read(&mut buffer) {
            Ok(0) => break,
            Ok(n) => hasher.update(&buffer[..n]),
            Err(_) => return None,
        }
    }
    Some(format!("{:x}", hasher.finalize()))
}

async fn extract_and_save_todos(
    db: &DatabaseConnection,
    session_id: &str,
    message_id: &str,
    tool_input: &str,
    timestamp: &str,
    line_number: i32,
) {
    let input: Value = match serde_json::from_str(tool_input) {
        Ok(v) => v,
        Err(_) => return,
    };
    let todos = match input.get("todos") {
        Some(t) if t.is_array() => t,
        _ => return,
    };
    let todos_json = match serde_json::to_string(todos) {
        Ok(s) => s,
        Err(_) => return,
    };
    let _ = crud::session_todos::upsert(
        db,
        session_id.to_string(),
        message_id.to_string(),
        todos_json,
        timestamp.to_string(),
        line_number,
    )
    .await;
}

fn md5_hash(input: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    hasher.finish()
}

async fn extract_and_save_task_create(
    db: &DatabaseConnection,
    session_id: &str,
    message_id: &str,
    tool_input: &str,
    timestamp: &str,
    line_number: i32,
) {
    let input: Value = match serde_json::from_str(tool_input) {
        Ok(v) => v,
        Err(_) => return,
    };
    let subject = match input.get("subject").and_then(|s| s.as_str()) {
        Some(s) => s.to_string(),
        None => return,
    };
    let description = input
        .get("description")
        .and_then(|d| d.as_str())
        .map(|s| s.to_string());
    let active_form = input
        .get("activeForm")
        .and_then(|a| a.as_str())
        .map(|s| s.to_string());
    let task_id = format!("{:x}", md5_hash(&format!("{}{}", session_id, subject)));

    let _ = crud::native_tasks::create(
        db,
        task_id,
        session_id.to_string(),
        message_id.to_string(),
        subject,
        description,
        active_form,
        timestamp.to_string(),
        line_number,
    )
    .await;
}

async fn extract_and_save_task_update(
    db: &DatabaseConnection,
    session_id: &str,
    message_id: &str,
    tool_input: &str,
    timestamp: &str,
    line_number: i32,
) {
    let input: Value = match serde_json::from_str(tool_input) {
        Ok(v) => v,
        Err(_) => return,
    };
    let task_id = match input.get("taskId").and_then(|t| t.as_str()) {
        Some(id) => id.to_string(),
        None => return,
    };
    let status = input
        .get("status")
        .and_then(|s| s.as_str())
        .map(|s| s.to_string());
    let subject = input
        .get("subject")
        .and_then(|s| s.as_str())
        .map(|s| s.to_string());
    let description = input
        .get("description")
        .and_then(|d| d.as_str())
        .map(|s| s.to_string());
    let active_form = input
        .get("activeForm")
        .and_then(|a| a.as_str())
        .map(|s| s.to_string());
    let owner = input
        .get("owner")
        .and_then(|o| o.as_str())
        .map(|s| s.to_string());
    let add_blocks: Option<Vec<String>> = input.get("addBlocks").and_then(|b| {
        b.as_array().map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
    });
    let add_blocked_by: Option<Vec<String>> = input.get("addBlockedBy").and_then(|b| {
        b.as_array().map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        })
    });

    let _ = crud::native_tasks::update(
        db,
        &task_id,
        session_id,
        message_id.to_string(),
        status,
        subject,
        description,
        active_form,
        owner,
        add_blocks,
        add_blocked_by,
        timestamp.to_string(),
        line_number,
    )
    .await;
}

fn compute_sentiment(
    content: &str,
) -> (Option<f64>, Option<String>, Option<f64>, Option<String>) {
    match sentiment::analyze_sentiment(content) {
        Some(result) => (
            Some(result.sentiment_score),
            Some(result.sentiment_level.as_str().to_string()),
            result.frustration_score,
            result.frustration_level.map(|f| f.as_str().to_string()),
        ),
        None => (None, None, None, None),
    }
}

/// Convert a parsed message into a SeaORM ActiveModel.
fn to_active_model(
    id: String,
    session_id: &str,
    agent_id: Option<String>,
    parent_id: Option<String>,
    message_type: &str,
    role: Option<String>,
    content: Option<String>,
    tool_name: Option<String>,
    tool_input: Option<String>,
    tool_result: Option<String>,
    raw_json: Option<String>,
    timestamp: String,
    line_number: i32,
    source_file_name: Option<String>,
    source_file_type: Option<String>,
    sentiment_score: Option<f64>,
    sentiment_level: Option<String>,
    frustration_score: Option<f64>,
    frustration_level: Option<String>,
    input_tokens: Option<i64>,
    output_tokens: Option<i64>,
    cache_read_tokens: Option<i64>,
    cache_creation_tokens: Option<i64>,
    lines_added: Option<i32>,
    lines_removed: Option<i32>,
    files_changed: Option<i32>,
) -> messages::ActiveModel {
    messages::ActiveModel {
        id: Set(id),
        session_id: Set(session_id.to_string()),
        agent_id: Set(agent_id),
        parent_id: Set(parent_id),
        message_type: Set(message_type.to_string()),
        role: Set(role),
        content: Set(content),
        tool_name: Set(tool_name),
        tool_input: Set(tool_input),
        tool_result: Set(tool_result),
        raw_json: Set(raw_json),
        timestamp: Set(timestamp),
        line_number: Set(line_number),
        source_file_name: Set(source_file_name),
        source_file_type: Set(source_file_type),
        sentiment_score: Set(sentiment_score),
        sentiment_level: Set(sentiment_level),
        frustration_score: Set(frustration_score),
        frustration_level: Set(frustration_level),
        input_tokens: Set(input_tokens.map(|v| v as i32)),
        output_tokens: Set(output_tokens.map(|v| v as i32)),
        cache_read_tokens: Set(cache_read_tokens.map(|v| v as i32)),
        cache_creation_tokens: Set(cache_creation_tokens.map(|v| v as i32)),
        lines_added: Set(lines_added),
        lines_removed: Set(lines_removed),
        files_changed: Set(files_changed),
        indexed_at: Set(Some(Utc::now().to_rfc3339())),
    }
}

// ============================================================================
// Main indexing functions
// ============================================================================

/// Index a single JSONL file incrementally.
pub async fn index_session_file(
    db: &DatabaseConnection,
    file_path: &str,
    source_config_dir: Option<&str>,
) -> ProcessorResult<IndexResult> {
    let path = Path::new(file_path);
    let source_file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string());
    let source_file_type = match classify_file(path) {
        ClassifiedFile::Main { .. } => Some("main".to_string()),
        ClassifiedFile::Agent { .. } => Some("agent".to_string()),
        ClassifiedFile::HanEvents { .. } => Some("han_events".to_string()),
        ClassifiedFile::Unknown => None,
    };

    let session_id = match extract_session_id(path) {
        Some(id) => id,
        None => {
            return Ok(IndexResult {
                session_id: String::new(),
                messages_indexed: 0,
                total_messages: 0,
                is_new_session: false,
                error: Some("Could not extract session ID from filename".to_string()),
            });
        }
    };

    // Get or create project
    let project_slug = extract_project_slug(path);
    let project_id = if let Some(slug) = &project_slug {
        let decoded_path = decode_project_path(slug);
        let project_name = path
            .parent()
            .and_then(|p| p.file_name())
            .and_then(|n| n.to_str())
            .map(|s| s.to_string())
            .unwrap_or_else(|| slug.clone());

        let project = crud::projects::upsert(
            db,
            None, // repo_id - skip git detection for now
            slug.clone(),
            decoded_path,
            None,
            project_name,
            Some(false),
            source_config_dir.map(|s| s.to_string()),
        )
        .await?;
        Some(project.id)
    } else {
        None
    };

    // Check existing session
    let existing_session = crud::sessions::get(db, &session_id).await?;
    let is_new_session = existing_session.is_none();
    let last_line = existing_session
        .as_ref()
        .and_then(|s| s.last_indexed_line)
        .unwrap_or(0);

    // Upsert session
    crud::sessions::upsert(
        db,
        session_id.clone(),
        project_id.clone(),
        Some("active".to_string()),
        Some(file_path.to_string()),
        None,
        source_config_dir.map(|s| s.to_string()),
    )
    .await?;

    // Read new lines from JSONL file
    let start_line = if last_line > 0 {
        (last_line + 1) as u32
    } else {
        0
    };

    // Pass 1: Read all lines, build uuid→timestamp map
    let batch_size = 1000u32;
    let mut offset = start_line;
    let mut intermediate_lines: Vec<IntermediateParsedLine> = Vec::new();
    let mut uuid_to_timestamp: HashMap<String, String> = HashMap::new();
    let mut max_line = last_line;
    let mut session_slug: Option<String> = None;

    loop {
        let result = jsonl_read_page(path, offset, batch_size)?;
        if result.lines.is_empty() {
            break;
        }
        for line in &result.lines {
            if let Some(parsed) = parse_jsonl_line_intermediate(line) {
                if let Some(ref ts) = parsed.direct_timestamp {
                    uuid_to_timestamp.insert(parsed.uuid.clone(), ts.clone());
                }
                if parsed.message_type == MessageType::FileHistorySnapshot {
                    if let Some(ts) = parsed
                        .json
                        .get("snapshot")
                        .and_then(|s| s.get("timestamp"))
                        .and_then(|t| t.as_str())
                    {
                        uuid_to_timestamp.insert(parsed.uuid.clone(), ts.to_string());
                    }
                }
                if session_slug.is_none() {
                    if let Some(slug) = parsed.json.get("slug").and_then(|s| s.as_str()) {
                        session_slug = Some(slug.to_string());
                    }
                }
                if line.line_number as i32 > max_line {
                    max_line = line.line_number as i32;
                }
                intermediate_lines.push(parsed);
            }
        }
        offset = result.next_offset;
        if !result.has_more {
            break;
        }
    }

    // Build task timeline for sentiment task association
    let task_timeline = build_task_timeline(db).await;

    // Pass 2: Finalize messages and insert in batches
    let mut total_indexed = 0u32;
    let mut messages_batch: Vec<messages::ActiveModel> = Vec::new();
    let mut last_known_timestamp: Option<String> = None;

    for parsed in intermediate_lines {
        let line_number = parsed.line_number;
        if let Some(finalized) =
            finalize_parsed_message(parsed, &uuid_to_timestamp, last_known_timestamp.as_deref())
        {
            last_known_timestamp = Some(finalized.timestamp.clone());
            let is_user_message = finalized.message_type == MessageType::User;
            let message_content = finalized.content.clone();
            let message_id = finalized.uuid.clone();
            let message_timestamp = finalized.timestamp.clone();

            // Process tool side-effects
            if finalized.message_type == MessageType::ToolUse {
                if let (Some(ref tn), Some(ref ti)) = (&finalized.tool_name, &finalized.tool_input)
                {
                    if is_file_modification_tool(tn) {
                        record_file_change_from_tool(
                            db,
                            &session_id,
                            tn,
                            ti,
                            finalized.agent_id.as_deref(),
                        )
                        .await;
                    }
                    if tn == "TodoWrite" {
                        extract_and_save_todos(
                            db,
                            &session_id,
                            &message_id,
                            ti,
                            &message_timestamp,
                            line_number,
                        )
                        .await;
                    }
                    if tn == "TaskCreate" {
                        extract_and_save_task_create(
                            db,
                            &session_id,
                            &message_id,
                            ti,
                            &message_timestamp,
                            line_number,
                        )
                        .await;
                    }
                    if tn == "TaskUpdate" {
                        extract_and_save_task_update(
                            db,
                            &session_id,
                            &message_id,
                            ti,
                            &message_timestamp,
                            line_number,
                        )
                        .await;
                    }
                }
            }

            // Process assistant message tool_use content blocks
            if finalized.message_type == MessageType::Assistant {
                if let Ok(json) = serde_json::from_str::<Value>(&finalized.raw_json) {
                    if let Some(content) = json
                        .get("message")
                        .and_then(|m| m.get("content"))
                        .and_then(|c| c.as_array())
                    {
                        for item in content {
                            if item.get("type").and_then(|t| t.as_str()) == Some("tool_use") {
                                if let Some(tool_name) = item.get("name").and_then(|n| n.as_str()) {
                                    if is_file_modification_tool(tool_name) {
                                        if let Some(input) = item.get("input") {
                                            let input_str = input.to_string();
                                            record_file_change_from_tool(
                                                db,
                                                &session_id,
                                                tool_name,
                                                &input_str,
                                                finalized.agent_id.as_deref(),
                                            )
                                            .await;
                                        }
                                    }
                                    if tool_name == "TodoWrite" {
                                        if let Some(input) = item.get("input") {
                                            extract_and_save_todos(
                                                db,
                                                &session_id,
                                                &message_id,
                                                &input.to_string(),
                                                &message_timestamp,
                                                line_number,
                                            )
                                            .await;
                                        }
                                    }
                                    if tool_name == "TaskCreate" {
                                        if let Some(input) = item.get("input") {
                                            extract_and_save_task_create(
                                                db,
                                                &session_id,
                                                &message_id,
                                                &input.to_string(),
                                                &message_timestamp,
                                                line_number,
                                            )
                                            .await;
                                        }
                                    }
                                    if tool_name == "TaskUpdate" {
                                        if let Some(input) = item.get("input") {
                                            extract_and_save_task_update(
                                                db,
                                                &session_id,
                                                &message_id,
                                                &input.to_string(),
                                                &message_timestamp,
                                                line_number,
                                            )
                                            .await;
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Process summary/compact messages
            if finalized.message_type == MessageType::Summary {
                let compact_type =
                    detect_compact_type(&finalized.raw_json, finalized.content.as_deref());
                if let Some(ct) = compact_type {
                    let _ = crud::session_compacts::upsert(
                        db,
                        session_id.clone(),
                        finalized.uuid.clone(),
                        finalized.content.clone(),
                        Some(finalized.raw_json.clone()),
                        finalized.timestamp.clone(),
                        line_number,
                        Some(ct),
                    )
                    .await;
                } else {
                    let _ = crud::session_summaries::upsert(
                        db,
                        session_id.clone(),
                        finalized.uuid.clone(),
                        finalized.content.clone(),
                        Some(finalized.raw_json.clone()),
                        finalized.timestamp.clone(),
                        line_number,
                    )
                    .await;
                }
            } else if is_user_message {
                if let Some(ref content) = message_content {
                    if content
                        .contains("This session is being continued from a previous conversation")
                    {
                        let _ = crud::session_compacts::upsert(
                            db,
                            session_id.clone(),
                            finalized.uuid.clone(),
                            Some(content.clone()),
                            Some(finalized.raw_json.clone()),
                            finalized.timestamp.clone(),
                            line_number,
                            Some("continuation".to_string()),
                        )
                        .await;
                    }
                }
            }

            // Compute sentiment for user messages
            let (sentiment_score, sentiment_level, frustration_score, frustration_level) =
                if is_user_message {
                    if let Some(ref content) = message_content {
                        compute_sentiment(content)
                    } else {
                        (None, None, None, None)
                    }
                } else {
                    (None, None, None, None)
                };

            messages_batch.push(to_active_model(
                finalized.uuid.clone(),
                &session_id,
                finalized.agent_id.clone(),
                finalized.parent_id,
                finalized.message_type.as_str(),
                finalized.role,
                finalized.content,
                finalized.tool_name,
                finalized.tool_input,
                finalized.tool_result,
                Some(finalized.raw_json.clone()),
                finalized.timestamp.clone(),
                line_number,
                source_file_name.clone(),
                source_file_type.clone(),
                sentiment_score,
                sentiment_level.clone(),
                frustration_score,
                frustration_level.clone(),
                finalized.input_tokens,
                finalized.output_tokens,
                finalized.cache_read_tokens,
                finalized.cache_creation_tokens,
                finalized.lines_added,
                finalized.lines_removed,
                finalized.files_changed,
            ));

            // Generate sentiment analysis event for user messages
            if is_user_message {
                if let Some(content) = &message_content {
                    if let Some(sentiment_event) = generate_sentiment_event(
                        &message_id,
                        content,
                        &message_timestamp,
                        &session_id,
                        &task_timeline,
                        line_number,
                    ) {
                        messages_batch.push(sentiment_event);
                    }
                }
            }

            // Batch insert every 100 messages
            if messages_batch.len() >= 100 {
                let count =
                    crud::messages::insert_batch(db, std::mem::take(&mut messages_batch)).await?;
                total_indexed += count as u32;
            }
        }
    }

    // Insert remaining Claude messages
    if !messages_batch.is_empty() {
        let count = crud::messages::insert_batch(db, std::mem::take(&mut messages_batch)).await?;
        total_indexed += count as u32;
    }

    // =========================================================================
    // Han Events: Read and insert from -han.jsonl file
    // =========================================================================
    const HAN_LINE_OFFSET: i32 = 1_000_000;

    if let Some(han_file) = get_han_events_path(path) {
        let han_events = read_han_events(&han_file, &session_id);
        let han_file_name = han_file
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_string());

        for (idx, event) in han_events.into_iter().enumerate() {
            // Process task events from Han events
            let _ = process_task_event(db, &event, &session_id).await;
            // Process validation cache events
            let _ = process_validation_cache_event(db, &event, &session_id).await;

            let ln = HAN_LINE_OFFSET + (idx as i32);
            let content = serde_json::to_string(&event.data).ok();
            let tool_name = Some(event.event_type.clone());

            messages_batch.push(to_active_model(
                event.id,
                &session_id,
                event.agent_id,
                None,
                "han_event",
                None,
                content,
                tool_name,
                None,
                None,
                Some(event.raw_json),
                event.timestamp,
                ln,
                han_file_name.clone(),
                Some("han_events".to_string()),
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
                None,
            ));

            if messages_batch.len() >= 100 {
                let count =
                    crud::messages::insert_batch(db, std::mem::take(&mut messages_batch)).await?;
                total_indexed += count as u32;
            }
        }

        if !messages_batch.is_empty() {
            let count = crud::messages::insert_batch(db, messages_batch).await?;
            total_indexed += count as u32;
        }
    }

    // Update last indexed line
    if max_line > last_line {
        crud::sessions::update_last_indexed_line(db, &session_id, max_line).await?;
    }

    // Update session slug if found
    if session_slug.is_some() {
        crud::sessions::upsert(
            db,
            session_id.clone(),
            project_id,
            Some("active".to_string()),
            Some(file_path.to_string()),
            session_slug,
            source_config_dir.map(|s| s.to_string()),
        )
        .await?;
    }

    let total_messages = crud::messages::get_count(db, &session_id).await?;

    Ok(IndexResult {
        session_id,
        messages_indexed: total_indexed,
        total_messages: total_messages as u32,
        is_new_session,
        error: None,
    })
}

/// Generate a sentiment analysis event message for a user message.
fn generate_sentiment_event(
    message_id: &str,
    message_content: &str,
    message_timestamp: &str,
    session_id: &str,
    task_timeline: &TaskTimeline,
    line_number: i32,
) -> Option<messages::ActiveModel> {
    let result = sentiment::analyze_sentiment(message_content)?;

    let event_id = format!("evt_{}", &Uuid::new_v4().to_string().replace('-', "")[..12]);

    let event_timestamp = if let Ok(parsed) = DateTime::parse_from_rfc3339(message_timestamp) {
        let new_time = parsed.with_timezone(&Utc) + Duration::milliseconds(1);
        new_time.to_rfc3339()
    } else {
        Utc::now().to_rfc3339()
    };

    let task_id = DateTime::parse_from_rfc3339(message_timestamp)
        .ok()
        .and_then(|ts| {
            task_timeline
                .find_active_task(&ts.with_timezone(&Utc))
                .map(String::from)
        });

    let mut data = serde_json::json!({
        "message_id": message_id,
        "sentiment_score": result.sentiment_score,
        "sentiment_level": result.sentiment_level.as_str(),
        "signals": result.signals,
    });
    if let Some(score) = result.frustration_score {
        data["frustration_score"] = serde_json::json!(score);
    }
    if let Some(level) = result.frustration_level {
        data["frustration_level"] = serde_json::json!(level.as_str());
    }
    if let Some(ref tid) = task_id {
        data["task_id"] = serde_json::json!(tid);
    }

    let raw_event = serde_json::json!({
        "id": event_id,
        "type": "sentiment_analysis",
        "timestamp": event_timestamp,
        "data": data,
    });

    Some(to_active_model(
        event_id,
        session_id,
        None,
        Some(message_id.to_string()),
        "han_event",
        None,
        Some(serde_json::to_string(&data).unwrap_or_default()),
        Some("sentiment_analysis".to_string()),
        None,
        None,
        Some(serde_json::to_string(&raw_event).unwrap_or_default()),
        event_timestamp,
        line_number + 500_000,
        None,
        Some("generated".to_string()),
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
        None,
    ))
}

/// Process task events from Han events.
async fn process_task_event(
    db: &DatabaseConnection,
    event: &ParsedHanEvent,
    session_id: &str,
) -> ProcessorResult<bool> {
    match event.event_type.as_str() {
        "task_start" => {
            let task_id = event.data.get("task_id").and_then(|v| v.as_str());
            let description = event
                .data
                .get("description")
                .and_then(|v| v.as_str())
                .unwrap_or("Unknown task");
            let task_type = event
                .data
                .get("task_type")
                .and_then(|v| v.as_str())
                .unwrap_or("unknown");

            if let Some(tid) = task_id {
                let _ = crud::tasks::create(
                    db,
                    Some(session_id.to_string()),
                    tid.to_string(),
                    description.to_string(),
                    task_type.to_string(),
                )
                .await;
            }
            Ok(true)
        }
        "task_complete" => {
            let task_id = event.data.get("task_id").and_then(|v| v.as_str());
            if let Some(tid) = task_id {
                let outcome = event
                    .data
                    .get("outcome")
                    .and_then(|v| v.as_str())
                    .unwrap_or("unknown");
                let confidence = event
                    .data
                    .get("confidence")
                    .and_then(|v| v.as_f64())
                    .unwrap_or(0.0);
                let notes = event
                    .data
                    .get("notes")
                    .and_then(|v| v.as_str())
                    .map(String::from);
                let files_modified: Option<Vec<String>> =
                    event.data.get("files_modified").and_then(|v| {
                        v.as_array().map(|arr| {
                            arr.iter()
                                .filter_map(|v| v.as_str().map(String::from))
                                .collect()
                        })
                    });
                let tests_added = event
                    .data
                    .get("tests_added")
                    .and_then(|v| v.as_i64())
                    .map(|v| v as i32);

                let _ = crud::tasks::complete(
                    db,
                    tid,
                    outcome.to_string(),
                    confidence,
                    notes,
                    files_modified,
                    tests_added,
                )
                .await;
            }
            Ok(true)
        }
        "task_fail" => {
            let task_id = event.data.get("task_id").and_then(|v| v.as_str());
            if let Some(tid) = task_id {
                let reason = event
                    .data
                    .get("reason")
                    .and_then(|v| v.as_str())
                    .unwrap_or("Unknown reason");
                let confidence = event.data.get("confidence").and_then(|v| v.as_f64());
                let notes = event
                    .data
                    .get("notes")
                    .and_then(|v| v.as_str())
                    .map(String::from);

                let _ = crud::tasks::fail(
                    db,
                    tid,
                    reason.to_string(),
                    confidence,
                    notes,
                )
                .await;
            }
            Ok(true)
        }
        _ => Ok(false),
    }
}

/// Process validation cache events.
async fn process_validation_cache_event(
    db: &DatabaseConnection,
    event: &ParsedHanEvent,
    session_id: &str,
) -> ProcessorResult<bool> {
    if event.event_type != "hook_validation_cache" {
        return Ok(false);
    }

    let plugin = event.data.get("plugin").and_then(|v| v.as_str());
    let hook = event.data.get("hook").and_then(|v| v.as_str());
    let directory = event.data.get("directory").and_then(|v| v.as_str());
    let command_hash = event.data.get("command_hash").and_then(|v| v.as_str());
    let files = event.data.get("files").and_then(|v| v.as_object());

    if let (Some(plugin), Some(hook), Some(directory), Some(command_hash), Some(files)) =
        (plugin, hook, directory, command_hash, files)
    {
        for (file_path, file_hash_value) in files {
            let file_hash = file_hash_value.as_str().unwrap_or("");
            let _ = crud::file_validations::record(
                db,
                session_id.to_string(),
                file_path.clone(),
                file_hash.to_string(),
                plugin.to_string(),
                hook.to_string(),
                directory.to_string(),
                command_hash.to_string(),
            )
            .await;
        }
    }

    Ok(true)
}

/// Index all JSONL files in a project directory.
pub async fn index_project_directory(
    db: &DatabaseConnection,
    project_dir: &str,
    source_config_dir: Option<&str>,
) -> ProcessorResult<Vec<IndexResult>> {
    let dir = Path::new(project_dir);
    if !dir.exists() || !dir.is_dir() {
        return Ok(Vec::new());
    }

    let entries = std::fs::read_dir(dir)?;

    let mut main_files = Vec::new();
    let mut agent_files = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            match classify_file(&path) {
                ClassifiedFile::Main { .. } => main_files.push(path),
                ClassifiedFile::Agent { .. } => agent_files.push(path),
                ClassifiedFile::HanEvents { .. } => {} // Processed with main file
                ClassifiedFile::Unknown => {}
            }
        }
    }

    let mut results = Vec::new();

    for path in &main_files {
        let result =
            index_session_file(db, &path.to_string_lossy(), source_config_dir).await?;
        results.push(result);
    }

    for path in &agent_files {
        let result =
            index_session_file(db, &path.to_string_lossy(), source_config_dir).await?;
        results.push(result);
    }

    Ok(results)
}

/// Handle a file event from the watcher.
pub async fn handle_file_event(
    db: &DatabaseConnection,
    event_type: FileEventType,
    file_path: &str,
    session_id: Option<String>,
) -> ProcessorResult<Option<IndexResult>> {
    let path = Path::new(file_path);
    let filename = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");

    match event_type {
        FileEventType::Created | FileEventType::Modified => {
            // If this is a Han events file, find and index the main session file
            if filename.ends_with("-han") {
                let sid = extract_session_id(path);
                if let Some(sid) = sid {
                    if let Some(dir) = path.parent() {
                        let main_file = dir.join(format!("{}.jsonl", sid));
                        if main_file.exists() {
                            let result = index_session_file(
                                db,
                                &main_file.to_string_lossy(),
                                None,
                            )
                            .await?;
                            return Ok(Some(result));
                        }
                    }
                }
                return Ok(None);
            }

            let result = index_session_file(db, file_path, None).await?;
            Ok(Some(result))
        }
        FileEventType::Removed => {
            if let Some(sid) = session_id {
                crud::sessions::end_session(db, &sid).await?;
            }
            Ok(None)
        }
    }
}

/// Perform a full scan and index of all Claude Code sessions.
pub async fn full_scan_and_index(db: &DatabaseConnection) -> ProcessorResult<Vec<IndexResult>> {
    let mut results = Vec::new();

    let config_dirs = crud::config_dirs::list(db).await?;

    let home = dirs::home_dir().ok_or_else(|| {
        ProcessorError::Other("Could not determine home directory".to_string())
    })?;
    let default_claude_dir = home.join(".claude");

    let mut dirs_to_scan: Vec<std::path::PathBuf> = config_dirs
        .iter()
        .map(|cd| std::path::PathBuf::from(&cd.path))
        .collect();

    if !dirs_to_scan.iter().any(|p| p == &default_claude_dir) {
        dirs_to_scan.push(default_claude_dir);
    }

    tracing::info!(
        "Full scan: scanning {} config directories",
        dirs_to_scan.len()
    );

    for config_dir in dirs_to_scan {
        let projects_dir = config_dir.join("projects");
        if !projects_dir.exists() {
            continue;
        }

        tracing::info!("Scanning projects in: {:?}", projects_dir);

        let entries = match std::fs::read_dir(&projects_dir) {
            Ok(e) => e,
            Err(e) => {
                tracing::warn!(
                    "Failed to read projects directory {:?}: {}",
                    projects_dir,
                    e
                );
                continue;
            }
        };

        for entry in entries.flatten() {
            let path = entry.path();
            if path.is_dir() {
                let config_dir_str = config_dir.to_string_lossy().to_string();
                match index_project_directory(
                    db,
                    &path.to_string_lossy(),
                    Some(&config_dir_str),
                )
                .await
                {
                    Ok(project_results) => results.extend(project_results),
                    Err(e) => {
                        tracing::warn!("Failed to index project {:?}: {}", path, e);
                    }
                }
            }
        }
    }

    tracing::info!(
        "Full scan complete: indexed {} sessions, {} total messages",
        results.len(),
        results.iter().map(|r| r.messages_indexed).sum::<u32>()
    );

    Ok(results)
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_classify_file_main() {
        let path = Path::new("/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678.jsonl");
        assert!(matches!(classify_file(path), ClassifiedFile::Main { .. }));
    }

    #[test]
    fn test_classify_file_main_messages() {
        let path = Path::new("/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678_messages.jsonl");
        assert!(matches!(classify_file(path), ClassifiedFile::Main { .. }));
    }

    #[test]
    fn test_classify_file_agent() {
        let path = Path::new("/home/user/.claude/projects/test/agent-abc123.jsonl");
        assert!(matches!(classify_file(path), ClassifiedFile::Agent { .. }));
    }

    #[test]
    fn test_classify_file_han_events() {
        let path = Path::new("/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678-han.jsonl");
        assert!(matches!(classify_file(path), ClassifiedFile::HanEvents { .. }));
    }

    #[test]
    fn test_classify_file_cli_han() {
        let path = Path::new("/home/user/.claude/projects/test/cli-abc12345-1234-5678-9abc-def012345678-han.jsonl");
        assert!(matches!(classify_file(path), ClassifiedFile::HanEvents { .. }));
    }

    #[test]
    fn test_classify_file_unknown() {
        let path = Path::new("/home/user/.claude/projects/test/short.jsonl");
        assert!(matches!(classify_file(path), ClassifiedFile::Unknown));
    }

    #[test]
    fn test_is_valid_uuid() {
        assert!(is_valid_uuid("abc12345-1234-5678-9abc-def012345678"));
        assert!(!is_valid_uuid("short"));
    }

    #[test]
    fn test_is_valid_cli_session_id() {
        assert!(is_valid_cli_session_id("cli-abc12345-1234-5678-9abc-def012345678"));
        assert!(!is_valid_cli_session_id("abc12345-1234-5678-9abc-def012345678"));
        assert!(!is_valid_cli_session_id("cli-short"));
    }

    #[test]
    fn test_extract_project_slug() {
        let path = Path::new("/home/user/.claude/projects/Volumes-dev-src-myproject/session.jsonl");
        assert_eq!(
            extract_project_slug(path),
            Some("Volumes-dev-src-myproject".to_string())
        );
    }

    #[test]
    fn test_message_type_parsing() {
        assert_eq!(MessageType::from_str("user"), MessageType::User);
        assert_eq!(MessageType::from_str("assistant"), MessageType::Assistant);
        assert_eq!(MessageType::from_str("tool_use"), MessageType::ToolUse);
        assert_eq!(
            MessageType::from_str("file-history-snapshot"),
            MessageType::FileHistorySnapshot
        );
        assert_eq!(MessageType::from_str("han_event"), MessageType::HanEvent);
        assert_eq!(MessageType::from_str("unknown_type"), MessageType::Unknown);
    }

    #[test]
    fn test_extract_token_usage() {
        let json: Value = serde_json::from_str(
            r#"{"message":{"usage":{"input_tokens":100,"output_tokens":50,"cache_read_input_tokens":10}}}"#
        ).unwrap();
        let (input, output, cache_read, cache_creation) = extract_token_usage(&json);
        assert_eq!(input, Some(100));
        assert_eq!(output, Some(50));
        assert_eq!(cache_read, Some(10));
        assert_eq!(cache_creation, None);
    }

    #[test]
    fn test_extract_token_usage_none() {
        let json: Value = serde_json::from_str(r#"{"message":{}}"#).unwrap();
        let (input, output, _, _) = extract_token_usage(&json);
        assert!(input.is_none());
        assert!(output.is_none());
    }

    #[test]
    fn test_extract_line_changes_edit() {
        let json: Value = serde_json::from_str(r#"{"message":{"content":[{"type":"tool_use","name":"Edit","input":{"file_path":"/test.rs","old_string":"a\nb","new_string":"a\nb\nc\nd"}}]}}"#).unwrap();
        let (added, removed, files) = extract_line_changes(&json);
        assert_eq!(added, Some(2));
        assert_eq!(removed, Some(0));
        assert_eq!(files, Some(1));
    }

    #[test]
    fn test_extract_line_changes_write() {
        let json: Value = serde_json::from_str(r#"{"message":{"content":[{"type":"tool_use","name":"Write","input":{"file_path":"/test.rs","content":"line1\nline2\nline3"}}]}}"#).unwrap();
        let (added, removed, files) = extract_line_changes(&json);
        assert_eq!(added, Some(3));
        assert_eq!(removed, Some(0));
        assert_eq!(files, Some(1));
    }

    #[test]
    fn test_extract_message_content_string() {
        let json: Value =
            serde_json::from_str(r#"{"message":{"content":"Hello world"}}"#).unwrap();
        assert_eq!(
            extract_message_content(&json),
            Some("Hello world".to_string())
        );
    }

    #[test]
    fn test_extract_message_content_array() {
        let json: Value = serde_json::from_str(
            r#"{"message":{"content":[{"type":"text","text":"Hello"},{"type":"text","text":"world"}]}}"#
        ).unwrap();
        assert_eq!(
            extract_message_content(&json),
            Some("Hello\nworld".to_string())
        );
    }

    #[test]
    fn test_detect_compact_type() {
        assert_eq!(
            detect_compact_type(r#"{"type":"auto_compact"}"#, None),
            Some("auto_compact".to_string())
        );
        assert_eq!(
            detect_compact_type(r#"{"type":"compact"}"#, None),
            Some("compact".to_string())
        );
        assert_eq!(
            detect_compact_type(r#"{"isCompact":true}"#, None),
            Some("compact".to_string())
        );
        assert_eq!(
            detect_compact_type(
                r#"{}"#,
                Some("This session is being continued from a previous conversation")
            ),
            Some("continuation".to_string())
        );
        assert_eq!(detect_compact_type(r#"{}"#, None), None);
    }

    #[test]
    fn test_parse_han_event_line() {
        let line = JsonlLine {
            line_number: 1,
            byte_offset: 0,
            content: r#"{"id":"evt_abc123","type":"hook_run","timestamp":"2024-01-01T00:00:00Z","data":{"plugin":"test","hook":"lint"}}"#.to_string(),
        };
        let parsed = parse_han_event_line(&line, None).unwrap();
        assert_eq!(parsed.id, "evt_abc123");
        assert_eq!(parsed.event_type, "hook_run");
        assert_eq!(parsed.timestamp, "2024-01-01T00:00:00Z");
    }
}
