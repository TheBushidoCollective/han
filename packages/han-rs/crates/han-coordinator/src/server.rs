//! HTTP/WebSocket server for GraphQL API.
//!
//! Uses Axum for HTTP routing with async-graphql handlers.
//! POST /graphql for queries/mutations, GET /graphiql for IDE.

use async_graphql::http::GraphiQLSource;
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    Router,
    extract::State,
    response::{Html, IntoResponse},
    routing::{get, post},
};
use han_api::HanSchema;
use std::sync::Arc;
use tower_http::cors::{Any, CorsLayer};

/// Shared server state.
#[derive(Clone)]
pub struct AppState {
    pub schema: HanSchema,
}

/// Health check response.
async fn health_handler() -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
    }))
}

/// GraphQL POST handler for queries and mutations.
async fn graphql_handler(
    State(state): State<Arc<AppState>>,
    req: GraphQLRequest,
) -> GraphQLResponse {
    state.schema.execute(req.into_inner()).await.into()
}

/// GraphiQL IDE handler.
async fn graphiql_handler() -> impl IntoResponse {
    Html(
        GraphiQLSource::build()
            .endpoint("/graphql")
            .subscription_endpoint("/graphql")
            .finish(),
    )
}

/// Build the Axum router with GraphQL endpoints.
pub fn build_router(schema: HanSchema) -> Router {
    let state = Arc::new(AppState {
        schema: schema.clone(),
    });

    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(vec![
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers(Any);

    Router::new()
        .route("/health", get(health_handler))
        .route("/graphql", post(graphql_handler))
        .route("/graphiql", get(graphiql_handler))
        .layer(cors)
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::body::Body;
    use axum::http::{Request, StatusCode};
    use han_api::context::DbChangeEvent;
    use tokio::sync::broadcast;
    use tower::ServiceExt;

    fn test_schema() -> HanSchema {
        let (tx, _) = broadcast::channel::<DbChangeEvent>(16);
        async_graphql::Schema::build(
            han_api::query::QueryRoot,
            han_api::mutation::MutationRoot,
            han_api::subscription::SubscriptionRoot,
        )
        .data(tx)
        .finish()
    }

    #[tokio::test]
    async fn test_health_endpoint() {
        let schema = test_schema();
        let app = build_router(schema);

        let req = Request::builder()
            .uri("/health")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_graphql_post() {
        let schema = test_schema();
        let app = build_router(schema);

        let req = Request::builder()
            .method(axum::http::Method::POST)
            .uri("/graphql")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"query":"{ __typename }"}"#))
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }
}
