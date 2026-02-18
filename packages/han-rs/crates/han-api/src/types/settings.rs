//! Settings summary GraphQL type.

use async_graphql::*;

/// A settings file with source information.
#[derive(Debug, Clone, SimpleObject)]
pub struct SettingsFile {
    /// Path to settings file.
    pub path: Option<String>,
    /// Source location (user, project, local, root, directory).
    pub source: Option<String>,
    /// Human-readable source label.
    pub source_label: Option<String>,
    /// File type (claude or han).
    #[graphql(name = "type")]
    pub file_type: Option<String>,
    /// Whether the file exists.
    pub exists: Option<bool>,
    /// Last modification time.
    pub last_modified: Option<String>,
}

/// Claude settings summary (legacy).
#[derive(Debug, Clone, SimpleObject)]
pub struct ClaudeSettingsSummary {
    pub user_file: Option<String>,
    pub project_file: Option<String>,
    pub local_file: Option<String>,
    pub path: Option<String>,
    pub exists: Option<bool>,
    pub last_modified: Option<String>,
    pub plugin_count: Option<i32>,
    pub mcp_server_count: Option<i32>,
    pub has_permissions: Option<bool>,
}

/// Han config summary (legacy).
#[derive(Debug, Clone, SimpleObject)]
pub struct HanConfigSummary {
    pub root_file: Option<String>,
    pub directory_file: Option<String>,
    pub path: Option<String>,
    pub exists: Option<bool>,
    pub last_modified: Option<String>,
    pub hooks_enabled: Option<bool>,
    pub metrics_enabled: Option<bool>,
    pub memory_enabled: Option<bool>,
    pub plugin_config_count: Option<i32>,
}

/// MCP server configuration.
#[derive(Debug, Clone, SimpleObject)]
pub struct McpServer {
    pub id: Option<String>,
    pub name: Option<String>,
    pub command: Option<String>,
    pub url: Option<String>,
    pub source: Option<String>,
    #[graphql(name = "type")]
    pub server_type: Option<String>,
    pub arg_count: Option<i32>,
    pub has_env: Option<bool>,
}

/// Permissions configuration.
#[derive(Debug, Clone, SimpleObject)]
pub struct Permissions {
    pub allow_list: Option<Vec<String>>,
    pub deny_list: Option<Vec<String>>,
    pub allowed_tools: Option<Vec<String>>,
    pub denied_tools: Option<Vec<String>>,
    pub additional_directories: Option<Vec<String>>,
}

/// Settings summary with all configuration locations.
#[derive(Debug, Clone, SimpleObject)]
pub struct SettingsSummary {
    /// All Claude settings files with source information.
    pub claude_settings_files: Option<Vec<SettingsFile>>,
    /// All Han config files with source information.
    pub han_config_files: Option<Vec<SettingsFile>>,
    /// Claude settings summary (legacy).
    pub claude_settings: Option<ClaudeSettingsSummary>,
    /// Han configuration summary (legacy).
    pub han_config: Option<HanConfigSummary>,
    /// Configured MCP servers.
    pub mcp_servers: Option<Vec<McpServer>>,
    /// Permissions configuration.
    pub permissions: Option<Permissions>,
}

/// Cached hook run entry.
#[derive(Debug, Clone, SimpleObject)]
pub struct CacheEntry {
    /// Cache entry ID.
    pub id: Option<ID>,
    /// Plugin name.
    pub plugin_name: Option<String>,
    /// Hook name.
    pub hook_name: Option<String>,
    /// Path to cache file.
    pub path: Option<String>,
    /// Number of files tracked.
    pub file_count: Option<i32>,
    /// When the cache was last updated.
    pub last_modified: Option<String>,
}

/// Aggregate cache statistics.
#[derive(Debug, Clone, SimpleObject)]
pub struct CacheStats {
    /// Total number of cache entries.
    pub total_entries: Option<i32>,
    /// Total number of tracked files.
    pub total_files: Option<i32>,
    /// Oldest cache entry timestamp.
    pub oldest_entry: Option<String>,
    /// Newest cache entry timestamp.
    pub newest_entry: Option<String>,
}

/// Memory query interface.
#[derive(Debug, Clone)]
pub struct MemoryQueryType;

#[Object(name = "MemoryQuery")]
impl MemoryQueryType {
    /// All project and user rules across registered projects (stub).
    async fn rules(&self) -> Option<Vec<MemoryRule>> { Some(vec![]) }

    /// Search memory with a question (stub).
    async fn search(
        &self,
        _query: String,
        _project_path: String,
        _layers: Option<Vec<String>>,
    ) -> Option<MemorySearchResult> { None }
}

/// A memory rule.
#[derive(Debug, Clone, SimpleObject)]
pub struct MemoryRule {
    pub id: Option<ID>,
    pub path: Option<String>,
    pub content: Option<String>,
    pub source: Option<String>,
    pub scope: Option<String>,
    pub domain: Option<String>,
    pub project_name: Option<String>,
    pub project_path: Option<String>,
    pub size: Option<i32>,
}

/// Result from memory search.
#[derive(Debug, Clone, SimpleObject)]
pub struct MemorySearchResult {
    pub answer: Option<String>,
    pub confidence: Option<String>,
    pub source: Option<String>,
    pub citations: Option<Vec<Citation>>,
    pub layers_searched: Option<Vec<String>>,
    pub caveats: Option<Vec<String>>,
}

/// Citation from memory search (shared by MemorySearchResult and MemoryAgentResultPayload).
#[derive(Debug, Clone, SimpleObject)]
pub struct Citation {
    pub source: Option<String>,
    pub excerpt: Option<String>,
    pub author: Option<String>,
    pub timestamp: Option<String>,
    pub layer: Option<String>,
    pub project_name: Option<String>,
    pub project_path: Option<String>,
    pub relevance: Option<f64>,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_summary_construction() {
        let ss = SettingsSummary {
            claude_settings_files: Some(vec![]),
            han_config_files: Some(vec![]),
            claude_settings: None,
            han_config: None,
            mcp_servers: None,
            permissions: None,
        };
        assert!(ss.claude_settings_files.is_some());
    }

    #[test]
    fn cache_entry_construction() {
        let ce = CacheEntry {
            id: Some("1".into()),
            plugin_name: Some("biome".into()),
            hook_name: Some("lint".into()),
            path: Some("/tmp/cache".into()),
            file_count: Some(5),
            last_modified: None,
        };
        assert_eq!(ce.plugin_name, Some("biome".into()));
    }

    #[test]
    fn cache_stats_construction() {
        let cs = CacheStats {
            total_entries: Some(10),
            total_files: Some(50),
            oldest_entry: None,
            newest_entry: None,
        };
        assert_eq!(cs.total_entries, Some(10));
    }
}
