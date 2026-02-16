//! Repo (git repository) GraphQL type.

use async_graphql::*;
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
    async fn id(&self) -> ID {
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
