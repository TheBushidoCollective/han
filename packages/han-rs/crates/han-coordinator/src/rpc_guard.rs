//! HTTP policy enforced before gRPC-web translation and RPC dispatch.
use axum::http::{header, Request, Response, StatusCode};
use std::{future::Future, pin::Pin, task::{Context, Poll}};
use subtle::ConstantTimeEq;
use tower::{Layer, Service};

#[derive(Clone)]
pub struct GuardLayer { pub port: u16, pub bearer: String }
#[derive(Clone)]
pub struct Guard<S> { inner: S, port: u16, bearer: String }
impl<S> Layer<S> for GuardLayer {
    type Service = Guard<S>;
    fn layer(&self, inner: S) -> Self::Service { Guard { inner, port: self.port, bearer: self.bearer.clone() } }
}
impl<S, B> Service<Request<B>> for Guard<S>
where
    S: Service<Request<B>, Response = Response<tonic::body::BoxBody>> + Send + 'static,
    S::Future: Send + 'static,
    S::Error: Send + 'static,
    B: Send + 'static,
{
    type Response = Response<tonic::body::BoxBody>;
    type Error = S::Error;
    type Future = Pin<Box<dyn Future<Output = Result<Self::Response, Self::Error>> + Send>>;
    fn poll_ready(&mut self, cx: &mut Context<'_>) -> Poll<Result<(), Self::Error>> { self.inner.poll_ready(cx) }
    fn call(&mut self, req: Request<B>) -> Self::Future {
        let host: Vec<_> = req.headers().get_all(header::HOST).iter().collect();
        let uri_authority = req.uri().authority().map(|a| a.as_str());
        let host_value = host.first().and_then(|v| v.to_str().ok());
        let expected = format!("127.0.0.1:{}", self.port);
        let status = if host.len() > 1 || (!host.is_empty() && host_value.is_none()) || (host_value.is_none() && uri_authority.is_none()) {
            Some(StatusCode::BAD_REQUEST)
        } else if host_value.is_some_and(|v| v != expected) || uri_authority.is_some_and(|v| v != expected) {
            Some(StatusCode::MISDIRECTED_REQUEST)
        } else if req.headers().contains_key(header::ORIGIN) || req.headers().contains_key("access-control-request-private-network") || req.headers().get_all("sec-fetch-site").iter().any(|v| v != "same-origin" && v != "none") {
            Some(StatusCode::FORBIDDEN)
        } else { None };
        if let Some(status) = status {
            return Box::pin(async move { Ok(Response::builder().status(status).body(tonic::body::empty_body()).expect("valid response")) });
        }
        let authorization: Vec<_> = req.headers().get_all(header::AUTHORIZATION).iter().collect();
        let expected = format!("Bearer {}", self.bearer);
        if authorization.len() != 1 || !bool::from(authorization[0].as_bytes().ct_eq(expected.as_bytes())) {
            return Box::pin(async move { Ok(Response::builder().status(StatusCode::OK).header("content-type", "application/grpc").header("grpc-status", "16").header("grpc-message", "unauthenticated").body(tonic::body::empty_body()).expect("valid response")) });
        }
        let future = self.inner.call(req);
        Box::pin(future)
    }
}
