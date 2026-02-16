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

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn settings_summary_construction() {
        let ss = SettingsSummary {
            user_settings_count: 5,
            project_settings_count: 3,
            local_settings_count: 1,
            effective_settings: Some("{}".into()),
        };
        assert_eq!(ss.user_settings_count, 5);
        assert_eq!(ss.project_settings_count, 3);
        assert_eq!(ss.local_settings_count, 1);
        assert_eq!(ss.effective_settings, Some("{}".into()));
    }

    #[test]
    fn settings_summary_no_effective() {
        let ss = SettingsSummary {
            user_settings_count: 0,
            project_settings_count: 0,
            local_settings_count: 0,
            effective_settings: None,
        };
        assert!(ss.effective_settings.is_none());
    }
}
