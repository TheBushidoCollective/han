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
-- Session Summaries (event-sourced: latest summary for each session)
-- Populated during indexing when summary messages are encountered
-- Only includes regular summaries (not auto-compact/compact)
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_summaries (
    id TEXT PRIMARY KEY,  -- Same as message ID
    session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id),  -- One summary per session
    message_id TEXT NOT NULL,  -- Reference to the source message
    content TEXT,
    raw_json TEXT,
    timestamp TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    indexed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_summaries_session ON session_summaries(session_id);
CREATE INDEX IF NOT EXISTS idx_session_summaries_timestamp ON session_summaries(timestamp);

-- ============================================================================
-- Session Compacts (event-sourced: latest compact/continuation for each session)
-- Populated during indexing when auto-compact summaries or continuation messages
-- are encountered
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_compacts (
    id TEXT PRIMARY KEY,  -- Same as message ID
    session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id),  -- One compact per session
    message_id TEXT NOT NULL,  -- Reference to the source message
    content TEXT,
    raw_json TEXT,
    timestamp TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    compact_type TEXT,  -- 'auto_compact', 'compact', 'continuation'
    indexed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_compacts_session ON session_compacts(session_id);
CREATE INDEX IF NOT EXISTS idx_session_compacts_timestamp ON session_compacts(timestamp);

-- ============================================================================
-- Messages (individual JSONL entries from sessions)
-- id IS the message UUID from JSONL - no separate message_id column
-- ============================================================================
CREATE TABLE IF NOT EXISTS messages (
    id TEXT PRIMARY KEY,  -- This IS the message UUID from JSONL
    session_id TEXT NOT NULL REFERENCES sessions(id),
    agent_id TEXT,  -- NULL for main conversation, agent ID for agent messages
    parent_id TEXT,  -- For result messages, references the call message id
    message_type TEXT NOT NULL,
    role TEXT,
    content TEXT,
    tool_name TEXT,
    tool_input TEXT,  -- JSON string
    tool_result TEXT,
    raw_json TEXT,  -- Original JSONL line for raw view
    timestamp TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    source_file_name TEXT,  -- Basename of source file (e.g., "abc123.jsonl", "agent-12345678.jsonl")
    source_file_type TEXT,  -- Type: 'main', 'agent', 'han_events'
    -- Sentiment analysis (computed during indexing for user messages)
    sentiment_score REAL,  -- Raw sentiment score (typically -5 to +5)
    sentiment_level TEXT,  -- 'positive', 'neutral', 'negative'
    frustration_score REAL,  -- Frustration score (0-10) if detected
    frustration_level TEXT,  -- 'low', 'moderate', 'high' if detected
    indexed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_session ON messages(session_id);
CREATE INDEX IF NOT EXISTS idx_messages_agent ON messages(session_id, agent_id);
CREATE INDEX IF NOT EXISTS idx_messages_parent ON messages(parent_id);
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
-- NOTE: hook_cache table removed - replaced by session_file_validations
-- NOTE: marketplace_plugins table removed - not used
-- ============================================================================

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
    directory TEXT,
    duration_ms INTEGER NOT NULL,
    exit_code INTEGER NOT NULL,
    passed INTEGER NOT NULL DEFAULT 1,
    output TEXT,
    error TEXT,
    if_changed TEXT,  -- JSON array of glob patterns
    command TEXT,     -- The command that was executed
    executed_at TEXT NOT NULL DEFAULT (datetime('now')),
    -- Deferred execution fields
    status TEXT DEFAULT 'completed',  -- 'pending', 'running', 'completed', 'failed'
    consecutive_failures INTEGER DEFAULT 0,
    max_attempts INTEGER DEFAULT 3
);

CREATE INDEX IF NOT EXISTS idx_hook_executions_session ON hook_executions(session_id);
CREATE INDEX IF NOT EXISTS idx_hook_executions_task ON hook_executions(task_id);
CREATE INDEX IF NOT EXISTS idx_hook_executions_name ON hook_executions(hook_name);
CREATE INDEX IF NOT EXISTS idx_hook_executions_executed ON hook_executions(executed_at);
CREATE INDEX IF NOT EXISTS idx_hook_executions_status ON hook_executions(status);
CREATE INDEX IF NOT EXISTS idx_hook_executions_session_hook ON hook_executions(session_id, hook_name, directory);

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
-- NOTE: checkpoints table removed - not used
-- ============================================================================

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
-- Session File Validations (track which hooks have validated which files)
-- Used to skip re-running hooks when files haven't changed since last validation
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_file_validations (
    id TEXT PRIMARY KEY,
    session_id TEXT NOT NULL REFERENCES sessions(id),
    file_path TEXT NOT NULL,
    file_hash TEXT NOT NULL,  -- Hash at time of validation
    plugin_name TEXT NOT NULL,
    hook_name TEXT NOT NULL,
    directory TEXT NOT NULL,  -- The directory context (dirs_with match)
    command_hash TEXT NOT NULL,  -- SHA256 of the command to detect config changes
    validated_at TEXT NOT NULL DEFAULT (datetime('now')),
    -- Unique per file/plugin/hook/directory combo within a session
    UNIQUE(session_id, file_path, plugin_name, hook_name, directory)
);

CREATE INDEX IF NOT EXISTS idx_file_validations_session ON session_file_validations(session_id);
CREATE INDEX IF NOT EXISTS idx_file_validations_path ON session_file_validations(file_path);
CREATE INDEX IF NOT EXISTS idx_file_validations_plugin ON session_file_validations(plugin_name, hook_name);
CREATE INDEX IF NOT EXISTS idx_file_validations_dir ON session_file_validations(directory);

-- ============================================================================
-- Session Todos (event-sourced: latest todo list for each session)
-- Populated during indexing when TodoWrite tool calls are encountered
-- Stores the full todo list as JSON (since TodoWrite replaces the entire list)
-- ============================================================================
CREATE TABLE IF NOT EXISTS session_todos (
    id TEXT PRIMARY KEY,  -- Generated ID
    session_id TEXT NOT NULL UNIQUE REFERENCES sessions(id),  -- One todo list per session
    message_id TEXT NOT NULL,  -- Reference to the source tool_use message
    todos_json TEXT NOT NULL,  -- JSON array of todos [{content, status, activeForm}]
    timestamp TEXT NOT NULL,
    line_number INTEGER NOT NULL,
    indexed_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_session_todos_session ON session_todos(session_id);
CREATE INDEX IF NOT EXISTS idx_session_todos_timestamp ON session_todos(timestamp);

-- ============================================================================
-- Vector embeddings (for semantic search)
-- Note: sqlite-vec tables are created dynamically with appropriate dimensions
-- ============================================================================
