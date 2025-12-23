---
name: coordinator-data-layer
summary: Single-coordinator pattern for indexing JSONL transcripts to SurrealKV database
---

# Coordinator Data Layer

Single-coordinator pattern ensuring exactly one process indexes Claude Code JSONL transcripts to the unified SurrealKV database.

## Problem Statement

Multiple Han instances (MCP servers, browse commands) may run simultaneously. Without coordination:
- Multiple processes could index the same files causing duplicate data
- Race conditions between readers and writers
- Wasted resources on redundant indexing

## Solution: Single Coordinator Pattern

One process becomes the "coordinator" and handles all JSONL → SurrealKV indexing. Other instances are read-only consumers of the database.

```
┌─────────────────────────────────────────────────────────────────┐
│                    Claude Code Sessions                          │
│                                                                  │
│  ~/.claude/projects/{project-slug}/{session-id}.jsonl            │
│                                                                  │
│  [File changes via inotify/FSEvents]                             │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Coordinator Process                           │
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Lock: ~/.claude/han/coordinator.lock                     │    │
│  │ Contains: { pid, started_at, last_heartbeat }            │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Responsibilities:                                               │
│  ├── Watch JSONL files for changes                              │
│  ├── Parse new lines incrementally                              │
│  ├── Index to SurrealKV (upserts)                               │
│  └── Update heartbeat periodically                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SurrealKV Database                            │
│                                                                  │
│  ~/.claude/han/data/surrealkv/                                   │
│                                                                  │
│  Tables:                                                         │
│  ├── repo      (git repositories)                               │
│  ├── project   (worktrees/paths within repos)                   │
│  ├── session   (Claude Code sessions)                           │
│  ├── message   (individual messages with line_number)           │
│  └── ...other tables (tasks, hook_cache, etc.)                  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Reader Processes                              │
│                                                                  │
│  [MCP Server]  [Browse UI]  [Hooks]                             │
│                                                                  │
│  All read from SurrealKV via db interface                        │
│  Never access JSONL files directly                               │
└─────────────────────────────────────────────────────────────────┘
```

## Lock Mechanism

### Lock File Format

```json
{
  "pid": 12345,
  "started_at": "2025-01-15T10:30:00Z",
  "last_heartbeat": "2025-01-15T10:35:00Z",
  "process_type": "mcp"  // or "browse"
}
```

### Lock Acquisition Flow

```
┌─────────────────┐
│  Process Start  │
└────────┬────────┘
         │
         ▼
┌─────────────────────────────────────┐
│ Read coordinator.lock               │
└────────┬────────────────────────────┘
         │
         ├─── File missing ──► Acquire lock
         │
         ├─── PID alive AND heartbeat fresh ──► Become reader
         │
         └─── PID dead OR heartbeat stale ──► Acquire lock
```

### Lock Lifecycle

1. **Acquire**: Atomically write lock file with current PID
2. **Heartbeat**: Update `last_heartbeat` every 5 seconds
3. **Monitor**: Check if lock file PID still matches self
4. **Release**: Delete lock file on clean shutdown

### Race Condition Handling

If a coordinator's PID gets overwritten (race condition):
1. Coordinator detects lock file has different PID
2. Immediately stops indexing
3. Becomes a reader instead
4. New coordinator takes over

```rust
fn check_still_coordinator(&self) -> bool {
    if let Ok(lock) = read_lock_file() {
        lock.pid == self.my_pid
    } else {
        false
    }
}
```

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
- Safe to re-index partial files
- Idempotent operations
- No duplicate messages

### Schema

```sql
-- Message table with line-based indexing
DEFINE TABLE message SCHEMAFULL;
DEFINE FIELD session_id ON message TYPE string;
DEFINE FIELD message_id ON message TYPE string;
DEFINE FIELD message_type ON message TYPE string;
DEFINE FIELD line_number ON message TYPE int;
-- ... other fields

-- Unique constraint prevents duplicates
DEFINE INDEX idx_message_line ON message
  FIELDS session_id, line_number UNIQUE;
```

## API Separation

### Coordinator-Only API (Rust)

These functions are internal to `han-native` and not exposed to TypeScript:

- `jsonl_read_page()` - Read JSONL lines
- `parse_jsonl_line()` - Parse message from line
- File watching logic

### Indexer API (Coordinator Access)

Exposed to TypeScript but should only be called by coordinator:

```typescript
// db/index.ts
export const indexer = {
  indexSessionFile(filePath: string): Promise<IndexResult>,
  indexProjectDirectory(projectDir: string): Promise<IndexResult[]>,
  handleFileEvent(eventType, filePath, ...): Promise<IndexResult | null>,
  fullScanAndIndex(): Promise<IndexResult[]>,
};
```

### Reader API (All Processes)

Standard database queries available to all processes:

```typescript
// db/index.ts
export const sessions = {
  get(sessionId: string): Promise<Session | null>,
  list(options?: {...}): Promise<Session[]>,
};

export const messages = {
  list(options: {sessionId, limit?, offset?}): Promise<Message[]>,
  count(sessionId: string): Promise<number>,
  search(options: {query, ...}): Promise<Message[]>,
};
```

## Process Types

Either MCP or Browse can become coordinator:

| Process | Can Coordinate | Typical Lifecycle |
|---------|---------------|-------------------|
| MCP Server | ✅ | Long-running, CC session lifetime |
| Browse UI | ✅ | User-initiated, may be short-lived |

The first process to acquire the lock becomes coordinator. Order doesn't matter - the pattern ensures exactly one.

## Failure Scenarios

### Coordinator Crashes

1. Lock file remains with stale PID
2. Other processes detect stale heartbeat (>30 seconds)
3. Next process to check acquires lock
4. Becomes new coordinator
5. Starts indexing from last known position (incremental)

### Database Corruption

SurrealKV is append-only with built-in recovery:
- Automatic transaction replay on startup
- No manual recovery needed

### Missed File Events

Full scan on coordinator startup catches up:
1. Scan all project directories
2. Compare file mtime vs database `updated_at`
3. Re-index sessions with stale data

## Configuration

```yaml
# han.yml
coordinator:
  heartbeat_interval: 5   # seconds
  stale_timeout: 30       # seconds, consider lock stale
  idle_timeout: 300       # seconds, disconnect from unused backends
```

## Implementation Files

- `han-native/src/coordinator.rs` - PID lock mechanism
- `han-native/src/indexer.rs` - JSONL → SurrealKV indexing
- `han-native/src/watcher.rs` - File change detection
- `han-native/src/crud.rs` - Database operations
- `han/lib/db/index.ts` - TypeScript API

## Related

- [Native Module](./native-module.md) - Rust bindings architecture
- [Browse Architecture](./browse-architecture.md) - Browse UI integration
- [MCP Server](./mcp-server.md) - MCP server lifecycle