//! Bridge between file watcher events and GraphQL subscriptions.
//!
//! Monitors JSONL file changes via `han-indexer::WatcherService`, indexes new
//! content via the processor, and emits `DbChangeEvent`s for GraphQL subscriptions.

use han_api::context::DbChangeEvent;
use han_db::entities::{projects, sessions};
use han_indexer::{WatcherService, handle_file_event};
use sea_orm::{ColumnTrait, DatabaseConnection, EntityTrait, QueryFilter};
use tokio::sync::broadcast;

/// Start the watcher bridge in a background task.
///
/// Watches `~/.claude/projects` by default plus any additional config
/// directories registered in the database (e.g. `~/.claude-work/projects`).
///
/// Returns a handle that can be used to abort the bridge.
pub fn start_watcher_bridge(
    db: DatabaseConnection,
    event_tx: broadcast::Sender<DbChangeEvent>,
) -> tokio::task::JoinHandle<()> {
    tokio::spawn(async move {
        // Query registered config directories from the database so we can
        // watch all of them, not just the default ~/.claude/projects.
        let extra_config_dirs: Vec<String> = match han_db::crud::config_dirs::list(&db).await {
            Ok(dirs) => dirs.into_iter().map(|d| d.path).collect(),
            Err(e) => {
                tracing::warn!("Failed to query config dirs: {}", e);
                vec![]
            }
        };

        // WatcherService::new is synchronous and may block while setting up
        // OS-level file watchers. Use spawn_blocking to avoid stalling the
        // tokio runtime.
        let watcher = match tokio::task::spawn_blocking(|| {
            WatcherService::new(None)
        }).await {
            Ok(Ok(w)) => {
                tracing::info!(
                    "Watcher bridge started, watching: {:?}",
                    w.watched_paths()
                );
                w
            }
            Ok(Err(e)) => {
                tracing::error!("Failed to start file watcher: {}", e);
                return;
            }
            Err(e) => {
                tracing::error!("Watcher initialization task panicked: {}", e);
                return;
            }
        };

        // Add watch paths for additional config directories
        add_extra_watch_paths(watcher, extra_config_dirs, db, event_tx).await;
    })
}

/// Register additional config directory watch paths, then start the watcher loop.
async fn add_extra_watch_paths(
    mut watcher: WatcherService,
    extra_config_dirs: Vec<String>,
    db: DatabaseConnection,
    event_tx: broadcast::Sender<DbChangeEvent>,
) {
    let default_claude = dirs::home_dir()
        .map(|h| h.join(".claude").to_string_lossy().to_string())
        .unwrap_or_default();

    for config_dir in &extra_config_dirs {
        // Skip the default — WatcherService::new already watches it
        if config_dir == &default_claude {
            continue;
        }
        let projects_path = std::path::PathBuf::from(config_dir).join("projects");
        if !projects_path.exists() {
            continue;
        }
        match watcher.add_watch_path(config_dir, Some(&projects_path)) {
            Ok(true) => {
                tracing::info!("Added watch path: {:?}", projects_path);
            }
            Ok(false) => {} // already watched
            Err(e) => {
                tracing::warn!("Failed to watch {}: {}", projects_path.display(), e);
            }
        }
    }

    tracing::info!("Watching {} paths total: {:?}", watcher.watched_paths().len(), watcher.watched_paths());
    run_watcher_loop(watcher, db, event_tx).await;
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
                tracing::info!(
                    "Indexed {} messages for session {}",
                    index_result.messages_indexed,
                    index_result.session_id
                );

                // Look up project_dir for correct global ID format.
                // Session global IDs are Session:{project_dir}:{session_id}.
                let (project_dir, project_id) = lookup_session_project(&db, &index_result.session_id).await;

                let global_id = if project_dir.is_empty() {
                    format!("Session:{}", index_result.session_id)
                } else {
                    format!("Session:{}:{}", project_dir, index_result.session_id)
                };

                // Emit subscription events
                if index_result.is_new_session {
                    let _ = event_tx.send(DbChangeEvent::SessionAdded {
                        session_id: index_result.session_id.clone(),
                        parent_id: None,
                        project_id: project_id.clone(),
                    });
                }

                if index_result.messages_indexed > 0 {
                    let _ = event_tx.send(DbChangeEvent::SessionMessageAdded {
                        session_id: index_result.session_id.clone(),
                        message_index: index_result.total_messages as i32,
                    });

                    let _ = event_tx.send(DbChangeEvent::NodeUpdated {
                        id: global_id,
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

/// Look up the project_dir and project_id for a session from the database.
/// Returns (project_dir, project_id). Both may be empty/None if not found.
async fn lookup_session_project(db: &DatabaseConnection, session_id: &str) -> (String, Option<String>) {
    let session = match sessions::Entity::find_by_id(session_id).one(db).await {
        Ok(Some(s)) => s,
        _ => return (String::new(), None),
    };

    let project_id = session.project_id.clone();
    let project_dir = if let Some(ref pid) = session.project_id {
        match projects::Entity::find()
            .filter(projects::Column::Id.eq(pid.as_str()))
            .one(db)
            .await
        {
            Ok(Some(p)) => p.path,
            _ => String::new(),
        }
    } else {
        String::new()
    };

    (project_dir, project_id)
}

#[cfg(test)]
mod tests {
    use super::*;

    /// Verify that the module compiles and key types are accessible.
    /// The watcher bridge is heavily async and depends on real file system
    /// watching, so we verify the public API surface compiles correctly.
    #[test]
    fn test_start_watcher_bridge_compiles() {
        // Verify the function signature is correct by referencing it
        let _fn_ptr: fn(
            DatabaseConnection,
            broadcast::Sender<DbChangeEvent>,
        ) -> tokio::task::JoinHandle<()> = start_watcher_bridge;
    }

    #[test]
    fn test_db_change_event_variants() {
        // Verify that the DbChangeEvent types used by the bridge are constructable
        let event = DbChangeEvent::SessionAdded {
            session_id: "test-session".to_string(),
            parent_id: None,
            project_id: Some("proj-1".to_string()),
        };
        match &event {
            DbChangeEvent::SessionAdded { session_id, parent_id, project_id } => {
                assert_eq!(session_id, "test-session");
                assert!(parent_id.is_none());
                assert_eq!(project_id, &Some("proj-1".to_string()));
            }
            _ => panic!("Expected SessionAdded variant"),
        }

        let event = DbChangeEvent::SessionMessageAdded {
            session_id: "test-session".to_string(),
            message_index: 42,
        };
        match &event {
            DbChangeEvent::SessionMessageAdded { session_id, message_index } => {
                assert_eq!(session_id, "test-session");
                assert_eq!(*message_index, 42);
            }
            _ => panic!("Expected SessionMessageAdded variant"),
        }

        let event = DbChangeEvent::NodeUpdated {
            id: "Session:abc".to_string(),
            typename: "SessionData".to_string(),
        };
        match &event {
            DbChangeEvent::NodeUpdated { id, typename } => {
                assert_eq!(id, "Session:abc");
                assert_eq!(typename, "SessionData");
            }
            _ => panic!("Expected NodeUpdated variant"),
        }
    }
}
