//! CRUD operations for hook_executions and pending_hooks.

use crate::entities::{hook_executions, pending_hooks};
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn record_execution(
    db: &DatabaseConnection,
    session_id: Option<String>,
    task_id: Option<String>,
    hook_type: String,
    hook_name: String,
    hook_source: Option<String>,
    directory: Option<String>,
    duration_ms: i32,
    exit_code: i32,
    passed: bool,
    output: Option<String>,
    error: Option<String>,
    if_changed: Option<String>,
    command: Option<String>,
) -> DbResult<hook_executions::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let result = hook_executions::Entity::insert(hook_executions::ActiveModel {
        id: Set(id),
        orchestration_id: Set(None),
        session_id: Set(session_id),
        task_id: Set(task_id),
        hook_type: Set(hook_type),
        hook_name: Set(hook_name),
        hook_source: Set(hook_source),
        directory: Set(directory),
        duration_ms: Set(duration_ms),
        exit_code: Set(exit_code),
        passed: Set(passed as i32),
        output: Set(output),
        error: Set(error),
        if_changed: Set(if_changed),
        command: Set(command),
        executed_at: Set(now),
        status: Set(Some("completed".to_string())),
        consecutive_failures: Set(Some(0)),
        max_attempts: Set(Some(3)),
        pid: Set(None),
        plugin_root: Set(None),
    })
    .exec_with_returning(db)
    .await
    .map_err(DbError::Database)?;

    Ok(result)
}

pub async fn queue_pending_hook(
    db: &DatabaseConnection,
    orchestration_id: String,
    plugin: String,
    hook_name: String,
    directory: String,
    if_changed: Option<String>,
    command: String,
) -> DbResult<String> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    pending_hooks::Entity::insert(pending_hooks::ActiveModel {
        id: Set(id.clone()),
        orchestration_id: Set(orchestration_id),
        plugin: Set(plugin),
        hook_name: Set(hook_name),
        directory: Set(directory),
        if_changed: Set(if_changed),
        command: Set(command),
        queued_at: Set(now),
    })
    .exec(db)
    .await
    .map_err(DbError::Database)?;

    Ok(id)
}

pub async fn get_queued_hooks(db: &DatabaseConnection, orchestration_id: &str) -> DbResult<Vec<pending_hooks::Model>> {
    pending_hooks::Entity::find()
        .filter(pending_hooks::Column::OrchestrationId.eq(orchestration_id))
        .order_by_asc(pending_hooks::Column::QueuedAt)
        .all(db)
        .await
        .map_err(DbError::Database)
}

pub async fn delete_queued_hooks(db: &DatabaseConnection, orchestration_id: &str) -> DbResult<u64> {
    let res = pending_hooks::Entity::delete_many()
        .filter(pending_hooks::Column::OrchestrationId.eq(orchestration_id))
        .exec(db)
        .await
        .map_err(DbError::Database)?;
    Ok(res.rows_affected)
}
