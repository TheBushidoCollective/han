//! Hook execution GraphQL type.

use async_graphql::*;
use crate::node::encode_global_id;
use crate::connection::PageInfo;

/// Hook execution data.
#[derive(Debug, Clone)]
pub struct HookExecution {
    pub raw_id: String,
    pub orchestration_id: Option<String>,
    pub session_id: Option<String>,
    pub task_id: Option<String>,
    pub hook_type: String,
    pub hook_name: String,
    pub hook_source: Option<String>,
    pub directory: Option<String>,
    pub duration_ms: i32,
    pub exit_code: i32,
    pub passed: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub command: Option<String>,
    pub executed_at: String,
    pub status: Option<String>,
}

#[Object]
impl HookExecution {
    async fn id(&self) -> ID { encode_global_id("HookExecution", &self.raw_id) }
    async fn hook_type(&self) -> &str { &self.hook_type }
    async fn hook_name(&self) -> &str { &self.hook_name }
    async fn hook_source(&self) -> Option<&str> { self.hook_source.as_deref() }
    async fn directory(&self) -> Option<&str> { self.directory.as_deref() }
    async fn duration_ms(&self) -> i32 { self.duration_ms }
    async fn exit_code(&self) -> i32 { self.exit_code }
    async fn passed(&self) -> bool { self.passed }
    async fn output(&self) -> Option<&str> { self.output.as_deref() }
    async fn error(&self) -> Option<&str> { self.error.as_deref() }
    async fn command(&self) -> Option<&str> { self.command.as_deref() }
    async fn executed_at(&self) -> &str { &self.executed_at }
    async fn status(&self) -> Option<&str> { self.status.as_deref() }
}

impl From<han_db::entities::hook_executions::Model> for HookExecution {
    fn from(m: han_db::entities::hook_executions::Model) -> Self {
        Self {
            raw_id: m.id,
            orchestration_id: m.orchestration_id,
            session_id: m.session_id,
            task_id: m.task_id,
            hook_type: m.hook_type,
            hook_name: m.hook_name,
            hook_source: m.hook_source,
            directory: m.directory,
            duration_ms: m.duration_ms,
            exit_code: m.exit_code,
            passed: m.passed != 0,
            output: m.output,
            error: m.error,
            command: m.command,
            executed_at: m.executed_at,
            status: m.status,
        }
    }
}

/// Hook execution edge.
#[derive(Debug, Clone, SimpleObject)]
pub struct HookExecutionEdge {
    pub node: HookExecution,
    pub cursor: String,
}

/// Hook execution connection.
#[derive(Debug, Clone, SimpleObject)]
pub struct HookExecutionConnection {
    pub edges: Vec<HookExecutionEdge>,
    pub page_info: PageInfo,
    pub total_count: i32,
}

/// Hook statistics for a session.
#[derive(Debug, Clone, SimpleObject)]
pub struct HookStats {
    pub total_executions: i32,
    pub passed: i32,
    pub failed: i32,
    pub total_duration_ms: i64,
    pub average_duration_ms: f64,
}

#[cfg(test)]
mod tests {
    use super::*;
    use han_db::entities::hook_executions;

    fn make_model(passed: i32) -> hook_executions::Model {
        hook_executions::Model {
            id: "he-1".into(),
            orchestration_id: Some("orch-1".into()),
            session_id: Some("sess-1".into()),
            task_id: Some("task-1".into()),
            hook_type: "Stop".into(),
            hook_name: "biome".into(),
            hook_source: Some("validation/biome".into()),
            directory: Some("/project".into()),
            duration_ms: 1500,
            exit_code: 0,
            passed,
            output: Some("All checks passed".into()),
            error: None,
            if_changed: None,
            command: Some("npx biome check".into()),
            executed_at: "2025-01-01T12:00:00Z".into(),
            status: Some("completed".into()),
            consecutive_failures: None,
            max_attempts: None,
            pid: None,
            plugin_root: None,
        }
    }

    #[test]
    fn from_model_maps_all_fields() {
        let he = HookExecution::from(make_model(1));
        assert_eq!(he.raw_id, "he-1");
        assert_eq!(he.orchestration_id, Some("orch-1".into()));
        assert_eq!(he.session_id, Some("sess-1".into()));
        assert_eq!(he.task_id, Some("task-1".into()));
        assert_eq!(he.hook_type, "Stop");
        assert_eq!(he.hook_name, "biome");
        assert_eq!(he.hook_source, Some("validation/biome".into()));
        assert_eq!(he.directory, Some("/project".into()));
        assert_eq!(he.duration_ms, 1500);
        assert_eq!(he.exit_code, 0);
        assert!(he.passed);
        assert_eq!(he.output, Some("All checks passed".into()));
        assert!(he.error.is_none());
        assert_eq!(he.command, Some("npx biome check".into()));
        assert_eq!(he.executed_at, "2025-01-01T12:00:00Z");
        assert_eq!(he.status, Some("completed".into()));
    }

    #[test]
    fn passed_true_when_nonzero() {
        assert!(HookExecution::from(make_model(1)).passed);
        assert!(HookExecution::from(make_model(42)).passed);
    }

    #[test]
    fn passed_false_when_zero() {
        assert!(!HookExecution::from(make_model(0)).passed);
    }

    #[test]
    fn optional_fields_none() {
        let m = hook_executions::Model {
            id: "h".into(),
            orchestration_id: None,
            session_id: None,
            task_id: None,
            hook_type: "Stop".into(),
            hook_name: "test".into(),
            hook_source: None,
            directory: None,
            duration_ms: 0,
            exit_code: 1,
            passed: 0,
            output: None,
            error: None,
            if_changed: None,
            command: None,
            executed_at: "".into(),
            status: None,
            consecutive_failures: None,
            max_attempts: None,
            pid: None,
            plugin_root: None,
        };
        let he = HookExecution::from(m);
        assert!(he.orchestration_id.is_none());
        assert!(he.session_id.is_none());
        assert!(he.task_id.is_none());
        assert!(he.hook_source.is_none());
        assert!(he.directory.is_none());
        assert!(he.output.is_none());
        assert!(he.error.is_none());
        assert!(he.command.is_none());
        assert!(he.status.is_none());
    }

    #[test]
    fn hook_stats_construction() {
        let stats = HookStats {
            total_executions: 10,
            passed: 8,
            failed: 2,
            total_duration_ms: 5000,
            average_duration_ms: 500.0,
        };
        assert_eq!(stats.total_executions, 10);
        assert_eq!(stats.passed, 8);
        assert_eq!(stats.failed, 2);
        assert_eq!(stats.total_duration_ms, 5000);
        assert!((stats.average_duration_ms - 500.0).abs() < f64::EPSILON);
    }
}
