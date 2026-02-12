---
name: coordinator-data-layer
summary: JSONL transcript indexing to SQLite via han-native with FTS5 search and DataLoader-compatible batch queries
---

# Coordinator Data Layer

Single-coordinator pattern ensuring exactly one process indexes Claude Code JSONL transcripts to the unified SQLite database via the `han-native` Rust module.

## Problem Statement

Multiple Han instances (MCP servers, browse commands) may run simultaneously. Without coordination:

- Multiple processes could index the same files causing duplicate data
- Race conditions between readers and writers
- Wasted resources on redundant indexing

## Solution: Single Coordinator Pattern

One process becomes the "coordinator" and handles all JSONL → SQLite indexing. Other instances are read-only consumers of the database.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Code Sessions                          │
│                                                                  │
│  ~/.claude/projects/{project-slug}/{session-id}.jsonl            │
│                                                                  │
│  [File changes via FSEvents/inotify]                             │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Coordinator Process                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Lock: PID-based lock in han-native (in-memory)          │    │
│  │ Heartbeat: Updated every 5s, stale after 30s            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Responsibilities:                                               │
│  ├── Watch JSONL files for changes (FSEvents/inotify)           │
│  ├── Parse new lines incrementally (Rust serde_json)            │
│  ├── Index to SQLite (upserts, batch inserts)                   │
│  ├── Update heartbeat periodically (via han-native)              │
│  └── Periodic full scan every 30s (catch missed events)         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                      SQLite Database                             │
│                                                                  │
│  ~/.han/han.db                                                   │
│                                                                  │
│  Tables:                                                         │
│  ├── repos     (git repositories)                               │
│  ├── projects  (worktrees/paths within repos)                   │
│  ├── sessions  (Claude Code sessions)                           │
│  ├── messages  (messages with line_number for incremental)      │
│  ├── native_tasks (TaskCreate/TaskUpdate events)                │
│  ├── session_todos (TodoWrite state)                            │
│  ├── session_file_changes (Edit/Write/NotebookEdit)             │
│  ├── session_file_validations (hook result caching)             │
│  ├── hook_executions (hook run history)                         │
│  └── config_dirs (multi-environment registry)                   │
│                                                                  │
│  Indices:                                                        │
│  ├── messages_fts (FTS5 for full-text search)                   │
│  └── messages_vec (sqlite-vec for semantic search)              │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Reader Processes                              │
│                                                                  │
│  [MCP Server]  [Browse UI]  [Hooks]                             │
│                                                                  │
│  All read from SQLite via db interface (lib/db/index.ts)        │
│  Never access JSONL files directly                               │
└─────────────────────────────────────────────────────────────────┘
```

## Lock Mechanism

### In-Memory PID Lock (han-native)

The coordinator lock is managed entirely in Rust via `han-native`:

```rust
// han-native/src/coordinator.rs
static COORDINATOR_LOCK: Lazy<Mutex<CoordinatorLock>> = Lazy::new(|| {
    Mutex::new(CoordinatorLock {
        pid: None,
        last_heartbeat: None,
    })
});
```

**Lock Acquisition Flow:**

```
┌─────────────────┐
│  Process Start  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Call coordinator.tryAcquire()       │
└────────┬────────────────────────────┘
         │
         ├─── Lock free ──► Acquire lock, return true
         │
         ├─── PID alive AND heartbeat fresh ──► Return false (reader)
         │
         └─── PID dead OR heartbeat stale ──► Steal lock, return true
```

**No File Lock:**

- PID-based coordination in-memory only
- Simpler than file-based locks
- No stale lock files to clean up
- Works across process boundaries via Rust static

### Heartbeat

```typescript
// TypeScript calls han-native every 5s
const heartbeatInterval = setInterval(() => {
  coordinator.updateHeartbeat();
}, 5000);
```

**Stale detection:**

- Heartbeat older than 30 seconds = stale
- Other processes can steal stale locks
- Automatic failover to another instance

## Incremental Indexing

Each session tracks `last_indexed_line` to enable efficient incremental updates:

```
Session: abc-123
├── Last indexed: line 150
├── File has: 175 lines
└── Will index: lines 151-175 only
```

### Message Upserts

All message indexing uses upserts keyed by `(session_id, line_number)`:

```sql
-- SQLite upsert via rusqlite
INSERT INTO messages (session_id, line_number, message_id, ...)
VALUES (?, ?, ?, ...)
ON CONFLICT(session_id, line_number) DO UPDATE SET
  message_id = excluded.message_id,
  message_type = excluded.message_type,
  ...
```

**Benefits:**

- Safe to re-index partial files
- Idempotent operations
- No duplicate messages

## Indexing Implementation

**Location:** `han-native/src/indexer.rs`

**Key Functions:**

```rust
// Index a single JSONL session file incrementally
pub fn index_session_file(db_path: &str, file_path: &str) -> IndexResult

// Handle a file event from the watcher
pub fn handle_file_event(
    db_path: &str,
    event_type: FileEventType,
    file_path: &str
) -> Option<IndexResult>

// Perform a full scan and index all sessions
pub fn full_scan_and_index(db_path: &str) -> Vec<IndexResult>
```

**IndexResult:**

```rust
pub struct IndexResult {
    pub session_id: String,
    pub messages_indexed: usize,
    pub total_messages: usize,
    pub is_new_session: bool,
    pub error: Option<String>,
}
```

## Database Schema

**Tables created via migrations in han-native:**

```sql
-- Core entities
CREATE TABLE repos (id TEXT PRIMARY KEY, remote TEXT UNIQUE, ...);
CREATE TABLE projects (id TEXT PRIMARY KEY, repo_id TEXT, slug TEXT UNIQUE, ...);
CREATE TABLE sessions (id TEXT PRIMARY KEY, project_id TEXT, status TEXT, ...);

-- Messages with line-based indexing
CREATE TABLE messages (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  message_id TEXT NOT NULL,
  message_type TEXT NOT NULL,
  line_number INTEGER NOT NULL,
  agent_id TEXT,
  parent_id INTEGER,
  role TEXT,
  content TEXT,
  raw_json TEXT,
  tool_name TEXT,
  timestamp TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(session_id, line_number)
);

-- Full-text search
CREATE VIRTUAL TABLE messages_fts USING fts5(
  session_id, message_id, content,
  content=messages, content_rowid=id
);

-- Native tasks (TaskCreate/TaskUpdate events)
CREATE TABLE native_tasks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  subject TEXT,
  description TEXT,
  status TEXT,
  owner TEXT,
  active_form TEXT,
  metadata_json TEXT,
  created_at TEXT,
  updated_at TEXT,
  UNIQUE(session_id, task_id)
);

-- Session todos (TodoWrite state)
CREATE TABLE session_todos (
  session_id TEXT PRIMARY KEY,
  todos_json TEXT NOT NULL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- File changes (Edit/Write/NotebookEdit tracking)
CREATE TABLE session_file_changes (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  agent_id TEXT,
  file_path TEXT NOT NULL,
  action TEXT NOT NULL,  -- 'created', 'modified', 'deleted'
  file_hash TEXT,
  timestamp TEXT DEFAULT CURRENT_TIMESTAMP
);

-- File validations (hook result caching)
CREATE TABLE session_file_validations (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  session_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  plugin_name TEXT NOT NULL,
  hook_name TEXT NOT NULL,
  directory TEXT NOT NULL,
  modification_hash TEXT NOT NULL,
  validation_hash TEXT,
  validation_command_hash TEXT,
  validated_at TEXT,
  UNIQUE(session_id, file_path, plugin_name, hook_name, directory)
);

-- Hook executions
CREATE TABLE hook_executions (
  id TEXT PRIMARY KEY,
  session_id TEXT NOT NULL,
  plugin TEXT NOT NULL,
  hook_name TEXT NOT NULL,
  status TEXT NOT NULL,
  output TEXT,
  error TEXT,
  duration_ms INTEGER,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

-- Config dirs (multi-environment support)
CREATE TABLE config_dirs (
  path TEXT PRIMARY KEY,
  name TEXT,
  is_default BOOLEAN DEFAULT 0,
  last_indexed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
```

## API Layers

### 1. Rust Native API (han-native)

**Direct SQLite access:**

```rust
// han-native/src/crud.rs
pub fn upsert_session(db_path: &str, input: SessionInput) -> Session
pub fn list_sessions(db_path: &str, ...) -> Vec<Session>
pub fn insert_messages_batch(db_path: &str, ...) -> usize
```

**Exported to TypeScript via napi-rs:**

```typescript
// In TypeScript
import { getNativeModule } from '../native.ts';
const native = getNativeModule();
native.upsertSession(dbPath, input);
```

### 2. TypeScript Database API (packages/han/lib/db/index.ts)

**Namespaced operations:**

```typescript
// Repo operations
export const repos = {
  async upsert(input: RepoInput): Promise<Repo>,
  async getByRemote(remote: string): Promise<Repo | null>,
  async list(): Promise<Repo[]>,
};

// Session operations
export const sessions = {
  async upsert(input: SessionInput): Promise<Session>,
  async get(sessionId: string): Promise<Session | null>,
  async list(options?: {...}): Promise<Session[]>,
  async end(sessionId: string): Promise<boolean>,
};

// Message operations
export const messages = {
  async insertBatch(sessionId: string, msgs: MessageInput[]): Promise<number>,
  async get(messageId: string): Promise<Message | null>,
  async list(options: {...}): Promise<Message[]>,
  async count(sessionId: string): Promise<number>,
  async search(options: {...}): Promise<Message[]>,
  async countBatch(sessionIds: string[]): Promise<Record<string, number>>,
  async timestampsBatch(sessionIds: string[]): Promise<Record<string, SessionTimestamps>>,
};
```

**Indexer operations (coordinator only):**

```typescript
export const indexer = {
  async indexSessionFile(filePath: string): Promise<IndexResult>,
  async indexProjectDirectory(projectDir: string): Promise<IndexResult[]>,
  async handleFileEvent(...): Promise<IndexResult | null>,
  async fullScanAndIndex(): Promise<IndexResult[]>,
  async needsReindex(): Promise<boolean>,
  async clearReindexFlag(): Promise<void>,
  async truncateDerivedTables(): Promise<void>,
};
```

**Coordinator operations:**

```typescript
export const coordinator = {
  tryAcquire(): boolean,
  release(): boolean,
  updateHeartbeat(): boolean,
  getStatus(): CoordinatorStatus,
  isCoordinator(): boolean,
  getHeartbeatInterval(): number,
  getStaleLockTimeout(): number,
};
```

**File watcher operations:**

```typescript
export const watcher = {
  async start(watchPath?: string): Promise<boolean>,
  stop(): boolean,
  isRunning(): boolean,
  getDefaultPath(): string,
  pollResults(): IndexResult[],
  setCallback(callback: (result: IndexResult) => void): void,
  addWatchPath(configDir: string, projectsPath?: string): boolean,
  removeWatchPath(configDir: string): boolean,
  getWatchedPaths(): string[],
};
```

### 3. GraphQL API (packages/han/lib/graphql/)

**DataLoader pattern for batch queries:**

```typescript
// GraphQL resolver uses DataLoader
const messageCountLoader = new DataLoader(async (sessionIds: string[]) => {
  const counts = await messages.countBatch(sessionIds);
  return sessionIds.map(id => counts[id] || 0);
});

// In resolver
async messageCount(session) {
  return context.loaders.messageCountLoader.load(session.id);
}
```

**Dashboard aggregation queries:**

```typescript
// Single SQL query returns all dashboard metrics
export async function queryDashboardAggregates(
  cutoffDate: string
): Promise<DashboardAggregates>

// Returns:
// - sessionsTotal, sessionsActive
// - messagesTotal, messagesByType
// - tasksTotal, tasksByStatus
// - costEstimate
// - dailyActivity, hourlyActivity
// - toolUsage, hookHealth
// ... etc (850 queries → 10 queries)
```

## File Watcher

**Implementation:** `han-native/src/watcher.rs`

**Platform-specific:**

- macOS: FSEvents API
- Linux: inotify
- Fallback: 30-second periodic scan

**Watch strategy:**

```rust
// Start watching a path
pub fn start_file_watcher(watch_path: Option<&str>) -> bool

// Add additional paths (multi-environment support)
pub fn add_watch_path(config_dir: &str, projects_path: Option<&str>) -> bool

// Remove a watch path
pub fn remove_watch_path(config_dir: &str) -> bool

// Poll for index results (queue-based)
pub fn poll_index_results() -> Vec<IndexResult>

// Or use callback for instant updates
pub fn set_index_callback(callback: impl Fn(IndexResult) + Send + 'static)
```

**Event handling:**

```
File modified: /path/to/session.jsonl
    ↓
FSEvents/inotify notification
    ↓
Queue index job
    ↓
Rust indexer:
  - Read lines after last_indexed_line
  - Parse JSON (serde_json)
  - Insert to SQLite (batch upserts)
  - Update last_indexed_line
    ↓
Return IndexResult
    ↓
TypeScript polls or callback receives result
    ↓
Publish PubSub event to GraphQL subscribers
```

## Multi-Environment Support

**Config directory registry:**

```typescript
// Register a config directory for watching
await registerConfigDir({
  path: '/work/.claude',
  name: 'Work Environment',
  isDefault: false
});

// Coordinator adds to watcher
watcher.addWatchPath('/work/.claude', '/work/.claude/projects');
```

**Benefits:**

- Support multiple Claude Code instances (home + work)
- Separate config directories in containers
- Seamless indexing across environments

## Indexing Workflow

### Initial Startup

```typescript
// In coordinator-service.ts
export async function startCoordinatorService(): Promise<void> {
  await initDb();
  
  const isCoordinator = coordinator.tryAcquire();
  
  if (isCoordinator) {
    // Check for schema upgrade
    if (await indexer.needsReindex()) {
      await indexer.truncateDerivedTables();
      await indexer.clearReindexFlag();
    }
    
    // Full scan on startup
    const results = await indexer.fullScanAndIndex();
    console.log(`Indexed ${results.length} sessions`);
    
    // Start file watcher
    await watcher.start();
    
    // Add additional config directories
    const configDirs = await listConfigDirs();
    for (const dir of configDirs) {
      if (!dir.isDefault) {
        watcher.addWatchPath(dir.path, `${dir.path}/projects`);
      }
    }
    
    // Setup periodic full scan (catch missed events)
    setupPeriodicFullScan();
  }
}
```

### Incremental Updates

```typescript
// Watcher detects file change
watcher.setCallback((result: IndexResult) => {
  // Publish to GraphQL subscribers
  if (result.isNewSession) {
    publishSessionAdded(result.sessionId);
  }
  if (result.messagesIndexed > 0) {
    publishSessionMessageAdded(result.sessionId, ...);
  }
});
```

## Failure Scenarios

### Coordinator Crashes

1. Lock heartbeat stops updating
2. Other processes detect stale heartbeat (>30s)
3. Next process to check tries to acquire lock
4. Lock acquisition succeeds (PID dead or heartbeat stale)
5. New coordinator starts indexing from last known position

### Database Corruption

SQLite with WAL mode provides robust recovery:

- WAL (Write-Ahead Logging) for crash safety
- Automatic journal recovery on startup
- `PRAGMA integrity_check` for validation

### Missed File Events

Periodic full scan catches up:

1. Every 30 seconds, scan all project directories
2. Compare file mtime vs database `last_indexed_at`
3. Re-index sessions with new data
4. Minimal overhead (stat files only)

## Performance Optimizations

### Batch Queries

```typescript
// GraphQL DataLoader batches multiple requests
const sessionIds = ['a', 'b', 'c'];
const counts = await messages.countBatch(sessionIds);
// Single SQL query: SELECT session_id, COUNT(*) FROM messages WHERE session_id IN (?, ?, ?) GROUP BY session_id
```

### SQL Aggregation

```typescript
// Dashboard analytics - 850 queries → 10 queries
const data = await queryDashboardAggregates(cutoffDate);
// Single Rust function returns:
// - Session counts, message counts, task counts
// - Daily/hourly activity, tool usage, hook health
// - All via SQL GROUP BY and aggregation functions
```

### Incremental Indexing

```rust
// Only process new lines
let last_line = get_last_indexed_line(&conn, session_id)?;
let new_lines = read_jsonl_lines(file_path, last_line)?;

for (line_num, line) in new_lines.iter().enumerate() {
    let msg = parse_jsonl_message(line)?;
    upsert_message(&conn, session_id, last_line + line_num + 1, msg)?;
}

update_last_indexed_line(&conn, session_id, last_line + new_lines.len())?;
```

### FTS5 Search

```sql
-- Full-text search using BM25 ranking
SELECT m.*, bm25(fts) as rank
FROM messages_fts fts
JOIN messages m ON m.id = fts.rowid
WHERE fts MATCH ?
ORDER BY rank
LIMIT 20
```

## Related Blueprints

- [Coordinator Daemon](./coordinator-daemon.md) - Process lifecycle and GraphQL server
- [Native Module](./native-module.md) - Rust bindings architecture
- [Hook System](./hook-system.md) - Hook execution and caching using session_file_validations
- [Browse Architecture](./browse-architecture.md) - GraphQL client integration