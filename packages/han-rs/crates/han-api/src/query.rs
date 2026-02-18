//! GraphQL Query root.
//!
//! All top-level queries. Uses Relay Node interface - no viewer pattern.

use std::collections::HashMap;

use async_graphql::*;
use sea_orm::{
    ConnectionTrait, DatabaseConnection, DbBackend, EntityTrait, FromQueryResult,
    QueryOrder, ColumnTrait, QueryFilter, Statement,
};

use han_db::entities::{config_dirs, projects, repos, sessions};

use crate::node::decode_global_id;
use crate::types::config_dir::ConfigDir;
use crate::types::dashboard::{
    ActivityData, CostAnalysis, CoordinatorStatus, DailyActivity, DailyCost,
    DailyModelTokens, DashboardAnalytics, HookHealthStats, HourlyActivity,
    ModelTokenEntry, ModelUsageStats, StatsCache, TokenUsageStats,
    ToolUsageStats, estimate_cost_for_model, estimate_cost_usd,
    model_display_name,
};
use crate::types::enums::MetricsPeriod;
use crate::types::metrics::MetricsData;
use crate::types::plugin::{Plugin, PluginCategory, PluginStats};
use crate::types::project::Project;
use crate::types::repo::Repo;
use crate::types::sessions::{SessionConnection, SessionData, build_session_connection};

// ============================================================================
// Raw query result types for enrichment
// ============================================================================

#[derive(Debug, FromQueryResult)]
struct SessionMsgStats {
    session_id: String,
    msg_count: i64,
    started_at: Option<String>,
    updated_at: Option<String>,
}

#[derive(Debug, FromQueryResult)]
struct SessionSummaryRow {
    session_id: String,
    content: Option<String>,
}

#[derive(Debug, FromQueryResult)]
struct DailyActivityRow {
    date: String,
    session_count: i64,
    message_count: i64,
    input_tokens: i64,
    output_tokens: i64,
    cached_tokens: i64,
    lines_added: i64,
    lines_removed: i64,
    files_changed: i64,
}

#[derive(Debug, FromQueryResult)]
struct HourlyActivityRow {
    hour: i32,
    session_count: i64,
    message_count: i64,
}

#[derive(Debug, FromQueryResult)]
struct TokenStatsRow {
    message_count: i64,
    session_count: i64,
    total_input_tokens: i64,
    total_output_tokens: i64,
    total_cached_tokens: i64,
}

#[derive(Debug, FromQueryResult)]
struct CountRow {
    count: i64,
}

/// Enrich session data with message counts, timestamps, project info, and summaries.
pub async fn enrich_sessions(db: &DatabaseConnection, sessions: &mut [SessionData]) -> Result<()> {
    if sessions.is_empty() {
        return Ok(());
    }

    let session_ids: Vec<String> = sessions.iter().map(|s| s.session_id.clone()).collect();

    // 1. Get message stats per session
    let placeholders = vec!["?"; session_ids.len()].join(",");
    let values: Vec<sea_orm::Value> = session_ids.iter().map(|id| id.clone().into()).collect();

    let stats = SessionMsgStats::find_by_statement(Statement::from_sql_and_values(
        DbBackend::Sqlite,
        format!(
            "SELECT session_id, COUNT(*) as msg_count, MIN(timestamp) as started_at, MAX(timestamp) as updated_at \
             FROM messages WHERE session_id IN ({placeholders}) GROUP BY session_id"
        ),
        values.clone(),
    ))
    .all(db)
    .await
    .map_err(|e| Error::new(e.to_string()))?;

    let stats_map: HashMap<String, &SessionMsgStats> =
        stats.iter().map(|s| (s.session_id.clone(), s)).collect();

    // 2. Get project info
    let project_ids: Vec<String> = sessions
        .iter()
        .filter_map(|s| s.project_id.clone())
        .collect::<std::collections::HashSet<_>>()
        .into_iter()
        .collect();

    let project_map: HashMap<String, projects::Model> = if !project_ids.is_empty() {
        projects::Entity::find()
            .filter(projects::Column::Id.is_in(project_ids))
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?
            .into_iter()
            .map(|p| (p.id.clone(), p))
            .collect()
    } else {
        HashMap::new()
    };

    // 3. Get first user message per session as summary
    let summaries = SessionSummaryRow::find_by_statement(Statement::from_sql_and_values(
        DbBackend::Sqlite,
        format!(
            "SELECT session_id, content FROM (\
                SELECT session_id, content, ROW_NUMBER() OVER (PARTITION BY session_id ORDER BY timestamp ASC) as rn \
                FROM messages WHERE role = 'user' AND session_id IN ({placeholders})\
            ) WHERE rn = 1"
        ),
        values,
    ))
    .all(db)
    .await
    .unwrap_or_default();

    let summary_map: HashMap<String, String> = summaries
        .into_iter()
        .filter_map(|s| s.content.map(|c| (s.session_id, c)))
        .collect();

    // 4. Enrich each session
    for session in sessions.iter_mut() {
        if let Some(stat) = stats_map.get(&session.session_id) {
            session.message_count = stat.msg_count as i32;
            session.started_at = stat.started_at.clone();
            session.updated_at = stat.updated_at.clone();
            session.date = stat
                .started_at
                .as_deref()
                .and_then(|ts| ts.split('T').next())
                .unwrap_or("")
                .to_string();
        }
        if let Some(project) = session
            .project_id
            .as_ref()
            .and_then(|pid| project_map.get(pid))
        {
            session.project_name.clone_from(&project.name);
            session.project_path.clone_from(&project.path);
            session.project_dir.clone_from(&project.path);
        }
        if let Some(summary) = summary_map.get(&session.session_id) {
            session.summary = Some(if summary.len() > 200 {
                format!("{}...", &summary[..200])
            } else {
                summary.clone()
            });
        }
    }

    Ok(())
}

/// Enrich a single session with project info, message stats, and summary.
pub async fn enrich_single_session(db: &DatabaseConnection, session: &mut SessionData) -> Result<()> {
    enrich_sessions(db, std::slice::from_mut(session)).await
}

/// Query root type.
pub struct QueryRoot;

#[Object(name = "Query")]
impl QueryRoot {
    /// Fetch any node by its global ID (Relay Node interface).
    async fn node(&self, ctx: &Context<'_>, id: ID) -> Result<Option<crate::types::node::Node>> {
        let parsed = decode_global_id(id.as_str())
            .ok_or_else(|| Error::new(format!("Invalid global ID format: {}", id.as_str())))?;
        let typename = parsed.typename;
        let raw_id = parsed.id;
        let db = ctx.data::<DatabaseConnection>()?;
        match typename.as_str() {
            "Session" => {
                // Session global IDs may be composite: "{project_dir}:{session_id}"
                // or just "{session_id}". The DB key is the raw session UUID.
                // Try raw_id first, then extract the part after the last colon.
                let model = sessions::Entity::find_by_id(&raw_id)
                    .one(db)
                    .await
                    .map_err(|e| Error::new(e.to_string()))?;
                let model = match model {
                    Some(m) => Some(m),
                    None => {
                        // raw_id is likely "{project_dir}:{session_id}" — extract session_id
                        if let Some(session_id) = raw_id.rsplit_once(':').map(|(_, id)| id) {
                            sessions::Entity::find_by_id(session_id)
                                .one(db)
                                .await
                                .map_err(|e| Error::new(e.to_string()))?
                        } else {
                            None
                        }
                    }
                };
                match model {
                    Some(m) => {
                        let mut sessions = vec![session_model_to_data(m)];
                        enrich_sessions(db, &mut sessions).await?;
                        Ok(sessions.into_iter().next().map(crate::types::node::Node::Session))
                    }
                    None => Ok(None),
                }
            }
            "Repo" => {
                let model = repos::Entity::find_by_id(&raw_id).one(db).await
                    .map_err(|e| Error::new(e.to_string()))?;
                Ok(model.map(|m| crate::types::node::Node::Repo(Repo::from(m))))
            }
            "Project" => {
                let model = projects::Entity::find_by_id(&raw_id).one(db).await
                    .map_err(|e| Error::new(e.to_string()))?;
                Ok(model.map(|m| crate::types::node::Node::Project(Project::from(m))))
            }
            _ => Ok(None)
        }
    }

    /// Fetch a single message by ID (browse-client compat).
    async fn message(&self, _id: String) -> Option<crate::types::messages::Message> {
        // Stub: message lookup by ID not yet implemented
        None
    }

    /// Memory query interface (stub for browse-client compat).
    async fn memory(&self) -> Option<crate::types::settings::MemoryQueryType> {
        Some(crate::types::settings::MemoryQueryType)
    }

    /// Settings summary with all configuration locations.
    async fn settings(
        &self,
        _project_id: Option<String>,
    ) -> Option<crate::types::settings::SettingsSummary> {
        Some(crate::types::settings::SettingsSummary {
            claude_settings_files: Some(vec![]),
            han_config_files: Some(vec![]),
            claude_settings: None,
            han_config: None,
            mcp_servers: Some(vec![]),
            permissions: None,
        })
    }

    /// All cache entries for the current project (stub).
    async fn cache_entries(&self) -> Option<Vec<crate::types::settings::CacheEntry>> {
        Some(vec![])
    }

    /// Aggregate cache statistics (stub).
    async fn cache_stats(&self) -> Option<crate::types::settings::CacheStats> {
        Some(crate::types::settings::CacheStats {
            total_entries: Some(0),
            total_files: Some(0),
            oldest_entry: None,
            newest_entry: None,
        })
    }

    /// All projects with sessions.
    async fn projects(&self, ctx: &Context<'_>, first: Option<i32>) -> Result<Vec<Project>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let limit = first.unwrap_or(20) as u64;
        let models = projects::Entity::find()
            .order_by_desc(projects::Column::UpdatedAt)
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        Ok(models.into_iter().take(limit as usize).map(Project::from).collect())
    }

    /// Get a project by ID.
    async fn project(&self, ctx: &Context<'_>, id: String) -> Result<Option<Project>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let model = projects::Entity::find_by_id(&id)
            .one(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;
        Ok(model.map(Project::from))
    }

    /// All git repositories with sessions.
    async fn repos(&self, ctx: &Context<'_>, first: Option<i32>) -> Result<Vec<Repo>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let limit = first.unwrap_or(20) as u64;
        let models = repos::Entity::find()
            .order_by_desc(repos::Column::UpdatedAt)
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        Ok(models.into_iter().take(limit as usize).map(Repo::from).collect())
    }

    /// Get a repo by its repoId.
    async fn repo(&self, ctx: &Context<'_>, id: String) -> Result<Option<Repo>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let model = repos::Entity::find_by_id(&id)
            .one(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;
        Ok(model.map(Repo::from))
    }

    /// All registered config directories.
    async fn config_dirs(&self, ctx: &Context<'_>) -> Result<Vec<ConfigDir>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let models = config_dirs::Entity::find()
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;
        Ok(models.into_iter().map(ConfigDir::from).collect())
    }

    /// Get a session by ID.
    async fn session(&self, ctx: &Context<'_>, id: String) -> Result<Option<SessionData>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let model = sessions::Entity::find_by_id(&id)
            .one(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;
        match model {
            Some(m) => {
                let mut sessions = vec![session_model_to_data(m)];
                enrich_sessions(db, &mut sessions).await?;
                Ok(sessions.into_iter().next())
            }
            None => Ok(None),
        }
    }

    /// Get sessions with cursor-based pagination.
    async fn sessions(
        &self,
        ctx: &Context<'_>,
        first: Option<i32>,
        after: Option<String>,
        last: Option<i32>,
        before: Option<String>,
        project_id: Option<String>,
        _worktree_name: Option<String>,
        _user_id: Option<String>,
    ) -> Result<SessionConnection> {
        let db = ctx.data::<DatabaseConnection>()?;

        // Get total count efficiently
        let count_sql = if let Some(ref pid) = project_id {
            format!("SELECT COUNT(*) as count FROM sessions WHERE project_id = '{}'", pid.replace('\'', "''"))
        } else {
            "SELECT COUNT(*) as count FROM sessions".to_string()
        };
        let total_count = CountRow::find_by_statement(Statement::from_string(
            DbBackend::Sqlite, count_sql,
        ))
        .one(db)
        .await
        .map(|r| r.map(|r| r.count as i32).unwrap_or(0))
        .unwrap_or(0);

        // Fetch only the page we need, sorted by most recent message timestamp
        let page_size = first.or(last).unwrap_or(20) as i64;
        let (page_sql, values) = if let Some(ref pid) = project_id {
            (
                "SELECT s.* FROM sessions s \
                 LEFT JOIN (SELECT session_id, MAX(timestamp) as last_msg FROM messages GROUP BY session_id) m \
                 ON s.id = m.session_id \
                 WHERE s.project_id = ? \
                 ORDER BY COALESCE(m.last_msg, '') DESC \
                 LIMIT ?".to_string(),
                vec![pid.clone().into(), page_size.into()],
            )
        } else {
            (
                "SELECT s.* FROM sessions s \
                 LEFT JOIN (SELECT session_id, MAX(timestamp) as last_msg FROM messages GROUP BY session_id) m \
                 ON s.id = m.session_id \
                 ORDER BY COALESCE(m.last_msg, '') DESC \
                 LIMIT ?".to_string(),
                vec![page_size.into()],
            )
        };

        let models = sessions::Entity::find()
            .from_raw_sql(Statement::from_sql_and_values(DbBackend::Sqlite, page_sql, values))
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        let mut session_data: Vec<SessionData> =
            models.into_iter().map(session_model_to_data).collect();
        enrich_sessions(db, &mut session_data).await?;

        // Sort by most recent activity (updated_at DESC), sessions without messages last
        session_data.sort_by(|a, b| {
            let a_ts = a.updated_at.as_deref().unwrap_or("");
            let b_ts = b.updated_at.as_deref().unwrap_or("");
            b_ts.cmp(a_ts)
        });

        // Build connection with the real total count
        let mut conn = build_session_connection(session_data, None, after, last, before);
        conn.total_count = total_count;
        if first.is_some() {
            conn.page_info.has_next_page = (page_size as i32) < total_count;
        }
        Ok(conn)
    }

    /// Coordinator status for version checking.
    async fn coordinator_status(&self, _client_version: Option<String>) -> CoordinatorStatus {
        CoordinatorStatus {
            version: env!("CARGO_PKG_VERSION").to_string(),
            needs_restart: false,
        }
    }

    /// Team-level aggregate metrics for dashboard.
    async fn team_metrics(
        &self,
        ctx: &Context<'_>,
        _start_date: Option<String>,
        _end_date: Option<String>,
        _granularity: Option<crate::types::enums::Granularity>,
        _project_ids: Option<Vec<String>>,
    ) -> Result<Option<crate::types::team::TeamMetrics>> {
        let db = ctx.data::<DatabaseConnection>()?;

        // Use pre-aggregated global_aggregates (instant vs scanning 1M+ messages)
        let row = db
            .query_one(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT total_sessions, total_tasks, \
                 total_input_tokens, total_output_tokens, total_cache_read_tokens, \
                 (total_input_tokens + total_output_tokens + total_cache_read_tokens) as total_tokens \
                 FROM global_aggregates WHERE id = 1"
                    .to_string(),
            ))
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        let (total_sessions, total_tasks, total_tokens, cost) = row
            .map(|r| {
                let s: i64 = r.try_get("", "total_sessions").unwrap_or(0);
                let t: i64 = r.try_get("", "total_tasks").unwrap_or(0);
                let tok: i64 = r.try_get("", "total_tokens").unwrap_or(0);
                let inp: i64 = r.try_get("", "total_input_tokens").unwrap_or(0);
                let out: i64 = r.try_get("", "total_output_tokens").unwrap_or(0);
                let cache: i64 = r.try_get("", "total_cache_read_tokens").unwrap_or(0);
                (s as i32, t as i32, tok, estimate_cost_usd(inp, out, cache))
            })
            .unwrap_or((0, 0, 0, 0.0));

        Ok(Some(crate::types::team::TeamMetrics {
            total_sessions: Some(total_sessions),
            total_tasks: Some(total_tasks),
            total_tokens: Some(total_tokens),
            estimated_cost_usd: Some(cost),
            sessions_by_period: Some(vec![]),
            sessions_by_project: Some(vec![]),
            top_contributors: Some(vec![]),
            activity_timeline: Some(vec![]),
            token_usage_aggregation: None,
            task_completion_metrics: None,
        }))
    }

    // ========================================================================
    // Stub query fields for browse-client backwards compatibility
    // ========================================================================

    /// Task metrics for a time period.
    async fn metrics(&self, ctx: &Context<'_>, _period: Option<MetricsPeriod>) -> Result<Option<MetricsData>> {
        let db = ctx.data::<DatabaseConnection>()?;

        // Use pre-aggregated global_aggregates
        let task_counts = db
            .query_one(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT total_tasks as total, total_completed_tasks as completed \
                 FROM global_aggregates WHERE id = 1"
                    .to_string(),
            ))
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        let (total, completed) = task_counts
            .map(|r| {
                let t: i64 = r.try_get("", "total").unwrap_or(0);
                let c: i64 = r.try_get("", "completed").unwrap_or(0);
                (t as i32, c as i32)
            })
            .unwrap_or((0, 0));

        let success_rate = if total > 0 {
            completed as f64 / total as f64
        } else {
            0.0
        };

        Ok(Some(MetricsData {
            total_tasks: Some(total),
            completed_tasks: Some(completed),
            success_rate: Some(success_rate),
            average_confidence: None,
            average_duration: None,
            calibration_score: None,
            significant_frustrations: Some(0),
            significant_frustration_rate: Some(0.0),
            tasks_by_type: Some(vec![]),
            tasks_by_outcome: Some(vec![]),
        }))
    }

    /// Installed plugins, optionally filtered by scope.
    async fn plugins(&self, _scope: Option<crate::types::enums::PluginScope>) -> Option<Vec<Plugin>> {
        Some(vec![])
    }

    /// Aggregate plugin statistics.
    async fn plugin_stats(&self) -> Option<PluginStats> {
        Some(PluginStats {
            total_plugins: Some(0),
            user_plugins: Some(0),
            project_plugins: Some(0),
            local_plugins: Some(0),
            enabled_plugins: Some(0),
        })
    }

    /// Plugin counts by category.
    async fn plugin_categories(&self) -> Option<Vec<PluginCategory>> {
        Some(vec![])
    }

    /// Activity data for dashboard visualizations.
    async fn activity(&self, ctx: &Context<'_>, days: Option<i32>) -> Result<Option<ActivityData>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let days = days.unwrap_or(30);

        // Use pre-aggregated daily_aggregates table (instant reads vs scanning 1M+ messages)
        let daily_rows = DailyActivityRow::find_by_statement(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            "SELECT date, session_count, message_count, input_tokens, output_tokens, \
             cache_read_tokens as cached_tokens, lines_added, lines_removed, files_changed \
             FROM daily_aggregates \
             WHERE date >= date('now', ? || ' days') \
             ORDER BY date ASC",
            vec![format!("-{days}").into()],
        ))
        .all(db)
        .await
        .map_err(|e| Error::new(e.to_string()))?;

        let daily_activity: Vec<DailyActivity> = daily_rows
            .iter()
            .map(|r| DailyActivity {
                date: Some(r.date.clone()),
                session_count: Some(r.session_count as i32),
                message_count: Some(r.message_count as i32),
                input_tokens: Some(r.input_tokens),
                output_tokens: Some(r.output_tokens),
                cached_tokens: Some(r.cached_tokens),
                lines_added: Some(r.lines_added as i32),
                lines_removed: Some(r.lines_removed as i32),
                files_changed: Some(r.files_changed as i32),
            })
            .collect();

        // Use pre-aggregated hourly_aggregates table
        let hourly_rows = HourlyActivityRow::find_by_statement(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT hour, session_count, message_count FROM hourly_aggregates ORDER BY hour"
                .to_string(),
        ))
        .all(db)
        .await
        .map_err(|e| Error::new(e.to_string()))?;

        let mut hourly_map: HashMap<i32, (i64, i64)> = HashMap::new();
        for r in hourly_rows {
            hourly_map.insert(r.hour, (r.session_count, r.message_count));
        }
        let hourly_activity: Vec<HourlyActivity> = (0..24)
            .map(|h| {
                let (sc, mc) = hourly_map.get(&h).copied().unwrap_or((0, 0));
                HourlyActivity {
                    hour: Some(h),
                    session_count: Some(sc as i32),
                    message_count: Some(mc as i32),
                }
            })
            .collect();

        // Use pre-aggregated global_aggregates for token totals
        #[derive(Debug, FromQueryResult)]
        struct GlobalAgg {
            total_sessions: i64,
            total_messages: i64,
            total_input_tokens: i64,
            total_output_tokens: i64,
            total_cache_read_tokens: i64,
        }
        let globals = GlobalAgg::find_by_statement(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT total_sessions, total_messages, total_input_tokens, \
             total_output_tokens, total_cache_read_tokens \
             FROM global_aggregates WHERE id = 1"
                .to_string(),
        ))
        .one(db)
        .await
        .map_err(|e| Error::new(e.to_string()))?;

        let (total_sessions, total_messages, token_usage) = match globals {
            Some(g) => (
                g.total_sessions as i32,
                g.total_messages as i32,
                Some(TokenUsageStats {
                    total_input_tokens: Some(g.total_input_tokens),
                    total_output_tokens: Some(g.total_output_tokens),
                    total_cached_tokens: Some(g.total_cache_read_tokens),
                    total_tokens: Some(
                        g.total_input_tokens + g.total_output_tokens + g.total_cache_read_tokens,
                    ),
                    estimated_cost_usd: Some(estimate_cost_usd(
                        g.total_input_tokens,
                        g.total_output_tokens,
                        g.total_cache_read_tokens,
                    )),
                    message_count: Some(g.total_messages as i32),
                    session_count: Some(g.total_sessions as i32),
                }),
            ),
            None => (0, 0, None),
        };

        let total_active_days = daily_activity.len() as i32;
        let first_session_date = daily_activity.first().and_then(|d| d.date.clone());

        // Load per-model data from Claude Code's stats-cache.json
        let (model_usage, daily_model_tokens) = load_stats_cache_model_data();

        Ok(Some(ActivityData {
            daily_activity: Some(daily_activity),
            hourly_activity: Some(hourly_activity),
            token_usage,
            daily_model_tokens: Some(daily_model_tokens),
            model_usage: Some(model_usage),
            total_sessions: Some(total_sessions),
            total_messages: Some(total_messages),
            streak_days: Some(0),
            total_active_days: Some(total_active_days),
            first_session_date,
        }))
    }

    /// Aggregated analytics for the enhanced dashboard.
    async fn dashboard_analytics(
        &self,
        ctx: &Context<'_>,
        days: Option<i32>,
        _subscription_tier: Option<i32>,
    ) -> Result<Option<DashboardAnalytics>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let days = days.unwrap_or(30);

        // Tool usage breakdown
        #[derive(Debug, FromQueryResult)]
        struct ToolRow {
            tool_name: String,
            count: i64,
        }

        let tool_rows = ToolRow::find_by_statement(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            "SELECT tool_name, COUNT(*) as count FROM messages \
             WHERE tool_name IS NOT NULL AND timestamp >= date('now', ? || ' days') \
             GROUP BY tool_name ORDER BY count DESC LIMIT 20",
            vec![format!("-{days}").into()],
        ))
        .all(db)
        .await
        .unwrap_or_default();

        let tool_usage: Vec<ToolUsageStats> = tool_rows
            .into_iter()
            .map(|r| ToolUsageStats {
                tool_name: Some(r.tool_name),
                count: Some(r.count as i32),
            })
            .collect();

        // Hook health stats
        #[derive(Debug, FromQueryResult)]
        struct HookRow {
            hook_name: String,
            total_runs: i64,
            pass_count: i64,
            fail_count: i64,
            avg_duration_ms: f64,
        }

        let hook_rows = HookRow::find_by_statement(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT hook_name, COUNT(*) as total_runs, \
             SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as pass_count, \
             SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as fail_count, \
             AVG(duration_ms) as avg_duration_ms \
             FROM hook_executions GROUP BY hook_name ORDER BY total_runs DESC"
                .to_string(),
        ))
        .all(db)
        .await
        .unwrap_or_default();

        let hook_health: Vec<HookHealthStats> = hook_rows
            .into_iter()
            .map(|r| {
                let pass_rate = if r.total_runs > 0 {
                    r.pass_count as f64 / r.total_runs as f64
                } else {
                    0.0
                };
                HookHealthStats {
                    hook_name: Some(r.hook_name),
                    total_runs: Some(r.total_runs as i32),
                    pass_count: Some(r.pass_count as i32),
                    fail_count: Some(r.fail_count as i32),
                    pass_rate: Some(pass_rate),
                    avg_duration_ms: Some(r.avg_duration_ms),
                }
            })
            .collect();

        // Cost analysis from global aggregates
        #[derive(Debug, FromQueryResult)]
        struct CostAgg {
            total_sessions: i64,
            total_completed_tasks: i64,
            total_input_tokens: i64,
            total_output_tokens: i64,
            total_cache_read_tokens: i64,
        }
        let cost_agg = CostAgg::find_by_statement(Statement::from_string(
            DbBackend::Sqlite,
            "SELECT total_sessions, total_completed_tasks, total_input_tokens, \
             total_output_tokens, total_cache_read_tokens \
             FROM global_aggregates WHERE id = 1"
                .to_string(),
        ))
        .one(db)
        .await
        .unwrap_or(None);

        // Daily cost trend from daily_aggregates
        let daily_cost_rows = DailyActivityRow::find_by_statement(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            "SELECT date, session_count, message_count, input_tokens, output_tokens, \
             cache_read_tokens as cached_tokens, lines_added, lines_removed, files_changed \
             FROM daily_aggregates \
             WHERE date >= date('now', ? || ' days') \
             ORDER BY date ASC",
            vec![format!("-{days}").into()],
        ))
        .all(db)
        .await
        .unwrap_or_default();

        let cost_analysis = cost_agg.map(|agg| {
            let total_cost = estimate_cost_usd(
                agg.total_input_tokens,
                agg.total_output_tokens,
                agg.total_cache_read_tokens,
            );
            let total_tokens = agg.total_input_tokens + agg.total_output_tokens + agg.total_cache_read_tokens;
            let cache_hit_rate = if total_tokens > 0 {
                agg.total_cache_read_tokens as f64 / total_tokens as f64
            } else {
                0.0
            };
            let cost_without_cache = estimate_cost_usd(
                agg.total_input_tokens + agg.total_cache_read_tokens,
                agg.total_output_tokens,
                0,
            );
            let cache_savings = cost_without_cache - total_cost;

            let daily_cost_trend: Vec<DailyCost> = daily_cost_rows
                .iter()
                .map(|r| DailyCost {
                    date: Some(r.date.clone()),
                    cost_usd: Some(estimate_cost_usd(r.input_tokens, r.output_tokens, r.cached_tokens)),
                    session_count: Some(r.session_count as i32),
                })
                .collect();

            CostAnalysis {
                estimated_cost_usd: Some(total_cost),
                is_estimated: Some(true),
                cache_hit_rate: Some(cache_hit_rate),
                cache_savings_usd: Some(cache_savings),
                cost_per_session: Some(if agg.total_sessions > 0 {
                    total_cost / agg.total_sessions as f64
                } else {
                    0.0
                }),
                cost_per_completed_task: Some(if agg.total_completed_tasks > 0 {
                    total_cost / agg.total_completed_tasks as f64
                } else {
                    0.0
                }),
                max_subscription_cost_usd: Some(200.0),
                cost_utilization_percent: Some((total_cost / 200.0) * 100.0),
                break_even_daily_spend: None,
                billing_type: Some("api".to_string()),
                daily_cost_trend: Some(daily_cost_trend),
                weekly_cost_trend: Some(vec![]),
                top_sessions_by_cost: Some(vec![]),
                potential_savings_usd: Some(0.0),
                subscription_comparisons: Some(vec![]),
                config_dir_breakdowns: Some(vec![]),
            }
        });

        Ok(Some(DashboardAnalytics {
            top_sessions: Some(vec![]),
            bottom_sessions: Some(vec![]),
            compaction_stats: None,
            cost_analysis,
            hook_health: Some(hook_health),
            subagent_usage: Some(vec![]),
            tool_usage: Some(tool_usage),
        }))
    }
}

/// Load per-model usage data from ~/.claude/stats-cache.json.
fn load_stats_cache_model_data() -> (Vec<ModelUsageStats>, Vec<DailyModelTokens>) {
    let stats_path = dirs::home_dir()
        .map(|h| h.join(".claude").join("stats-cache.json"));

    let stats_path = match stats_path {
        Some(p) if p.exists() => p,
        _ => return (vec![], vec![]),
    };

    let contents = match std::fs::read_to_string(&stats_path) {
        Ok(c) => c,
        Err(_) => return (vec![], vec![]),
    };

    let cache: StatsCache = match serde_json::from_str(&contents) {
        Ok(c) => c,
        Err(_) => return (vec![], vec![]),
    };

    // Build model_usage from cache.model_usage
    let model_usage: Vec<ModelUsageStats> = cache
        .model_usage
        .unwrap_or_default()
        .into_iter()
        .map(|(model_id, usage)| {
            let input = usage.input_tokens.unwrap_or(0);
            let output = usage.output_tokens.unwrap_or(0);
            let cache_read = usage.cache_read_input_tokens.unwrap_or(0);
            let cache_creation = usage.cache_creation_input_tokens.unwrap_or(0);
            let total = input + output + cache_read + cache_creation;
            let cost = estimate_cost_for_model(&model_id, input, output, cache_read, cache_creation);
            ModelUsageStats {
                display_name: Some(model_display_name(&model_id)),
                model: Some(model_id),
                input_tokens: Some(input),
                output_tokens: Some(output),
                cache_read_tokens: Some(cache_read),
                cache_creation_tokens: Some(cache_creation),
                total_tokens: Some(total),
                cost_usd: Some(cost),
            }
        })
        .collect();

    // Build daily_model_tokens from cache.daily_model_tokens
    let daily_model_tokens: Vec<DailyModelTokens> = cache
        .daily_model_tokens
        .unwrap_or_default()
        .into_iter()
        .map(|entry| {
            let tokens_by_model = entry.tokens_by_model.unwrap_or_default();
            let mut day_total: i64 = 0;
            let models: Vec<ModelTokenEntry> = tokens_by_model
                .into_iter()
                .map(|(model_id, tokens)| {
                    day_total += tokens;
                    ModelTokenEntry {
                        display_name: Some(model_display_name(&model_id)),
                        model: Some(model_id),
                        tokens: Some(tokens),
                    }
                })
                .collect();
            DailyModelTokens {
                date: Some(entry.date),
                models: Some(models),
                total_tokens: Some(day_total),
            }
        })
        .collect();

    (model_usage, daily_model_tokens)
}

/// Convert a database session model to GraphQL SessionData.
pub fn session_model_to_data(m: sessions::Model) -> SessionData {
    SessionData {
        session_id: m.id,
        project_dir: String::new(), // Populated from context when available
        project_id: m.project_id,
        project_name: String::new(), // Populated via join when available
        project_path: String::new(),
        date: String::new(), // Derived from transcript path or message timestamps
        slug: m.slug,
        summary: None,
        message_count: 0, // Populated via count query
        started_at: None,
        updated_at: None,
        git_branch: None,
        version: None,
        worktree_name: None,
        source_config_dir: m.source_config_dir,
        status: m.status,
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_session_model() -> sessions::Model {
        sessions::Model {
            id: "sess-abc".into(),
            project_id: Some("proj-1".into()),
            status: Some("active".into()),
            slug: Some("snug-dreaming-knuth".into()),
            transcript_path: Some("/home/user/.claude/sessions/sess-abc.jsonl".into()),
            source_config_dir: Some("/home/user/.claude".into()),
            last_indexed_line: Some(100),
        }
    }

    #[test]
    fn session_model_to_data_maps_id() {
        let sd = session_model_to_data(make_session_model());
        assert_eq!(sd.session_id, "sess-abc");
    }

    #[test]
    fn session_model_to_data_maps_project_id() {
        let sd = session_model_to_data(make_session_model());
        assert_eq!(sd.project_id, Some("proj-1".into()));
    }

    #[test]
    fn session_model_to_data_maps_status() {
        let sd = session_model_to_data(make_session_model());
        assert_eq!(sd.status, Some("active".into()));
    }

    #[test]
    fn session_model_to_data_maps_slug() {
        let sd = session_model_to_data(make_session_model());
        assert_eq!(sd.slug, Some("snug-dreaming-knuth".into()));
    }

    #[test]
    fn session_model_to_data_maps_source_config_dir() {
        let sd = session_model_to_data(make_session_model());
        assert_eq!(sd.source_config_dir, Some("/home/user/.claude".into()));
    }

    #[test]
    fn session_model_to_data_defaults_empty_strings() {
        let sd = session_model_to_data(make_session_model());
        assert_eq!(sd.project_dir, "");
        assert_eq!(sd.project_name, "");
        assert_eq!(sd.project_path, "");
        assert_eq!(sd.date, "");
    }

    #[test]
    fn session_model_to_data_defaults_none_fields() {
        let sd = session_model_to_data(make_session_model());
        assert!(sd.summary.is_none());
        assert!(sd.started_at.is_none());
        assert!(sd.updated_at.is_none());
        assert!(sd.git_branch.is_none());
        assert!(sd.version.is_none());
        assert!(sd.worktree_name.is_none());
    }

    #[test]
    fn session_model_to_data_defaults_message_count_zero() {
        let sd = session_model_to_data(make_session_model());
        assert_eq!(sd.message_count, 0);
    }

    #[test]
    fn session_model_to_data_handles_none_fields() {
        let m = sessions::Model {
            id: "s".into(),
            project_id: None,
            status: None,
            slug: None,
            transcript_path: None,
            source_config_dir: None,
            last_indexed_line: None,
        };
        let sd = session_model_to_data(m);
        assert!(sd.project_id.is_none());
        assert!(sd.status.is_none());
        assert!(sd.slug.is_none());
        assert!(sd.source_config_dir.is_none());
    }
}
