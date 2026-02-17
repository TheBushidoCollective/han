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

#[cfg(test)]
mod tests {
    use super::*;
    use crate::node::encode_global_id;

    fn make_plugin(name: &str) -> Plugin {
        Plugin {
            name: name.into(),
            source: Some("./plugins/languages/typescript".into()),
            enabled: true,
            scope: "user".into(),
            version: Some("1.0.0".into()),
            description: Some("A test plugin".into()),
        }
    }

    #[test]
    fn plugin_construction_all_fields() {
        let p = make_plugin("typescript");
        assert_eq!(p.name, "typescript");
        assert_eq!(p.source, Some("./plugins/languages/typescript".into()));
        assert!(p.enabled);
        assert_eq!(p.scope, "user");
        assert_eq!(p.version, Some("1.0.0".into()));
        assert_eq!(p.description, Some("A test plugin".into()));
    }

    #[test]
    fn plugin_construction_optional_fields_none() {
        let p = Plugin {
            name: "minimal".into(),
            source: None,
            enabled: false,
            scope: "project".into(),
            version: None,
            description: None,
        };
        assert_eq!(p.name, "minimal");
        assert!(p.source.is_none());
        assert!(!p.enabled);
        assert_eq!(p.scope, "project");
        assert!(p.version.is_none());
        assert!(p.description.is_none());
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
        assert_eq!(p.source, p2.source);
        assert_eq!(p.enabled, p2.enabled);
    }

    #[test]
    fn plugin_debug() {
        let p = make_plugin("biome");
        let debug = format!("{:?}", p);
        assert!(debug.contains("biome"));
        assert!(debug.contains("Plugin"));
    }

    #[test]
    fn plugin_stats_construction() {
        let stats = PluginStats {
            total: 10,
            enabled: 7,
            disabled: 3,
            by_scope: vec![
                PluginScopeCount { scope: "user".into(), count: 5 },
                PluginScopeCount { scope: "project".into(), count: 3 },
                PluginScopeCount { scope: "local".into(), count: 2 },
            ],
        };
        assert_eq!(stats.total, 10);
        assert_eq!(stats.enabled, 7);
        assert_eq!(stats.disabled, 3);
        assert_eq!(stats.by_scope.len(), 3);
    }

    #[test]
    fn plugin_scope_count_construction() {
        let sc = PluginScopeCount {
            scope: "user".into(),
            count: 5,
        };
        assert_eq!(sc.scope, "user");
        assert_eq!(sc.count, 5);
    }

    #[test]
    fn plugin_category_construction() {
        let cat = PluginCategory {
            category: "languages".into(),
            count: 2,
            plugins: vec![make_plugin("typescript"), make_plugin("rust")],
        };
        assert_eq!(cat.category, "languages");
        assert_eq!(cat.count, 2);
        assert_eq!(cat.plugins.len(), 2);
        assert_eq!(cat.plugins[0].name, "typescript");
        assert_eq!(cat.plugins[1].name, "rust");
    }

    #[test]
    fn plugin_category_empty_plugins() {
        let cat = PluginCategory {
            category: "tools".into(),
            count: 0,
            plugins: vec![],
        };
        assert_eq!(cat.count, 0);
        assert!(cat.plugins.is_empty());
    }

    #[test]
    fn plugin_stats_clone() {
        let stats = PluginStats {
            total: 5,
            enabled: 3,
            disabled: 2,
            by_scope: vec![PluginScopeCount { scope: "user".into(), count: 5 }],
        };
        let stats2 = stats.clone();
        assert_eq!(stats.total, stats2.total);
        assert_eq!(stats.by_scope.len(), stats2.by_scope.len());
    }
}
