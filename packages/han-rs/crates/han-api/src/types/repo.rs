//! Repo (git repository) GraphQL type.

use async_graphql::*;
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};

use crate::node::encode_global_id;

/// Repo data for GraphQL resolution.
#[derive(Debug, Clone)]
pub struct Repo {
    pub raw_id: String,
    pub remote: String,
    pub name: String,
    pub default_branch: Option<String>,
    pub created_at: String,
    pub updated_at: String,
}

#[Object]
impl Repo {
    /// Repo global ID.
    pub async fn id(&self) -> ID {
        encode_global_id("Repo", &self.raw_id)
    }

    /// Git remote URL.
    async fn remote(&self) -> &str { &self.remote }

    /// Repository name.
    async fn name(&self) -> &str { &self.name }

    /// Default branch.
    async fn default_branch(&self) -> Option<&str> { self.default_branch.as_deref() }

    /// Created timestamp.
    async fn created_at(&self) -> &str { &self.created_at }

    /// Updated timestamp.
    async fn updated_at(&self) -> &str { &self.updated_at }

    // Backwards-compatible fields for browse-client
    /// Alias for raw_id.
    async fn repo_id(&self) -> &str { &self.raw_id }
    /// Repo path (uses remote).
    async fn path(&self) -> &str { &self.remote }

    /// Total sessions count across all projects in this repo.
    async fn total_sessions(&self, ctx: &Context<'_>) -> Result<Option<i32>> {
        let db = ctx.data::<DatabaseConnection>()?;
        // Get project IDs for this repo, then count sessions
        let project_ids: Vec<String> = han_db::entities::projects::Entity::find()
            .filter(han_db::entities::projects::Column::RepoId.eq(&self.raw_id))
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?
            .into_iter()
            .map(|p| p.id)
            .collect();

        if project_ids.is_empty() {
            return Ok(Some(0));
        }

        let count = han_db::entities::sessions::Entity::find()
            .filter(han_db::entities::sessions::Column::ProjectId.is_in(project_ids))
            .all(db)
            .await
            .map(|v| v.len() as i32)
            .map_err(|e| Error::new(e.to_string()))?;
        Ok(Some(count))
    }

    /// Last activity timestamp.
    async fn last_activity(&self) -> Option<&str> { Some(&self.updated_at) }

    /// Projects in this repo.
    async fn projects(&self, ctx: &Context<'_>) -> Result<Option<Vec<crate::types::project::Project>>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let models = han_db::entities::projects::Entity::find()
            .filter(han_db::entities::projects::Column::RepoId.eq(&self.raw_id))
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;
        Ok(Some(models.into_iter().map(crate::types::project::Project::from).collect()))
    }
}

impl From<han_db::entities::repos::Model> for Repo {
    fn from(m: han_db::entities::repos::Model) -> Self {
        Self {
            raw_id: m.id,
            remote: m.remote,
            name: m.name,
            default_branch: m.default_branch,
            created_at: m.created_at,
            updated_at: m.updated_at,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use han_db::entities::repos;

    #[test]
    fn from_model_maps_all_fields() {
        let m = repos::Model {
            id: "repo-1".into(),
            remote: "https://github.com/org/repo.git".into(),
            name: "repo".into(),
            default_branch: Some("main".into()),
            created_at: "2025-01-01".into(),
            updated_at: "2025-01-02".into(),
        };
        let r = Repo::from(m);
        assert_eq!(r.raw_id, "repo-1");
        assert_eq!(r.remote, "https://github.com/org/repo.git");
        assert_eq!(r.name, "repo");
        assert_eq!(r.default_branch, Some("main".into()));
        assert_eq!(r.created_at, "2025-01-01");
        assert_eq!(r.updated_at, "2025-01-02");
    }

    #[test]
    fn default_branch_none() {
        let m = repos::Model {
            id: "r".into(),
            remote: "git@host:r.git".into(),
            name: "r".into(),
            default_branch: None,
            created_at: "".into(),
            updated_at: "".into(),
        };
        assert!(Repo::from(m).default_branch.is_none());
    }
}
