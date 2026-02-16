//! PostgreSQL LISTEN/NOTIFY for real-time subscription events.

use sea_orm::DatabaseConnection;
use serde::Deserialize;
use tokio::sync::broadcast;
use tracing::{error, info, warn};

use han_api::context::DbChangeEvent;

/// Notification payload from PostgreSQL.
#[derive(Debug, Deserialize)]
struct NotifyPayload {
    #[serde(rename = "type")]
    event_type: String,
    #[serde(default)]
    session_id: Option<String>,
    #[serde(default)]
    table: Option<String>,
    #[serde(default)]
    id: Option<String>,
}

/// Channel name for PostgreSQL notifications.
const CHANNEL: &str = "han_events";

/// Start listening for PostgreSQL notifications and broadcast them.
///
/// This spawns a background task that maintains a persistent connection
/// to PostgreSQL LISTEN and translates notifications into DbChangeEvents.
pub async fn start_pg_listener(
    database_url: &str,
    sender: broadcast::Sender<DbChangeEvent>,
) -> Result<(), String> {
    use sqlx::postgres::PgListener;

    let mut listener = PgListener::connect(database_url)
        .await
        .map_err(|e| format!("Failed to connect PgListener: {e}"))?;

    listener
        .listen(CHANNEL)
        .await
        .map_err(|e| format!("Failed to LISTEN on {CHANNEL}: {e}"))?;

    info!("PgListener connected, listening on channel '{CHANNEL}'");

    tokio::spawn(async move {
        loop {
            match listener.recv().await {
                Ok(notification) => {
                    let payload = notification.payload();
                    match serde_json::from_str::<NotifyPayload>(payload) {
                        Ok(event) => {
                            if let Some(db_event) = map_notify_to_event(&event) {
                                if sender.send(db_event).is_err() {
                                    // No active subscribers - that's fine
                                }
                            }
                        }
                        Err(e) => {
                            warn!("Failed to parse notification payload: {e}, raw: {payload}");
                        }
                    }
                }
                Err(e) => {
                    error!("PgListener error: {e}");
                    // Connection lost - attempt reconnect after delay
                    tokio::time::sleep(tokio::time::Duration::from_secs(5)).await;
                }
            }
        }
    });

    Ok(())
}

/// Map a PostgreSQL notification to a DbChangeEvent.
fn map_notify_to_event(payload: &NotifyPayload) -> Option<DbChangeEvent> {
    match payload.event_type.as_str() {
        "session_synced" => {
            let session_id = payload.session_id.as_ref()?;
            Some(DbChangeEvent::SessionUpdated {
                session_id: session_id.clone(),
            })
        }
        "session_added" => {
            let session_id = payload.session_id.as_ref()?;
            Some(DbChangeEvent::SessionAdded {
                session_id: session_id.clone(),
                parent_id: None,
            })
        }
        "message_added" => {
            let session_id = payload.session_id.as_ref()?;
            Some(DbChangeEvent::SessionMessageAdded {
                session_id: session_id.clone(),
                message_index: 0,
            })
        }
        "node_updated" => {
            let id = payload.id.as_ref()?;
            let table = payload.table.as_ref()?;
            Some(DbChangeEvent::NodeUpdated {
                id: id.clone(),
                typename: table.clone(),
            })
        }
        _ => None,
    }
}

/// Create PostgreSQL triggers for real-time notifications.
///
/// Run this during server initialization to set up database triggers.
pub async fn create_notify_triggers(db: &DatabaseConnection) -> Result<(), String> {
    use sea_orm::ConnectionTrait;

    let trigger_sql = r#"
        -- Function to send notifications
        CREATE OR REPLACE FUNCTION han_notify_change() RETURNS trigger AS $$
        DECLARE
            payload json;
        BEGIN
            payload = json_build_object(
                'type', TG_ARGV[0],
                'table', TG_TABLE_NAME,
                'id', NEW.id
            );
            PERFORM pg_notify('han_events', payload::text);
            RETURN NEW;
        END;
        $$ LANGUAGE plpgsql;

        -- Trigger on synced_sessions insert/update
        DROP TRIGGER IF EXISTS synced_sessions_notify ON synced_sessions;
        CREATE TRIGGER synced_sessions_notify
            AFTER INSERT OR UPDATE ON synced_sessions
            FOR EACH ROW EXECUTE FUNCTION han_notify_change('session_synced');

        -- Trigger on users insert/update
        DROP TRIGGER IF EXISTS users_notify ON users;
        CREATE TRIGGER users_notify
            AFTER INSERT OR UPDATE ON users
            FOR EACH ROW EXECUTE FUNCTION han_notify_change('node_updated');

        -- Trigger on teams insert/update
        DROP TRIGGER IF EXISTS teams_notify ON teams;
        CREATE TRIGGER teams_notify
            AFTER INSERT OR UPDATE ON teams
            FOR EACH ROW EXECUTE FUNCTION han_notify_change('node_updated');
    "#;

    db.execute(sea_orm::Statement::from_string(
        sea_orm::DatabaseBackend::Postgres,
        trigger_sql.to_string(),
    ))
    .await
    .map_err(|e| format!("Failed to create notify triggers: {e}"))?;

    info!("PostgreSQL LISTEN/NOTIFY triggers created");
    Ok(())
}
