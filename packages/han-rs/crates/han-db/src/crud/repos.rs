//! CRUD operations for repos.

use crate::entities::repos;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn upsert(db: &DatabaseConnection, remote: String, name: String, default_branch: Option<String>) -> DbResult<repos::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    repos::Entity::insert(repos::ActiveModel {
        id: Set(id),
        remote: Set(remote.clone()),
        name: Set(name),
        default_branch: Set(default_branch),
        created_at: Set(now.clone()),
        updated_at: Set(now),
    })
    .on_conflict(
        sea_query::OnConflict::column(repos::Column::Remote)
            .update_columns([repos::Column::Name, repos::Column::DefaultBranch, repos::Column::UpdatedAt])
            .to_owned(),
    )
    .exec(db)
    .await
    .map_err(DbError::Database)?;

    // Fetch the row after upsert
    repos::Entity::find()
        .filter(repos::Column::Remote.eq(&remote))
        .one(db)
        .await
        .map_err(DbError::Database)?
        .ok_or(DbError::NotFound("repo".to_string()))
}

pub async fn get_by_remote(db: &DatabaseConnection, remote: &str) -> DbResult<Option<repos::Model>> {
    repos::Entity::find()
        .filter(repos::Column::Remote.eq(remote))
        .one(db)
        .await
        .map_err(DbError::Database)
}

pub async fn list(db: &DatabaseConnection) -> DbResult<Vec<repos::Model>> {
    repos::Entity::find()
        .order_by_asc(repos::Column::Name)
        .all(db)
        .await
        .map_err(DbError::Database)
}
