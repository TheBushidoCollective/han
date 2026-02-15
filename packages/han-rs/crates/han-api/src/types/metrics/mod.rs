//! Metrics GraphQL types.

use async_graphql::*;
use crate::connection::PageInfo;
use crate::node::encode_global_id;


/// Metrics task data.
#[derive(Debug, Clone)]
pub struct Task {
    pub raw_id: String,
    pub task_id: String,
    pub session_id: Option<String>,
    pub description: String,
    pub task_type: String,
    pub outcome: Option<String>,
    pub confidence: Option<f64>,
    pub notes: Option<String>,
    pub files_modified: Option<String>,
    pub tests_added: Option<i32>,
    pub started_at: String,
    pub completed_at: Option<String>,
}

#[Object]
impl Task {
    async fn id(&self) -> ID { encode_global_id("Task", &self.task_id) }
    async fn task_id(&self) -> &str { &self.task_id }
    async fn description(&self) -> &str { &self.description }
    async fn task_type(&self) -> &str { &self.task_type }
    async fn outcome(&self) -> Option<&str> { self.outcome.as_deref() }
    async fn confidence(&self) -> Option<f64> { self.confidence }
    async fn notes(&self) -> Option<&str> { self.notes.as_deref() }
    async fn files_modified(&self) -> Option<Vec<String>> {
        self.files_modified.as_ref().and_then(|f| serde_json::from_str(f).ok())
    }
    async fn tests_added(&self) -> Option<i32> { self.tests_added }
    async fn started_at(&self) -> &str { &self.started_at }
    async fn completed_at(&self) -> Option<&str> { self.completed_at.as_deref() }
}

impl From<han_db::entities::tasks::Model> for Task {
    fn from(m: han_db::entities::tasks::Model) -> Self {
        Self {
            raw_id: m.id,
            task_id: m.task_id,
            session_id: m.session_id,
            description: m.description,
            task_type: m.task_type,
            outcome: m.outcome,
            confidence: m.confidence,
            notes: m.notes,
            files_modified: m.files_modified,
            tests_added: m.tests_added,
            started_at: m.started_at,
            completed_at: m.completed_at,
        }
    }
}

/// Task edge.
#[derive(Debug, Clone, SimpleObject)]
pub struct TaskEdge {
    pub node: Task,
    pub cursor: String,
}

/// Task connection.
#[derive(Debug, Clone, SimpleObject)]
pub struct TaskConnection {
    pub edges: Vec<TaskEdge>,
    pub page_info: PageInfo,
    pub total_count: i32,
}

/// Metrics data for a time period.
#[derive(Debug, Clone, SimpleObject)]
pub struct MetricsData {
    pub total_tasks: i32,
    pub completed_tasks: i32,
    pub active_tasks: i32,
    pub task_type_counts: Vec<TaskTypeCount>,
    pub task_outcome_counts: Vec<TaskOutcomeCount>,
}

/// Count of tasks by type.
#[derive(Debug, Clone, SimpleObject)]
pub struct TaskTypeCount {
    pub task_type: String,
    pub count: i32,
}

/// Count of tasks by outcome.
#[derive(Debug, Clone, SimpleObject)]
pub struct TaskOutcomeCount {
    pub outcome: String,
    pub count: i32,
}
