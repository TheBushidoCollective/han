//! GraphQL enum type definitions.

use async_graphql::*;

/// Content block type discriminator.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum ContentBlockType {
    #[graphql(name = "TEXT")]
    Text,
    #[graphql(name = "THINKING")]
    Thinking,
    #[graphql(name = "TOOL_USE")]
    ToolUse,
    #[graphql(name = "TOOL_RESULT")]
    ToolResult,
    #[graphql(name = "IMAGE")]
    Image,
}

/// Tool category for UI grouping.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum ToolCategory {
    #[graphql(name = "FILE_OPERATION")]
    FileOperation,
    #[graphql(name = "CODE_EXECUTION")]
    CodeExecution,
    #[graphql(name = "SEARCH")]
    Search,
    #[graphql(name = "NAVIGATION")]
    Navigation,
    #[graphql(name = "COMMUNICATION")]
    Communication,
    #[graphql(name = "TASK_MANAGEMENT")]
    TaskManagement,
    #[graphql(name = "MCP")]
    Mcp,
    #[graphql(name = "OTHER")]
    Other,
}

/// Memory event action type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum EventAction {
    #[graphql(name = "created")]
    Created,
    #[graphql(name = "updated")]
    Updated,
    #[graphql(name = "deleted")]
    Deleted,
}

/// Memory event type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum MemoryEventType {
    #[graphql(name = "session")]
    Session,
    #[graphql(name = "settings")]
    Settings,
    #[graphql(name = "project")]
    Project,
    #[graphql(name = "rules")]
    Rules,
}

/// Plugin installation scope.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum PluginScope {
    #[graphql(name = "user")]
    User,
    #[graphql(name = "project")]
    Project,
    #[graphql(name = "local")]
    Local,
}

/// Todo item status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum TodoStatus {
    #[graphql(name = "pending")]
    Pending,
    #[graphql(name = "in_progress")]
    InProgress,
    #[graphql(name = "completed")]
    Completed,
}

/// Metrics period for filtering.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum MetricsPeriod {
    #[graphql(name = "today")]
    Today,
    #[graphql(name = "week")]
    Week,
    #[graphql(name = "month")]
    Month,
    #[graphql(name = "all")]
    All,
}

/// Task status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum TaskStatus {
    #[graphql(name = "active")]
    Active,
    #[graphql(name = "completed")]
    Completed,
    #[graphql(name = "abandoned")]
    Abandoned,
}

/// Task type classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum TaskType {
    #[graphql(name = "feature")]
    Feature,
    #[graphql(name = "bugfix")]
    Bugfix,
    #[graphql(name = "refactor")]
    Refactor,
    #[graphql(name = "test")]
    Test,
    #[graphql(name = "docs")]
    Docs,
    #[graphql(name = "config")]
    Config,
    #[graphql(name = "research")]
    Research,
    #[graphql(name = "other")]
    Other,
}

/// Task outcome.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum TaskOutcome {
    #[graphql(name = "success")]
    Success,
    #[graphql(name = "partial")]
    Partial,
    #[graphql(name = "abandoned")]
    Abandoned,
    #[graphql(name = "unknown")]
    Unknown,
}

/// Memory layer.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum MemoryLayer {
    #[graphql(name = "session")]
    Session,
    #[graphql(name = "project")]
    Project,
    #[graphql(name = "global")]
    Global,
}

/// Memory source for search results.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum MemorySource {
    #[graphql(name = "fts")]
    Fts,
    #[graphql(name = "vector")]
    Vector,
    #[graphql(name = "hybrid")]
    Hybrid,
}

/// Confidence level.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum Confidence {
    #[graphql(name = "high")]
    High,
    #[graphql(name = "medium")]
    Medium,
    #[graphql(name = "low")]
    Low,
}

/// Memory agent progress type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum MemoryAgentProgressType {
    #[graphql(name = "searching")]
    Searching,
    #[graphql(name = "found")]
    Found,
    #[graphql(name = "synthesizing")]
    Synthesizing,
    #[graphql(name = "complete")]
    Complete,
    #[graphql(name = "error")]
    Error,
}

/// File change action type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum FileChangeAction {
    #[graphql(name = "created")]
    Created,
    #[graphql(name = "modified")]
    Modified,
    #[graphql(name = "deleted")]
    Deleted,
}

/// Time granularity for team metrics.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum Granularity {
    #[graphql(name = "day")]
    Day,
    #[graphql(name = "week")]
    Week,
    #[graphql(name = "month")]
    Month,
}
