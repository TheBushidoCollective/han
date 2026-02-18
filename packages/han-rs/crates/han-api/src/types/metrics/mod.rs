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

    /// Task type enum (FIX, IMPLEMENTATION, REFACTOR, RESEARCH).
    #[graphql(name = "type")]
    async fn type_enum(&self) -> Option<crate::types::enums::TaskType> {
        match self.task_type.to_lowercase().as_str() {
            "fix" | "bugfix" | "bug" => Some(crate::types::enums::TaskType::Fix),
            "implementation" | "feature" | "implement" => Some(crate::types::enums::TaskType::Implementation),
            "refactor" | "refactoring" => Some(crate::types::enums::TaskType::Refactor),
            "research" | "investigate" => Some(crate::types::enums::TaskType::Research),
            _ => Some(crate::types::enums::TaskType::Implementation),
        }
    }

    /// Task status (ACTIVE, COMPLETED, FAILED).
    async fn status(&self) -> crate::types::enums::TaskStatus {
        if self.completed_at.is_some() {
            match self.outcome.as_deref() {
                Some("failure") | Some("failed") => crate::types::enums::TaskStatus::Failed,
                _ => crate::types::enums::TaskStatus::Completed,
            }
        } else {
            crate::types::enums::TaskStatus::Active
        }
    }

    async fn outcome(&self) -> Option<&str> { self.outcome.as_deref() }
    async fn confidence(&self) -> Option<f64> { self.confidence }
    async fn notes(&self) -> Option<&str> { self.notes.as_deref() }
    async fn files_modified(&self) -> Option<Vec<String>> {
        self.files_modified.as_ref().and_then(|f| serde_json::from_str(f).ok())
    }
    async fn tests_added(&self) -> Option<i32> { self.tests_added }
    async fn started_at(&self) -> &str { &self.started_at }
    async fn completed_at(&self) -> Option<&str> { self.completed_at.as_deref() }

    /// Duration in seconds (computed from startedAt/completedAt).
    async fn duration_seconds(&self) -> Option<i32> {
        let completed = self.completed_at.as_ref()?;
        let start = chrono::DateTime::parse_from_rfc3339(&self.started_at).ok()?;
        let end = chrono::DateTime::parse_from_rfc3339(completed).ok()?;
        Some(end.signed_duration_since(start).num_seconds() as i32)
    }
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
    pub total_tasks: Option<i32>,
    pub completed_tasks: Option<i32>,
    pub success_rate: Option<f64>,
    pub average_confidence: Option<f64>,
    pub average_duration: Option<f64>,
    pub calibration_score: Option<f64>,
    pub significant_frustrations: Option<i32>,
    pub significant_frustration_rate: Option<f64>,
    pub tasks_by_type: Option<Vec<TaskTypeCount>>,
    pub tasks_by_outcome: Option<Vec<TaskOutcomeCount>>,
}

/// Count of tasks by type.
#[derive(Debug, Clone, SimpleObject)]
pub struct TaskTypeCount {
    #[graphql(name = "type")]
    pub task_type: Option<crate::types::enums::TaskType>,
    pub count: Option<i32>,
}

/// Count of tasks by outcome.
#[derive(Debug, Clone, SimpleObject)]
pub struct TaskOutcomeCount {
    pub outcome: Option<crate::types::enums::TaskOutcome>,
    pub count: Option<i32>,
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
            total_tasks: Some(50),
            completed_tasks: Some(35),
            success_rate: Some(0.7),
            average_confidence: Some(0.85),
            average_duration: None,
            calibration_score: Some(0.9),
            significant_frustrations: Some(3),
            significant_frustration_rate: Some(0.06),
            tasks_by_type: Some(vec![]),
            tasks_by_outcome: Some(vec![]),
        };
        assert_eq!(md.total_tasks, Some(50));
        assert_eq!(md.completed_tasks, Some(35));
    }

    #[test]
    fn task_type_count_construction() {
        let tc = TaskTypeCount {
            task_type: Some(crate::types::enums::TaskType::Refactor),
            count: Some(7),
        };
        assert_eq!(tc.count, Some(7));
    }

    #[test]
    fn task_outcome_count_construction() {
        let oc = TaskOutcomeCount {
            outcome: Some(crate::types::enums::TaskOutcome::Success),
            count: Some(2),
        };
        assert_eq!(oc.count, Some(2));
    }
}
