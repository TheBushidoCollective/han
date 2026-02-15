//! CRUD operations for session_summaries.

use crate::entities::session_summaries;
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
) -> DbResult<session_summaries::Model> {
    let id = message_id.clone();
    let now = chrono::Utc::now().to_rfc3339();

    let session_id_clone = session_id.clone();

    session_summaries::Entity::insert(session_summaries::ActiveModel {
        id: Set(id),
        session_id: Set(session_id),
        message_id: Set(message_id),
        content: Set(content),
        raw_json: Set(raw_json),
        timestamp: Set(timestamp),
        line_number: Set(line_number),
        indexed_at: Set(Some(now)),
    })
    .on_conflict(
        sea_query::OnConflict::column(session_summaries::Column::SessionId)
            .update_columns([
                session_summaries::Column::Id,
                session_summaries::Column::MessageId,
                session_summaries::Column::Content,
                session_summaries::Column::RawJson,
                session_summaries::Column::Timestamp,
                session_summaries::Column::LineNumber,
                session_summaries::Column::IndexedAt,
            ])
            .to_owned(),
    )
    .exec(db)
    .await
    .map_err(DbError::Database)?;

    // Fetch the row after upsert
    session_summaries::Entity::find()
        .filter(session_summaries::Column::SessionId.eq(&session_id_clone))
        .one(db)
        .await
        .map_err(DbError::Database)?
        .ok_or(DbError::NotFound("session_summary".to_string()))
}

pub async fn get(db: &DatabaseConnection, session_id: &str) -> DbResult<Option<session_summaries::Model>> {
    session_summaries::Entity::find()
        .filter(session_summaries::Column::SessionId.eq(session_id))
        .one(db)
        .await
        .map_err(DbError::Database)
}
