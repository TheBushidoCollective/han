//! DataLoaders for batching database access.
//!
//! DataLoaders batch and cache data fetching within a single GraphQL request,
//! eliminating N+1 query problems.

use std::collections::HashMap;

use async_graphql::dataloader::*;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter, QueryOrder};

use han_db::entities::{
    hook_executions, messages, native_tasks, session_file_changes, session_todos, tasks,
};

// ============================================================================
// Session Messages Loader
// ============================================================================

/// Batch loads messages for multiple sessions by session_id.
pub struct SessionMessagesLoader {
    pub db: DatabaseConnection,
}

impl Loader<String> for SessionMessagesLoader {
    type Value = Vec<messages::Model>;
    type Error = async_graphql::Error;

    async fn load(
        &self,
        keys: &[String],
    ) -> Result<HashMap<String, Self::Value>, Self::Error> {
        let all_messages = messages::Entity::find()
            .filter(messages::Column::SessionId.is_in(keys.to_vec()))
            .order_by_desc(messages::Column::Timestamp)
            .all(&self.db)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let mut map: HashMap<String, Vec<messages::Model>> = HashMap::new();
        for msg in all_messages {
            map.entry(msg.session_id.clone())
                .or_default()
                .push(msg);
        }

        // Ensure all requested keys have entries
        for key in keys {
            map.entry(key.clone()).or_default();
        }

        Ok(map)
    }
}

// ============================================================================
// Hook Executions Loader
// ============================================================================

/// Batch loads hook executions for multiple sessions.
pub struct SessionHookExecutionsLoader {
    pub db: DatabaseConnection,
}

impl Loader<String> for SessionHookExecutionsLoader {
    type Value = Vec<hook_executions::Model>;
    type Error = async_graphql::Error;

    async fn load(
        &self,
        keys: &[String],
    ) -> Result<HashMap<String, Self::Value>, Self::Error> {
        let all_executions = hook_executions::Entity::find()
            .filter(hook_executions::Column::SessionId.is_in(keys.iter().map(|k| Some(k.clone())).collect::<Vec<_>>()))
            .order_by_desc(hook_executions::Column::ExecutedAt)
            .all(&self.db)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let mut map: HashMap<String, Vec<hook_executions::Model>> = HashMap::new();
        for exec in all_executions {
            if let Some(ref session_id) = exec.session_id {
                map.entry(session_id.clone())
                    .or_default()
                    .push(exec);
            }
        }

        for key in keys {
            map.entry(key.clone()).or_default();
        }

        Ok(map)
    }
}

// ============================================================================
// Native Tasks Loader
// ============================================================================

/// Batch loads native tasks for multiple sessions.
pub struct SessionNativeTasksLoader {
    pub db: DatabaseConnection,
}

impl Loader<String> for SessionNativeTasksLoader {
    type Value = Vec<native_tasks::Model>;
    type Error = async_graphql::Error;

    async fn load(
        &self,
        keys: &[String],
    ) -> Result<HashMap<String, Self::Value>, Self::Error> {
        let all_tasks = native_tasks::Entity::find()
            .filter(native_tasks::Column::SessionId.is_in(keys.to_vec()))
            .order_by_asc(native_tasks::Column::CreatedAt)
            .all(&self.db)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let mut map: HashMap<String, Vec<native_tasks::Model>> = HashMap::new();
        for task in all_tasks {
            map.entry(task.session_id.clone())
                .or_default()
                .push(task);
        }

        for key in keys {
            map.entry(key.clone()).or_default();
        }

        Ok(map)
    }
}

// ============================================================================
// Tasks (Metrics) Loader
// ============================================================================

/// Batch loads metrics tasks for multiple sessions.
pub struct SessionTasksLoader {
    pub db: DatabaseConnection,
}

impl Loader<String> for SessionTasksLoader {
    type Value = Vec<tasks::Model>;
    type Error = async_graphql::Error;

    async fn load(
        &self,
        keys: &[String],
    ) -> Result<HashMap<String, Self::Value>, Self::Error> {
        let all_tasks = tasks::Entity::find()
            .filter(tasks::Column::SessionId.is_in(keys.iter().map(|k| Some(k.clone())).collect::<Vec<_>>()))
            .order_by_desc(tasks::Column::StartedAt)
            .all(&self.db)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let mut map: HashMap<String, Vec<tasks::Model>> = HashMap::new();
        for task in all_tasks {
            if let Some(ref session_id) = task.session_id {
                map.entry(session_id.clone())
                    .or_default()
                    .push(task);
            }
        }

        for key in keys {
            map.entry(key.clone()).or_default();
        }

        Ok(map)
    }
}

// ============================================================================
// Session File Changes Loader
// ============================================================================

/// Batch loads file changes for multiple sessions.
pub struct SessionFileChangesLoader {
    pub db: DatabaseConnection,
}

impl Loader<String> for SessionFileChangesLoader {
    type Value = Vec<session_file_changes::Model>;
    type Error = async_graphql::Error;

    async fn load(
        &self,
        keys: &[String],
    ) -> Result<HashMap<String, Self::Value>, Self::Error> {
        let all_changes = session_file_changes::Entity::find()
            .filter(session_file_changes::Column::SessionId.is_in(keys.to_vec()))
            .order_by_desc(session_file_changes::Column::RecordedAt)
            .all(&self.db)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let mut map: HashMap<String, Vec<session_file_changes::Model>> = HashMap::new();
        for change in all_changes {
            map.entry(change.session_id.clone())
                .or_default()
                .push(change);
        }

        for key in keys {
            map.entry(key.clone()).or_default();
        }

        Ok(map)
    }
}

// ============================================================================
// Session Todos Loader
// ============================================================================

/// Batch loads todos for multiple sessions.
pub struct SessionTodosLoader {
    pub db: DatabaseConnection,
}

impl Loader<String> for SessionTodosLoader {
    type Value = Vec<session_todos::Model>;
    type Error = async_graphql::Error;

    async fn load(
        &self,
        keys: &[String],
    ) -> Result<HashMap<String, Self::Value>, Self::Error> {
        let all_todos = session_todos::Entity::find()
            .filter(session_todos::Column::SessionId.is_in(keys.to_vec()))
            .all(&self.db)
            .await
            .map_err(|e| async_graphql::Error::new(e.to_string()))?;

        let mut map: HashMap<String, Vec<session_todos::Model>> = HashMap::new();
        for todo in all_todos {
            map.entry(todo.session_id.clone())
                .or_default()
                .push(todo);
        }

        for key in keys {
            map.entry(key.clone()).or_default();
        }

        Ok(map)
    }
}

// ============================================================================
// Composite HanLoaders
// ============================================================================

/// All DataLoaders bundled for the GraphQL context.
pub struct HanLoaders {
    pub session_messages: DataLoader<SessionMessagesLoader>,
    pub session_hook_executions: DataLoader<SessionHookExecutionsLoader>,
    pub session_native_tasks: DataLoader<SessionNativeTasksLoader>,
    pub session_tasks: DataLoader<SessionTasksLoader>,
    pub session_file_changes: DataLoader<SessionFileChangesLoader>,
    pub session_todos: DataLoader<SessionTodosLoader>,
}

impl HanLoaders {
    /// Create new DataLoader instances for a request.
    pub fn new(db: DatabaseConnection) -> Self {
        Self {
            session_messages: DataLoader::new(
                SessionMessagesLoader { db: db.clone() },
                tokio::spawn,
            ),
            session_hook_executions: DataLoader::new(
                SessionHookExecutionsLoader { db: db.clone() },
                tokio::spawn,
            ),
            session_native_tasks: DataLoader::new(
                SessionNativeTasksLoader { db: db.clone() },
                tokio::spawn,
            ),
            session_tasks: DataLoader::new(
                SessionTasksLoader { db: db.clone() },
                tokio::spawn,
            ),
            session_file_changes: DataLoader::new(
                SessionFileChangesLoader { db: db.clone() },
                tokio::spawn,
            ),
            session_todos: DataLoader::new(
                SessionTodosLoader { db },
                tokio::spawn,
            ),
        }
    }
}
