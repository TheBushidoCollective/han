//! Han Team Server - Axum-based GraphQL server with auth, encryption, and billing.

#![allow(dead_code)] // Public API surface not fully wired yet

mod auth;
mod billing;
mod config;
mod crypto;
mod routes;
mod state;
mod sync;

use han_api::build_schema;
use han_api::context::DbChangeEvent;
use han_db::{establish_connection, DbConfig};
use tokio::sync::broadcast;
use tower_http::cors::{Any, CorsLayer};
use tower_http::trace::TraceLayer;
use tracing::{error, info};

#[tokio::main]
async fn main() {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "han_server=info,tower_http=info".into()),
        )
        .json()
        .init();

    // Load .env file if present
    let _ = dotenvy::dotenv();

    // Load configuration
    let config = match config::Config::from_env() {
        Ok(c) => c,
        Err(e) => {
            error!("Configuration error: {e}");
            std::process::exit(1);
        }
    };

    info!(port = config.port, "Starting han-server");

    // Connect to PostgreSQL
    let db_config = DbConfig::Postgres {
        url: config.database_url.clone(),
        max_connections: Some(20),
        min_connections: Some(2),
    };

    let db = match establish_connection(db_config).await {
        Ok(db) => db,
        Err(e) => {
            error!("Database connection failed: {e}");
            std::process::exit(1);
        }
    };

    info!("Connected to PostgreSQL");

    // Run migrations (non-fatal — server can still serve healthcheck)
    match han_db::migration::run_migrations(&db).await {
        Ok(()) => info!("Migrations complete"),
        Err(e) => error!("Migration failed (non-fatal, server will continue): {e}"),
    }

    // Create NOTIFY triggers
    if let Err(e) = sync::pg_notify::create_notify_triggers(&db).await {
        error!("Failed to create notify triggers: {e}");
        // Non-fatal - subscriptions won't work but server can still run
    }

    // Build GraphQL schema
    let (event_sender, _) = broadcast::channel::<DbChangeEvent>(256);
    let schema = build_schema(db.clone(), event_sender.clone());

    // Start PgListener for subscriptions
    if let Err(e) = sync::pg_notify::start_pg_listener(&config.database_url, event_sender.clone()).await {
        error!("PgListener failed to start: {e}");
        // Non-fatal
    }

    // Build CORS layer
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build app state
    let state = state::AppState {
        db,
        config: config.clone(),
        schema,
        event_sender,
    };

    // Build router
    let app = routes::build_router(state)
        .layer(cors)
        .layer(TraceLayer::new_for_http());

    let addr = config.addr();
    info!(%addr, "Server listening");

    let listener = tokio::net::TcpListener::bind(addr).await.unwrap();
    axum::serve(listener, app).await.unwrap();
}
