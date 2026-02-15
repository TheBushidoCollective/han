//! CRUD operations for orchestrations.

use crate::entities::orchestrations;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn create(
    db: &DatabaseConnection,
    session_id: Option<String>,
    hook_type: String,
    project_root: String,
) -> DbResult<orchestrations::Model> {
    let id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let result = orchestrations::Entity::insert(orchestrations::ActiveModel {
        id: Set(id),
        session_id: Set(session_id),
        hook_type: Set(hook_type),
        project_root: Set(project_root),
        status: Set("pending".to_string()),
        total_hooks: Set(0),
        completed_hooks: Set(0),
        failed_hooks: Set(0),
        deferred_hooks: Set(0),
        created_at: Set(now),
        completed_at: Set(None),
    })
    .exec_with_returning(db)
    .await
    .map_err(DbError::Database)?;

    Ok(result)
}

pub async fn get(db: &DatabaseConnection, id: &str) -> DbResult<Option<orchestrations::Model>> {
    orchestrations::Entity::find_by_id(id)
        .one(db)
        .await
        .map_err(DbError::Database)
}

pub async fn update(
    db: &DatabaseConnection,
    id: &str,
    status: Option<String>,
    total_hooks: Option<i32>,
    completed_hooks: Option<i32>,
    failed_hooks: Option<i32>,
    deferred_hooks: Option<i32>,
) -> DbResult<()> {
    let existing = orchestrations::Entity::find_by_id(id)
        .one(db)
        .await
        .map_err(DbError::Database)?;

    let Some(existing) = existing else {
        return Ok(());
    };

    let mut active: orchestrations::ActiveModel = existing.into();

    if let Some(s) = status {
        if s == "completed" || s == "failed" {
            active.completed_at = Set(Some(chrono::Utc::now().to_rfc3339()));
        }
        active.status = Set(s);
    }
    if let Some(v) = total_hooks {
        active.total_hooks = Set(v);
    }
    if let Some(v) = completed_hooks {
        active.completed_hooks = Set(v);
    }
    if let Some(v) = failed_hooks {
        active.failed_hooks = Set(v);
    }
    if let Some(v) = deferred_hooks {
        active.deferred_hooks = Set(v);
    }

    active.update(db).await.map_err(DbError::Database)?;
    Ok(())
}

pub async fn cancel(db: &DatabaseConnection, id: &str) -> DbResult<()> {
    update(db, id, Some("cancelled".to_string()), None, None, None, None).await
}
