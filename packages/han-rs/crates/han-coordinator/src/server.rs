//! Authenticated loopback HTTP and WebSocket endpoint for GraphQL.

use async_graphql_axum::{GraphQLRequest, GraphQLResponse};
use axum::{
    extract::{Request, State, WebSocketUpgrade},
    http::{header, Method, StatusCode},
    middleware::{self, Next},
    response::{IntoResponse, Response},
    routing::{get, post},
    Router,
};
use han_api::HanSchema;
use subtle::ConstantTimeEq;
use std::{collections::HashMap, sync::Arc, time::{Duration, Instant}};

#[derive(Clone)]
struct AppState {
    schema: HanSchema,
    start_time: Instant,
    authority: String,
    bearer: String,
}

async fn guard(State(state): State<Arc<AppState>>, request: Request, next: Next) -> Response {
    let headers = request.headers();
    let hosts: Vec<_> = headers.get_all(header::HOST).iter().collect();
    if hosts.len() > 1 {
        return StatusCode::BAD_REQUEST.into_response();
    }
    let host = hosts.first().and_then(|h| h.to_str().ok());
    let authority = request.uri().authority().map(|a| a.as_str());
    if (!hosts.is_empty() && host.is_none()) || (host.is_none() && authority.is_none()) {
        return StatusCode::BAD_REQUEST.into_response();
    }
    if host.is_some_and(|h| h != state.authority) || authority.is_some_and(|a| a != state.authority) {
        return StatusCode::MISDIRECTED_REQUEST.into_response();
    }
    if headers.contains_key(header::ORIGIN) || headers.contains_key("access-control-request-private-network") {
        return StatusCode::FORBIDDEN.into_response();
    }
    for key in ["sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest"] {
        let values: Vec<_> = headers.get_all(key).iter().collect();
        if values.len() > 1 || values.first().is_some_and(|v| match key {
            "sec-fetch-site" => v != "same-origin" && v != "none",
            "sec-fetch-mode" => v != "same-origin" && v != "cors" && v != "websocket",
            _ => v != "empty" && v != "websocket",
        }) {
            return StatusCode::FORBIDDEN.into_response();
        }
    }
    let auth: Vec<_> = headers.get_all(header::AUTHORIZATION).iter().collect();
    let expected = format!("Bearer {}", state.bearer);
    let valid = auth.len() == 1
        && bool::from(auth[0].as_bytes().ct_eq(expected.as_bytes()));
    if !valid {
        return StatusCode::UNAUTHORIZED.into_response();
    }
    if request.uri().path() == "/graphql" && request.method() == Method::POST {
        let types: Vec<_> = headers.get_all(header::CONTENT_TYPE).iter().collect();
        if types.len() != 1 || !types[0].to_str().ok().is_some_and(|v| v.split(';').next().is_some_and(|v| v.trim().eq_ignore_ascii_case("application/json"))) {
            return StatusCode::UNSUPPORTED_MEDIA_TYPE.into_response();
        }
    }
    next.run(request).await
}

async fn health_handler(State(state): State<Arc<AppState>>) -> impl IntoResponse {
    axum::Json(serde_json::json!({
        "status": "ok", "version": env!("CARGO_PKG_VERSION"),
        "pid": std::process::id(), "uptime": state.start_time.elapsed().as_secs(),
    }))
}

async fn graphql_handler(State(state): State<Arc<AppState>>, req: GraphQLRequest) -> GraphQLResponse {
    state.schema.execute(req.into_inner()).await.into()
}

async fn graphql_ws_handler(State(state): State<Arc<AppState>>, headers: axum::http::HeaderMap, ws: WebSocketUpgrade) -> Response {
    let offered = headers.get_all(header::SEC_WEBSOCKET_PROTOCOL).iter().filter_map(|h| h.to_str().ok())
        .flat_map(|h| h.split(',')).any(|p| p.trim() == "graphql-transport-ws");
    if !offered { return StatusCode::BAD_REQUEST.into_response(); }
    let schema = state.schema.clone();
    ws.protocols(["graphql-transport-ws"]).on_upgrade(move |socket| async move {
        use axum::extract::ws::{CloseFrame, Message};
        use futures_util::{SinkExt, StreamExt};
        let (mut sink, mut stream) = socket.split();
        let first = tokio::time::timeout(Duration::from_secs(10), stream.next()).await;
        let initialized = match first {
            Ok(Some(Ok(Message::Text(text)))) => serde_json::from_str::<serde_json::Value>(&text).ok()
                .is_some_and(|v| v.get("type").and_then(|v| v.as_str()) == Some("connection_init")),
            _ => false,
        };
        if !initialized {
            let _ = sink.send(Message::Close(Some(CloseFrame { code: 4408, reason: "initialization required".into() }))).await;
            return;
        }
        if sink.send(Message::Text(serde_json::json!({"type":"connection_ack"}).to_string().into())).await.is_err() { return; }
        let (tx, mut rx) = tokio::sync::mpsc::channel::<String>(64);
        let sender = tokio::spawn(async move {
            while let Some(msg) = rx.recv().await {
                if sink.send(Message::Text(msg.into())).await.is_err() { break; }
            }
        });
        let mut operations: HashMap<String, tokio::task::JoinHandle<()>> = HashMap::new();
        while let Some(Ok(msg)) = stream.next().await {
            match msg {
                Message::Text(text) => {
                    let Ok(value) = serde_json::from_str::<serde_json::Value>(&text) else { break; };
                    match value.get("type").and_then(|v| v.as_str()) {
                        Some("connection_init") => break,
                        Some("subscribe") => {
                            let Some(id) = value.get("id").and_then(|v| v.as_str()) else { break; };
                            if operations.get(id).is_some_and(|handle| !handle.is_finished()) { break; }
                            let Some(payload) = value.get("payload") else { break; };
                            let Some(query) = payload.get("query").and_then(|v| v.as_str()) else { break; };
                            let mut request = async_graphql::Request::new(query);
                            if let Some(vars) = payload.get("variables") { request = request.variables(async_graphql::Variables::from_json(vars.clone())); }
                            if let Some(name) = payload.get("operationName").and_then(|v| v.as_str()) { request = request.operation_name(name); }
                            let mut responses = schema.execute_stream(request);
                            let tx = tx.clone();
                            let operation_id = id.to_owned();
                            let handle = tokio::spawn(async move {
                                while let Some(response) = responses.next().await {
                                    let next = serde_json::json!({"id":operation_id,"type":"next","payload":response});
                                    if tx.send(next.to_string()).await.is_err() { return; }
                                }
                                let _ = tx.send(serde_json::json!({"id":operation_id,"type":"complete"}).to_string()).await;
                            });
                            operations.insert(id.to_owned(), handle);
                        }
                        Some("complete") => {
                            if let Some(id) = value.get("id").and_then(|v| v.as_str()) {
                                if let Some(handle) = operations.remove(id) { handle.abort(); }
                            }
                        }
                        Some("ping") => { let _ = tx.send(serde_json::json!({"type":"pong"}).to_string()).await; }
                        Some("pong") => {}
                        _ => break,
                    }
                }
                Message::Close(_) => break,
                _ => {}
            }
        }
        for (_, handle) in operations { handle.abort(); }
        sender.abort();
    }).into_response()
}

pub fn build_router(schema: HanSchema, start_time: Instant, port: u16, bearer: String) -> Router {
    let state = Arc::new(AppState { schema, start_time, authority: format!("127.0.0.1:{port}"), bearer });
    Router::new()
        .route("/health", get(health_handler))
        .route("/graphql", post(graphql_handler).get(graphql_ws_handler))
        .layer(middleware::from_fn_with_state(state.clone(), guard))
        .with_state(state)
}

#[cfg(test)]
mod tests {
    use super::*;
    use axum::{body::Body, http::Request};
    use han_api::context::DbChangeEvent;
    use tokio::sync::broadcast;
    use tower::ServiceExt;

    fn app() -> Router {
        let (tx, _) = broadcast::channel::<DbChangeEvent>(16);
        let schema = async_graphql::Schema::build(han_api::query::QueryRoot, han_api::mutation::MutationRoot, han_api::subscription::SubscriptionRoot).data(tx).finish();
        build_router(schema, Instant::now(), 41957, "secret".into())
    }

    #[tokio::test]
    async fn rejects_host_origin_and_credentials_before_routing() {
        for (host, origin, auth, expected) in [
            ("127.0.0.1:41957", None, Some("Bearer secret"), StatusCode::OK),
            ("localhost:41957", None, Some("Bearer secret"), StatusCode::MISDIRECTED_REQUEST),
            ("127.0.0.1:41957", Some("http://127.0.0.1:41956"), Some("Bearer secret"), StatusCode::FORBIDDEN),
            ("127.0.0.1:41957", None, Some("Bearer wrong"), StatusCode::UNAUTHORIZED),
            ("127.0.0.1:41957", None, None, StatusCode::UNAUTHORIZED),
        ] {
            let mut req = Request::builder().uri("/health").header("host", host);
            if let Some(origin) = origin { req = req.header("origin", origin); }
            if let Some(auth) = auth { req = req.header("authorization", auth); }
            assert_eq!(app().oneshot(req.body(Body::empty()).unwrap()).await.unwrap().status(), expected);
        }
    }

    #[tokio::test]
    async fn rejects_forms_and_private_network_preflights() {
        let request = Request::builder().method("POST").uri("/graphql").header("host", "127.0.0.1:41957").header("authorization", "Bearer secret").header("content-type", "text/plain").body(Body::empty()).unwrap();
        assert_eq!(app().oneshot(request).await.unwrap().status(), StatusCode::UNSUPPORTED_MEDIA_TYPE);
        let request = Request::builder().method("OPTIONS").uri("/graphql").header("host", "127.0.0.1:41957").header("access-control-request-private-network", "true").body(Body::empty()).unwrap();
        assert_eq!(app().oneshot(request).await.unwrap().status(), StatusCode::FORBIDDEN);
    }
}
