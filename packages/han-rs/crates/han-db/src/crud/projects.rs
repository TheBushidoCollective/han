//! CRUD operations for projects.

use crate::entities::projects;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn upsert(
    db: &DatabaseConnection,
    repo_id: Option<String>,
    slug: String,
    path: String,
    relative_path: Option<String>,
    name: String,
    is_worktree: Option<bool>,
    source_config_dir: Option<String>,
) -> DbResult<projects::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let slug_clone = slug.clone();

    projects::Entity::insert(projects::ActiveModel {
        id: Set(id),
        repo_id: Set(repo_id),
        slug: Set(slug),
        path: Set(path),
        relative_path: Set(relative_path),
        name: Set(name),
        is_worktree: Set(is_worktree.map(|b| b as i32)),
        source_config_dir: Set(source_config_dir),
        created_at: Set(now.clone()),
        updated_at: Set(now),
    })
    .on_conflict(
        sea_query::OnConflict::column(projects::Column::Slug)
            .update_columns([
                projects::Column::RepoId,
                projects::Column::Path,
                projects::Column::RelativePath,
                projects::Column::Name,
                projects::Column::IsWorktree,
                projects::Column::UpdatedAt,
            ])
            .to_owned(),
    )
    .exec(db)
    .await
    .map_err(DbError::Database)?;

    // Fetch the row after upsert
    projects::Entity::find()
        .filter(projects::Column::Slug.eq(&slug_clone))
        .one(db)
        .await
        .map_err(DbError::Database)?
        .ok_or(DbError::NotFound("project".to_string()))
}

pub async fn get_by_slug(db: &DatabaseConnection, slug: &str) -> DbResult<Option<projects::Model>> {
    projects::Entity::find()
        .filter(projects::Column::Slug.eq(slug))
        .one(db)
        .await
        .map_err(DbError::Database)
}

pub async fn get_by_path(db: &DatabaseConnection, path: &str) -> DbResult<Option<projects::Model>> {
    projects::Entity::find()
        .filter(projects::Column::Path.eq(path))
        .one(db)
        .await
        .map_err(DbError::Database)
}

pub async fn list(db: &DatabaseConnection, repo_id: Option<&str>) -> DbResult<Vec<projects::Model>> {
    let mut query = projects::Entity::find().order_by_asc(projects::Column::Name);
    if let Some(rid) = repo_id {
        query = query.filter(projects::Column::RepoId.eq(rid));
    }
    query.all(db).await.map_err(DbError::Database)
}
