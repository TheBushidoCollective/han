//! CRUD operations for session_todos.

use crate::entities::session_todos;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn upsert(
    db: &DatabaseConnection,
    session_id: String,
    message_id: String,
    todos_json: String,
    timestamp: String,
    line_number: i32,
) -> DbResult<session_todos::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let session_id_clone = session_id.clone();

    session_todos::Entity::insert(session_todos::ActiveModel {
        id: Set(id),
        session_id: Set(session_id),
        message_id: Set(message_id),
        todos_json: Set(todos_json),
        timestamp: Set(timestamp),
        line_number: Set(line_number),
        indexed_at: Set(Some(now)),
    })
    .on_conflict(
        sea_query::OnConflict::column(session_todos::Column::SessionId)
            .update_columns([
                session_todos::Column::MessageId,
                session_todos::Column::TodosJson,
                session_todos::Column::Timestamp,
                session_todos::Column::LineNumber,
                session_todos::Column::IndexedAt,
            ])
            .to_owned(),
    )
    .exec(db)
    .await
    .map_err(DbError::Database)?;

    // Fetch the row after upsert
    session_todos::Entity::find()
        .filter(session_todos::Column::SessionId.eq(&session_id_clone))
        .one(db)
        .await
        .map_err(DbError::Database)?
        .ok_or(DbError::NotFound("session_todo".to_string()))
}

pub async fn get(db: &DatabaseConnection, session_id: &str) -> DbResult<Option<session_todos::Model>> {
    session_todos::Entity::find()
        .filter(session_todos::Column::SessionId.eq(session_id))
        .one(db)
        .await
        .map_err(DbError::Database)
}
