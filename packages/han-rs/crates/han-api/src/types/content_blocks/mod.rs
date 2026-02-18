//! Content block types for message content.
//!
//! Content blocks represent the different types of content within an assistant
//! message: text, thinking, tool_use, tool_result, and image.
//!
//! ContentBlock is a GraphQL **interface** (not union) because the browse-client
//! queries `type` as a shared field before using inline fragments on concrete types.

use async_graphql::*;

use super::enums::{ContentBlockType, ToolCategory};

/// Content block interface - shared `type` field across all block types.
#[derive(Debug, Clone, Interface)]
#[graphql(
    field(name = "type", ty = "ContentBlockType", method = "block_type"),
)]
pub enum ContentBlock {
    Text(TextBlock),
    Thinking(ThinkingBlock),
    ToolUse(ToolUseBlock),
    ToolResult(ToolResultBlock),
    Image(ImageBlock),
}

/// A text content block.
#[derive(Debug, Clone)]
pub struct TextBlock {
    pub block_type: ContentBlockType,
    pub text: String,
}

#[Object]
impl TextBlock {
    #[graphql(name = "type")]
    async fn block_type(&self) -> ContentBlockType { self.block_type }
    async fn text(&self) -> &str { &self.text }
}

/// A thinking/reasoning block.
#[derive(Debug, Clone)]
pub struct ThinkingBlock {
    pub block_type: ContentBlockType,
    pub thinking: String,
    pub preview: String,
    pub signature: Option<String>,
}

#[Object]
impl ThinkingBlock {
    #[graphql(name = "type")]
    async fn block_type(&self) -> ContentBlockType { self.block_type }
    async fn thinking(&self) -> &str { &self.thinking }
    async fn preview(&self) -> &str { &self.preview }
    async fn signature(&self) -> Option<&str> { self.signature.as_deref() }
}

/// A tool use block (Claude calling a tool).
#[derive(Debug, Clone)]
pub struct ToolUseBlock {
    pub block_type: ContentBlockType,
    pub tool_call_id: String,
    pub name: String,
    pub input: String,
    pub category: ToolCategory,
    pub icon: String,
    pub display_name: String,
    pub color: String,
    pub session_id: Option<String>,
    pub agent_task_id: Option<String>,
}

#[Object]
impl ToolUseBlock {
    #[graphql(name = "type")]
    async fn block_type(&self) -> ContentBlockType { self.block_type }
    async fn tool_call_id(&self) -> &str { &self.tool_call_id }
    async fn name(&self) -> &str { &self.name }
    async fn input(&self) -> &str { &self.input }
    async fn category(&self) -> ToolCategory { self.category }
    async fn icon(&self) -> &str { &self.icon }
    async fn display_name(&self) -> &str { &self.display_name }
    async fn color(&self) -> &str { &self.color }
    async fn session_id(&self) -> Option<&str> { self.session_id.as_deref() }
    async fn agent_task_id(&self) -> Option<&str> { self.agent_task_id.as_deref() }

    /// Tool result resolved inline (stub - will be populated via DataLoader).
    async fn result(&self) -> Option<ToolResultBlock> { None }

    /// Agent task reference (stub for backwards compatibility).
    async fn agent_task(&self) -> Option<AgentTask> { None }
}

/// A tool result block (result from a tool call).
#[derive(Debug, Clone)]
pub struct ToolResultBlock {
    pub block_type: ContentBlockType,
    pub tool_call_id: String,
    pub content: String,
    pub is_error: bool,
    pub is_long: bool,
    pub preview: String,
    pub has_image: bool,
}

#[Object]
impl ToolResultBlock {
    #[graphql(name = "type")]
    async fn block_type(&self) -> ContentBlockType { self.block_type }
    async fn tool_call_id(&self) -> &str { &self.tool_call_id }
    async fn content(&self) -> &str { &self.content }
    async fn is_error(&self) -> bool { self.is_error }
    async fn is_long(&self) -> bool { self.is_long }
    async fn preview(&self) -> &str { &self.preview }
    async fn has_image(&self) -> bool { self.has_image }
}

/// An image content block.
#[derive(Debug, Clone)]
pub struct ImageBlock {
    pub block_type: ContentBlockType,
    pub media_type: String,
    pub data_url: String,
}

#[Object]
impl ImageBlock {
    #[graphql(name = "type")]
    async fn block_type(&self) -> ContentBlockType { self.block_type }
    async fn media_type(&self) -> &str { &self.media_type }
    async fn data_url(&self) -> &str { &self.data_url }
}

/// Agent task stub for ToolUseBlock.agentTask field.
#[derive(Debug, Clone, SimpleObject)]
pub struct AgentTask {
    pub id: Option<String>,
}

/// Get tool metadata (category, icon, display name, color) from tool name.
pub fn get_tool_metadata(tool_name: &str) -> (ToolCategory, &'static str, String, &'static str) {
    match tool_name {
        "Read" => (ToolCategory::File, "file-text", "Read File".to_string(), "#3b82f6"),
        "Write" => (ToolCategory::File, "file-plus", "Write File".to_string(), "#22c55e"),
        "Edit" => (ToolCategory::File, "file-edit", "Edit File".to_string(), "#eab308"),
        "Glob" => (ToolCategory::Search, "search", "Find Files".to_string(), "#8b5cf6"),
        "Grep" => (ToolCategory::Search, "search-code", "Search Code".to_string(), "#8b5cf6"),
        "Bash" => (ToolCategory::Shell, "terminal", "Run Command".to_string(), "#f97316"),
        "Task" => (ToolCategory::Task, "git-branch", "Spawn Agent".to_string(), "#06b6d4"),
        "TodoWrite" | "TaskCreate" | "TaskUpdate" | "TaskList" | "TaskGet" => {
            (ToolCategory::Task, "check-square", tool_name.to_string(), "#06b6d4")
        }
        "WebFetch" => (ToolCategory::Web, "globe", "Fetch URL".to_string(), "#ec4899"),
        "WebSearch" => (ToolCategory::Search, "search", "Web Search".to_string(), "#ec4899"),
        "NotebookEdit" => (ToolCategory::File, "book-open", "Edit Notebook".to_string(), "#eab308"),
        name if name.starts_with("mcp__") => {
            (ToolCategory::Mcp, "plug", name.to_string(), "#a855f7")
        }
        _ => (ToolCategory::Other, "tool", tool_name.to_string(), "#6b7280"),
    }
}

/// Parse raw content blocks from message content into typed ContentBlock.
pub fn parse_content_blocks(
    content: Option<&str>,
    raw_json: Option<&str>,
    session_id: Option<&str>,
) -> Vec<ContentBlock> {
    // Try to parse content blocks from raw JSON first (most reliable)
    if let Some(raw) = raw_json {
        if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(raw) {
            if let Some(blocks) = parsed
                .get("message")
                .and_then(|m| m.get("content"))
                .and_then(|c| c.as_array())
            {
                return blocks
                    .iter()
                    .filter_map(|block| parse_single_block(block, session_id))
                    .collect();
            }
            // Direct content array
            if let Some(blocks) = parsed.get("content").and_then(|c| c.as_array()) {
                return blocks
                    .iter()
                    .filter_map(|block| parse_single_block(block, session_id))
                    .collect();
            }
        }
    }

    // Fallback: treat content as a single text block
    if let Some(text) = content {
        if !text.is_empty() {
            return vec![ContentBlock::Text(TextBlock {
                block_type: ContentBlockType::Text,
                text: text.to_string(),
            })];
        }
    }

    vec![]
}

fn parse_single_block(
    block: &serde_json::Value,
    session_id: Option<&str>,
) -> Option<ContentBlock> {
    let block_type = block.get("type")?.as_str()?;

    match block_type {
        "thinking" => {
            let thinking = block.get("thinking")?.as_str()?.to_string();
            let preview = if thinking.len() > 200 {
                format!("{}...", &thinking[..200])
            } else {
                thinking.clone()
            };
            Some(ContentBlock::Thinking(ThinkingBlock {
                block_type: ContentBlockType::Thinking,
                thinking,
                preview,
                signature: block.get("signature").and_then(|s| s.as_str()).map(|s| s.to_string()),
            }))
        }
        "text" => {
            let text = block.get("text")?.as_str()?.to_string();
            Some(ContentBlock::Text(TextBlock {
                block_type: ContentBlockType::Text,
                text,
            }))
        }
        "tool_use" => {
            let name = block.get("name")?.as_str()?.to_string();
            let tool_call_id = block.get("id")?.as_str()?.to_string();
            let input = block
                .get("input")
                .map(|i| serde_json::to_string_pretty(i).unwrap_or_default())
                .unwrap_or_default();
            let (category, icon, display_name, color) = get_tool_metadata(&name);
            Some(ContentBlock::ToolUse(ToolUseBlock {
                block_type: ContentBlockType::ToolUse,
                tool_call_id,
                name,
                input,
                category,
                icon: icon.to_string(),
                display_name,
                color: color.to_string(),
                session_id: session_id.map(|s| s.to_string()),
                agent_task_id: None,
            }))
        }
        "tool_result" => {
            let tool_call_id = block.get("tool_use_id")?.as_str()?.to_string();
            let content_str = extract_tool_result_content(block);
            let has_image = block
                .get("content")
                .and_then(|c| c.as_array())
                .map(|arr| arr.iter().any(|c| c.get("type").and_then(|t| t.as_str()) == Some("image")))
                .unwrap_or(false);
            let is_long = content_str.len() > 500;
            let preview = if is_long {
                format!("{}...", &content_str[..500])
            } else {
                content_str.clone()
            };
            Some(ContentBlock::ToolResult(ToolResultBlock {
                block_type: ContentBlockType::ToolResult,
                tool_call_id,
                content: content_str,
                is_error: block.get("is_error").and_then(|e| e.as_bool()).unwrap_or(false),
                is_long,
                preview,
                has_image,
            }))
        }
        "image" => {
            let source = block.get("source")?;
            let media_type = source.get("media_type")?.as_str()?.to_string();
            let data = source.get("data")?.as_str()?.to_string();
            Some(ContentBlock::Image(ImageBlock {
                block_type: ContentBlockType::Image,
                media_type: media_type.clone(),
                data_url: format!("data:{media_type};base64,{data}"),
            }))
        }
        _ => None,
    }
}

fn extract_tool_result_content(block: &serde_json::Value) -> String {
    if let Some(content) = block.get("content") {
        if let Some(s) = content.as_str() {
            return s.to_string();
        }
        if let Some(arr) = content.as_array() {
            return arr
                .iter()
                .filter_map(|c| {
                    if c.get("type")?.as_str()? == "text" {
                        c.get("text").and_then(|t| t.as_str()).map(|s| s.to_string())
                    } else {
                        None
                    }
                })
                .collect::<Vec<_>>()
                .join("\n");
        }
    }
    String::new()
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_parse_text_block() {
        let raw = r#"{"message":{"content":[{"type":"text","text":"Hello world"}]}}"#;
        let blocks = parse_content_blocks(None, Some(raw), None);
        assert_eq!(blocks.len(), 1);
        match &blocks[0] {
            ContentBlock::Text(b) => assert_eq!(b.text, "Hello world"),
            _ => panic!("Expected TextBlock"),
        }
    }

    #[test]
    fn test_parse_thinking_block() {
        let raw = r#"{"message":{"content":[{"type":"thinking","thinking":"Let me think...","signature":"sig123"}]}}"#;
        let blocks = parse_content_blocks(None, Some(raw), None);
        assert_eq!(blocks.len(), 1);
        match &blocks[0] {
            ContentBlock::Thinking(b) => {
                assert_eq!(b.thinking, "Let me think...");
                assert_eq!(b.signature.as_deref(), Some("sig123"));
            }
            _ => panic!("Expected ThinkingBlock"),
        }
    }

    #[test]
    fn test_parse_tool_use_block() {
        let raw = r#"{"message":{"content":[{"type":"tool_use","id":"call_123","name":"Read","input":{"file_path":"/test.rs"}}]}}"#;
        let blocks = parse_content_blocks(None, Some(raw), Some("session-1"));
        assert_eq!(blocks.len(), 1);
        match &blocks[0] {
            ContentBlock::ToolUse(b) => {
                assert_eq!(b.tool_call_id, "call_123");
                assert_eq!(b.name, "Read");
                assert_eq!(b.display_name, "Read File");
                assert_eq!(b.session_id.as_deref(), Some("session-1"));
            }
            _ => panic!("Expected ToolUseBlock"),
        }
    }

    #[test]
    fn test_parse_tool_result_block() {
        let raw = r#"{"message":{"content":[{"type":"tool_result","tool_use_id":"call_123","content":"file contents here"}]}}"#;
        let blocks = parse_content_blocks(None, Some(raw), None);
        assert_eq!(blocks.len(), 1);
        match &blocks[0] {
            ContentBlock::ToolResult(b) => {
                assert_eq!(b.tool_call_id, "call_123");
                assert_eq!(b.content, "file contents here");
                assert!(!b.is_error);
                assert!(!b.is_long);
            }
            _ => panic!("Expected ToolResultBlock"),
        }
    }

    #[test]
    fn test_parse_image_block() {
        let raw = r#"{"message":{"content":[{"type":"image","source":{"media_type":"image/png","data":"iVBOR..."}}]}}"#;
        let blocks = parse_content_blocks(None, Some(raw), None);
        assert_eq!(blocks.len(), 1);
        match &blocks[0] {
            ContentBlock::Image(b) => {
                assert_eq!(b.media_type, "image/png");
                assert!(b.data_url.starts_with("data:image/png;base64,"));
            }
            _ => panic!("Expected ImageBlock"),
        }
    }

    #[test]
    fn test_parse_multiple_blocks() {
        let raw = r#"{"message":{"content":[
            {"type":"thinking","thinking":"hmm"},
            {"type":"text","text":"Here's the answer"},
            {"type":"tool_use","id":"c1","name":"Bash","input":{"command":"ls"}}
        ]}}"#;
        let blocks = parse_content_blocks(None, Some(raw), None);
        assert_eq!(blocks.len(), 3);
        assert!(matches!(&blocks[0], ContentBlock::Thinking(_)));
        assert!(matches!(&blocks[1], ContentBlock::Text(_)));
        assert!(matches!(&blocks[2], ContentBlock::ToolUse(_)));
    }

    #[test]
    fn test_fallback_to_content_text() {
        let blocks = parse_content_blocks(Some("plain text content"), None, None);
        assert_eq!(blocks.len(), 1);
        match &blocks[0] {
            ContentBlock::Text(b) => assert_eq!(b.text, "plain text content"),
            _ => panic!("Expected TextBlock"),
        }
    }

    #[test]
    fn test_empty_content() {
        let blocks = parse_content_blocks(None, None, None);
        assert!(blocks.is_empty());
    }

    #[test]
    fn test_empty_string_content() {
        let blocks = parse_content_blocks(Some(""), None, None);
        assert!(blocks.is_empty());
    }

    #[test]
    fn test_tool_result_long_content() {
        let long_content = "x".repeat(600);
        let raw = format!(r#"{{"message":{{"content":[{{"type":"tool_result","tool_use_id":"c1","content":"{long_content}"}}]}}}}"#);
        let blocks = parse_content_blocks(None, Some(&raw), None);
        match &blocks[0] {
            ContentBlock::ToolResult(b) => {
                assert!(b.is_long);
                assert!(b.preview.len() < b.content.len());
                assert!(b.preview.ends_with("..."));
            }
            _ => panic!("Expected ToolResultBlock"),
        }
    }

    #[test]
    fn test_tool_result_with_error() {
        let raw = r#"{"message":{"content":[{"type":"tool_result","tool_use_id":"c1","content":"error msg","is_error":true}]}}"#;
        let blocks = parse_content_blocks(None, Some(raw), None);
        match &blocks[0] {
            ContentBlock::ToolResult(b) => assert!(b.is_error),
            _ => panic!("Expected ToolResultBlock"),
        }
    }

    #[test]
    fn test_get_tool_metadata_known_tools() {
        let (cat, icon, name, _) = get_tool_metadata("Read");
        assert!(matches!(cat, ToolCategory::File));
        assert_eq!(icon, "file-text");
        assert_eq!(name, "Read File");

        let (cat, _, _, _) = get_tool_metadata("Bash");
        assert!(matches!(cat, ToolCategory::Shell));

        let (cat, _, _, _) = get_tool_metadata("Grep");
        assert!(matches!(cat, ToolCategory::Search));

        let (cat, _, _, _) = get_tool_metadata("Task");
        assert!(matches!(cat, ToolCategory::Task));

        let (cat, _, _, _) = get_tool_metadata("WebFetch");
        assert!(matches!(cat, ToolCategory::Web));
    }

    #[test]
    fn test_get_tool_metadata_mcp_prefix() {
        let (cat, icon, _, _) = get_tool_metadata("mcp__github__search");
        assert!(matches!(cat, ToolCategory::Mcp));
        assert_eq!(icon, "plug");
    }

    #[test]
    fn test_get_tool_metadata_unknown() {
        let (cat, icon, _, _) = get_tool_metadata("SomeNewTool");
        assert!(matches!(cat, ToolCategory::Other));
        assert_eq!(icon, "tool");
    }

    #[test]
    fn test_thinking_block_preview_truncation() {
        let long_thinking = "a".repeat(300);
        let raw = format!(r#"{{"message":{{"content":[{{"type":"thinking","thinking":"{long_thinking}"}}]}}}}"#);
        let blocks = parse_content_blocks(None, Some(&raw), None);
        match &blocks[0] {
            ContentBlock::Thinking(b) => {
                assert_eq!(b.thinking.len(), 300);
                assert!(b.preview.len() < 300);
                assert!(b.preview.ends_with("..."));
            }
            _ => panic!("Expected ThinkingBlock"),
        }
    }

    #[test]
    fn test_direct_content_array_format() {
        let raw = r#"{"content":[{"type":"text","text":"direct format"}]}"#;
        let blocks = parse_content_blocks(None, Some(raw), None);
        assert_eq!(blocks.len(), 1);
        match &blocks[0] {
            ContentBlock::Text(b) => assert_eq!(b.text, "direct format"),
            _ => panic!("Expected TextBlock"),
        }
    }
}
