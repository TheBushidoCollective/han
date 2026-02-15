//! CRUD operations for tasks (metrics tracking).

use crate::entities::tasks;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn create(
    db: &DatabaseConnection,
    session_id: Option<String>,
    task_id: String,
    description: String,
    task_type: String,
) -> DbResult<tasks::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let result = tasks::Entity::insert(tasks::ActiveModel {
        id: Set(id),
        session_id: Set(session_id),
        task_id: Set(task_id),
        description: Set(description),
        task_type: Set(task_type),
        outcome: Set(None),
        confidence: Set(None),
        notes: Set(None),
        files_modified: Set(None),
        tests_added: Set(None),
        started_at: Set(now),
        completed_at: Set(None),
    })
    .exec_with_returning(db)
    .await
    .map_err(DbError::Database)?;

    Ok(result)
}

pub async fn complete(
    db: &DatabaseConnection,
    task_id: &str,
    outcome: String,
    confidence: f64,
    notes: Option<String>,
    files_modified: Option<Vec<String>>,
    tests_added: Option<i32>,
) -> DbResult<Option<tasks::Model>> {
    let existing = tasks::Entity::find()
        .filter(tasks::Column::TaskId.eq(task_id))
        .one(db)
        .await
        .map_err(DbError::Database)?;

    let Some(existing) = existing else {
        return Ok(None);
    };

    let now = chrono::Utc::now().to_rfc3339();
    let files_json = files_modified.map(|f| serde_json::to_string(&f).unwrap_or_else(|_| "[]".to_string()));

    let mut active: tasks::ActiveModel = existing.into();
    active.outcome = Set(Some(outcome));
    active.confidence = Set(Some(confidence));
    active.notes = Set(notes);
    active.files_modified = Set(files_json);
    active.tests_added = Set(tests_added);
    active.completed_at = Set(Some(now));

    let result = active.update(db).await.map_err(DbError::Database)?;
    Ok(Some(result))
}

pub async fn fail(
    db: &DatabaseConnection,
    task_id: &str,
    reason: String,
    confidence: Option<f64>,
    notes: Option<String>,
) -> DbResult<Option<tasks::Model>> {
    let existing = tasks::Entity::find()
        .filter(tasks::Column::TaskId.eq(task_id))
        .one(db)
        .await
        .map_err(DbError::Database)?;

    let Some(existing) = existing else {
        return Ok(None);
    };

    let now = chrono::Utc::now().to_rfc3339();

    let mut active: tasks::ActiveModel = existing.into();
    active.outcome = Set(Some("failed".to_string()));
    active.confidence = Set(confidence);
    active.notes = Set(Some(notes.unwrap_or(reason)));
    active.completed_at = Set(Some(now));

    let result = active.update(db).await.map_err(DbError::Database)?;
    Ok(Some(result))
}

pub async fn get(db: &DatabaseConnection, task_id: &str) -> DbResult<Option<tasks::Model>> {
    tasks::Entity::find()
        .filter(tasks::Column::TaskId.eq(task_id))
        .one(db)
        .await
        .map_err(DbError::Database)
}
