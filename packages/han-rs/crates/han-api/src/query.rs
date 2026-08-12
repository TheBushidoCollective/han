//! GraphQL Query root.
//!
//! All top-level queries. Uses Relay Node interface - no viewer pattern.

use std::collections::HashMap;
use std::sync::Mutex;
use std::time::Instant;

use async_graphql::*;
use chrono::Datelike;
use sea_orm::{
    ColumnTrait, ConnectionTrait, DatabaseConnection, DbBackend, EntityTrait, FromQueryResult,
    PaginatorTrait, QueryFilter, QueryOrder, QuerySelect, Statement,
};

// TTL cache for expensive dashboard analytics queries.
// Keyed by (days, project_id, repo_id), cached for 30 seconds.
static ANALYTICS_CACHE: std::sync::LazyLock<
    Mutex<Option<(Instant, String, crate::types::dashboard::DashboardAnalytics)>>,
> = std::sync::LazyLock::new(|| Mutex::new(None));

use han_db::entities::{config_dirs, hook_executions, native_tasks, projects, repos, sessions};

use crate::node::decode_global_id;
use crate::types::config_dir::ConfigDir;
use crate::types::dashboard::{
    estimate_cost_for_model, estimate_cost_usd, model_display_name, ActivityData,
    CoordinatorStatus, CostAnalysis, DailyActivity, DailyCost, DailyModelTokens,
    DashboardAnalytics, HookHealthStats, HourlyActivity, HumanTimeBreakdown, HumanTimeEstimate,
    ModelTokenEntry, ModelUsageStats, SessionCost, SessionPerformancePoint, StatsCache,
    TokenUsageStats, ToolTimeEstimate, ToolUsageStats, WeeklyCost,
};
use crate::types::enums::MetricsPeriod;
use crate::types::metrics::{MetricsData, TaskOutcomeCount, TaskTypeCount};
use crate::types::plugin::{Plugin, PluginCategory, PluginStats};
use crate::types::project::Project;
use crate::types::repo::Repo;
use crate::types::sessions::{build_session_connection, SessionConnection, SessionData};

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
            // Use human-readable name, falling back to last path component if name is a slug
            if project.name.starts_with('-') || project.name.is_empty() {
                let display = std::path::Path::new(&project.path)
                    .file_name()
                    .and_then(|n| n.to_str())
                    .unwrap_or(&project.name)
                    .to_string();
                session.project_name = display;
            } else {
                session.project_name.clone_from(&project.name);
            }
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
pub async fn enrich_single_session(
    db: &DatabaseConnection,
    session: &mut SessionData,
) -> Result<()> {
    enrich_sessions(db, std::slice::from_mut(session)).await
}

/// Strip a Relay global ID prefix (e.g. "Repo:uuid" → "uuid", "Project:uuid" → "uuid").
/// If no colon is found, returns the original string.
fn strip_global_id_prefix(id: &str) -> &str {
    id.rsplit_once(':').map(|(_, raw)| raw).unwrap_or(id)
}

/// Returns an optional session scope SQL filter and its bind value.
/// When scoped by `repo_id`, includes all sessions belonging to projects in that repo.
/// When scoped by `project_id`, includes all sessions in that project.
/// Returns `None` when unscoped (use fast aggregate tables).
///
/// `col` is the column expression to filter (e.g., `"session_id"`, `"m.session_id"`, `"s.id"`).
/// Handles both raw UUIDs and Relay global IDs (`Repo:uuid`, `Project:uuid`).
fn session_scope_filter(
    col: &str,
    project_id: &Option<String>,
    repo_id: &Option<String>,
) -> Option<(String, sea_orm::Value)> {
    if let Some(rid) = repo_id {
        let raw = strip_global_id_prefix(rid);
        if !raw.is_empty() {
            return Some((
                format!(
                    "{col} IN (SELECT ss.id FROM sessions ss \
                     JOIN projects pp ON ss.project_id = pp.id \
                     WHERE pp.repo_id = ?)"
                ),
                raw.to_string().into(),
            ));
        }
    }
    if let Some(pid) = project_id {
        let raw = strip_global_id_prefix(pid);
        if !raw.is_empty() {
            return Some((
                format!("{col} IN (SELECT ss.id FROM sessions ss WHERE ss.project_id = ?)"),
                raw.to_string().into(),
            ));
        }
    }
    None
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
                        Ok(sessions
                            .into_iter()
                            .next()
                            .map(crate::types::node::Node::Session))
                    }
                    None => Ok(None),
                }
            }
            "Repo" => {
                let model = repos::Entity::find_by_id(&raw_id)
                    .one(db)
                    .await
                    .map_err(|e| Error::new(e.to_string()))?;
                Ok(model.map(|m| crate::types::node::Node::Repo(Repo::from(m))))
            }
            "Project" => {
                let model = projects::Entity::find_by_id(&raw_id)
                    .one(db)
                    .await
                    .map_err(|e| Error::new(e.to_string()))?;
                Ok(model.map(|m| crate::types::node::Node::Project(Project::from(m))))
            }
            "ConfigDir" => {
                let model = config_dirs::Entity::find_by_id(&raw_id)
                    .one(db)
                    .await
                    .map_err(|e| Error::new(e.to_string()))?;
                Ok(model.map(|m| crate::types::node::Node::ConfigDir(ConfigDir::from(m))))
            }
            "NativeTask" => {
                let model = native_tasks::Entity::find_by_id(&raw_id)
                    .one(db)
                    .await
                    .map_err(|e| Error::new(e.to_string()))?;
                Ok(model.map(|m| {
                    crate::types::node::Node::NativeTask(
                        crate::types::native_task::NativeTask::from(m),
                    )
                }))
            }
            "HookExecution" => {
                let model = hook_executions::Entity::find_by_id(&raw_id)
                    .one(db)
                    .await
                    .map_err(|e| Error::new(e.to_string()))?;
                Ok(model.map(|m| {
                    crate::types::node::Node::HookExecution(
                        crate::types::hook_execution::HookExecution::from(m),
                    )
                }))
            }
            _ => Ok(None),
        }
    }

    /// Fetch a single message by its UUID.
    async fn message(
        &self,
        ctx: &Context<'_>,
        id: String,
    ) -> Result<Option<crate::types::messages::Message>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let msg_model = han_db::crud::messages::get(db, &id)
            .await
            .map_err(|e| Error::new(e.to_string()))?;
        let msg_model = match msg_model {
            Some(m) => m,
            None => return Ok(None),
        };
        let data = crate::types::messages::MessageData::from_model(&msg_model, "");
        Ok(Some(crate::types::messages::discriminate_message(data)))
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
    async fn projects(
        &self,
        ctx: &Context<'_>,
        first: Option<i32>,
        filter: Option<crate::types::project::ProjectFilter>,
        order_by: Option<crate::types::project::ProjectOrderBy>,
    ) -> Result<Vec<Project>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let limit = first.unwrap_or(20) as u64;
        let mut query = projects::Entity::find();
        if let Some(ref f) = filter {
            query = query.filter(f.to_condition());
        }
        if let Some(ref o) = order_by {
            query = o.apply(query);
        } else {
            query = query.order_by_desc(projects::Column::UpdatedAt);
        }
        let models = query.all(db).await.map_err(|e| Error::new(e.to_string()))?;
        Ok(models
            .into_iter()
            .take(limit as usize)
            .map(Project::from)
            .collect())
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
    async fn repos(
        &self,
        ctx: &Context<'_>,
        first: Option<i32>,
        filter: Option<crate::types::repo::RepoFilter>,
        order_by: Option<crate::types::repo::RepoOrderBy>,
    ) -> Result<Vec<Repo>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let limit = first.unwrap_or(20) as u64;
        let mut query = repos::Entity::find();
        if let Some(ref f) = filter {
            query = query.filter(f.to_condition());
        }
        if let Some(ref o) = order_by {
            query = o.apply(query);
        } else {
            query = query.order_by_desc(repos::Column::UpdatedAt);
        }
        let models = query.all(db).await.map_err(|e| Error::new(e.to_string()))?;
        Ok(models
            .into_iter()
            .take(limit as usize)
            .map(Repo::from)
            .collect())
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
    ///
    /// Filtering is done via the GreenFairy-style `filter` input type.
    /// Supports association filtering (e.g., `filter: { project: { repoId: { _eq: "..." } } }`).
    async fn sessions(
        &self,
        ctx: &Context<'_>,
        first: Option<i32>,
        after: Option<String>,
        last: Option<i32>,
        before: Option<String>,
        filter: Option<crate::types::sessions::SessionFilter>,
        order_by: Option<crate::types::sessions::SessionOrderBy>,
    ) -> Result<SessionConnection> {
        let db = ctx.data::<DatabaseConnection>()?;

        // Use SeaORM query builder with filter conditions
        let mut count_query = sessions::Entity::find();
        if let Some(ref f) = filter {
            count_query = count_query.filter(f.to_condition());
        }
        let total_count = count_query
            .clone()
            .count(db)
            .await
            .map(|c| c as i32)
            .unwrap_or(0);

        let page_size = first.or(last).unwrap_or(20) as i64;

        // When no explicit orderBy, use SQL-level sorting by last message timestamp
        // to avoid loading ALL sessions just to sort by activity.
        let mut session_data: Vec<SessionData> = if order_by.is_none() {
            // Fast path: get top N sessions ordered by latest message timestamp.
            // Uses idx_messages_session_ts_desc for efficient MAX(timestamp) per session.
            let mut page_query = sessions::Entity::find();
            if let Some(ref f) = filter {
                page_query = page_query.filter(f.to_condition());
            }

            // Get filtered session IDs, limited to a reasonable working set
            // that we can sort by activity. Cap at 200 to avoid loading thousands.
            let models = page_query
                .limit(Some(200))
                .all(db)
                .await
                .map_err(|e| Error::new(e.to_string()))?;

            if models.is_empty() {
                vec![]
            } else {
                // Get last activity timestamps for these sessions in a single query
                let session_ids: Vec<String> = models.iter().map(|m| m.id.clone()).collect();
                let placeholders = vec!["?"; session_ids.len()].join(",");
                let values: Vec<sea_orm::Value> =
                    session_ids.iter().map(|id| id.clone().into()).collect();

                #[derive(Debug, FromQueryResult)]
                struct SessionActivity {
                    session_id: String,
                    last_ts: Option<String>,
                }

                let activities =
                    SessionActivity::find_by_statement(Statement::from_sql_and_values(
                        DbBackend::Sqlite,
                        format!(
                            "SELECT session_id, MAX(timestamp) as last_ts \
                             FROM messages WHERE session_id IN ({placeholders}) \
                             GROUP BY session_id"
                        ),
                        values,
                    ))
                    .all(db)
                    .await
                    .map_err(|e| Error::new(e.to_string()))?;

                let activity_map: HashMap<String, String> = activities
                    .into_iter()
                    .filter_map(|a| a.last_ts.map(|ts| (a.session_id, ts)))
                    .collect();

                // Sort models by last activity, then take page_size
                let mut model_with_ts: Vec<(sessions::Model, String)> = models
                    .into_iter()
                    .map(|m| {
                        let ts = activity_map.get(&m.id).cloned().unwrap_or_default();
                        (m, ts)
                    })
                    .collect();
                model_with_ts.sort_by(|a, b| b.1.cmp(&a.1));
                model_with_ts.truncate(page_size as usize);

                let mut data: Vec<SessionData> = model_with_ts
                    .into_iter()
                    .map(|(m, _)| session_model_to_data(m))
                    .collect();
                enrich_sessions(db, &mut data).await?;
                data
            }
        } else {
            // Explicit orderBy: use SeaORM ordering with SQL-level LIMIT
            let mut page_query = sessions::Entity::find();
            if let Some(ref f) = filter {
                page_query = page_query.filter(f.to_condition());
            }
            if let Some(ref o) = order_by {
                page_query = o.apply(page_query);
            }

            let models = page_query
                .limit(Some(page_size as u64))
                .all(db)
                .await
                .map_err(|e| Error::new(e.to_string()))?;

            let mut data: Vec<SessionData> =
                models.into_iter().map(session_model_to_data).collect();
            enrich_sessions(db, &mut data).await?;
            data
        };

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
        project_id: Option<String>,
        repo_id: Option<String>,
    ) -> Result<Option<crate::types::team::TeamMetrics>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let scope = session_scope_filter("session_id", &project_id, &repo_id);

        let (total_sessions, total_tasks, total_tokens, cost) = if let Some((
            ref scope_clause,
            ref scope_val,
        )) = scope
        {
            // Scoped: count sessions from sessions table (complete data),
            // token totals from messages table (indexed data).
            let sess_scope = session_scope_filter("s.id", &project_id, &repo_id);
            let (sess_clause, _) = sess_scope.unwrap();

            let token_row = db
                .query_one(Statement::from_sql_and_values(
                    DbBackend::Sqlite,
                    format!(
                        "SELECT \
                         (SELECT COUNT(*) FROM sessions s WHERE {sess_clause}) as total_sessions, \
                         COALESCE(SUM(input_tokens), 0) as total_input_tokens, \
                         COALESCE(SUM(output_tokens), 0) as total_output_tokens, \
                         COALESCE(SUM(cache_read_tokens), 0) as total_cache_read_tokens \
                         FROM messages WHERE {scope_clause}"
                    ),
                    vec![scope_val.clone(), scope_val.clone()],
                ))
                .await
                .map_err(|e| Error::new(e.to_string()))?;

            let (sess, inp, out, cache) = token_row
                .map(|r| {
                    let s: i64 = r.try_get("", "total_sessions").unwrap_or(0);
                    let i: i64 = r.try_get("", "total_input_tokens").unwrap_or(0);
                    let o: i64 = r.try_get("", "total_output_tokens").unwrap_or(0);
                    let c: i64 = r.try_get("", "total_cache_read_tokens").unwrap_or(0);
                    (s, i, o, c)
                })
                .unwrap_or((0, 0, 0, 0));

            let task_row = db
                .query_one(Statement::from_sql_and_values(
                    DbBackend::Sqlite,
                    format!(
                        "SELECT COUNT(*) as total_tasks FROM native_tasks WHERE {scope_clause}"
                    ),
                    vec![scope_val.clone()],
                ))
                .await
                .map_err(|e| Error::new(e.to_string()))?;

            let tasks = task_row
                .map(|r| r.try_get::<i64>("", "total_tasks").unwrap_or(0))
                .unwrap_or(0);

            let tok = inp + out + cache;
            (
                sess as i32,
                tasks as i32,
                tok,
                estimate_cost_usd(inp, out, cache),
            )
        } else {
            // Unscoped: use pre-aggregated global_aggregates (instant vs scanning 1M+ messages)
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

            row.map(|r| {
                let s: i64 = r.try_get("", "total_sessions").unwrap_or(0);
                let t: i64 = r.try_get("", "total_tasks").unwrap_or(0);
                let tok: i64 = r.try_get("", "total_tokens").unwrap_or(0);
                let inp: i64 = r.try_get("", "total_input_tokens").unwrap_or(0);
                let out: i64 = r.try_get("", "total_output_tokens").unwrap_or(0);
                let cache: i64 = r.try_get("", "total_cache_read_tokens").unwrap_or(0);
                (s as i32, t as i32, tok, estimate_cost_usd(inp, out, cache))
            })
            .unwrap_or((0, 0, 0, 0.0))
        };

        // Sessions by project (top 20)
        let sbp_rows = db
            .query_all(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT p.id as pid, p.name as pname, p.path as ppath, COUNT(DISTINCT s.id) as sess_cnt, \
                 (SELECT COUNT(*) FROM native_tasks nt WHERE nt.session_id IN \
                   (SELECT s2.id FROM sessions s2 WHERE s2.project_id = p.id)) as task_cnt \
                 FROM sessions s \
                 JOIN projects p ON s.project_id = p.id \
                 GROUP BY p.id \
                 ORDER BY sess_cnt DESC LIMIT 20"
                    .to_string(),
            ))
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        let sessions_by_project: Vec<crate::types::team::ProjectSessionCount> = sbp_rows
            .iter()
            .filter_map(|r| {
                let pid: String = r.try_get("", "pid").ok()?;
                let pname: String = r.try_get("", "pname").unwrap_or_default();
                let ppath: String = r.try_get("", "ppath").unwrap_or_default();
                let sess: i64 = r.try_get("", "sess_cnt").unwrap_or(0);
                let tasks: i64 = r.try_get("", "task_cnt").unwrap_or(0);
                // Use name from DB, falling back to last path component
                let display_name = if pname.starts_with('-') || pname.is_empty() {
                    // Name is still a slug — derive from path
                    std::path::Path::new(&ppath)
                        .file_name()
                        .and_then(|n| n.to_str())
                        .unwrap_or(&pname)
                        .to_string()
                } else {
                    pname
                };
                Some(crate::types::team::ProjectSessionCount {
                    project_id: Some(pid),
                    project_name: Some(display_name),
                    count: Some(sess as i32),
                    session_count: Some(sess as i32),
                    task_count: Some(tasks as i32),
                    success_rate: None,
                })
            })
            .collect();

        // Activity timeline: sessions per day (last 90 days)
        // sessions table has no started_at — derive from first message timestamp
        let timeline_rows = db
            .query_all(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT dt, COUNT(*) as sess_cnt, SUM(msg_cnt) as msg_cnt FROM (\
                   SELECT s.id, date(MIN(m.timestamp), 'localtime') as dt, COUNT(m.id) as msg_cnt \
                   FROM sessions s \
                   JOIN messages m ON m.session_id = s.id \
                   GROUP BY s.id \
                   HAVING dt >= date('now', 'localtime', '-90 days') \
                 ) GROUP BY dt ORDER BY dt ASC"
                    .to_string(),
            ))
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        let activity_timeline: Vec<crate::types::team::ActivityTimelineEntry> = timeline_rows
            .iter()
            .filter_map(|r| {
                let dt: String = r.try_get("", "dt").ok()?;
                let sess: i64 = r.try_get("", "sess_cnt").unwrap_or(0);
                let msgs: i64 = r.try_get("", "msg_cnt").unwrap_or(0);
                Some(crate::types::team::ActivityTimelineEntry {
                    date: Some(dt.clone()),
                    period: Some(dt),
                    sessions: Some(sess as i32),
                    session_count: Some(sess as i32),
                    tasks: None,
                    task_count: None,
                    tokens: None,
                    message_count: Some(msgs as i32),
                })
            })
            .collect();

        // Task completion metrics
        let tcm_row = db
            .query_one(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT COUNT(*) as total, \
                 SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed, \
                 SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as in_prog, \
                 SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as pending \
                 FROM native_tasks"
                    .to_string(),
            ))
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        let task_completion_metrics = tcm_row.map(|r| {
            let total: i64 = r.try_get("", "total").unwrap_or(0);
            let completed: i64 = r.try_get("", "completed").unwrap_or(0);
            let in_prog: i64 = r.try_get("", "in_prog").unwrap_or(0);
            let pending: i64 = r.try_get("", "pending").unwrap_or(0);
            let sr = if total > 0 {
                completed as f64 / total as f64
            } else {
                0.0
            };
            crate::types::team::TaskCompletionMetrics {
                total_tasks: Some(total as i32),
                total_created: Some(total as i32),
                total_completed: Some(completed as i32),
                completed_tasks: Some(completed as i32),
                success_count: Some(completed as i32),
                partial_count: Some(in_prog as i32),
                failure_count: Some(pending as i32),
                success_rate: Some(sr),
                average_confidence: None,
            }
        });

        // Top contributors (projects as proxy — local mode is single-user)
        let top_contributors: Vec<crate::types::team::ContributorMetrics> = sessions_by_project
            .iter()
            .take(10)
            .map(|p| crate::types::team::ContributorMetrics {
                user_id: p.project_id.clone(),
                contributor_id: p.project_id.clone(),
                display_name: p.project_name.clone(),
                session_count: p.session_count,
                task_count: p.task_count,
                token_count: None,
                success_rate: p.success_rate,
            })
            .collect();

        // Convert activity timeline to period session counts for sessions_by_period
        let sessions_by_period: Vec<crate::types::team::PeriodSessionCount> = activity_timeline
            .iter()
            .map(|e| crate::types::team::PeriodSessionCount {
                period: e.period.clone(),
                count: e.session_count,
                session_count: e.session_count,
                task_count: e.task_count,
                token_usage: None,
            })
            .collect();

        Ok(Some(crate::types::team::TeamMetrics {
            total_sessions: Some(total_sessions),
            total_tasks: Some(total_tasks),
            total_tokens: Some(total_tokens),
            estimated_cost_usd: Some(cost),
            sessions_by_period: Some(sessions_by_period),
            sessions_by_project: Some(sessions_by_project),
            top_contributors: Some(top_contributors),
            activity_timeline: Some(activity_timeline),
            token_usage_aggregation: None,
            task_completion_metrics,
        }))
    }

    // ========================================================================
    // Stub query fields for browse-client backwards compatibility
    // ========================================================================

    /// Task metrics for a time period.
    async fn metrics(
        &self,
        ctx: &Context<'_>,
        _period: Option<MetricsPeriod>,
        project_id: Option<String>,
        repo_id: Option<String>,
    ) -> Result<Option<MetricsData>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let scope = session_scope_filter("session_id", &project_id, &repo_id);

        // Task counts
        let (total, completed) = if let Some((ref scope_clause, ref scope_val)) = scope {
            // Scoped: query native_tasks directly
            let row = db
                .query_one(Statement::from_sql_and_values(
                    DbBackend::Sqlite,
                    format!(
                        "SELECT COUNT(*) as total, \
                         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed \
                         FROM native_tasks WHERE {scope_clause}"
                    ),
                    vec![scope_val.clone()],
                ))
                .await
                .map_err(|e| Error::new(e.to_string()))?;
            row.map(|r| {
                let t: i64 = r.try_get("", "total").unwrap_or(0);
                let c: i64 = r.try_get("", "completed").unwrap_or(0);
                (t as i32, c as i32)
            })
            .unwrap_or((0, 0))
        } else {
            // Unscoped: query native_tasks directly for accurate counts
            let task_counts = db
                .query_one(Statement::from_string(
                    DbBackend::Sqlite,
                    "SELECT COUNT(*) as total, \
                     SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed \
                     FROM native_tasks"
                        .to_string(),
                ))
                .await
                .map_err(|e| Error::new(e.to_string()))?;
            task_counts
                .map(|r| {
                    let t: i64 = r.try_get("", "total").unwrap_or(0);
                    let c: i64 = r.try_get("", "completed").unwrap_or(0);
                    (t as i32, c as i32)
                })
                .unwrap_or((0, 0))
        };

        let success_rate = if total > 0 {
            completed as f64 / total as f64
        } else {
            0.0
        };

        // Sentiment aggregation for agent health
        let (sentiment_sql, sentiment_values): (String, Vec<sea_orm::Value>) = if let Some((
            ref scope_clause,
            ref scope_val,
        )) = scope
        {
            (
                    format!(
                        "SELECT \
                         AVG(sentiment_score) as avg_sentiment, \
                         COUNT(CASE WHEN frustration_level IN ('high', 'critical') THEN 1 END) as significant_frustrations, \
                         COUNT(CASE WHEN frustration_level IS NOT NULL THEN 1 END) as total_frustration_events \
                         FROM messages \
                         WHERE sentiment_score IS NOT NULL AND {scope_clause}"
                    ),
                    vec![scope_val.clone()],
                )
        } else {
            (
                    "SELECT \
                     AVG(sentiment_score) as avg_sentiment, \
                     COUNT(CASE WHEN frustration_level IN ('high', 'critical') THEN 1 END) as significant_frustrations, \
                     COUNT(CASE WHEN frustration_level IS NOT NULL THEN 1 END) as total_frustration_events \
                     FROM messages \
                     WHERE sentiment_score IS NOT NULL"
                        .to_string(),
                    vec![],
                )
        };

        let sentiment_row = db
            .query_one(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                sentiment_sql,
                sentiment_values,
            ))
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        let (avg_sentiment, significant_frustrations, total_frustration_events) = sentiment_row
            .map(|r| {
                let avg: f64 = r.try_get("", "avg_sentiment").unwrap_or(0.0);
                let sig: i64 = r.try_get("", "significant_frustrations").unwrap_or(0);
                let tot: i64 = r.try_get("", "total_frustration_events").unwrap_or(0);
                (avg, sig as i32, tot as i32)
            })
            .unwrap_or((0.0, 0, 0));

        // Normalize sentiment (-1..1) to confidence (0..1)
        let average_confidence = (avg_sentiment + 1.0) / 2.0;
        let frustration_rate = if total_frustration_events > 0 {
            significant_frustrations as f64 / total_frustration_events as f64
        } else {
            0.0
        };

        // Tasks by status (mapped to TaskType for chart display)
        // native_tasks has status: pending/in_progress/completed
        // We group by status and map to meaningful categories
        let (type_sql, type_values): (String, Vec<sea_orm::Value>) =
            if let Some((ref scope_clause, ref scope_val)) = scope {
                (
                    format!(
                        "SELECT status, COUNT(*) as cnt FROM native_tasks \
                         WHERE {scope_clause} GROUP BY status ORDER BY cnt DESC"
                    ),
                    vec![scope_val.clone()],
                )
            } else {
                (
                    "SELECT status, COUNT(*) as cnt FROM native_tasks \
                     GROUP BY status ORDER BY cnt DESC"
                        .to_string(),
                    vec![],
                )
            };

        let type_rows = db
            .query_all(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                type_sql,
                type_values,
            ))
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        let tasks_by_type: Vec<TaskTypeCount> = type_rows
            .iter()
            .filter_map(|r| {
                let status: String = r.try_get("", "status").ok()?;
                let cnt: i64 = r.try_get("", "cnt").unwrap_or(0);
                let task_type = match status.as_str() {
                    "completed" => Some(crate::types::enums::TaskType::Implementation),
                    "in_progress" => Some(crate::types::enums::TaskType::Research),
                    "pending" => Some(crate::types::enums::TaskType::Fix),
                    _ => None,
                };
                Some(TaskTypeCount {
                    task_type,
                    count: Some(cnt as i32),
                })
            })
            .collect();

        // Tasks by outcome: completed=SUCCESS, in_progress=PARTIAL, pending=not counted
        let (outcome_sql, outcome_values): (String, Vec<sea_orm::Value>) =
            if let Some((ref scope_clause, ref scope_val)) = scope {
                (
                    format!(
                        "SELECT \
                         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success, \
                         SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as partial, \
                         SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as failure \
                         FROM native_tasks WHERE {scope_clause}"
                    ),
                    vec![scope_val.clone()],
                )
            } else {
                (
                    "SELECT \
                     SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as success, \
                     SUM(CASE WHEN status = 'in_progress' THEN 1 ELSE 0 END) as partial, \
                     SUM(CASE WHEN status = 'pending' THEN 1 ELSE 0 END) as failure \
                     FROM native_tasks"
                        .to_string(),
                    vec![],
                )
            };

        let outcome_row = db
            .query_one(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                outcome_sql,
                outcome_values,
            ))
            .await
            .map_err(|e| Error::new(e.to_string()))?;

        let tasks_by_outcome: Vec<TaskOutcomeCount> = if let Some(r) = outcome_row {
            let success: i64 = r.try_get("", "success").unwrap_or(0);
            let partial: i64 = r.try_get("", "partial").unwrap_or(0);
            let failure: i64 = r.try_get("", "failure").unwrap_or(0);
            let mut v = vec![];
            if success > 0 {
                v.push(TaskOutcomeCount {
                    outcome: Some(crate::types::enums::TaskOutcome::Success),
                    count: Some(success as i32),
                });
            }
            if partial > 0 {
                v.push(TaskOutcomeCount {
                    outcome: Some(crate::types::enums::TaskOutcome::Partial),
                    count: Some(partial as i32),
                });
            }
            if failure > 0 {
                v.push(TaskOutcomeCount {
                    outcome: Some(crate::types::enums::TaskOutcome::Failure),
                    count: Some(failure as i32),
                });
            }
            v
        } else {
            vec![]
        };

        Ok(Some(MetricsData {
            total_tasks: Some(total),
            completed_tasks: Some(completed),
            success_rate: Some(success_rate),
            average_confidence: Some(average_confidence),
            average_duration: None,
            calibration_score: None,
            significant_frustrations: Some(significant_frustrations),
            significant_frustration_rate: Some(frustration_rate),
            tasks_by_type: Some(tasks_by_type),
            tasks_by_outcome: Some(tasks_by_outcome),
        }))
    }

    /// Installed plugins, optionally filtered by scope.
    async fn plugins(
        &self,
        _scope: Option<crate::types::enums::PluginScope>,
    ) -> Option<Vec<Plugin>> {
        Some(vec![])
    }

    /// Aggregate plugin statistics.
    async fn plugin_stats(&self) -> Option<PluginStats> {
        // Read installed_plugins.json from ~/.claude/plugins/
        let plugins_path = dirs::home_dir().map(|h| {
            h.join(".claude")
                .join("plugins")
                .join("installed_plugins.json")
        });

        let (mut user, mut project, mut local, mut total_unique) = (0i32, 0i32, 0i32, 0i32);

        if let Some(path) = plugins_path {
            if let Ok(data) = std::fs::read_to_string(&path) {
                if let Ok(parsed) = serde_json::from_str::<serde_json::Value>(&data) {
                    if let Some(plugins) = parsed.get("plugins").and_then(|p| p.as_object()) {
                        total_unique = plugins.len() as i32;
                        for (_name, installations) in plugins {
                            if let Some(installs) = installations.as_array() {
                                for install in installs {
                                    match install.get("scope").and_then(|s| s.as_str()) {
                                        Some("user") => user += 1,
                                        Some("project") => project += 1,
                                        Some("local") => local += 1,
                                        _ => project += 1, // default scope
                                    }
                                }
                            }
                        }
                    }
                }
            }
        }

        Some(PluginStats {
            total_plugins: Some(total_unique),
            user_plugins: Some(user),
            project_plugins: Some(project),
            local_plugins: Some(local),
            enabled_plugins: Some(total_unique),
        })
    }

    /// Plugin counts by category.
    async fn plugin_categories(&self) -> Option<Vec<PluginCategory>> {
        Some(vec![])
    }

    /// Activity data for dashboard visualizations.
    async fn activity(
        &self,
        ctx: &Context<'_>,
        days: Option<i32>,
        project_id: Option<String>,
        repo_id: Option<String>,
    ) -> Result<Option<ActivityData>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let days = days.unwrap_or(30);
        let scope = session_scope_filter("session_id", &project_id, &repo_id);

        // === Daily activity ===
        let daily_rows = if let Some((ref scope_clause, ref scope_val)) = scope {
            // Scoped: compute from raw messages table
            DailyActivityRow::find_by_statement(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                format!(
                    "SELECT date(timestamp, 'localtime') as date, \
                     COUNT(DISTINCT session_id) as session_count, \
                     COUNT(*) as message_count, \
                     COALESCE(SUM(input_tokens), 0) as input_tokens, \
                     COALESCE(SUM(output_tokens), 0) as output_tokens, \
                     COALESCE(SUM(cache_read_tokens), 0) as cached_tokens, \
                     COALESCE(SUM(lines_added), 0) as lines_added, \
                     COALESCE(SUM(lines_removed), 0) as lines_removed, \
                     COALESCE(SUM(files_changed), 0) as files_changed \
                     FROM messages \
                     WHERE timestamp >= date('now', ? || ' days') AND {scope_clause} \
                     GROUP BY date(timestamp, 'localtime') \
                     ORDER BY date ASC"
                ),
                vec![format!("-{days}").into(), scope_val.clone()],
            ))
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?
        } else {
            // Unscoped: use pre-aggregated daily_aggregates table
            DailyActivityRow::find_by_statement(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                "SELECT date, session_count, message_count, input_tokens, output_tokens, \
                 cache_read_tokens as cached_tokens, lines_added, lines_removed, files_changed \
                 FROM daily_aggregates \
                 WHERE date >= date('now', 'localtime', ? || ' days') \
                 ORDER BY date ASC",
                vec![format!("-{days}").into()],
            ))
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?
        };

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

        // === Hourly activity ===
        let hourly_rows = if let Some((ref scope_clause, ref scope_val)) = scope {
            // Scoped: compute from raw messages
            HourlyActivityRow::find_by_statement(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                format!(
                    "SELECT CAST(strftime('%H', timestamp, 'localtime') AS INTEGER) as hour, \
                     COUNT(DISTINCT session_id) as session_count, \
                     COUNT(*) as message_count \
                     FROM messages \
                     WHERE {scope_clause} \
                     GROUP BY CAST(strftime('%H', timestamp, 'localtime') AS INTEGER) \
                     ORDER BY hour"
                ),
                vec![scope_val.clone()],
            ))
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?
        } else {
            // Unscoped: use pre-aggregated hourly_aggregates table
            HourlyActivityRow::find_by_statement(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT hour, session_count, message_count FROM hourly_aggregates ORDER BY hour"
                    .to_string(),
            ))
            .all(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?
        };

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

        // === Token totals ===
        #[derive(Debug, FromQueryResult)]
        struct GlobalAgg {
            total_sessions: i64,
            total_messages: i64,
            total_input_tokens: i64,
            total_output_tokens: i64,
            total_cache_read_tokens: i64,
        }
        let globals = if let Some((ref _scope_clause, ref scope_val)) = scope {
            // Scoped: count sessions from the sessions table (complete data),
            // but get message/token totals from the messages table (indexed data).
            // The sessions table has all sessions; the messages table may only have
            // a subset indexed by the Rust indexer.
            let session_scope = session_scope_filter("s.id", &project_id, &repo_id);
            let msg_scope = session_scope_filter("session_id", &project_id, &repo_id);
            let (sess_clause, _sess_val) = session_scope.unwrap();
            let (msg_clause, _msg_val) = msg_scope.unwrap();
            GlobalAgg::find_by_statement(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                format!(
                    "SELECT \
                     (SELECT COUNT(*) FROM sessions s WHERE {sess_clause}) as total_sessions, \
                     (SELECT COUNT(*) FROM messages WHERE {msg_clause}) as total_messages, \
                     (SELECT COALESCE(SUM(input_tokens), 0) FROM messages WHERE {msg_clause}) as total_input_tokens, \
                     (SELECT COALESCE(SUM(output_tokens), 0) FROM messages WHERE {msg_clause}) as total_output_tokens, \
                     (SELECT COALESCE(SUM(cache_read_tokens), 0) FROM messages WHERE {msg_clause}) as total_cache_read_tokens"
                ),
                vec![scope_val.clone(), scope_val.clone(), scope_val.clone(), scope_val.clone(), scope_val.clone()],
            ))
            .one(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?
        } else {
            // Unscoped: use pre-aggregated global_aggregates
            GlobalAgg::find_by_statement(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT total_sessions, total_messages, total_input_tokens, \
                 total_output_tokens, total_cache_read_tokens \
                 FROM global_aggregates WHERE id = 1"
                    .to_string(),
            ))
            .one(db)
            .await
            .map_err(|e| Error::new(e.to_string()))?
        };

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

        // Calculate current streak: consecutive days with activity ending today or yesterday
        let streak_days = {
            use chrono::{NaiveDate, Utc};
            let today = Utc::now().date_naive();
            let mut streak = 0i32;
            // daily_activity is sorted ASC by date — iterate in reverse
            let mut expected = today;
            for day in daily_activity.iter().rev() {
                if let Some(ref date_str) = day.date {
                    if let Ok(d) = NaiveDate::parse_from_str(date_str, "%Y-%m-%d") {
                        if d == expected {
                            streak += 1;
                            expected = d - chrono::Duration::days(1);
                        } else if streak == 0 && d == today - chrono::Duration::days(1) {
                            // Allow streak to start from yesterday if no activity today yet
                            streak += 1;
                            expected = d - chrono::Duration::days(1);
                        } else if d < expected {
                            break; // Gap found
                        }
                        // d > expected means duplicate or future date, skip
                    }
                }
            }
            streak
        };

        // Model data from stats-cache.json (global only — no per-project breakdown)
        let (model_usage, daily_model_tokens) = load_stats_cache_model_data();

        Ok(Some(ActivityData {
            daily_activity: Some(daily_activity),
            hourly_activity: Some(hourly_activity),
            token_usage,
            daily_model_tokens: Some(daily_model_tokens),
            model_usage: Some(model_usage),
            total_sessions: Some(total_sessions),
            total_messages: Some(total_messages),
            streak_days: Some(streak_days),
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
        project_id: Option<String>,
        repo_id: Option<String>,
    ) -> Result<Option<DashboardAnalytics>> {
        let db = ctx.data::<DatabaseConnection>()?;
        let days = days.unwrap_or(30);

        // Check TTL cache (30s) — dashboardAnalytics is expensive (~4s) and
        // the underlying data (30-day aggregates) doesn't change between requests.
        let cache_key = format!("{}-{:?}-{:?}", days, project_id, repo_id);
        {
            let guard = ANALYTICS_CACHE.lock().unwrap();
            if let Some((cached_at, ref key, ref data)) = *guard {
                if key == &cache_key && cached_at.elapsed().as_secs() < 30 {
                    return Ok(Some(data.clone()));
                }
            }
        }

        let scope = session_scope_filter("session_id", &project_id, &repo_id);

        // Tool usage breakdown
        #[derive(Debug, FromQueryResult)]
        struct ToolRow {
            tool_name: String,
            count: i64,
        }

        let (tool_sql, tool_values) = if let Some((ref sc, ref sv)) = scope {
            (
                format!(
                    "SELECT tool_name, COUNT(*) as count FROM messages \
                     WHERE tool_name IS NOT NULL AND message_type != 'han_event' \
                     AND timestamp >= date('now', ? || ' days') AND {sc} \
                     GROUP BY tool_name ORDER BY count DESC LIMIT 20"
                ),
                vec![format!("-{days}").into(), sv.clone()],
            )
        } else {
            (
                "SELECT tool_name, COUNT(*) as count FROM messages \
                 WHERE tool_name IS NOT NULL AND message_type != 'han_event' \
                 AND timestamp >= date('now', ? || ' days') \
                 GROUP BY tool_name ORDER BY count DESC LIMIT 20"
                    .to_string(),
                vec![format!("-{days}").into()],
            )
        };

        let tool_rows = ToolRow::find_by_statement(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            tool_sql,
            tool_values,
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

        let (hook_sql, hook_values): (String, Vec<sea_orm::Value>) =
            if let Some((ref sc, ref sv)) = scope {
                (
                    format!(
                        "SELECT hook_name, COUNT(*) as total_runs, \
                     SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as pass_count, \
                     SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as fail_count, \
                     AVG(duration_ms) as avg_duration_ms \
                     FROM hook_executions WHERE {sc} \
                     GROUP BY hook_name ORDER BY total_runs DESC"
                    ),
                    vec![sv.clone()],
                )
            } else {
                (
                    "SELECT hook_name, COUNT(*) as total_runs, \
                 SUM(CASE WHEN passed = 1 THEN 1 ELSE 0 END) as pass_count, \
                 SUM(CASE WHEN passed = 0 THEN 1 ELSE 0 END) as fail_count, \
                 AVG(duration_ms) as avg_duration_ms \
                 FROM hook_executions GROUP BY hook_name ORDER BY total_runs DESC"
                        .to_string(),
                    vec![],
                )
            };

        let hook_rows = HookRow::find_by_statement(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            hook_sql,
            hook_values,
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

        // ====================================================================
        // Phase 1: Compaction Stats
        // ====================================================================
        #[derive(Debug, FromQueryResult)]
        struct CompactionRow {
            total_compactions: i64,
            sessions_with_compactions: i64,
            auto_compact_count: i64,
            manual_compact_count: i64,
            continuation_count: i64,
        }

        let (compact_sql, compact_values): (String, Vec<sea_orm::Value>) = if let Some((
            ref sc,
            ref sv,
        )) = scope
        {
            (
                format!(
                    "SELECT \
                     COUNT(*) as total_compactions, \
                     COUNT(DISTINCT session_id) as sessions_with_compactions, \
                     SUM(CASE WHEN compact_type = 'auto_compact' THEN 1 ELSE 0 END) as auto_compact_count, \
                     SUM(CASE WHEN compact_type = 'compact' THEN 1 ELSE 0 END) as manual_compact_count, \
                     SUM(CASE WHEN compact_type = 'continuation' THEN 1 ELSE 0 END) as continuation_count \
                     FROM session_compacts WHERE {sc}"
                ),
                vec![sv.clone()],
            )
        } else {
            (
                "SELECT \
                 COUNT(*) as total_compactions, \
                 COUNT(DISTINCT session_id) as sessions_with_compactions, \
                 SUM(CASE WHEN compact_type = 'auto_compact' THEN 1 ELSE 0 END) as auto_compact_count, \
                 SUM(CASE WHEN compact_type = 'compact' THEN 1 ELSE 0 END) as manual_compact_count, \
                 SUM(CASE WHEN compact_type = 'continuation' THEN 1 ELSE 0 END) as continuation_count \
                 FROM session_compacts"
                    .to_string(),
                vec![],
            )
        };

        let compaction_row = CompactionRow::find_by_statement(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            compact_sql,
            compact_values,
        ))
        .one(db)
        .await
        .unwrap_or(None);

        // Get total sessions for compaction calculations
        #[derive(Debug, FromQueryResult)]
        struct GlobalSessionCount {
            total_sessions: i64,
        }
        let global_sessions = if let Some((ref _sc, ref sv)) = scope {
            // Scoped: count sessions in scope
            let id_scope = session_scope_filter("id", &project_id, &repo_id).unwrap();
            GlobalSessionCount::find_by_statement(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                format!(
                    "SELECT COUNT(*) as total_sessions FROM sessions WHERE {}",
                    id_scope.0
                ),
                vec![sv.clone()],
            ))
            .one(db)
            .await
            .unwrap_or(None)
            .map(|r| r.total_sessions)
            .unwrap_or(0)
        } else {
            GlobalSessionCount::find_by_statement(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT total_sessions FROM global_aggregates WHERE id = 1".to_string(),
            ))
            .one(db)
            .await
            .unwrap_or(None)
            .map(|r| r.total_sessions)
            .unwrap_or(0)
        };

        let compaction_stats = compaction_row.map(|r| {
            let sessions_without = (global_sessions - r.sessions_with_compactions).max(0);
            let avg_per_session = if global_sessions > 0 {
                r.total_compactions as f64 / global_sessions as f64
            } else {
                0.0
            };
            crate::types::dashboard::CompactionStats {
                total_compactions: Some(r.total_compactions as i32),
                sessions_with_compactions: Some(r.sessions_with_compactions as i32),
                sessions_without_compactions: Some(sessions_without as i32),
                avg_compactions_per_session: Some(avg_per_session),
                auto_compact_count: Some(r.auto_compact_count as i32),
                manual_compact_count: Some(r.manual_compact_count as i32),
                continuation_count: Some(r.continuation_count as i32),
            }
        });

        // ====================================================================
        // Phase 2: Subagent Usage
        // ====================================================================
        #[derive(Debug, FromQueryResult)]
        struct SubagentRow {
            subagent_type: Option<String>,
            count: i64,
        }

        let (subagent_sql, subagent_values) = if let Some((ref sc, ref sv)) = scope {
            (
                format!(
                    "SELECT \
                     json_extract(tool_input, '$.subagent_type') as subagent_type, \
                     COUNT(*) as count \
                     FROM messages \
                     WHERE tool_name IN ('Agent', 'Task') \
                     AND tool_input IS NOT NULL \
                     AND timestamp >= date('now', ? || ' days') \
                     AND {sc} \
                     GROUP BY subagent_type \
                     ORDER BY count DESC"
                ),
                vec![format!("-{days}").into(), sv.clone()],
            )
        } else {
            (
                "SELECT \
                 json_extract(tool_input, '$.subagent_type') as subagent_type, \
                 COUNT(*) as count \
                 FROM messages \
                 WHERE tool_name IN ('Agent', 'Task') \
                 AND tool_input IS NOT NULL \
                 AND timestamp >= date('now', ? || ' days') \
                 GROUP BY subagent_type \
                 ORDER BY count DESC"
                    .to_string(),
                vec![format!("-{days}").into()],
            )
        };

        let subagent_rows = SubagentRow::find_by_statement(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            subagent_sql,
            subagent_values,
        ))
        .all(db)
        .await
        .unwrap_or_default();

        let subagent_usage: Vec<crate::types::dashboard::SubagentUsageStats> = subagent_rows
            .into_iter()
            .filter(|r| r.subagent_type.is_some())
            .map(|r| crate::types::dashboard::SubagentUsageStats {
                subagent_type: r.subagent_type,
                count: Some(r.count as i32),
            })
            .collect();

        // ====================================================================
        // Phase 3: Session Effectiveness (Top/Bottom Sessions)
        // ====================================================================
        #[derive(Debug, FromQueryResult)]
        struct EffectivenessRow {
            session_id: String,
            slug: Option<String>,
            summary: Option<String>,
            started_at: Option<String>,
            turn_count: i64,
            avg_sentiment: Option<f64>,
            completed_tasks: i64,
            total_tasks: i64,
            compaction_count: i64,
        }

        let (eff_sql, eff_values) = if let Some((_, ref sv)) = scope {
            let s_scope = session_scope_filter("s.id", &project_id, &repo_id).unwrap();
            (
                format!(
                    "SELECT \
                     s.id as session_id, \
                     s.slug, \
                     (SELECT content FROM messages WHERE session_id = s.id AND role = 'user' ORDER BY timestamp ASC LIMIT 1) as summary, \
                     MIN(m.timestamp) as started_at, \
                     COUNT(DISTINCT CASE WHEN m.role = 'user' THEN m.id END) as turn_count, \
                     AVG(m.sentiment_score) as avg_sentiment, \
                     COALESCE(tc.completed_tasks, 0) as completed_tasks, \
                     COALESCE(tc.total_tasks, 0) as total_tasks, \
                     COALESCE(cc.compaction_count, 0) as compaction_count \
                     FROM sessions s \
                     JOIN messages m ON m.session_id = s.id \
                     LEFT JOIN ( \
                       SELECT session_id, \
                         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks, \
                         COUNT(*) as total_tasks \
                       FROM native_tasks GROUP BY session_id \
                     ) tc ON tc.session_id = s.id \
                     LEFT JOIN ( \
                       SELECT session_id, COUNT(*) as compaction_count \
                       FROM session_compacts GROUP BY session_id \
                     ) cc ON cc.session_id = s.id \
                     WHERE m.timestamp >= date('now', ? || ' days') AND {} \
                     GROUP BY s.id \
                     HAVING turn_count >= 2",
                    s_scope.0
                ),
                vec![format!("-{days}").into(), sv.clone()],
            )
        } else {
            (
                "SELECT \
                 s.id as session_id, \
                 s.slug, \
                 (SELECT content FROM messages WHERE session_id = s.id AND role = 'user' ORDER BY timestamp ASC LIMIT 1) as summary, \
                 MIN(m.timestamp) as started_at, \
                 COUNT(DISTINCT CASE WHEN m.role = 'user' THEN m.id END) as turn_count, \
                 AVG(m.sentiment_score) as avg_sentiment, \
                 COALESCE(tc.completed_tasks, 0) as completed_tasks, \
                 COALESCE(tc.total_tasks, 0) as total_tasks, \
                 COALESCE(cc.compaction_count, 0) as compaction_count \
                 FROM sessions s \
                 JOIN messages m ON m.session_id = s.id \
                 LEFT JOIN ( \
                   SELECT session_id, \
                     SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed_tasks, \
                     COUNT(*) as total_tasks \
                   FROM native_tasks GROUP BY session_id \
                 ) tc ON tc.session_id = s.id \
                 LEFT JOIN ( \
                   SELECT session_id, COUNT(*) as compaction_count \
                   FROM session_compacts GROUP BY session_id \
                 ) cc ON cc.session_id = s.id \
                 WHERE m.timestamp >= date('now', ? || ' days') \
                 GROUP BY s.id \
                 HAVING turn_count >= 2"
                    .to_string(),
                vec![format!("-{days}").into()],
            )
        };

        let effectiveness_rows = EffectivenessRow::find_by_statement(
            Statement::from_sql_and_values(DbBackend::Sqlite, eff_sql, eff_values),
        )
        .all(db)
        .await
        .unwrap_or_default();

        // Find max turn count for focus score normalization
        let max_turn_count = effectiveness_rows
            .iter()
            .map(|r| r.turn_count)
            .max()
            .unwrap_or(1)
            .max(1) as f64;

        // Score each session
        let mut scored_sessions: Vec<(f64, crate::types::dashboard::SessionEffectiveness)> =
            effectiveness_rows
                .into_iter()
                .map(|r| {
                    let task_completion_rate = if r.total_tasks > 0 {
                        r.completed_tasks as f64 / r.total_tasks as f64
                    } else {
                        0.5 // neutral if no tasks
                    };
                    let compaction_penalty = (r.compaction_count as f64 / 3.0).min(1.0);
                    let sentiment_normalized =
                        r.avg_sentiment.map(|s| (s + 1.0) / 2.0).unwrap_or(0.5);
                    let focus_score = 1.0 - (r.turn_count as f64 / max_turn_count);

                    let score = task_completion_rate * 0.4
                        + (1.0 - compaction_penalty) * 0.2
                        + sentiment_normalized * 0.2
                        + focus_score * 0.2;

                    let sentiment_trend = match r.avg_sentiment {
                        Some(s) if s > 0.3 => "improving",
                        Some(s) if s < -0.3 => "declining",
                        _ => "neutral",
                    };

                    let summary_truncated = r.summary.map(|s| {
                        if s.len() > 120 {
                            format!("{}...", &s[..120])
                        } else {
                            s
                        }
                    });

                    (
                        score,
                        crate::types::dashboard::SessionEffectiveness {
                            session_id: Some(r.session_id),
                            slug: r.slug,
                            summary: summary_truncated,
                            started_at: r.started_at,
                            score: Some((score * 100.0).round()),
                            sentiment_trend: Some(sentiment_trend.to_string()),
                            avg_sentiment_score: r.avg_sentiment,
                            turn_count: Some(r.turn_count as i32),
                            task_completion_rate: Some(task_completion_rate),
                            compaction_count: Some(r.compaction_count as i32),
                            focus_score: Some(focus_score),
                        },
                    )
                })
                .collect();

        // Top 5 (highest score)
        scored_sessions.sort_by(|a, b| b.0.partial_cmp(&a.0).unwrap_or(std::cmp::Ordering::Equal));
        let top_sessions: Vec<_> = scored_sessions
            .iter()
            .take(5)
            .map(|(_, s)| s.clone())
            .collect();

        // Bottom 5 (lowest score)
        let bottom_sessions: Vec<_> = scored_sessions
            .iter()
            .rev()
            .take(5)
            .map(|(_, s)| s.clone())
            .collect();

        // ====================================================================
        // Phase 4: Cost Analysis Improvements
        // ====================================================================
        #[derive(Debug, FromQueryResult)]
        struct CostAgg {
            total_sessions: i64,
            total_completed_tasks: i64,
            total_input_tokens: i64,
            total_output_tokens: i64,
            total_cache_read_tokens: i64,
        }
        let cost_agg = if let Some((ref _sc, ref sv)) = scope {
            // Scoped: compute from raw tables
            let completed_scope =
                session_scope_filter("session_id", &project_id, &repo_id).unwrap();
            let msg_scope = session_scope_filter("session_id", &project_id, &repo_id).unwrap();

            // Get completed tasks count
            let completed_row = db
                .query_one(Statement::from_sql_and_values(
                    DbBackend::Sqlite,
                    format!("SELECT COUNT(*) as cnt FROM native_tasks WHERE status = 'completed' AND {}", completed_scope.0),
                    vec![sv.clone()],
                ))
                .await
                .map_err(|e| Error::new(e.to_string()))?;
            let total_completed_tasks = completed_row
                .map(|r| r.try_get::<i64>("", "cnt").unwrap_or(0))
                .unwrap_or(0);

            // Get token totals from messages
            let token_row = db
                .query_one(Statement::from_sql_and_values(
                    DbBackend::Sqlite,
                    format!(
                        "SELECT COUNT(DISTINCT session_id) as total_sessions, \
                         COALESCE(SUM(input_tokens), 0) as total_input_tokens, \
                         COALESCE(SUM(output_tokens), 0) as total_output_tokens, \
                         COALESCE(SUM(cache_read_tokens), 0) as total_cache_read_tokens \
                         FROM messages WHERE {}",
                        msg_scope.0
                    ),
                    vec![sv.clone()],
                ))
                .await
                .map_err(|e| Error::new(e.to_string()))?;

            token_row.map(|r| CostAgg {
                total_sessions: r.try_get("", "total_sessions").unwrap_or(0),
                total_completed_tasks,
                total_input_tokens: r.try_get("", "total_input_tokens").unwrap_or(0),
                total_output_tokens: r.try_get("", "total_output_tokens").unwrap_or(0),
                total_cache_read_tokens: r.try_get("", "total_cache_read_tokens").unwrap_or(0),
            })
        } else {
            CostAgg::find_by_statement(Statement::from_string(
                DbBackend::Sqlite,
                "SELECT total_sessions, total_completed_tasks, total_input_tokens, \
                 total_output_tokens, total_cache_read_tokens \
                 FROM global_aggregates WHERE id = 1"
                    .to_string(),
            ))
            .one(db)
            .await
            .unwrap_or(None)
        };

        // Daily cost trend
        let daily_cost_rows = if let Some((ref sc, ref sv)) = scope {
            // Scoped: compute from raw messages
            DailyActivityRow::find_by_statement(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                format!(
                    "SELECT date(timestamp, 'localtime') as date, \
                     COUNT(DISTINCT session_id) as session_count, \
                     COUNT(*) as message_count, \
                     COALESCE(SUM(input_tokens), 0) as input_tokens, \
                     COALESCE(SUM(output_tokens), 0) as output_tokens, \
                     COALESCE(SUM(cache_read_tokens), 0) as cached_tokens, \
                     COALESCE(SUM(lines_added), 0) as lines_added, \
                     COALESCE(SUM(lines_removed), 0) as lines_removed, \
                     COALESCE(SUM(files_changed), 0) as files_changed \
                     FROM messages \
                     WHERE timestamp >= date('now', ? || ' days') AND {sc} \
                     GROUP BY date(timestamp, 'localtime') \
                     ORDER BY date ASC"
                ),
                vec![format!("-{days}").into(), sv.clone()],
            ))
            .all(db)
            .await
            .unwrap_or_default()
        } else {
            DailyActivityRow::find_by_statement(Statement::from_sql_and_values(
                DbBackend::Sqlite,
                "SELECT date, session_count, message_count, input_tokens, output_tokens, \
                 cache_read_tokens as cached_tokens, lines_added, lines_removed, files_changed \
                 FROM daily_aggregates \
                 WHERE date >= date('now', 'localtime', ? || ' days') \
                 ORDER BY date ASC",
                vec![format!("-{days}").into()],
            ))
            .all(db)
            .await
            .unwrap_or_default()
        };

        // Per-model pricing from stats-cache.json (global only — not scoped)
        let (model_usage, _) = load_stats_cache_model_data();
        let total_per_model_cost: f64 = if scope.is_some() {
            // Scoped dashboards can't use global per-model stats; use estimated pricing
            0.0
        } else {
            model_usage.iter().filter_map(|m| m.cost_usd).sum()
        };

        // Infer subscription from model usage
        let has_opus = model_usage
            .iter()
            .any(|m| m.model.as_deref().unwrap_or("").contains("opus"));
        let (billing_type, max_subscription) = if has_opus {
            ("max_subscription".to_string(), 200.0)
        } else {
            ("pro_subscription".to_string(), 20.0)
        };

        // Phase 4d: Top sessions by cost
        #[derive(Debug, FromQueryResult)]
        struct SessionCostRow {
            session_id: String,
            slug: Option<String>,
            input_tokens: i64,
            output_tokens: i64,
            cache_read_tokens: i64,
            message_count: i64,
            started_at: Option<String>,
        }

        let (top_cost_sql, top_cost_values) = if let Some((_, ref sv)) = scope {
            let m_scope = session_scope_filter("m.session_id", &project_id, &repo_id).unwrap();
            (
                format!(
                    "SELECT m.session_id, s.slug, \
                     SUM(m.input_tokens) as input_tokens, \
                     SUM(m.output_tokens) as output_tokens, \
                     SUM(m.cache_read_tokens) as cache_read_tokens, \
                     COUNT(*) as message_count, \
                     MIN(m.timestamp) as started_at \
                     FROM messages m \
                     JOIN sessions s ON s.id = m.session_id \
                     WHERE m.timestamp >= date('now', ? || ' days') AND {} \
                     GROUP BY m.session_id \
                     ORDER BY (SUM(m.input_tokens) * 3.0 + SUM(m.output_tokens) * 15.0 + SUM(m.cache_read_tokens) * 0.3) DESC \
                     LIMIT 5",
                    m_scope.0
                ),
                vec![format!("-{days}").into(), sv.clone()],
            )
        } else {
            (
                "SELECT m.session_id, s.slug, \
                 SUM(m.input_tokens) as input_tokens, \
                 SUM(m.output_tokens) as output_tokens, \
                 SUM(m.cache_read_tokens) as cache_read_tokens, \
                 COUNT(*) as message_count, \
                 MIN(m.timestamp) as started_at \
                 FROM messages m \
                 JOIN sessions s ON s.id = m.session_id \
                 WHERE m.timestamp >= date('now', ? || ' days') \
                 GROUP BY m.session_id \
                 ORDER BY (SUM(m.input_tokens) * 3.0 + SUM(m.output_tokens) * 15.0 + SUM(m.cache_read_tokens) * 0.3) DESC \
                 LIMIT 5"
                    .to_string(),
                vec![format!("-{days}").into()],
            )
        };

        let top_cost_rows = SessionCostRow::find_by_statement(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            top_cost_sql,
            top_cost_values,
        ))
        .all(db)
        .await
        .unwrap_or_default();

        let top_sessions_by_cost: Vec<SessionCost> = top_cost_rows
            .into_iter()
            .map(|r| {
                let cost = estimate_cost_usd(r.input_tokens, r.output_tokens, r.cache_read_tokens);
                SessionCost {
                    session_id: Some(r.session_id),
                    slug: r.slug,
                    cost_usd: Some(cost),
                    input_tokens: Some(r.input_tokens as i32),
                    output_tokens: Some(r.output_tokens as i32),
                    cache_read_tokens: Some(r.cache_read_tokens as i32),
                    message_count: Some(r.message_count as i32),
                    started_at: r.started_at,
                }
            })
            .collect();

        let cost_analysis = cost_agg.map(|agg| {
            let sonnet_cost = estimate_cost_usd(
                agg.total_input_tokens,
                agg.total_output_tokens,
                agg.total_cache_read_tokens,
            );
            // Use per-model cost when available, fall back to Sonnet estimate
            let (total_cost, is_estimated) = if total_per_model_cost > 0.0 {
                (total_per_model_cost, false)
            } else {
                (sonnet_cost, true)
            };

            let total_tokens =
                agg.total_input_tokens + agg.total_output_tokens + agg.total_cache_read_tokens;
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
                    cost_usd: Some(estimate_cost_usd(
                        r.input_tokens,
                        r.output_tokens,
                        r.cached_tokens,
                    )),
                    session_count: Some(r.session_count as i32),
                })
                .collect();

            // Phase 4c: Weekly cost trend from daily data
            let weekly_cost_trend: Vec<WeeklyCost> = daily_cost_trend
                .chunks(7)
                .map(|week| {
                    let cost: f64 = week.iter().filter_map(|d| d.cost_usd).sum();
                    let sessions: i32 = week.iter().filter_map(|d| d.session_count).sum();
                    let week_start = week.first().and_then(|d| d.date.clone());
                    let week_end = week.last().and_then(|d| d.date.clone());
                    let week_label = match (&week_start, &week_end) {
                        (Some(start), Some(end)) => {
                            let s = start.get(5..).unwrap_or(start);
                            let e = end.get(5..).unwrap_or(end);
                            format!("{s} - {e}")
                        }
                        (Some(start), None) => start.clone(),
                        _ => String::new(),
                    };
                    WeeklyCost {
                        week_start,
                        week_label: Some(week_label),
                        cost_usd: Some(cost),
                        session_count: Some(sessions),
                        avg_daily_cost: Some(cost / week.len() as f64),
                    }
                })
                .collect();

            CostAnalysis {
                estimated_cost_usd: Some(total_cost),
                is_estimated: Some(is_estimated),
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
                max_subscription_cost_usd: Some(max_subscription),
                cost_utilization_percent: Some((total_cost / max_subscription) * 100.0),
                break_even_daily_spend: Some(max_subscription / 30.0),
                billing_type: Some(billing_type.clone()),
                daily_cost_trend: Some(daily_cost_trend),
                weekly_cost_trend: Some(weekly_cost_trend),
                top_sessions_by_cost: Some(top_sessions_by_cost),
                potential_savings_usd: Some(0.0),
                subscription_comparisons: Some(vec![]),
                config_dir_breakdowns: Some(vec![]),
            }
        });

        // ====================================================================
        // Performance Trend: weekly aggregation from scored sessions
        // ====================================================================
        let performance_trend = {
            let mut weekly: std::collections::BTreeMap<String, (f64, f64, f64, i32)> =
                std::collections::BTreeMap::new();

            for (score, session) in &scored_sessions {
                if let Some(ref started_at) = session.started_at {
                    if let Some(date_str) = started_at.split('T').next() {
                        // Parse date and compute ISO week start (Monday)
                        let parts: Vec<&str> = date_str.split('-').collect();
                        if parts.len() == 3 {
                            if let (Ok(y), Ok(m), Ok(d)) = (
                                parts[0].parse::<i32>(),
                                parts[1].parse::<u32>(),
                                parts[2].parse::<u32>(),
                            ) {
                                if let Some(date) = chrono::NaiveDate::from_ymd_opt(y, m, d) {
                                    let weekday = date.weekday().num_days_from_monday();
                                    let monday = date - chrono::Duration::days(weekday as i64);
                                    let week_key = monday.format("%Y-%m-%d").to_string();

                                    let turn_count = session.turn_count.unwrap_or(0) as f64;
                                    let compaction_count =
                                        session.compaction_count.unwrap_or(0) as f64;

                                    let entry =
                                        weekly.entry(week_key).or_insert((0.0, 0.0, 0.0, 0));
                                    entry.0 += turn_count;
                                    entry.1 += compaction_count;
                                    entry.2 += score;
                                    entry.3 += 1;
                                }
                            }
                        }
                    }
                }
            }

            weekly
                .into_iter()
                .map(|(week_start, (turns, compactions, scores, count))| {
                    // Format week label like "Jan 6 - Jan 12"
                    let label = if let Ok(start) =
                        chrono::NaiveDate::parse_from_str(&week_start, "%Y-%m-%d")
                    {
                        let end = start + chrono::Duration::days(6);
                        let start_month = start.format("%b").to_string();
                        let end_month = end.format("%b").to_string();
                        if start_month == end_month {
                            format!("{} {} - {}", start_month, start.day(), end.day())
                        } else {
                            format!(
                                "{} {} - {} {}",
                                start_month,
                                start.day(),
                                end_month,
                                end.day()
                            )
                        }
                    } else {
                        week_start.clone()
                    };

                    SessionPerformancePoint {
                        week_start: Some(week_start),
                        week_label: Some(label),
                        session_count: Some(count),
                        avg_turns: Some((turns / count as f64 * 10.0).round() / 10.0),
                        avg_compactions: Some((compactions / count as f64 * 100.0).round() / 100.0),
                        avg_effectiveness: Some((scores / count as f64 * 10.0).round() / 10.0),
                    }
                })
                .collect::<Vec<_>>()
        };

        // ====================================================================
        // Phase 6: Human Time Estimation (from pre-computed human_time_ms)
        // ====================================================================
        //
        // human_time_ms is computed per-message at index time by the indexer.
        // Here we aggregate via SUM and group for breakdowns.

        #[derive(Debug, FromQueryResult)]
        struct HumanTimeTotalRow {
            total_human_ms: i64,
            ai_duration_seconds: f64,
        }

        #[derive(Debug, FromQueryResult)]
        struct HumanTimeByTypeRow {
            category: String,
            category_ms: i64,
        }

        #[derive(Debug, FromQueryResult)]
        struct HumanTimeByToolRow {
            tool_name: String,
            invocations: i64,
            tool_ms: i64,
        }

        // Query 1: Total human time and AI wall-clock duration
        // AI duration = SUM of per-session durations (max - min timestamp within each session),
        // NOT the span from oldest to newest message across all sessions (which would be ~30 days).
        let (ht_total_sql, ht_total_values) = if let Some((ref sc, ref sv)) = scope {
            (
                format!(
                    "SELECT \
                     COALESCE(SUM(human_time_ms), 0) as total_human_ms, \
                     COALESCE(( \
                       SELECT SUM(session_dur) FROM ( \
                         SELECT (julianday(MAX(timestamp)) - julianday(MIN(timestamp))) * 86400.0 as session_dur \
                         FROM messages \
                         WHERE timestamp >= date('now', ? || ' days') AND {sc} \
                         GROUP BY session_id \
                         HAVING COUNT(*) > 1 \
                       ) \
                     ), 0.0) as ai_duration_seconds \
                     FROM messages \
                     WHERE timestamp >= date('now', ? || ' days') AND {sc}"
                ),
                vec![format!("-{days}").into(), sv.clone(), format!("-{days}").into(), sv.clone()],
            )
        } else {
            (
                "SELECT \
                 COALESCE(SUM(human_time_ms), 0) as total_human_ms, \
                 COALESCE(( \
                   SELECT SUM(session_dur) FROM ( \
                     SELECT (julianday(MAX(timestamp)) - julianday(MIN(timestamp))) * 86400.0 as session_dur \
                     FROM messages \
                     WHERE timestamp >= date('now', ? || ' days') \
                     GROUP BY session_id \
                     HAVING COUNT(*) > 1 \
                   ) \
                 ), 0.0) as ai_duration_seconds \
                 FROM messages \
                 WHERE timestamp >= date('now', ? || ' days')"
                    .to_string(),
                vec![format!("-{days}").into(), format!("-{days}").into()],
            )
        };

        // Query 2: Breakdown by category
        // Split assistant messages into "Reading AI Output" (token-based) and "Writing Code" (lines-based)
        // using UNION ALL to compute each sub-category from the raw columns.
        let cat_core = |where_clause: &str| {
            format!(
            "SELECT 'Reading AI Output' as category, \
               COALESCE(SUM(CAST(output_tokens AS BIGINT) * 320), 0) as category_ms \
             FROM messages WHERE message_type = 'assistant' AND output_tokens IS NOT NULL AND {where_clause} \
             UNION ALL \
             SELECT 'Writing Code' as category, \
               COALESCE(SUM(CAST(lines_added AS BIGINT) * 12000), 0) as category_ms \
             FROM messages WHERE message_type = 'assistant' AND lines_added IS NOT NULL AND lines_added > 0 AND {where_clause} \
             UNION ALL \
             SELECT 'Thinking & Deciding' as category, \
               COALESCE(SUM(human_time_ms), 0) as category_ms \
             FROM messages WHERE message_type = 'user' AND human_time_ms IS NOT NULL AND {where_clause} \
             UNION ALL \
             SELECT 'Navigation & Tools' as category, \
               COALESCE(SUM(human_time_ms), 0) as category_ms \
             FROM messages WHERE message_type = 'tool_use' AND human_time_ms IS NOT NULL AND {where_clause}"
        )
        };
        let (ht_cat_sql, ht_cat_values) = if let Some((ref sc, ref sv)) = scope {
            let w = format!("timestamp >= date('now', ? || ' days') AND {sc}");
            (
                cat_core(&w),
                vec![
                    format!("-{days}").into(),
                    sv.clone(),
                    format!("-{days}").into(),
                    sv.clone(),
                    format!("-{days}").into(),
                    sv.clone(),
                    format!("-{days}").into(),
                    sv.clone(),
                ],
            )
        } else {
            let w = "timestamp >= date('now', ? || ' days')";
            (
                cat_core(w),
                vec![
                    format!("-{days}").into(),
                    format!("-{days}").into(),
                    format!("-{days}").into(),
                    format!("-{days}").into(),
                ],
            )
        };

        // Query 3: Per-tool breakdown for tool_use messages
        let (ht_tool_sql, ht_tool_values) = if let Some((ref sc, ref sv)) = scope {
            (
                format!(
                    "SELECT \
                     COALESCE(tool_name, 'Unknown') as tool_name, \
                     COUNT(*) as invocations, \
                     COALESCE(SUM(human_time_ms), 0) as tool_ms \
                     FROM messages \
                     WHERE message_type = 'tool_use' AND human_time_ms IS NOT NULL \
                       AND timestamp >= date('now', ? || ' days') AND {sc} \
                     GROUP BY tool_name ORDER BY tool_ms DESC LIMIT 15"
                ),
                vec![format!("-{days}").into(), sv.clone()],
            )
        } else {
            (
                "SELECT \
                 COALESCE(tool_name, 'Unknown') as tool_name, \
                 COUNT(*) as invocations, \
                 COALESCE(SUM(human_time_ms), 0) as tool_ms \
                 FROM messages \
                 WHERE message_type = 'tool_use' AND human_time_ms IS NOT NULL \
                   AND timestamp >= date('now', ? || ' days') \
                 GROUP BY tool_name ORDER BY tool_ms DESC LIMIT 15"
                    .to_string(),
                vec![format!("-{days}").into()],
            )
        };

        let total_row = HumanTimeTotalRow::find_by_statement(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            ht_total_sql,
            ht_total_values,
        ))
        .one(db)
        .await
        .unwrap_or(None);

        let cat_rows = HumanTimeByTypeRow::find_by_statement(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            ht_cat_sql,
            ht_cat_values,
        ))
        .all(db)
        .await
        .unwrap_or_default();

        let tool_rows = HumanTimeByToolRow::find_by_statement(Statement::from_sql_and_values(
            DbBackend::Sqlite,
            ht_tool_sql,
            ht_tool_values,
        ))
        .all(db)
        .await
        .unwrap_or_default();

        let human_time_estimate = total_row.map(|row| {
            let total_human_secs = row.total_human_ms as f64 / 1000.0;
            let ai_secs = row.ai_duration_seconds;
            let speedup = if ai_secs > 0.0 {
                total_human_secs / ai_secs
            } else {
                0.0
            };
            let hours_saved = ((total_human_secs - ai_secs) / 3600.0).max(0.0);

            let breakdown: Vec<HumanTimeBreakdown> = cat_rows
                .iter()
                .filter(|r| r.category_ms > 0)
                .map(|r| {
                    let secs = r.category_ms as f64 / 1000.0;
                    HumanTimeBreakdown {
                        category: Some(r.category.clone()),
                        human_seconds: Some((secs * 10.0).round() / 10.0),
                        percent: Some(if total_human_secs > 0.0 {
                            (secs / total_human_secs * 100.0).round()
                        } else {
                            0.0
                        }),
                    }
                })
                .collect();

            let tool_breakdown: Vec<ToolTimeEstimate> = tool_rows
                .iter()
                .filter(|r| r.tool_ms > 0)
                .map(|r| ToolTimeEstimate {
                    tool_name: Some(r.tool_name.clone()),
                    invocations: Some(i32::try_from(r.invocations).unwrap_or(i32::MAX)),
                    human_seconds: Some((r.tool_ms as f64 / 1000.0 * 10.0).round() / 10.0),
                })
                .collect();

            HumanTimeEstimate {
                total_human_seconds: Some((total_human_secs * 10.0).round() / 10.0),
                total_ai_seconds: Some((ai_secs * 10.0).round() / 10.0),
                speedup_factor: Some((speedup * 10.0).round() / 10.0),
                hours_saved: Some((hours_saved * 100.0).round() / 100.0),
                breakdown: Some(breakdown),
                tool_breakdown: Some(tool_breakdown),
            }
        });

        let result = DashboardAnalytics {
            top_sessions: Some(top_sessions),
            bottom_sessions: Some(bottom_sessions),
            compaction_stats,
            cost_analysis,
            hook_health: Some(hook_health),
            subagent_usage: Some(subagent_usage),
            tool_usage: Some(tool_usage),
            performance_trend: Some(performance_trend),
            human_time_estimate,
        };

        // Cache the result for 30 seconds
        {
            let mut guard = ANALYTICS_CACHE.lock().unwrap();
            *guard = Some((Instant::now(), cache_key, result.clone()));
        }

        Ok(Some(result))
    }
}

/// Load per-model usage data from ~/.claude/stats-cache.json.
fn load_stats_cache_model_data() -> (Vec<ModelUsageStats>, Vec<DailyModelTokens>) {
    let stats_path = dirs::home_dir().map(|h| h.join(".claude").join("stats-cache.json"));

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
            let cost =
                estimate_cost_for_model(&model_id, input, output, cache_read, cache_creation);
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
        harness: m.harness,
        status: m.status,
        pr_number: m.pr_number,
        pr_url: m.pr_url,
        team_name: m.team_name,
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
            harness: Some("omp".into()),
            pr_number: None,
            pr_url: None,
            team_name: None,
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
    fn session_model_to_data_maps_harness() {
        let sd = session_model_to_data(make_session_model());
        assert_eq!(sd.harness, Some("omp".into()));
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
            harness: None,
            pr_number: None,
            pr_url: None,
            team_name: None,
        };
        let sd = session_model_to_data(m);
        assert!(sd.project_id.is_none());
        assert!(sd.status.is_none());
        assert!(sd.slug.is_none());
        assert!(sd.source_config_dir.is_none());
        // A NULL harness column stays None here: the Session resolver is what
        // coalesces it to claude-code.
        assert!(sd.harness.is_none());
    }
}
