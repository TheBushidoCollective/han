//! Native task (Claude Code TaskCreate/TaskUpdate) GraphQL type.

use async_graphql::*;
use crate::node::encode_global_id;

/// Native task data.
#[derive(Debug, Clone)]
pub struct NativeTask {
    pub raw_id: String,
    pub session_id: String,
    pub message_id: String,
    pub subject: String,
    pub description: Option<String>,
    pub status: String,
    pub active_form: Option<String>,
    pub owner: Option<String>,
    pub blocks: Option<String>,
    pub blocked_by: Option<String>,
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub line_number: i32,
}

#[Object]
impl NativeTask {
    async fn id(&self) -> ID { encode_global_id("NativeTask", &self.raw_id) }
    async fn subject(&self) -> &str { &self.subject }
    async fn description(&self) -> Option<&str> { self.description.as_deref() }
    async fn status(&self) -> &str { &self.status }
    async fn active_form(&self) -> Option<&str> { self.active_form.as_deref() }
    async fn owner(&self) -> Option<&str> { self.owner.as_deref() }
    async fn blocks(&self) -> Option<Vec<String>> {
        self.blocks.as_ref().and_then(|b| serde_json::from_str(b).ok())
    }
    async fn blocked_by(&self) -> Option<Vec<String>> {
        self.blocked_by.as_ref().and_then(|b| serde_json::from_str(b).ok())
    }
    async fn created_at(&self) -> &str { &self.created_at }
    async fn updated_at(&self) -> &str { &self.updated_at }
    async fn completed_at(&self) -> Option<&str> { self.completed_at.as_deref() }
}

impl From<han_db::entities::native_tasks::Model> for NativeTask {
    fn from(m: han_db::entities::native_tasks::Model) -> Self {
        Self {
            raw_id: m.id,
            session_id: m.session_id,
            message_id: m.message_id,
            subject: m.subject,
            description: m.description,
            status: m.status,
            active_form: m.active_form,
            owner: m.owner,
            blocks: m.blocks,
            blocked_by: m.blocked_by,
            created_at: m.created_at,
            updated_at: m.updated_at,
            completed_at: m.completed_at,
            line_number: m.line_number,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use han_db::entities::native_tasks;

    fn make_model() -> native_tasks::Model {
        native_tasks::Model {
            id: "nt-1".into(),
            session_id: "sess-1".into(),
            message_id: "msg-1".into(),
            subject: "Fix auth bug".into(),
            description: Some("Users can't login".into()),
            status: "in_progress".into(),
            active_form: Some("Fixing auth bug".into()),
            owner: Some("agent-1".into()),
            blocks: Some(r#"["2","3"]"#.into()),
            blocked_by: Some(r#"["0"]"#.into()),
            created_at: "2025-01-01".into(),
            updated_at: "2025-01-02".into(),
            completed_at: None,
            line_number: 42,
        }
    }

    #[test]
    fn from_model_maps_all_fields() {
        let nt = NativeTask::from(make_model());
        assert_eq!(nt.raw_id, "nt-1");
        assert_eq!(nt.session_id, "sess-1");
        assert_eq!(nt.message_id, "msg-1");
        assert_eq!(nt.subject, "Fix auth bug");
        assert_eq!(nt.description, Some("Users can't login".into()));
        assert_eq!(nt.status, "in_progress");
        assert_eq!(nt.active_form, Some("Fixing auth bug".into()));
        assert_eq!(nt.owner, Some("agent-1".into()));
        assert_eq!(nt.line_number, 42);
    }

    #[test]
    fn blocks_parses_json_array() {
        let nt = NativeTask::from(make_model());
        // blocks field stores JSON, the GraphQL resolver parses it
        let parsed: Vec<String> = serde_json::from_str(nt.blocks.as_ref().unwrap()).unwrap();
        assert_eq!(parsed, vec!["2", "3"]);
    }

    #[test]
    fn blocked_by_parses_json_array() {
        let nt = NativeTask::from(make_model());
        let parsed: Vec<String> = serde_json::from_str(nt.blocked_by.as_ref().unwrap()).unwrap();
        assert_eq!(parsed, vec!["0"]);
    }

    #[test]
    fn blocks_none_when_not_set() {
        let mut m = make_model();
        m.blocks = None;
        m.blocked_by = None;
        let nt = NativeTask::from(m);
        assert!(nt.blocks.is_none());
        assert!(nt.blocked_by.is_none());
    }

    #[test]
    fn optional_fields_none() {
        let m = native_tasks::Model {
            id: "n".into(),
            session_id: "s".into(),
            message_id: "m".into(),
            subject: "sub".into(),
            description: None,
            status: "pending".into(),
            active_form: None,
            owner: None,
            blocks: None,
            blocked_by: None,
            created_at: "".into(),
            updated_at: "".into(),
            completed_at: None,
            line_number: 0,
        };
        let nt = NativeTask::from(m);
        assert!(nt.description.is_none());
        assert!(nt.active_form.is_none());
        assert!(nt.owner.is_none());
        assert!(nt.completed_at.is_none());
    }

    #[test]
    fn completed_at_populated() {
        let mut m = make_model();
        m.completed_at = Some("2025-01-03".into());
        let nt = NativeTask::from(m);
        assert_eq!(nt.completed_at, Some("2025-01-03".into()));
    }
}
