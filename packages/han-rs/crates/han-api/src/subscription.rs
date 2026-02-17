//! GraphQL Subscription root.
//!
//! Uses tokio broadcast channels for real-time event delivery.

use async_graphql::*;
use tokio::sync::broadcast;
use tokio_stream::{Stream, StreamExt, wrappers::BroadcastStream};

use crate::context::DbChangeEvent;

/// Subscription root type.
pub struct SubscriptionRoot;

// ============================================================================
// Subscription Payload Types
// ============================================================================

/// Node updated payload.
#[derive(Debug, Clone, SimpleObject)]
pub struct NodeUpdatedPayload {
    /// Global ID of the updated node.
    pub id: String,
    /// GraphQL typename.
    pub typename: String,
}

/// Session message added payload.
#[derive(Debug, Clone, SimpleObject)]
pub struct SessionMessageAddedPayload {
    /// Session ID.
    pub session_id: String,
    /// Index of the new message.
    pub message_index: i32,
}

/// Session added payload.
#[derive(Debug, Clone, SimpleObject)]
pub struct SessionAddedPayload {
    /// ID of the new session.
    pub session_id: String,
    /// Parent project ID.
    pub parent_id: Option<String>,
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

    /// Subscribe to new sessions.
    async fn session_added(
        &self,
        ctx: &Context<'_>,
        parent_id: Option<ID>,
    ) -> Result<impl Stream<Item = SessionAddedPayload>> {
        let sender = ctx.data::<broadcast::Sender<DbChangeEvent>>()?;
        let receiver = sender.subscribe();
        let target = parent_id.map(|id| id.to_string());

        Ok(BroadcastStream::new(receiver)
            .filter_map(move |event| {
                if let Ok(DbChangeEvent::SessionAdded { session_id, parent_id }) = event {
                    if target.is_none() || parent_id == target {
                        return Some(SessionAddedPayload { session_id, parent_id });
                    }
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
        };
        assert_eq!(p.session_id, "s1");
        assert_eq!(p.parent_id, Some("proj-1".into()));
    }

    #[test]
    fn session_added_payload_no_parent() {
        let p = SessionAddedPayload {
            session_id: "s1".into(),
            parent_id: None,
        };
        assert!(p.parent_id.is_none());
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
        let _ = format!("{:?}", SessionAddedPayload { session_id: "".into(), parent_id: None });
        let _ = format!("{:?}", ToolResultAddedPayload { session_id: "".into(), call_id: "".into(), result_type: "".into(), success: false, duration_ms: 0 });
        let _ = format!("{:?}", HookResultAddedPayload { session_id: "".into(), hook_run_id: "".into(), plugin_name: "".into(), hook_name: "".into(), success: false, duration_ms: 0 });
        let _ = format!("{:?}", SessionTodosChangedPayload { session_id: "".into(), todo_count: 0, in_progress_count: 0, completed_count: 0 });
        let _ = format!("{:?}", SessionFilesChangedPayload { session_id: "".into(), file_count: 0, tool_name: "".into() });
        let _ = format!("{:?}", SessionHooksChangedPayload { session_id: "".into(), plugin_name: "".into(), hook_name: "".into(), event_type: "".into() });
        let _ = format!("{:?}", RepoAddedPayload { repo_id: "".into() });
        let _ = format!("{:?}", ProjectAddedPayload { project_id: "".into(), parent_id: None });
    }
}
