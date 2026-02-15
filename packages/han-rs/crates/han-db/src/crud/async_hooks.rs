//! CRUD operations for async_hook_queue.

use crate::entities::async_hook_queue;
use crate::error::{DbError, DbResult};
use sea_orm::*;
use sea_orm::sea_query::Expr;

pub async fn enqueue(
    db: &DatabaseConnection,
    session_id: String,
    cwd: String,
    plugin: String,
    hook_name: String,
    file_paths: Vec<String>,
    command: String,
) -> DbResult<async_hook_queue::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();
    let file_paths_json = serde_json::to_string(&file_paths).unwrap_or_else(|_| "[]".to_string());

    let result = async_hook_queue::Entity::insert(async_hook_queue::ActiveModel {
        id: Set(id),
        session_id: Set(session_id),
        cwd: Set(cwd),
        plugin: Set(plugin),
        hook_name: Set(hook_name),
        file_paths: Set(file_paths_json),
        command: Set(command),
        status: Set("pending".to_string()),
        created_at: Set(now),
        started_at: Set(None),
        completed_at: Set(None),
        result: Set(None),
        error: Set(None),
    })
    .exec_with_returning(db)
    .await
    .map_err(DbError::Database)?;

    Ok(result)
}

pub async fn list_pending(db: &DatabaseConnection, session_id: &str) -> DbResult<Vec<async_hook_queue::Model>> {
    async_hook_queue::Entity::find()
        .filter(async_hook_queue::Column::SessionId.eq(session_id))
        .filter(async_hook_queue::Column::Status.eq("pending"))
        .order_by_asc(async_hook_queue::Column::CreatedAt)
        .all(db)
        .await
        .map_err(DbError::Database)
}

pub async fn is_queue_empty(db: &DatabaseConnection, session_id: &str) -> DbResult<bool> {
    let count = async_hook_queue::Entity::find()
        .filter(async_hook_queue::Column::SessionId.eq(session_id))
        .filter(
            async_hook_queue::Column::Status
                .eq("pending")
                .or(async_hook_queue::Column::Status.eq("running")),
        )
        .count(db)
        .await
        .map_err(DbError::Database)?;
    Ok(count == 0)
}

pub async fn complete(db: &DatabaseConnection, id: &str, result_json: Option<String>) -> DbResult<()> {
    let now = chrono::Utc::now().to_rfc3339();
    async_hook_queue::Entity::update_many()
        .col_expr(async_hook_queue::Column::Status, Expr::value("completed"))
        .col_expr(async_hook_queue::Column::CompletedAt, Expr::value(now))
        .col_expr(async_hook_queue::Column::Result, Expr::value(result_json))
        .filter(async_hook_queue::Column::Id.eq(id))
        .exec(db)
        .await
        .map_err(DbError::Database)?;
    Ok(())
}

pub async fn cancel_pending(db: &DatabaseConnection, session_id: &str) -> DbResult<u64> {
    let res = async_hook_queue::Entity::update_many()
        .col_expr(async_hook_queue::Column::Status, Expr::value("cancelled"))
        .filter(async_hook_queue::Column::SessionId.eq(session_id))
        .filter(async_hook_queue::Column::Status.eq("pending"))
        .exec(db)
        .await
        .map_err(DbError::Database)?;
    Ok(res.rows_affected)
}
