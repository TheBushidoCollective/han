---
status: completed
depends_on:
  - unit-01-han-db
branch: ai-dlc/backend-rearchitecture/02-han-indexer
discipline: backend
ticket: ""
---

# unit-02: han-indexer (JSONL parser + file watcher)

## Description
Create the `han-indexer` Rust crate that watches Claude Code JSONL transcript files and indexes them into SQLite via `han-db` entities. This replaces the indexer and watcher modules from `han-native`.

## Discipline
backend - Rust crate using notify (FSEvents/inotify), serde_json for JSONL parsing, and han-db for writes.

## Domain Entities
- **SessionFile** - Tracks which JSONL files have been indexed and the last indexed line number
- **Message** - Individual JSONL lines parsed into structured messages with type discrimination
- **Session** - Created/updated when new JSONL files are discovered
- **SessionSummary/Compact** - Event-sourced from specific message types during indexing
- **NativeTask** - Extracted from TaskCreate/TaskUpdate tool calls during indexing
- **SessionTodo** - Extracted from TodoWrite tool calls
- **SessionFileChange** - Extracted from file-modifying tool results (Edit, Write, Bash)
- **FrustrationEvent** - Extracted from sentiment analysis on messages

## Data Sources
- **Input**: JSONL files at `~/.claude/projects/{project-hash}/{session-id}.jsonl` and `{session-id}-han.jsonl`
- **Input**: `packages/han-native/src/indexer.rs` (1,271 lines) - Current indexer to port
- **Input**: `packages/han-native/src/watcher.rs` - File watcher implementation
- **Input**: `packages/han-native/src/sentiment.rs` - VADER sentiment analysis
- **Input**: `packages/han-native/src/task_timeline.rs` - Task state machine
- **Output**: Writes to SQLite via han-db entities

## Technical Specification

### Crate Structure
```
crates/han-indexer/
  Cargo.toml
  src/
    lib.rs              # Public API: IndexerService, WatcherService
    parser.rs           # JSONL line parsing -> typed message structs
    processor.rs        # Message processing pipeline (indexes into DB)
    sentiment.rs        # VADER sentiment analysis
    task_timeline.rs    # Task type/outcome inference from tool patterns
    watcher.rs          # File system watching via notify crate
    types.rs            # IndexResult, WatcherResult types
```

### JSONL Parser (`parser.rs`)
Parse each JSONL line into a typed struct. Key fields extracted:
- `type` -> message_type (user, assistant, system, summary, result, han_event)
- `message.role` -> role
- `message.content` -> raw content (preserved as JSON for block parsing)
- `uuid` -> message id
- `parentUuid` / `parent_tool_use_id` -> parent_id linkage
- `timestamp` -> extracted with priority: root timestamp > snapshot timestamp > summary leafUuid timestamp
- `toolName` -> for han_events (hook_run, mcp_tool_call, etc.)
- `sentiment_analysis` -> extracted during assistant message processing
- Token usage: `input_tokens`, `output_tokens`, `cache_read_input_tokens`, `cache_creation_input_tokens`

### Processing Pipeline (`processor.rs`)
For each JSONL file:
1. Read from `last_indexed_line` (tracked per SessionFile)
2. Parse each new line with `parser.rs`
3. Determine if message is "paired" (tool_result, hook_result, mcp_tool_result, exposed_tool_result) - these get `parent_id` set
4. Upsert session (extract project path from file path structure)
5. Insert messages via han-db entities
6. Extract side effects:
   - SessionSummary from summary messages
   - SessionCompact from continuation/compact messages
   - NativeTask from TaskCreate/TaskUpdate tool calls
   - SessionTodo from TodoWrite tool calls
   - SessionFileChange from Edit/Write/Bash results that modify files
   - FrustrationEvent from negative sentiment scores
7. Update `last_indexed_line` on SessionFile
8. Return `IndexResult { session_id, messages_indexed, total_messages, is_new_session }`

### File Watcher (`watcher.rs`)
- Use `notify` crate with `macos_fsevent` feature (FSEvents on macOS, inotify on Linux)
- Watch `~/.claude/projects/` recursively for `.jsonl` file changes
- Queue-based result collection (max 1000 items)
- Extract session ID from filename pattern: `{session-id}.jsonl` or `{session-id}-han.jsonl`
- Debounce with `notify-debouncer-mini` (500ms)

### Sentiment Analysis (`sentiment.rs`)
- Use `vader_sentiment` crate (same as current)
- Run on assistant message text content
- Store compound score in `frustration_events` when negative

### Task Timeline (`task_timeline.rs`)
- Infer task type from tool usage patterns (e.g., Edit+Write = "coding", Bash = "execution")
- Track task state transitions: pending -> in_progress -> completed
- Extract from NativeTask tool calls in JSONL

### Public API
```rust
pub struct IndexerService {
    db: DatabaseConnection,
}

impl IndexerService {
    pub async fn index_file(&self, path: &Path) -> Result<IndexResult>;
    pub async fn full_scan(&self, base_dir: &Path) -> Result<Vec<IndexResult>>;
}

pub struct WatcherService {
    watcher: RecommendedWatcher,
    results: Arc<Mutex<VecDeque<WatcherResult>>>,
}

impl WatcherService {
    pub fn new(watch_dir: &Path) -> Result<Self>;
    pub fn poll_results(&self) -> Vec<WatcherResult>;
}
```

## Success Criteria
- [ ] Indexing a real JSONL file produces identical SQLite rows as current han-native indexer
- [ ] File watcher detects new/modified JSONL files within 500ms
- [ ] Sentiment analysis scores match current VADER implementation
- [ ] Task timeline extraction correctly identifies task types and transitions
- [ ] Paired events (tool_result, hook_result) have correct parent_id linkage
- [ ] `full_scan()` discovers all sessions in `~/.claude/projects/`
- [ ] Incremental indexing: only processes lines after `last_indexed_line`
- [ ] 80% test coverage

## Boundaries
This unit does NOT handle:
- GraphQL types or subscriptions (unit-03: han-api)
- Database entity definitions (unit-01: han-db - this unit USES them)
- HTTP/gRPC server (unit-04: han-coordinator)
- sqlite3_update_hook subscription wiring (unit-04: han-coordinator)

This unit ONLY provides: JSONL parsing, file watching, message processing pipeline, and indexing into SQLite.

## Notes
- The current indexer detects schema/data version changes and triggers reindexing. Preserve this behavior.
- The watcher falls back to polling if the callback-based mechanism fails. Preserve this fallback.
- JSONL files can be large (100K+ lines for long sessions). The indexer MUST be incremental, not re-read entire files.
- Han event files (`{session-id}-han.jsonl`) use the same parsing but different event types (hook_run, mcp_tool_call, etc.).


