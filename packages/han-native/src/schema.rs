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
    pub source_config_dir: Option<String>, // Which CLAUDE_CONFIG_DIR this project was discovered from
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
    pub source_config_dir: Option<String>,
}

// ============================================================================
// Data Structures - Sessions
// id IS the session UUID from JSONL - timestamps derived from messages
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: String, // This IS the session UUID from JSONL
    pub project_id: Option<String>,
    pub status: String,
    pub transcript_path: Option<String>,
    pub slug: Option<String>, // Human-readable session name (e.g., "snug-dreaming-knuth")
    pub source_config_dir: Option<String>, // Which CLAUDE_CONFIG_DIR this session originated from
    pub last_indexed_line: Option<i32>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionInput {
    pub id: String, // The session UUID from JSONL filename
    pub project_id: Option<String>,
    pub status: Option<String>,
    pub transcript_path: Option<String>,
    pub slug: Option<String>, // Human-readable session name (e.g., "snug-dreaming-knuth")
    pub source_config_dir: Option<String>,
}

// ============================================================================
// Data Structures - Session Files
// Tracks JSONL files belonging to sessions (main, agent, han_events)
// ============================================================================

#[allow(dead_code)] // Reserved for future session file tracking API
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionFile {
    pub id: String,
    pub session_id: String,
    pub file_type: String, // 'main', 'agent', 'han_events'
    pub file_path: String,
    pub agent_id: Option<String>, // For agent files, the 8-char agent ID
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
    pub compact_type: Option<String>, // 'auto_compact', 'compact', 'continuation'
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
    pub status: String,      // 'pending', 'in_progress', 'completed'
    pub active_form: String, // The "...ing" form shown when active
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionTodos {
    pub id: String,
    pub session_id: String,
    pub message_id: String,
    pub todos_json: String, // JSON array of TodoItem
    pub timestamp: String,
    pub line_number: i32,
    pub indexed_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionTodosInput {
    pub session_id: String,
    pub message_id: String,
    pub todos_json: String, // JSON array of TodoItem
    pub timestamp: String,
    pub line_number: i32,
}

// ============================================================================
// Data Structures - Native Tasks (Claude Code's built-in task system)
// ============================================================================

/// A native task from Claude Code's TaskCreate/TaskUpdate tools
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NativeTask {
    pub id: String, // Claude's task ID (e.g., "1", "2") scoped to session
    pub session_id: String,
    pub message_id: String,
    pub subject: String, // Brief task title
    pub description: Option<String>,
    pub status: String,              // pending, in_progress, completed
    pub active_form: Option<String>, // Present continuous form
    pub owner: Option<String>,
    pub blocks: Option<String>,     // JSON array of task IDs
    pub blocked_by: Option<String>, // JSON array of task IDs
    pub created_at: String,
    pub updated_at: String,
    pub completed_at: Option<String>,
    pub line_number: i32,
}

/// Input for creating a native task (from TaskCreate tool call)
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NativeTaskInput {
    pub id: String, // Task ID from Claude (e.g., "1")
    pub session_id: String,
    pub message_id: String,
    pub subject: String,
    pub description: Option<String>,
    pub active_form: Option<String>,
    pub timestamp: String,
    pub line_number: i32,
}

/// Input for updating a native task (from TaskUpdate tool call)
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct NativeTaskUpdate {
    pub id: String, // Task ID to update
    pub session_id: String,
    pub message_id: String,
    pub status: Option<String>,
    pub subject: Option<String>,
    pub description: Option<String>,
    pub active_form: Option<String>,
    pub owner: Option<String>,
    pub add_blocks: Option<Vec<String>>,
    pub add_blocked_by: Option<Vec<String>>,
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
    pub id: String, // This IS the message UUID from JSONL
    pub session_id: String,
    pub agent_id: Option<String>, // NULL for main conversation, agent ID for agent messages
    pub parent_id: Option<String>, // For result messages, references the call message id
    pub message_type: String,
    pub role: Option<String>,
    pub content: Option<String>,
    pub tool_name: Option<String>,
    pub tool_input: Option<String>, // JSON string
    pub tool_result: Option<String>,
    pub raw_json: Option<String>, // Original JSONL line for raw view
    pub timestamp: String,
    pub line_number: i32,
    pub source_file_name: Option<String>, // Basename of source file
    pub source_file_type: Option<String>, // Type: 'main', 'agent', 'han_events'
    // Sentiment analysis (computed during indexing for user messages)
    pub sentiment_score: Option<f64>, // Raw sentiment score (typically -5 to +5)
    pub sentiment_level: Option<String>, // 'positive', 'neutral', 'negative'
    pub frustration_score: Option<f64>, // Frustration score (0-10) if detected
    pub frustration_level: Option<String>, // 'low', 'moderate', 'high' if detected
    pub indexed_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MessageInput {
    pub id: String, // The message UUID from JSONL
    pub session_id: String,
    pub agent_id: Option<String>, // NULL for main conversation, agent ID for agent messages
    pub parent_id: Option<String>, // For result messages, references the call message id
    pub message_type: String,
    pub role: Option<String>,
    pub content: Option<String>,
    pub tool_name: Option<String>,
    pub tool_input: Option<String>, // JSON string
    pub tool_result: Option<String>,
    pub raw_json: Option<String>, // Original JSONL line for raw view
    pub timestamp: String,
    pub line_number: i32,
    pub source_file_name: Option<String>, // Basename of source file
    pub source_file_type: Option<String>, // Type: 'main', 'agent', 'han_events'
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
// NOTE: HookCache structs removed - replaced by session_file_validations
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
// Data Structures - Orchestrations (group hook executions by orchestrate run)
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Orchestration {
    pub id: String,
    pub session_id: Option<String>, // Optional link to Claude session
    pub hook_type: String,          // 'Stop', 'SessionStart', etc.
    pub project_root: String,
    pub status: String, // 'running', 'completed', 'failed'
    pub total_hooks: i32,
    pub completed_hooks: i32,
    pub failed_hooks: i32,
    pub deferred_hooks: i32,
    pub created_at: Option<String>,
    pub completed_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OrchestrationInput {
    pub session_id: Option<String>, // Optional link to Claude session
    pub hook_type: String,          // 'Stop', 'SessionStart', etc.
    pub project_root: String,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct OrchestrationUpdate {
    pub id: String,
    pub status: Option<String>,
    pub total_hooks: Option<i32>,
    pub completed_hooks: Option<i32>,
    pub failed_hooks: Option<i32>,
    pub deferred_hooks: Option<i32>,
}

// ============================================================================
// Data Structures - Hook Executions
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookExecution {
    pub id: Option<String>,
    pub orchestration_id: Option<String>, // Links to orchestration run
    pub session_id: Option<String>,       // Optional: for backwards compat
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
    pub if_changed: Option<String>, // JSON array of glob patterns
    pub command: Option<String>,
    pub executed_at: Option<String>,
    // Deferred execution fields
    pub status: Option<String>, // 'pending', 'running', 'completed', 'failed'
    pub consecutive_failures: Option<i32>,
    pub max_attempts: Option<i32>,
    pub pid: Option<i32>,            // Process ID for stale hook detection
    pub plugin_root: Option<String>, // Plugin root path for CLAUDE_PLUGIN_ROOT
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
    pub if_changed: Option<String>, // JSON array of glob patterns
    pub command: Option<String>,
}

// ============================================================================
// Data Structures - Hook Attempt Tracking
// ============================================================================

/// Information about hook attempt status for deferred execution
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookAttemptInfo {
    pub consecutive_failures: i32,
    pub max_attempts: i32,
    pub is_stuck: bool, // consecutive_failures >= max_attempts
}

/// Input for queuing a pending hook
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct PendingHookInput {
    pub orchestration_id: String,   // Links to orchestration run
    pub session_id: Option<String>, // Optional: for backwards compat
    pub hook_type: String,
    pub hook_name: String,
    pub plugin: String,
    pub directory: String,
    pub command: String,
    pub if_changed: Option<String>,  // JSON array of glob patterns
    pub pid: Option<i32>,            // Process ID for stale hook detection
    pub plugin_root: Option<String>, // Plugin root path for CLAUDE_PLUGIN_ROOT
}

/// Input for queueing a hook in pending_hooks table (for --check mode)
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QueuedHookInput {
    pub orchestration_id: String,
    pub plugin: String,
    pub hook_name: String,
    pub directory: String,
    pub if_changed: Option<String>, // JSON array of glob patterns
    pub command: String,
}

/// Queued hook record from pending_hooks table
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct QueuedHook {
    pub id: String,
    pub orchestration_id: String,
    pub plugin: String,
    pub hook_name: String,
    pub directory: String,
    pub if_changed: Option<String>,
    pub command: String,
    pub queued_at: String,
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

/// Represents a file that this session modified, along with its validation status.
/// Used for determining which files need validation with stale detection.
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct FileValidationStatus {
    /// The file path
    pub file_path: String,
    /// Hash after this session's modification (from session_file_changes)
    pub modification_hash: String,
    /// Hash after last validation by this hook (from session_file_validations), if any
    pub validation_hash: Option<String>,
    /// Command hash used in last validation, if any
    pub validation_command_hash: Option<String>,
}

// ============================================================================
// Data Structures - Generated Session Summaries (LLM-analyzed)
// ============================================================================

/// A generated session summary (created by Han using Haiku for semantic analysis)
/// Unlike SessionSummary (Claude's native context compression), these contain
/// extracted topics, files, tools, and outcome assessment.
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneratedSessionSummary {
    pub id: String,
    pub session_id: String,
    pub summary_text: String, // 2-3 sentence summary
    pub topics: Vec<String>,  // Parsed from JSON array
    pub files_modified: Option<Vec<String>>,
    pub tools_used: Option<Vec<String>>,
    pub outcome: Option<String>, // 'completed', 'partial', 'abandoned'
    pub message_count: Option<i32>,
    pub duration_seconds: Option<i32>,
    pub created_at: Option<String>,
    pub updated_at: Option<String>,
}

/// Input for creating/updating a generated session summary
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct GeneratedSessionSummaryInput {
    pub session_id: String,
    pub summary_text: String,
    pub topics: Vec<String>,
    pub files_modified: Option<Vec<String>>,
    pub tools_used: Option<Vec<String>>,
    pub outcome: Option<String>,
    pub message_count: Option<i32>,
    pub duration_seconds: Option<i32>,
}

// ============================================================================
// ============================================================================
// Data Structures - Config Dirs Registry (Multi-Environment Support)
// ============================================================================

/// A registered config directory for multi-environment support
/// The central coordinator tracks all CLAUDE_CONFIG_DIR locations to index
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConfigDir {
    pub id: String,
    pub path: String,         // Absolute path (e.g., ~/.claude, /work/.claude)
    pub name: Option<String>, // Human-friendly name (e.g., "Work", "Personal")
    pub registered_at: String,
    pub last_indexed_at: Option<String>, // Last time we scanned this config dir
    pub session_count: Option<i32>,      // Cached count of sessions from this config dir
    pub is_default: bool,                // Whether this is the default ~/.claude location
}

/// Input for registering a new config directory
#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct ConfigDirInput {
    pub path: String,
    pub name: Option<String>,
    pub is_default: Option<bool>,
}
