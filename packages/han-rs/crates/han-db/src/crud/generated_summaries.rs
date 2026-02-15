//! CRUD operations for generated_session_summaries.

use crate::entities::generated_session_summaries;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn upsert(
    db: &DatabaseConnection,
    session_id: String,
    summary_text: String,
    topics: Vec<String>,
    files_modified: Option<Vec<String>>,
    tools_used: Option<Vec<String>>,
    outcome: Option<String>,
    message_count: Option<i32>,
    duration_seconds: Option<i32>,
) -> DbResult<generated_session_summaries::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let topics_json = serde_json::to_string(&topics).unwrap_or_else(|_| "[]".to_string());
    let files_json = files_modified.map(|f| serde_json::to_string(&f).unwrap_or_else(|_| "[]".to_string()));
    let tools_json = tools_used.map(|t| serde_json::to_string(&t).unwrap_or_else(|_| "[]".to_string()));

    let session_id_clone = session_id.clone();

    generated_session_summaries::Entity::insert(generated_session_summaries::ActiveModel {
        id: Set(id),
        session_id: Set(session_id),
        summary_text: Set(summary_text),
        topics: Set(topics_json),
        files_modified: Set(files_json),
        tools_used: Set(tools_json),
        outcome: Set(outcome),
        message_count: Set(message_count),
        duration_seconds: Set(duration_seconds),
        created_at: Set(now.clone()),
        updated_at: Set(now),
    })
    .on_conflict(
        sea_query::OnConflict::column(generated_session_summaries::Column::SessionId)
            .update_columns([
                generated_session_summaries::Column::SummaryText,
                generated_session_summaries::Column::Topics,
                generated_session_summaries::Column::FilesModified,
                generated_session_summaries::Column::ToolsUsed,
                generated_session_summaries::Column::Outcome,
                generated_session_summaries::Column::MessageCount,
                generated_session_summaries::Column::DurationSeconds,
                generated_session_summaries::Column::UpdatedAt,
            ])
            .to_owned(),
    )
    .exec(db)
    .await
    .map_err(DbError::Database)?;

    // Fetch the row after upsert
    generated_session_summaries::Entity::find()
        .filter(generated_session_summaries::Column::SessionId.eq(&session_id_clone))
        .one(db)
        .await
        .map_err(DbError::Database)?
        .ok_or(DbError::NotFound("generated_session_summary".to_string()))
}

pub async fn get(db: &DatabaseConnection, session_id: &str) -> DbResult<Option<generated_session_summaries::Model>> {
    generated_session_summaries::Entity::find()
        .filter(generated_session_summaries::Column::SessionId.eq(session_id))
        .one(db)
        .await
        .map_err(DbError::Database)
}

pub async fn list_sessions_without_summaries(db: &DatabaseConnection, limit: Option<u64>) -> DbResult<Vec<String>> {
    use sea_orm::{ConnectionTrait, Statement};

    let sql = "SELECT s.id FROM sessions s LEFT JOIN generated_session_summaries g ON s.id = g.session_id WHERE g.id IS NULL ORDER BY s.id DESC LIMIT ?1";
    let rows = db
        .query_all(Statement::from_sql_and_values(
            db.get_database_backend(),
            sql,
            vec![Value::Int(Some(limit.unwrap_or(50) as i32))],
        ))
        .await
        .map_err(DbError::Database)?;

    let mut ids = Vec::new();
    for row in rows {
        if let Ok(id) = row.try_get::<String>("", "id") {
            ids.push(id);
        }
    }
    Ok(ids)
}
