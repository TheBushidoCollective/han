//! Shared application state.

use sea_orm::DatabaseConnection;
use tokio::sync::broadcast;

use han_api::context::DbChangeEvent;
use han_api::HanSchema;

use crate::config::Config;

/// Shared application state available to all routes.
#[derive(Clone)]
pub struct AppState {
    /// Database connection pool.
    pub db: DatabaseConnection,
    /// Server configuration.
    pub config: Config,
    /// GraphQL schema.
    pub schema: HanSchema,
    /// Broadcast sender for real-time events.
    pub event_sender: broadcast::Sender<DbChangeEvent>,
}
