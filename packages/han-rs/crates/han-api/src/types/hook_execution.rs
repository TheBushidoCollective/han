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
