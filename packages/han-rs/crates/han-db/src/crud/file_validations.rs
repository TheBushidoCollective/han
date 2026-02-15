//! CRUD operations for session_file_validations.

use crate::entities::session_file_validations;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn record(
    db: &DatabaseConnection,
    session_id: String,
    file_path: String,
    file_hash: String,
    plugin_name: String,
    hook_name: String,
    directory: String,
    command_hash: String,
) -> DbResult<session_file_validations::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let session_id_clone = session_id.clone();
    let file_path_clone = file_path.clone();
    let plugin_name_clone = plugin_name.clone();
    let hook_name_clone = hook_name.clone();
    let directory_clone = directory.clone();

    session_file_validations::Entity::insert(session_file_validations::ActiveModel {
        id: Set(id),
        session_id: Set(session_id),
        file_path: Set(file_path),
        file_hash: Set(file_hash),
        plugin_name: Set(plugin_name),
        hook_name: Set(hook_name),
        directory: Set(directory),
        command_hash: Set(command_hash),
        validated_at: Set(now),
    })
    .on_conflict(
        sea_query::OnConflict::columns([
            session_file_validations::Column::SessionId,
            session_file_validations::Column::FilePath,
            session_file_validations::Column::PluginName,
            session_file_validations::Column::HookName,
            session_file_validations::Column::Directory,
        ])
        .update_columns([
            session_file_validations::Column::FileHash,
            session_file_validations::Column::CommandHash,
            session_file_validations::Column::ValidatedAt,
        ])
        .to_owned(),
    )
    .exec(db)
    .await
    .map_err(DbError::Database)?;

    // Fetch the row after upsert (composite unique key)
    session_file_validations::Entity::find()
        .filter(session_file_validations::Column::SessionId.eq(&session_id_clone))
        .filter(session_file_validations::Column::FilePath.eq(&file_path_clone))
        .filter(session_file_validations::Column::PluginName.eq(&plugin_name_clone))
        .filter(session_file_validations::Column::HookName.eq(&hook_name_clone))
        .filter(session_file_validations::Column::Directory.eq(&directory_clone))
        .one(db)
        .await
        .map_err(DbError::Database)?
        .ok_or(DbError::NotFound("session_file_validation".to_string()))
}

pub async fn get_by_session(db: &DatabaseConnection, session_id: &str) -> DbResult<Vec<session_file_validations::Model>> {
    session_file_validations::Entity::find()
        .filter(session_file_validations::Column::SessionId.eq(session_id))
        .all(db)
        .await
        .map_err(DbError::Database)
}

pub async fn delete_stale(
    db: &DatabaseConnection,
    session_id: &str,
    plugin_name: &str,
    hook_name: &str,
    directory: &str,
) -> DbResult<u64> {
    let res = session_file_validations::Entity::delete_many()
        .filter(session_file_validations::Column::SessionId.eq(session_id))
        .filter(session_file_validations::Column::PluginName.eq(plugin_name))
        .filter(session_file_validations::Column::HookName.eq(hook_name))
        .filter(session_file_validations::Column::Directory.eq(directory))
        .exec(db)
        .await
        .map_err(DbError::Database)?;
    Ok(res.rows_affected)
}
