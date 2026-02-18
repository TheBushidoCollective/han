//! Message types for GraphQL.
//!
//! Messages are discriminated by `message_type` and `tool_name` fields.
//! All messages (including results) appear chronologically in the timeline.
//! Result messages also remain accessible as fields on their parent types
//! (e.g., ToolUseBlock.result, HookRunMessage.result) for convenience.
//!
//! Message is a GraphQL **interface** (not union) because the browse-client
//! fragments use `... on UserMessage` and `... on AssistantMessage` etc.
//! within a Message context.

use async_graphql::*;
use han_db::entities::messages;

use crate::connection::PageInfo;
use crate::node::{encode_global_id, encode_message_cursor};
use crate::types::content_blocks::{ContentBlock, parse_content_blocks};
use crate::types::sentiment::SentimentAnalysis;

// ============================================================================
// Message Interface
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

    fn content_text(&self) -> Option<String> {
        self.content.clone()
    }
}

/// Message interface - the base type for all messages in a session.
/// Uses GraphQL interface (not union) so clients can use `... on UserMessage` etc.
#[derive(Debug, Clone, Interface)]
#[graphql(
    field(name = "id", ty = "ID"),
    field(name = "uuid", ty = "&str"),
    field(name = "timestamp", ty = "&str"),
    field(name = "raw_json", ty = "Option<&str>"),
    field(name = "agent_id", ty = "Option<&str>"),
    field(name = "parent_id", ty = "Option<&str>"),
    field(name = "search_text", ty = "Option<String>"),
)]
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

/// UserMessage interface - user message subtypes with content, contentBlocks, sentimentAnalysis.
/// Note: async-graphql doesn't support interface inheritance (issue #322),
/// so UserMessage is a standalone interface. Concrete types are variants in BOTH
/// Message and UserMessage enums, producing `type X implements Message & UserMessage`.
#[derive(Debug, Clone, Interface)]
#[graphql(
    field(name = "id", ty = "ID"),
    field(name = "uuid", ty = "&str"),
    field(name = "timestamp", ty = "&str"),
    field(name = "raw_json", ty = "Option<&str>"),
    field(name = "agent_id", ty = "Option<&str>"),
    field(name = "parent_id", ty = "Option<&str>"),
    field(name = "search_text", ty = "Option<String>"),
    field(name = "content", ty = "Option<String>"),
    field(name = "content_blocks", ty = "Option<Vec<ContentBlock>>"),
    field(name = "sentiment_analysis", ty = "Option<SentimentAnalysis>"),
)]
pub enum UserMessage {
    Regular(RegularUserMessage),
    Command(CommandUserMessage),
    Interrupt(InterruptUserMessage),
    Meta(MetaUserMessage),
    ToolResult(ToolResultUserMessage),
}

// ============================================================================
// User Message Types
// ============================================================================

/// A regular user message (prompt from the user).
#[derive(Debug, Clone)]
pub struct RegularUserMessage {
    pub data: MessageData,
}

#[Object]
impl RegularUserMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    async fn content(&self) -> Option<String> { self.data.content_text() }
    async fn content_blocks(&self) -> Option<Vec<ContentBlock>> {
        Some(parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        ))
    }
    async fn sentiment_analysis(&self) -> Option<SentimentAnalysis> { None }
}

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
    async fn content(&self) -> Option<String> { self.data.content_text() }
    async fn content_blocks(&self) -> Option<Vec<ContentBlock>> {
        Some(parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        ))
    }
    async fn sentiment_analysis(&self) -> Option<SentimentAnalysis> { None }
    /// The command that was invoked.
    async fn command_name(&self) -> Option<String> {
        parse_user_metadata_field(&self.data.raw_json, "command")
    }
}

/// An interrupt user message.
#[derive(Debug, Clone)]
pub struct InterruptUserMessage {
    pub data: MessageData,
}

#[Object]
impl InterruptUserMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    async fn content(&self) -> Option<String> { self.data.content_text() }
    async fn content_blocks(&self) -> Option<Vec<ContentBlock>> {
        Some(parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        ))
    }
    async fn sentiment_analysis(&self) -> Option<SentimentAnalysis> { None }
}

/// A meta user message (system-injected, not shown to user).
#[derive(Debug, Clone)]
pub struct MetaUserMessage {
    pub data: MessageData,
}

#[Object]
impl MetaUserMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    async fn content(&self) -> Option<String> { self.data.content_text() }
    async fn content_blocks(&self) -> Option<Vec<ContentBlock>> {
        Some(parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        ))
    }
    async fn sentiment_analysis(&self) -> Option<SentimentAnalysis> { None }
}

/// A user message that is actually a tool result container.
#[derive(Debug, Clone)]
pub struct ToolResultUserMessage {
    pub data: MessageData,
}

#[Object]
impl ToolResultUserMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    async fn content(&self) -> Option<String> { self.data.content_text() }
    async fn content_blocks(&self) -> Option<Vec<ContentBlock>> {
        Some(parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        ))
    }
    async fn sentiment_analysis(&self) -> Option<SentimentAnalysis> { None }
    /// Number of tool results in this message.
    async fn tool_result_count(&self) -> Option<i32> {
        if let Some(ref raw) = self.data.raw_json {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(raw) {
                if let Some(content) = parsed.get("message").and_then(|m| m.get("content")).and_then(|c| c.as_array()) {
                    return Some(content.len() as i32);
                }
            }
        }
        None
    }
}

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

    /// Text content of the message.
    async fn content(&self) -> Option<String> { self.data.content_text() }

    /// Parsed content blocks (text, thinking, tool_use, etc.).
    async fn content_blocks(&self) -> Option<Vec<ContentBlock>> {
        Some(parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        ))
    }

    /// Model ID that generated this message.
    async fn model(&self) -> Option<String> {
        parse_json_field(&self.data.raw_json, &["model"])
    }

    /// Stop reason.
    async fn stop_reason(&self) -> Option<String> {
        parse_json_field(&self.data.raw_json, &["stop_reason"])
    }

    /// Whether this message contains only tool use blocks (no text).
    async fn is_tool_only(&self) -> Option<bool> {
        let blocks = parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        );
        if blocks.is_empty() { return Some(false); }
        Some(blocks.iter().all(|b| matches!(b, ContentBlock::ToolUse(_))))
    }

    /// Whether this message contains thinking blocks.
    async fn has_thinking(&self) -> Option<bool> {
        let blocks = parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        );
        Some(blocks.iter().any(|b| matches!(b, ContentBlock::Thinking(_))))
    }

    /// Count of thinking blocks.
    async fn thinking_count(&self) -> Option<i32> {
        let blocks = parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        );
        Some(blocks.iter().filter(|b| matches!(b, ContentBlock::Thinking(_))).count() as i32)
    }

    /// Whether this message contains tool use blocks.
    async fn has_tool_use(&self) -> Option<bool> {
        let blocks = parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        );
        Some(blocks.iter().any(|b| matches!(b, ContentBlock::ToolUse(_))))
    }

    /// Count of tool use blocks.
    async fn tool_use_count(&self) -> Option<i32> {
        let blocks = parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        );
        Some(blocks.iter().filter(|b| matches!(b, ContentBlock::ToolUse(_))).count() as i32)
    }

    /// Input tokens used.
    async fn input_tokens(&self) -> Option<i64> {
        parse_json_field_i64(&self.data.raw_json, &["usage", "input_tokens"])
    }

    /// Output tokens used.
    async fn output_tokens(&self) -> Option<i64> {
        parse_json_field_i64(&self.data.raw_json, &["usage", "output_tokens"])
    }

    /// Cached tokens.
    async fn cached_tokens(&self) -> Option<i64> {
        parse_json_field_i64(&self.data.raw_json, &["usage", "cache_read_input_tokens"])
            .or_else(|| parse_json_field_i64(&self.data.raw_json, &["usage", "cache_creation_input_tokens"]))
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
    async fn content(&self) -> Option<String> { self.data.content.clone() }
    /// Parsed content blocks.
    async fn content_blocks(&self) -> Option<Vec<ContentBlock>> {
        Some(parse_content_blocks(
            self.data.content.as_deref(),
            self.data.raw_json.as_deref(),
            Some(&self.data.session_id),
        ))
    }
    /// Whether this is a context compaction summary.
    async fn is_compact_summary(&self) -> Option<bool> { Some(false) }
}

/// A system message.
#[derive(Debug, Clone)]
pub struct SystemMessage {
    pub data: MessageData,
}

#[Object]
impl SystemMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    /// System message text content.
    async fn content(&self) -> Option<String> { self.data.content_text() }
    /// Whether this is a meta message.
    async fn is_meta(&self) -> Option<bool> { Some(false) }
    /// Message severity level.
    async fn level(&self) -> Option<String> { None }
    /// System message subtype.
    async fn subtype(&self) -> Option<String> { None }
}

// ============================================================================
// File History Snapshot
// ============================================================================

/// A file history snapshot message.
#[derive(Debug, Clone)]
pub struct FileHistorySnapshotMessage {
    pub data: MessageData,
}

#[Object]
impl FileHistorySnapshotMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    async fn message_id(&self) -> Option<&str> { Some(&self.data.id) }
    async fn file_count(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "file_count") }
    async fn is_snapshot_update(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "is_snapshot_update") }
    async fn snapshot_timestamp(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "snapshot_timestamp") }
}

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
    async fn hook(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "hook") }
    async fn plugin(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "plugin") }
    async fn hook_type(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "hook_type") }
    async fn directory(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "directory") }
    async fn hook_run_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "hook_run_id").or_else(|| Some(self.data.id.clone())) }
    async fn cached(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "cached") }
    /// Hook result (resolved via DataLoader in the future).
    async fn result(&self) -> Option<HookResult> { None }
}

/// Hook result stub type for HookRunMessage.result.
#[derive(Debug, Clone, SimpleObject)]
pub struct HookResult {
    pub id: Option<String>,
    pub success: Option<bool>,
    pub result: Option<String>,
    pub output: Option<String>,
    pub error: Option<String>,
    pub duration_ms: Option<i32>,
    pub exit_code: Option<i32>,
    pub cached: Option<bool>,
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
    async fn hook(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "hook") }
    async fn directory(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "directory") }
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

#[Object]
impl HookCheckStateMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    async fn hook_type(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "hook_type") }
    async fn hooks_count(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "hooks_count") }
    async fn fingerprint(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "fingerprint") }
}

/// Hook reference message.
#[derive(Debug, Clone)]
pub struct HookReferenceMessage { pub data: MessageData }

#[Object]
impl HookReferenceMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    async fn file_path(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "file_path") }
    async fn plugin(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "plugin") }
    async fn reason(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "reason") }
    async fn success(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "success") }
    async fn duration_ms(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "duration_ms") }
}

/// Hook validation message.
#[derive(Debug, Clone)]
pub struct HookValidationMessage { pub data: MessageData }

#[Object]
impl HookValidationMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    async fn hook(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "hook") }
    async fn plugin(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "plugin") }
    async fn directory(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "directory") }
    async fn success(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "success") }
    async fn cached(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "cached") }
    async fn duration_ms(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "duration_ms") }
    async fn exit_code(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "exit_code") }
    async fn output(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "output") }
    async fn error(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "error") }
}

/// Hook script message.
#[derive(Debug, Clone)]
pub struct HookScriptMessage { pub data: MessageData }

#[Object]
impl HookScriptMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    async fn command(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "command") }
    async fn plugin(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "plugin") }
    async fn success(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "success") }
    async fn duration_ms(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "duration_ms") }
    async fn exit_code(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "exit_code") }
    async fn output(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "output") }
}

/// Hook datetime message.
#[derive(Debug, Clone)]
pub struct HookDatetimeMessage { pub data: MessageData }

#[Object]
impl HookDatetimeMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    async fn datetime(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "datetime") }
    async fn plugin(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "plugin") }
    async fn duration_ms(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "duration_ms") }
}

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
    async fn change_tool_name(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "change_tool_name") }
    async fn recorded_session_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "recorded_session_id") }
}

/// Hook validation cache message.
#[derive(Debug, Clone)]
pub struct HookValidationCacheMessage { pub data: MessageData }

#[Object]
impl HookValidationCacheMessage {
    async fn id(&self) -> ID { self.data.global_id() }
    async fn uuid(&self) -> &str { &self.data.id }
    async fn timestamp(&self) -> &str { &self.data.timestamp }
    async fn raw_json(&self) -> Option<&str> { self.data.raw_json.as_deref() }
    async fn agent_id(&self) -> Option<&str> { self.data.agent_id.as_deref() }
    async fn parent_id(&self) -> Option<&str> { self.data.parent_id.as_deref() }
    async fn search_text(&self) -> Option<String> { self.data.search_text() }
    async fn hook(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "hook") }
    async fn plugin(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "plugin") }
    async fn directory(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "directory") }
    async fn file_count(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "file_count") }
}

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
    async fn queue_session_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "queue_session_id") }
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
    async fn server(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "server_name").or_else(|| parse_data_field(&self.data.raw_json, "server")) }
    async fn server_name(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "server_name") }
    async fn call_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "call_id") }
    async fn prefixed_name(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "prefixed_name") }
    async fn input(&self) -> Option<String> {
        if let Some(ref raw) = self.data.raw_json {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(raw) {
                if let Some(args) = parsed.get("data").and_then(|d| d.get("arguments")) {
                    return Some(serde_json::to_string_pretty(args).unwrap_or_default());
                }
            }
        }
        None
    }
    /// Tool result (resolved via DataLoader in the future).
    async fn result(&self) -> Option<McpToolResult> { None }
}

/// MCP tool result stub.
#[derive(Debug, Clone, SimpleObject)]
pub struct McpToolResult {
    pub id: Option<String>,
    pub success: Option<bool>,
    pub result: Option<String>,
    pub output: Option<String>,
    pub error: Option<String>,
    pub duration_ms: Option<i32>,
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
    async fn tool(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "tool") }
    async fn server(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "server_name").or_else(|| parse_data_field(&self.data.raw_json, "server")) }
    async fn prefixed_name(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "prefixed_name") }
    async fn call_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "call_id") }
    async fn success(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "success") }
    async fn duration_ms(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "duration_ms") }
    async fn output(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "output") }
    async fn error(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "error") }
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
    async fn input(&self) -> Option<String> {
        if let Some(ref raw) = self.data.raw_json {
            if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(raw) {
                if let Some(args) = parsed.get("data").and_then(|d| d.get("arguments")) {
                    return Some(serde_json::to_string_pretty(args).unwrap_or_default());
                }
            }
        }
        None
    }
    /// Tool result (resolved via DataLoader in the future).
    async fn result(&self) -> Option<ExposedToolResult> { None }
}

/// Exposed tool result stub.
#[derive(Debug, Clone, SimpleObject)]
pub struct ExposedToolResult {
    pub id: Option<String>,
    pub success: Option<bool>,
    pub result: Option<String>,
    pub output: Option<String>,
    pub error: Option<String>,
    pub duration_ms: Option<i32>,
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
    async fn tool(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "tool") }
    async fn prefixed_name(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "prefixed_name") }
    async fn call_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "call_id") }
    async fn success(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "success") }
    async fn duration_ms(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "duration_ms") }
    async fn output(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "output") }
    async fn error(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "error") }
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
    async fn question(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "question").or_else(|| parse_data_field(&self.data.raw_json, "query")) }
    async fn route(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "route") }
    async fn result_count(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "result_count") }
    async fn duration_ms(&self) -> Option<i32> { parse_data_field_int(&self.data.raw_json, "duration_ms") }
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
    async fn scope(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "scope").or_else(|| parse_data_field(&self.data.raw_json, "domain")) }
    async fn domain(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "domain").or_else(|| parse_data_field(&self.data.raw_json, "scope")) }
    async fn append(&self) -> Option<bool> { parse_data_field_bool(&self.data.raw_json, "append") }
    async fn paths(&self) -> Option<Vec<String>> {
        let raw = self.data.raw_json.as_ref()?;
        let parsed: serde_json::Value = serde_json::from_str(raw).ok()?;
        let paths = parsed.get("data")?.get("paths")?.as_array()?;
        Some(paths.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
    }
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
    async fn analyzed_message_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "message_id") }
    async fn message_id(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "message_id") }
    async fn sentiment_score(&self) -> Option<f64> { parse_data_field_f64(&self.data.raw_json, "sentiment_score") }
    async fn sentiment_level(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "sentiment_level") }
    async fn frustration_score(&self) -> Option<f64> { parse_data_field_f64(&self.data.raw_json, "frustration_score") }
    async fn frustration_level(&self) -> Option<String> { parse_data_field(&self.data.raw_json, "frustration_level") }
    async fn signals(&self) -> Option<Vec<String>> {
        let raw = self.data.raw_json.as_ref()?;
        let parsed: serde_json::Value = serde_json::from_str(raw).ok()?;
        let signals = parsed.get("data")?.get("signals")?.as_array()?;
        Some(signals.iter().filter_map(|v| v.as_str().map(|s| s.to_string())).collect())
    }
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
    /// The message type string.
    async fn message_type(&self) -> Option<&str> {
        Some(&self.data.message_type)
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

fn parse_json_field_i64(raw_json: &Option<String>, path: &[&str]) -> Option<i64> {
    let raw = raw_json.as_ref()?;
    let mut parsed: serde_json::Value = serde_json::from_str(raw).ok()?;
    for key in path {
        parsed = parsed.get(*key)?.clone();
    }
    parsed.as_i64()
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

    #[test]
    fn test_discriminate_regular_user() {
        let data = make_data("user", None);
        assert!(matches!(discriminate_message(data), Message::RegularUser(_)));
    }

    #[test]
    fn test_discriminate_assistant() {
        let data = make_data("assistant", None);
        assert!(matches!(discriminate_message(data), Message::Assistant(_)));
    }

    #[test]
    fn test_discriminate_system() {
        let data = make_data("system", None);
        assert!(matches!(discriminate_message(data), Message::System(_)));
    }

    #[test]
    fn test_discriminate_summary() {
        let data = make_data("summary", None);
        assert!(matches!(discriminate_message(data), Message::Summary(_)));
    }

    #[test]
    fn test_discriminate_han_event_hook_run() {
        let data = make_data("han_event", Some("hook_run"));
        assert!(matches!(discriminate_message(data), Message::HookRun(_)));
    }

    #[test]
    fn test_discriminate_han_event_mcp_tool_call() {
        let data = make_data("han_event", Some("mcp_tool_call"));
        assert!(matches!(discriminate_message(data), Message::McpToolCall(_)));
    }

    #[test]
    fn test_discriminate_unknown() {
        let data = make_data("some_future_type", None);
        assert!(matches!(discriminate_message(data), Message::UnknownEvent(_)));
    }

    #[test]
    fn test_search_text_with_content() {
        let data = make_data("user", None);
        let text = data.search_text().unwrap();
        assert!(text.contains("test content"));
    }

    #[test]
    fn test_global_id_format() {
        let data = make_data("user", None);
        assert_eq!(data.global_id().as_str(), "Message:test-uuid");
    }

    #[test]
    fn test_parse_data_field() {
        let raw = Some(r#"{"data":{"hook":"pre_tool_use","plugin":"biome"}}"#.into());
        assert_eq!(parse_data_field(&raw, "hook"), Some("pre_tool_use".into()));
    }

    #[test]
    fn test_build_message_connection_empty() {
        let conn = build_message_connection(&[], "/proj", None, None, None, None);
        assert_eq!(conn.total_count, 0);
        assert!(conn.edges.is_empty());
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
    // Include all messages with content (or summary/han_event types which may lack content)
    let filtered: Vec<_> = messages
        .iter()
        .enumerate()
        .filter(|(_, msg)| {
            msg.content.as_ref().map(|c| !c.is_empty()).unwrap_or(false)
                || msg.message_type == "summary"
                || msg.message_type == "han_event"
        })
        .collect();

    let total_count = filtered.len() as i32;

    let items: Vec<(MessageData, String)> = filtered
        .iter()
        .map(|(idx, msg)| {
            let data = MessageData::from_model(msg, project_dir);
            let cursor = encode_message_cursor(project_dir, &msg.session_id, (*idx as i32) + 1);
            (data, cursor)
        })
        .collect();

    let all_edges: Vec<MessageEdge> = items
        .into_iter()
        .map(|(data, cursor)| MessageEdge {
            node: discriminate_message(data),
            cursor,
        })
        .collect();

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
