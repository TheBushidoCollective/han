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

#[cfg(test)]
mod tests {
    use super::*;
    use async_graphql::Schema;
    use han_api::mutation::MutationRoot;
    use han_api::query::QueryRoot;
    use han_api::subscription::SubscriptionRoot;

    /// Helper to build a Config struct for testing (no env vars needed).
    fn make_test_config() -> Config {
        Config {
            database_url: String::new(),
            jwt_secret: "x".repeat(32),
            port: 8080,
            github_client_id: String::new(),
            github_client_secret: String::new(),
            public_url: String::new(),
            stripe_secret_key: String::new(),
            stripe_webhook_secret: String::new(),
            master_kek: String::new(),
            stripe_pro_monthly_price_id: String::new(),
            stripe_pro_yearly_price_id: String::new(),
            cors_origins: vec![],
        }
    }

    /// Helper to build a minimal HanSchema without a real DB connection.
    fn make_test_schema() -> HanSchema {
        Schema::build(QueryRoot, MutationRoot, SubscriptionRoot).finish()
    }

    /// Helper to create a disconnected DatabaseConnection for testing struct construction.
    /// This does not connect to any real database.
    fn make_test_db() -> DatabaseConnection {
        DatabaseConnection::Disconnected
    }

    #[test]
    fn test_app_state_construction() {
        let db = make_test_db();
        let config = make_test_config();
        let schema = make_test_schema();
        let (event_sender, _rx) = broadcast::channel::<DbChangeEvent>(16);

        let state = AppState {
            db,
            config,
            schema,
            event_sender,
        };

        assert_eq!(state.config.port, 8080);
        assert_eq!(state.config.jwt_secret, "x".repeat(32));
        assert!(state.config.database_url.is_empty());
        assert!(state.config.cors_origins.is_empty());
    }

    #[test]
    fn test_app_state_clone() {
        let db = make_test_db();
        let config = make_test_config();
        let schema = make_test_schema();
        let (event_sender, _rx) = broadcast::channel::<DbChangeEvent>(16);

        let state = AppState {
            db,
            config,
            schema,
            event_sender,
        };

        let cloned = state.clone();

        // Verify cloned fields match original
        assert_eq!(cloned.config.port, state.config.port);
        assert_eq!(cloned.config.jwt_secret, state.config.jwt_secret);
        assert_eq!(cloned.config.database_url, state.config.database_url);
        assert_eq!(cloned.config.github_client_id, state.config.github_client_id);
        assert_eq!(cloned.config.public_url, state.config.public_url);
        assert_eq!(cloned.config.cors_origins, state.config.cors_origins);
    }

    #[tokio::test]
    async fn test_app_state_event_sender_works() {
        let db = make_test_db();
        let config = make_test_config();
        let schema = make_test_schema();
        let (event_sender, mut rx) = broadcast::channel::<DbChangeEvent>(16);

        let state = AppState {
            db,
            config,
            schema,
            event_sender,
        };

        // Send an event through the state's event_sender
        state
            .event_sender
            .send(DbChangeEvent::SessionUpdated {
                session_id: "test-session-123".to_string(),
            })
            .unwrap();

        // Verify the receiver gets it
        let event = rx.recv().await.unwrap();
        match event {
            DbChangeEvent::SessionUpdated { session_id } => {
                assert_eq!(session_id, "test-session-123");
            }
            _ => panic!("Expected SessionUpdated event"),
        }
    }

    #[tokio::test]
    async fn test_app_state_clone_shares_event_sender() {
        let db = make_test_db();
        let config = make_test_config();
        let schema = make_test_schema();
        let (event_sender, mut rx) = broadcast::channel::<DbChangeEvent>(16);

        let state = AppState {
            db,
            config,
            schema,
            event_sender,
        };

        let cloned = state.clone();

        // Sending via cloned state should be receivable by original receiver
        cloned
            .event_sender
            .send(DbChangeEvent::SessionUpdated {
                session_id: "from-clone".to_string(),
            })
            .unwrap();

        let event = rx.recv().await.unwrap();
        match event {
            DbChangeEvent::SessionUpdated { session_id } => {
                assert_eq!(session_id, "from-clone");
            }
            _ => panic!("Expected SessionUpdated event"),
        }
    }

    #[test]
    fn test_app_state_multiple_clones() {
        let db = make_test_db();
        let config = make_test_config();
        let schema = make_test_schema();
        let (event_sender, _rx) = broadcast::channel::<DbChangeEvent>(16);

        let state = AppState {
            db,
            config,
            schema,
            event_sender,
        };

        // Multiple clones should all be valid
        let clone1 = state.clone();
        let clone2 = state.clone();
        let clone3 = clone1.clone();

        assert_eq!(clone2.config.port, 8080);
        assert_eq!(clone3.config.jwt_secret, "x".repeat(32));
    }
}
