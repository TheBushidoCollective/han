//! CRUD operations for session_files.

use crate::entities::session_files;
use crate::error::{DbError, DbResult};
use sea_orm::*;
use sea_orm::sea_query::Expr;

pub async fn upsert(
    db: &DatabaseConnection,
    session_id: String,
    file_type: String,
    file_path: String,
    agent_id: Option<String>,
) -> DbResult<session_files::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let file_path_clone = file_path.clone();

    session_files::Entity::insert(session_files::ActiveModel {
        id: Set(id),
        session_id: Set(session_id),
        file_type: Set(file_type),
        file_path: Set(file_path),
        agent_id: Set(agent_id),
        last_indexed_line: Set(Some(0)),
        last_indexed_at: Set(None),
        created_at: Set(now),
    })
    .on_conflict(
        sea_query::OnConflict::column(session_files::Column::FilePath)
            .update_columns([session_files::Column::LastIndexedLine])
            .to_owned(),
    )
    .exec(db)
    .await
    .map_err(DbError::Database)?;

    // Fetch the row after upsert
    session_files::Entity::find()
        .filter(session_files::Column::FilePath.eq(&file_path_clone))
        .one(db)
        .await
        .map_err(DbError::Database)?
        .ok_or(DbError::NotFound("session_file".to_string()))
}

pub async fn get_by_session(db: &DatabaseConnection, session_id: &str) -> DbResult<Vec<session_files::Model>> {
    session_files::Entity::find()
        .filter(session_files::Column::SessionId.eq(session_id))
        .order_by_asc(session_files::Column::CreatedAt)
        .all(db)
        .await
        .map_err(DbError::Database)
}

pub async fn get_by_path(db: &DatabaseConnection, file_path: &str) -> DbResult<Option<session_files::Model>> {
    session_files::Entity::find()
        .filter(session_files::Column::FilePath.eq(file_path))
        .one(db)
        .await
        .map_err(DbError::Database)
}

pub async fn update_indexed_line(db: &DatabaseConnection, file_path: &str, line_number: i32) -> DbResult<bool> {
    let now = chrono::Utc::now().to_rfc3339();
    let res = session_files::Entity::update_many()
        .col_expr(session_files::Column::LastIndexedLine, Expr::value(line_number))
        .col_expr(session_files::Column::LastIndexedAt, Expr::value(now))
        .filter(session_files::Column::FilePath.eq(file_path))
        .exec(db)
        .await
        .map_err(DbError::Database)?;
    Ok(res.rows_affected > 0)
}
