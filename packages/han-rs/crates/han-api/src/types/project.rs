//! Project GraphQL type.

use async_graphql::*;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};

use crate::node::encode_global_id;

/// Project data for GraphQL resolution.
#[derive(Debug, Clone)]
pub struct Project {
    pub raw_id: String,
    pub slug: String,
    pub path: String,
    pub name: String,
    pub repo_id: Option<String>,
    pub relative_path: Option<String>,
    pub is_worktree: bool,
    pub created_at: String,
    pub updated_at: String,
}

#[Object]
impl Project {
    /// Project global ID.
    pub async fn id(&self) -> ID {
        encode_global_id("Project", &self.raw_id)
    }

    /// Project slug.
    async fn slug(&self) -> &str { &self.slug }

    /// Full path.
    async fn path(&self) -> &str { &self.path }

    /// Project name.
    async fn name(&self) -> &str { &self.name }

    /// Repo ID (if git project).
    async fn repo_id(&self) -> Option<&str> { self.repo_id.as_deref() }

    /// Relative path within repo.
    async fn relative_path(&self) -> Option<&str> { self.relative_path.as_deref() }

    /// Whether this is a worktree.
    async fn is_worktree(&self) -> bool { self.is_worktree }

    /// Created timestamp.
    async fn created_at(&self) -> &str { &self.created_at }

    /// Updated timestamp.
    async fn updated_at(&self) -> &str { &self.updated_at }

    // Backwards-compatible fields for browse-client
    /// Alias for raw_id.
    async fn project_id(&self) -> &str { &self.raw_id }

    /// Total sessions count.
    async fn total_sessions(&self, ctx: &Context<'_>) -> Result<Option<i32>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let count = han_db::entities::sessions::Entity::find()
            .filter(han_db::entities::sessions::Column::ProjectId.eq(&self.raw_id))
            .all(db)
            .await
            .map(|v| v.len() as i32)
            .map_err(|e| Error::new(e.to_string()))?;
        Ok(Some(count))
    }

    /// Session count.
    async fn session_count(&self, ctx: &Context<'_>) -> Result<Option<i32>> {
        self.total_sessions(ctx).await
    }

    /// Last activity timestamp.
    async fn last_activity(&self) -> Option<&str> { Some(&self.updated_at) }
    /// Worktrees (stub).
    async fn worktrees(&self) -> Option<Vec<Project>> { Some(vec![]) }
    /// Subdirectory projects (stub).
    async fn subdirs(&self) -> Option<Vec<Project>> { Some(vec![]) }
    /// Installed plugins (stub).
    async fn plugins(&self) -> Option<Vec<crate::types::plugin::Plugin>> { Some(vec![]) }
}

impl From<han_db::entities::projects::Model> for Project {
    fn from(m: han_db::entities::projects::Model) -> Self {
        Self {
            raw_id: m.id,
            slug: m.slug,
            path: m.path,
            name: m.name,
            repo_id: m.repo_id,
            relative_path: m.relative_path,
            is_worktree: m.is_worktree.unwrap_or(0) != 0,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use han_db::entities::projects;

    fn make_model(is_worktree: Option<i32>, repo_id: Option<String>) -> projects::Model {
        projects::Model {
            id: "proj-1".into(),
            slug: "my-project".into(),
            path: "/home/user/project".into(),
            name: "My Project".into(),
            repo_id,
            relative_path: Some("packages/core".into()),
            is_worktree,
            source_config_dir: None,
            created_at: "2025-01-01T00:00:00Z".into(),
            updated_at: "2025-01-02T00:00:00Z".into(),
        }
    }

    #[test]
    fn from_model_maps_all_fields() {
        let m = make_model(Some(1), Some("repo-1".into()));
        let p = Project::from(m);
        assert_eq!(p.raw_id, "proj-1");
        assert_eq!(p.slug, "my-project");
        assert_eq!(p.path, "/home/user/project");
        assert_eq!(p.name, "My Project");
        assert_eq!(p.repo_id, Some("repo-1".into()));
        assert_eq!(p.relative_path, Some("packages/core".into()));
        assert!(p.is_worktree);
        assert_eq!(p.created_at, "2025-01-01T00:00:00Z");
        assert_eq!(p.updated_at, "2025-01-02T00:00:00Z");
    }

    #[test]
    fn is_worktree_true_when_nonzero() {
        assert!(Project::from(make_model(Some(1), None)).is_worktree);
        assert!(Project::from(make_model(Some(42), None)).is_worktree);
    }

    #[test]
    fn is_worktree_false_when_zero() {
        assert!(!Project::from(make_model(Some(0), None)).is_worktree);
    }

    #[test]
    fn is_worktree_false_when_none() {
        assert!(!Project::from(make_model(None, None)).is_worktree);
    }

    #[test]
    fn optional_fields_none() {
        let m = projects::Model {
            id: "p".into(),
            slug: "s".into(),
            path: "/p".into(),
            name: "n".into(),
            repo_id: None,
            relative_path: None,
            is_worktree: None,
            source_config_dir: None,
            created_at: "".into(),
            updated_at: "".into(),
        };
        let p = Project::from(m);
        assert!(p.repo_id.is_none());
        assert!(p.relative_path.is_none());
    }
}
