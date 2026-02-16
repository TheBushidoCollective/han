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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::node::encode_global_id;

    fn make_task_model() -> han_db::entities::tasks::Model {
        han_db::entities::tasks::Model {
            id: "row-1".into(),
            task_id: "task-abc".into(),
            session_id: Some("sess-1".into()),
            description: "Fix authentication bug".into(),
            task_type: "bugfix".into(),
            outcome: Some("success".into()),
            confidence: Some(0.95),
            notes: Some("Resolved quickly".into()),
            files_modified: Some(r#"["src/auth.rs","src/main.rs"]"#.into()),
            tests_added: Some(3),
            started_at: "2024-01-01T00:00:00Z".into(),
            completed_at: Some("2024-01-01T01:00:00Z".into()),
        }
    }

    #[test]
    fn task_from_model_maps_all_fields() {
        let m = make_task_model();
        let t = Task::from(m);
        assert_eq!(t.raw_id, "row-1");
        assert_eq!(t.task_id, "task-abc");
        assert_eq!(t.session_id, Some("sess-1".into()));
        assert_eq!(t.description, "Fix authentication bug");
        assert_eq!(t.task_type, "bugfix");
        assert_eq!(t.outcome, Some("success".into()));
        assert!((t.confidence.unwrap() - 0.95).abs() < f64::EPSILON);
        assert_eq!(t.notes, Some("Resolved quickly".into()));
        assert_eq!(t.files_modified, Some(r#"["src/auth.rs","src/main.rs"]"#.into()));
        assert_eq!(t.tests_added, Some(3));
        assert_eq!(t.started_at, "2024-01-01T00:00:00Z");
        assert_eq!(t.completed_at, Some("2024-01-01T01:00:00Z".into()));
    }

    #[test]
    fn task_from_model_optional_fields_none() {
        let m = han_db::entities::tasks::Model {
            id: "row-2".into(),
            task_id: "task-def".into(),
            session_id: None,
            description: "Minimal task".into(),
            task_type: "feature".into(),
            outcome: None,
            confidence: None,
            notes: None,
            files_modified: None,
            tests_added: None,
            started_at: "2024-02-01T00:00:00Z".into(),
            completed_at: None,
        };
        let t = Task::from(m);
        assert!(t.session_id.is_none());
        assert!(t.outcome.is_none());
        assert!(t.confidence.is_none());
        assert!(t.notes.is_none());
        assert!(t.files_modified.is_none());
        assert!(t.tests_added.is_none());
        assert!(t.completed_at.is_none());
    }

    #[test]
    fn task_global_id_format() {
        let id = encode_global_id("Task", "task-abc");
        assert_eq!(id.as_str(), "Task:task-abc");
    }

    #[test]
    fn task_files_modified_valid_json_parsing() {
        let t = Task::from(make_task_model());
        // Test the JSON parsing logic that files_modified resolver uses
        let files: Option<Vec<String>> = t
            .files_modified
            .as_ref()
            .and_then(|f| serde_json::from_str(f).ok());
        assert!(files.is_some());
        let files = files.unwrap();
        assert_eq!(files.len(), 2);
        assert_eq!(files[0], "src/auth.rs");
        assert_eq!(files[1], "src/main.rs");
    }

    #[test]
    fn task_files_modified_invalid_json_returns_none() {
        let t = Task {
            raw_id: "r".into(),
            task_id: "t".into(),
            session_id: None,
            description: "d".into(),
            task_type: "feature".into(),
            outcome: None,
            confidence: None,
            notes: None,
            files_modified: Some("not valid json".into()),
            tests_added: None,
            started_at: "2024-01-01".into(),
            completed_at: None,
        };
        let files: Option<Vec<String>> = t
            .files_modified
            .as_ref()
            .and_then(|f| serde_json::from_str(f).ok());
        assert!(files.is_none());
    }

    #[test]
    fn task_files_modified_none_returns_none() {
        let t = Task {
            raw_id: "r".into(),
            task_id: "t".into(),
            session_id: None,
            description: "d".into(),
            task_type: "feature".into(),
            outcome: None,
            confidence: None,
            notes: None,
            files_modified: None,
            tests_added: None,
            started_at: "2024-01-01".into(),
            completed_at: None,
        };
        let files: Option<Vec<String>> = t
            .files_modified
            .as_ref()
            .and_then(|f| serde_json::from_str(f).ok());
        assert!(files.is_none());
    }

    #[test]
    fn task_files_modified_empty_array() {
        let t = Task {
            raw_id: "r".into(),
            task_id: "t".into(),
            session_id: None,
            description: "d".into(),
            task_type: "feature".into(),
            outcome: None,
            confidence: None,
            notes: None,
            files_modified: Some("[]".into()),
            tests_added: None,
            started_at: "2024-01-01".into(),
            completed_at: None,
        };
        let files: Option<Vec<String>> = t
            .files_modified
            .as_ref()
            .and_then(|f| serde_json::from_str(f).ok());
        assert!(files.is_some());
        assert!(files.unwrap().is_empty());
    }

    #[test]
    fn task_clone() {
        let t = Task::from(make_task_model());
        let t2 = t.clone();
        assert_eq!(t.raw_id, t2.raw_id);
        assert_eq!(t.task_id, t2.task_id);
        assert_eq!(t.description, t2.description);
    }

    #[test]
    fn task_edge_construction() {
        let edge = TaskEdge {
            node: Task::from(make_task_model()),
            cursor: "cursor-1".into(),
        };
        assert_eq!(edge.cursor, "cursor-1");
        assert_eq!(edge.node.task_id, "task-abc");
    }

    #[test]
    fn task_connection_construction() {
        let conn = TaskConnection {
            edges: vec![TaskEdge {
                node: Task::from(make_task_model()),
                cursor: "c1".into(),
            }],
            page_info: PageInfo {
                has_next_page: false,
                has_previous_page: false,
                start_cursor: Some("c1".into()),
                end_cursor: Some("c1".into()),
            },
            total_count: 1,
        };
        assert_eq!(conn.total_count, 1);
        assert_eq!(conn.edges.len(), 1);
        assert!(!conn.page_info.has_next_page);
    }

    #[test]
    fn task_connection_empty() {
        let conn = TaskConnection {
            edges: vec![],
            page_info: PageInfo {
                has_next_page: false,
                has_previous_page: false,
                start_cursor: None,
                end_cursor: None,
            },
            total_count: 0,
        };
        assert_eq!(conn.total_count, 0);
        assert!(conn.edges.is_empty());
    }

    #[test]
    fn metrics_data_construction() {
        let md = MetricsData {
            total_tasks: 50,
            completed_tasks: 35,
            active_tasks: 15,
            task_type_counts: vec![
                TaskTypeCount { task_type: "feature".into(), count: 20 },
                TaskTypeCount { task_type: "bugfix".into(), count: 15 },
            ],
            task_outcome_counts: vec![
                TaskOutcomeCount { outcome: "success".into(), count: 30 },
                TaskOutcomeCount { outcome: "partial".into(), count: 5 },
            ],
        };
        assert_eq!(md.total_tasks, 50);
        assert_eq!(md.completed_tasks, 35);
        assert_eq!(md.active_tasks, 15);
        assert_eq!(md.task_type_counts.len(), 2);
        assert_eq!(md.task_outcome_counts.len(), 2);
    }

    #[test]
    fn task_type_count_construction() {
        let tc = TaskTypeCount {
            task_type: "refactor".into(),
            count: 7,
        };
        assert_eq!(tc.task_type, "refactor");
        assert_eq!(tc.count, 7);
    }

    #[test]
    fn task_outcome_count_construction() {
        let oc = TaskOutcomeCount {
            outcome: "abandoned".into(),
            count: 2,
        };
        assert_eq!(oc.outcome, "abandoned");
        assert_eq!(oc.count, 2);
    }
}
