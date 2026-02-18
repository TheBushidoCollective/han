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
    #[graphql(name = "FILE")]
    File,
    #[graphql(name = "SEARCH")]
    Search,
    #[graphql(name = "SHELL")]
    Shell,
    #[graphql(name = "TASK")]
    Task,
    #[graphql(name = "WEB")]
    Web,
    #[graphql(name = "MCP")]
    Mcp,
    #[graphql(name = "OTHER")]
    Other,
}

/// Memory event action type.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum EventAction {
    #[graphql(name = "CREATED")]
    Created,
    #[graphql(name = "UPDATED")]
    Updated,
    #[graphql(name = "DELETED")]
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
    #[graphql(name = "USER")]
    User,
    #[graphql(name = "PROJECT")]
    Project,
    #[graphql(name = "LOCAL")]
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
    #[graphql(name = "DAY")]
    Day,
    #[graphql(name = "WEEK")]
    Week,
    #[graphql(name = "MONTH")]
    Month,
}

/// Task status.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum TaskStatus {
    #[graphql(name = "ACTIVE")]
    Active,
    #[graphql(name = "COMPLETED")]
    Completed,
    #[graphql(name = "FAILED")]
    Failed,
}

/// Task type classification.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum TaskType {
    #[graphql(name = "FIX")]
    Fix,
    #[graphql(name = "IMPLEMENTATION")]
    Implementation,
    #[graphql(name = "REFACTOR")]
    Refactor,
    #[graphql(name = "RESEARCH")]
    Research,
}

/// Task outcome.
#[derive(Debug, Clone, Copy, PartialEq, Eq, Enum)]
pub enum TaskOutcome {
    #[graphql(name = "SUCCESS")]
    Success,
    #[graphql(name = "PARTIAL")]
    Partial,
    #[graphql(name = "FAILURE")]
    Failure,
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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn content_block_type_equality() {
        assert_eq!(ContentBlockType::Text, ContentBlockType::Text);
        assert_ne!(ContentBlockType::Text, ContentBlockType::Thinking);
    }

    #[test]
    fn content_block_type_clone() {
        let t = ContentBlockType::ToolUse;
        let t2 = t;
        assert_eq!(t, t2);
    }

    #[test]
    fn content_block_type_debug() {
        assert_eq!(format!("{:?}", ContentBlockType::Image), "Image");
    }

    #[test]
    fn tool_category_variants() {
        let cats = [
            ToolCategory::File,
            ToolCategory::Search,
            ToolCategory::Shell,
            ToolCategory::Task,
            ToolCategory::Web,
            ToolCategory::Mcp,
            ToolCategory::Other,
        ];
        // All unique
        for (i, a) in cats.iter().enumerate() {
            for (j, b) in cats.iter().enumerate() {
                if i == j {
                    assert_eq!(a, b);
                } else {
                    assert_ne!(a, b);
                }
            }
        }
    }

    #[test]
    fn event_action_variants() {
        assert_ne!(EventAction::Created, EventAction::Updated);
        assert_ne!(EventAction::Updated, EventAction::Deleted);
        assert_ne!(EventAction::Created, EventAction::Deleted);
    }

    #[test]
    fn memory_event_type_variants() {
        assert_eq!(MemoryEventType::Session, MemoryEventType::Session);
        assert_ne!(MemoryEventType::Session, MemoryEventType::Settings);
    }

    #[test]
    fn plugin_scope_variants() {
        assert_ne!(PluginScope::User, PluginScope::Project);
        assert_ne!(PluginScope::Project, PluginScope::Local);
    }

    #[test]
    fn todo_status_variants() {
        assert_ne!(TodoStatus::Pending, TodoStatus::InProgress);
        assert_ne!(TodoStatus::InProgress, TodoStatus::Completed);
    }

    #[test]
    fn task_status_variants() {
        assert_eq!(TaskStatus::Active, TaskStatus::Active);
        assert_ne!(TaskStatus::Active, TaskStatus::Completed);
        assert_ne!(TaskStatus::Completed, TaskStatus::Failed);
    }

    #[test]
    fn task_type_all_variants_distinct() {
        let types = [
            TaskType::Fix, TaskType::Implementation, TaskType::Refactor,
            TaskType::Research,
        ];
        for (i, a) in types.iter().enumerate() {
            for (j, b) in types.iter().enumerate() {
                if i != j { assert_ne!(a, b); }
            }
        }
    }

    #[test]
    fn task_outcome_variants() {
        assert_ne!(TaskOutcome::Success, TaskOutcome::Partial);
        assert_ne!(TaskOutcome::Partial, TaskOutcome::Failure);
    }

    #[test]
    fn memory_layer_variants() {
        assert_ne!(MemoryLayer::Session, MemoryLayer::Project);
        assert_ne!(MemoryLayer::Project, MemoryLayer::Global);
    }

    #[test]
    fn memory_source_variants() {
        assert_ne!(MemorySource::Fts, MemorySource::Vector);
        assert_ne!(MemorySource::Vector, MemorySource::Hybrid);
    }

    #[test]
    fn confidence_variants() {
        assert_ne!(Confidence::High, Confidence::Medium);
        assert_ne!(Confidence::Medium, Confidence::Low);
    }

    #[test]
    fn memory_agent_progress_type_variants() {
        let types = [
            MemoryAgentProgressType::Searching,
            MemoryAgentProgressType::Found,
            MemoryAgentProgressType::Synthesizing,
            MemoryAgentProgressType::Complete,
            MemoryAgentProgressType::Error,
        ];
        for (i, a) in types.iter().enumerate() {
            for (j, b) in types.iter().enumerate() {
                if i != j { assert_ne!(a, b); }
            }
        }
    }

    #[test]
    fn file_change_action_variants() {
        assert_ne!(FileChangeAction::Created, FileChangeAction::Modified);
        assert_ne!(FileChangeAction::Modified, FileChangeAction::Deleted);
    }

    #[test]
    fn granularity_variants() {
        assert_ne!(Granularity::Day, Granularity::Week);
        assert_ne!(Granularity::Week, Granularity::Month);
    }

    #[test]
    fn metrics_period_variants() {
        assert_ne!(MetricsPeriod::Day, MetricsPeriod::Week);
        assert_ne!(MetricsPeriod::Week, MetricsPeriod::Month);
    }
}
