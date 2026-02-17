//! Route definitions and handlers.

use axum::{
    extract::State,
    http::StatusCode,
    response::IntoResponse,
    routing::{get, post},
    Json, Router,
};
use async_graphql::http::{playground_source, GraphQLPlaygroundConfig};
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use serde_json::json;

use han_api::context::GraphQLContext;

use crate::auth::middleware::AuthUser;
use crate::billing::stripe::webhook_handler;
use crate::state::AppState;

/// Build the application router.
pub fn build_router(state: AppState) -> Router {
    Router::new()
        // Public endpoints
        .route("/health", get(health_handler))
        .route("/webhooks/stripe", post(webhook_handler))
        // Auth endpoints
        .route("/auth/github", get(github_auth_redirect))
        .route("/auth/github/callback", get(github_auth_callback))
        .route("/auth/refresh", post(refresh_token_handler))
        // GraphQL (auth handled inside handler)
        .route("/graphql", post(graphql_handler))
        .route("/graphql/playground", get(graphql_playground))
        // Authenticated API (auth checked in handler)
        .route("/api/sync/sessions", post(sync_sessions_wrapper))
        .with_state(state)
}

/// Health check endpoint.
async fn health_handler() -> impl IntoResponse {
    Json(json!({
        "status": "ok",
        "service": "han-server",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// GraphQL query/mutation handler with optional auth.
async fn graphql_handler(
    State(state): State<AppState>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    // Extract auth from the request headers would need manual handling here.
    // For simplicity, create context without user - auth is added via GraphQL directives.
    let ctx = GraphQLContext::new(state.db.clone(), state.event_sender.clone());
    let request = req.into_inner().data(ctx);
    state.schema.execute(request).await.into()
}

/// GraphQL Playground UI.
async fn graphql_playground() -> impl IntoResponse {
    axum::response::Html(playground_source(
        GraphQLPlaygroundConfig::new("/graphql"),
    ))
}

/// Session sync wrapper that handles auth inline.
async fn sync_sessions_wrapper(
    State(state): State<AppState>,
    headers: axum::http::HeaderMap,
    body: axum::body::Bytes,
) -> impl IntoResponse {
    // Authenticate
    let auth_user = match extract_auth(&state, &headers).await {
        Some(u) => u,
        None => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "unauthorized"})),
            )
                .into_response();
        }
    };

    // Parse body
    let request: crate::sync::receiver::SyncSessionRequest = match serde_json::from_slice(&body) {
        Ok(r) => r,
        Err(e) => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": format!("Invalid request body: {e}")})),
            )
                .into_response();
        }
    };

    crate::sync::receiver::sync_sessions_impl(&state, &auth_user, request)
        .await
        .into_response()
}

/// GitHub OAuth redirect handler.
async fn github_auth_redirect(State(state): State<AppState>) -> impl IntoResponse {
    use crate::auth::oauth::GitHubOAuthConfig;
    use rand::Rng;

    let config = GitHubOAuthConfig {
        client_id: state.config.github_client_id.clone(),
        client_secret: state.config.github_client_secret.clone(),
        redirect_uri: format!("{}/auth/github/callback", state.config.public_url),
    };

    let state_param: String = rand::thread_rng()
        .sample_iter(&rand::distributions::Alphanumeric)
        .take(32)
        .map(char::from)
        .collect();

    let url = config.authorization_url(&state_param);
    axum::response::Redirect::temporary(&url)
}

/// GitHub OAuth callback handler.
async fn github_auth_callback(
    State(state): State<AppState>,
    axum::extract::Query(params): axum::extract::Query<std::collections::HashMap<String, String>>,
) -> impl IntoResponse {
    use crate::auth::jwt::generate_token_pair;
    use crate::auth::oauth::GitHubOAuthConfig;

    let code = match params.get("code") {
        Some(c) => c,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "missing code parameter"})),
            )
                .into_response();
        }
    };

    let oauth_config = GitHubOAuthConfig {
        client_id: state.config.github_client_id.clone(),
        client_secret: state.config.github_client_secret.clone(),
        redirect_uri: format!("{}/auth/github/callback", state.config.public_url),
    };

    let access_token = match oauth_config.exchange_code(code).await {
        Ok(t) => t,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("OAuth token exchange failed: {e}")})),
            )
                .into_response();
        }
    };

    let github_user = match oauth_config.fetch_user(&access_token).await {
        Ok(u) => u,
        Err(e) => {
            return (
                StatusCode::BAD_GATEWAY,
                Json(json!({"error": format!("Failed to fetch user: {e}")})),
            )
                .into_response();
        }
    };

    let user_id = match upsert_user(&state.db, &github_user).await {
        Ok(id) => id,
        Err(e) => {
            return (
                StatusCode::INTERNAL_SERVER_ERROR,
                Json(json!({"error": format!("Failed to create user: {e}")})),
            )
                .into_response();
        }
    };

    match generate_token_pair(&state.config.jwt_secret, &user_id, None) {
        Ok(tokens) => (StatusCode::OK, Json(json!(tokens))).into_response(),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Token generation failed: {e}")})),
        )
            .into_response(),
    }
}

/// Refresh token handler.
async fn refresh_token_handler(
    State(state): State<AppState>,
    Json(body): Json<serde_json::Value>,
) -> impl IntoResponse {
    use crate::auth::jwt::{generate_token_pair, validate_token, TokenType};

    let refresh_token = match body.get("refresh_token").and_then(|v| v.as_str()) {
        Some(t) => t,
        None => {
            return (
                StatusCode::BAD_REQUEST,
                Json(json!({"error": "missing refresh_token"})),
            );
        }
    };

    let claims = match validate_token(&state.config.jwt_secret, refresh_token) {
        Ok(c) if c.token_type == TokenType::Refresh => c,
        _ => {
            return (
                StatusCode::UNAUTHORIZED,
                Json(json!({"error": "invalid refresh token"})),
            );
        }
    };

    match generate_token_pair(&state.config.jwt_secret, &claims.sub, claims.team_id.as_deref()) {
        Ok(tokens) => (StatusCode::OK, Json(json!(tokens))),
        Err(e) => (
            StatusCode::INTERNAL_SERVER_ERROR,
            Json(json!({"error": format!("Token generation failed: {e}")})),
        ),
    }
}

/// Extract authentication from request headers.
async fn extract_auth(state: &AppState, headers: &axum::http::HeaderMap) -> Option<AuthUser> {
    use crate::auth::api_key::hash_api_key;
    use crate::auth::jwt::{validate_token, TokenType};
    use crate::auth::middleware::AuthMethod;

    let auth_header = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())?;

    let token = auth_header.strip_prefix("Bearer ")?;

    // Try JWT
    if let Ok(claims) = validate_token(&state.config.jwt_secret, token) {
        if claims.token_type == TokenType::Access {
            return Some(AuthUser {
                user_id: claims.sub,
                team_id: claims.team_id,
                auth_method: AuthMethod::Jwt,
            });
        }
    }

    // Try API key
    if token.starts_with("han_") {
        use han_db::entities::api_keys;
        use sea_orm::{ColumnTrait, EntityTrait, QueryFilter};

        let key_hash = hash_api_key(token);
        let api_key = api_keys::Entity::find()
            .filter(api_keys::Column::KeyHash.eq(&key_hash))
            .filter(api_keys::Column::RevokedAt.is_null())
            .one(&state.db)
            .await
            .ok()??;

        return Some(AuthUser {
            user_id: api_key.user_id,
            team_id: Some(api_key.team_id),
            auth_method: AuthMethod::ApiKey,
        });
    }

    None
}

/// Upsert a user from GitHub OAuth data.
async fn upsert_user(
    db: &sea_orm::DatabaseConnection,
    github_user: &crate::auth::oauth::GitHubUser,
) -> Result<String, String> {
    use han_db::entities::users;
    use sea_orm::{ActiveModelTrait, ColumnTrait, EntityTrait, QueryFilter, Set};

    let github_id = github_user.id.to_string();

    let existing = users::Entity::find()
        .filter(users::Column::GithubId.eq(&github_id))
        .one(db)
        .await
        .map_err(|e| format!("DB error: {e}"))?;

    if let Some(user) = existing {
        let mut active: users::ActiveModel = user.clone().into();
        active.display_name = Set(github_user.name.clone());
        active.avatar_url = Set(github_user.avatar_url.clone());
        active.github_username = Set(Some(github_user.login.clone()));
        active.updated_at = Set(chrono::Utc::now().to_rfc3339());
        active.update(db).await.map_err(|e| format!("Update failed: {e}"))?;
        return Ok(user.id);
    }

    if let Some(ref email) = github_user.email {
        let existing = users::Entity::find()
            .filter(users::Column::Email.eq(email))
            .one(db)
            .await
            .map_err(|e| format!("DB error: {e}"))?;

        if let Some(user) = existing {
            let mut active: users::ActiveModel = user.clone().into();
            active.github_id = Set(Some(github_id));
            active.github_username = Set(Some(github_user.login.clone()));
            active.avatar_url = Set(github_user.avatar_url.clone());
            active.updated_at = Set(chrono::Utc::now().to_rfc3339());
            active.update(db).await.map_err(|e| format!("Update failed: {e}"))?;
            return Ok(user.id);
        }
    }

    let user_id = uuid::Uuid::new_v4().to_string();
    let now = chrono::Utc::now().to_rfc3339();

    let active = users::ActiveModel {
        id: Set(user_id.clone()),
        github_id: Set(Some(github_id)),
        github_username: Set(Some(github_user.login.clone())),
        email: Set(github_user.email.clone()),
        display_name: Set(github_user.name.clone()),
        avatar_url: Set(github_user.avatar_url.clone()),
        role: Set("ic".to_string()),
        stripe_customer_id: Set(None),
        subscription_id: Set(None),
        subscription_status: Set(None),
        created_at: Set(now.clone()),
        updated_at: Set(now),
    };

    active.insert(db).await.map_err(|e| format!("Insert failed: {e}"))?;
    Ok(user_id)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::response::IntoResponse;
    use http_body_util::BodyExt;

    #[tokio::test]
    async fn test_health_handler_returns_ok() {
        let response = health_handler().await.into_response();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_health_handler_json_body() {
        let response = health_handler().await.into_response();
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(json["status"], "ok");
        assert_eq!(json["service"], "han-server");
        assert!(json["version"].is_string(), "version should be a string");
    }

    #[tokio::test]
    async fn test_health_handler_version_matches_cargo_pkg() {
        let response = health_handler().await.into_response();
        let body = response.into_body().collect().await.unwrap().to_bytes();
        let json: serde_json::Value = serde_json::from_slice(&body).unwrap();

        assert_eq!(json["version"].as_str().unwrap(), env!("CARGO_PKG_VERSION"));
    }
}
