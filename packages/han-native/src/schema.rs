//! Core schema types for Han's unified data store
//!
//! This module defines the data structures for:
//! - Repos (git repositories)
//! - Projects (worktrees/subdirs within repos)
//! - Sessions (Claude Code sessions)
//! - Messages (JSONL entries)
//! - Tasks (metrics tracking)
//! - Hook cache
//! - Session file changes and validations

use napi_derive::napi;
use serde::{Deserialize, Serialize};

// ============================================================================
// Data Structures - Repos
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Repo {
    pub id: Option<String>,
    pub remote: String,
    pub name: String,
    pub default_branch: Option<String>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct RepoInput {
    pub remote: String,
    pub name: String,
    pub default_branch: Option<String>,
}

// ============================================================================
// Data Structures - Projects
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Project {
    pub id: Option<String>,
    pub repo_id: Option<String>,
    pub slug: String,
    pub path: String,
    pub relative_path: Option<String>,
    pub name: String,
    pub is_worktree: bool,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ProjectInput {
    pub repo_id: Option<String>,
    pub slug: String,
    pub path: String,
    pub relative_path: Option<String>,
    pub name: String,
    pub is_worktree: Option<bool>,
}

// ============================================================================
// Data Structures - Sessions
// id IS the session UUID from JSONL - timestamps derived from messages
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: String,  // This IS the session UUID from JSONL
    pub project_id: Option<String>,
    pub status: String,
    pub transcript_path: Option<String>,
    pub last_indexed_line: Option<i32>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionInput {
    pub id: String,  // The session UUID from JSONL filename
    pub project_id: Option<String>,
    pub status: Option<String>,
    pub transcript_path: Option<String>,
}

// ============================================================================
// Data Structures - Session Files
// Tracks JSONL files belonging to sessions (main, agent, han_events)
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionFile {
    pub id: String,
    pub session_id: String,
    pub file_type: String,  // 'main', 'agent', 'han_events'
    pub file_path: String,
    pub agent_id: Option<String>,  // For agent files, the 8-char agent ID
    pub last_indexed_line: Option<i32>,
    pub last_indexed_at: Option<String>,
    pub created_at: Option<String>,
}

// ============================================================================
// Data Structures - Session Summaries (event-sourced)
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionSummary {
    pub id: String,
    pub session_id: String,
    pub message_id: String,
    pub content: Option<String>,
    pub raw_json: Option<String>,
    pub timestamp: String,
    pub line_number: i32,
    pub indexed_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionSummaryInput {
    pub session_id: String,
    pub message_id: String,
    pub content: Option<String>,
    pub raw_json: Option<String>,
    pub timestamp: String,
    pub line_number: i32,
}

// ============================================================================
// Data Structures - Session Compacts (event-sourced)
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionCompact {
    pub id: String,
    pub session_id: String,
    pub message_id: String,
    pub content: Option<String>,
    pub raw_json: Option<String>,
    pub timestamp: String,
    pub line_number: i32,
    pub compact_type: Option<String>,  // 'auto_compact', 'compact', 'continuation'
    pub indexed_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionCompactInput {
    pub session_id: String,
    pub message_id: String,
    pub content: Option<String>,
    pub raw_json: Option<String>,
    pub timestamp: String,
    pub line_number: i32,
    pub compact_type: Option<String>,
}

// ============================================================================
// Data Structures - Session Todos (event-sourced)
// ============================================================================

/// Individual todo item structure
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TodoItem {
    pub content: String,
    pub status: String,  // 'pending', 'in_progress', 'completed'
    pub active_form: String,  // The "...ing" form shown when active
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionTodos {
    pub id: String,
    pub session_id: String,
    pub message_id: String,
    pub todos_json: String,  // JSON array of TodoItem
    pub timestamp: String,
    pub line_number: i32,
    pub indexed_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionTodosInput {
    pub session_id: String,
    pub message_id: String,
    pub todos_json: String,  // JSON array of TodoItem
    pub timestamp: String,
    pub line_number: i32,
}

// ============================================================================
// Data Structures - Messages
// id IS the message UUID from JSONL - no separate message_id
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: String,  // This IS the message UUID from JSONL
    pub session_id: String,
    pub agent_id: Option<String>,  // NULL for main conversation, agent ID for agent messages
    pub parent_id: Option<String>,  // For result messages, references the call message id
    pub message_type: String,
    pub role: Option<String>,
    pub content: Option<String>,
    pub tool_name: Option<String>,
    pub tool_input: Option<String>, // JSON string
    pub tool_result: Option<String>,
    pub raw_json: Option<String>, // Original JSONL line for raw view
    pub timestamp: String,
    pub line_number: i32,
    pub source_file_name: Option<String>,  // Basename of source file
    pub source_file_type: Option<String>,  // Type: 'main', 'agent', 'han_events'
    // Sentiment analysis (computed during indexing for user messages)
    pub sentiment_score: Option<f64>,  // Raw sentiment score (typically -5 to +5)
    pub sentiment_level: Option<String>,  // 'positive', 'neutral', 'negative'
    pub frustration_score: Option<f64>,  // Frustration score (0-10) if detected
    pub frustration_level: Option<String>,  // 'low', 'moderate', 'high' if detected
    pub indexed_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MessageInput {
    pub id: String,  // The message UUID from JSONL
    pub session_id: String,
    pub agent_id: Option<String>,  // NULL for main conversation, agent ID for agent messages
    pub parent_id: Option<String>,  // For result messages, references the call message id
    pub message_type: String,
    pub role: Option<String>,
    pub content: Option<String>,
    pub tool_name: Option<String>,
    pub tool_input: Option<String>, // JSON string
    pub tool_result: Option<String>,
    pub raw_json: Option<String>, // Original JSONL line for raw view
    pub timestamp: String,
    pub line_number: i32,
    pub source_file_name: Option<String>,  // Basename of source file
    pub source_file_type: Option<String>,  // Type: 'main', 'agent', 'han_events'
    // Sentiment analysis (computed by TypeScript during indexing)
    pub sentiment_score: Option<f64>,
    pub sentiment_level: Option<String>,
    pub frustration_score: Option<f64>,
    pub frustration_level: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MessageBatch {
    pub session_id: String,
    pub messages: Vec<MessageInput>,
}

// ============================================================================
// Data Structures - Tasks
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Task {
    pub id: Option<String>,
    pub session_id: Option<String>,
    pub task_id: String,
    pub description: String,
    pub task_type: String,
    pub outcome: Option<String>,
    pub confidence: Option<f64>,
    pub notes: Option<String>,
    pub files_modified: Option<Vec<String>>,
    pub tests_added: Option<i32>,
    pub started_at: Option<String>,
    pub completed_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TaskInput {
    pub session_id: Option<String>,
    pub task_id: String,
    pub description: String,
    pub task_type: String,
    pub estimated_complexity: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TaskCompletion {
    pub task_id: String,
    pub outcome: String,
    pub confidence: f64,
    pub notes: Option<String>,
    pub files_modified: Option<Vec<String>>,
    pub tests_added: Option<i32>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TaskFailure {
    pub task_id: String,
    pub reason: String,
    pub attempted_solutions: Option<Vec<String>>,
    pub confidence: Option<f64>,
    pub notes: Option<String>,
}

// ============================================================================
// Data Structures - Hook Cache
// Similar structure to session_file_validations for consistency
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookCacheEntry {
    pub id: Option<String>,
    pub cache_key: String,     // Composite key: "{pluginName}_{hookName}"
    pub file_hash: String,     // SHA256 hash of manifest content
    pub result: String,        // JSON manifest of file hashes
    pub cached_at: Option<String>,
    pub expires_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookCacheInput {
    pub cache_key: String,     // Composite key: "{pluginName}_{hookName}"
    pub file_hash: String,     // SHA256 hash of manifest content
    pub result: String,        // JSON manifest of file hashes
    pub ttl_seconds: Option<i64>,
}

// ============================================================================
// NOTE: Marketplace structs removed - not used
// ============================================================================

// ============================================================================
// Metrics Query Results
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TaskMetrics {
    pub total_tasks: i64,
    pub completed_tasks: i64,
    pub successful_tasks: i64,
    pub partial_tasks: i64,
    pub failed_tasks: i64,
    pub success_rate: f64,
    pub average_confidence: Option<f64>,
    pub average_duration_seconds: Option<f64>,
    pub calibration_score: Option<f64>,
    pub by_type: Option<String>,    // JSON object
    pub by_outcome: Option<String>, // JSON object
}

// ============================================================================
// Data Structures - Hook Executions
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookExecution {
    pub id: Option<String>,
    pub session_id: Option<String>,
    pub task_id: Option<String>,
    pub hook_type: String,
    pub hook_name: String,
    pub hook_source: Option<String>,
    pub directory: Option<String>,
    pub duration_ms: i64,
    pub exit_code: i32,
    pub passed: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub if_changed: Option<String>,  // JSON array of glob patterns
    pub command: Option<String>,
    pub executed_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookExecutionInput {
    pub session_id: Option<String>,
    pub task_id: Option<String>,
    pub hook_type: String,
    pub hook_name: String,
    pub hook_source: Option<String>,
    pub directory: Option<String>,
    pub duration_ms: i64,
    pub exit_code: i32,
    pub passed: bool,
    pub output: Option<String>,
    pub error: Option<String>,
    pub if_changed: Option<String>,  // JSON array of glob patterns
    pub command: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookStats {
    pub total_executions: i64,
    pub total_passed: i64,
    pub total_failed: i64,
    pub pass_rate: f64,
    pub unique_hooks: i64,
    pub by_hook_type: Option<String>, // JSON object
}

// ============================================================================
// Data Structures - Frustration Events
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FrustrationEvent {
    pub id: Option<String>,
    pub session_id: Option<String>,
    pub task_id: Option<String>,
    pub frustration_level: String, // 'low', 'moderate', 'high'
    pub frustration_score: f64,
    pub user_message: String,
    pub detected_signals: Option<String>, // JSON array
    pub context: Option<String>,
    pub recorded_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FrustrationEventInput {
    pub session_id: Option<String>,
    pub task_id: Option<String>,
    pub frustration_level: String,
    pub frustration_score: f64,
    pub user_message: String,
    pub detected_signals: Option<Vec<String>>,
    pub context: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FrustrationMetrics {
    pub total_frustrations: i64,
    pub significant_frustrations: i64, // moderate + high only
    pub frustration_rate: f64,
    pub significant_frustration_rate: f64,
    pub weighted_score: f64,
    pub by_level: Option<String>, // JSON object { low, moderate, high }
}

// ============================================================================
// NOTE: Checkpoint structs removed - not used
// ============================================================================

// ============================================================================
// Data Structures - Session File Changes
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionFileChange {
    pub id: Option<String>,
    pub session_id: String,
    pub file_path: String,
    pub action: String, // 'created', 'modified', 'deleted'
    pub file_hash_before: Option<String>,
    pub file_hash_after: Option<String>,
    pub tool_name: Option<String>,
    pub recorded_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionFileChangeInput {
    pub session_id: String,
    pub file_path: String,
    pub action: String,
    pub file_hash_before: Option<String>,
    pub file_hash_after: Option<String>,
    pub tool_name: Option<String>,
}

// ============================================================================
// Data Structures - Session File Validations
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionFileValidation {
    pub id: Option<String>,
    pub session_id: String,
    pub file_path: String,
    pub file_hash: String,
    pub plugin_name: String,
    pub hook_name: String,
    pub directory: String,
    pub command_hash: String,
    pub validated_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionFileValidationInput {
    pub session_id: String,
    pub file_path: String,
    pub file_hash: String,
    pub plugin_name: String,
    pub hook_name: String,
    pub directory: String,
    pub command_hash: String,
}
