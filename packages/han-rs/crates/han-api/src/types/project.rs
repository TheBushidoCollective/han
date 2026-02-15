//! Project GraphQL type.

use async_graphql::*;
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
    async fn id(&self) -> ID {
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
