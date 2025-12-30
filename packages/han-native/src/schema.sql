-- Han SQLite Schema
-- All database access MUST go through the coordinator

-- ============================================================================
-- Repos (git repositories, identified by remote URL)
-- ============================================================================
CREATE TABLE IF NOT EXISTS repos (
    id TEXT PRIMARY KEY,
    remote TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    default_branch TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_repos_remote ON repos(remote);

-- ============================================================================
-- Projects (worktrees, subdirs within a repo)
-- ============================================================================
CREATE TABLE IF NOT EXISTS projects (
    id TEXT PRIMARY KEY,
    repo_id TEXT REFERENCES repos(id),
    slug TEXT UNIQUE NOT NULL,
    path TEXT NOT NULL,
    relative_path TEXT,
    name TEXT NOT NULL,
    is_worktree INTEGER DEFAULT 0,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
CREATE INDEX IF NOT EXISTS idx_projects_path ON projects(path);
CREATE INDEX IF NOT EXISTS idx_projects_repo ON projects(repo_id);

-- ============================================================================
-- Sessions (Claude Code sessions)
-- id IS the session UUID from JSONL - no separate session_id column
-- Timestamps are derived from messages, not stored here
-- ============================================================================
CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,  -- This IS the session UUID from JSONL
    project_id TEXT REFERENCES projects(id),
    status TEXT DEFAULT 'active',
    transcript_path TEXT,
    last_indexed_line INTEGER DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_sessions_project ON sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_sessions_status ON sessions(status);

-- ============================================================================
-- Session Files (JSONL files belonging to sessions)
-- Tracks all files that should be indexed for each session:
-- - main: The primary session file (e.g., {uuid}.jsonl)
-- - agent: Agent/subagent files (e.g., agent-{id}.jsonl)
-- - han_events: Han event files (e.g., {uuid}-han.jsonl)
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_files (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    file_type TEXT NOT NULL,  -- 'main', 'agent', 'han_events'
    file_path TEXT NOT NULL UNIQUE,
    agent_id TEXT,  -- For agent files, the 8-char agent ID
    last_indexed_line INTEGER DEFAULT 0,
    last_indexed_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_files_session ON session_files(session_id);
CREATE INDEX IF NOT EXISTS idx_session_files_type ON session_files(file_type);
CREATE INDEX IF NOT EXISTS idx_session_files_path ON session_files(file_path);

-- View to get session timestamps derived from messages
CREATE VIEW IF NOT EXISTS sessions_with_timestamps AS
SELECT
    s.*,
    (SELECT MIN(m.timestamp) FROM messages m WHERE m.session_id = s.id) as started_at,
    (SELECT MAX(m.timestamp) FROM messages m WHERE m.session_id = s.id) as ended_at,
    (SELECT COUNT(*) FROM messages m WHERE m.session_id = s.id) as message_count
FROM sessions s;

-- ============================================================================
-- Messages (individual JSONL entries from sessions)
-- id IS the message UUID from JSONL - no separate message_id column
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,  -- This IS the message UUID from JSONL
    session_id TEXT NOT NULL REFERENCES sessions(id),
    message_type TEXT NOT NULL,
    role TEXT,
    content TEXT,
    tool_name TEXT,
    tool_input TEXT,  -- JSON string
    tool_result TEXT,
    raw_json TEXT,  -- Original JSONL line for raw view
    timestamp TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    indexed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_type ON messages(message_type);
CREATE INDEX IF NOT EXISTS idx_messages_timestamp ON messages(timestamp);
CREATE INDEX IF NOT EXISTS idx_messages_line ON messages(session_id, line_number);

-- FTS5 virtual table for message content search
CREATE VIRTUAL TABLE IF NOT EXISTS messages_fts USING fts5(
    id,
    content,
    content='messages',
    content_rowid='rowid'
);

-- Triggers to keep FTS index in sync
CREATE TRIGGER IF NOT EXISTS messages_ai AFTER INSERT ON messages BEGIN
    INSERT INTO messages_fts(rowid, id, content)
    VALUES (NEW.rowid, NEW.id, NEW.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_ad AFTER DELETE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, id, content)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.content);
END;

CREATE TRIGGER IF NOT EXISTS messages_au AFTER UPDATE ON messages BEGIN
    INSERT INTO messages_fts(messages_fts, rowid, id, content)
    VALUES ('delete', OLD.rowid, OLD.id, OLD.content);
    INSERT INTO messages_fts(rowid, id, content)
    VALUES (NEW.rowid, NEW.id, NEW.content);
END;

-- ============================================================================
-- Tasks (metrics tracking)
-- ============================================================================
CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    task_id TEXT UNIQUE NOT NULL,
    description TEXT NOT NULL,
    task_type TEXT NOT NULL,
    outcome TEXT,
    confidence REAL,
    notes TEXT,
    files_modified TEXT,  -- JSON array
    tests_added INTEGER,
    started_at TEXT NOT NULL DEFAULT (datetime('now')),
    completed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_tasks_task_id ON tasks(task_id);
CREATE INDEX IF NOT EXISTS idx_tasks_session ON tasks(session_id);
CREATE INDEX IF NOT EXISTS idx_tasks_type ON tasks(task_type);
CREATE INDEX IF NOT EXISTS idx_tasks_outcome ON tasks(outcome);
CREATE INDEX IF NOT EXISTS idx_tasks_started ON tasks(started_at);

-- ============================================================================
-- Hook Cache (project-scoped caching for hook results)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hook_cache (
    id TEXT PRIMARY KEY,
    project_id TEXT REFERENCES projects(id),
    cache_key TEXT UNIQUE NOT NULL,
    file_hash TEXT NOT NULL,
    result TEXT NOT NULL,  -- JSON
    cached_at TEXT NOT NULL DEFAULT (datetime('now')),
    expires_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_hook_cache_key ON hook_cache(cache_key);
CREATE INDEX IF NOT EXISTS idx_hook_cache_project ON hook_cache(project_id);
CREATE INDEX IF NOT EXISTS idx_hook_cache_expires ON hook_cache(expires_at);

-- ============================================================================
-- Marketplace Cache (plugin metadata cache)
-- ============================================================================
CREATE TABLE IF NOT EXISTS marketplace_plugins (
    id TEXT PRIMARY KEY,
    plugin_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    description TEXT,
    version TEXT,
    category TEXT,
    metadata TEXT,  -- JSON
    fetched_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_marketplace_plugin_id ON marketplace_plugins(plugin_id);
CREATE INDEX IF NOT EXISTS idx_marketplace_category ON marketplace_plugins(category);

-- ============================================================================
-- Han Events are stored in the messages table with message_type = 'han_event'
-- This keeps everything in one table with consistent line numbering.
--
-- For han_event messages:
-- - message_type: 'han_event'
-- - role: NULL
-- - content: JSON string with event data (type, data fields)
-- - tool_name: event subtype (hook_start, mcp_tool_call, etc.)
-- ============================================================================

-- ============================================================================
-- Hook Executions (track every hook run for metrics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS hook_executions (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    task_id TEXT,
    hook_type TEXT NOT NULL,
    hook_name TEXT NOT NULL,
    hook_source TEXT,
    duration_ms INTEGER NOT NULL,
    exit_code INTEGER NOT NULL,
    passed INTEGER NOT NULL DEFAULT 1,
    output TEXT,
    error TEXT,
    executed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_hook_executions_session ON hook_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_hook_executions_task ON hook_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_hook_executions_name ON hook_executions(hook_name);
CREATE INDEX IF NOT EXISTS idx_hook_executions_executed ON hook_executions(executed_at);

-- ============================================================================
-- Frustration Events (user frustration tracking for metrics)
-- ============================================================================
CREATE TABLE IF NOT EXISTS frustration_events (
    id TEXT PRIMARY KEY,
    session_id TEXT REFERENCES sessions(id),
    task_id TEXT,
    frustration_level TEXT NOT NULL,  -- 'low', 'moderate', 'high'
    frustration_score REAL NOT NULL,
    user_message TEXT NOT NULL,
    detected_signals TEXT,  -- JSON array
    context TEXT,
    recorded_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_frustration_session ON frustration_events(session_id);
CREATE INDEX IF NOT EXISTS idx_frustration_task ON frustration_events(task_id);
CREATE INDEX IF NOT EXISTS idx_frustration_level ON frustration_events(frustration_level);
CREATE INDEX IF NOT EXISTS idx_frustration_recorded ON frustration_events(recorded_at);

-- ============================================================================
-- Checkpoints (file state capture for session recovery)
-- ============================================================================
CREATE TABLE IF NOT EXISTS checkpoints (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    project_path TEXT NOT NULL,
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,
    blob_path TEXT NOT NULL,  -- Path to actual file content blob
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(session_id, project_path, file_path)
);

CREATE INDEX IF NOT EXISTS idx_checkpoints_session ON checkpoints(session_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_project ON checkpoints(project_path);
CREATE INDEX IF NOT EXISTS idx_checkpoints_hash ON checkpoints(file_hash);

-- ============================================================================
-- Session File Changes (track files modified during session)
-- Used to determine if hooks need to re-run
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_file_changes (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    file_path TEXT NOT NULL,
    action TEXT NOT NULL,  -- 'created', 'modified', 'deleted'
    file_hash_before TEXT,
    file_hash_after TEXT,
    tool_name TEXT,  -- Which tool made the change (Edit, Write, Bash)
    recorded_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(session_id, file_path, recorded_at)
);

CREATE INDEX IF NOT EXISTS idx_file_changes_session ON session_file_changes(session_id);
CREATE INDEX IF NOT EXISTS idx_file_changes_path ON session_file_changes(file_path);
CREATE INDEX IF NOT EXISTS idx_file_changes_action ON session_file_changes(action);

-- ============================================================================
-- Vector embeddings (for semantic search)
-- Note: sqlite-vec tables are created dynamically with appropriate dimensions
-- ============================================================================
