//! Bridge between file watcher events and GraphQL subscriptions.
//!
//! Monitors JSONL file changes via `han-indexer::WatcherService`, indexes new
//! content via the processor, and emits `DbChangeEvent`s for GraphQL subscriptions.

use han_api::context::DbChangeEvent;
use han_indexer::{WatcherService, handle_file_event};
use sea_orm::DatabaseConnection;
use std::sync::Arc;
use tokio::sync::broadcast;

/// Start the watcher bridge in a background task.
///
/// Returns a handle that can be used to abort the bridge.
pub fn start_watcher_bridge(
    db: DatabaseConnection,
    event_tx: broadcast::Sender<DbChangeEvent>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        let watcher = match WatcherService::new(None) {
            Ok(w) => w,
            Err(e) => {
                tracing::error!("Failed to start file watcher: {}", e);
                return;
            }
        };

        tracing::info!(
            "Watcher bridge started, watching: {:?}",
            watcher.watched_paths()
        );

        run_watcher_loop(watcher, db, event_tx).await;
    })
}

/// Run the main watcher loop: receive file events, index, emit subscription events.
async fn run_watcher_loop(
    mut watcher: WatcherService,
    db: DatabaseConnection,
    event_tx: broadcast::Sender<DbChangeEvent>,
) {
    while let Some(file_event) = watcher.next_event().await {
        tracing::debug!(
            "File event: {:?} {}",
            file_event.event_type,
            file_event.path
        );

        let result = handle_file_event(
            &db,
            file_event.event_type.clone(),
            &file_event.path,
            file_event.session_id.clone(),
        )
        .await;

        match result {
            Ok(Some(index_result)) => {
                tracing::debug!(
                    "Indexed {} messages for session {}",
                    index_result.messages_indexed,
                    index_result.session_id
                );

                // Emit subscription events
                if index_result.is_new_session {
                    let _ = event_tx.send(DbChangeEvent::SessionAdded {
                        session_id: index_result.session_id.clone(),
                        parent_id: None,
                    });
                }

                if index_result.messages_indexed > 0 {
                    let _ = event_tx.send(DbChangeEvent::SessionMessageAdded {
                        session_id: index_result.session_id.clone(),
                        message_index: index_result.total_messages as i32,
                    });

                    let _ = event_tx.send(DbChangeEvent::NodeUpdated {
                        id: format!("Session:{}", index_result.session_id),
                        typename: "SessionData".to_string(),
                    });
                }
            }
            Ok(None) => {}
            Err(e) => {
                tracing::warn!("Error handling file event: {}", e);
            }
        }
    }

    tracing::info!("Watcher bridge stopped");
}
