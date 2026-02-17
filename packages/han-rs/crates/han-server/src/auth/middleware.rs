//! Axum middleware for JWT and API key authentication.

use axum::{
    extract::{Request, State},
    http::StatusCode,
    middleware::Next,
    response::{IntoResponse, Response},
    Json,
};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use serde_json::json;

use super::api_key::hash_api_key;
use super::jwt::{validate_token, TokenType};
use crate::state::AppState;

/// Authenticated user extracted from JWT or API key.
#[derive(Debug, Clone)]
pub struct AuthUser {
    pub user_id: String,
    pub team_id: Option<String>,
    pub auth_method: AuthMethod,
}

/// How the user was authenticated.
#[derive(Debug, Clone)]
pub enum AuthMethod {
    Jwt,
    ApiKey,
}

/// Authentication middleware that requires a valid token.
pub async fn require_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    match extract_auth_user(&state, &request).await {
        Some(user) => {
            request.extensions_mut().insert(user);
            next.run(request).await
        }
        None => (
            StatusCode::UNAUTHORIZED,
            Json(json!({
                "error": "unauthorized",
                "message": "Valid authentication required"
            })),
        )
            .into_response(),
    }
}

/// Optional authentication middleware - sets user if present but doesn't reject.
pub async fn optional_auth(
    State(state): State<AppState>,
    mut request: Request,
    next: Next,
) -> Response {
    if let Some(user) = extract_auth_user(&state, &request).await {
        request.extensions_mut().insert(user);
    }
    next.run(request).await
}

/// Extract and validate auth from the Authorization header.
async fn extract_auth_user(state: &AppState, request: &Request) -> Option<AuthUser> {
    let auth_header = request
        .headers()
        .get("authorization")
        .and_then(|v| v.to_str().ok())?;

    if let Some(token) = auth_header.strip_prefix("Bearer ") {
        // Try JWT first
        if let Ok(claims) = validate_token(&state.config.jwt_secret, token) {
            if claims.token_type == TokenType::Access {
                return Some(AuthUser {
                    user_id: claims.sub,
                    team_id: claims.team_id,
                    auth_method: AuthMethod::Jwt,
                });
            }
        }

        // Try API key (starts with han_)
        if token.starts_with("han_") {
            return lookup_api_key(&state.db, token).await;
        }
    }

    None
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_auth_user_construction() {
        let user = AuthUser {
            user_id: "user-123".to_string(),
            team_id: Some("team-456".to_string()),
            auth_method: AuthMethod::Jwt,
        };
        assert_eq!(user.user_id, "user-123");
        assert_eq!(user.team_id.as_deref(), Some("team-456"));
    }

    #[test]
    fn test_auth_user_without_team() {
        let user = AuthUser {
            user_id: "user-789".to_string(),
            team_id: None,
            auth_method: AuthMethod::ApiKey,
        };
        assert_eq!(user.user_id, "user-789");
        assert!(user.team_id.is_none());
    }

    #[test]
    fn test_auth_method_jwt_debug() {
        let method = AuthMethod::Jwt;
        let debug_str = format!("{:?}", method);
        assert_eq!(debug_str, "Jwt");
    }

    #[test]
    fn test_auth_method_api_key_debug() {
        let method = AuthMethod::ApiKey;
        let debug_str = format!("{:?}", method);
        assert_eq!(debug_str, "ApiKey");
    }

    #[test]
    fn test_auth_user_clone() {
        let user = AuthUser {
            user_id: "user-1".to_string(),
            team_id: Some("team-1".to_string()),
            auth_method: AuthMethod::Jwt,
        };
        let cloned = user.clone();
        assert_eq!(cloned.user_id, user.user_id);
        assert_eq!(cloned.team_id, user.team_id);
    }

    #[test]
    fn test_auth_method_clone() {
        let method = AuthMethod::Jwt;
        let cloned = method.clone();
        // Verify both are the same variant via Debug
        assert_eq!(format!("{:?}", method), format!("{:?}", cloned));
    }

    #[test]
    fn test_auth_user_debug_format() {
        let user = AuthUser {
            user_id: "u1".to_string(),
            team_id: None,
            auth_method: AuthMethod::ApiKey,
        };
        let debug_str = format!("{:?}", user);
        assert!(debug_str.contains("u1"));
        assert!(debug_str.contains("ApiKey"));
    }
}

/// Look up an API key in the database.
async fn lookup_api_key(db: &DatabaseConnection, key: &str) -> Option<AuthUser> {
    use han_db::entities::api_keys;

    let key_hash = hash_api_key(key);

    let api_key = api_keys::Entity::find()
        .filter(api_keys::Column::KeyHash.eq(&key_hash))
        .filter(api_keys::Column::RevokedAt.is_null())
        .one(db)
        .await
        .ok()??;

    Some(AuthUser {
        user_id: api_key.user_id,
        team_id: Some(api_key.team_id),
        auth_method: AuthMethod::ApiKey,
    })
}
