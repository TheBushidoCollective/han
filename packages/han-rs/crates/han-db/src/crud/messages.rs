//! CRUD operations for messages.

use crate::entities::messages;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn insert_batch(db: &DatabaseConnection, msgs: Vec<messages::ActiveModel>) -> DbResult<u64> {
    if msgs.is_empty() {
        return Ok(0);
    }

    let count = msgs.len() as u64;

    // Insert in batches to avoid SQLite variable limits
    for chunk in msgs.chunks(50) {
        messages::Entity::insert_many(chunk.to_vec())
            .on_conflict(
                sea_query::OnConflict::column(messages::Column::Id)
                    .do_nothing()
                    .to_owned(),
            )
            .exec(db)
            .await
            .map_err(DbError::Database)?;
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
    let mut query = messages::Entity::find()
        .filter(messages::Column::SessionId.eq(session_id));

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

pub async fn get_counts_batch(db: &DatabaseConnection, session_ids: Vec<String>) -> DbResult<Vec<(String, u64)>> {
    use sea_orm::{ConnectionTrait, Statement};

    if session_ids.is_empty() {
        return Ok(vec![]);
    }

    let placeholders: Vec<String> = session_ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let sql = format!(
        "SELECT session_id, COUNT(*) as cnt FROM messages WHERE session_id IN ({}) GROUP BY session_id",
        placeholders.join(", ")
    );

    let values: Vec<Value> = session_ids.into_iter().map(|s| Value::String(Some(Box::new(s)))).collect();
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

pub async fn get_session_timestamps_batch(
    db: &DatabaseConnection,
    session_ids: Vec<String>,
) -> DbResult<Vec<(String, Option<String>, Option<String>, u64)>> {
    use sea_orm::{ConnectionTrait, Statement};

    if session_ids.is_empty() {
        return Ok(vec![]);
    }

    let placeholders: Vec<String> = session_ids.iter().enumerate().map(|(i, _)| format!("?{}", i + 1)).collect();
    let sql = format!(
        "SELECT session_id, MIN(timestamp) as started_at, MAX(timestamp) as ended_at, COUNT(*) as message_count
         FROM messages WHERE session_id IN ({}) GROUP BY session_id",
        placeholders.join(", ")
    );

    let values: Vec<Value> = session_ids.into_iter().map(|s| Value::String(Some(Box::new(s)))).collect();
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
