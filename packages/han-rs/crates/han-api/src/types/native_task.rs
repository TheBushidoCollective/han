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
