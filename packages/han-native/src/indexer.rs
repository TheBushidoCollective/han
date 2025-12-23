//! Session indexer - populates database from JSONL files
//!
//! This module is the bridge between JSONL files (Claude Code transcripts) and
//! the SurrealKV database. It runs in the coordinator process and incrementally
//! indexes session data.

use crate::crud;
use crate::db;
use crate::jsonl::{jsonl_read_page, JsonlLine};
use crate::schema::{MessageInput, ProjectInput, SessionInput};
use crate::watcher::FileEventType;
use napi_derive::napi;
use serde_json::Value;
use std::path::Path;
use uuid::Uuid;

// ============================================================================
// Types
// ============================================================================

/// Result of indexing a single JSONL file
#[napi(object)]
#[derive(Debug, Clone)]
pub struct IndexResult {
    /// Session ID that was indexed
    pub session_id: String,
    /// Number of new messages indexed
    pub messages_indexed: u32,
    /// Total messages in session after indexing
    pub total_messages: u32,
    /// Whether this is a new session
    pub is_new_session: bool,
    /// Any error message
    pub error: Option<String>,
}

/// Claude Code JSONL message types
#[derive(Debug, Clone, Copy, PartialEq)]
pub enum MessageType {
    Summary,
    Human,
    Assistant,
    ToolUse,
    ToolResult,
    System,
    Unknown,
}

impl MessageType {
    fn from_str(s: &str) -> Self {
        match s {
            "summary" => MessageType::Summary,
            "human" => MessageType::Human,
            "assistant" => MessageType::Assistant,
            "tool_use" => MessageType::ToolUse,
            "tool_result" => MessageType::ToolResult,
            "system" => MessageType::System,
            _ => MessageType::Unknown,
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            MessageType::Summary => "summary",
            MessageType::Human => "human",
            MessageType::Assistant => "assistant",
            MessageType::ToolUse => "tool_use",
            MessageType::ToolResult => "tool_result",
            MessageType::System => "system",
            MessageType::Unknown => "unknown",
        }
    }
}

/// Parsed message from JSONL line
#[derive(Debug, Clone)]
struct ParsedMessage {
    message_type: MessageType,
    role: Option<String>,
    content: Option<String>,
    tool_name: Option<String>,
    tool_input: Option<String>,
    tool_result: Option<String>,
    timestamp: String,
    uuid: String,
}

// ============================================================================
// JSONL Parsing
// ============================================================================

/// Parse a single JSONL line into a message
fn parse_jsonl_line(line: &JsonlLine) -> Option<ParsedMessage> {
    let json: Value = serde_json::from_str(&line.content).ok()?;

    let msg_type = json.get("type")?.as_str()?;
    let message_type = MessageType::from_str(msg_type);

    // Get timestamp (required)
    let timestamp = json
        .get("timestamp")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| chrono::Utc::now().to_rfc3339());

    // Get or generate UUID
    let uuid = json
        .get("uuid")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    // Extract role-based content
    let (role, content) = match message_type {
        MessageType::Human => {
            let content = extract_message_content(&json);
            (Some("human".to_string()), content)
        }
        MessageType::Assistant => {
            let content = extract_message_content(&json);
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
            let content = extract_message_content(&json);
            (Some("system".to_string()), content)
        }
        _ => (None, None),
    };

    // Extract tool information
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

    Some(ParsedMessage {
        message_type,
        role,
        content,
        tool_name,
        tool_input,
        tool_result,
        timestamp,
        uuid,
    })
}

/// Extract message content from various JSON structures
fn extract_message_content(json: &Value) -> Option<String> {
    // Try "message" field first (Claude Code format)
    if let Some(msg) = json.get("message") {
        if let Some(s) = msg.as_str() {
            return Some(s.to_string());
        }
        // Could be an array of content blocks
        if let Some(arr) = msg.as_array() {
            let text_parts: Vec<String> = arr
                .iter()
                .filter_map(|item| {
                    if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                        Some(text.to_string())
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

    // Try "content" field
    if let Some(content) = json.get("content") {
        if let Some(s) = content.as_str() {
            return Some(s.to_string());
        }
        if let Some(arr) = content.as_array() {
            let text_parts: Vec<String> = arr
                .iter()
                .filter_map(|item| {
                    if let Some(text) = item.get("text").and_then(|t| t.as_str()) {
                        Some(text.to_string())
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

/// Extract session ID from JSONL file path
/// Format: `{uuid}.jsonl` or `{uuid}_messages.jsonl`
fn extract_session_id(file_path: &Path) -> Option<String> {
    let filename = file_path.file_stem()?.to_str()?;
    let session_id = if filename.ends_with("_messages") {
        filename.strip_suffix("_messages")?
    } else {
        filename
    };
    // Validate it looks like a UUID
    if session_id.len() >= 32 && session_id.chars().all(|c| c.is_ascii_hexdigit() || c == '-') {
        Some(session_id.to_string())
    } else {
        None
    }
}

/// Extract project slug from file path
/// Structure: `~/.claude/projects/{encoded-path}/{session}.jsonl`
fn extract_project_slug(file_path: &Path) -> Option<String> {
    let components: Vec<_> = file_path.components().collect();
    for (i, comp) in components.iter().enumerate() {
        if let std::path::Component::Normal(s) = comp {
            if s.to_str() == Some("projects") {
                if let Some(std::path::Component::Normal(project_slug)) = components.get(i + 1) {
                    return project_slug.to_str().map(|s| s.to_string());
                }
            }
        }
    }
    None
}

/// Decode project path from slug
/// Slug format: `Volumes-dev-src-github-com-user-project`
fn decode_project_path(slug: &str) -> String {
    // Replace dashes with slashes and prepend /
    format!("/{}", slug.replace('-', "/"))
}

// ============================================================================
// Indexing Functions
// ============================================================================

/// Index a single JSONL file incrementally
/// Only processes lines after the last indexed line
pub async fn index_session_file(db_path: String, file_path: String) -> napi::Result<IndexResult> {
    let path = Path::new(&file_path);

    // Extract session ID
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

        // Ensure project exists
        let guard = db::get_db_guard(&db_path).await?;
        let db = guard.as_ref().ok_or_else(|| {
            napi::Error::from_reason("Database not initialized".to_string())
        })?;

        let project = crud::upsert_project(
            db,
            ProjectInput {
                repo_id: None,
                slug: slug.clone(),
                path: decoded_path,
                relative_path: None,
                name: project_name,
                is_worktree: Some(false),
            },
        )
        .await?;

        project.id
    } else {
        None
    };

    // Get database connection
    let guard = db::get_db_guard(&db_path).await?;
    let db = guard.as_ref().ok_or_else(|| {
        napi::Error::from_reason("Database not initialized".to_string())
    })?;

    // Check if session exists and get last indexed line
    let existing_session = crud::get_session(db, &session_id).await?;
    let is_new_session = existing_session.is_none();
    let last_line = if is_new_session {
        0
    } else {
        crud::get_last_indexed_line(db, &session_id).await?
    };

    // Upsert session
    crud::upsert_session(
        db,
        SessionInput {
            project_id: project_id.clone(),
            session_id: session_id.clone(),
            status: Some("active".to_string()),
            transcript_path: Some(file_path.clone()),
        },
    )
    .await?;

    // Read new lines from JSONL file
    let start_line = if last_line > 0 {
        (last_line + 1) as u32
    } else {
        0
    };

    // Read in batches
    let batch_size = 1000u32;
    let mut total_indexed = 0u32;
    let mut offset = start_line;
    let mut messages_batch: Vec<MessageInput> = Vec::new();

    loop {
        let result = jsonl_read_page(file_path.clone(), offset, batch_size)?;

        if result.lines.is_empty() {
            break;
        }

        for line in &result.lines {
            if let Some(parsed) = parse_jsonl_line(line) {
                messages_batch.push(MessageInput {
                    session_id: session_id.clone(),
                    message_id: parsed.uuid,
                    message_type: parsed.message_type.as_str().to_string(),
                    role: parsed.role,
                    content: parsed.content,
                    tool_name: parsed.tool_name,
                    tool_input: parsed.tool_input,
                    tool_result: parsed.tool_result,
                    timestamp: parsed.timestamp,
                    line_number: line.line_number as i32,
                });
            }
        }

        // Insert batch every 100 messages
        if messages_batch.len() >= 100 {
            let count =
                crud::insert_messages_batch(db, &session_id, std::mem::take(&mut messages_batch))
                    .await?;
            total_indexed += count;
        }

        offset = result.next_offset;

        if !result.has_more {
            break;
        }
    }

    // Insert remaining messages
    if !messages_batch.is_empty() {
        let count = crud::insert_messages_batch(db, &session_id, messages_batch).await?;
        total_indexed += count;
    }

    // Get total message count
    let total_messages = crud::get_message_count(db, &session_id).await?;

    Ok(IndexResult {
        session_id,
        messages_indexed: total_indexed,
        total_messages,
        is_new_session,
        error: None,
    })
}

/// Index all JSONL files in a project directory
pub async fn index_project_directory(db_path: String, project_dir: String) -> napi::Result<Vec<IndexResult>> {
    let dir = Path::new(&project_dir);

    if !dir.exists() || !dir.is_dir() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();

    // List all JSONL files
    let entries = std::fs::read_dir(dir).map_err(|e| {
        napi::Error::from_reason(format!("Failed to read directory: {}", e))
    })?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            let result = index_session_file(db_path.clone(), path.to_string_lossy().to_string()).await?;
            results.push(result);
        }
    }

    Ok(results)
}

/// Handle a file event from the watcher
/// This is called by the coordinator when JSONL files change
pub async fn handle_file_event(
    db_path: String,
    event_type: FileEventType,
    file_path: String,
    session_id: Option<String>,
    _project_path: Option<String>,
) -> napi::Result<Option<IndexResult>> {
    match event_type {
        FileEventType::Created | FileEventType::Modified => {
            // Index the file
            let result = index_session_file(db_path, file_path).await?;
            Ok(Some(result))
        }
        FileEventType::Removed => {
            // Optionally mark session as ended
            if let Some(sid) = session_id {
                let guard = db::get_db_guard(&db_path).await?;
                let db = guard.as_ref().ok_or_else(|| {
                    napi::Error::from_reason("Database not initialized".to_string())
                })?;
                crud::end_session(db, &sid).await?;
            }
            Ok(None)
        }
    }
}

/// Perform a full scan and index of all Claude Code sessions
/// This should be called on startup to ensure the database is in sync
pub async fn full_scan_and_index(db_path: String) -> napi::Result<Vec<IndexResult>> {
    // Get the default watch path (~/.claude/projects)
    let home = dirs::home_dir().ok_or_else(|| {
        napi::Error::from_reason("Could not determine home directory".to_string())
    })?;
    let projects_dir = home.join(".claude").join("projects");

    if !projects_dir.exists() {
        return Ok(Vec::new());
    }

    let mut results = Vec::new();

    // Iterate through all project directories
    let entries = std::fs::read_dir(&projects_dir).map_err(|e| {
        napi::Error::from_reason(format!("Failed to read projects directory: {}", e))
    })?;

    for entry in entries.flatten() {
        let path = entry.path();
        if path.is_dir() {
            // Index all JSONL files in this project directory
            let project_results = index_project_directory(db_path.clone(), path.to_string_lossy().to_string()).await?;
            results.extend(project_results);
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
    fn test_extract_session_id() {
        let path = Path::new("/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678.jsonl");
        assert_eq!(
            extract_session_id(path),
            Some("abc12345-1234-5678-9abc-def012345678".to_string())
        );

        let path2 = Path::new("/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678_messages.jsonl");
        assert_eq!(
            extract_session_id(path2),
            Some("abc12345-1234-5678-9abc-def012345678".to_string())
        );

        let path3 = Path::new("/home/user/.claude/projects/test/short.jsonl");
        assert_eq!(extract_session_id(path3), None);
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
    fn test_decode_project_path() {
        assert_eq!(
            decode_project_path("Volumes-dev-src-github-com-user-project"),
            "/Volumes/dev/src/github/com/user/project"
        );
    }

    #[test]
    fn test_message_type_parsing() {
        assert_eq!(MessageType::from_str("human"), MessageType::Human);
        assert_eq!(MessageType::from_str("assistant"), MessageType::Assistant);
        assert_eq!(MessageType::from_str("tool_use"), MessageType::ToolUse);
        assert_eq!(MessageType::from_str("unknown_type"), MessageType::Unknown);
    }
}
