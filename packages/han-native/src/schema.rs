//! Core schema definitions for Han's unified data store
//!
//! This module defines the SurrealDB schema for:
//! - Repos (git repositories)
//! - Projects (worktrees/subdirs within repos)
//! - Sessions (Claude Code sessions)
//! - Tasks (metrics tracking)
//! - Hook cache
//! - Marketplace cache

use napi_derive::napi;
use serde::{Deserialize, Serialize};
use surrealdb::engine::local::Db;
use surrealdb::Surreal;

// ============================================================================
// Schema Initialization
// ============================================================================

/// Initialize the core schema tables and indexes
pub async fn init_schema(db: &Surreal<Db>) -> napi::Result<()> {
    db.query(SCHEMA_SQL)
        .await
        .map_err(|e| napi::Error::from_reason(format!("Failed to initialize schema: {}", e)))?;
    Ok(())
}

/// Core schema SQL
const SCHEMA_SQL: &str = r#"
-- ============================================================================
-- Repos (git repositories, identified by remote URL)
-- ============================================================================
DEFINE TABLE IF NOT EXISTS repo SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS remote ON repo TYPE string;
DEFINE FIELD IF NOT EXISTS name ON repo TYPE string;
DEFINE FIELD IF NOT EXISTS default_branch ON repo TYPE option<string>;
DEFINE FIELD IF NOT EXISTS created_at ON repo TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON repo TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_repo_remote ON repo FIELDS remote UNIQUE;

-- ============================================================================
-- Projects (worktrees, subdirs within a repo)
-- ============================================================================
DEFINE TABLE IF NOT EXISTS project SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS repo ON project TYPE option<record<repo>>;
DEFINE FIELD IF NOT EXISTS slug ON project TYPE string;
DEFINE FIELD IF NOT EXISTS path ON project TYPE string;
DEFINE FIELD IF NOT EXISTS relative_path ON project TYPE option<string>;
DEFINE FIELD IF NOT EXISTS name ON project TYPE string;
DEFINE FIELD IF NOT EXISTS is_worktree ON project TYPE bool DEFAULT false;
DEFINE FIELD IF NOT EXISTS created_at ON project TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS updated_at ON project TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_project_slug ON project FIELDS slug UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_project_path ON project FIELDS path;
DEFINE INDEX IF NOT EXISTS idx_project_repo ON project FIELDS repo;

-- ============================================================================
-- Sessions (Claude Code sessions)
-- ============================================================================
DEFINE TABLE IF NOT EXISTS session SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS project ON session TYPE option<record<project>>;
DEFINE FIELD IF NOT EXISTS session_id ON session TYPE string;
DEFINE FIELD IF NOT EXISTS started_at ON session TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS ended_at ON session TYPE option<datetime>;
DEFINE FIELD IF NOT EXISTS status ON session TYPE string DEFAULT 'active';
DEFINE FIELD IF NOT EXISTS transcript_path ON session TYPE option<string>;
DEFINE FIELD IF NOT EXISTS updated_at ON session TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_session_id ON session FIELDS session_id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_session_project ON session FIELDS project;
DEFINE INDEX IF NOT EXISTS idx_session_status ON session FIELDS status;

-- ============================================================================
-- Messages (individual JSONL entries from sessions)
-- ============================================================================
DEFINE TABLE IF NOT EXISTS message SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS session ON message TYPE record<session>;
DEFINE FIELD IF NOT EXISTS message_id ON message TYPE string;
DEFINE FIELD IF NOT EXISTS message_type ON message TYPE string;
DEFINE FIELD IF NOT EXISTS role ON message TYPE option<string>;
DEFINE FIELD IF NOT EXISTS content ON message TYPE option<string>;
DEFINE FIELD IF NOT EXISTS tool_name ON message TYPE option<string>;
DEFINE FIELD IF NOT EXISTS tool_input ON message TYPE option<object>;
DEFINE FIELD IF NOT EXISTS tool_result ON message TYPE option<string>;
DEFINE FIELD IF NOT EXISTS timestamp ON message TYPE datetime;
DEFINE FIELD IF NOT EXISTS line_number ON message TYPE int;
DEFINE FIELD IF NOT EXISTS indexed_at ON message TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_message_id ON message FIELDS message_id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_message_session ON message FIELDS session;
DEFINE INDEX IF NOT EXISTS idx_message_type ON message FIELDS message_type;
DEFINE INDEX IF NOT EXISTS idx_message_timestamp ON message FIELDS timestamp;
-- Full-text search on message content
DEFINE ANALYZER IF NOT EXISTS message_analyzer TOKENIZERS class FILTERS lowercase, snowball(english);
DEFINE INDEX IF NOT EXISTS idx_message_content_fts ON message FIELDS content SEARCH ANALYZER message_analyzer BM25;

-- ============================================================================
-- Tasks (metrics tracking)
-- ============================================================================
DEFINE TABLE IF NOT EXISTS task SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS session ON task TYPE option<record<session>>;
DEFINE FIELD IF NOT EXISTS task_id ON task TYPE string;
DEFINE FIELD IF NOT EXISTS description ON task TYPE string;
DEFINE FIELD IF NOT EXISTS task_type ON task TYPE string;
DEFINE FIELD IF NOT EXISTS outcome ON task TYPE option<string>;
DEFINE FIELD IF NOT EXISTS confidence ON task TYPE option<float>;
DEFINE FIELD IF NOT EXISTS notes ON task TYPE option<string>;
DEFINE FIELD IF NOT EXISTS files_modified ON task TYPE option<array<string>>;
DEFINE FIELD IF NOT EXISTS tests_added ON task TYPE option<int>;
DEFINE FIELD IF NOT EXISTS started_at ON task TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS completed_at ON task TYPE option<datetime>;
DEFINE INDEX IF NOT EXISTS idx_task_id ON task FIELDS task_id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_task_session ON task FIELDS session;
DEFINE INDEX IF NOT EXISTS idx_task_type ON task FIELDS task_type;
DEFINE INDEX IF NOT EXISTS idx_task_outcome ON task FIELDS outcome;

-- ============================================================================
-- Hook Cache (project-scoped caching for hook results)
-- ============================================================================
DEFINE TABLE IF NOT EXISTS hook_cache SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS project ON hook_cache TYPE option<record<project>>;
DEFINE FIELD IF NOT EXISTS cache_key ON hook_cache TYPE string;
DEFINE FIELD IF NOT EXISTS file_hash ON hook_cache TYPE string;
DEFINE FIELD IF NOT EXISTS result ON hook_cache TYPE object;
DEFINE FIELD IF NOT EXISTS cached_at ON hook_cache TYPE datetime DEFAULT time::now();
DEFINE FIELD IF NOT EXISTS expires_at ON hook_cache TYPE option<datetime>;
DEFINE INDEX IF NOT EXISTS idx_hook_cache_key ON hook_cache FIELDS cache_key UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_hook_cache_project ON hook_cache FIELDS project;

-- ============================================================================
-- Marketplace Cache (plugin metadata cache)
-- ============================================================================
DEFINE TABLE IF NOT EXISTS marketplace_plugin SCHEMAFULL;
DEFINE FIELD IF NOT EXISTS plugin_id ON marketplace_plugin TYPE string;
DEFINE FIELD IF NOT EXISTS name ON marketplace_plugin TYPE string;
DEFINE FIELD IF NOT EXISTS description ON marketplace_plugin TYPE option<string>;
DEFINE FIELD IF NOT EXISTS version ON marketplace_plugin TYPE option<string>;
DEFINE FIELD IF NOT EXISTS category ON marketplace_plugin TYPE option<string>;
DEFINE FIELD IF NOT EXISTS metadata ON marketplace_plugin TYPE option<object>;
DEFINE FIELD IF NOT EXISTS fetched_at ON marketplace_plugin TYPE datetime DEFAULT time::now();
DEFINE INDEX IF NOT EXISTS idx_marketplace_plugin_id ON marketplace_plugin FIELDS plugin_id UNIQUE;
DEFINE INDEX IF NOT EXISTS idx_marketplace_category ON marketplace_plugin FIELDS category;
"#;

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
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Session {
    pub id: Option<String>,
    pub project_id: Option<String>,
    pub session_id: String,
    pub started_at: Option<String>,
    pub ended_at: Option<String>,
    pub status: String,
    pub transcript_path: Option<String>,
    pub updated_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct SessionInput {
    pub project_id: Option<String>,
    pub session_id: String,
    pub status: Option<String>,
    pub transcript_path: Option<String>,
}

// ============================================================================
// Data Structures - Messages
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct Message {
    pub id: Option<String>,
    pub session_id: String,
    pub message_id: String,
    pub message_type: String,
    pub role: Option<String>,
    pub content: Option<String>,
    pub tool_name: Option<String>,
    pub tool_input: Option<String>, // JSON string
    pub tool_result: Option<String>,
    pub timestamp: String,
    pub line_number: i32,
    pub indexed_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MessageInput {
    pub session_id: String,
    pub message_id: String,
    pub message_type: String,
    pub role: Option<String>,
    pub content: Option<String>,
    pub tool_name: Option<String>,
    pub tool_input: Option<String>, // JSON string
    pub tool_result: Option<String>,
    pub timestamp: String,
    pub line_number: i32,
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
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookCacheEntry {
    pub id: Option<String>,
    pub project_id: Option<String>,
    pub cache_key: String,
    pub file_hash: String,
    pub result: String, // JSON string
    pub cached_at: Option<String>,
    pub expires_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct HookCacheInput {
    pub project_id: Option<String>,
    pub cache_key: String,
    pub file_hash: String,
    pub result: String, // JSON string
    pub ttl_seconds: Option<i64>,
}

// ============================================================================
// Data Structures - Marketplace
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MarketplacePlugin {
    pub id: Option<String>,
    pub plugin_id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub category: Option<String>,
    pub metadata: Option<String>, // JSON string
    pub fetched_at: Option<String>,
}

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct MarketplacePluginInput {
    pub plugin_id: String,
    pub name: String,
    pub description: Option<String>,
    pub version: Option<String>,
    pub category: Option<String>,
    pub metadata: Option<String>, // JSON string
}

// ============================================================================
// Metrics Query Results
// ============================================================================

#[napi(object)]
#[derive(Clone, Debug, Serialize, Deserialize)]
pub struct TaskMetrics {
    pub total_tasks: i64,
    pub successful_tasks: i64,
    pub partial_tasks: i64,
    pub failed_tasks: i64,
    pub avg_confidence: f64,
    pub tasks_by_type: String, // JSON object
}
