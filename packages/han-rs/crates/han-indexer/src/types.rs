//! Shared types used across the indexer crate.

use serde::{Deserialize, Serialize};

/// Result of indexing a single JSONL file.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct IndexResult {
    /// Session ID that was indexed.
    pub session_id: String,
    /// Number of new messages indexed in this pass.
    pub messages_indexed: u32,
    /// Total messages in session after indexing.
    pub total_messages: u32,
    /// Whether this is a newly discovered session.
    pub is_new_session: bool,
    /// Any error message encountered during indexing.
    pub error: Option<String>,
}

/// Claude Code JSONL message types.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Hash, Serialize, Deserialize)]
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
    pub fn from_str(s: &str) -> Self {
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

    pub fn as_str(&self) -> &'static str {
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

/// Classification of a JSONL session file.
#[derive(Debug, Clone, Copy, PartialEq, Eq)]
pub enum SessionFileType {
    /// Main transcript: `{uuid}.jsonl`
    Main,
    /// Agent sub-transcript: `agent-{id}.jsonl`
    Agent,
    /// Han events: `{date}-{uuid}-han.jsonl`
    HanEvents,
    /// Unrecognized file format
    Unknown,
}

/// File event types from the watcher.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FileEventType {
    Created,
    Modified,
    Removed,
}

/// Parsed message from a JSONL line (intermediate representation before DB insert).
#[derive(Debug, Clone)]
pub struct ParsedMessage {
    pub message_type: MessageType,
    pub role: Option<String>,
    pub content: Option<String>,
    pub tool_name: Option<String>,
    pub tool_input: Option<String>,
    pub tool_result: Option<String>,
    pub raw_json: String,
    pub timestamp: String,
    pub uuid: String,
    pub agent_id: Option<String>,
    pub parent_id: Option<String>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_read_tokens: Option<i64>,
    pub cache_creation_tokens: Option<i64>,
    pub lines_added: Option<i32>,
    pub lines_removed: Option<i32>,
    pub files_changed: Option<i32>,
}

/// Intermediate parsed line before timestamp resolution (first pass).
#[derive(Debug, Clone)]
pub struct IntermediateParsedLine {
    pub line_number: i32,
    pub json: serde_json::Value,
    pub raw_content: String,
    pub message_type: MessageType,
    pub uuid: String,
    /// Direct timestamp from the message, if available.
    pub direct_timestamp: Option<String>,
    /// For summary messages, the leafUuid to look up.
    pub leaf_uuid: Option<String>,
}

/// Parsed Han event from a `-han.jsonl` file.
#[derive(Debug, Clone)]
pub struct ParsedHanEvent {
    pub id: String,
    pub event_type: String,
    pub timestamp: String,
    pub agent_id: Option<String>,
    pub data: serde_json::Value,
    pub raw_json: String,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_message_type_roundtrip() {
        let types = [
            ("summary", MessageType::Summary),
            ("user", MessageType::User),
            ("assistant", MessageType::Assistant),
            ("tool_use", MessageType::ToolUse),
            ("tool_result", MessageType::ToolResult),
            ("progress", MessageType::Progress),
            ("system", MessageType::System),
            ("file-history-snapshot", MessageType::FileHistorySnapshot),
            ("han_event", MessageType::HanEvent),
            ("unknown", MessageType::Unknown),
        ];

        for (s, expected) in types {
            let mt = MessageType::from_str(s);
            assert_eq!(mt, expected);
            assert_eq!(mt.as_str(), s);
        }
    }

    #[test]
    fn test_message_type_unknown_input() {
        assert_eq!(MessageType::from_str("garbage"), MessageType::Unknown);
        assert_eq!(MessageType::from_str(""), MessageType::Unknown);
    }
}
