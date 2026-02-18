//! Dashboard analytics and activity GraphQL types.
//!
//! Matches the browse-client schema.graphql for backwards compatibility.

use std::collections::HashMap;

use async_graphql::*;
use serde::Deserialize;

/// Coordinator status.
#[derive(Debug, Clone, SimpleObject)]
pub struct CoordinatorStatus {
    /// Current coordinator version.
    pub version: String,
    /// Whether a restart is pending due to newer client version.
    pub needs_restart: bool,
}

// ============================================================================
// Activity Data (for activity query)
// ============================================================================

/// Complete activity data for dashboard visualizations.
#[derive(Debug, Clone, SimpleObject)]
pub struct ActivityData {
    pub daily_activity: Option<Vec<DailyActivity>>,
    pub hourly_activity: Option<Vec<HourlyActivity>>,
    pub token_usage: Option<TokenUsageStats>,
    pub daily_model_tokens: Option<Vec<DailyModelTokens>>,
    pub model_usage: Option<Vec<ModelUsageStats>>,
    pub total_sessions: Option<i32>,
    pub total_messages: Option<i32>,
    pub streak_days: Option<i32>,
    pub total_active_days: Option<i32>,
    pub first_session_date: Option<String>,
}

/// Single data point in the activity heatmap.
#[derive(Debug, Clone, SimpleObject)]
pub struct DailyActivity {
    pub date: Option<String>,
    pub session_count: Option<i32>,
    pub message_count: Option<i32>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cached_tokens: Option<i64>,
    pub lines_added: Option<i32>,
    pub lines_removed: Option<i32>,
    pub files_changed: Option<i32>,
}

/// Activity by hour of day (0-23).
#[derive(Debug, Clone, SimpleObject)]
pub struct HourlyActivity {
    pub hour: Option<i32>,
    pub session_count: Option<i32>,
    pub message_count: Option<i32>,
}

/// Aggregate token usage statistics.
#[derive(Debug, Clone, SimpleObject)]
pub struct TokenUsageStats {
    pub total_input_tokens: Option<i64>,
    pub total_output_tokens: Option<i64>,
    pub total_cached_tokens: Option<i64>,
    pub total_tokens: Option<i64>,
    pub estimated_cost_usd: Option<f64>,
    pub message_count: Option<i32>,
    pub session_count: Option<i32>,
}

/// Daily token usage by model.
#[derive(Debug, Clone, SimpleObject)]
pub struct DailyModelTokens {
    pub date: Option<String>,
    pub models: Option<Vec<ModelTokenEntry>>,
    pub total_tokens: Option<i64>,
}

/// Token usage for a specific model on a given day.
#[derive(Debug, Clone, SimpleObject)]
pub struct ModelTokenEntry {
    pub model: Option<String>,
    pub display_name: Option<String>,
    pub tokens: Option<i64>,
}

/// Cumulative usage statistics for a model.
#[derive(Debug, Clone, SimpleObject)]
pub struct ModelUsageStats {
    pub model: Option<String>,
    pub display_name: Option<String>,
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_read_tokens: Option<i64>,
    pub cache_creation_tokens: Option<i64>,
    pub total_tokens: Option<i64>,
    pub cost_usd: Option<f64>,
}

// ============================================================================
// Dashboard Analytics (for dashboardAnalytics query)
// ============================================================================

/// Aggregated dashboard analytics data.
#[derive(Debug, Clone, SimpleObject)]
pub struct DashboardAnalytics {
    pub top_sessions: Option<Vec<SessionEffectiveness>>,
    pub bottom_sessions: Option<Vec<SessionEffectiveness>>,
    pub compaction_stats: Option<CompactionStats>,
    pub cost_analysis: Option<CostAnalysis>,
    pub hook_health: Option<Vec<HookHealthStats>>,
    pub subagent_usage: Option<Vec<SubagentUsageStats>>,
    pub tool_usage: Option<Vec<ToolUsageStats>>,
}

/// Composite effectiveness score for a session.
#[derive(Debug, Clone, SimpleObject)]
pub struct SessionEffectiveness {
    pub session_id: Option<String>,
    pub slug: Option<String>,
    pub summary: Option<String>,
    pub started_at: Option<String>,
    pub score: Option<f64>,
    pub sentiment_trend: Option<String>,
    pub avg_sentiment_score: Option<f64>,
    pub turn_count: Option<i32>,
    pub task_completion_rate: Option<f64>,
    pub compaction_count: Option<i32>,
    pub focus_score: Option<f64>,
}

/// Context compaction statistics.
#[derive(Debug, Clone, SimpleObject)]
pub struct CompactionStats {
    pub total_compactions: Option<i32>,
    pub sessions_with_compactions: Option<i32>,
    pub sessions_without_compactions: Option<i32>,
    pub avg_compactions_per_session: Option<f64>,
    pub auto_compact_count: Option<i32>,
    pub manual_compact_count: Option<i32>,
    pub continuation_count: Option<i32>,
}

/// Cost analysis with subscription context.
#[derive(Debug, Clone, SimpleObject)]
pub struct CostAnalysis {
    pub estimated_cost_usd: Option<f64>,
    pub is_estimated: Option<bool>,
    pub cache_hit_rate: Option<f64>,
    pub cache_savings_usd: Option<f64>,
    pub cost_per_session: Option<f64>,
    pub cost_per_completed_task: Option<f64>,
    pub max_subscription_cost_usd: Option<f64>,
    pub cost_utilization_percent: Option<f64>,
    pub break_even_daily_spend: Option<f64>,
    pub billing_type: Option<String>,
    pub daily_cost_trend: Option<Vec<DailyCost>>,
    pub weekly_cost_trend: Option<Vec<WeeklyCost>>,
    pub top_sessions_by_cost: Option<Vec<SessionCost>>,
    pub potential_savings_usd: Option<f64>,
    pub subscription_comparisons: Option<Vec<SubscriptionComparison>>,
    pub config_dir_breakdowns: Option<Vec<ConfigDirCostBreakdown>>,
}

/// Daily cost data point.
#[derive(Debug, Clone, SimpleObject)]
pub struct DailyCost {
    pub date: Option<String>,
    pub cost_usd: Option<f64>,
    pub session_count: Option<i32>,
}

/// Weekly cost data point.
#[derive(Debug, Clone, SimpleObject)]
pub struct WeeklyCost {
    pub week_start: Option<String>,
    pub week_label: Option<String>,
    pub cost_usd: Option<f64>,
    pub session_count: Option<i32>,
    pub avg_daily_cost: Option<f64>,
}

/// Session cost for top-sessions-by-cost.
#[derive(Debug, Clone, SimpleObject)]
pub struct SessionCost {
    pub session_id: Option<String>,
    pub slug: Option<String>,
    pub cost_usd: Option<f64>,
    pub input_tokens: Option<i32>,
    pub output_tokens: Option<i32>,
    pub cache_read_tokens: Option<i32>,
    pub message_count: Option<i32>,
    pub started_at: Option<String>,
}

/// Subscription tier comparison.
#[derive(Debug, Clone, SimpleObject)]
pub struct SubscriptionComparison {
    pub tier_name: Option<String>,
    pub monthly_cost_usd: Option<f64>,
    pub api_credit_cost_usd: Option<f64>,
    pub savings_usd: Option<f64>,
    pub savings_percent: Option<f64>,
    pub recommendation: Option<String>,
}

/// Per-config-dir cost breakdown.
#[derive(Debug, Clone, SimpleObject)]
pub struct ConfigDirCostBreakdown {
    pub config_dir_id: Option<String>,
    pub config_dir_name: Option<String>,
    pub estimated_cost_usd: Option<f64>,
    pub is_estimated: Option<bool>,
    pub cache_savings_usd: Option<f64>,
    pub total_sessions: Option<i32>,
    pub total_messages: Option<i32>,
    pub model_count: Option<i32>,
    pub cost_per_session: Option<f64>,
    pub cache_hit_rate: Option<f64>,
    pub potential_savings_usd: Option<f64>,
    pub cost_utilization_percent: Option<f64>,
    pub daily_cost_trend: Option<Vec<DailyCost>>,
    pub weekly_cost_trend: Option<Vec<WeeklyCost>>,
    pub subscription_comparisons: Option<Vec<SubscriptionComparison>>,
    pub break_even_daily_spend: Option<f64>,
    pub top_sessions_by_cost: Option<Vec<SessionCost>>,
}

/// Hook health and pass/fail rates.
#[derive(Debug, Clone, SimpleObject)]
pub struct HookHealthStats {
    pub hook_name: Option<String>,
    pub total_runs: Option<i32>,
    pub pass_count: Option<i32>,
    pub fail_count: Option<i32>,
    pub pass_rate: Option<f64>,
    pub avg_duration_ms: Option<f64>,
}

/// Subagent type usage statistics.
#[derive(Debug, Clone, SimpleObject)]
pub struct SubagentUsageStats {
    pub subagent_type: Option<String>,
    pub count: Option<i32>,
}

/// Tool usage frequency breakdown.
#[derive(Debug, Clone, SimpleObject)]
pub struct ToolUsageStats {
    pub tool_name: Option<String>,
    pub count: Option<i32>,
}

// ============================================================================
// Cost estimation
// ============================================================================

/// Estimate API cost from token counts using Sonnet-tier pricing (fallback).
///
/// Pricing (per million tokens, Sonnet 4 as of 2025):
///   - Input tokens:      $3.00 / 1M
///   - Output tokens:    $15.00 / 1M
///   - Cache read tokens: $0.30 / 1M
pub fn estimate_cost_usd(input_tokens: i64, output_tokens: i64, cache_read_tokens: i64) -> f64 {
    const INPUT_PRICE_PER_M: f64 = 3.0;
    const OUTPUT_PRICE_PER_M: f64 = 15.0;
    const CACHE_READ_PRICE_PER_M: f64 = 0.30;

    (input_tokens as f64 * INPUT_PRICE_PER_M
        + output_tokens as f64 * OUTPUT_PRICE_PER_M
        + cache_read_tokens as f64 * CACHE_READ_PRICE_PER_M)
        / 1_000_000.0
}

// ============================================================================
// Per-model cost estimation
// ============================================================================

/// Per-model pricing (per 1M tokens).
struct ModelPricing {
    input: f64,
    output: f64,
    cache_read: f64,
    cache_creation: f64,
}

/// Get pricing for a model ID. Falls back to Sonnet pricing for unknown models.
fn pricing_for_model(model_id: &str) -> ModelPricing {
    if model_id.contains("opus") {
        ModelPricing { input: 15.0, output: 75.0, cache_read: 1.50, cache_creation: 18.75 }
    } else if model_id.contains("haiku") {
        ModelPricing { input: 0.80, output: 4.0, cache_read: 0.08, cache_creation: 1.0 }
    } else {
        // Sonnet or unknown
        ModelPricing { input: 3.0, output: 15.0, cache_read: 0.30, cache_creation: 3.75 }
    }
}

/// Estimate cost for a specific model with all four token types.
pub fn estimate_cost_for_model(
    model_id: &str,
    input: i64,
    output: i64,
    cache_read: i64,
    cache_creation: i64,
) -> f64 {
    let p = pricing_for_model(model_id);
    (input as f64 * p.input
        + output as f64 * p.output
        + cache_read as f64 * p.cache_read
        + cache_creation as f64 * p.cache_creation)
        / 1_000_000.0
}

/// Get a human-friendly display name for a model ID.
pub fn model_display_name(model_id: &str) -> String {
    if model_id.contains("opus-4-6") {
        "Opus 4.6".to_string()
    } else if model_id.contains("opus-4-5") || model_id.contains("opus-4") {
        "Opus 4.5".to_string()
    } else if model_id.contains("sonnet-4-6") {
        "Sonnet 4.6".to_string()
    } else if model_id.contains("sonnet-4-5") || model_id.contains("sonnet-4") {
        "Sonnet 4.5".to_string()
    } else if model_id.contains("haiku-4-5") || model_id.contains("haiku-4") {
        "Haiku 4.5".to_string()
    } else {
        model_id.to_string()
    }
}

// ============================================================================
// Stats-cache.json deserialization
// ============================================================================

/// Root structure of ~/.claude/stats-cache.json.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsCache {
    pub model_usage: Option<HashMap<String, StatsCacheModelUsage>>,
    pub daily_model_tokens: Option<Vec<StatsCacheDailyEntry>>,
}

/// Per-model cumulative usage from stats-cache.json.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsCacheModelUsage {
    pub input_tokens: Option<i64>,
    pub output_tokens: Option<i64>,
    pub cache_read_input_tokens: Option<i64>,
    pub cache_creation_input_tokens: Option<i64>,
}

/// Daily token entry from stats-cache.json.
#[derive(Debug, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct StatsCacheDailyEntry {
    pub date: String,
    pub tokens_by_model: Option<HashMap<String, i64>>,
}

// ============================================================================
// Default constructors for stubs
// ============================================================================

impl Default for ActivityData {
    fn default() -> Self {
        Self {
            daily_activity: Some(vec![]),
            hourly_activity: Some((0..24).map(|h| HourlyActivity {
                hour: Some(h),
                session_count: Some(0),
                message_count: Some(0),
            }).collect()),
            token_usage: None,
            daily_model_tokens: Some(vec![]),
            model_usage: Some(vec![]),
            total_sessions: Some(0),
            total_messages: Some(0),
            streak_days: Some(0),
            total_active_days: Some(0),
            first_session_date: None,
        }
    }
}

impl Default for DashboardAnalytics {
    fn default() -> Self {
        Self {
            top_sessions: Some(vec![]),
            bottom_sessions: Some(vec![]),
            compaction_stats: None,
            cost_analysis: None,
            hook_health: Some(vec![]),
            subagent_usage: Some(vec![]),
            tool_usage: Some(vec![]),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

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
    fn activity_data_default() {
        let ad = ActivityData::default();
        assert_eq!(ad.total_sessions, Some(0));
        assert_eq!(ad.total_messages, Some(0));
    }

    #[test]
    fn dashboard_analytics_default() {
        let da = DashboardAnalytics::default();
        assert!(da.top_sessions.unwrap().is_empty());
        assert!(da.tool_usage.unwrap().is_empty());
    }

    #[test]
    fn estimate_cost_usd_zero_tokens() {
        assert_eq!(estimate_cost_usd(0, 0, 0), 0.0);
    }

    #[test]
    fn estimate_cost_usd_one_million_input() {
        let cost = estimate_cost_usd(1_000_000, 0, 0);
        assert!((cost - 3.0).abs() < 0.001);
    }

    #[test]
    fn estimate_cost_usd_one_million_output() {
        let cost = estimate_cost_usd(0, 1_000_000, 0);
        assert!((cost - 15.0).abs() < 0.001);
    }

    #[test]
    fn estimate_cost_usd_one_million_cache_read() {
        let cost = estimate_cost_usd(0, 0, 1_000_000);
        assert!((cost - 0.30).abs() < 0.001);
    }

    #[test]
    fn estimate_cost_usd_mixed() {
        // 10M input + 5M output + 20M cache = $30 + $75 + $6 = $111
        let cost = estimate_cost_usd(10_000_000, 5_000_000, 20_000_000);
        assert!((cost - 111.0).abs() < 0.01);
    }
}
