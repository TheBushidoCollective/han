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
                project_id: None,
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

#[cfg(test)]
mod tests {
    use super::*;

    fn make_payload(event_type: &str, session_id: Option<&str>, table: Option<&str>, id: Option<&str>) -> NotifyPayload {
        NotifyPayload {
            event_type: event_type.to_string(),
            session_id: session_id.map(|s| s.to_string()),
            table: table.map(|s| s.to_string()),
            id: id.map(|s| s.to_string()),
        }
    }

    #[test]
    fn test_map_session_synced() {
        let payload = make_payload("session_synced", Some("sess-123"), None, None);
        let event = map_notify_to_event(&payload);
        assert!(event.is_some());
        match event.unwrap() {
            DbChangeEvent::SessionUpdated { session_id } => {
                assert_eq!(session_id, "sess-123");
            }
            other => panic!("Expected SessionUpdated, got {:?}", other),
        }
    }

    #[test]
    fn test_map_session_synced_missing_session_id() {
        let payload = make_payload("session_synced", None, None, None);
        let event = map_notify_to_event(&payload);
        assert!(event.is_none(), "should return None when session_id is missing");
    }

    #[test]
    fn test_map_session_added() {
        let payload = make_payload("session_added", Some("sess-456"), None, None);
        let event = map_notify_to_event(&payload);
        assert!(event.is_some());
        match event.unwrap() {
            DbChangeEvent::SessionAdded { session_id, parent_id, project_id } => {
                assert_eq!(session_id, "sess-456");
                assert!(parent_id.is_none());
                assert!(project_id.is_none());
            }
            other => panic!("Expected SessionAdded, got {:?}", other),
        }
    }

    #[test]
    fn test_map_session_added_missing_session_id() {
        let payload = make_payload("session_added", None, None, None);
        let event = map_notify_to_event(&payload);
        assert!(event.is_none(), "should return None when session_id is missing");
    }

    #[test]
    fn test_map_message_added() {
        let payload = make_payload("message_added", Some("sess-789"), None, None);
        let event = map_notify_to_event(&payload);
        assert!(event.is_some());
        match event.unwrap() {
            DbChangeEvent::SessionMessageAdded { session_id, message_index } => {
                assert_eq!(session_id, "sess-789");
                assert_eq!(message_index, 0);
            }
            other => panic!("Expected SessionMessageAdded, got {:?}", other),
        }
    }

    #[test]
    fn test_map_message_added_missing_session_id() {
        let payload = make_payload("message_added", None, None, None);
        let event = map_notify_to_event(&payload);
        assert!(event.is_none(), "should return None when session_id is missing");
    }

    #[test]
    fn test_map_node_updated() {
        let payload = make_payload("node_updated", None, Some("users"), Some("user-001"));
        let event = map_notify_to_event(&payload);
        assert!(event.is_some());
        match event.unwrap() {
            DbChangeEvent::NodeUpdated { id, typename } => {
                assert_eq!(id, "user-001");
                assert_eq!(typename, "users");
            }
            other => panic!("Expected NodeUpdated, got {:?}", other),
        }
    }

    #[test]
    fn test_map_node_updated_missing_id() {
        let payload = make_payload("node_updated", None, Some("users"), None);
        let event = map_notify_to_event(&payload);
        assert!(event.is_none(), "should return None when id is missing");
    }

    #[test]
    fn test_map_node_updated_missing_table() {
        let payload = make_payload("node_updated", None, None, Some("user-001"));
        let event = map_notify_to_event(&payload);
        assert!(event.is_none(), "should return None when table is missing");
    }

    #[test]
    fn test_map_unknown_action_returns_none() {
        let payload = make_payload("unknown_action", Some("sess-000"), None, None);
        let event = map_notify_to_event(&payload);
        assert!(event.is_none(), "unknown action should return None");
    }

    #[test]
    fn test_map_empty_event_type_returns_none() {
        let payload = make_payload("", Some("sess-000"), None, None);
        let event = map_notify_to_event(&payload);
        assert!(event.is_none(), "empty event_type should return None");
    }

    #[test]
    fn test_notify_payload_deserialization() {
        let json = r#"{"type": "session_synced", "session_id": "abc-123"}"#;
        let payload: NotifyPayload = serde_json::from_str(json).unwrap();
        assert_eq!(payload.event_type, "session_synced");
        assert_eq!(payload.session_id.as_deref(), Some("abc-123"));
        assert!(payload.table.is_none());
        assert!(payload.id.is_none());
    }

    #[test]
    fn test_notify_payload_deserialization_all_fields() {
        let json = r#"{"type": "node_updated", "session_id": "s1", "table": "teams", "id": "t1"}"#;
        let payload: NotifyPayload = serde_json::from_str(json).unwrap();
        assert_eq!(payload.event_type, "node_updated");
        assert_eq!(payload.session_id.as_deref(), Some("s1"));
        assert_eq!(payload.table.as_deref(), Some("teams"));
        assert_eq!(payload.id.as_deref(), Some("t1"));
    }

    #[test]
    fn test_notify_payload_deserialization_minimal() {
        let json = r#"{"type": "unknown"}"#;
        let payload: NotifyPayload = serde_json::from_str(json).unwrap();
        assert_eq!(payload.event_type, "unknown");
        assert!(payload.session_id.is_none());
        assert!(payload.table.is_none());
        assert!(payload.id.is_none());
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
