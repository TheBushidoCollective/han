//! GraphQL Query root.
//!
//! All top-level queries. Uses Relay Node interface - no viewer pattern.

use async_graphql::*;
use sea_orm::{DatabaseConnection, EntityTrait, QueryOrder, ColumnTrait, QueryFilter};

use han_db::entities::{config_dirs, projects, repos, sessions};

use crate::node::decode_global_id;
use crate::types::config_dir::ConfigDir;
use crate::types::dashboard::CoordinatorStatus;
use crate::types::project::Project;
use crate::types::repo::Repo;
use crate::types::sessions::{SessionConnection, SessionData, build_session_connection};

/// Query root type.
pub struct QueryRoot;

#[Object]
impl QueryRoot {
    /// Fetch any node by its global ID.
    async fn node(&self, _ctx: &Context<'_>, id: ID) -> Result<Option<String>> {
        let _parsed = decode_global_id(id.as_str())
            .ok_or_else(|| Error::new(format!("Invalid global ID format: {}", id.as_str())))?;
        // Node resolution would dispatch to type-specific loaders
        // For now, return None - implement when each type registers its loader
        Ok(None)
    }

    /// All projects with sessions.
    async fn projects(&self, ctx: &Context<'_>, first: Option<i32>) -> Result<Vec<Project>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let limit = first.unwrap_or(20) as u64;
        let models = projects::Entity::find()
            .order_by_desc(projects::Column::UpdatedAt)
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        Ok(models.into_iter().take(limit as usize).map(Project::from).collect())
    }

    /// Get a project by ID.
    async fn project(&self, ctx: &Context<'_>, id: String) -> Result<Option<Project>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let model = projects::Entity::find_by_id(&id)
            .one(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;
        Ok(model.map(Project::from))
    }

    /// All git repositories with sessions.
    async fn repos(&self, ctx: &Context<'_>, first: Option<i32>) -> Result<Vec<Repo>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let limit = first.unwrap_or(20) as u64;
        let models = repos::Entity::find()
            .order_by_desc(repos::Column::UpdatedAt)
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        Ok(models.into_iter().take(limit as usize).map(Repo::from).collect())
    }

    /// Get a repo by its repoId.
    async fn repo(&self, ctx: &Context<'_>, id: String) -> Result<Option<Repo>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let model = repos::Entity::find_by_id(&id)
            .one(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;
        Ok(model.map(Repo::from))
    }

    /// All registered config directories.
    async fn config_dirs(&self, ctx: &Context<'_>) -> Result<Vec<ConfigDir>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let models = config_dirs::Entity::find()
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;
        Ok(models.into_iter().map(ConfigDir::from).collect())
    }

    /// Get a session by ID.
    async fn session(&self, ctx: &Context<'_>, id: String) -> Result<Option<SessionData>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let model = sessions::Entity::find_by_id(&id)
            .one(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;
        Ok(model.map(session_model_to_data))
    }

    /// Get sessions with cursor-based pagination.
    async fn sessions(
        &self,
        ctx: &Context<'_>,
        first: Option<i32>,
        after: Option<String>,
        last: Option<i32>,
        before: Option<String>,
        project_id: Option<String>,
        _worktree_name: Option<String>,
    ) -> Result<SessionConnection> {
        let db = ctx.data::<DatabaseConnection>()?;

        let mut query = sessions::Entity::find();

        if let Some(ref pid) = project_id {
            query = query.filter(sessions::Column::ProjectId.eq(pid.clone()));
        }

        let models = query
            .order_by_desc(sessions::Column::Id) // Sessions don't have a date column in DB, ordered by ID
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        let session_data: Vec<SessionData> = models.into_iter().map(session_model_to_data).collect();

        Ok(build_session_connection(session_data, first, after, last, before))
    }

    /// Coordinator status for version checking.
    async fn coordinator_status(&self, _client_version: Option<String>) -> CoordinatorStatus {
        CoordinatorStatus {
            version: env!("CARGO_PKG_VERSION").to_string(),
            needs_restart: false,
        }
    }
}

/// Convert a database session model to GraphQL SessionData.
fn session_model_to_data(m: sessions::Model) -> SessionData {
    SessionData {
        session_id: m.id,
        project_dir: String::new(), // Populated from context when available
        project_id: m.project_id,
        project_name: String::new(), // Populated via join when available
        project_path: String::new(),
        date: String::new(), // Derived from transcript path or message timestamps
        slug: m.slug,
        summary: None,
        message_count: 0, // Populated via count query
        started_at: None,
        updated_at: None,
        git_branch: None,
        version: None,
        worktree_name: None,
        source_config_dir: m.source_config_dir,
        status: m.status,
    }
}
