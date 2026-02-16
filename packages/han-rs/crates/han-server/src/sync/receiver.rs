//! Session sync receiver - accepts session data from local coordinators.

use axum::{http::StatusCode, response::IntoResponse, Json};
use chrono::Utc;
use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};
use serde::{Deserialize, Serialize};
use tracing::{error, info};
use uuid::Uuid;

use crate::auth::middleware::AuthUser;
use crate::crypto::field;
use crate::state::AppState;

/// Sync request payload from local coordinator.
#[derive(Debug, Deserialize)]
pub struct SyncSessionRequest {
    pub session_id: String,
    pub project_path: String,
    pub summary: Option<String>,
    pub messages: Vec<SyncMessage>,
    pub metadata: Option<serde_json::Value>,
}

/// Individual message in sync payload.
#[derive(Debug, Deserialize, Serialize)]
pub struct SyncMessage {
    #[serde(rename = "type")]
    pub message_type: String,
    pub content: String,
    pub timestamp: String,
    pub tool_use: Option<serde_json::Value>,
}

/// Sync response.
#[derive(Debug, Serialize)]
pub struct SyncSessionResponse {
    pub success: bool,
    pub session_id: String,
    pub encrypted: bool,
    pub stored_at: String,
    pub message_count: usize,
}

const MAX_SESSION_ID_LEN: usize = 256;
const MAX_PROJECT_PATH_LEN: usize = 4096;
const MAX_SUMMARY_LEN: usize = 10_000;
const MAX_MESSAGE_CONTENT_LEN: usize = 1_000_000;
const MAX_MESSAGES: usize = 10_000;

/// Implementation of session sync logic.
pub async fn sync_sessions_impl(
    state: &AppState,
    auth_user: &AuthUser,
    request: SyncSessionRequest,
) -> impl IntoResponse {
    if let Err(e) = validate_sync_request(&request) {
        return (StatusCode::BAD_REQUEST, Json(serde_json::json!({"error": e}))).into_response();
    }

    info!(
        user_id = %auth_user.user_id,
        session_id = %request.session_id,
        message_count = request.messages.len(),
        "Syncing session"
    );

    let messages_json =
        serde_json::to_string(&request.messages).unwrap_or_else(|_| "[]".to_string());

    let encrypted_messages = match field::encrypt_field(&state.config.master_kek, &messages_json) {
        Ok(enc) => enc,
        Err(e) => {
            error!("Encryption failed: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "encryption failed"})),
            )
                .into_response();
        }
    };

    let encrypted_summary = match &request.summary {
        Some(s) => match field::encrypt_field(&state.config.master_kek, s) {
            Ok(enc) => Some(enc),
            Err(e) => {
                error!("Summary encryption failed: {e}");
                None
            }
        },
        None => None,
    };

    use han_db::entities::synced_sessions;

    let existing = synced_sessions::Entity::find()
        .filter(synced_sessions::Column::SessionId.eq(&request.session_id))
        .one(&state.db)
        .await;

    let now = Utc::now();

    match existing {
        Ok(Some(existing)) => {
            if existing.user_id != auth_user.user_id {
                return (
                    StatusCode::FORBIDDEN,
                    Json(serde_json::json!({"error": "not session owner"})),
                )
                    .into_response();
            }

            let mut active: synced_sessions::ActiveModel = existing.into();
            active.encrypted_messages = Set(encrypted_messages);
            active.encrypted_summary = Set(encrypted_summary);
            active.project_path = Set(request.project_path);
            active.message_count = Set(request.messages.len() as i32);
            active.metadata = Set(request.metadata.map(|v| v.to_string()));
            active.updated_at = Set(now.to_rfc3339());

            if let Err(e) = active.update(&state.db).await {
                error!("Failed to update synced session: {e}");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "failed to store session"})),
                )
                    .into_response();
            }
        }
        Ok(None) => {
            let active = synced_sessions::ActiveModel {
                id: Set(Uuid::new_v4().to_string()),
                session_id: Set(request.session_id.clone()),
                user_id: Set(auth_user.user_id.clone()),
                team_id: Set(auth_user.team_id.clone()),
                project_path: Set(request.project_path),
                encrypted_messages: Set(encrypted_messages),
                encrypted_summary: Set(encrypted_summary),
                message_count: Set(request.messages.len() as i32),
                metadata: Set(request.metadata.map(|v| v.to_string())),
                created_at: Set(now.to_rfc3339()),
                updated_at: Set(now.to_rfc3339()),
            };

            if let Err(e) = active.insert(&state.db).await {
                error!("Failed to insert synced session: {e}");
                return (
                    StatusCode::INTERNAL_SERVER_ERROR,
                    Json(serde_json::json!({"error": "failed to store session"})),
                )
                    .into_response();
            }
        }
        Err(e) => {
            error!("Database error: {e}");
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(serde_json::json!({"error": "database error"})),
            )
                .into_response();
        }
    }

    if let Err(e) = notify_session_sync(&state.db, &request.session_id).await {
        error!("pg_notify failed: {e}");
    }

    (
        StatusCode::CREATED,
        Json(serde_json::json!(SyncSessionResponse {
            success: true,
            session_id: request.session_id,
            encrypted: true,
            stored_at: now.to_rfc3339(),
            message_count: request.messages.len(),
        })),
    )
        .into_response()
}

fn validate_sync_request(req: &SyncSessionRequest) -> Result<(), String> {
    if req.session_id.len() > MAX_SESSION_ID_LEN {
        return Err("session_id too long".into());
    }
    if req.project_path.len() > MAX_PROJECT_PATH_LEN {
        return Err("project_path too long".into());
    }
    if let Some(ref s) = req.summary {
        if s.len() > MAX_SUMMARY_LEN {
            return Err("summary too long".into());
        }
    }
    if req.messages.len() > MAX_MESSAGES {
        return Err(format!("too many messages (max {MAX_MESSAGES})"));
    }
    for (i, msg) in req.messages.iter().enumerate() {
        if msg.content.len() > MAX_MESSAGE_CONTENT_LEN {
            return Err(format!("message[{i}].content too long"));
        }
    }
    Ok(())
}

async fn notify_session_sync(
    db: &sea_orm::DatabaseConnection,
    session_id: &str,
) -> Result<(), String> {
    use sea_orm::ConnectionTrait;

    let payload = serde_json::json!({
        "type": "session_synced",
        "session_id": session_id,
    })
    .to_string();

    db.execute(sea_orm::Statement::from_string(
        sea_orm::DatabaseBackend::Postgres,
        format!(
            "SELECT pg_notify('han_events', '{}')",
            payload.replace('\'', "''")
        ),
    ))
    .await
    .map_err(|e| format!("pg_notify failed: {e}"))?;

    Ok(())
}

#[cfg(test)]
mod tests {
    use super::*;

    fn make_request(
        session_id: &str,
        project_path: &str,
        message_count: usize,
    ) -> SyncSessionRequest {
        SyncSessionRequest {
            session_id: session_id.to_string(),
            project_path: project_path.to_string(),
            summary: None,
            messages: (0..message_count)
                .map(|i| SyncMessage {
                    message_type: "user".to_string(),
                    content: format!("message {i}"),
                    timestamp: "2026-01-01T00:00:00Z".to_string(),
                    tool_use: None,
                })
                .collect(),
            metadata: None,
        }
    }

    #[test]
    fn test_validate_valid_request() {
        let req = make_request("session-1", "/project", 5);
        assert!(validate_sync_request(&req).is_ok());
    }

    #[test]
    fn test_validate_session_id_too_long() {
        let long_id = "x".repeat(MAX_SESSION_ID_LEN + 1);
        let req = make_request(&long_id, "/project", 0);
        let err = validate_sync_request(&req).unwrap_err();
        assert!(err.contains("session_id too long"));
    }

    #[test]
    fn test_validate_project_path_too_long() {
        let long_path = "/".repeat(MAX_PROJECT_PATH_LEN + 1);
        let req = make_request("session-1", &long_path, 0);
        let err = validate_sync_request(&req).unwrap_err();
        assert!(err.contains("project_path too long"));
    }

    #[test]
    fn test_validate_too_many_messages() {
        let req = make_request("session-1", "/project", MAX_MESSAGES + 1);
        let err = validate_sync_request(&req).unwrap_err();
        assert!(err.contains("too many messages"));
    }

    #[test]
    fn test_validate_message_content_too_long() {
        let mut req = make_request("session-1", "/project", 1);
        req.messages[0].content = "x".repeat(MAX_MESSAGE_CONTENT_LEN + 1);
        let err = validate_sync_request(&req).unwrap_err();
        assert!(err.contains("content too long"));
    }

    #[test]
    fn test_validate_summary_too_long() {
        let mut req = make_request("session-1", "/project", 0);
        req.summary = Some("x".repeat(MAX_SUMMARY_LEN + 1));
        let err = validate_sync_request(&req).unwrap_err();
        assert!(err.contains("summary too long"));
    }

    #[test]
    fn test_sync_request_deserialization() {
        let json = serde_json::json!({
            "session_id": "abc-123",
            "project_path": "/home/user/project",
            "summary": "Test session",
            "messages": [
                {
                    "type": "user",
                    "content": "Hello",
                    "timestamp": "2026-01-01T00:00:00Z"
                },
                {
                    "type": "assistant",
                    "content": "Hi there",
                    "timestamp": "2026-01-01T00:00:01Z",
                    "tool_use": {"name": "Read", "input": {}}
                }
            ],
            "metadata": {"key": "value"}
        });

        let req: SyncSessionRequest = serde_json::from_value(json).unwrap();
        assert_eq!(req.session_id, "abc-123");
        assert_eq!(req.messages.len(), 2);
        assert_eq!(req.messages[0].message_type, "user");
        assert_eq!(req.messages[1].message_type, "assistant");
        assert!(req.messages[1].tool_use.is_some());
        assert!(req.metadata.is_some());
    }
}
