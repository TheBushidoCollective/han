//! CRUD operations for session_compacts.

use crate::entities::session_compacts;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn upsert(
    db: &DatabaseConnection,
    session_id: String,
    message_id: String,
    content: Option<String>,
    raw_json: Option<String>,
    timestamp: String,
    line_number: i32,
    compact_type: Option<String>,
) -> DbResult<session_compacts::Model> {
    let id = message_id.clone();
    let now = chrono::Utc::now().to_rfc3339();

    let session_id_clone = session_id.clone();

    session_compacts::Entity::insert(session_compacts::ActiveModel {
        id: Set(id),
        session_id: Set(session_id),
        message_id: Set(message_id),
        content: Set(content),
        raw_json: Set(raw_json),
        timestamp: Set(timestamp),
        line_number: Set(line_number),
        compact_type: Set(compact_type),
        indexed_at: Set(Some(now)),
    })
    .on_conflict(
        sea_query::OnConflict::column(session_compacts::Column::SessionId)
            .update_columns([
                session_compacts::Column::Id,
                session_compacts::Column::MessageId,
                session_compacts::Column::Content,
                session_compacts::Column::RawJson,
                session_compacts::Column::Timestamp,
                session_compacts::Column::LineNumber,
                session_compacts::Column::CompactType,
                session_compacts::Column::IndexedAt,
            ])
            .to_owned(),
    )
    .exec(db)
    .await
    .map_err(DbError::Database)?;

    // Fetch the row after upsert
    session_compacts::Entity::find()
        .filter(session_compacts::Column::SessionId.eq(&session_id_clone))
        .one(db)
        .await
        .map_err(DbError::Database)?
        .ok_or(DbError::NotFound("session_compact".to_string()))
}

pub async fn get(db: &DatabaseConnection, session_id: &str) -> DbResult<Option<session_compacts::Model>> {
    session_compacts::Entity::find()
        .filter(session_compacts::Column::SessionId.eq(session_id))
        .one(db)
        .await
        .map_err(DbError::Database)
}
