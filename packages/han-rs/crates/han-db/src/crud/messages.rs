//! CRUD operations for messages.

use crate::entities::messages;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn insert_batch(
    db: &DatabaseConnection,
    msgs: Vec<messages::ActiveModel>,
) -> DbResult<u64> {
    if msgs.is_empty() {
        return Ok(0);
    }

    let count = msgs.len() as u64;

    // Insert in batches to avoid SQLite variable limits.
    // SeaORM's insert_many with do_nothing errors when all records already exist,
    // so we catch that specific error and treat it as a no-op.
    for chunk in msgs.chunks(50) {
        let result = messages::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                sea_query::OnConflict::column(messages::Column::Id)
                    .do_nothing()
                    .to_owned(),
            )
            .exec(db)
            .await;
        match result {
            Ok(_) => {}
            Err(DbErr::RecordNotInserted) => {} // All records already exist, skip
            Err(e) => return Err(DbError::Database(e)),
        }
    }

    Ok(count)
}

pub async fn get(db: &DatabaseConnection, message_id: &str) -> DbResult<Option<messages::Model>> {
    messages::Entity::find_by_id(message_id)
        .one(db)
        .await
        .map_err(DbError::Database)
}

pub async fn list_by_session(
    db: &DatabaseConnection,
    session_id: &str,
    agent_id: Option<&str>,
    message_types: Option<Vec<String>>,
    limit: Option<u64>,
    offset: Option<u64>,
    order_desc: bool,
) -> DbResult<Vec<messages::Model>> {
    let mut query = messages::Entity::find().filter(messages::Column::SessionId.eq(session_id));

    if let Some(aid) = agent_id {
        query = query.filter(messages::Column::AgentId.eq(aid));
    } else {
        query = query.filter(messages::Column::AgentId.is_null());
    }

    if let Some(types) = message_types {
        query = query.filter(messages::Column::MessageType.is_in(types));
    }

    if order_desc {
        query = query.order_by_desc(messages::Column::LineNumber);
    } else {
        query = query.order_by_asc(messages::Column::LineNumber);
    }

    if let Some(l) = limit {
        query = query.limit(l);
    }
    if let Some(o) = offset {
        query = query.offset(o);
    }

    query.all(db).await.map_err(DbError::Database)
}

pub async fn get_count(db: &DatabaseConnection, session_id: &str) -> DbResult<u64> {
    messages::Entity::find()
        .filter(messages::Column::SessionId.eq(session_id))
        .count(db)
        .await
        .map_err(DbError::Database)
}

pub async fn get_counts_batch(
    db: &DatabaseConnection,
    session_ids: Vec<String>,
) -> DbResult<Vec<(String, u64)>> {
    use sea_orm::{ConnectionTrait, Statement};

    if session_ids.is_empty() {
        return Ok(vec![]);
    }

    let placeholders: Vec<String> = session_ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", i + 1))
        .collect();
    let sql = format!(
        "SELECT session_id, COUNT(*) as cnt FROM messages WHERE session_id IN ({}) GROUP BY session_id",
        placeholders.join(", ")
    );

    let values: Vec<Value> = session_ids
        .into_iter()
        .map(|s| Value::String(Some(Box::new(s))))
        .collect();
    let stmt = Statement::from_sql_and_values(db.get_database_backend(), &sql, values);
    let rows = db.query_all(stmt).await.map_err(DbError::Database)?;

    let mut results = Vec::new();
    for row in rows {
        let sid: String = row.try_get("", "session_id").unwrap_or_default();
        let cnt: i64 = row.try_get("", "cnt").unwrap_or(0);
        results.push((sid, cnt as u64));
    }
    Ok(results)
}

/// Find Han event result messages by call_id in raw JSON.
/// Used for mcp_tool_result and exposed_tool_result events.
pub async fn find_results_by_call_ids(
    db: &DatabaseConnection,
    call_ids: Vec<String>,
    tool_names: &[&str],
) -> DbResult<Vec<messages::Model>> {
    use sea_orm::{ConnectionTrait, Statement};

    if call_ids.is_empty() || tool_names.is_empty() {
        return Ok(vec![]);
    }

    let call_placeholders: Vec<String> = call_ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", i + 1))
        .collect();
    let tool_placeholders: Vec<String> = tool_names
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", call_ids.len() + i + 1))
        .collect();

    let sql = format!(
        "SELECT * FROM messages WHERE tool_name IN ({}) AND json_extract(raw_json, '$.data.call_id') IN ({})",
        tool_placeholders.join(", "),
        call_placeholders.join(", "),
    );

    let mut values: Vec<Value> = call_ids
        .into_iter()
        .map(|s| Value::String(Some(Box::new(s))))
        .collect();
    for tn in tool_names {
        values.push(Value::String(Some(Box::new(ToString::to_string(tn)))));
    }

    let stmt = Statement::from_sql_and_values(db.get_database_backend(), &sql, values);
    let rows = db.query_all(stmt).await.map_err(DbError::Database)?;

    rows_to_models(rows)
}

/// Find hook result messages by hook_run_id in raw JSON.
pub async fn find_results_by_hook_run_ids(
    db: &DatabaseConnection,
    run_ids: Vec<String>,
) -> DbResult<Vec<messages::Model>> {
    use sea_orm::{ConnectionTrait, Statement};

    if run_ids.is_empty() {
        return Ok(vec![]);
    }

    let placeholders: Vec<String> = run_ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", i + 1))
        .collect();

    let sql = format!(
        "SELECT * FROM messages WHERE tool_name = 'hook_result' AND json_extract(raw_json, '$.data.hook_run_id') IN ({})",
        placeholders.join(", "),
    );

    let values: Vec<Value> = run_ids
        .into_iter()
        .map(|s| Value::String(Some(Box::new(s))))
        .collect();

    let stmt = Statement::from_sql_and_values(db.get_database_backend(), &sql, values);
    let rows = db.query_all(stmt).await.map_err(DbError::Database)?;

    rows_to_models(rows)
}

/// Find all hook_result messages for the given sessions.
/// The DataLoader handles matching results to their hook_runs by
/// hook name + line proximity.
pub async fn find_hook_results_for_sessions(
    db: &DatabaseConnection,
    session_ids: Vec<String>,
) -> DbResult<Vec<messages::Model>> {
    if session_ids.is_empty() {
        return Ok(vec![]);
    }

    messages::Entity::find()
        .filter(messages::Column::SessionId.is_in(session_ids))
        .filter(messages::Column::ToolName.eq("hook_result"))
        .order_by_asc(messages::Column::LineNumber)
        .all(db)
        .await
        .map_err(DbError::Database)
}

/// Convert raw query results into messages::Model structs.
fn rows_to_models(rows: Vec<sea_orm::QueryResult>) -> DbResult<Vec<messages::Model>> {
    let mut results = Vec::new();
    for row in rows {
        results.push(messages::Model {
            id: row.try_get("", "id").unwrap_or_default(),
            session_id: row.try_get("", "session_id").unwrap_or_default(),
            agent_id: row.try_get("", "agent_id").ok(),
            parent_id: row.try_get("", "parent_id").ok(),
            message_type: row.try_get("", "message_type").unwrap_or_default(),
            role: row.try_get("", "role").ok(),
            content: row.try_get("", "content").ok(),
            tool_name: row.try_get("", "tool_name").ok(),
            tool_input: row.try_get("", "tool_input").ok(),
            tool_result: row.try_get("", "tool_result").ok(),
            raw_json: row.try_get("", "raw_json").ok(),
            timestamp: row.try_get("", "timestamp").unwrap_or_default(),
            line_number: row.try_get("", "line_number").unwrap_or(0),
            source_file_name: row.try_get("", "source_file_name").ok(),
            source_file_type: row.try_get("", "source_file_type").ok(),
            sentiment_score: row.try_get("", "sentiment_score").ok(),
            sentiment_level: row.try_get("", "sentiment_level").ok(),
            frustration_score: row.try_get("", "frustration_score").ok(),
            frustration_level: row.try_get("", "frustration_level").ok(),
            input_tokens: row.try_get("", "input_tokens").ok(),
            output_tokens: row.try_get("", "output_tokens").ok(),
            cache_read_tokens: row.try_get("", "cache_read_tokens").ok(),
            cache_creation_tokens: row.try_get("", "cache_creation_tokens").ok(),
            lines_added: row.try_get("", "lines_added").ok(),
            lines_removed: row.try_get("", "lines_removed").ok(),
            files_changed: row.try_get("", "files_changed").ok(),
            human_time_ms: row.try_get("", "human_time_ms").ok(),
            indexed_at: row.try_get("", "indexed_at").ok(),
        });
    }
    Ok(results)
}

pub async fn get_session_timestamps_batch(
    db: &DatabaseConnection,
    session_ids: Vec<String>,
) -> DbResult<Vec<(String, Option<String>, Option<String>, u64)>> {
    use sea_orm::{ConnectionTrait, Statement};

    if session_ids.is_empty() {
        return Ok(vec![]);
    }

    let placeholders: Vec<String> = session_ids
        .iter()
        .enumerate()
        .map(|(i, _)| format!("?{}", i + 1))
        .collect();
    let sql = format!(
        "SELECT session_id, MIN(timestamp) as started_at, MAX(timestamp) as ended_at, COUNT(*) as message_count
         FROM messages WHERE session_id IN ({}) GROUP BY session_id",
        placeholders.join(", ")
    );

    let values: Vec<Value> = session_ids
        .into_iter()
        .map(|s| Value::String(Some(Box::new(s))))
        .collect();
    let stmt = Statement::from_sql_and_values(db.get_database_backend(), &sql, values);
    let rows = db.query_all(stmt).await.map_err(DbError::Database)?;

    let mut results = Vec::new();
    for row in rows {
        let sid: String = row.try_get("", "session_id").unwrap_or_default();
        let started: Option<String> = row.try_get("", "started_at").ok();
        let ended: Option<String> = row.try_get("", "ended_at").ok();
        let count: i64 = row.try_get("", "message_count").unwrap_or(0);
        results.push((sid, started, ended, count as u64));
    }
    Ok(results)
}
