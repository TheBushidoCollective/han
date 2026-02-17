//! CRUD operations for session_file_changes.

use crate::entities::session_file_changes;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn record(
    db: &DatabaseConnection,
    session_id: String,
    file_path: String,
    action: String,
    file_hash_before: Option<String>,
    file_hash_after: Option<String>,
    tool_name: Option<String>,
    agent_id: Option<String>,
) -> DbResult<session_file_changes::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let result = session_file_changes::Entity::insert(session_file_changes::ActiveModel {
        id: Set(id),
        session_id: Set(session_id),
        file_path: Set(file_path),
        action: Set(action),
        file_hash_before: Set(file_hash_before),
        file_hash_after: Set(file_hash_after),
        tool_name: Set(tool_name),
        agent_id: Set(agent_id),
        recorded_at: Set(now),
    })
    .exec_with_returning(db)
    .await
    .map_err(DbError::Database)?;

    Ok(result)
}

pub async fn get_by_session(
    db: &DatabaseConnection,
    session_id: &str,
    agent_id: Option<&str>,
) -> DbResult<Vec<session_file_changes::Model>> {
    let mut query = session_file_changes::Entity::find()
        .filter(session_file_changes::Column::SessionId.eq(session_id));

    if let Some(aid) = agent_id {
        query = query.filter(session_file_changes::Column::AgentId.eq(aid));
    }

    query
        .order_by_asc(session_file_changes::Column::RecordedAt)
        .all(db)
        .await
        .map_err(DbError::Database)
}

pub async fn has_changes(db: &DatabaseConnection, session_id: &str, agent_id: Option<&str>) -> DbResult<bool> {
    let mut query = session_file_changes::Entity::find()
        .filter(session_file_changes::Column::SessionId.eq(session_id));

    if let Some(aid) = agent_id {
        query = query.filter(session_file_changes::Column::AgentId.eq(aid));
    } else {
        query = query.filter(session_file_changes::Column::AgentId.is_null());
    }

    let count = query.count(db).await.map_err(DbError::Database)?;
    Ok(count > 0)
}
