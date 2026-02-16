//! Config directory GraphQL type.

use async_graphql::*;
use crate::node::encode_global_id;

/// Config directory data.
#[derive(Debug, Clone)]
pub struct ConfigDir {
    pub raw_id: String,
    pub path: String,
    pub name: Option<String>,
    pub is_default: bool,
    pub registered_at: String,
    pub last_indexed_at: Option<String>,
    pub session_count: Option<i32>,
}

#[Object]
impl ConfigDir {
    async fn id(&self) -> ID { encode_global_id("ConfigDir", &self.raw_id) }
    async fn path(&self) -> &str { &self.path }
    async fn name(&self) -> Option<&str> { self.name.as_deref() }
    async fn is_default(&self) -> bool { self.is_default }
    async fn registered_at(&self) -> &str { &self.registered_at }
    async fn last_indexed_at(&self) -> Option<&str> { self.last_indexed_at.as_deref() }
    async fn session_count(&self) -> Option<i32> { self.session_count }
}

impl From<han_db::entities::config_dirs::Model> for ConfigDir {
    fn from(m: han_db::entities::config_dirs::Model) -> Self {
        Self {
            raw_id: m.id,
            path: m.path,
            name: m.name,
            is_default: m.is_default != 0,
            registered_at: m.registered_at,
            last_indexed_at: m.last_indexed_at,
            session_count: m.session_count,
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use han_db::entities::config_dirs;

    fn make_model(is_default: i32) -> config_dirs::Model {
        config_dirs::Model {
            id: "cd-1".into(),
            path: "/home/user/.claude".into(),
            name: Some("default".into()),
            is_default,
            registered_at: "2025-01-01".into(),
            last_indexed_at: Some("2025-01-02".into()),
            session_count: Some(5),
        }
    }

    #[test]
    fn from_model_maps_all_fields() {
        let cd = ConfigDir::from(make_model(1));
        assert_eq!(cd.raw_id, "cd-1");
        assert_eq!(cd.path, "/home/user/.claude");
        assert_eq!(cd.name, Some("default".into()));
        assert!(cd.is_default);
        assert_eq!(cd.registered_at, "2025-01-01");
        assert_eq!(cd.last_indexed_at, Some("2025-01-02".into()));
        assert_eq!(cd.session_count, Some(5));
    }

    #[test]
    fn is_default_true_when_nonzero() {
        assert!(ConfigDir::from(make_model(1)).is_default);
        assert!(ConfigDir::from(make_model(99)).is_default);
    }

    #[test]
    fn is_default_false_when_zero() {
        assert!(!ConfigDir::from(make_model(0)).is_default);
    }

    #[test]
    fn optional_fields_none() {
        let m = config_dirs::Model {
            id: "c".into(),
            path: "/p".into(),
            name: None,
            is_default: 0,
            registered_at: "".into(),
            last_indexed_at: None,
            session_count: None,
        };
        let cd = ConfigDir::from(m);
        assert!(cd.name.is_none());
        assert!(cd.last_indexed_at.is_none());
        assert!(cd.session_count.is_none());
    }
}
