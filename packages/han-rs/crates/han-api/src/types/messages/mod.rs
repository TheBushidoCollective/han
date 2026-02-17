//! Message types for GraphQL.
//!
//! Messages are discriminated by `message_type` and `tool_name` fields.
//! Result messages (tool_result, hook_result, mcp_tool_result, exposed_tool_result)
//! are NEVER included in Session.messages connection - they are resolved as
//! fields on their parent types via DataLoader.

use async_graphql::*;
use han_db::entities::messages;

use crate::connection::PageInfo;
use crate::node::{encode_global_id, encode_message_cursor};
use crate::types::content_blocks::{ContentBlock, parse_content_blocks};

/// Set of paired event types that should be excluded from the messages connection.
const PAIRED_EVENT_TYPES: &[&str] = &[
    "sentiment_analysis",
    "hook_result",
    "mcp_tool_result",
    "exposed_tool_result",
];

// ============================================================================
// Message Interface (Union in async-graphql)
// ============================================================================

/// Base message data shared by all message types.
#[derive(Debug, Clone)]
pub struct MessageData {
    pub id: String,
    pub session_id: String,
    pub project_dir: String,
    pub line_number: i32,
    pub timestamp: String,
    pub raw_json: Option<String>,
    pub agent_id: Option<String>,
    pub parent_id: Option<String>,
    pub message_type: String,
    pub tool_name: Option<String>,
    pub content: Option<String>,
    pub role: Option<String>,
}

impl MessageData {
    /// Create from a database message model with session context.
    pub fn from_model(model: &messages::Model, project_dir: &str) -> Self {
        Self {
            id: model.id.clone(),
            session_id: model.session_id.clone(),
            project_dir: project_dir.to_string(),
            line_number: model.line_number,
            timestamp: model.timestamp.clone(),
            raw_json: model.raw_json.clone(),
            agent_id: model.agent_id.clone(),
            parent_id: model.parent_id.clone(),
            message_type: model.message_type.clone(),
            tool_name: model.tool_name.clone(),
            content: model.content.clone(),
            role: model.role.clone(),
        }
    }

    fn global_id(&self) -> ID {
        encode_global_id("Message", &self.id)
    }

    fn search_text(&self) -> Option<String> {
        let mut parts: Vec<String> = Vec::new();
        if let Some(ref content) = self.content {
            if !content.is_empty() {
                parts.push(content.clone());
            }
        }
        parts.push(self.message_type.clone());
        if let Some(ref tool) = self.tool_name {
            parts.push(tool.clone());
        }
        if parts.is_empty() {
            None
        } else {
            Some(parts.join(" ").to_lowercase())
        }
    }
}

/// Message union - discriminated by message_type and tool_name.
#[derive(Debug, Clone, Union)]
pub enum Message {
    RegularUser(RegularUserMessage),
    CommandUser(CommandUserMessage),
    InterruptUser(InterruptUserMessage),
    MetaUser(MetaUserMessage),
    ToolResultUser(ToolResultUserMessage),
    Assistant(AssistantMessage),
    Summary(SummaryMessage),
    System(SystemMessage),
    FileHistorySnapshot(FileHistorySnapshotMessage),
    HookRun(HookRunMessage),
    HookResult(HookResultMessage),
    HookCheckState(HookCheckStateMessage),
    HookReference(HookReferenceMessage),
    HookValidation(HookValidationMessage),
    HookScript(HookScriptMessage),
    HookDatetime(HookDatetimeMessage),
    HookFileChange(HookFileChangeMessage),
    HookValidationCache(HookValidationCacheMessage),
    QueueOperation(QueueOperationMessage),
    McpToolCall(McpToolCallMessage),
    McpToolResult(McpToolResultMessage),
    ExposedToolCall(ExposedToolCallMessage),
    ExposedToolResult(ExposedToolResultMessage),
    MemoryQuery(MemoryQueryMessage),
    MemoryLearn(MemoryLearnMessage),
    SentimentAnalysis(SentimentAnalysisMessage),
    UnknownEvent(UnknownEventMessage),
}

// ============================================================================
// Shared interface fields macro
// ============================================================================

macro_rules! impl_message_fields {
    ($type:ty) => {
        #[Object]
        impl $type {
            /// Message global ID (Message:{uuid}).
            async fn id(&self) -> ID {
                self.data.global_id()
            }

            /// Raw message UUID.
            async fn uuid(&self) -> &str {
                &self.data.id
            }

            /// When the message was sent.
            async fn timestamp(&self) -> &str {
                &self.data.timestamp
            }

            /// Original JSONL line content for debugging.
            async fn raw_json(&self) -> Option<&str> {
                self.data.raw_json.as_deref()
            }

            /// Agent ID if from a subagent. NULL for main conversation.
            async fn agent_id(&self) -> Option<&str> {
                self.data.agent_id.as_deref()
            }

            /// For result messages, references the call message ID.
            async fn parent_id(&self) -> Option<&str> {
                self.data.parent_id.as_deref()
            }

            /// Searchable text for message filtering.
            async fn search_text(&self) -> Option<String> {
                self.data.search_text()
            }
        }
    };
}

// ============================================================================
// User Message Types
// ============================================================================

/// A regular user message (prompt from the user).
#[derive(Debug, Clone)]
pub struct RegularUserMessage {
    pub data: MessageData,
}

impl_message_fields!(RegularUserMessage);

/// A command user message (/command invocations).
#[derive(Debug, Clone)]
pub struct CommandUserMessage {
    pub data: MessageData,
}

#[Object]
impl CommandUserMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    /// The command that was invoked.
    async fn command(&self) -> Option<String> {
        parse_user_metadata_field(&self.data.raw_json, "command")
    }
}

/// An interrupt user message.
#[derive(Debug, Clone)]
pub struct InterruptUserMessage {
    pub data: MessageData,
}

impl_message_fields!(InterruptUserMessage);

/// A meta user message (system-injected, not shown to user).
#[derive(Debug, Clone)]
pub struct MetaUserMessage {
    pub data: MessageData,
}

impl_message_fields!(MetaUserMessage);

/// A user message that is actually a tool result container.
#[derive(Debug, Clone)]
pub struct ToolResultUserMessage {
    pub data: MessageData,
}

impl_message_fields!(ToolResultUserMessage);

// ============================================================================
// Assistant Message
// ============================================================================

/// An assistant (Claude) message with content blocks.
#[derive(Debug, Clone)]
pub struct AssistantMessage {
    pub data: MessageData,
}

#[Object]
impl AssistantMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    /// Parsed content blocks (text, thinking, tool_use, etc.).
    async fn content_blocks(&self) -> Vec<ContentBlock> {
        parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        )
    }

    /// Model ID that generated this message.
    async fn model(&self) -> Option<String> {
        parse_json_field(&self.data.raw_json, &["model"])
    }

    /// Stop reason.
    async fn stop_reason(&self) -> Option<String> {
        parse_json_field(&self.data.raw_json, &["stop_reason"])
    }
}

// ============================================================================
// Summary & System Messages
// ============================================================================

/// A summary message (conversation continuation).
#[derive(Debug, Clone)]
pub struct SummaryMessage {
    pub data: MessageData,
}

#[Object]
impl SummaryMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    /// The summary text content.
    async fn summary(&self) -> Option<String> {
        self.data.content.clone()
    }
}

/// A system message.
#[derive(Debug, Clone)]
pub struct SystemMessage {
    pub data: MessageData,
}

impl_message_fields!(SystemMessage);

// ============================================================================
// File History Snapshot
// ============================================================================

/// A file history snapshot message.
#[derive(Debug, Clone)]
pub struct FileHistorySnapshotMessage {
    pub data: MessageData,
}

impl_message_fields!(FileHistorySnapshotMessage);

// ============================================================================
// Hook Messages
// ============================================================================

/// A hook run message (han_event with type hook_run).
#[derive(Debug, Clone)]
pub struct HookRunMessage {
    pub data: MessageData,
}

#[Object]
impl HookRunMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    async fn hook_name(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "hook") }
    async fn plugin(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "plugin") }
    async fn hook_type(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "hook_type") }
    async fn directory(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "directory") }
}

/// A hook result message.
#[derive(Debug, Clone)]
pub struct HookResultMessage {
    pub data: MessageData,
}

#[Object]
impl HookResultMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    async fn hook_name(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "hook") }
    async fn plugin(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "plugin") }
    async fn success(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "success") }
    async fn duration_ms(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "duration_ms") }
    async fn exit_code(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "exit_code") }
    async fn output(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "output") }
    async fn error(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "error") }
    async fn cached(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "cached") }
}

/// Hook check state message.
#[derive(Debug, Clone)]
pub struct HookCheckStateMessage { pub data: MessageData }
impl_message_fields!(HookCheckStateMessage);

/// Hook reference message.
#[derive(Debug, Clone)]
pub struct HookReferenceMessage { pub data: MessageData }
impl_message_fields!(HookReferenceMessage);

/// Hook validation message.
#[derive(Debug, Clone)]
pub struct HookValidationMessage { pub data: MessageData }
impl_message_fields!(HookValidationMessage);

/// Hook script message.
#[derive(Debug, Clone)]
pub struct HookScriptMessage { pub data: MessageData }
impl_message_fields!(HookScriptMessage);

/// Hook datetime message.
#[derive(Debug, Clone)]
pub struct HookDatetimeMessage { pub data: MessageData }
impl_message_fields!(HookDatetimeMessage);

/// Hook file change message.
#[derive(Debug, Clone)]
pub struct HookFileChangeMessage { pub data: MessageData }

#[Object]
impl HookFileChangeMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    async fn file_path(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "file_path") }
    async fn action(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "action") }
}

/// Hook validation cache message.
#[derive(Debug, Clone)]
pub struct HookValidationCacheMessage { pub data: MessageData }
impl_message_fields!(HookValidationCacheMessage);

// ============================================================================
// Queue Operation Message
// ============================================================================

/// A queue operation message.
#[derive(Debug, Clone)]
pub struct QueueOperationMessage { pub data: MessageData }

#[Object]
impl QueueOperationMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    async fn operation(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "operation") }
}

// ============================================================================
// MCP Tool Messages
// ============================================================================

/// An MCP tool call message.
#[derive(Debug, Clone)]
pub struct McpToolCallMessage { pub data: MessageData }

#[Object]
impl McpToolCallMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    async fn tool(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "tool") }
    async fn server_name(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "server_name") }
    async fn call_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "call_id") }
    async fn arguments(&self) -> Option<String> {
        if let Some(ref raw) = self.data.raw_json {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(raw) {
                if let Some(args) = parsed.get("data").and_then(|d| d.get("arguments")) {
                    return Some(serde_json::to_string_pretty(args).unwrap_or_default());
                }
            }
        }
        None
    }
}

/// An MCP tool result message.
#[derive(Debug, Clone)]
pub struct McpToolResultMessage { pub data: MessageData }

#[Object]
impl McpToolResultMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    async fn call_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "call_id") }
    async fn success(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "success") }
    async fn duration_ms(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "duration_ms") }
}

// ============================================================================
// Exposed Tool Messages
// ============================================================================

/// An exposed tool call message.
#[derive(Debug, Clone)]
pub struct ExposedToolCallMessage { pub data: MessageData }

#[Object]
impl ExposedToolCallMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    async fn tool(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "tool") }
    async fn server(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "server") }
    async fn call_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "call_id") }
    async fn prefixed_name(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "prefixed_name") }
}

/// An exposed tool result message.
#[derive(Debug, Clone)]
pub struct ExposedToolResultMessage { pub data: MessageData }

#[Object]
impl ExposedToolResultMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    async fn call_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "call_id") }
    async fn success(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "success") }
    async fn duration_ms(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "duration_ms") }
}

// ============================================================================
// Memory Messages
// ============================================================================

/// A memory query message.
#[derive(Debug, Clone)]
pub struct MemoryQueryMessage { pub data: MessageData }

#[Object]
impl MemoryQueryMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    async fn query(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "query") }
}

/// A memory learn message.
#[derive(Debug, Clone)]
pub struct MemoryLearnMessage { pub data: MessageData }

#[Object]
impl MemoryLearnMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    async fn content(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "content") }
    async fn domain(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "domain") }
}

// ============================================================================
// Sentiment Analysis Message
// ============================================================================

/// A sentiment analysis message.
#[derive(Debug, Clone)]
pub struct SentimentAnalysisMessage { pub data: MessageData }

#[Object]
impl SentimentAnalysisMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    async fn message_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "message_id") }
    async fn sentiment_score(&self) -> Option<f64> { parse_data_field_f64(&self.data.raw_json, "sentiment_score") }
    async fn sentiment_level(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "sentiment_level") }
    async fn frustration_score(&self) -> Option<f64> { parse_data_field_f64(&self.data.raw_json, "frustration_score") }
    async fn frustration_level(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "frustration_level") }
}

// ============================================================================
// Unknown Event Message
// ============================================================================

/// An unknown/unrecognized event message.
#[derive(Debug, Clone)]
pub struct UnknownEventMessage { pub data: MessageData }

#[Object]
impl UnknownEventMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }

    /// The unrecognized event type.
    async fn event_type(&self) -> Option<&str> {
        self.data.tool_name.as_deref()
    }
}

// ============================================================================
// Message Connection (Relay pagination)
// ============================================================================

/// Message edge for connections.
#[derive(Debug, Clone, SimpleObject)]
pub struct MessageEdge {
    /// The message at this edge.
    pub node: Message,
    /// Cursor for this edge.
    pub cursor: String,
}

/// Message connection with pagination.
#[derive(Debug, Clone, SimpleObject)]
pub struct MessageConnection {
    /// List of message edges.
    pub edges: Vec<MessageEdge>,
    /// Pagination information.
    pub page_info: PageInfo,
    /// Total number of messages.
    pub total_count: i32,
}

// ============================================================================
// Message discrimination
// ============================================================================

/// Discriminate a database message into the appropriate Message variant.
pub fn discriminate_message(data: MessageData) -> Message {
    match data.message_type.as_str() {
        "user" => {
            // Check for continuation summary
            if is_summary_message(&data) {
                return Message::Summary(SummaryMessage { data });
            }
            // Check for tool-result-only user messages
            if is_tool_result_user_message(&data) {
                return Message::ToolResultUser(ToolResultUserMessage { data });
            }
            // Route based on user metadata
            let metadata = parse_user_metadata(&data.raw_json);
            if metadata.is_command {
                Message::CommandUser(CommandUserMessage { data })
            } else if metadata.is_interrupt {
                Message::InterruptUser(InterruptUserMessage { data })
            } else if metadata.is_meta {
                Message::MetaUser(MetaUserMessage { data })
            } else {
                Message::RegularUser(RegularUserMessage { data })
            }
        }
        "assistant" => Message::Assistant(AssistantMessage { data }),
        "summary" => Message::Summary(SummaryMessage { data }),
        "system" => Message::System(SystemMessage { data }),
        "file-history-snapshot" => Message::FileHistorySnapshot(FileHistorySnapshotMessage { data }),
        "hook_run" => Message::HookRun(HookRunMessage { data }),
        "hook_result" => Message::HookResult(HookResultMessage { data }),
        "queue-operation" => Message::QueueOperation(QueueOperationMessage { data }),
        "han_event" => discriminate_han_event(data),
        _ => Message::UnknownEvent(UnknownEventMessage { data }),
    }
}

fn discriminate_han_event(data: MessageData) -> Message {
    match data.tool_name.as_deref() {
        Some("hook_run") => Message::HookRun(HookRunMessage { data }),
        Some("hook_result") => Message::HookResult(HookResultMessage { data }),
        Some("hook_check_state") => Message::HookCheckState(HookCheckStateMessage { data }),
        Some("hook_reference") => Message::HookReference(HookReferenceMessage { data }),
        Some("hook_validation") => Message::HookValidation(HookValidationMessage { data }),
        Some("hook_script") => Message::HookScript(HookScriptMessage { data }),
        Some("hook_datetime") => Message::HookDatetime(HookDatetimeMessage { data }),
        Some("hook_file_change") => Message::HookFileChange(HookFileChangeMessage { data }),
        Some("hook_validation_cache") => Message::HookValidationCache(HookValidationCacheMessage { data }),
        Some("queue_operation") => Message::QueueOperation(QueueOperationMessage { data }),
        Some("mcp_tool_call") => Message::McpToolCall(McpToolCallMessage { data }),
        Some("mcp_tool_result") => Message::McpToolResult(McpToolResultMessage { data }),
        Some("exposed_tool_call") => Message::ExposedToolCall(ExposedToolCallMessage { data }),
        Some("exposed_tool_result") => Message::ExposedToolResult(ExposedToolResultMessage { data }),
        Some("memory_query") => Message::MemoryQuery(MemoryQueryMessage { data }),
        Some("memory_learn") => Message::MemoryLearn(MemoryLearnMessage { data }),
        Some("sentiment_analysis") => Message::SentimentAnalysis(SentimentAnalysisMessage { data }),
        _ => Message::UnknownEvent(UnknownEventMessage { data }),
    }
}

/// Check if a message should be excluded from the messages connection.
pub fn is_paired_event(msg: &messages::Model) -> bool {
    if msg.message_type == "han_event" {
        if let Some(ref tool_name) = msg.tool_name {
            return PAIRED_EVENT_TYPES.contains(&tool_name.as_str());
        }
    }
    // Also filter tool-result-only user messages
    is_tool_result_user_model(msg)
}

// ============================================================================
// Helpers
// ============================================================================

struct UserMetadata {
    is_command: bool,
    is_interrupt: bool,
    is_meta: bool,
}

fn parse_user_metadata(raw_json: &Option<String>) -> UserMetadata {
    let mut meta = UserMetadata {
        is_command: false,
        is_interrupt: false,
        is_meta: false,
    };

    if let Some(ref raw) = raw_json {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(raw) {
            meta.is_command = parsed.get("isCommand").and_then(|v| v.as_bool()).unwrap_or(false);
            meta.is_interrupt = parsed.get("isInterrupt").and_then(|v| v.as_bool()).unwrap_or(false);
            meta.is_meta = parsed.get("isMeta").and_then(|v| v.as_bool()).unwrap_or(false);
        }
    }

    meta
}

fn is_summary_message(data: &MessageData) -> bool {
    if data.message_type != "user" { return false; }
    if let Some(ref content) = data.content {
        if content.contains("This session is being continued from a previous conversation") {
            return true;
        }
    }
    if let Some(ref raw) = data.raw_json {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(raw) {
            if parsed.get("isMeta").and_then(|v| v.as_bool()).unwrap_or(false) {
                if let Some(ref content) = data.content {
                    if content.contains("Summary:") {
                        return true;
                    }
                }
            }
        }
    }
    false
}

fn is_tool_result_user_message(data: &MessageData) -> bool {
    if data.message_type != "user" { return false; }
    if let Some(ref raw) = data.raw_json {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(raw) {
            if let Some(content) = parsed.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_array()) {
                if !content.is_empty() && content.iter().all(|b| b.get("type").and_then(|t| t.as_str()) == Some("tool_result")) {
                    return true;
                }
            }
        }
    }
    false
}

fn is_tool_result_user_model(msg: &messages::Model) -> bool {
    if msg.message_type != "user" { return false; }
    if let Some(ref raw) = msg.raw_json {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(raw) {
            if let Some(content) = parsed.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_array()) {
                if !content.is_empty() && content.iter().all(|b| b.get("type").and_then(|t| t.as_str()) == Some("tool_result")) {
                    return true;
                }
            }
        }
    }
    false
}

fn parse_user_metadata_field(raw_json: &Option<String>, field: &str) -> Option<String> {
    let raw = raw_json.as_ref()?;
    let parsed: serde_json::Value = serde_json::from_str(raw).ok()?;
    parsed.get(field).and_then(|v| v.as_str()).map(|s| s.to_string())
}

fn parse_json_field(raw_json: &Option<String>, path: &[&str]) -> Option<String> {
    let raw = raw_json.as_ref()?;
    let mut parsed: serde_json::Value = serde_json::from_str(raw).ok()?;
    for key in path {
        parsed = parsed.get(*key)?.clone();
    }
    parsed.as_str().map(|s| s.to_string())
}

fn parse_data_field(raw_json: &Option<String>, field: &str) -> Option<String> {
    let raw = raw_json.as_ref()?;
    let parsed: serde_json::Value = serde_json::from_str(raw).ok()?;
    parsed.get("data").and_then(|d| d.get(field)).and_then(|v| v.as_str()).map(|s| s.to_string())
}

fn parse_data_field_bool(raw_json: &Option<String>, field: &str) -> Option<bool> {
    let raw = raw_json.as_ref()?;
    let parsed: serde_json::Value = serde_json::from_str(raw).ok()?;
    parsed.get("data").and_then(|d| d.get(field)).and_then(|v| v.as_bool())
}

fn parse_data_field_int(raw_json: &Option<String>, field: &str) -> Option<i32> {
    let raw = raw_json.as_ref()?;
    let parsed: serde_json::Value = serde_json::from_str(raw).ok()?;
    parsed.get("data").and_then(|d| d.get(field)).and_then(|v| v.as_i64()).map(|v| v as i32)
}

fn parse_data_field_f64(raw_json: &Option<String>, field: &str) -> Option<f64> {
    let raw = raw_json.as_ref()?;
    let parsed: serde_json::Value = serde_json::from_str(raw).ok()?;
    parsed.get("data").and_then(|d| d.get(field)).and_then(|v| v.as_f64())
}

// ============================================================================
// Tests
// ============================================================================

#[cfg(test)]
mod tests {
    use super::*;

    fn make_data(message_type: &str, tool_name: Option<&str>) -> MessageData {
        MessageData {
            id: "test-uuid".into(),
            session_id: "session-1".into(),
            project_dir: "/project".into(),
            line_number: 1,
            timestamp: "2024-01-01T00:00:00Z".into(),
            raw_json: None,
            agent_id: None,
            parent_id: None,
            message_type: message_type.into(),
            tool_name: tool_name.map(|s| s.into()),
            content: Some("test content".into()),
            role: None,
        }
    }

    fn make_model(message_type: &str, tool_name: Option<&str>, raw_json: Option<&str>) -> messages::Model {
        messages::Model {
            id: "test-uuid".into(),
            session_id: "session-1".into(),
            agent_id: None,
            parent_id: None,
            message_type: message_type.into(),
            role: Some("user".into()),
            content: Some("test content".into()),
            tool_name: tool_name.map(|s| s.into()),
            tool_input: None,
            tool_result: None,
            raw_json: raw_json.map(|s| s.into()),
            timestamp: "2024-01-01T00:00:00Z".into(),
            line_number: 1,
            source_file_name: None,
            source_file_type: None,
            sentiment_score: None,
            sentiment_level: None,
            frustration_score: None,
            frustration_level: None,
            input_tokens: None,
            output_tokens: None,
            cache_read_tokens: None,
            cache_creation_tokens: None,
            lines_added: None,
            lines_removed: None,
            files_changed: None,
            indexed_at: None,
        }
    }

    // --- Message Discrimination Tests ---

    #[test]
    fn test_discriminate_regular_user() {
        let data = make_data("user", None);
        match discriminate_message(data) {
            Message::RegularUser(_) => {}
            other => panic!("Expected RegularUser, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_assistant() {
        let data = make_data("assistant", None);
        match discriminate_message(data) {
            Message::Assistant(_) => {}
            other => panic!("Expected Assistant, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_system() {
        let data = make_data("system", None);
        match discriminate_message(data) {
            Message::System(_) => {}
            other => panic!("Expected System, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_summary() {
        let data = make_data("summary", None);
        match discriminate_message(data) {
            Message::Summary(_) => {}
            other => panic!("Expected Summary, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_file_history_snapshot() {
        let data = make_data("file-history-snapshot", None);
        match discriminate_message(data) {
            Message::FileHistorySnapshot(_) => {}
            other => panic!("Expected FileHistorySnapshot, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_hook_run() {
        let data = make_data("hook_run", None);
        match discriminate_message(data) {
            Message::HookRun(_) => {}
            other => panic!("Expected HookRun, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_hook_result() {
        let data = make_data("hook_result", None);
        match discriminate_message(data) {
            Message::HookResult(_) => {}
            other => panic!("Expected HookResult, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_queue_operation() {
        let data = make_data("queue-operation", None);
        match discriminate_message(data) {
            Message::QueueOperation(_) => {}
            other => panic!("Expected QueueOperation, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_unknown() {
        let data = make_data("some_future_type", None);
        match discriminate_message(data) {
            Message::UnknownEvent(_) => {}
            other => panic!("Expected UnknownEvent, got {:?}", std::mem::discriminant(&other)),
        }
    }

    // --- Han Event Discrimination ---

    #[test]
    fn test_discriminate_han_event_hook_run() {
        let data = make_data("han_event", Some("hook_run"));
        match discriminate_message(data) {
            Message::HookRun(_) => {}
            other => panic!("Expected HookRun, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_han_event_mcp_tool_call() {
        let data = make_data("han_event", Some("mcp_tool_call"));
        match discriminate_message(data) {
            Message::McpToolCall(_) => {}
            other => panic!("Expected McpToolCall, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_han_event_mcp_tool_result() {
        let data = make_data("han_event", Some("mcp_tool_result"));
        match discriminate_message(data) {
            Message::McpToolResult(_) => {}
            other => panic!("Expected McpToolResult, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_han_event_exposed_tool_call() {
        let data = make_data("han_event", Some("exposed_tool_call"));
        match discriminate_message(data) {
            Message::ExposedToolCall(_) => {}
            other => panic!("Expected ExposedToolCall, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_han_event_memory_query() {
        let data = make_data("han_event", Some("memory_query"));
        match discriminate_message(data) {
            Message::MemoryQuery(_) => {}
            other => panic!("Expected MemoryQuery, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_han_event_sentiment_analysis() {
        let data = make_data("han_event", Some("sentiment_analysis"));
        match discriminate_message(data) {
            Message::SentimentAnalysis(_) => {}
            other => panic!("Expected SentimentAnalysis, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_han_event_unknown() {
        let data = make_data("han_event", Some("future_event_type"));
        match discriminate_message(data) {
            Message::UnknownEvent(_) => {}
            other => panic!("Expected UnknownEvent, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_han_event_no_tool_name() {
        let data = make_data("han_event", None);
        match discriminate_message(data) {
            Message::UnknownEvent(_) => {}
            other => panic!("Expected UnknownEvent, got {:?}", std::mem::discriminant(&other)),
        }
    }

    // --- User Subtypes ---

    #[test]
    fn test_discriminate_command_user() {
        let mut data = make_data("user", None);
        data.raw_json = Some(r#"{"isCommand": true}"#.into());
        match discriminate_message(data) {
            Message::CommandUser(_) => {}
            other => panic!("Expected CommandUser, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_interrupt_user() {
        let mut data = make_data("user", None);
        data.raw_json = Some(r#"{"isInterrupt": true}"#.into());
        match discriminate_message(data) {
            Message::InterruptUser(_) => {}
            other => panic!("Expected InterruptUser, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_meta_user() {
        let mut data = make_data("user", None);
        data.raw_json = Some(r#"{"isMeta": true}"#.into());
        match discriminate_message(data) {
            Message::MetaUser(_) => {}
            other => panic!("Expected MetaUser, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_summary_user_by_content() {
        let mut data = make_data("user", None);
        data.content = Some("This session is being continued from a previous conversation".into());
        match discriminate_message(data) {
            Message::Summary(_) => {}
            other => panic!("Expected Summary, got {:?}", std::mem::discriminant(&other)),
        }
    }

    #[test]
    fn test_discriminate_tool_result_user() {
        let mut data = make_data("user", None);
        data.raw_json = Some(r#"{"message":{"content":[{"type":"tool_result","tool_use_id":"123","content":"ok"}]}}"#.into());
        match discriminate_message(data) {
            Message::ToolResultUser(_) => {}
            other => panic!("Expected ToolResultUser, got {:?}", std::mem::discriminant(&other)),
        }
    }

    // --- Paired Event Filtering ---

    #[test]
    fn test_is_paired_event_sentiment() {
        let model = make_model("han_event", Some("sentiment_analysis"), None);
        assert!(is_paired_event(&model));
    }

    #[test]
    fn test_is_paired_event_hook_result() {
        let model = make_model("han_event", Some("hook_result"), None);
        assert!(is_paired_event(&model));
    }

    #[test]
    fn test_is_paired_event_mcp_tool_result() {
        let model = make_model("han_event", Some("mcp_tool_result"), None);
        assert!(is_paired_event(&model));
    }

    #[test]
    fn test_is_paired_event_exposed_tool_result() {
        let model = make_model("han_event", Some("exposed_tool_result"), None);
        assert!(is_paired_event(&model));
    }

    #[test]
    fn test_is_not_paired_event_hook_run() {
        let model = make_model("han_event", Some("hook_run"), None);
        assert!(!is_paired_event(&model));
    }

    #[test]
    fn test_is_not_paired_event_regular_user() {
        let model = make_model("user", None, None);
        assert!(!is_paired_event(&model));
    }

    #[test]
    fn test_is_not_paired_event_assistant() {
        let model = make_model("assistant", None, None);
        assert!(!is_paired_event(&model));
    }

    #[test]
    fn test_is_paired_event_tool_result_user() {
        let model = make_model("user", None, Some(r#"{"message":{"content":[{"type":"tool_result","tool_use_id":"123","content":"ok"}]}}"#));
        assert!(is_paired_event(&model));
    }

    // --- Message Data Helpers ---

    #[test]
    fn test_search_text_with_content() {
        let data = make_data("user", None);
        let text = data.search_text().unwrap();
        assert!(text.contains("test content"));
        assert!(text.contains("user"));
    }

    #[test]
    fn test_search_text_with_tool_name() {
        let data = make_data("han_event", Some("hook_run"));
        let text = data.search_text().unwrap();
        assert!(text.contains("han_event"));
        assert!(text.contains("hook_run"));
    }

    #[test]
    fn test_global_id_format() {
        let data = make_data("user", None);
        assert_eq!(data.global_id().as_str(), "Message:test-uuid");
    }

    // --- JSON Parsing Helpers ---

    #[test]
    fn test_parse_data_field() {
        let raw = Some(r#"{"data":{"hook":"pre_tool_use","plugin":"biome"}}"#.into());
        assert_eq!(parse_data_field(&raw, "hook"), Some("pre_tool_use".into()));
        assert_eq!(parse_data_field(&raw, "plugin"), Some("biome".into()));
        assert_eq!(parse_data_field(&raw, "nonexistent"), None);
    }

    #[test]
    fn test_parse_data_field_bool() {
        let raw = Some(r#"{"data":{"success":true,"cached":false}}"#.into());
        assert_eq!(parse_data_field_bool(&raw, "success"), Some(true));
        assert_eq!(parse_data_field_bool(&raw, "cached"), Some(false));
    }

    #[test]
    fn test_parse_data_field_int() {
        let raw = Some(r#"{"data":{"duration_ms":42,"exit_code":0}}"#.into());
        assert_eq!(parse_data_field_int(&raw, "duration_ms"), Some(42));
        assert_eq!(parse_data_field_int(&raw, "exit_code"), Some(0));
    }

    #[test]
    fn test_parse_data_field_f64() {
        let raw = Some(r#"{"data":{"sentiment_score":0.75}}"#.into());
        assert_eq!(parse_data_field_f64(&raw, "sentiment_score"), Some(0.75));
    }

    #[test]
    fn test_parse_json_field_nested() {
        let raw = Some(r#"{"model":"claude-3-opus"}"#.into());
        assert_eq!(parse_json_field(&raw, &["model"]), Some("claude-3-opus".into()));
    }

    #[test]
    fn test_parse_user_metadata_field() {
        let raw = Some(r#"{"command":"/help"}"#.into());
        assert_eq!(parse_user_metadata_field(&raw, "command"), Some("/help".into()));
    }

    // --- Build Message Connection ---

    #[test]
    fn test_build_message_connection_filters_paired_events() {
        let models = vec![
            make_model("user", None, None),
            make_model("assistant", None, None),
            make_model("han_event", Some("sentiment_analysis"), None), // paired - filtered
            make_model("han_event", Some("hook_run"), None),
        ];

        let conn = build_message_connection(&models, "/proj", None, None, None, None);
        // Should have 3 messages (user, assistant, hook_run) - sentiment_analysis filtered
        // Note: the build function also filters empty messages, so user/assistant with content pass
        assert_eq!(conn.total_count, 3);
    }

    #[test]
    fn test_build_message_connection_pagination_first() {
        let models: Vec<_> = (0..5)
            .map(|i| {
                let mut m = make_model("user", None, None);
                m.id = format!("uuid-{i}");
                m.content = Some(format!("message {i}"));
                m
            })
            .collect();

        let conn = build_message_connection(&models, "/proj", Some(2), None, None, None);
        assert_eq!(conn.edges.len(), 2);
        assert_eq!(conn.total_count, 5);
        assert!(conn.page_info.has_next_page);
        assert!(!conn.page_info.has_previous_page);
    }

    #[test]
    fn test_build_message_connection_empty() {
        let conn = build_message_connection(&[], "/proj", None, None, None, None);
        assert_eq!(conn.total_count, 0);
        assert!(conn.edges.is_empty());
        assert!(!conn.page_info.has_next_page);
        assert!(!conn.page_info.has_previous_page);
    }
}

/// Build a MessageConnection from database messages, filtering paired events.
pub fn build_message_connection(
    messages: &[messages::Model],
    project_dir: &str,
    first: Option<i32>,
    after: Option<String>,
    last: Option<i32>,
    before: Option<String>,
) -> MessageConnection {
    // Filter out paired events and tool-result-only messages
    let filtered: Vec<_> = messages
        .iter()
        .enumerate()
        .filter(|(_, msg)| !is_paired_event(msg))
        .filter(|(_, msg)| {
            // Also filter empty messages
            msg.content.as_ref().map(|c| !c.is_empty()).unwrap_or(false)
                || msg.message_type == "summary"
                || msg.message_type == "han_event"
        })
        .collect();

    let total_count = filtered.len() as i32;

    // Build message data with cursors
    let items: Vec<(MessageData, String)> = filtered
        .iter()
        .map(|(idx, msg)| {
            let data = MessageData::from_model(msg, project_dir);
            let cursor = encode_message_cursor(project_dir, &msg.session_id, (*idx as i32) + 1);
            (data, cursor)
        })
        .collect();

    // Apply pagination
    let all_edges: Vec<MessageEdge> = items
        .into_iter()
        .map(|(data, cursor)| MessageEdge {
            node: discriminate_message(data),
            cursor,
        })
        .collect();

    // Simple pagination implementation
    let start_idx = if let Some(ref after_cursor) = after {
        all_edges.iter().position(|e| e.cursor == *after_cursor).map(|i| i + 1).unwrap_or(0)
    } else {
        0
    };

    let end_idx = if let Some(ref before_cursor) = before {
        all_edges.iter().position(|e| e.cursor == *before_cursor).unwrap_or(all_edges.len())
    } else {
        all_edges.len()
    };

    let mut slice = &all_edges[start_idx..end_idx];
    let has_previous_page;
    let has_next_page;

    if let Some(f) = first {
        let f = f as usize;
        has_previous_page = start_idx > 0;
        if slice.len() > f {
            slice = &slice[..f];
            has_next_page = true;
        } else {
            has_next_page = end_idx < all_edges.len();
        }
    } else if let Some(l) = last {
        let l = l as usize;
        has_next_page = end_idx < all_edges.len();
        if slice.len() > l {
            slice = &slice[slice.len() - l..];
            has_previous_page = true;
        } else {
            has_previous_page = start_idx > 0;
        }
    } else {
        has_previous_page = start_idx > 0;
        has_next_page = end_idx < all_edges.len();
    }

    let edges: Vec<MessageEdge> = slice.to_vec();
    let start_cursor = edges.first().map(|e| e.cursor.clone());
    let end_cursor = edges.last().map(|e| e.cursor.clone());

    MessageConnection {
        edges,
        page_info: PageInfo {
            has_next_page,
            has_previous_page,
            start_cursor,
            end_cursor,
        },
        total_count,
    }
}
