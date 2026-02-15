//! CRUD operations for config_dirs.

use crate::entities::config_dirs;
use crate::error::{DbError, DbResult};
use sea_orm::*;
use sea_orm::sea_query::Expr;

pub async fn register(
    db: &DatabaseConnection,
    path: String,
    name: Option<String>,
    is_default: Option<bool>,
) -> DbResult<config_dirs::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let path_clone = path.clone();

    config_dirs::Entity::insert(config_dirs::ActiveModel {
        id: Set(id),
        path: Set(path),
        name: Set(name),
        registered_at: Set(now),
        last_indexed_at: Set(None),
        session_count: Set(Some(0)),
        is_default: Set(is_default.map(|b| b as i32).unwrap_or(0)),
    })
    .on_conflict(
        sea_query::OnConflict::column(config_dirs::Column::Path)
            .update_columns([config_dirs::Column::Name, config_dirs::Column::IsDefault])
            .to_owned(),
    )
    .exec(db)
    .await
    .map_err(DbError::Database)?;

    // Fetch the row after upsert
    config_dirs::Entity::find()
        .filter(config_dirs::Column::Path.eq(&path_clone))
        .one(db)
        .await
        .map_err(DbError::Database)?
        .ok_or(DbError::NotFound("config_dir".to_string()))
}

pub async fn get_by_path(db: &DatabaseConnection, path: &str) -> DbResult<Option<config_dirs::Model>> {
    config_dirs::Entity::find()
        .filter(config_dirs::Column::Path.eq(path))
        .one(db)
        .await
        .map_err(DbError::Database)
}

pub async fn list(db: &DatabaseConnection) -> DbResult<Vec<config_dirs::Model>> {
    config_dirs::Entity::find()
        .order_by_asc(config_dirs::Column::Path)
        .all(db)
        .await
        .map_err(DbError::Database)
}

pub async fn update_last_indexed(db: &DatabaseConnection, path: &str) -> DbResult<bool> {
    let now = chrono::Utc::now().to_rfc3339();
    let res = config_dirs::Entity::update_many()
        .col_expr(config_dirs::Column::LastIndexedAt, Expr::value(now))
        .filter(config_dirs::Column::Path.eq(path))
        .exec(db)
        .await
        .map_err(DbError::Database)?;
    Ok(res.rows_affected > 0)
}

pub async fn unregister(db: &DatabaseConnection, path: &str) -> DbResult<bool> {
    let res = config_dirs::Entity::delete_many()
        .filter(config_dirs::Column::Path.eq(path))
        .exec(db)
        .await
        .map_err(DbError::Database)?;
    Ok(res.rows_affected > 0)
}

pub async fn get_default(db: &DatabaseConnection) -> DbResult<Option<config_dirs::Model>> {
    config_dirs::Entity::find()
        .filter(config_dirs::Column::IsDefault.eq(1))
        .one(db)
        .await
        .map_err(DbError::Database)
}
