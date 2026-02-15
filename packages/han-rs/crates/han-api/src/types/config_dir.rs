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
