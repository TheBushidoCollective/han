//! CRUD operations for native_tasks.

use crate::entities::native_tasks;
use crate::error::{DbError, DbResult};
use sea_orm::*;

pub async fn create(
    db: &DatabaseConnection,
    id: String,
    session_id: String,
    message_id: String,
    subject: String,
    description: Option<String>,
    active_form: Option<String>,
    timestamp: String,
    line_number: i32,
) -> DbResult<native_tasks::Model> {
    let id_clone = id.clone();
    let session_id_clone = session_id.clone();

    native_tasks::Entity::insert(native_tasks::ActiveModel {
        id: Set(id),
        session_id: Set(session_id),
        message_id: Set(message_id),
        subject: Set(subject),
        description: Set(description),
        status: Set("pending".to_string()),
        active_form: Set(active_form),
        owner: Set(None),
        blocks: Set(None),
        blocked_by: Set(None),
        created_at: Set(timestamp.clone()),
        updated_at: Set(timestamp),
        completed_at: Set(None),
        line_number: Set(line_number),
    })
    .on_conflict(
        sea_query::OnConflict::column(native_tasks::Column::Id)
            .do_nothing()
            .to_owned(),
    )
    .exec(db)
    .await
    .map_err(DbError::Database)?;

    // Fetch after insert (exec_with_returning doesn't work with on_conflict in SQLite)
    native_tasks::Entity::find()
        .filter(native_tasks::Column::Id.eq(&id_clone))
        .filter(native_tasks::Column::SessionId.eq(&session_id_clone))
        .one(db)
        .await
        .map_err(DbError::Database)?
        .ok_or(DbError::NotFound("native_task".to_string()))
}

pub async fn update(
    db: &DatabaseConnection,
    id: &str,
    session_id: &str,
    message_id: String,
    status: Option<String>,
    subject: Option<String>,
    description: Option<String>,
    active_form: Option<String>,
    owner: Option<String>,
    add_blocks: Option<Vec<String>>,
    add_blocked_by: Option<Vec<String>>,
    timestamp: String,
    line_number: i32,
) -> DbResult<Option<native_tasks::Model>> {
    // Find existing task
    let existing = native_tasks::Entity::find()
        .filter(native_tasks::Column::Id.eq(id))
        .filter(native_tasks::Column::SessionId.eq(session_id))
        .one(db)
        .await
        .map_err(DbError::Database)?;

    let Some(existing) = existing else {
        return Ok(None);
    };

    let mut active: native_tasks::ActiveModel = existing.clone().into();

    active.message_id = Set(message_id);
    active.updated_at = Set(timestamp.clone());
    active.line_number = Set(line_number);

    if let Some(s) = status {
        if s == "completed" {
            active.completed_at = Set(Some(timestamp));
        }
        active.status = Set(s);
    }
    if let Some(s) = subject {
        active.subject = Set(s);
    }
    if let Some(d) = description {
        active.description = Set(Some(d));
    }
    if let Some(a) = active_form {
        active.active_form = Set(Some(a));
    }
    if let Some(o) = owner {
        active.owner = Set(Some(o));
    }

    // Merge blocks arrays
    if let Some(new_blocks) = add_blocks {
        let mut current: Vec<String> = existing
            .blocks
            .as_deref()
            .and_then(|b| serde_json::from_str(b).ok())
            .unwrap_or_default();
        for b in new_blocks {
            if !current.contains(&b) {
                current.push(b);
            }
        }
        active.blocks = Set(Some(serde_json::to_string(&current).unwrap_or_else(|_| "[]".to_string())));
    }

    if let Some(new_blocked_by) = add_blocked_by {
        let mut current: Vec<String> = existing
            .blocked_by
            .as_deref()
            .and_then(|b| serde_json::from_str(b).ok())
            .unwrap_or_default();
        for b in new_blocked_by {
            if !current.contains(&b) {
                current.push(b);
            }
        }
        active.blocked_by = Set(Some(serde_json::to_string(&current).unwrap_or_else(|_| "[]".to_string())));
    }

    let result = active.update(db).await.map_err(DbError::Database)?;
    Ok(Some(result))
}

pub async fn get(db: &DatabaseConnection, session_id: &str, task_id: &str) -> DbResult<Option<native_tasks::Model>> {
    native_tasks::Entity::find()
        .filter(native_tasks::Column::SessionId.eq(session_id))
        .filter(native_tasks::Column::Id.eq(task_id))
        .one(db)
        .await
        .map_err(DbError::Database)
}

pub async fn get_by_session(db: &DatabaseConnection, session_id: &str) -> DbResult<Vec<native_tasks::Model>> {
    native_tasks::Entity::find()
        .filter(native_tasks::Column::SessionId.eq(session_id))
        .order_by_asc(native_tasks::Column::CreatedAt)
        .all(db)
        .await
        .map_err(DbError::Database)
}
