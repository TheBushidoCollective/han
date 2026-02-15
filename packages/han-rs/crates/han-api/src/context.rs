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
