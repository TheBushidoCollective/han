//! HTTP/WebSocket server for GraphQL API.
//!
//! Uses Axum for HTTP routing with async-graphql handlers.
//! POST /graphql for queries/mutations, GET /graphql (WS upgrade) for subscriptions,
//! GET /graphiql for IDE.

use async_graphql::http::GraphiQLSource;
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    Router,
    extract::{State, WebSocketUpgrade},
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

/// GraphQL WebSocket handler for subscriptions.
///
/// Handles WS upgrade and runs the graphql-ws protocol using async-graphql's
/// built-in transport support. This avoids depending on async-graphql-axum's
/// `GraphQLSubscription` which may conflict with tonic's axum version.
async fn graphql_ws_handler(
    State(state): State<Arc<AppState>>,
    ws: WebSocketUpgrade,
) -> impl IntoResponse {
    let schema = state.schema.clone();

    ws.protocols(["graphql-transport-ws", "graphql-ws"])
        .on_upgrade(move |socket| async move {
            use axum::extract::ws::Message;
            use futures_util::{SinkExt, StreamExt};

            let (mut sink, mut stream) = socket.split();

            // Simple graphql-ws protocol handler
            let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(64);

            // Forward outgoing messages
            let send_handle = tokio::spawn(async move {
                while let Some(msg) = rx.recv().await {
                    if sink.send(Message::Text(msg.into())).await.is_err() {
                        break;
                    }
                }
            });

            // Process incoming messages
            while let Some(Ok(msg)) = stream.next().await {
                match msg {
                    Message::Text(text) => {
                        let text = text.to_string();
                        if let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) {
                            let msg_type = value
                                .get("type")
                                .and_then(|v| v.as_str())
                                .unwrap_or("");

                            match msg_type {
                                "connection_init" => {
                                    let ack = serde_json::json!({"type": "connection_ack"});
                                    let _ = tx.send(ack.to_string()).await;
                                }
                                "subscribe" | "start" => {
                                    let id = value
                                        .get("id")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("1")
                                        .to_string();
                                    let payload = value.get("payload").cloned().unwrap_or_default();
                                    let query = payload
                                        .get("query")
                                        .and_then(|v| v.as_str())
                                        .unwrap_or("")
                                        .to_string();

                                    let request =
                                        async_graphql::Request::new(&query);
                                    let mut subscription_stream =
                                        schema.execute_stream(request);

                                    let tx_clone = tx.clone();
                                    let id_clone = id.clone();
                                    tokio::spawn(async move {
                                        while let Some(response) =
                                            subscription_stream.next().await
                                        {
                                            let next = serde_json::json!({
                                                "id": id_clone,
                                                "type": "next",
                                                "payload": serde_json::to_value(&response).unwrap_or_default()
                                            });
                                            if tx_clone.send(next.to_string()).await.is_err() {
                                                break;
                                            }
                                        }
                                        let complete = serde_json::json!({
                                            "id": id_clone,
                                            "type": "complete"
                                        });
                                        let _ = tx_clone.send(complete.to_string()).await;
                                    });
                                }
                                "complete" | "stop" => {
                                    // Client wants to stop subscription - handled by drop
                                }
                                "ping" => {
                                    let pong = serde_json::json!({"type": "pong"});
                                    let _ = tx.send(pong.to_string()).await;
                                }
                                _ => {}
                            }
                        }
                    }
                    Message::Close(_) => break,
                    _ => {}
                }
            }

            send_handle.abort();
        })
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
        .route(
            "/graphql",
            post(graphql_handler).get(graphql_ws_handler),
        )
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
