//! CRUD operations for frustration_events.

use crate::entities::frustration_events;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn record(
    db: &DatabaseConnection,
    session_id: Option<String>,
    task_id: Option<String>,
    frustration_level: String,
    frustration_score: f64,
    user_message: String,
    detected_signals: Option<Vec<String>>,
    context: Option<String>,
) -> DbResult<frustration_events::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let signals_json = detected_signals.map(|s| serde_json::to_string(&s).unwrap_or_else(|_| "[]".to_string()));

    let result = frustration_events::Entity::insert(frustration_events::ActiveModel {
        id: Set(id),
        session_id: Set(session_id),
        task_id: Set(task_id),
        frustration_level: Set(frustration_level),
        frustration_score: Set(frustration_score),
        user_message: Set(user_message),
        detected_signals: Set(signals_json),
        context: Set(context),
        recorded_at: Set(now),
    })
    .exec_with_returning(db)
    .await
    .map_err(DbError::Database)?;

    Ok(result)
}
