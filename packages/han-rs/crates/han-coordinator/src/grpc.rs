//! gRPC service implementations for all 6 coordinator services.
//!
//! Each service delegates to the appropriate backing store:
//! - CoordinatorService: runtime state
//! - SessionService: han-db CRUD
//! - IndexerService: han-indexer processor
//! - HookService: hook engine with streaming
//! - SlotService: in-memory HashMap
//! - MemoryService: han-db FTS search

use han_proto::coordinator::*;
use han_proto::coordinator::coordinator_service_server::CoordinatorService as CoordinatorServiceTrait;
use han_proto::coordinator::session_service_server::SessionService as SessionServiceTrait;
use han_proto::coordinator::indexer_service_server::IndexerService as IndexerServiceTrait;
use han_proto::coordinator::hook_service_server::HookService as HookServiceTrait;
use han_proto::coordinator::slot_service_server::SlotService as SlotServiceTrait;
use han_proto::coordinator::memory_service_server::MemoryService as MemoryServiceTrait;

use crate::hooks::executor::HookOutputLine;
use crate::hooks::HookEngine;
use han_db::crud;
use han_db::search::SqliteSearch;
use sea_orm::DatabaseConnection;
use std::collections::HashMap;
use std::sync::Arc;
use std::time::Instant;
use tokio::sync::{Mutex, RwLock, mpsc};
use tokio_stream::wrappers::ReceiverStream;
use tonic::{Request, Response, Status};

// ============================================================================
// Shared state
// ============================================================================

/// Slot information stored in memory.
#[derive(Debug, Clone)]
pub struct SlotEntry {
    owner: String,
    acquired_at: String,
    ttl_seconds: Option<i32>,
}

/// Shared coordinator state passed to all gRPC services.
pub struct CoordinatorState {
    pub db: DatabaseConnection,
    pub start_time: Instant,
    pub hook_engine: Arc<Mutex<HookEngine>>,
    pub slots: Arc<RwLock<HashMap<String, SlotEntry>>>,
}

// ============================================================================
// CoordinatorService
// ============================================================================

pub struct CoordinatorServiceImpl {
    pub state: Arc<CoordinatorState>,
}

#[tonic::async_trait]
impl CoordinatorServiceTrait for CoordinatorServiceImpl {
    async fn health(
        &self,
        _request: Request<Empty>,
    ) -> Result<Response<HealthResponse>, Status> {
        let uptime = self.state.start_time.elapsed().as_millis() as i64;
        Ok(Response::new(HealthResponse {
            healthy: true,
            version: env!("CARGO_PKG_VERSION").to_string(),
            uptime_ms: uptime,
        }))
    }

    async fn shutdown(
        &self,
        request: Request<ShutdownRequest>,
    ) -> Result<Response<Empty>, Status> {
        let req = request.into_inner();
        tracing::info!(
            "Shutdown requested (graceful={}, timeout={}s)",
            req.graceful,
            req.timeout_seconds
        );

        tokio::spawn(async move {
            if req.graceful && req.timeout_seconds > 0 {
                tokio::time::sleep(std::time::Duration::from_secs(
                    req.timeout_seconds as u64,
                ))
                .await;
            }
            std::process::exit(0);
        });

        Ok(Response::new(Empty {}))
    }

    async fn status(
        &self,
        _request: Request<Empty>,
    ) -> Result<Response<StatusResponse>, Status> {
        let uptime = self.state.start_time.elapsed().as_secs();

        let sessions = crud::sessions::list(
            &self.state.db,
            None,
            None,
            None,
            Some(0),
            Some(0),
        )
        .await
        .unwrap_or_default();
        let session_count = sessions.len() as i64;

        Ok(Response::new(StatusResponse {
            version: env!("CARGO_PKG_VERSION").to_string(),
            uptime_seconds: uptime.to_string(),
            db_path: String::new(),
            session_count,
            message_count: 0,
            watcher_active: true,
            watched_paths: Vec::new(),
        }))
    }
}

// ============================================================================
// SessionService
// ============================================================================

pub struct SessionServiceImpl {
    pub state: Arc<CoordinatorState>,
}

fn model_to_session_data(s: &han_db::entities::sessions::Model) -> SessionData {
    SessionData {
        id: s.id.clone(),
        session_id: s.id.clone(),
        project_id: s.project_id.clone(),
        status: s.status.clone(),
        session_file_path: s.transcript_path.clone(),
        session_slug: s.slug.clone(),
        started_at: None,
        ended_at: None,
        last_indexed_line: s.last_indexed_line,
    }
}

#[tonic::async_trait]
impl SessionServiceTrait for SessionServiceImpl {
    async fn get_active(
        &self,
        _request: Request<GetActiveSessionRequest>,
    ) -> Result<Response<SessionResponse>, Status> {
        let sessions = crud::sessions::list(
            &self.state.db,
            None,
            Some("active"),
            None,
            Some(1),
            Some(0),
        )
        .await
        .map_err(|e| Status::internal(e.to_string()))?;

        let session = sessions.first().map(model_to_session_data);
        Ok(Response::new(SessionResponse { session }))
    }

    async fn get(
        &self,
        request: Request<GetSessionRequest>,
    ) -> Result<Response<SessionResponse>, Status> {
        let req = request.into_inner();
        let result = crud::sessions::get(&self.state.db, &req.session_id)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;

        let session = result.as_ref().map(model_to_session_data);
        Ok(Response::new(SessionResponse { session }))
    }

    async fn list(
        &self,
        request: Request<ListSessionsRequest>,
    ) -> Result<Response<ListSessionsResponse>, Status> {
        let req = request.into_inner();
        let sessions = crud::sessions::list(
            &self.state.db,
            req.project_id.as_deref(),
            req.status.as_deref(),
            None,
            Some(req.limit as u64),
            Some(req.offset as u64),
        )
        .await
        .map_err(|e| Status::internal(e.to_string()))?;

        let total = sessions.len() as i32;
        let session_data: Vec<SessionData> = sessions.iter().map(model_to_session_data).collect();

        Ok(Response::new(ListSessionsResponse {
            sessions: session_data,
            total,
        }))
    }
}

// ============================================================================
// IndexerService
// ============================================================================

pub struct IndexerServiceImpl {
    pub state: Arc<CoordinatorState>,
}

#[tonic::async_trait]
impl IndexerServiceTrait for IndexerServiceImpl {
    async fn trigger_scan(
        &self,
        _request: Request<TriggerScanRequest>,
    ) -> Result<Response<ScanResponse>, Status> {
        let results = han_indexer::full_scan_and_index(&self.state.db)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;

        let sessions_indexed = results.len() as i32;
        let messages_indexed: i32 = results.iter().map(|r| r.messages_indexed as i32).sum();
        let errors: Vec<String> = results.iter().filter_map(|r| r.error.clone()).collect();

        Ok(Response::new(ScanResponse {
            sessions_indexed,
            messages_indexed,
            errors,
        }))
    }

    async fn index_file(
        &self,
        request: Request<IndexFileRequest>,
    ) -> Result<Response<IndexFileResponse>, Status> {
        let req = request.into_inner();
        let result = han_indexer::index_session_file(
            &self.state.db,
            &req.file_path,
            req.config_dir.as_deref(),
        )
        .await
        .map_err(|e| Status::internal(e.to_string()))?;

        Ok(Response::new(IndexFileResponse {
            session_id: result.session_id,
            messages_indexed: result.messages_indexed as i32,
            total_messages: result.total_messages as i32,
            is_new_session: result.is_new_session,
            error: result.error,
        }))
    }
}

// ============================================================================
// HookService
// ============================================================================

pub struct HookServiceImpl {
    pub state: Arc<CoordinatorState>,
}

#[tonic::async_trait]
impl HookServiceTrait for HookServiceImpl {
    type ExecuteHooksStream = ReceiverStream<Result<HookOutput, Status>>;

    async fn execute_hooks(
        &self,
        request: Request<ExecuteHooksRequest>,
    ) -> Result<Response<Self::ExecuteHooksStream>, Status> {
        let req = request.into_inner();
        let (grpc_tx, grpc_rx) = mpsc::channel(256);

        let engine = self.state.hook_engine.clone();
        let cwd = req.cwd.map(std::path::PathBuf::from);
        let env: Vec<(String, String)> = req.env.into_iter().collect();

        tokio::spawn(async move {
            let (output_tx, mut output_rx) = mpsc::channel(256);

            let event = req.event.clone();
            let tool_name = req.tool_name.clone();

            // Execute hooks in a separate task to avoid holding the MutexGuard
            // across the output streaming loop.
            let engine_clone = engine.clone();
            let cwd_clone = cwd.clone();
            let env_clone = env.clone();
            let exec_handle = tokio::spawn(async move {
                let engine = engine_clone.lock().await;
                engine
                    .execute_event(
                        &event,
                        tool_name.as_deref(),
                        cwd_clone.as_deref(),
                        &env_clone,
                        output_tx,
                    )
                    .await
            });

            while let Some((hook_id, plugin_name, hook_name, line)) = output_rx.recv().await {
                let output = match line {
                    HookOutputLine::Stdout(text) => HookOutput {
                        hook_id: hook_id.clone(),
                        plugin_name: plugin_name.clone(),
                        hook_name: hook_name.clone(),
                        payload: Some(hook_output::Payload::StdoutLine(text)),
                    },
                    HookOutputLine::Stderr(text) => HookOutput {
                        hook_id: hook_id.clone(),
                        plugin_name: plugin_name.clone(),
                        hook_name: hook_name.clone(),
                        payload: Some(hook_output::Payload::StderrLine(text)),
                    },
                    HookOutputLine::Complete {
                        exit_code,
                        duration_ms,
                    } => HookOutput {
                        hook_id: hook_id.clone(),
                        plugin_name: plugin_name.clone(),
                        hook_name: hook_name.clone(),
                        payload: Some(hook_output::Payload::Complete(HookComplete {
                            exit_code,
                            cached: false,
                            error: None,
                            duration_ms: duration_ms as i64,
                        })),
                    },
                    HookOutputLine::Error(msg) => HookOutput {
                        hook_id: hook_id.clone(),
                        plugin_name: plugin_name.clone(),
                        hook_name: hook_name.clone(),
                        payload: Some(hook_output::Payload::Complete(HookComplete {
                            exit_code: -1,
                            cached: false,
                            error: Some(msg),
                            duration_ms: 0,
                        })),
                    },
                };

                if grpc_tx.send(Ok(output)).await.is_err() {
                    break;
                }
            }

            let _ = exec_handle.await;
        });

        Ok(Response::new(ReceiverStream::new(grpc_rx)))
    }

    async fn list_hooks(
        &self,
        request: Request<ListHooksRequest>,
    ) -> Result<Response<ListHooksResponse>, Status> {
        let req = request.into_inner();
        let engine = self.state.hook_engine.lock().await;

        let hooks: Vec<HookDefinition> = engine
            .all_hooks()
            .iter()
            .filter(|h| {
                req.event_filter
                    .as_ref()
                    .map_or(true, |filter| h.event == *filter)
            })
            .map(|h| HookDefinition {
                plugin_name: h.plugin_name.clone(),
                hook_name: h.event.clone(),
                event: h.event.clone(),
                command: h.command.clone().unwrap_or_default(),
                matcher: h.matcher.clone(),
                timeout_ms: h.timeout.map(|t| t as i32),
            })
            .collect();

        Ok(Response::new(ListHooksResponse { hooks }))
    }
}

// ============================================================================
// SlotService
// ============================================================================

pub struct SlotServiceImpl {
    pub state: Arc<CoordinatorState>,
}

#[tonic::async_trait]
impl SlotServiceTrait for SlotServiceImpl {
    async fn acquire(
        &self,
        request: Request<AcquireSlotRequest>,
    ) -> Result<Response<AcquireSlotResponse>, Status> {
        let req = request.into_inner();
        let mut slots = self.state.slots.write().await;

        if let Some(existing) = slots.get(&req.slot_name) {
            return Ok(Response::new(AcquireSlotResponse {
                acquired: false,
                current_owner: Some(existing.owner.clone()),
            }));
        }

        slots.insert(
            req.slot_name,
            SlotEntry {
                owner: req.owner.clone(),
                acquired_at: chrono::Utc::now().to_rfc3339(),
                ttl_seconds: req.ttl_seconds,
            },
        );

        Ok(Response::new(AcquireSlotResponse {
            acquired: true,
            current_owner: Some(req.owner),
        }))
    }

    async fn release(
        &self,
        request: Request<ReleaseSlotRequest>,
    ) -> Result<Response<Empty>, Status> {
        let req = request.into_inner();
        let mut slots = self.state.slots.write().await;

        match slots.get(&req.slot_name) {
            Some(entry) if entry.owner == req.owner => {
                slots.remove(&req.slot_name);
                Ok(Response::new(Empty {}))
            }
            Some(entry) => Err(Status::permission_denied(format!(
                "Slot owned by '{}', not '{}'",
                entry.owner, req.owner
            ))),
            None => Err(Status::not_found("Slot not found")),
        }
    }

    async fn list(
        &self,
        _request: Request<ListSlotsRequest>,
    ) -> Result<Response<ListSlotsResponse>, Status> {
        let slots = self.state.slots.read().await;

        let slot_infos: Vec<SlotInfo> = slots
            .iter()
            .map(|(name, entry)| SlotInfo {
                slot_name: name.clone(),
                owner: entry.owner.clone(),
                acquired_at: entry.acquired_at.clone(),
                ttl_seconds: entry.ttl_seconds,
            })
            .collect();

        Ok(Response::new(ListSlotsResponse { slots: slot_infos }))
    }
}

// ============================================================================
// MemoryService
// ============================================================================

pub struct MemoryServiceImpl {
    pub state: Arc<CoordinatorState>,
}

#[tonic::async_trait]
impl MemoryServiceTrait for MemoryServiceImpl {
    async fn search(
        &self,
        request: Request<MemorySearchRequest>,
    ) -> Result<Response<MemorySearchResponse>, Status> {
        let req = request.into_inner();
        let limit = if req.limit > 0 { req.limit as u32 } else { 20 };

        let search = SqliteSearch::new(self.state.db.clone());
        let results = search
            .search_messages(&req.query, req.session_id.as_deref(), limit)
            .await
            .map_err(|e| Status::internal(e.to_string()))?;

        let memory_results: Vec<MemoryResult> = results
            .into_iter()
            .map(|r| MemoryResult {
                id: r.id,
                content: r.content,
                score: r.score,
                session_id: Some(r.session_id),
                source: Some(r.message_type),
            })
            .collect();

        Ok(Response::new(MemorySearchResponse {
            results: memory_results,
        }))
    }

    async fn index_document(
        &self,
        _request: Request<IndexDocumentRequest>,
    ) -> Result<Response<Empty>, Status> {
        tracing::info!("IndexDocument called (handled by JSONL indexer pipeline)");
        Ok(Response::new(Empty {}))
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_model_to_session_data() {
        let model = han_db::entities::sessions::Model {
            id: "test-123".to_string(),
            project_id: Some("proj-1".to_string()),
            status: Some("active".to_string()),
            slug: Some("my-session".to_string()),
            transcript_path: Some("/path/to/file.jsonl".to_string()),
            source_config_dir: None,
            last_indexed_line: Some(42),
        };

        let data = model_to_session_data(&model);
        assert_eq!(data.id, "test-123");
        assert_eq!(data.session_id, "test-123");
        assert_eq!(data.project_id, Some("proj-1".to_string()));
        assert_eq!(data.status, Some("active".to_string()));
        assert_eq!(data.session_slug, Some("my-session".to_string()));
        assert_eq!(data.session_file_path, Some("/path/to/file.jsonl".to_string()));
        assert_eq!(data.last_indexed_line, Some(42));
    }
}
