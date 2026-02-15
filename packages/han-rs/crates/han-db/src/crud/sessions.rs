//! CRUD operations for sessions.

use crate::entities::sessions;
use crate::error::{DbError, DbResult};
use sea_orm::*;
use sea_orm::sea_query::Expr;

pub async fn upsert(
    db: &DatabaseConnection,
    id: String,
    project_id: Option<String>,
    status: Option<String>,
    transcript_path: Option<String>,
    slug: Option<String>,
    source_config_dir: Option<String>,
) -> DbResult<sessions::Model> {
    let id_clone = id.clone();

    sessions::Entity::insert(sessions::ActiveModel {
        id: Set(id),
        project_id: Set(project_id),
        status: Set(status.or(Some("active".to_string()))),
        slug: Set(slug),
        transcript_path: Set(transcript_path),
        source_config_dir: Set(source_config_dir),
        last_indexed_line: Set(Some(0)),
    })
    .on_conflict(
        sea_query::OnConflict::column(sessions::Column::Id)
            .update_columns([
                sessions::Column::ProjectId,
                sessions::Column::Status,
                sessions::Column::TranscriptPath,
                sessions::Column::Slug,
                sessions::Column::SourceConfigDir,
            ])
            .to_owned(),
    )
    .exec(db)
    .await
    .map_err(DbError::Database)?;

    // Fetch the row after upsert
    sessions::Entity::find_by_id(&id_clone)
        .one(db)
        .await
        .map_err(DbError::Database)?
        .ok_or(DbError::NotFound("session".to_string()))
}

pub async fn end_session(db: &DatabaseConnection, session_id: &str) -> DbResult<bool> {
    let res = sessions::Entity::update_many()
        .col_expr(sessions::Column::Status, Expr::value("completed"))
        .filter(sessions::Column::Id.eq(session_id))
        .exec(db)
        .await
        .map_err(DbError::Database)?;

    Ok(res.rows_affected > 0)
}

pub async fn get(db: &DatabaseConnection, session_id: &str) -> DbResult<Option<sessions::Model>> {
    sessions::Entity::find_by_id(session_id)
        .one(db)
        .await
        .map_err(DbError::Database)
}

pub async fn list(
    db: &DatabaseConnection,
    project_id: Option<&str>,
    status: Option<&str>,
    source_config_dir: Option<&str>,
    limit: Option<u64>,
    offset: Option<u64>,
) -> DbResult<Vec<sessions::Model>> {
    let mut query = sessions::Entity::find();

    if let Some(pid) = project_id {
        query = query.filter(sessions::Column::ProjectId.eq(pid));
    }
    if let Some(s) = status {
        query = query.filter(sessions::Column::Status.eq(s));
    }
    if let Some(scd) = source_config_dir {
        query = query.filter(sessions::Column::SourceConfigDir.eq(scd));
    }

    query = query.order_by_desc(sessions::Column::Id);

    if let Some(l) = limit {
        query = query.limit(l);
    }
    if let Some(o) = offset {
        query = query.offset(o);
    }

    query.all(db).await.map_err(DbError::Database)
}

pub async fn update_last_indexed_line(db: &DatabaseConnection, session_id: &str, line_number: i32) -> DbResult<bool> {
    let res = sessions::Entity::update_many()
        .col_expr(sessions::Column::LastIndexedLine, Expr::value(line_number))
        .filter(sessions::Column::Id.eq(session_id))
        .exec(db)
        .await
        .map_err(DbError::Database)?;

    Ok(res.rows_affected > 0)
}

pub async fn reset_all_for_reindex(db: &DatabaseConnection) -> DbResult<u64> {
    let res = sessions::Entity::update_many()
        .col_expr(sessions::Column::LastIndexedLine, Expr::value(0))
        .exec(db)
        .await
        .map_err(DbError::Database)?;

    Ok(res.rows_affected)
}
