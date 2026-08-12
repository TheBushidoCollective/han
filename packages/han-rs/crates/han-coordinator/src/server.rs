//! HTTP/WebSocket server for GraphQL API.
//!
//! Uses Axum for HTTP routing with async-graphql handlers.
//! POST /graphql for queries/mutations, GET /graphql (WS upgrade) for subscriptions,
//! GET /graphiql for IDE.

use async_graphql::http::GraphiQLSource;
use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    extract::{Request, State, WebSocketUpgrade},
    http::{HeaderValue, Uri},
    middleware::{self, Next},
    response::{Html, IntoResponse, Response},
    routing::{get, post},
    Router,
};
use han_api::HanSchema;
use std::sync::Arc;
use std::time::Instant;
use tower_http::cors::{AllowOrigin, Any, CorsLayer};

/// Shared server state.
#[derive(Clone)]
pub struct AppState {
    pub schema: HanSchema,
    pub start_time: Instant,
}

/// Health check response.
///
/// Returns `pid` and `uptime` so the TypeScript daemon manager can track the process.
async fn health_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    let uptime_secs = state.start_time.elapsed().as_secs();
    axum::Json(serde_json::json!({
        "status": "ok",
        "version": env!("CARGO_PKG_VERSION"),
        "pid": std::process::id(),
        "uptime": uptime_secs,
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

                                    let variables = payload
                                        .get("variables")
                                        .cloned()
                                        .unwrap_or(serde_json::Value::Null);
                                    let mut request =
                                        async_graphql::Request::new(&query);
                                    if let serde_json::Value::Object(vars) = variables {
                                        request = request.variables(
                                            async_graphql::Variables::from_json(
                                                serde_json::Value::Object(vars),
                                            ),
                                        );
                                    }
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

/// Origin of the hosted dashboard, which reaches this daemon over loopback.
const DASHBOARD_ORIGIN: &str = "https://dashboard.local.han.guru";

/// Whether an `Origin` header may talk to this coordinator.
///
/// Loopback origins are permitted on any port because a page already running on
/// this machine gains nothing from being refused. Everything else must be the
/// hosted dashboard exactly; no suffix matching, so `dashboard.local.han.guru.evil.com`
/// is rejected.
fn is_allowed_dashboard_origin(origin: &str) -> bool {
    if origin == DASHBOARD_ORIGIN {
        return true;
    }

    // Parse instead of splitting. This is a security boundary and hand rolled
    // string cases already let `http://[::1]evil.com` through once.
    let Ok(uri) = origin.parse::<Uri>() else {
        return false;
    };

    let Some(scheme) = uri.scheme_str() else {
        return false;
    };
    if !matches!(scheme, "http" | "https") {
        return false;
    }
    let Some(authority) = uri.authority() else {
        return false;
    };

    // Require the origin to round-trip. Anything the parser normalized, dropped
    // or reinterpreted fails here, so a discrepancy between what the parser read
    // and what the peer sent can never be read as an allowed host.
    if origin.trim_end_matches('/') != format!("{scheme}://{authority}") {
        return false;
    }

    // Compare the authority literal, not `Authority::host()`. For
    // `[::1]evil.com` that accessor reports just `[::1]`, which would read as
    // loopback and let the glued-on host through.
    let authority = authority.as_str();
    let host = match authority.rfind(':') {
        // A colon after the closing bracket introduces a port. One inside the
        // brackets belongs to the IPv6 literal.
        Some(colon)
            if authority[colon + 1..]
                .parse::<u16>()
                .is_ok_and(|_| authority.rfind(']').is_none_or(|close| close < colon)) =>
        {
            &authority[..colon]
        }
        _ => authority,
    };

    matches!(host, "localhost" | "127.0.0.1" | "[::1]")
}

/// Build the Axum router with GraphQL endpoints.
pub fn build_router(schema: HanSchema, start_time: Instant) -> Router {
    let state = Arc::new(AppState {
        schema: schema.clone(),
        start_time,
    });

    // The dashboard is served from a public origin but talks to this loopback
    // port, so Chrome applies Private Network Access: the preflight must carry
    // `Access-Control-Allow-Private-Network: true` or the request hangs and the
    // dashboard sits on "Connecting to Han Coordinator..." forever.
    //
    // That header must never be paired with a wildcard origin. It would let any
    // page on the internet read this machine's session data, and PNA is the only
    // thing standing in the way today. So origins are allowlisted instead: the
    // hosted dashboard, and any loopback origin (already same-machine).
    let cors = CorsLayer::new()
        .allow_origin(AllowOrigin::predicate(|origin, _request_head| {
            origin
                .to_str()
                .map(is_allowed_dashboard_origin)
                .unwrap_or(false)
        }))
        .allow_methods(vec![
            axum::http::Method::GET,
            axum::http::Method::POST,
            axum::http::Method::OPTIONS,
        ])
        .allow_headers(Any);

    Router::new()
        .route("/health", get(health_handler))
        .route("/graphql", post(graphql_handler).get(graphql_ws_handler))
        .route("/graphiql", get(graphiql_handler))
        // Order matters. `CorsLayer` answers a preflight itself and never calls
        // the inner service, so the private network layer has to sit outside it
        // to see that response. The last `.layer` is the outermost.
        .layer(cors)
        .layer(middleware::from_fn(allow_private_network))
        .with_state(state)
}

/// Answer Chrome's Private Network Access preflight.
///
/// Runs outside the CORS layer so it sees the finished preflight response and
/// only marks the ones CORS already approved for an allowlisted origin. A
/// rejected origin gets no `Access-Control-Allow-Origin`, so it gets no private
/// network grant either.
///
/// The grant is only emitted for a preflight that asked for it. An ordinary CORS
/// preflight has no business advertising private network access.
async fn allow_private_network(request: Request, next: Next) -> Response {
    let asked_for_private_network = request.method() == axum::http::Method::OPTIONS
        && request
            .headers()
            .get("access-control-request-private-network")
            .and_then(|value| value.to_str().ok())
            .is_some_and(|value| value.eq_ignore_ascii_case("true"));

    let mut response = next.run(request).await;

    if asked_for_private_network
        && response
            .headers()
            .contains_key(axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN)
    {
        response.headers_mut().insert(
            "access-control-allow-private-network",
            HeaderValue::from_static("true"),
        );
    }

    response
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
        let app = build_router(schema, Instant::now());

        let req = Request::builder()
            .uri("/health")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[test]
    fn allows_dashboard_and_loopback_origins() {
        assert!(is_allowed_dashboard_origin(
            "https://dashboard.local.han.guru"
        ));
        assert!(is_allowed_dashboard_origin("http://localhost:41956"));
        assert!(is_allowed_dashboard_origin("http://127.0.0.1:4899"));
        assert!(is_allowed_dashboard_origin("http://[::1]:4899"));
    }

    #[test]
    fn rejects_foreign_origins() {
        // A lookalike host must not pass by suffix or prefix matching.
        assert!(!is_allowed_dashboard_origin(
            "https://dashboard.local.han.guru.evil.com"
        ));
        assert!(!is_allowed_dashboard_origin("https://evil.com"));
        assert!(!is_allowed_dashboard_origin("http://localhost.evil.com"));
        assert!(!is_allowed_dashboard_origin("https://notlocalhost"));
        assert!(!is_allowed_dashboard_origin("null"));
        // A bracketed IPv6 loopback with a hostname glued on. Ad hoc splitting
        // read the host as "::1" and accepted this.
        assert!(!is_allowed_dashboard_origin("http://[::1]evil.com"));
        // An origin carries no path, so anything with one is not an origin.
        assert!(!is_allowed_dashboard_origin("http://localhost.evil/path"));
        assert!(!is_allowed_dashboard_origin(
            "https://evil.com/dashboard.local.han.guru"
        ));
        // Scheme must be http(s); a file or data URL is not an allowed origin.
        assert!(!is_allowed_dashboard_origin("file://localhost"));
        assert!(!is_allowed_dashboard_origin("localhost:41956"));
        assert!(!is_allowed_dashboard_origin(""));
    }

    /// Chrome hangs the request without this header, which is what left the
    /// dashboard stuck on "Connecting to Han Coordinator...".
    #[tokio::test]
    async fn preflight_grants_private_network_to_dashboard() {
        let app = build_router(test_schema(), Instant::now());

        let req = Request::builder()
            .method(axum::http::Method::OPTIONS)
            .uri("/health")
            .header("origin", "https://dashboard.local.han.guru")
            .header("access-control-request-method", "GET")
            .header("access-control-request-private-network", "true")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(
            response
                .headers()
                .get("access-control-allow-private-network")
                .and_then(|v| v.to_str().ok()),
            Some("true")
        );
    }

    /// An ordinary CORS preflight did not ask for private network access, so the
    /// response must not advertise it.
    #[tokio::test]
    async fn ordinary_preflight_omits_private_network_grant() {
        let app = build_router(test_schema(), Instant::now());

        let req = Request::builder()
            .method(axum::http::Method::OPTIONS)
            .uri("/health")
            .header("origin", "https://dashboard.local.han.guru")
            .header("access-control-request-method", "GET")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert!(
            response
                .headers()
                .contains_key(axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN),
            "the dashboard origin should still pass CORS"
        );
        assert!(
            !response
                .headers()
                .contains_key("access-control-allow-private-network"),
            "a preflight that did not request private network access must not receive a grant"
        );
    }

    /// The grant is what makes loopback reachable from a web page, so it must
    /// never be handed to an origin CORS did not approve.
    #[tokio::test]
    async fn preflight_denies_private_network_to_foreign_origin() {
        let app = build_router(test_schema(), Instant::now());

        let req = Request::builder()
            .method(axum::http::Method::OPTIONS)
            .uri("/health")
            .header("origin", "https://evil.com")
            .header("access-control-request-method", "GET")
            .header("access-control-request-private-network", "true")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert!(
            !response
                .headers()
                .contains_key("access-control-allow-private-network"),
            "foreign origin must not receive a private network grant"
        );
        assert!(
            !response
                .headers()
                .contains_key(axum::http::header::ACCESS_CONTROL_ALLOW_ORIGIN),
            "foreign origin must not be approved by CORS"
        );
    }

    #[tokio::test]
    async fn test_graphql_post() {
        let schema = test_schema();
        let app = build_router(schema, Instant::now());

        let req = Request::builder()
            .method(axum::http::Method::POST)
            .uri("/graphql")
            .header("content-type", "application/json")
            .body(Body::from(r#"{"query":"{ __typename }"}"#))
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);
    }

    #[tokio::test]
    async fn test_graphiql_handler_returns_html() {
        let schema = test_schema();
        let app = build_router(schema, Instant::now());

        let req = Request::builder()
            .uri("/graphiql")
            .body(Body::empty())
            .unwrap();

        let response = app.oneshot(req).await.unwrap();
        assert_eq!(response.status(), StatusCode::OK);

        // Check content-type is HTML
        let content_type = response
            .headers()
            .get("content-type")
            .expect("should have content-type header")
            .to_str()
            .unwrap();
        assert!(
            content_type.contains("text/html"),
            "Expected text/html content-type, got: {}",
            content_type
        );

        // Read body and verify it contains GraphiQL markers
        let body_bytes = axum::body::to_bytes(response.into_body(), 1_000_000)
            .await
            .unwrap();
        let body_str = String::from_utf8_lossy(&body_bytes);
        assert!(
            body_str.contains("graphiql") || body_str.contains("GraphiQL"),
            "Expected GraphiQL content in HTML body"
        );
    }
}
