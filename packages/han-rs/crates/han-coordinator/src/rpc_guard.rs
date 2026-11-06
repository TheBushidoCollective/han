//! HTTP policy enforced before gRPC-web translation and RPC dispatch.
use axum::http::{header, Request, Response, StatusCode};
use futures_util::future::{ready, Either, Ready};
use std::{sync::Arc, task::{Context, Poll}};
use subtle::ConstantTimeEq;
use tower::{Layer, Service};

struct Security { authority: String, bearer: String }
#[derive(Clone)]
pub struct GuardLayer(Arc<Security>);
impl GuardLayer {
    pub fn new(port: u16, bearer: &str) -> Self {
        Self(Arc::new(Security { authority: format!("127.0.0.1:{port}"), bearer: format!("Bearer {bearer}") }))
    }
}
#[derive(Clone)]
pub struct Guard<S> { inner: S, security: Arc<Security> }
impl<S> Layer<S> for GuardLayer {
    type Service = Guard<S>;
    fn layer(&self, inner: S) -> Self::Service { Guard { inner, security: self.0.clone() } }
}
impl<S, B> Service<Request<B>> for Guard<S>
where S: Service<Request<B>, Response = Response<tonic::body::BoxBody>> {
    type Response = Response<tonic::body::BoxBody>;
    type Error = S::Error;
    type Future = Either<Ready<Result<Self::Response, Self::Error>>, S::Future>;
    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> { self.inner.poll_ready(cx) }
    fn call(&mut self, req: Request<B>) -> Self::Future {
        let all_hosts = req.headers().get_all(header::HOST);
        let mut hosts = all_hosts.iter();
        let first_host = hosts.next();
        let host_value = first_host.and_then(|v| v.to_str().ok());
        let uri_authority = req.uri().authority().map(|a| a.as_str());
        let incompatible_metadata = ["sec-fetch-site", "sec-fetch-mode", "sec-fetch-dest"].iter().any(|key| {
            let all_values = req.headers().get_all(*key);
            let mut values = all_values.iter();
            let first = values.next();
            values.next().is_some() || first.is_some_and(|v| match *key {
                "sec-fetch-site" => v != "same-origin" && v != "none",
                "sec-fetch-mode" => v != "same-origin" && v != "cors",
                _ => v != "empty",
            })
        });
        let status = if hosts.next().is_some() || (first_host.is_some() && host_value.is_none()) || (host_value.is_none() && uri_authority.is_none()) {
            Some(StatusCode::BAD_REQUEST)
        } else if host_value.is_some_and(|v| v != self.security.authority) || uri_authority.is_some_and(|v| v != self.security.authority) {
            Some(StatusCode::MISDIRECTED_REQUEST)
        } else if req.headers().contains_key(header::ORIGIN) || req.headers().contains_key("access-control-request-private-network") || incompatible_metadata {
            Some(StatusCode::FORBIDDEN)
        } else { None };
        if let Some(status) = status {
            return Either::Left(ready(Ok(Response::builder().status(status).body(tonic::body::empty_body()).expect("valid response"))));
        }
        let all_auth = req.headers().get_all(header::AUTHORIZATION);
        let mut auth = all_auth.iter();
        let authorized = auth.next().is_some_and(|v| bool::from(v.as_bytes().ct_eq(self.security.bearer.as_bytes()))) && auth.next().is_none();
        if !authorized {
            let content_type = match req.headers().get(header::CONTENT_TYPE).and_then(|v| v.to_str().ok()) {
                Some("application/grpc-web" | "application/grpc-web+proto") => "application/grpc-web+proto",
                Some("application/grpc-web-text" | "application/grpc-web-text+proto") => "application/grpc-web-text+proto",
                _ => "application/grpc",
            };
            return Either::Left(ready(Ok(Response::builder().status(StatusCode::OK).header("content-type", content_type).header("grpc-status", "16").header("grpc-message", "unauthenticated").body(tonic::body::empty_body()).expect("valid response"))));
        }
        Either::Right(self.inner.call(req))
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use tower::ServiceExt;

    #[tokio::test]
    async fn guards_http2_authority_origin_and_auth_before_service() {
        let layer = GuardLayer::new(41958, "secret");
        let inner = tower::service_fn(|_: Request<()>| async {
            Ok::<_, std::convert::Infallible>(Response::builder().header("reached", "yes").body(tonic::body::empty_body()).unwrap())
        });
        for (uri, origin, auth, status, grpc_status, reached) in [
            ("https://127.0.0.1:41958/service", None, Some("Bearer secret"), StatusCode::OK, None, true),
            ("https://evil.example:41958/service", None, Some("Bearer secret"), StatusCode::MISDIRECTED_REQUEST, None, false),
            ("https://127.0.0.1:41958/service", Some("null"), Some("Bearer secret"), StatusCode::FORBIDDEN, None, false),
            ("https://127.0.0.1:41958/service", None, Some("Bearer wrong"), StatusCode::OK, Some("16"), false),
            ("https://127.0.0.1:41958/service", None, None, StatusCode::OK, Some("16"), false),
        ] {
            let mut request = Request::builder().uri(uri).header("content-type", "application/grpc-web+proto");
            if let Some(origin) = origin { request = request.header("origin", origin); }
            if let Some(auth) = auth { request = request.header("authorization", auth); }
            let response = layer.layer(inner.clone()).oneshot(request.body(()).unwrap()).await.unwrap();
            assert_eq!(response.status(), status);
            assert_eq!(response.headers().get("grpc-status").and_then(|v| v.to_str().ok()), grpc_status);
            assert_eq!(response.headers().contains_key("reached"), reached);
        }
    }
}
