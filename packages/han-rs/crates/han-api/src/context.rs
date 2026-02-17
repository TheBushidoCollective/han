//! GraphQL context for resolvers.
//!
//! The context provides access to database connections, DataLoaders,
//! and subscription channels.

use sea_orm::DatabaseConnection;
use tokio::sync::broadcast;

use crate::loaders::HanLoaders;

/// Database change event for subscriptions.
#[derive(Debug, Clone)]
pub enum DbChangeEvent {
    /// A session was updated.
    SessionUpdated { session_id: String },
    /// A new message was added to a session.
    SessionMessageAdded {
        session_id: String,
        message_index: i32,
    },
    /// A new session was created.
    SessionAdded {
        session_id: String,
        parent_id: Option<String>,
    },
    /// A repo was added.
    RepoAdded { repo_id: String },
    /// A project was added.
    ProjectAdded {
        project_id: String,
        parent_id: Option<String>,
    },
    /// A tool result was received.
    ToolResultAdded {
        session_id: String,
        call_id: String,
        result_type: String,
        success: bool,
        duration_ms: i32,
    },
    /// A hook result was received.
    HookResultAdded {
        session_id: String,
        hook_run_id: String,
        plugin_name: String,
        hook_name: String,
        success: bool,
        duration_ms: i32,
    },
    /// Session todos changed.
    SessionTodosChanged {
        session_id: String,
        todo_count: i32,
        in_progress_count: i32,
        completed_count: i32,
    },
    /// Session files changed.
    SessionFilesChanged {
        session_id: String,
        file_count: i32,
        tool_name: String,
    },
    /// Session hooks changed.
    SessionHooksChanged {
        session_id: String,
        plugin_name: String,
        hook_name: String,
        event_type: String,
    },
    /// Node updated (generic).
    NodeUpdated { id: String, typename: String },
}

/// User role for access control (hosted mode).
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum UserRole {
    Ic,
    Manager,
    Admin,
}

/// User context for authenticated requests (hosted mode).
#[derive(Debug, Clone)]
pub struct UserContext {
    pub id: String,
    pub display_name: Option<String>,
    pub role: UserRole,
    pub org_id: Option<String>,
    pub project_ids: Option<Vec<String>>,
}

/// Operating mode for the API.
#[derive(Debug, Clone, PartialEq, Eq)]
pub enum OperatingMode {
    Local,
    Hosted,
}

/// GraphQL context available to all resolvers.
pub struct GraphQLContext {
    /// Database connection.
    pub db: DatabaseConnection,
    /// DataLoaders for batching database access.
    pub loaders: HanLoaders,
    /// Broadcast sender for subscription events.
    pub event_sender: broadcast::Sender<DbChangeEvent>,
    /// Authenticated user (hosted mode only).
    pub user: Option<UserContext>,
    /// Operating mode.
    pub mode: OperatingMode,
}

impl GraphQLContext {
    /// Create a new context for a request.
    pub fn new(
        db: DatabaseConnection,
        event_sender: broadcast::Sender<DbChangeEvent>,
    ) -> Self {
        let loaders = HanLoaders::new(db.clone());
        Self {
            db,
            loaders,
            event_sender,
            user: None,
            mode: OperatingMode::Local,
        }
    }

    /// Create a new context with user authentication.
    pub fn with_user(mut self, user: UserContext) -> Self {
        self.user = Some(user);
        self.mode = OperatingMode::Hosted;
        self
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn db_change_event_session_updated() {
        let e = DbChangeEvent::SessionUpdated { session_id: "s1".into() };
        let debug = format!("{:?}", e);
        assert!(debug.contains("SessionUpdated"));
        assert!(debug.contains("s1"));
    }

    #[test]
    fn db_change_event_session_message_added() {
        let e = DbChangeEvent::SessionMessageAdded {
            session_id: "s1".into(),
            message_index: 42,
        };
        let cloned = e.clone();
        if let DbChangeEvent::SessionMessageAdded { session_id, message_index } = cloned {
            assert_eq!(session_id, "s1");
            assert_eq!(message_index, 42);
        } else {
            panic!("wrong variant");
        }
    }

    #[test]
    fn db_change_event_session_added() {
        let e = DbChangeEvent::SessionAdded {
            session_id: "s1".into(),
            parent_id: Some("p1".into()),
        };
        if let DbChangeEvent::SessionAdded { session_id, parent_id } = e {
            assert_eq!(session_id, "s1");
            assert_eq!(parent_id, Some("p1".into()));
        }
    }

    #[test]
    fn db_change_event_tool_result_added() {
        let e = DbChangeEvent::ToolResultAdded {
            session_id: "s1".into(),
            call_id: "c1".into(),
            result_type: "mcp".into(),
            success: true,
            duration_ms: 100,
        };
        if let DbChangeEvent::ToolResultAdded { success, duration_ms, .. } = e {
            assert!(success);
            assert_eq!(duration_ms, 100);
        }
    }

    #[test]
    fn db_change_event_hook_result_added() {
        let e = DbChangeEvent::HookResultAdded {
            session_id: "s1".into(),
            hook_run_id: "hr1".into(),
            plugin_name: "biome".into(),
            hook_name: "lint".into(),
            success: false,
            duration_ms: 500,
        };
        if let DbChangeEvent::HookResultAdded { plugin_name, success, .. } = e {
            assert_eq!(plugin_name, "biome");
            assert!(!success);
        }
    }

    #[test]
    fn db_change_event_node_updated() {
        let e = DbChangeEvent::NodeUpdated {
            id: "id1".into(),
            typename: "Session".into(),
        };
        if let DbChangeEvent::NodeUpdated { id, typename } = e {
            assert_eq!(id, "id1");
            assert_eq!(typename, "Session");
        }
    }

    #[test]
    fn db_change_event_session_todos_changed() {
        let e = DbChangeEvent::SessionTodosChanged {
            session_id: "s1".into(),
            todo_count: 3,
            in_progress_count: 1,
            completed_count: 2,
        };
        if let DbChangeEvent::SessionTodosChanged { todo_count, in_progress_count, completed_count, .. } = e {
            assert_eq!(todo_count, 3);
            assert_eq!(in_progress_count, 1);
            assert_eq!(completed_count, 2);
        }
    }

    #[test]
    fn db_change_event_session_files_changed() {
        let e = DbChangeEvent::SessionFilesChanged {
            session_id: "s1".into(),
            file_count: 5,
            tool_name: "Write".into(),
        };
        if let DbChangeEvent::SessionFilesChanged { file_count, tool_name, .. } = e {
            assert_eq!(file_count, 5);
            assert_eq!(tool_name, "Write");
        }
    }

    #[test]
    fn db_change_event_session_hooks_changed() {
        let e = DbChangeEvent::SessionHooksChanged {
            session_id: "s1".into(),
            plugin_name: "biome".into(),
            hook_name: "lint".into(),
            event_type: "Stop".into(),
        };
        if let DbChangeEvent::SessionHooksChanged { event_type, .. } = e {
            assert_eq!(event_type, "Stop");
        }
    }

    #[test]
    fn db_change_event_repo_added() {
        let e = DbChangeEvent::RepoAdded { repo_id: "r1".into() };
        if let DbChangeEvent::RepoAdded { repo_id } = e {
            assert_eq!(repo_id, "r1");
        }
    }

    #[test]
    fn db_change_event_project_added() {
        let e = DbChangeEvent::ProjectAdded {
            project_id: "p1".into(),
            parent_id: None,
        };
        if let DbChangeEvent::ProjectAdded { project_id, parent_id } = e {
            assert_eq!(project_id, "p1");
            assert!(parent_id.is_none());
        }
    }

    #[test]
    fn user_role_equality() {
        assert_eq!(UserRole::Ic, UserRole::Ic);
        assert_ne!(UserRole::Ic, UserRole::Manager);
        assert_ne!(UserRole::Manager, UserRole::Admin);
    }

    #[test]
    fn operating_mode_equality() {
        assert_eq!(OperatingMode::Local, OperatingMode::Local);
        assert_ne!(OperatingMode::Local, OperatingMode::Hosted);
    }

    #[test]
    fn user_context_construction() {
        let uc = UserContext {
            id: "user-1".into(),
            display_name: Some("Alice".into()),
            role: UserRole::Admin,
            org_id: Some("org-1".into()),
            project_ids: Some(vec!["p1".into(), "p2".into()]),
        };
        assert_eq!(uc.id, "user-1");
        assert_eq!(uc.display_name, Some("Alice".into()));
        assert_eq!(uc.role, UserRole::Admin);
        assert_eq!(uc.org_id, Some("org-1".into()));
        assert_eq!(uc.project_ids.as_ref().unwrap().len(), 2);
    }
}
