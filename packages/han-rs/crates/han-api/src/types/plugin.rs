//! Plugin GraphQL type.

use async_graphql::*;
use crate::node::encode_global_id;

/// Plugin data.
#[derive(Debug, Clone)]
pub struct Plugin {
    pub name: String,
    pub source: Option<String>,
    pub enabled: bool,
    pub scope: String,
    pub version: Option<String>,
    pub description: Option<String>,
}

#[Object]
impl Plugin {
    async fn id(&self) -> ID { encode_global_id("Plugin", &self.name) }
    async fn name(&self) -> &str { &self.name }
    async fn source(&self) -> Option<&str> { self.source.as_deref() }
    async fn enabled(&self) -> bool { self.enabled }
    async fn scope(&self) -> &str { &self.scope }
    async fn version(&self) -> Option<&str> { self.version.as_deref() }
    async fn description(&self) -> Option<&str> { self.description.as_deref() }
}

/// Plugin statistics.
#[derive(Debug, Clone, SimpleObject)]
pub struct PluginStats {
    pub total: i32,
    pub enabled: i32,
    pub disabled: i32,
    pub by_scope: Vec<PluginScopeCount>,
}

/// Count of plugins by scope.
#[derive(Debug, Clone, SimpleObject)]
pub struct PluginScopeCount {
    pub scope: String,
    pub count: i32,
}

/// Plugin category with count.
#[derive(Debug, Clone, SimpleObject)]
pub struct PluginCategory {
    pub category: String,
    pub count: i32,
    pub plugins: Vec<Plugin>,
}
