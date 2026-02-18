//! GraphQL Subscription root.
//!
//! Uses tokio broadcast channels for real-time event delivery.

use async_graphql::*;
use han_db::entities::{messages, projects, sessions};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder, QuerySelect};
use tokio::sync::broadcast;
use tokio_stream::{Stream, StreamExt, wrappers::BroadcastStream};

use crate::context::DbChangeEvent;
use crate::node::{decode_global_id, encode_message_cursor, encode_session_cursor};
use crate::query::{enrich_single_session, session_model_to_data};
use crate::types::messages::{MessageData, MessageEdge, discriminate_message};
use crate::types::sessions::{SessionData, SessionEdge};

/// Subscription root type.
pub struct SubscriptionRoot;

// ============================================================================
// Subscription Payload Types
// ============================================================================

/// Node updated payload.
#[derive(Debug, Clone)]
pub struct NodeUpdatedPayload {
    /// Global ID of the updated node.
    pub id: String,
    /// GraphQL typename.
    pub typename: String,
}

#[Object]
impl NodeUpdatedPayload {
    async fn id(&self) -> &str { &self.id }
    async fn typename(&self) -> &str { &self.typename }

    /// The updated node, loaded from the database.
    async fn node(&self, ctx: &Context<'_>) -> Result<Option<crate::types::node::Node>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let parsed = match decode_global_id(&self.id) {
            Some(p) => p,
            None => return Ok(None),
        };

        match parsed.typename.as_str() {
            "Session" => {
                // ID is project_dir:session_id — extract session_id (last segment)
                let session_id = parsed.id.rsplit(':').next().unwrap_or(&parsed.id);
                let session = sessions::Entity::find_by_id(session_id)
                    .one(db)
                    .await
                    .map_err(|e| Error::new(e.to_string()))?;
                match session {
                    Some(s) => {
                        let mut data = session_model_to_data(s);
                        enrich_single_session(db, &mut data).await?;
                        Ok(Some(crate::types::node::Node::Session(data)))
                    }
                    None => Ok(None),
                }
            }
            _ => Ok(None),
        }
    }
}

/// Session message added payload.
#[derive(Debug, Clone)]
pub struct SessionMessageAddedPayload {
    /// Session ID.
    pub session_id: String,
    /// Index of the new message.
    pub message_index: i32,
}

#[Object]
impl SessionMessageAddedPayload {
    async fn session_id(&self) -> &str { &self.session_id }
    async fn message_index(&self) -> i32 { self.message_index }

    /// The newest message edge for Relay @prependEdge.
    ///
    /// Loads the latest non-paired message from the database and returns it
    /// as a MessageEdge so Relay can insert it into the connection.
    async fn new_message_edge(&self, ctx: &Context<'_>) -> Result<Option<MessageEdge>> {
        let db = ctx.data::<DatabaseConnection>()?;

        // Look up the session to get the project_dir for cursor encoding
        let session = sessions::Entity::find_by_id(&self.session_id)
            .one(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;
        let session = match session {
            Some(s) => s,
            None => return Ok(None),
        };

        let project_dir = if let Some(ref pid) = session.project_id {
            projects::Entity::find_by_id(pid)
                .one(db)
                .await
                .map_err(|e| Error::new(e.to_string()))?
                .map(|p| p.path)
                .unwrap_or_default()
        } else {
            String::new()
        };

        // Get the latest few messages for this session (newest by line_number)
        // We fetch a small batch because some may be paired events we need to skip
        let recent_msgs = messages::Entity::find()
            .filter(messages::Column::SessionId.eq(&self.session_id))
            .order_by_desc(messages::Column::LineNumber)
            .limit(10)
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        // Find the first message with content
        let msg = recent_msgs.iter().find(|m| {
            m.content.as_ref().map(|c| !c.is_empty()).unwrap_or(false)
                || m.message_type == "summary"
                || m.message_type == "han_event"
        });

        match msg {
            Some(msg) => {
                let data = MessageData::from_model(msg, &project_dir);
                let cursor = encode_message_cursor(&project_dir, &msg.session_id, msg.line_number);
                Ok(Some(MessageEdge {
                    node: discriminate_message(data),
                    cursor,
                }))
            }
            None => Ok(None),
        }
    }
}

/// Session added payload.
#[derive(Debug, Clone)]
pub struct SessionAddedPayload {
    /// ID of the new session.
    pub session_id: String,
    /// Parent project ID.
    pub parent_id: Option<String>,
    /// Project ID for filtering.
    pub project_id: Option<String>,
}

#[Object]
impl SessionAddedPayload {
    async fn session_id(&self) -> &str { &self.session_id }
    async fn parent_id(&self) -> Option<&str> { self.parent_id.as_deref() }
    async fn project_id(&self) -> Option<&str> { self.project_id.as_deref() }

    /// The new session edge for Relay @prependEdge.
    async fn new_session_edge(&self, ctx: &Context<'_>) -> Result<Option<SessionEdge>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let session = sessions::Entity::find_by_id(&self.session_id)
            .one(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        match session {
            Some(s) => {
                let mut data = session_model_to_data(s);
                enrich_single_session(db, &mut data).await?;
                let cursor = encode_session_cursor(&data.session_id, &data.date);
                Ok(Some(SessionEdge { node: data, cursor }))
            }
            None => Ok(None),
        }
    }
}

/// Tool result added payload.
#[derive(Debug, Clone, SimpleObject)]
pub struct ToolResultAddedPayload {
    /// Session ID.
    pub session_id: String,
    /// Call ID for correlation.
    pub call_id: String,
    /// Type of tool call (mcp or exposed).
    #[graphql(name = "type")]
    pub result_type: String,
    /// Whether the tool call succeeded.
    pub success: bool,
    /// Duration in milliseconds.
    pub duration_ms: i32,
}

/// Hook result added payload.
#[derive(Debug, Clone, SimpleObject)]
pub struct HookResultAddedPayload {
    /// Session ID.
    pub session_id: String,
    /// UUID of the parent hook_run event.
    pub hook_run_id: String,
    /// Plugin name.
    pub plugin_name: String,
    /// Hook name.
    pub hook_name: String,
    /// Whether the hook succeeded.
    pub success: bool,
    /// Duration in milliseconds.
    pub duration_ms: i32,
}

/// Session todos changed payload.
#[derive(Debug, Clone, SimpleObject)]
pub struct SessionTodosChangedPayload {
    pub session_id: String,
    pub todo_count: i32,
    pub in_progress_count: i32,
    pub completed_count: i32,
}

/// Session files changed payload.
#[derive(Debug, Clone, SimpleObject)]
pub struct SessionFilesChangedPayload {
    pub session_id: String,
    pub file_count: i32,
    pub tool_name: String,
}

/// Session hooks changed payload.
#[derive(Debug, Clone, SimpleObject)]
pub struct SessionHooksChangedPayload {
    pub session_id: String,
    pub plugin_name: String,
    pub hook_name: String,
    pub event_type: String,
}

/// Repo added payload.
#[derive(Debug, Clone, SimpleObject)]
pub struct RepoAddedPayload {
    pub repo_id: String,
}

/// Project added payload.
#[derive(Debug, Clone, SimpleObject)]
pub struct ProjectAddedPayload {
    pub project_id: String,
    pub parent_id: Option<String>,
}

#[Subscription]
impl SubscriptionRoot {
    /// Subscribe to updates for a specific node.
    async fn node_updated(
        &self,
        ctx: &Context<'_>,
        id: ID,
    ) -> Result<impl Stream<Item = NodeUpdatedPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();
        let target_id = id.to_string();

        Ok(BroadcastStream::new(receiver)
            .filter_map(move |event| {
                if let Ok(DbChangeEvent::NodeUpdated { id, typename }) = event {
                    if id == target_id {
                        return Some(NodeUpdatedPayload { id, typename });
                    }
                }
                None
            }))
    }

    /// Subscribe to new messages in a session. Use "*" for all sessions.
    async fn session_message_added(
        &self,
        ctx: &Context<'_>,
        session_id: ID,
    ) -> Result<impl Stream<Item = SessionMessageAddedPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();
        let target = session_id.to_string();

        Ok(BroadcastStream::new(receiver)
            .filter_map(move |event| {
                if let Ok(DbChangeEvent::SessionMessageAdded { session_id, message_index }) = event {
                    if target == "*" || session_id == target {
                        return Some(SessionMessageAddedPayload { session_id, message_index });
                    }
                }
                None
            }))
    }

    /// Subscribe to tool result for a specific call ID.
    async fn tool_result_added(
        &self,
        ctx: &Context<'_>,
        call_id: String,
    ) -> Result<impl Stream<Item = ToolResultAddedPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();

        Ok(BroadcastStream::new(receiver)
            .filter_map(move |event| {
                if let Ok(DbChangeEvent::ToolResultAdded {
                    session_id, call_id: cid, result_type, success, duration_ms,
                }) = event {
                    if cid == call_id {
                        return Some(ToolResultAddedPayload {
                            session_id, call_id: cid, result_type, success, duration_ms,
                        });
                    }
                }
                None
            }))
    }

    /// Subscribe to hook result for a specific hook run ID.
    async fn hook_result_added(
        &self,
        ctx: &Context<'_>,
        hook_run_id: String,
    ) -> Result<impl Stream<Item = HookResultAddedPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();

        Ok(BroadcastStream::new(receiver)
            .filter_map(move |event| {
                if let Ok(DbChangeEvent::HookResultAdded {
                    session_id, hook_run_id: hid, plugin_name, hook_name, success, duration_ms,
                }) = event {
                    if hid == hook_run_id {
                        return Some(HookResultAddedPayload {
                            session_id, hook_run_id: hid, plugin_name, hook_name, success, duration_ms,
                        });
                    }
                }
                None
            }))
    }

    /// Subscribe to todo changes for a session.
    async fn session_todos_changed(
        &self,
        ctx: &Context<'_>,
        session_id: ID,
    ) -> Result<impl Stream<Item = SessionTodosChangedPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();
        let target = session_id.to_string();

        Ok(BroadcastStream::new(receiver)
            .filter_map(move |event| {
                if let Ok(DbChangeEvent::SessionTodosChanged {
                    session_id, todo_count, in_progress_count, completed_count,
                }) = event {
                    if session_id == target {
                        return Some(SessionTodosChangedPayload {
                            session_id, todo_count, in_progress_count, completed_count,
                        });
                    }
                }
                None
            }))
    }

    /// Subscribe to file changes for a session.
    async fn session_files_changed(
        &self,
        ctx: &Context<'_>,
        session_id: ID,
    ) -> Result<impl Stream<Item = SessionFilesChangedPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();
        let target = session_id.to_string();

        Ok(BroadcastStream::new(receiver)
            .filter_map(move |event| {
                if let Ok(DbChangeEvent::SessionFilesChanged {
                    session_id, file_count, tool_name,
                }) = event {
                    if session_id == target {
                        return Some(SessionFilesChangedPayload {
                            session_id, file_count, tool_name,
                        });
                    }
                }
                None
            }))
    }

    /// Subscribe to hook events for a session.
    async fn session_hooks_changed(
        &self,
        ctx: &Context<'_>,
        session_id: ID,
    ) -> Result<impl Stream<Item = SessionHooksChangedPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();
        let target = session_id.to_string();

        Ok(BroadcastStream::new(receiver)
            .filter_map(move |event| {
                if let Ok(DbChangeEvent::SessionHooksChanged {
                    session_id, plugin_name, hook_name, event_type,
                }) = event {
                    if session_id == target {
                        return Some(SessionHooksChangedPayload {
                            session_id, plugin_name, hook_name, event_type,
                        });
                    }
                }
                None
            }))
    }

    /// Subscribe to new sessions. Filter by projectId or receive all.
    async fn session_added(
        &self,
        ctx: &Context<'_>,
        parent_id: Option<ID>,
        project_id: Option<ID>,
    ) -> Result<impl Stream<Item = SessionAddedPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();
        let target_parent = parent_id.map(|id| id.to_string());
        let target_project = project_id.map(|id| id.to_string());

        Ok(BroadcastStream::new(receiver)
            .filter_map(move |event| {
                if let Ok(DbChangeEvent::SessionAdded { session_id, parent_id, project_id }) = event {
                    // Filter by parent_id if specified
                    if target_parent.is_some() && parent_id != target_parent {
                        return None;
                    }
                    // Filter by project_id if specified
                    if target_project.is_some() && project_id != target_project {
                        return None;
                    }
                    return Some(SessionAddedPayload { session_id, parent_id, project_id });
                }
                None
            }))
    }

    /// Subscribe to new repos.
    async fn repo_added(
        &self,
        ctx: &Context<'_>,
    ) -> Result<impl Stream<Item = RepoAddedPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();

        Ok(BroadcastStream::new(receiver)
            .filter_map(|event| {
                if let Ok(DbChangeEvent::RepoAdded { repo_id }) = event {
                    return Some(RepoAddedPayload { repo_id });
                }
                None
            }))
    }

    /// Subscribe to new projects.
    async fn project_added(
        &self,
        ctx: &Context<'_>,
        parent_id: Option<ID>,
    ) -> Result<impl Stream<Item = ProjectAddedPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();
        let target = parent_id.map(|id| id.to_string());

        Ok(BroadcastStream::new(receiver)
            .filter_map(move |event| {
                if let Ok(DbChangeEvent::ProjectAdded { project_id, parent_id }) = event {
                    if target.is_none() || parent_id == target {
                        return Some(ProjectAddedPayload { project_id, parent_id });
                    }
                }
                None
            }))
    }

    // ========================================================================
    // Stub subscriptions for browse-client backwards compatibility
    // ========================================================================

    /// Subscribe to memory updates (stub).
    async fn memory_updated(
        &self,
        ctx: &Context<'_>,
    ) -> Result<impl Stream<Item = MemoryUpdatedPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();
        // This subscription never fires - it's a stub for schema compatibility
        Ok(BroadcastStream::new(receiver).filter_map(|_| None::<MemoryUpdatedPayload>))
    }

    /// Subscribe to memory agent progress (stub).
    async fn memory_agent_progress(
        &self,
        ctx: &Context<'_>,
        _session_id: Option<String>,
    ) -> Result<impl Stream<Item = MemoryAgentProgressPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();
        Ok(BroadcastStream::new(receiver).filter_map(|_| None::<MemoryAgentProgressPayload>))
    }

    /// Subscribe to memory agent results (stub).
    async fn memory_agent_result(
        &self,
        ctx: &Context<'_>,
        _session_id: Option<String>,
    ) -> Result<impl Stream<Item = MemoryAgentResultPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();
        Ok(BroadcastStream::new(receiver).filter_map(|_| None::<MemoryAgentResultPayload>))
    }
}

/// Memory updated payload (stub).
#[derive(Debug, Clone, SimpleObject)]
pub struct MemoryUpdatedPayload {
    #[graphql(name = "type")]
    pub event_type: Option<String>,
    pub action: Option<String>,
    pub path: Option<String>,
    pub timestamp: Option<String>,
}

/// Memory agent progress payload (stub).
#[derive(Debug, Clone, SimpleObject)]
pub struct MemoryAgentProgressPayload {
    pub query_id: Option<String>,
    pub session_id: Option<String>,
    #[graphql(name = "type")]
    pub progress_type: Option<String>,
    pub progress: Option<String>,
    pub message: Option<String>,
    pub layer: Option<String>,
    pub content: Option<String>,
    pub result_count: Option<i32>,
    pub timestamp: Option<String>,
}

/// Memory agent result payload (stub).
#[derive(Debug, Clone, SimpleObject)]
pub struct MemoryAgentResultPayload {
    pub query_id: Option<String>,
    pub session_id: Option<String>,
    pub result: Option<String>,
    pub answer: Option<String>,
    pub confidence: Option<String>,
    pub citations: Option<Vec<crate::types::settings::Citation>>,
    pub searched_layers: Option<Vec<String>>,
    pub success: Option<bool>,
    pub error: Option<String>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn node_updated_payload_construction() {
        let p = NodeUpdatedPayload {
            id: "Session:abc".into(),
            typename: "Session".into(),
        };
        assert_eq!(p.id, "Session:abc");
        assert_eq!(p.typename, "Session");
    }

    #[test]
    fn node_updated_payload_clone() {
        let p = NodeUpdatedPayload { id: "x".into(), typename: "Y".into() };
        let p2 = p.clone();
        assert_eq!(p.id, p2.id);
        assert_eq!(p.typename, p2.typename);
    }

    #[test]
    fn session_message_added_payload() {
        let p = SessionMessageAddedPayload {
            session_id: "s1".into(),
            message_index: 42,
        };
        assert_eq!(p.session_id, "s1");
        assert_eq!(p.message_index, 42);
    }

    #[test]
    fn session_added_payload() {
        let p = SessionAddedPayload {
            session_id: "s1".into(),
            parent_id: Some("proj-1".into()),
            project_id: Some("proj-1".into()),
        };
        assert_eq!(p.session_id, "s1");
        assert_eq!(p.parent_id, Some("proj-1".into()));
        assert_eq!(p.project_id, Some("proj-1".into()));
    }

    #[test]
    fn session_added_payload_no_parent() {
        let p = SessionAddedPayload {
            session_id: "s1".into(),
            parent_id: None,
            project_id: None,
        };
        assert!(p.parent_id.is_none());
        assert!(p.project_id.is_none());
    }

    #[test]
    fn tool_result_added_payload() {
        let p = ToolResultAddedPayload {
            session_id: "s1".into(),
            call_id: "c1".into(),
            result_type: "mcp".into(),
            success: true,
            duration_ms: 250,
        };
        assert!(p.success);
        assert_eq!(p.duration_ms, 250);
        assert_eq!(p.result_type, "mcp");
    }

    #[test]
    fn hook_result_added_payload() {
        let p = HookResultAddedPayload {
            session_id: "s1".into(),
            hook_run_id: "hr1".into(),
            plugin_name: "biome".into(),
            hook_name: "lint".into(),
            success: false,
            duration_ms: 1200,
        };
        assert!(!p.success);
        assert_eq!(p.plugin_name, "biome");
        assert_eq!(p.hook_name, "lint");
    }

    #[test]
    fn session_todos_changed_payload() {
        let p = SessionTodosChangedPayload {
            session_id: "s1".into(),
            todo_count: 5,
            in_progress_count: 2,
            completed_count: 3,
        };
        assert_eq!(p.todo_count, 5);
        assert_eq!(p.in_progress_count, 2);
        assert_eq!(p.completed_count, 3);
    }

    #[test]
    fn session_files_changed_payload() {
        let p = SessionFilesChangedPayload {
            session_id: "s1".into(),
            file_count: 10,
            tool_name: "Write".into(),
        };
        assert_eq!(p.file_count, 10);
        assert_eq!(p.tool_name, "Write");
    }

    #[test]
    fn session_hooks_changed_payload() {
        let p = SessionHooksChangedPayload {
            session_id: "s1".into(),
            plugin_name: "biome".into(),
            hook_name: "lint".into(),
            event_type: "Stop".into(),
        };
        assert_eq!(p.event_type, "Stop");
    }

    #[test]
    fn repo_added_payload() {
        let p = RepoAddedPayload { repo_id: "r1".into() };
        assert_eq!(p.repo_id, "r1");
    }

    #[test]
    fn project_added_payload() {
        let p = ProjectAddedPayload {
            project_id: "p1".into(),
            parent_id: None,
        };
        assert_eq!(p.project_id, "p1");
        assert!(p.parent_id.is_none());
    }

    #[test]
    fn all_payloads_implement_debug() {
        let _ = format!("{:?}", NodeUpdatedPayload { id: "".into(), typename: "".into() });
        let _ = format!("{:?}", SessionMessageAddedPayload { session_id: "".into(), message_index: 0 });
        let _ = format!("{:?}", SessionAddedPayload { session_id: "".into(), parent_id: None, project_id: None });
        let _ = format!("{:?}", ToolResultAddedPayload { session_id: "".into(), call_id: "".into(), result_type: "".into(), success: false, duration_ms: 0 });
        let _ = format!("{:?}", HookResultAddedPayload { session_id: "".into(), hook_run_id: "".into(), plugin_name: "".into(), hook_name: "".into(), success: false, duration_ms: 0 });
        let _ = format!("{:?}", SessionTodosChangedPayload { session_id: "".into(), todo_count: 0, in_progress_count: 0, completed_count: 0 });
        let _ = format!("{:?}", SessionFilesChangedPayload { session_id: "".into(), file_count: 0, tool_name: "".into() });
        let _ = format!("{:?}", SessionHooksChangedPayload { session_id: "".into(), plugin_name: "".into(), hook_name: "".into(), event_type: "".into() });
        let _ = format!("{:?}", RepoAddedPayload { repo_id: "".into() });
        let _ = format!("{:?}", ProjectAddedPayload { project_id: "".into(), parent_id: None });
    }
}
