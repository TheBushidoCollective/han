//! Settings summary GraphQL type.

use async_graphql::*;

/// Settings summary data.
#[derive(Debug, Clone, SimpleObject)]
pub struct SettingsSummary {
    /// Number of user settings entries.
    pub user_settings_count: i32,
    /// Number of project settings entries.
    pub project_settings_count: i32,
    /// Number of local settings entries.
    pub local_settings_count: i32,
    /// Effective settings after merge.
    pub effective_settings: Option<String>,
}
