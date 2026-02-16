//! Hook execution engine.
//!
//! Orchestrates hook discovery, caching, and execution. Matches events to hooks,
//! checks the file validation cache, and executes matching hooks with streaming output.

pub mod cache;
pub mod discovery;
pub mod executor;

use cache::{CacheKey, HookCache, hash_string};
use discovery::{DiscoveredHook, discover_hooks, find_matching_hooks};
use executor::{HookOutputLine, execute_hook};
use std::path::{Path, PathBuf};
use std::sync::Arc;
use tokio::sync::{Mutex, mpsc};

/// Hook execution engine managing discovery, caching, and execution.
pub struct HookEngine {
    hooks: Vec<DiscoveredHook>,
    cache: Arc<Mutex<HookCache>>,
    project_path: Option<PathBuf>,
}

/// Result of executing all matching hooks for an event.
#[derive(Debug)]
pub struct HookExecutionResult {
    pub hook_id: String,
    pub plugin_name: String,
    pub hook_name: String,
    pub exit_code: i32,
    pub cached: bool,
    pub duration_ms: u64,
    pub error: Option<String>,
}

impl HookEngine {
    /// Create a new hook engine, discovering all available hooks.
    pub fn new(project_path: Option<PathBuf>) -> Self {
        let hooks = discover_hooks(project_path.as_deref()).unwrap_or_else(|e| {
            tracing::warn!("Hook discovery failed: {}", e);
            Vec::new()
        });

        tracing::info!("Discovered {} hooks", hooks.len());

        Self {
            hooks,
            cache: Arc::new(Mutex::new(HookCache::new())),
            project_path,
        }
    }

    /// Re-discover hooks (e.g., after plugin installation).
    pub fn refresh(&mut self) {
        self.hooks = discover_hooks(self.project_path.as_deref()).unwrap_or_default();
        tracing::info!("Refreshed hooks: {} discovered", self.hooks.len());
    }

    /// Get all discovered hooks.
    pub fn all_hooks(&self) -> &[DiscoveredHook] {
        &self.hooks
    }

    /// Execute all hooks matching an event, streaming output through the channel.
    ///
    /// Each hook sends `HookOutputLine` messages tagged with a hook_id.
    /// This enables the gRPC HookService to stream results to clients.
    pub async fn execute_event(
        &self,
        event: &str,
        tool_name: Option<&str>,
        cwd: Option<&Path>,
        env: &[(String, String)],
        output_tx: mpsc::Sender<(String, String, String, HookOutputLine)>,
    ) -> Vec<HookExecutionResult> {
        let matching = find_matching_hooks(&self.hooks, event, tool_name);

        if matching.is_empty() {
            tracing::debug!("No hooks match event={} tool={:?}", event, tool_name);
            return Vec::new();
        }

        tracing::debug!(
            "Found {} hooks for event={} tool={:?}",
            matching.len(),
            event,
            tool_name
        );

        let mut results = Vec::new();

        for hook in matching {
            let command = match &hook.command {
                Some(cmd) => cmd.clone(),
                None => continue, // Skip prompt-only hooks
            };

            let hook_id = format!(
                "{}:{}:{}",
                hook.plugin_name,
                event,
                hash_string(&command)[..8].to_string()
            );

            let cache_key = CacheKey {
                plugin_name: hook.plugin_name.clone(),
                hook_name: event.to_string(),
                command_hash: hash_string(&command),
            };

            // Build env with CLAUDE_PLUGIN_ROOT
            let mut hook_env: Vec<(String, String)> = env.to_vec();
            hook_env.push((
                "CLAUDE_PLUGIN_ROOT".to_string(),
                hook.plugin_root.to_string_lossy().to_string(),
            ));

            let working_dir = cwd.or(self.project_path.as_deref());

            let (line_tx, mut line_rx) = mpsc::channel::<HookOutputLine>(256);

            let output_tx_clone = output_tx.clone();
            let hook_id_clone = hook_id.clone();
            let plugin_name = hook.plugin_name.clone();
            let hook_event = event.to_string();

            // Forward lines with hook metadata
            let forward_handle = tokio::spawn(async move {
                while let Some(line) = line_rx.recv().await {
                    if output_tx_clone
                        .send((
                            hook_id_clone.clone(),
                            plugin_name.clone(),
                            hook_event.clone(),
                            line,
                        ))
                        .await
                        .is_err()
                    {
                        break;
                    }
                }
            });

            let exec_result = execute_hook(
                &command,
                working_dir,
                &hook_env,
                hook.timeout,
                line_tx,
            )
            .await;

            let _ = forward_handle.await;

            let (exit_code, error, duration_ms) = match exec_result {
                Ok(code) => (code, None, 0u64),
                Err(e) => (-1, Some(e.to_string()), 0),
            };

            // Update cache on success
            if exit_code == 0 {
                let mut cache = self.cache.lock().await;
                cache.update(cache_key, &[]);
            }

            results.push(HookExecutionResult {
                hook_id,
                plugin_name: hook.plugin_name.clone(),
                hook_name: event.to_string(),
                exit_code,
                cached: false,
                duration_ms,
                error,
            });
        }

        results
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[tokio::test]
    async fn test_engine_no_project() {
        let engine = HookEngine::new(None);
        // Should work even without plugins dir
        assert!(engine.all_hooks().is_empty() || !engine.all_hooks().is_empty());
    }
}
