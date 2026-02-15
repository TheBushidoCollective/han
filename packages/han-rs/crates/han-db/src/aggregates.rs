//! Dashboard aggregate queries.
//!
//! These use raw SQL since they are too complex for the SeaORM query builder.

use crate::error::{DbError, DbResult};
use sea_orm::{ConnectionTrait, DatabaseConnection, Statement, Value};
use serde::{Deserialize, Serialize};

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ToolUsageRow {
    pub tool_name: String,
    pub count: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SubagentUsageRow {
    pub subagent_type: String,
    pub count: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DailyCostRow {
    pub date: String,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub session_count: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionStatsRow {
    pub session_id: String,
    pub slug: Option<String>,
    pub summary: Option<String>,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub turn_count: i64,
    pub unique_tools: i64,
    pub started_at: Option<String>,
    pub message_count: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionSentimentRow {
    pub session_id: String,
    pub avg_sentiment: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookHealthRow {
    pub hook_name: String,
    pub total_runs: i64,
    pub pass_count: i64,
    pub fail_count: i64,
    pub avg_duration_ms: f64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionCompactionRow {
    pub session_id: String,
    pub compaction_count: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DashboardAggregates {
    pub tool_usage: Vec<ToolUsageRow>,
    pub subagent_usage: Vec<SubagentUsageRow>,
    pub total_input_tokens: i64,
    pub total_output_tokens: i64,
    pub total_cache_read_tokens: i64,
    pub total_sessions: i64,
    pub total_messages: i64,
    pub daily_costs: Vec<DailyCostRow>,
    pub session_stats: Vec<SessionStatsRow>,
    pub total_compactions: i64,
    pub total_compaction_sessions: i64,
    pub session_compactions: Vec<SessionCompactionRow>,
    pub session_sentiments: Vec<SessionSentimentRow>,
    pub hook_health: Vec<HookHealthRow>,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct DailyActivityRow {
    pub date: String,
    pub message_count: i64,
    pub session_count: i64,
    pub input_tokens: i64,
    pub output_tokens: i64,
    pub cache_read_tokens: i64,
    pub lines_added: i64,
    pub lines_removed: i64,
    pub files_changed: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HourlyActivityRow {
    pub hour: i32,
    pub message_count: i64,
    pub session_count: i64,
}

#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ActivityAggregates {
    pub daily_activity: Vec<DailyActivityRow>,
    pub hourly_activity: Vec<HourlyActivityRow>,
    pub total_input_tokens: i64,
    pub total_output_tokens: i64,
    pub total_cache_read_tokens: i64,
    pub total_messages: i64,
    pub total_sessions: i64,
}

/// Query dashboard aggregates using raw SQL.
pub async fn query_dashboard_aggregates(
    db: &DatabaseConnection,
    cutoff_date: &str,
) -> DbResult<DashboardAggregates> {
    let backend = db.get_database_backend();

    // 1. Tool usage (top 20)
    let tool_usage = {
        let sql = "SELECT tool_name, COUNT(*) as cnt FROM messages WHERE tool_name IS NOT NULL AND timestamp > ?1 GROUP BY tool_name ORDER BY cnt DESC LIMIT 20";
        let rows = db.query_all(Statement::from_sql_and_values(backend, sql, vec![Value::String(Some(Box::new(cutoff_date.to_string())))]))
            .await.map_err(DbError::Database)?;
        rows.iter().filter_map(|r| {
            Some(ToolUsageRow {
                tool_name: r.try_get::<String>("", "tool_name").ok()?,
                count: r.try_get::<i64>("", "cnt").ok()?,
            })
        }).collect()
    };

    // 2. Token totals
    let (total_input_tokens, total_output_tokens, total_cache_read_tokens, total_sessions, total_messages) = {
        let sql = "SELECT COALESCE(SUM(input_tokens), 0), COALESCE(SUM(output_tokens), 0), COALESCE(SUM(cache_read_tokens), 0), COUNT(DISTINCT session_id), COUNT(*) FROM messages WHERE message_type = 'assistant' AND timestamp > ?1";
        let row = db.query_one(Statement::from_sql_and_values(backend, sql, vec![Value::String(Some(Box::new(cutoff_date.to_string())))]))
            .await.map_err(DbError::Database)?;
        match row {
            Some(r) => (
                r.try_get::<i64>("", "COALESCE(SUM(input_tokens), 0)").unwrap_or(0),
                r.try_get::<i64>("", "COALESCE(SUM(output_tokens), 0)").unwrap_or(0),
                r.try_get::<i64>("", "COALESCE(SUM(cache_read_tokens), 0)").unwrap_or(0),
                r.try_get::<i64>("", "COUNT(DISTINCT session_id)").unwrap_or(0),
                r.try_get::<i64>("", "COUNT(*)").unwrap_or(0),
            ),
            None => (0, 0, 0, 0, 0),
        }
    };

    // 3. Daily costs
    let daily_costs = {
        let sql = "SELECT date(timestamp) as d, COALESCE(SUM(input_tokens), 0) as it, COALESCE(SUM(output_tokens), 0) as ot, COALESCE(SUM(cache_read_tokens), 0) as crt, COUNT(DISTINCT session_id) as sc FROM messages WHERE message_type = 'assistant' AND timestamp > ?1 GROUP BY d ORDER BY d";
        let rows = db.query_all(Statement::from_sql_and_values(backend, sql, vec![Value::String(Some(Box::new(cutoff_date.to_string())))]))
            .await.map_err(DbError::Database)?;
        rows.iter().filter_map(|r| {
            Some(DailyCostRow {
                date: r.try_get::<String>("", "d").ok()?,
                input_tokens: r.try_get::<i64>("", "it").ok()?,
                output_tokens: r.try_get::<i64>("", "ot").ok()?,
                cache_read_tokens: r.try_get::<i64>("", "crt").ok()?,
                session_count: r.try_get::<i64>("", "sc").ok()?,
            })
        }).collect()
    };

    // 4. Hook health
    let hook_health = {
        let sql = "SELECT hook_name, COUNT(*) as total_runs, SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as pass_count, SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as fail_count, AVG(duration_ms) as avg_duration_ms FROM hook_executions WHERE executed_at > ?1 GROUP BY hook_name ORDER BY total_runs DESC LIMIT 20";
        let rows = db.query_all(Statement::from_sql_and_values(backend, sql, vec![Value::String(Some(Box::new(cutoff_date.to_string())))]))
            .await.map_err(DbError::Database)?;
        rows.iter().filter_map(|r| {
            Some(HookHealthRow {
                hook_name: r.try_get::<String>("", "hook_name").ok()?,
                total_runs: r.try_get::<i64>("", "total_runs").ok()?,
                pass_count: r.try_get::<i64>("", "pass_count").ok()?,
                fail_count: r.try_get::<i64>("", "fail_count").ok()?,
                avg_duration_ms: r.try_get::<f64>("", "avg_duration_ms").ok()?,
            })
        }).collect()
    };

    Ok(DashboardAggregates {
        tool_usage,
        subagent_usage: vec![],
        total_input_tokens,
        total_output_tokens,
        total_cache_read_tokens,
        total_sessions,
        total_messages,
        daily_costs,
        session_stats: vec![],
        total_compactions: 0,
        total_compaction_sessions: 0,
        session_compactions: vec![],
        session_sentiments: vec![],
        hook_health,
    })
}

/// Query activity aggregates using raw SQL.
pub async fn query_activity_aggregates(
    db: &DatabaseConnection,
    cutoff_date: &str,
) -> DbResult<ActivityAggregates> {
    let backend = db.get_database_backend();

    // Daily activity
    let daily_activity = {
        let sql = "SELECT date(timestamp) as d, COUNT(*) as mc, COUNT(DISTINCT session_id) as sc, COALESCE(SUM(input_tokens), 0) as it, COALESCE(SUM(output_tokens), 0) as ot, COALESCE(SUM(cache_read_tokens), 0) as crt, COALESCE(SUM(lines_added), 0) as la, COALESCE(SUM(lines_removed), 0) as lr, COALESCE(SUM(files_changed), 0) as fc FROM messages WHERE timestamp > ?1 GROUP BY d ORDER BY d";
        let rows = db.query_all(Statement::from_sql_and_values(backend, sql, vec![Value::String(Some(Box::new(cutoff_date.to_string())))]))
            .await.map_err(DbError::Database)?;
        rows.iter().filter_map(|r| {
            Some(DailyActivityRow {
                date: r.try_get::<String>("", "d").ok()?,
                message_count: r.try_get::<i64>("", "mc").ok()?,
                session_count: r.try_get::<i64>("", "sc").ok()?,
                input_tokens: r.try_get::<i64>("", "it").ok()?,
                output_tokens: r.try_get::<i64>("", "ot").ok()?,
                cache_read_tokens: r.try_get::<i64>("", "crt").ok()?,
                lines_added: r.try_get::<i64>("", "la").ok()?,
                lines_removed: r.try_get::<i64>("", "lr").ok()?,
                files_changed: r.try_get::<i64>("", "fc").ok()?,
            })
        }).collect()
    };

    // Hourly activity
    let hourly_activity = {
        let sql = "SELECT CAST(strftime('%H', timestamp) AS INTEGER) as h, COUNT(*) as mc, COUNT(DISTINCT session_id) as sc FROM messages WHERE timestamp > ?1 GROUP BY h ORDER BY h";
        let rows = db.query_all(Statement::from_sql_and_values(backend, sql, vec![Value::String(Some(Box::new(cutoff_date.to_string())))]))
            .await.map_err(DbError::Database)?;
        rows.iter().filter_map(|r| {
            Some(HourlyActivityRow {
                hour: r.try_get::<i32>("", "h").ok()?,
                message_count: r.try_get::<i64>("", "mc").ok()?,
                session_count: r.try_get::<i64>("", "sc").ok()?,
            })
        }).collect()
    };

    // Totals
    let (total_input_tokens, total_output_tokens, total_cache_read_tokens, total_messages, total_sessions) = {
        let sql = "SELECT COALESCE(SUM(input_tokens), 0) as it, COALESCE(SUM(output_tokens), 0) as ot, COALESCE(SUM(cache_read_tokens), 0) as crt, COUNT(*) as mc, COUNT(DISTINCT session_id) as sc FROM messages WHERE timestamp > ?1";
        let row = db.query_one(Statement::from_sql_and_values(backend, sql, vec![Value::String(Some(Box::new(cutoff_date.to_string())))]))
            .await.map_err(DbError::Database)?;
        match row {
            Some(r) => (
                r.try_get::<i64>("", "it").unwrap_or(0),
                r.try_get::<i64>("", "ot").unwrap_or(0),
                r.try_get::<i64>("", "crt").unwrap_or(0),
                r.try_get::<i64>("", "mc").unwrap_or(0),
                r.try_get::<i64>("", "sc").unwrap_or(0),
            ),
            None => (0, 0, 0, 0, 0),
        }
    };

    Ok(ActivityAggregates {
        daily_activity,
        hourly_activity,
        total_input_tokens,
        total_output_tokens,
        total_cache_read_tokens,
        total_messages,
        total_sessions,
    })
}
