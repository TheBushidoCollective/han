//! Session indexer - populates database from JSONL files
//!
//! This module is the bridge between JSONL files (Claude Code transcripts and
//! Han events) and the SQLite database. It runs in the coordinator process
//! and incrementally indexes session data.
//!
//! Files processed:
//! - `{session-id}.jsonl` - Claude Code transcript messages
//! - `{session-id}-han.jsonl` - Han events (hooks, MCP calls, memory ops)
//!
//! Han events are stored in the messages table with message_type='han_event'
//! and interleaved with Claude messages based on timestamp.
//!
//! IMPORTANT: All database access MUST go through the coordinator.

use crate::crud;
use crate::jsonl::{jsonl_read_page, JsonlLine};
use crate::schema::{
    MessageInput, NativeTaskInput, NativeTaskUpdate, ProjectInput, RepoInput, SessionCompactInput,
    SessionFileChangeInput, SessionFileValidationInput, SessionInput, SessionSummaryInput,
    SessionTodosInput, TaskCompletion, TaskFailure, TaskInput,
};
use crate::sentiment;
use crate::task_timeline::{build_task_timeline, TaskTimeline};
use crate::watcher::FileEventType;
use chrono::{DateTime, Duration, Utc};
use napi_derive::napi;
use serde_json::Value;
use std::path::Path;
use std::sync::OnceLock;
use uuid::Uuid;

// Lazy-loaded task timeline - built once per process from SQLite
static TASK_TIMELINE: OnceLock<TaskTimeline> = OnceLock::new();

fn get_task_timeline() -> &'static TaskTimeline {
    TASK_TIMELINE.get_or_init(build_task_timeline)
}

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
    User,
    Assistant,
    ToolUse,
    ToolResult,
    Progress,
    System,
    FileHistorySnapshot,
    HanEvent,
    Unknown,
}

impl MessageType {
    fn from_str(s: &str) -> Self {
        match s {
            "summary" => MessageType::Summary,
            "user" => MessageType::User,
            "assistant" => MessageType::Assistant,
            "tool_use" => MessageType::ToolUse,
            "tool_result" => MessageType::ToolResult,
            "progress" => MessageType::Progress,
            "system" => MessageType::System,
            "file-history-snapshot" => MessageType::FileHistorySnapshot,
            "han_event" => MessageType::HanEvent,
            _ => MessageType::Unknown,
        }
    }

    fn as_str(&self) -> &'static str {
        match self {
            MessageType::Summary => "summary",
            MessageType::User => "user",
            MessageType::Assistant => "assistant",
            MessageType::ToolUse => "tool_use",
            MessageType::ToolResult => "tool_result",
            MessageType::Progress => "progress",
            MessageType::System => "system",
            MessageType::FileHistorySnapshot => "file-history-snapshot",
            MessageType::HanEvent => "han_event",
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
    raw_json: String,
    timestamp: String,
    uuid: String,
    agent_id: Option<String>,
    parent_id: Option<String>,
    // Token usage (extracted from message.usage)
    input_tokens: Option<i64>,
    output_tokens: Option<i64>,
    cache_read_tokens: Option<i64>,
    cache_creation_tokens: Option<i64>,
    // Line changes (extracted from tool_use content blocks)
    lines_added: Option<i32>,
    lines_removed: Option<i32>,
    files_changed: Option<i32>,
}

// ============================================================================
// JSONL Parsing
// ============================================================================

/// Intermediate parsed line before timestamp resolution
#[derive(Debug, Clone)]
struct IntermediateParsedLine {
    line_number: i32,
    json: Value,
    raw_content: String,
    message_type: MessageType,
    uuid: String,
    /// Direct timestamp from the message, if available
    direct_timestamp: Option<String>,
    /// For summary messages, the leafUuid to look up
    leaf_uuid: Option<String>,
}

/// Extract timestamp from a message based on its type
/// Returns None if no timestamp can be determined (message should be skipped)
fn extract_timestamp(
    parsed: &IntermediateParsedLine,
    uuid_to_timestamp: &std::collections::HashMap<String, String>,
) -> Option<String> {
    // First try direct timestamp at root level
    if let Some(ts) = &parsed.direct_timestamp {
        return Some(ts.clone());
    }

    match parsed.message_type {
        // file-history-snapshot: use snapshot.timestamp
        MessageType::FileHistorySnapshot => parsed
            .json
            .get("snapshot")
            .and_then(|s| s.get("timestamp"))
            .and_then(|t| t.as_str())
            .map(|s| s.to_string()),
        // summary: look up leafUuid's timestamp
        MessageType::Summary => parsed
            .leaf_uuid
            .as_ref()
            .and_then(|leaf_id| uuid_to_timestamp.get(leaf_id).cloned()),
        // Other types must have a direct timestamp or be skipped
        _ => None,
    }
}

/// Parse a single JSONL line into an intermediate representation
fn parse_jsonl_line_intermediate(line: &JsonlLine) -> Option<IntermediateParsedLine> {
    let json: Value = serde_json::from_str(&line.content).ok()?;

    let msg_type = json.get("type")?.as_str()?;
    let message_type = MessageType::from_str(msg_type);

    // Get or generate UUID
    let uuid = json
        .get("uuid")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string())
        .unwrap_or_else(|| Uuid::new_v4().to_string());

    // Get direct timestamp if available at root level
    let direct_timestamp = json
        .get("timestamp")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Get leafUuid for summary messages
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

/// Convert intermediate parsed line to final ParsedMessage
fn finalize_parsed_message(
    parsed: IntermediateParsedLine,
    uuid_to_timestamp: &std::collections::HashMap<String, String>,
    fallback_timestamp: Option<&str>,
) -> Option<ParsedMessage> {
    // Resolve timestamp - try extract first, then fallback to previous message's timestamp
    let timestamp = extract_timestamp(&parsed, uuid_to_timestamp)
        .or_else(|| fallback_timestamp.map(|s| s.to_string()))?;

    let json = &parsed.json;
    let message_type = parsed.message_type;

    // Extract role-based content
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
        MessageType::FileHistorySnapshot => {
            // File history snapshots are metadata, no role/content needed
            (None, None)
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

    // Extract agent_id from message if present (for agent-scoped messages)
    let agent_id = json
        .get("agentId")
        .and_then(|v| v.as_str())
        .map(|s| s.to_string());

    // Extract parent_id - for tool results, link to their tool_use message
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

    // Extract token usage from assistant messages (message.usage)
    let (input_tokens, output_tokens, cache_read_tokens, cache_creation_tokens) =
        if message_type == MessageType::Assistant {
            extract_token_usage(json)
        } else {
            (None, None, None, None)
        };

    // Extract line changes from assistant messages with tool_use content blocks
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

/// Extract message content from various JSON structures
fn extract_message_content(json: &Value) -> Option<String> {
    // Claude Code format: message.content holds the actual content
    if let Some(msg) = json.get("message") {
        // message.content can be a string or array of content blocks
        if let Some(content) = msg.get("content") {
            if let Some(s) = content.as_str() {
                return Some(s.to_string());
            }
            // Array of content blocks (Claude API format)
            if let Some(arr) = content.as_array() {
                let text_parts: Vec<String> = arr
                    .iter()
                    .filter_map(|item| {
                        let item_type = item.get("type").and_then(|t| t.as_str());

                        // Handle text blocks
                        if item_type == Some("text") {
                            return item
                                .get("text")
                                .and_then(|t| t.as_str())
                                .map(|s| s.to_string());
                        }

                        // Handle thinking blocks (Claude extended thinking)
                        if item_type == Some("thinking") {
                            return item
                                .get("thinking")
                                .and_then(|t| t.as_str())
                                .map(|s| s.to_string());
                        }

                        // Handle tool_use blocks (extract tool name for context)
                        if item_type == Some("tool_use") {
                            let tool_name = item
                                .get("name")
                                .and_then(|n| n.as_str())
                                .unwrap_or("unknown");
                            return Some(format!("[Tool: {}]", tool_name));
                        }

                        // Handle tool_result blocks with text content
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

    // Fallback: Try root "content" field
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

/// Extract token usage from a JSONL message's usage field.
/// Looks at message.usage.{input_tokens, output_tokens, cache_read_input_tokens, cache_creation_input_tokens}
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

            // Only return Some values if at least one token field exists
            if input.is_some() || output.is_some() {
                (input, output, cache_read, cache_creation)
            } else {
                (None, None, None, None)
            }
        }
        None => (None, None, None, None),
    }
}

/// Extract line changes from assistant messages that contain tool_use content blocks.
/// Looks at Edit (old_string vs new_string delta) and Write (content lines) tools.
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
    let mut files = std::collections::HashSet::new();
    let mut found_any = false;

    for block in arr {
        let block_type = block.get("type").and_then(|t| t.as_str());
        if block_type != Some("tool_use") {
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

/// File type classification for JSONL files
#[derive(Debug, Clone, PartialEq)]
pub enum SessionFileType {
    /// Main session file: {uuid}.jsonl
    Main { session_id: String },
    /// Agent file: agent-{id}.jsonl
    Agent { agent_id: String },
    /// Han events file: {uuid}-han.jsonl
    HanEvents { session_id: String },
    /// Unknown format
    Unknown,
}

/// Classify a JSONL file and extract relevant IDs
fn classify_file(file_path: &Path) -> SessionFileType {
    let filename = match file_path.file_stem().and_then(|s| s.to_str()) {
        Some(f) => f,
        None => return SessionFileType::Unknown,
    };

    // Check for agent file: agent-{id}.jsonl
    if let Some(agent_id) = filename.strip_prefix("agent-") {
        if !agent_id.is_empty() && agent_id.len() <= 16 {
            return SessionFileType::Agent {
                agent_id: agent_id.to_string(),
            };
        }
    }

    // Check for han events file: {uuid}-han.jsonl or cli-{uuid}-han.jsonl
    if let Some(session_id) = filename.strip_suffix("-han") {
        if is_valid_uuid(session_id) || is_valid_cli_session_id(session_id) {
            return SessionFileType::HanEvents {
                session_id: session_id.to_string(),
            };
        }
    }

    // Check for main session file: {uuid}.jsonl or {uuid}_messages.jsonl
    let session_id = if let Some(stripped) = filename.strip_suffix("_messages") {
        stripped
    } else {
        filename
    };

    if is_valid_uuid(session_id) {
        return SessionFileType::Main {
            session_id: session_id.to_string(),
        };
    }

    SessionFileType::Unknown
}

/// Check if a string looks like a UUID
fn is_valid_uuid(s: &str) -> bool {
    s.len() >= 32 && s.chars().all(|c| c.is_ascii_hexdigit() || c == '-')
}

/// Check if a string looks like a CLI session ID (cli-{uuid})
fn is_valid_cli_session_id(s: &str) -> bool {
    if let Some(uuid_part) = s.strip_prefix("cli-") {
        is_valid_uuid(uuid_part)
    } else {
        false
    }
}

/// Extract session ID from agent file by reading the first line
fn extract_session_id_from_agent_file(file_path: &Path) -> Option<String> {
    use std::io::{BufRead, BufReader};

    let file = std::fs::File::open(file_path).ok()?;
    let reader = BufReader::new(file);
    let first_line = reader.lines().next()?.ok()?;

    // Parse JSON to get sessionId
    let json: serde_json::Value = serde_json::from_str(&first_line).ok()?;
    json.get("sessionId")?.as_str().map(|s| s.to_string())
}

/// Extract session ID from JSONL file path
/// Format: `{uuid}.jsonl`, `{uuid}_messages.jsonl`, or `{uuid}-han.jsonl`
fn extract_session_id(file_path: &Path) -> Option<String> {
    match classify_file(file_path) {
        SessionFileType::Main { session_id } => Some(session_id),
        SessionFileType::HanEvents { session_id } => Some(session_id),
        SessionFileType::Agent { .. } => extract_session_id_from_agent_file(file_path),
        SessionFileType::Unknown => None,
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
/// Slug format: `-Volumes-dev-src-github-com-user-project` (leading dash)
fn decode_project_path(slug: &str) -> String {
    // Claude Code encodes paths by replacing / and . with -
    // We need to reconstruct the original path by trying different combinations
    // Strategy: Replace - with / first, then check if path exists. If not, try
    // common patterns like replacing /com/ with .com/ for domain-like segments.

    let naive_path = slug.replace('-', "/");

    // Check if naive path exists
    if std::path::Path::new(&naive_path).exists() {
        return naive_path;
    }

    // Try common domain patterns: github/com -> github.com
    let domain_patterns = [
        ("/github/com/", "/github.com/"),
        ("/gitlab/com/", "/gitlab.com/"),
        ("/bitbucket/org/", "/bitbucket.org/"),
    ];

    let mut candidate = naive_path.clone();
    for (from, to) in domain_patterns {
        if candidate.contains(from) {
            let fixed = candidate.replace(from, to);
            if std::path::Path::new(&fixed).exists() {
                return fixed;
            }
            // Keep the fix even if path doesn't exist - it's more likely correct
            candidate = fixed;
        }
    }

    candidate
}

/// Detect git repository info from a project path
/// Returns (remote_url, repo_name, default_branch) if in a git repo
/// Uses gitoxide (pure Rust) instead of shelling out to git CLI
fn detect_git_repo(project_path: &str) -> Option<(String, String, Option<String>)> {
    use crate::git;

    let info = git::get_git_info(project_path.to_string());

    let remote = info.remote?;
    let name = info.repo_name.unwrap_or_else(|| "unknown".to_string());
    let default_branch = info.branch;

    Some((remote, name, default_branch))
}

// ============================================================================
// Han Events Parsing
// ============================================================================

/// Parsed Han event from JSONL
#[derive(Debug, Clone)]
struct ParsedHanEvent {
    id: String,
    event_type: String,
    timestamp: String,
    agent_id: Option<String>,
    data: Value,
    raw_json: String,
}

/// Resolve a ref file path to get the full event JSON
/// ref_path is relative like "hook_result/abc123.json"
/// base_dir is the session's ref directory like "/path/to/projects/slug/{session-id}/"
fn resolve_ref_file(ref_path: &str, base_dir: &Path) -> Option<Value> {
    let full_path = base_dir.join(ref_path);
    let content = std::fs::read_to_string(&full_path).ok()?;
    serde_json::from_str(&content).ok()
}

/// Parse a Han event JSONL line
/// Supports both inline events and ref-based events for large content
/// ref_base_dir: The directory containing ref files (e.g., /path/to/projects/slug/{session-id}/)
fn parse_han_event_line(line: &JsonlLine, ref_base_dir: Option<&Path>) -> Option<ParsedHanEvent> {
    let json: Value = serde_json::from_str(&line.content).ok()?;

    // Check if this is a ref entry (large content stored in separate file)
    let resolved_json = if let Some(ref_path) = json.get("ref").and_then(|v| v.as_str()) {
        // Resolve the ref file
        if let Some(base_dir) = ref_base_dir {
            resolve_ref_file(ref_path, base_dir)?
        } else {
            // No base dir provided, can't resolve ref - use inline data as fallback
            json.clone()
        }
    } else {
        // Inline event, use as-is
        json.clone()
    };

    // Try both uuid (new format) and id (legacy format)
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

    // Use resolved JSON as raw_json for full content
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

/// Get the corresponding Han events file path for a session file
/// Han events are stored at ~/.han/memory/personal/sessions/{date}-{sessionId}-han.jsonl
/// We need to search for files matching *-{sessionId}-han.jsonl since we don't know the date
fn get_han_events_path(session_file: &Path) -> Option<std::path::PathBuf> {
    let session_id = extract_session_id(session_file)?;

    // First, check the same directory (for backwards compatibility / project-scoped events)
    let parent = session_file.parent()?;
    let local_han_file = parent.join(format!("{}-han.jsonl", session_id));
    if local_han_file.exists() {
        return Some(local_han_file);
    }

    // Check the han memory sessions directory
    // Respects CLAUDE_CONFIG_DIR if set
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

    // Search for files matching *-{sessionId}-han.jsonl
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

/// Read all Han events from the -han.jsonl file
/// session_id is used to locate ref files in the {session-id}/ subdirectory
fn read_han_events(han_file: &Path, session_id: &str) -> Vec<ParsedHanEvent> {
    let mut events = Vec::new();
    let mut offset = 0u32;
    let batch_size = 1000u32;

    // Ref files are stored in {han_file_dir}/{session-id}/
    let ref_base_dir = han_file.parent().map(|p| p.join(session_id));

    while let Ok(result) =
        jsonl_read_page(han_file.to_string_lossy().to_string(), offset, batch_size)
    {
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
// File Change Extraction
// ============================================================================

/// Check if a tool is a file modification tool
fn is_file_modification_tool(tool_name: &str) -> bool {
    matches!(tool_name, "Write" | "Edit" | "NotebookEdit")
}

/// Detect if a summary message is a compact (auto_compact, compact, or continuation)
/// Returns the compact type if it is, None if it's a regular summary
fn detect_compact_type(raw_json: &str, content: Option<&str>) -> Option<String> {
    if let Ok(json) = serde_json::from_str::<Value>(raw_json) {
        // Check for explicit type fields
        if let Some(msg_type) = json.get("type").and_then(|t| t.as_str()) {
            if msg_type == "auto_compact" || msg_type == "compact" {
                return Some(msg_type.to_string());
            }
        }

        // Check for is_compact flag (snake_case)
        if json
            .get("is_compact")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return Some("compact".to_string());
        }

        // Check for isCompact flag (camelCase)
        if json
            .get("isCompact")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return Some("compact".to_string());
        }

        // Check for auto_compacted flag
        if json
            .get("auto_compacted")
            .and_then(|v| v.as_bool())
            .unwrap_or(false)
        {
            return Some("auto_compact".to_string());
        }
    }

    // Check for continuation messages in user content
    if let Some(text) = content {
        if text.contains("This session is being continued from a previous conversation") {
            return Some("continuation".to_string());
        }
    }

    None
}

/// Extract file path from tool input for Write/Edit/NotebookEdit tools
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

/// Record a file change from a tool_use message
fn record_file_change_from_tool(
    session_id: &str,
    tool_name: &str,
    tool_input: &str,
    agent_id: Option<&str>,
) {
    if let Some(raw_path) = extract_file_path_from_tool_input(tool_name, tool_input) {
        // Canonicalize the file path to normalize symlinks and mounts
        // (e.g., /Volumes/dev vs /Users/name/dev pointing to same location)
        let file_path = std::fs::canonicalize(&raw_path)
            .ok()
            .and_then(|p| p.to_str().map(|s| s.to_string()))
            .unwrap_or(raw_path);

        let action = match tool_name {
            "Write" => "created",
            "Edit" => "modified",
            "NotebookEdit" => "modified",
            _ => "modified",
        };

        // Compute hash of the file after the change
        let file_hash_after = std::fs::File::open(&file_path).ok().and_then(|mut file| {
            use sha2::{Digest, Sha256};
            use std::io::Read;
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
        });

        let input = SessionFileChangeInput {
            session_id: session_id.to_string(),
            file_path,
            action: action.to_string(),
            file_hash_before: None,
            file_hash_after,
            tool_name: Some(tool_name.to_string()),
            agent_id: agent_id.map(|s| s.to_string()),
        };

        // Record to database (ignore errors - file tracking is best-effort)
        let _ = crud::record_file_change(input);
    }
}

/// Extract and save todos from a TodoWrite tool call
/// The tool_input contains a JSON object with a "todos" array
fn extract_and_save_todos(
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

    // Extract the todos array from the input
    let todos = match input.get("todos") {
        Some(t) if t.is_array() => t,
        _ => return,
    };

    // Serialize the todos array back to JSON string for storage
    let todos_json = match serde_json::to_string(todos) {
        Ok(s) => s,
        Err(_) => return,
    };

    let input = SessionTodosInput {
        session_id: session_id.to_string(),
        message_id: message_id.to_string(),
        todos_json,
        timestamp: timestamp.to_string(),
        line_number,
    };

    // Upsert to database (ignore errors - todo tracking is best-effort)
    let _ = crud::upsert_session_todos(input);
}

/// Extract and save a native task from a TaskCreate tool call
/// The tool_input contains: {subject, description, activeForm}
fn extract_and_save_task_create(
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

    // Extract task fields
    let subject = match input.get("subject").and_then(|s| s.as_str()) {
        Some(s) => s.to_string(),
        None => return, // subject is required
    };

    let description = input
        .get("description")
        .and_then(|d| d.as_str())
        .map(|s| s.to_string());

    let active_form = input
        .get("activeForm")
        .and_then(|a| a.as_str())
        .map(|s| s.to_string());

    // Generate a task ID based on order within session
    // The actual ID will be determined by counting existing tasks
    // For now, we'll use the message_id as a temporary ID and let the DB handle uniqueness
    // Claude assigns sequential IDs like "1", "2", etc. but we don't have access to that here
    // We'll use a hash of the subject as the ID for deduplication
    let task_id = format!("{:x}", md5_hash(&format!("{}{}", session_id, subject)));

    let task_input = NativeTaskInput {
        id: task_id,
        session_id: session_id.to_string(),
        message_id: message_id.to_string(),
        subject,
        description,
        active_form,
        timestamp: timestamp.to_string(),
        line_number,
    };

    // Insert to database (ignore errors - task tracking is best-effort)
    let _ = crud::create_native_task(task_input);
}

/// Simple hash function for generating task IDs
fn md5_hash(input: &str) -> u64 {
    use std::collections::hash_map::DefaultHasher;
    use std::hash::{Hash, Hasher};
    let mut hasher = DefaultHasher::new();
    input.hash(&mut hasher);
    hasher.finish()
}

/// Extract and apply a native task update from a TaskUpdate tool call
/// The tool_input contains: {taskId, status?, subject?, description?, activeForm?, owner?, addBlocks?, addBlockedBy?}
fn extract_and_save_task_update(
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

    // Extract taskId - required
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

    let add_blocks = input
        .get("addBlocks")
        .and_then(|b| b.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        });

    let add_blocked_by = input
        .get("addBlockedBy")
        .and_then(|b| b.as_array())
        .map(|arr| {
            arr.iter()
                .filter_map(|v| v.as_str().map(|s| s.to_string()))
                .collect()
        });

    let task_update = NativeTaskUpdate {
        id: task_id,
        session_id: session_id.to_string(),
        message_id: message_id.to_string(),
        status,
        subject,
        description,
        active_form,
        owner,
        add_blocks,
        add_blocked_by,
        timestamp: timestamp.to_string(),
        line_number,
    };

    // Update in database (ignore errors - task tracking is best-effort)
    let _ = crud::update_native_task(task_update);
}

/// Compute sentiment analysis for a message and return tuple of fields
/// Returns (sentiment_score, sentiment_level, frustration_score, frustration_level)
fn compute_sentiment(content: &str) -> (Option<f64>, Option<String>, Option<f64>, Option<String>) {
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

/// Convert a Han event to a MessageInput
fn han_event_to_message_input(
    event: ParsedHanEvent,
    session_id: &str,
    line_number: i32,
    source_file_name: Option<String>,
) -> MessageInput {
    // Content is the full event data as JSON
    let content = serde_json::to_string(&event.data).ok();

    // Tool name is the event type (hook_start, mcp_tool_call, etc.)
    let tool_name = Some(event.event_type.clone());

    MessageInput {
        id: event.id,
        session_id: session_id.to_string(),
        agent_id: event.agent_id, // Han events may have agent context
        parent_id: None,          // Han events don't have parent relationships
        message_type: "han_event".to_string(),
        role: None, // Han events don't have a role
        content,
        tool_name, // Subtype of event
        tool_input: None,
        tool_result: None,
        raw_json: Some(event.raw_json),
        timestamp: event.timestamp,
        line_number,
        source_file_name,
        source_file_type: Some("han_events".to_string()),
        // Han events don't have sentiment analysis
        sentiment_score: None,
        sentiment_level: None,
        frustration_score: None,
        frustration_level: None,
        // Han events don't have token usage or line changes
        input_tokens: None,
        output_tokens: None,
        cache_read_tokens: None,
        cache_creation_tokens: None,
        lines_added: None,
        lines_removed: None,
        files_changed: None,
    }
}

// ============================================================================
// Task Event Processing
// ============================================================================

/// Process a task event from Han events and update the tasks table
/// Returns Ok(true) if task was processed, Ok(false) if not a task event
fn process_task_event(event: &ParsedHanEvent, session_id: &str) -> napi::Result<bool> {
    match event.event_type.as_str() {
        "task_start" => {
            // Create a new task from the event data
            let task_id = event
                .data
                .get("task_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| napi::Error::from_reason("task_start missing task_id"))?;
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
            let estimated_complexity = event
                .data
                .get("estimated_complexity")
                .and_then(|v| v.as_str())
                .map(String::from);

            let input = TaskInput {
                session_id: Some(session_id.to_string()),
                task_id: task_id.to_string(),
                description: description.to_string(),
                task_type: task_type.to_string(),
                estimated_complexity,
            };

            // Create the task (ignore if already exists)
            match crud::create_task(input) {
                Ok(_) => Ok(true),
                Err(e) if e.to_string().contains("UNIQUE constraint failed") => Ok(true),
                Err(e) => Err(e),
            }
        }
        "task_complete" => {
            // Complete an existing task
            let task_id = event
                .data
                .get("task_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| napi::Error::from_reason("task_complete missing task_id"))?;
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
            let files_modified = event
                .data
                .get("files_modified")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                });
            let tests_added = event
                .data
                .get("tests_added")
                .and_then(|v| v.as_i64())
                .map(|v| v as i32);

            let completion = TaskCompletion {
                task_id: task_id.to_string(),
                outcome: outcome.to_string(),
                confidence,
                notes,
                files_modified,
                tests_added,
            };

            // Complete the task (ignore if task doesn't exist)
            match crud::complete_task(completion) {
                Ok(_) => Ok(true),
                Err(e) if e.to_string().contains("No task found") => Ok(true),
                Err(e) => Err(e),
            }
        }
        "task_fail" => {
            // Fail an existing task
            let task_id = event
                .data
                .get("task_id")
                .and_then(|v| v.as_str())
                .ok_or_else(|| napi::Error::from_reason("task_fail missing task_id"))?;
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
            let attempted_solutions = event
                .data
                .get("attempted_solutions")
                .and_then(|v| v.as_array())
                .map(|arr| {
                    arr.iter()
                        .filter_map(|v| v.as_str().map(String::from))
                        .collect()
                });

            let failure = TaskFailure {
                task_id: task_id.to_string(),
                reason: reason.to_string(),
                confidence,
                notes,
                attempted_solutions,
            };

            // Fail the task (ignore if task doesn't exist)
            match crud::fail_task(failure) {
                Ok(_) => Ok(true),
                Err(e) if e.to_string().contains("No task found") => Ok(true),
                Err(e) => Err(e),
            }
        }
        _ => Ok(false), // Not a task event
    }
}

/// Process hook_validation_cache events to populate session_file_validations table
/// These events contain a map of file paths to their hashes, which we explode into individual rows
fn process_validation_cache_event(event: &ParsedHanEvent, session_id: &str) -> napi::Result<bool> {
    if event.event_type != "hook_validation_cache" {
        return Ok(false);
    }

    let plugin = event
        .data
        .get("plugin")
        .and_then(|v| v.as_str())
        .ok_or_else(|| napi::Error::from_reason("hook_validation_cache missing plugin"))?;
    let hook = event
        .data
        .get("hook")
        .and_then(|v| v.as_str())
        .ok_or_else(|| napi::Error::from_reason("hook_validation_cache missing hook"))?;
    let directory = event
        .data
        .get("directory")
        .and_then(|v| v.as_str())
        .ok_or_else(|| napi::Error::from_reason("hook_validation_cache missing directory"))?;
    let command_hash = event
        .data
        .get("command_hash")
        .and_then(|v| v.as_str())
        .ok_or_else(|| napi::Error::from_reason("hook_validation_cache missing command_hash"))?;
    let files = event
        .data
        .get("files")
        .and_then(|v| v.as_object())
        .ok_or_else(|| napi::Error::from_reason("hook_validation_cache missing files"))?;

    // Insert a validation record for each file in the map
    for (file_path, file_hash_value) in files {
        let file_hash = file_hash_value.as_str().unwrap_or("");

        let input = SessionFileValidationInput {
            session_id: session_id.to_string(),
            file_path: file_path.clone(),
            file_hash: file_hash.to_string(),
            plugin_name: plugin.to_string(),
            hook_name: hook.to_string(),
            directory: directory.to_string(),
            command_hash: command_hash.to_string(),
        };

        // Record the validation (ignore duplicates - UNIQUE constraint handles this)
        match crud::record_file_validation(input) {
            Ok(_) => {}
            Err(e) if e.to_string().contains("UNIQUE constraint failed") => {}
            Err(e) => return Err(e),
        }
    }

    Ok(true)
}

// ============================================================================
// Sentiment Analysis During Indexing
// ============================================================================

/// Generate a sentiment analysis event for a user message
/// Returns None if sentiment analysis produces no meaningful result
fn generate_sentiment_event(
    message_id: &str,
    message_content: &str,
    message_timestamp: &str,
    session_id: &str,
    line_number: i32,
) -> Option<MessageInput> {
    // Analyze sentiment
    let result = sentiment::analyze_sentiment(message_content)?;

    // Create event ID
    let event_id = format!("evt_{}", &Uuid::new_v4().to_string().replace('-', "")[..12]);

    // Create timestamp just after the message (add 1 millisecond)
    let event_timestamp = if let Ok(parsed) = DateTime::parse_from_rfc3339(message_timestamp) {
        let new_time = parsed.with_timezone(&Utc) + Duration::milliseconds(1);
        new_time.to_rfc3339()
    } else {
        // Fallback to current time if parsing fails
        Utc::now().to_rfc3339()
    };

    // Look up active task at message timestamp from SQLite
    let task_id = DateTime::parse_from_rfc3339(message_timestamp)
        .ok()
        .and_then(|ts| {
            get_task_timeline()
                .find_active_task(&ts.with_timezone(&Utc))
                .map(String::from)
        });

    // Build event data
    let mut data = serde_json::json!({
        "message_id": message_id,
        "sentiment_score": result.sentiment_score,
        "sentiment_level": result.sentiment_level.as_str(),
        "signals": result.signals,
    });

    // Add optional frustration fields
    if let Some(score) = result.frustration_score {
        data["frustration_score"] = serde_json::json!(score);
    }
    if let Some(level) = result.frustration_level {
        data["frustration_level"] = serde_json::json!(level.as_str());
    }

    // Add task_id if found
    if let Some(ref tid) = task_id {
        data["task_id"] = serde_json::json!(tid);
    }

    // Build raw JSON for the event
    let raw_event = serde_json::json!({
        "id": event_id,
        "type": "sentiment_analysis",
        "timestamp": event_timestamp,
        "data": data,
    });

    Some(MessageInput {
        id: event_id,
        session_id: session_id.to_string(),
        agent_id: None, // Sentiment events are generated during indexing, not from agent context
        parent_id: Some(message_id.to_string()), // Link to the message being analyzed
        message_type: "han_event".to_string(),
        role: None,
        content: Some(serde_json::to_string(&data).unwrap_or_default()),
        tool_name: Some("sentiment_analysis".to_string()),
        tool_input: None,
        tool_result: None,
        raw_json: Some(serde_json::to_string(&raw_event).unwrap_or_default()),
        timestamp: event_timestamp,
        line_number: line_number + 500_000, // Offset between Claude messages and Han events
        source_file_name: None,             // Generated during indexing, not from original file
        source_file_type: Some("generated".to_string()),
        // Sentiment data is in the content, not separate fields for event-type messages
        sentiment_score: None,
        sentiment_level: None,
        frustration_score: None,
        frustration_level: None,
        // Sentiment events don't have token usage or line changes
        input_tokens: None,
        output_tokens: None,
        cache_read_tokens: None,
        cache_creation_tokens: None,
        lines_added: None,
        lines_removed: None,
        files_changed: None,
    })
}

// ============================================================================
// Indexing Functions (Synchronous SQLite)
// ============================================================================

/// Index a single JSONL file incrementally
/// Also reads the corresponding -han.jsonl file and merges events by timestamp
/// Task association for sentiment events is automatically loaded from SQLite
pub fn index_session_file(
    file_path: String,
    source_config_dir: Option<String>,
) -> napi::Result<IndexResult> {
    let path = Path::new(&file_path);

    // Extract source file metadata for session reconstruction
    let source_file_name = path
        .file_name()
        .and_then(|n| n.to_str())
        .map(|s| s.to_string());
    let source_file_type = match classify_file(path) {
        SessionFileType::Main { .. } => Some("main".to_string()),
        SessionFileType::Agent { .. } => Some("agent".to_string()),
        SessionFileType::HanEvents { .. } => Some("han_events".to_string()),
        SessionFileType::Unknown => None,
    };

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

        // Try to detect and create git repo
        let repo_id =
            if let Some((remote, repo_name, default_branch)) = detect_git_repo(&decoded_path) {
                let repo = crud::upsert_repo(RepoInput {
                    remote,
                    name: repo_name,
                    default_branch,
                })?;
                repo.id
            } else {
                None
            };

        // Ensure project exists
        let project = crud::upsert_project(ProjectInput {
            repo_id,
            slug: slug.clone(),
            path: decoded_path,
            relative_path: None,
            name: project_name,
            is_worktree: Some(false),
            source_config_dir: source_config_dir.clone(),
        })?;

        project.id
    } else {
        None
    };

    // Check if session exists and get last indexed line
    let existing_session = crud::get_session(&session_id)?;
    let is_new_session = existing_session.is_none();
    let last_line = if is_new_session {
        0
    } else {
        crud::get_last_indexed_line(&session_id)?
    };

    // Upsert session (id IS the session UUID from filename)
    // Slug will be extracted during Pass 1 and updated after indexing
    crud::upsert_session(SessionInput {
        id: session_id.clone(),
        project_id: project_id.clone(),
        status: Some("active".to_string()),
        transcript_path: Some(file_path.clone()),
        slug: None,
        source_config_dir: source_config_dir.clone(),
    })?;

    // Read new lines from JSONL file
    let start_line = if last_line > 0 {
        (last_line + 1) as u32
    } else {
        0
    };

    // Two-pass approach:
    // Pass 1: Read all lines, parse into intermediate form, build uuid->timestamp map
    // Pass 2: Finalize messages using the timestamp map for lookups (summary messages need this)

    let batch_size = 1000u32;
    let mut offset = start_line;
    let mut intermediate_lines: Vec<IntermediateParsedLine> = Vec::new();
    let mut uuid_to_timestamp: std::collections::HashMap<String, String> =
        std::collections::HashMap::new();
    let mut max_line = last_line;
    let mut session_slug: Option<String> = None;

    // Pass 1: Read and parse all lines, build timestamp map
    loop {
        let result = jsonl_read_page(file_path.clone(), offset, batch_size)?;

        if result.lines.is_empty() {
            break;
        }

        for line in &result.lines {
            if let Some(parsed) = parse_jsonl_line_intermediate(line) {
                // Build uuid->timestamp map from messages with direct timestamps
                if let Some(ref ts) = parsed.direct_timestamp {
                    uuid_to_timestamp.insert(parsed.uuid.clone(), ts.clone());
                }
                // Also check for file-history-snapshot nested timestamps
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
                // Extract session slug from first message that has it
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

    // Pass 2: Finalize messages and insert in batches
    // Also generate sentiment analysis events for user messages
    let mut total_indexed = 0u32;
    let mut messages_batch: Vec<MessageInput> = Vec::new();
    // Track last known timestamp for fallback (summary messages may not have their own)
    let mut last_known_timestamp: Option<String> = None;

    for parsed in intermediate_lines {
        let line_number = parsed.line_number;
        if let Some(finalized) =
            finalize_parsed_message(parsed, &uuid_to_timestamp, last_known_timestamp.as_deref())
        {
            // Update last known timestamp for next iteration
            last_known_timestamp = Some(finalized.timestamp.clone());
            // Check if this is a user message for sentiment analysis
            let is_user_message = finalized.message_type == MessageType::User;
            let message_content = finalized.content.clone();
            let message_id = finalized.uuid.clone();
            let message_timestamp = finalized.timestamp.clone();

            // Record file changes for Write/Edit/NotebookEdit tools (before moving finalized)
            // Also extract TodoWrite tool calls to session_todos table
            // For tool_use messages, check the direct tool_name/tool_input
            if finalized.message_type == MessageType::ToolUse {
                if let (Some(ref tool_name), Some(ref tool_input)) =
                    (&finalized.tool_name, &finalized.tool_input)
                {
                    if is_file_modification_tool(tool_name) {
                        record_file_change_from_tool(
                            &session_id,
                            tool_name,
                            tool_input,
                            finalized.agent_id.as_deref(),
                        );
                    }
                    if tool_name == "TodoWrite" {
                        extract_and_save_todos(
                            &session_id,
                            &message_id,
                            tool_input,
                            &message_timestamp,
                            line_number,
                        );
                    }
                    // Extract native task events (Claude's built-in task system)
                    if tool_name == "TaskCreate" {
                        extract_and_save_task_create(
                            &session_id,
                            &message_id,
                            tool_input,
                            &message_timestamp,
                            line_number,
                        );
                    }
                    if tool_name == "TaskUpdate" {
                        extract_and_save_task_update(
                            &session_id,
                            &message_id,
                            tool_input,
                            &message_timestamp,
                            line_number,
                        );
                    }
                }
            }
            // For assistant messages, extract tool_use blocks from the message.content array
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
                                                &session_id,
                                                tool_name,
                                                &input_str,
                                                finalized.agent_id.as_deref(),
                                            );
                                        }
                                    }
                                    if tool_name == "TodoWrite" {
                                        if let Some(input) = item.get("input") {
                                            let input_str = input.to_string();
                                            extract_and_save_todos(
                                                &session_id,
                                                &message_id,
                                                &input_str,
                                                &message_timestamp,
                                                line_number,
                                            );
                                        }
                                    }
                                    // Extract native task events (Claude's built-in task system)
                                    if tool_name == "TaskCreate" {
                                        if let Some(input) = item.get("input") {
                                            let input_str = input.to_string();
                                            extract_and_save_task_create(
                                                &session_id,
                                                &message_id,
                                                &input_str,
                                                &message_timestamp,
                                                line_number,
                                            );
                                        }
                                    }
                                    if tool_name == "TaskUpdate" {
                                        if let Some(input) = item.get("input") {
                                            let input_str = input.to_string();
                                            extract_and_save_task_update(
                                                &session_id,
                                                &message_id,
                                                &input_str,
                                                &message_timestamp,
                                                line_number,
                                            );
                                        }
                                    }
                                }
                            }
                        }
                    }
                }
            }

            // Process summary/compact messages for event sourcing
            // Detect if this is a summary or compact and store in appropriate table
            if finalized.message_type == MessageType::Summary {
                let compact_type =
                    detect_compact_type(&finalized.raw_json, finalized.content.as_deref());
                if let Some(ct) = compact_type {
                    // This is a compact message
                    let _ = crud::upsert_session_compact(SessionCompactInput {
                        session_id: session_id.clone(),
                        message_id: finalized.uuid.clone(),
                        content: finalized.content.clone(),
                        raw_json: Some(finalized.raw_json.clone()),
                        timestamp: finalized.timestamp.clone(),
                        line_number,
                        compact_type: Some(ct),
                    });
                } else {
                    // This is a regular summary
                    let _ = crud::upsert_session_summary(SessionSummaryInput {
                        session_id: session_id.clone(),
                        message_id: finalized.uuid.clone(),
                        content: finalized.content.clone(),
                        raw_json: Some(finalized.raw_json.clone()),
                        timestamp: finalized.timestamp.clone(),
                        line_number,
                    });
                }
            }
            // Also check user messages for continuation summaries
            else if is_user_message {
                if let Some(ref content) = message_content {
                    if content
                        .contains("This session is being continued from a previous conversation")
                    {
                        let _ = crud::upsert_session_compact(SessionCompactInput {
                            session_id: session_id.clone(),
                            message_id: finalized.uuid.clone(),
                            content: Some(content.clone()),
                            raw_json: Some(finalized.raw_json.clone()),
                            timestamp: finalized.timestamp.clone(),
                            line_number,
                            compact_type: Some("continuation".to_string()),
                        });
                    }
                }
            }

            // Compute sentiment for user messages directly on the message
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

            messages_batch.push(MessageInput {
                id: finalized.uuid, // id IS the message UUID from JSONL
                session_id: session_id.clone(),
                agent_id: finalized.agent_id,
                parent_id: finalized.parent_id,
                message_type: finalized.message_type.as_str().to_string(),
                role: finalized.role,
                content: finalized.content,
                tool_name: finalized.tool_name,
                tool_input: finalized.tool_input,
                tool_result: finalized.tool_result,
                raw_json: Some(finalized.raw_json),
                timestamp: finalized.timestamp,
                line_number,
                source_file_name: source_file_name.clone(),
                source_file_type: source_file_type.clone(),
                sentiment_score,
                sentiment_level,
                frustration_score,
                frustration_level,
                input_tokens: finalized.input_tokens,
                output_tokens: finalized.output_tokens,
                cache_read_tokens: finalized.cache_read_tokens,
                cache_creation_tokens: finalized.cache_creation_tokens,
                lines_added: finalized.lines_added,
                lines_removed: finalized.lines_removed,
                files_changed: finalized.files_changed,
            });

            // Generate sentiment analysis event for user messages
            if is_user_message {
                if let Some(content) = &message_content {
                    if let Some(sentiment_event) = generate_sentiment_event(
                        &message_id,
                        content,
                        &message_timestamp,
                        &session_id,
                        line_number,
                    ) {
                        messages_batch.push(sentiment_event);
                    }
                }
            }
        }

        // Insert batch every 100 messages
        if messages_batch.len() >= 100 {
            let count =
                crud::insert_messages_batch(&session_id, std::mem::take(&mut messages_batch))?;
            total_indexed += count;
        }
    }

    // Insert remaining Claude messages
    if !messages_batch.is_empty() {
        let count = crud::insert_messages_batch(&session_id, std::mem::take(&mut messages_batch))?;
        total_indexed += count;
    }

    // =========================================================================
    // Han Events: Read and insert from -han.jsonl file
    // =========================================================================
    // Han events use line numbers offset by 1,000,000 to ensure they don't
    // collide with Claude message line numbers. The UI should sort by timestamp.

    if let Some(han_file) = get_han_events_path(path) {
        let han_events = read_han_events(&han_file, &session_id);
        let han_file_name = han_file
            .file_name()
            .and_then(|n| n.to_str())
            .map(|s| s.to_string());

        // Line numbers for Han events are offset to avoid collision
        // The actual sorting should use timestamp in the UI
        const HAN_LINE_OFFSET: i32 = 1_000_000;

        for (idx, event) in han_events.into_iter().enumerate() {
            // Process task events (task_start, task_complete, task_fail) to populate tasks table
            // This is done before converting to message input since process_task_event borrows event
            let _ = process_task_event(&event, &session_id);
            // Process validation cache events to populate session_file_validations table
            let _ = process_validation_cache_event(&event, &session_id);

            let line_number = HAN_LINE_OFFSET + (idx as i32);
            let message_input =
                han_event_to_message_input(event, &session_id, line_number, han_file_name.clone());
            messages_batch.push(message_input);

            // Insert batch every 100 events
            if messages_batch.len() >= 100 {
                let count =
                    crud::insert_messages_batch(&session_id, std::mem::take(&mut messages_batch))?;
                total_indexed += count;
            }
        }

        // Insert remaining Han events
        if !messages_batch.is_empty() {
            let count = crud::insert_messages_batch(&session_id, messages_batch)?;
            total_indexed += count;
        }
    }

    // Update last indexed line
    if max_line > last_line {
        crud::update_last_indexed_line(&session_id, max_line)?;
    }

    // Update session with slug if we found one during indexing
    if session_slug.is_some() {
        crud::upsert_session(SessionInput {
            id: session_id.clone(),
            project_id: project_id.clone(),
            status: Some("active".to_string()),
            transcript_path: Some(file_path.clone()),
            slug: session_slug,
            source_config_dir: source_config_dir.clone(),
        })?;
    }

    // Get total message count
    let total_messages = crud::get_message_count(&session_id)?;

    Ok(IndexResult {
        session_id,
        messages_indexed: total_indexed,
        total_messages,
        is_new_session,
        error: None,
    })
}

/// Register a file in the session_files table
/// Returns (session_id, file_type) if successful
fn register_session_file(
    file_path: &Path,
    source_config_dir: Option<&str>,
) -> napi::Result<Option<(String, String)>> {
    let file_path_str = file_path.to_string_lossy().to_string();

    match classify_file(file_path) {
        SessionFileType::Main { session_id } => {
            // Create session if needed
            let project_slug = extract_project_slug(file_path);
            let project_id = project_slug.as_ref().and_then(|slug| {
                crud::get_project_by_slug(slug)
                    .ok()
                    .flatten()
                    .and_then(|p| p.id)
            });

            crud::upsert_session(crate::schema::SessionInput {
                id: session_id.clone(),
                project_id,
                status: Some("active".to_string()),
                transcript_path: Some(file_path_str.clone()),
                slug: None,
                source_config_dir: source_config_dir.map(|s| s.to_string()),
            })?;

            // Register the file
            crud::upsert_session_file(&session_id, "main", &file_path_str, None)?;
            Ok(Some((session_id, "main".to_string())))
        }
        SessionFileType::Agent { agent_id } => {
            // Get session ID from file content
            if let Some(session_id) = extract_session_id_from_agent_file(file_path) {
                // Ensure session exists
                if crud::get_session(&session_id)?.is_none() {
                    // Session doesn't exist yet - create a placeholder
                    let project_slug = extract_project_slug(file_path);
                    let project_id = project_slug.as_ref().and_then(|slug| {
                        crud::get_project_by_slug(slug)
                            .ok()
                            .flatten()
                            .and_then(|p| p.id)
                    });

                    crud::upsert_session(crate::schema::SessionInput {
                        id: session_id.clone(),
                        project_id,
                        status: Some("active".to_string()),
                        transcript_path: None,
                        slug: None,
                        source_config_dir: source_config_dir.map(|s| s.to_string()),
                    })?;
                }

                // Register the agent file
                crud::upsert_session_file(&session_id, "agent", &file_path_str, Some(&agent_id))?;
                Ok(Some((session_id, "agent".to_string())))
            } else {
                // Can't determine session ID - skip this file
                tracing::warn!(
                    "Could not extract session ID from agent file: {}",
                    file_path_str
                );
                Ok(None)
            }
        }
        SessionFileType::HanEvents { session_id } => {
            // Only register if session exists
            if crud::get_session(&session_id)?.is_some() {
                crud::upsert_session_file(&session_id, "han_events", &file_path_str, None)?;
                Ok(Some((session_id, "han_events".to_string())))
            } else {
                // Session doesn't exist yet - skip
                Ok(None)
            }
        }
        SessionFileType::Unknown => Ok(None),
    }
}

/// Index all JSONL files in a project directory
/// Phase 1: Register all files in session_files table
/// Phase 2: Index messages from each file
pub fn index_project_directory(
    project_dir: String,
    source_config_dir: Option<String>,
) -> napi::Result<Vec<IndexResult>> {
    let dir = Path::new(&project_dir);

    if !dir.exists() || !dir.is_dir() {
        return Ok(Vec::new());
    }

    // Collect all JSONL files
    let entries = std::fs::read_dir(dir)
        .map_err(|e| napi::Error::from_reason(format!("Failed to read directory: {}", e)))?;

    let mut main_files: Vec<std::path::PathBuf> = Vec::new();
    let mut agent_files: Vec<std::path::PathBuf> = Vec::new();
    let mut han_files: Vec<std::path::PathBuf> = Vec::new();

    for entry in entries.flatten() {
        let path = entry.path();
        if path.extension().and_then(|e| e.to_str()) == Some("jsonl") {
            match classify_file(&path) {
                SessionFileType::Main { .. } => main_files.push(path),
                SessionFileType::Agent { .. } => agent_files.push(path),
                SessionFileType::HanEvents { .. } => han_files.push(path),
                SessionFileType::Unknown => {} // Skip unknown files
            }
        }
    }

    // Phase 1: Register files in order (main first, then agents, then han events)
    // This ensures sessions exist before agents/han files try to link to them
    for path in &main_files {
        let _ = register_session_file(path, source_config_dir.as_deref());
    }
    for path in &agent_files {
        let _ = register_session_file(path, source_config_dir.as_deref());
    }
    for path in &han_files {
        let _ = register_session_file(path, source_config_dir.as_deref());
    }

    // Phase 2: Index all files
    let mut results = Vec::new();

    // Index main session files (including their han events)
    for path in &main_files {
        let result = index_session_file(
            path.to_string_lossy().to_string(),
            source_config_dir.clone(),
        )?;
        results.push(result);
    }

    // Index agent files
    for path in &agent_files {
        let result = index_session_file(
            path.to_string_lossy().to_string(),
            source_config_dir.clone(),
        )?;
        results.push(result);
    }

    Ok(results)
}

/// Handle a file event from the watcher
/// This is called by the coordinator when JSONL files change
pub fn handle_file_event(
    event_type: FileEventType,
    file_path: String,
    session_id: Option<String>,
    _project_path: Option<String>,
) -> napi::Result<Option<IndexResult>> {
    let path = Path::new(&file_path);
    let filename = path.file_stem().and_then(|s| s.to_str()).unwrap_or("");

    match event_type {
        FileEventType::Created | FileEventType::Modified => {
            // If this is a Han events file, find and index the main session file
            if filename.ends_with("-han") {
                // Get the main session file path by removing -han suffix
                let session_id = extract_session_id(path);
                if let Some(sid) = session_id {
                    let parent = path.parent();
                    if let Some(dir) = parent {
                        let main_file = dir.join(format!("{}.jsonl", sid));
                        if main_file.exists() {
                            // Pass None for source_config_dir - COALESCE preserves existing value
                            let result =
                                index_session_file(main_file.to_string_lossy().to_string(), None)?;
                            return Ok(Some(result));
                        }
                    }
                }
                // Main file doesn't exist yet, skip
                return Ok(None);
            }

            // Index the main session file (which also processes Han events)
            // Pass None for source_config_dir - COALESCE preserves existing value
            let result = index_session_file(file_path, None)?;
            Ok(Some(result))
        }
        FileEventType::Removed => {
            // Optionally mark session as ended
            if let Some(sid) = session_id {
                crud::end_session(&sid)?;
            }
            Ok(None)
        }
    }
}

/// Perform a full scan and index of all Claude Code sessions
/// This should be called on startup to ensure the database is in sync
/// Scans all registered config directories (from config_dirs table)
pub fn full_scan_and_index() -> napi::Result<Vec<IndexResult>> {
    use crate::crud;

    let mut results = Vec::new();

    // Get all registered config directories
    let config_dirs = crud::list_config_dirs()?;

    // Also include the default ~/.claude if not already registered
    let home = dirs::home_dir().ok_or_else(|| {
        napi::Error::from_reason("Could not determine home directory".to_string())
    })?;
    let default_claude_dir = home.join(".claude");

    // Collect all unique config dir paths to scan
    let mut dirs_to_scan: Vec<std::path::PathBuf> = config_dirs
        .iter()
        .map(|cd| std::path::PathBuf::from(&cd.path))
        .collect();

    // Add default if not in the list
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
            tracing::debug!("Skipping non-existent projects dir: {:?}", projects_dir);
            continue;
        }

        tracing::info!("Scanning projects in: {:?}", projects_dir);

        // Iterate through all project directories
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
                // Index all JSONL files in this project directory
                // Pass the config_dir so sessions can be tagged with their source
                let config_dir_str = config_dir.to_string_lossy().to_string();
                match index_project_directory(
                    path.to_string_lossy().to_string(),
                    Some(config_dir_str),
                ) {
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
    fn test_extract_session_id() {
        let path = Path::new(
            "/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678.jsonl",
        );
        assert_eq!(
            extract_session_id(path),
            Some("abc12345-1234-5678-9abc-def012345678".to_string())
        );

        let path2 = Path::new(
            "/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678_messages.jsonl",
        );
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
        // Slugs have a leading dash that represents the root /
        // Domain patterns like github-com should decode to github.com
        assert_eq!(
            decode_project_path("-Volumes-dev-src-github-com-user-project"),
            "/Volumes/dev/src/github.com/user/project"
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
    fn test_extract_session_id_han_file() {
        // Test Han events file extraction
        let path = Path::new(
            "/home/user/.claude/projects/test/abc12345-1234-5678-9abc-def012345678-han.jsonl",
        );
        assert_eq!(
            extract_session_id(path),
            Some("abc12345-1234-5678-9abc-def012345678".to_string())
        );
    }

    #[test]
    fn test_extract_session_id_cli_han_file() {
        // Test CLI session Han events file extraction (cli-{uuid}-han.jsonl)
        let path = Path::new(
            "/home/user/.claude/projects/test/cli-abc12345-1234-5678-9abc-def012345678-han.jsonl",
        );
        assert_eq!(
            extract_session_id(path),
            Some("cli-abc12345-1234-5678-9abc-def012345678".to_string())
        );
    }

    #[test]
    fn test_is_valid_cli_session_id() {
        assert!(is_valid_cli_session_id(
            "cli-abc12345-1234-5678-9abc-def012345678"
        ));
        assert!(!is_valid_cli_session_id(
            "abc12345-1234-5678-9abc-def012345678"
        )); // Regular UUID
        assert!(!is_valid_cli_session_id("cli-short")); // UUID too short
        assert!(!is_valid_cli_session_id(
            "clix-abc12345-1234-5678-9abc-def012345678"
        )); // Wrong prefix
    }

    #[test]
    fn test_parse_han_event_line() {
        let line = JsonlLine {
            line_number: 1,
            byte_offset: 0,
            content: r#"{"id":"evt_abc123","type":"hook_run","timestamp":"2024-01-01T00:00:00Z","data":{"plugin":"test","hook":"lint"}}"#.to_string(),
        };

        // Test inline event (no ref)
        let parsed = parse_han_event_line(&line, None).unwrap();
        assert_eq!(parsed.id, "evt_abc123");
        assert_eq!(parsed.event_type, "hook_run");
        assert_eq!(parsed.timestamp, "2024-01-01T00:00:00Z");
    }

    #[test]
    fn test_parse_han_event_line_with_ref() {
        // Test ref event that can't be resolved (no base dir)
        let line = JsonlLine {
            line_number: 1,
            byte_offset: 0,
            content: r#"{"uuid":"evt_ref123","type":"hook_result","timestamp":"2024-01-01T00:00:00Z","ref":"hook_result/evt_ref123.json"}"#.to_string(),
        };

        // Without a base dir, ref events fall back to inline data
        // Since the inline data has no "data" field, it uses Null
        let parsed = parse_han_event_line(&line, None).unwrap();
        assert_eq!(parsed.id, "evt_ref123");
        assert_eq!(parsed.event_type, "hook_result");
    }

    #[test]
    fn test_han_event_to_message_input() {
        let event = ParsedHanEvent {
            id: "evt_abc123".to_string(),
            event_type: "hook_result".to_string(),
            timestamp: "2024-01-01T00:00:00Z".to_string(),
            agent_id: None,
            data: serde_json::json!({"plugin": "jutsu-biome", "hook": "lint", "exit_code": 0, "success": true}),
            raw_json:
                r#"{"id":"evt_abc123","type":"hook_result","timestamp":"2024-01-01T00:00:00Z"}"#
                    .to_string(),
        };

        let msg = han_event_to_message_input(
            event,
            "session-123",
            1000001,
            Some("test-han.jsonl".to_string()),
        );

        assert_eq!(msg.id, "evt_abc123");
        assert_eq!(msg.session_id, "session-123");
        assert_eq!(msg.message_type, "han_event");
        assert_eq!(msg.tool_name, Some("hook_result".to_string()));
        assert_eq!(msg.line_number, 1000001);
        assert!(msg.role.is_none());
        assert!(msg.agent_id.is_none());
        assert!(msg.parent_id.is_none());
        assert_eq!(msg.source_file_name, Some("test-han.jsonl".to_string()));
        assert_eq!(msg.source_file_type, Some("han_events".to_string()));
    }
}
