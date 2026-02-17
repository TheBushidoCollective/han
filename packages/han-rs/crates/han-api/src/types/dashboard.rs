//! Dashboard analytics GraphQL types.

use async_graphql::*;

/// Dashboard analytics data.
#[derive(Debug, Clone, SimpleObject)]
pub struct DashboardAnalytics {
    /// Total sessions in period.
    pub total_sessions: i32,
    /// Total messages in period.
    pub total_messages: i32,
    /// Total tool calls.
    pub total_tool_calls: i32,
    /// Average session duration in seconds.
    pub avg_session_duration_secs: f64,
}

/// Coordinator status.
#[derive(Debug, Clone, SimpleObject)]
pub struct CoordinatorStatus {
    /// Current coordinator version.
    pub version: String,
    /// Whether a restart is pending due to newer client version.
    pub needs_restart: bool,
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn dashboard_analytics_construction() {
        let da = DashboardAnalytics {
            total_sessions: 100,
            total_messages: 5000,
            total_tool_calls: 2500,
            avg_session_duration_secs: 1800.5,
        };
        assert_eq!(da.total_sessions, 100);
        assert_eq!(da.total_messages, 5000);
        assert_eq!(da.total_tool_calls, 2500);
        assert!((da.avg_session_duration_secs - 1800.5).abs() < f64::EPSILON);
    }

    #[test]
    fn coordinator_status_construction() {
        let cs = CoordinatorStatus {
            version: "1.2.3".into(),
            needs_restart: false,
        };
        assert_eq!(cs.version, "1.2.3");
        assert!(!cs.needs_restart);
    }

    #[test]
    fn coordinator_status_needs_restart() {
        let cs = CoordinatorStatus {
            version: "1.0.0".into(),
            needs_restart: true,
        };
        assert!(cs.needs_restart);
    }

    #[test]
    fn dashboard_analytics_clone() {
        let da = DashboardAnalytics {
            total_sessions: 1,
            total_messages: 2,
            total_tool_calls: 3,
            avg_session_duration_secs: 4.0,
        };
        let da2 = da.clone();
        assert_eq!(da.total_sessions, da2.total_sessions);
    }
}
