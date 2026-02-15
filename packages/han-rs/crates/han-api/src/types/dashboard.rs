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
