//! Plugin GraphQL type.

use async_graphql::*;
use crate::node::encode_global_id;

/// Plugin data.
#[derive(Debug, Clone)]
pub struct Plugin {
    pub name: String,
    pub source: Option<String>,
    pub enabled: bool,
    pub scope: Option<crate::types::enums::PluginScope>,
    pub marketplace: Option<String>,
    pub category: Option<String>,
}

#[Object]
impl Plugin {
    async fn id(&self) -> ID { encode_global_id("Plugin", &self.name) }
    async fn name(&self) -> Option<&str> { Some(&self.name) }
    async fn enabled(&self) -> Option<bool> { Some(self.enabled) }
    async fn scope(&self) -> Option<crate::types::enums::PluginScope> { self.scope }
    async fn marketplace(&self) -> Option<&str> { self.marketplace.as_deref() }
    async fn category(&self) -> Option<&str> { self.category.as_deref() }
}

/// Plugin statistics matching browse-client schema.
#[derive(Debug, Clone, SimpleObject)]
pub struct PluginStats {
    pub total_plugins: Option<i32>,
    pub user_plugins: Option<i32>,
    pub project_plugins: Option<i32>,
    pub local_plugins: Option<i32>,
    pub enabled_plugins: Option<i32>,
}

/// Plugin category with count.
#[derive(Debug, Clone, SimpleObject)]
pub struct PluginCategory {
    pub category: Option<String>,
    pub count: Option<i32>,
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::node::encode_global_id;

    fn make_plugin(name: &str) -> Plugin {
        Plugin {
            name: name.into(),
            source: Some("./plugins/languages/typescript".into()),
            enabled: true,
            scope: Some(crate::types::enums::PluginScope::User),
            marketplace: Some("han".into()),
            category: Some("languages".into()),
        }
    }

    #[test]
    fn plugin_construction_all_fields() {
        let p = make_plugin("typescript");
        assert_eq!(p.name, "typescript");
        assert!(p.enabled);
    }

    #[test]
    fn plugin_global_id_format() {
        let id = encode_global_id("Plugin", "typescript");
        assert_eq!(id.as_str(), "Plugin:typescript");
    }

    #[test]
    fn plugin_clone() {
        let p = make_plugin("rust");
        let p2 = p.clone();
        assert_eq!(p.name, p2.name);
        assert_eq!(p.enabled, p2.enabled);
    }

    #[test]
    fn plugin_stats_construction() {
        let stats = PluginStats {
            total_plugins: Some(10),
            user_plugins: Some(5),
            project_plugins: Some(3),
            local_plugins: Some(2),
            enabled_plugins: Some(7),
        };
        assert_eq!(stats.total_plugins, Some(10));
        assert_eq!(stats.enabled_plugins, Some(7));
    }

    #[test]
    fn plugin_category_construction() {
        let cat = PluginCategory {
            category: Some("languages".into()),
            count: Some(2),
        };
        assert_eq!(cat.category, Some("languages".into()));
        assert_eq!(cat.count, Some(2));
    }
}
