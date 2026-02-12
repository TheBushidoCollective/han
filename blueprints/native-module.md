---
name: native-module
summary: Rust NAPI-RS bindings providing complete database layer, JSONL indexing, FTS search, and coordinator management
---

# Native Module

High-performance Rust bindings providing the complete database layer, JSONL indexing, full-text search, vector search, coordinator lock management, and git operations for Han.

## Overview

The `han-native` package is **not** just glob matching and SHA256 hashing. It is the **entire database and indexing layer** for Han, written in Rust for maximum performance and compiled to Node.js native addons via NAPI-RS.

**Core Responsibilities**:

1. **SQLite Database Management** - Single database connection, WAL mode, FTS5, vector search
2. **JSONL Indexing** - Parse Claude Code transcripts and Han events into structured database
3. **Full-Text Search** - BM25-ranked search via SQLite FTS5
4. **Vector Search** - Semantic search via sqlite-vec and ONNX embeddings
5. **Coordinator Lock** - Single-instance coordinator pattern with stale lock cleanup
6. **Git Operations** - Repository discovery, worktree management, file tracking
7. **File Watching** - Real-time JSONL file monitoring for incremental indexing
8. **Glob Matching & Hashing** - High-performance file discovery and change detection

## Architecture

### Technology Stack

- **Language**: Rust (Rust 2021 edition)
- **Binding Framework**: NAPI-RS (Node API bindings)
- **Database**: SQLite with WAL mode
- **Search**: FTS5 for text, sqlite-vec for vectors
- **Embeddings**: ONNX Runtime with all-MiniLM-L6-v2 model
- **Build System**: Cargo with zigbuild/xwin for cross-compilation
- **Package Manager**: npm (wrapper + platform-specific binaries)

### Package Structure

```
packages/han-native/
├── Cargo.toml              # Rust dependencies
├── src/
│   ├── lib.rs             # NAPI exports and module structure
│   ├── db.rs              # SQLite connection and FTS/vector functions
│   ├── schema.rs          # Data structures (Repo, Project, Session, Message, etc.)
│   ├── crud.rs            # Database CRUD operations
│   ├── indexer.rs         # JSONL → SQLite indexer
│   ├── jsonl/             # High-performance JSONL reader (mmap + SIMD)
│   ├── coordinator.rs     # Single-instance coordinator lock
│   ├── watcher.rs         # File system watcher for JSONL changes
│   ├── git.rs             # Git repository operations
│   ├── embedding.rs       # ONNX Runtime embedding generation
│   ├── sentiment.rs       # Sentiment analysis (VADER-style)
│   ├── task_timeline.rs   # Task timeline reconstruction
│   └── transcript.rs      # JSONL transcript processing utilities
├── index.js               # JavaScript wrapper (npm package entry point)
├── index.d.ts             # TypeScript type definitions
└── *.node                 # Compiled binaries (darwin-arm64.node, linux-x64.node, etc.)
```

### Supported Platforms

| Platform | Architecture | Target Triple |
|----------|--------------|---------------|
| macOS | Apple Silicon | aarch64-apple-darwin |
| macOS | Intel | x86_64-apple-darwin |
| Linux | ARM64 | aarch64-unknown-linux-gnu |
| Linux | x64 | x86_64-unknown-linux-gnu |
| Windows | x64 | x86_64-pc-windows-msvc |

## API Surface

### Database Initialization

```typescript
// Initialize database at given path (creates tables, sets WAL mode)
function dbInit(dbPath: string): boolean

// Check if database needs reindex after schema upgrade
function needsReindex(): boolean

// Clear reindex flag after successful reindex
function clearReindexFlag(): void
```

### Repository & Project Management

```typescript
// Repos (git repositories)
function upsertRepo(dbPath: string, input: RepoInput): Repo
function getRepoByRemote(dbPath: string, remote: string): Repo | null
function listRepos(dbPath: string): Repo[]

// Projects (worktrees/subdirs within repos)
function upsertProject(dbPath: string, input: ProjectInput): Project
function getProjectBySlug(dbPath: string, slug: string): Project | null
function getProjectByPath(dbPath: string, path: string): Project | null
function listProjects(dbPath: string, repoId?: string): Project[]
```

### Session Management

```typescript
// Create/update session
function upsertSession(dbPath: string, input: SessionInput): Session

// Mark session as completed
function endSession(dbPath: string, sessionId: string): boolean

// Get session by ID
function getSession(dbPath: string, sessionId: string): Session | null

// List sessions with filters
function listSessions(
  dbPath: string,
  projectId?: string,
  status?: string,
  limit?: number
): Session[]

// Reset all sessions for re-indexing (sets last_indexed_line to 0)
function resetAllSessionsForReindex(dbPath: string): number
```

### Message Indexing & Queries

```typescript
// Insert batch of messages for a session
function insertMessagesBatch(
  dbPath: string,
  sessionId: string,
  messages: MessageInput[]
): number

// Get message by ID
function getMessage(dbPath: string, messageId: string): Message | null

// List session messages with filters and pagination
function listSessionMessages(
  dbPath: string,
  sessionId: string,
  messageType?: string,       // Filter by type (e.g., "user", "assistant")
  agentIdFilter?: string,      // "" = main only, "agent-id" = specific agent, null = all
  limit?: number,
  offset?: number
): Message[]

// Get message count for a session
function getMessageCount(dbPath: string, sessionId: string): number

// Batch get message counts for multiple sessions (single query)
function getMessageCountsBatch(
  dbPath: string,
  sessionIds: string[]
): Record<string, number>

// Get first/last message timestamps for sessions (single query)
function getSessionTimestampsBatch(
  dbPath: string,
  sessionIds: string[]
): Record<string, SessionTimestamps>

// Get last indexed line for incremental indexing
function getLastIndexedLine(dbPath: string, sessionId: string): number
```

### Full-Text Search (FTS5)

```typescript
// Search messages using FTS
function searchMessages(
  dbPath: string,
  query: string,          // FTS5 query (e.g., "authentication AND token")
  sessionId?: string,     // Optional session filter
  limit?: number
): Message[]

// Generic FTS operations (used by memory layer)
function ftsIndex(
  dbPath: string,
  tableName: string,
  documents: FtsDocument[]
): number

function ftsSearch(
  dbPath: string,
  tableName: string,
  query: string,
  limit?: number
): FtsSearchResult[]

function ftsDelete(
  dbPath: string,
  tableName: string,
  ids: string[]
): number
```

### Vector Search (sqlite-vec)

```typescript
// Check if ONNX Runtime is available
function embeddingIsAvailable(): Promise<boolean>

// Download ONNX Runtime and model if needed
function embeddingEnsureAvailable(): Promise<string>

// Generate embeddings for texts (384-dim all-MiniLM-L6-v2)
function generateEmbeddings(texts: string[]): Promise<number[][]>
function generateEmbedding(text: string): Promise<number[]>
function getEmbeddingDimension(): number  // Returns 384

// Index documents with vectors
function vectorIndex(
  dbPath: string,
  tableName: string,
  documents: VectorDocumentInput[]
): number

// Search using vector similarity
function vectorSearch(
  dbPath: string,
  tableName: string,
  queryVector: number[],
  limit?: number
): VectorSearchResult[]
```

### Native Tasks (Claude Code Task System)

```typescript
// Get all tasks for a session
function getSessionNativeTasks(
  dbPath: string,
  sessionId: string
): NativeTask[]

// Get specific task by session + task ID
function getNativeTask(
  dbPath: string,
  sessionId: string,
  taskId: string
): NativeTask | null
```

### Session Summaries & Compacts

```typescript
// Session summary (Claude's native context compression)
function upsertSessionSummary(
  dbPath: string,
  input: SessionSummaryInput
): SessionSummary

function getSessionSummary(
  dbPath: string,
  sessionId: string
): SessionSummary | null

// Session compact (additional compression events)
function upsertSessionCompact(
  dbPath: string,
  input: SessionCompactInput
): SessionCompact

function getSessionCompact(
  dbPath: string,
  sessionId: string
): SessionCompact | null

// Session todos (extracted from progress messages)
function upsertSessionTodos(
  dbPath: string,
  input: SessionTodosInput
): SessionTodos

function getSessionTodos(
  dbPath: string,
  sessionId: string
): SessionTodos | null
```

### Generated Summaries (Han LLM Analysis)

```typescript
// Han-generated summaries (Haiku analysis of sessions)
function upsertGeneratedSummary(
  dbPath: string,
  input: GeneratedSessionSummaryInput
): GeneratedSessionSummary

function getGeneratedSummary(
  dbPath: string,
  sessionId: string
): GeneratedSessionSummary | null

// Search summaries using FTS
function searchGeneratedSummaries(
  dbPath: string,
  query: string,
  limit?: number
): GeneratedSessionSummary[]

// List sessions without summaries (for backfill)
function listSessionsWithoutSummaries(
  dbPath: string,
  limit?: number
): string[]
```

### Hook Orchestration & Execution

```typescript
// Create orchestration (cancels existing running orchestrations)
function createOrchestration(input: OrchestrationInput): Orchestration

// Get orchestration by ID
function getOrchestration(id: string): Orchestration | null

// Update orchestration counters
function updateOrchestration(update: OrchestrationUpdate): void

// Cancel orchestration and all pending hooks
function cancelOrchestration(id: string): void

// Get all hooks for an orchestration
function getOrchestrationHooks(orchestrationId: string): HookExecution[]

// Queue hook for later execution (--check mode)
function queueHook(input: QueuedHookInput): string
function getQueuedHooks(orchestrationId: string): QueuedHook[]
function deleteQueuedHooks(orchestrationId: string): number

// Pending hooks for background execution
function queuePendingHook(input: PendingHookInput): string
function getPendingHooks(): HookExecution[]
function getSessionPendingHooks(sessionId: string): HookExecution[]

// Update hook status
function updateHookStatus(id: string, status: string): void
function completeHookExecution(
  id: string,
  success: boolean,
  output: string | null,
  error: string | null,
  durationMs: number
): void
function failHookExecution(id: string, errorMessage: string): void

// Hook attempt tracking (consecutive failures)
function getOrCreateHookAttempt(
  sessionId: string,
  plugin: string,
  hookName: string,
  directory: string
): HookAttemptInfo

function incrementHookFailures(...): HookAttemptInfo
function resetHookFailures(...): void
function increaseHookMaxAttempts(...): void
```

### File Changes & Validation

```typescript
// Record file changes in a session
function recordFileChange(
  dbPath: string,
  input: SessionFileChangeInput
): SessionFileChange

// Get file changes for a session
function getSessionFileChanges(
  dbPath: string,
  sessionId: string,
  agentId?: string
): SessionFileChange[]

// Check if session has file changes
function hasSessionChanges(
  dbPath: string,
  sessionId: string,
  agentId?: string
): boolean

// Record file validation (upserts)
function recordFileValidation(
  dbPath: string,
  input: SessionFileValidationInput
): SessionFileValidation

// Get file validation for specific hook
function getFileValidation(
  dbPath: string,
  sessionId: string,
  filePath: string,
  pluginName: string,
  hookName: string,
  directory: string
): SessionFileValidation | null

// Get all validations for a session/plugin/hook
function getSessionValidations(
  dbPath: string,
  sessionId: string,
  pluginName: string,
  hookName: string,
  directory: string
): SessionFileValidation[]

// Check if files need validation (changed since last validation)
function needsValidation(
  dbPath: string,
  sessionId: string,
  pluginName: string,
  hookName: string,
  directory: string,
  commandHash: string
): boolean

// Get files for validation with status
function getFilesForValidation(
  dbPath: string,
  sessionId: string,
  pluginName: string,
  hookName: string,
  directory: string
): FileValidationStatus[]

// Delete stale validations for files that no longer exist
function deleteStaleValidations(
  dbPath: string,
  sessionId: string,
  pluginName: string,
  hookName: string,
  directory: string,
  currentFilePaths: string[]
): number
```

### Coordinator Lock Management

```typescript
// Try to acquire coordinator lock (single-instance pattern)
function tryAcquireCoordinatorLock(): boolean

// Release coordinator lock
function releaseCoordinatorLock(): boolean

// Update heartbeat (call periodically while coordinating)
function updateCoordinatorHeartbeat(): boolean

// Get current coordinator status
function getCoordinatorStatus(): CoordinatorStatus

// Check if this process is the coordinator
function isCoordinator(): boolean

// Get heartbeat interval and stale timeout
function getHeartbeatInterval(): number  // 5 seconds
function getStaleLockTimeout(): number   // 15 seconds

// Clean up stale lock files
function cleanupStaleCoordinatorLock(): boolean
```

### JSONL Indexing

```typescript
// Index a single session file incrementally
function indexSessionFile(
  dbPath: string,
  filePath: string,
  sourceConfigDir?: string
): IndexResult

// Index all JSONL files in a project directory
function indexProjectDirectory(
  dbPath: string,
  projectDir: string,
  sourceConfigDir?: string
): IndexResult[]

// Handle file event from watcher (coordinator use only)
function handleFileEvent(
  dbPath: string,
  eventType: FileEventType,
  filePath: string,
  sessionId?: string,
  projectPath?: string
): IndexResult | null

// Full scan and index all Claude Code sessions
function fullScanAndIndex(dbPath: string): IndexResult[]
```

### File Watching

```typescript
// Start watching Claude projects directory for JSONL changes
function startFileWatcher(watchPath?: string): boolean

// Add additional watch path (multi-environment support)
function addWatchPath(configDir: string, projectsPath?: string): boolean

// Remove watch path
function removeWatchPath(configDir: string): boolean

// Get all watched paths
function getWatchedPaths(): string[]

// Stop file watcher
function stopFileWatcher(): boolean

// Register callback for index results (event-driven)
function setIndexCallback(callback: (result: IndexResult) => void): void
function clearIndexCallback(): void

// Check if watcher is running
function isWatcherRunning(): boolean

// Get default watch path
function getDefaultWatchPath(): string  // ~/.claude/projects
```

### JSONL Operations (High-Performance)

```typescript
// Fast line counting (mmap + SIMD)
function jsonlCountLines(filePath: string): number

// Get file statistics
function jsonlStats(filePath: string): JsonlStats

// Read page of lines
function jsonlReadPage(
  filePath: string,
  offset: number,
  limit: number
): PaginatedResult

// Read lines in reverse (recent-first)
function jsonlReadReverse(filePath: string, limit: number): JsonlLine[]

// Build byte offset index for random access
function jsonlBuildIndex(filePath: string): JsonlIndex
function jsonlSaveIndex(index: JsonlIndex): void
function jsonlLoadIndex(filePath: string): JsonlIndex | null

// Read specific lines using index (O(1) per line)
function jsonlReadIndexed(
  filePath: string,
  index: JsonlIndex,
  lineNumbers: number[]
): JsonlLine[]

// Stream lines with callback (memory-efficient)
function jsonlStream(
  filePath: string,
  callback: (err: Error | null, lines: JsonlLine[]) => void,
  batchSize: number
): Promise<number>

// Filter JSONL by field values
function jsonlFilter(
  filePath: string,
  filters: JsonlFilter[],
  limit?: number
): FilterResult

// Filter by time range (optimized)
function jsonlFilterTimeRange(
  filePath: string,
  timestampField: string,
  startTime: string,
  endTime: string,
  limit?: number
): FilterResult
```

### Git Operations

```typescript
// Get git branch
function getGitBranch(directory: string): string | null

// Get git repository root
function getGitRoot(directory: string): string | null

// Get git common directory (for worktrees)
function getGitCommonDir(directory: string): string | null

// Get remote origin URL
function getGitRemoteUrl(directory: string): string | null

// Get comprehensive git info
function getGitInfo(directory: string): GitInfo

// List tracked files
function gitLsFiles(directory: string): string[]

// List worktrees
function gitWorktreeList(directory: string): GitWorktree[]

// Get git log
function gitLog(directory: string, maxCount?: number): GitLogEntry[]

// Show file content at commit
function gitShowFile(directory: string, commit: string, filePath: string): string

// Create branch
function gitCreateBranch(directory: string, branchName: string): void

// Add worktree
function gitWorktreeAdd(directory: string, worktreePath: string, branch: string): void

// Remove worktree
function gitWorktreeRemove(directory: string, worktreePath: string, force?: boolean): void

// Get diff statistics
function gitDiffStat(directory: string, fromCommit: string, toCommit: string): GitDiffStat[]
```

### File Hashing & Glob

```typescript
// Compute SHA256 hash of file
function computeFileHash(filePath: string): string

// Compute hashes in parallel
function computeFileHashesParallel(filePaths: string[]): Record<string, string>

// Find files with glob patterns (respects .gitignore)
function findFilesWithGlob(rootDir: string, patterns: string[]): string[]

// Find directories containing marker files
function findDirectoriesWithMarkers(rootDir: string, markers: string[]): string[]

// Build manifest of file hashes
function buildManifest(files: string[], rootDir: string): Record<string, string>

// Check if any files changed
function hasChanges(
  rootDir: string,
  patterns: string[],
  cachedManifest: Record<string, string>
): boolean

// Check and build manifest in one pass
function checkAndBuildManifest(
  rootDir: string,
  patterns: string[],
  cachedManifest?: Record<string, string>
): CheckResult
```

### Dashboard Aggregates (SQL Optimization)

```typescript
// Query all dashboard analytics in a single SQL call
// Replaces ~850 individual database round-trips
function queryDashboardAggregates(
  dbPath: string,
  cutoffDate: string
): DashboardAggregates

// Query all activity data in a single SQL call
// Replaces ~425 individual database round-trips
function queryActivityAggregates(
  dbPath: string,
  cutoffDate: string
): ActivityAggregates
```

### Async Hook Queue

```typescript
// Enqueue async hook (cancels pending with same dedup key)
function enqueueAsyncHook(dbPath: string, input: AsyncHookQueueInputNative): string

// List pending async hooks
function listPendingAsyncHooks(dbPath: string, sessionId: string): AsyncHookQueueEntry[]

// Check if queue is empty
function isAsyncHookQueueEmpty(dbPath: string, sessionId: string): boolean

// Drain queue (get all pending, mark as running)
function drainAsyncHookQueue(dbPath: string, sessionId: string): AsyncHookQueueEntry[]

// Cancel pending hooks and return merged file paths
function cancelPendingAsyncHooks(
  dbPath: string,
  sessionId: string,
  cwd: string,
  plugin: string,
  hookName: string
): string[]

// Complete async hook
function completeAsyncHook(
  dbPath: string,
  id: string,
  success: boolean,
  result?: string,
  error?: string
): void

// Cancel specific async hook
function cancelAsyncHook(dbPath: string, id: string): void

// Clear all hooks for session (SessionEnd cleanup)
function clearAsyncHookQueueForSession(dbPath: string, sessionId: string): number
```

### Config Directory Registry (Multi-Environment)

```typescript
// Register config directory
function registerConfigDir(dbPath: string, input: ConfigDirInput): ConfigDir

// Get config directory by path
function getConfigDirByPath(dbPath: string, path: string): ConfigDir | null

// List all registered config directories
function listConfigDirs(dbPath: string): ConfigDir[]

// Update last indexed timestamp
function updateConfigDirLastIndexed(dbPath: string, path: string): boolean

// Unregister config directory
function unregisterConfigDir(dbPath: string, path: string): boolean

// Get default config directory
function getDefaultConfigDir(dbPath: string): ConfigDir | null
```

### File Operations Extraction

```typescript
// Extract file operations from transcript content (regex-based)
function extractFileOperations(content: string): ExtractionResult

// Batch extract from multiple messages
function extractFileOperationsBatch(contents: string[]): ExtractionResult[]
```

### Session File Listing

```typescript
// List JSONL session files in directory (sorted by mtime)
function listSessionFiles(dirPath: string): SessionFile[]

// List JSONL files matching pattern
function listJsonlFiles(
  dirPath: string,
  prefix?: string,
  suffix?: string
): SessionFile[]
```

### Index Result Polling

```typescript
// Get all pending index results and clear queue
// Used by TypeScript layer to publish subscription events
function pollIndexResults(): IndexResult[]
```

### Database Maintenance

```typescript
// Truncate all derived tables (preserves repos/projects)
// Used during reindex to rebuild from scratch
function truncateDerivedTables(dbPath: string): number
```

## Loading Strategy

The native module implements a multi-step fallback loading strategy to work in multiple environments:

```typescript
// From packages/han/lib/utils/native-loader.ts
function loadNativeModule() {
  // 1. Try npm package (production)
  try {
    return require('@thebushidocollective/han-native');
  } catch {}

  // 2. Try monorepo path (development)
  try {
    return require('../../han-native');
  } catch {}

  // 3. Bun compiled binaries - extract from bunfs to temp
  if (isBunBinary) {
    const embeddedPath = import.meta.resolveSync('../native/han-native.node');
    const bytes = readFileSync(embeddedPath);
    const tempPath = join(tmpdir(), `han-native-${pid}.node`);
    writeFileSync(tempPath, bytes, { mode: 0o755 });
    const module = require(tempPath);
    unlinkSync(tempPath);  // dlopen keeps handle open
    return module;
  }

  // 4. Direct embedded require (non-Bun bundles)
  try {
    return require('../native/han-native.node');
  } catch {}

  // 5. Legacy fallback (next to executable)
  try {
    return require(join(dirname(process.execPath), 'han-native.node'));
  } catch {}

  throw new Error('Failed to load han-native module');
}
```

### Loading Contexts

1. **npm Installation**: Loads from `@thebushidocollective/han-native` package
2. **Monorepo Development**: Loads from relative `../../han-native` path
3. **Bun Compiled Binary**: Extracts embedded `.node` from bunfs to temp, then loads
4. **Direct Embedded**: For non-Bun bundlers that support native modules directly
5. **Standalone Binary**: Loads from executable directory

### Bun Bundle Extraction (Critical)

Bun compiles binaries embed files in a virtual filesystem (`/$bunfs/`). Native `.node` modules require `dlopen()` which cannot read from the virtual filesystem. The solution:

1. Detect if running in a Bun binary (`execPath` is not `bun` or `node`)
2. Use `import.meta.resolveSync()` to get the embedded path in bunfs
3. Read bytes with `readFileSync()` (works with bunfs)
4. Write to temp file with executable permissions (0o755)
5. Load via `require()` from real filesystem
6. Clean up temp file immediately (dlopen keeps file handle, so safe to delete)

This enables han to run as a compiled binary without external dependencies.

## Database Schema

The native module creates and manages the following SQLite tables:

### Core Tables

- **repos** - Git repositories
- **projects** - Worktrees/subdirs within repos
- **sessions** - Claude Code sessions
- **session_files** - JSONL files belonging to sessions (main, agent, han_events)
- **messages** - JSONL transcript entries (user, assistant, tool_use, tool_result, etc.)
- **native_tasks** - Tasks from Claude Code's TaskCreate/TaskUpdate tools
- **session_summaries** - Claude's native context compression summaries
- **session_compacts** - Additional compaction events
- **session_todos** - Extracted todo lists from progress messages
- **generated_summaries** - Han-generated session summaries (LLM analysis)

### Hook Tracking Tables

- **orchestrations** - Group hook executions by orchestrate run
- **hook_executions** - Individual hook execution records
- **queued_hooks** - Hooks queued for `--check` mode
- **pending_hooks** - Hooks queued for background execution
- **hook_attempts** - Track consecutive failures for deferred execution

### File Tracking Tables

- **session_file_changes** - Files modified during sessions
- **session_file_validations** - File validation results from hooks

### Async Hook Tables

- **async_hook_queue** - Async hooks queued for execution

### Config Management Tables

- **config_dirs** - Registered CLAUDE_CONFIG_DIR locations (multi-environment)

### FTS Tables

- **messages_fts** - FTS5 index for message content
- **generated_summaries_fts** - FTS5 index for summary content

All tables use proper indexes for fast queries, and WAL mode is enabled for concurrent reads during indexing.

## Performance Characteristics

### JSONL Reading

- **Fast**: mmap + SIMD line counting
- **Incremental**: Tracks `last_indexed_line`, only reads new lines
- **Indexed**: Byte offset index for O(1) random access
- **Memory-efficient**: Streaming reader for large files

### Database Operations

- **WAL Mode**: Concurrent reads during indexing
- **Batch Inserts**: Uses transactions for bulk operations
- **Indexed Queries**: All common queries use indexes
- **Connection Pooling**: Single global connection (coordinator only)

### Search Performance

- **FTS5**: Sub-millisecond full-text search with BM25 ranking
- **Vector Search**: ONNX embeddings with sqlite-vec cosine similarity
- **Batch Queries**: DataLoader-compatible batch operations

### File Operations

- **Parallel Hashing**: SHA256 hashing using rayon threadpool
- **Gitignore-Aware**: Glob matching respects `.gitignore`
- **Change Detection**: Manifest-based caching for fast change detection

## Build Process

### Development

```bash
cd packages/han-native
cargo build --release
```

### CI/CD

Built in `.github/workflows/release-binaries.yml` using cross-compilation:

**Linux/macOS Cross-Compilation**:

```yaml
- uses: taiki-e/install-action@v2
  with:
    tool: cargo-zigbuild

- run: cargo zigbuild --release --target ${{ matrix.target }}
```

**Windows Cross-Compilation**:

```yaml
- uses: taiki-e/install-action@v2
  with:
    tool: cargo-xwin

- run: cargo xwin build --release --target x86_64-pc-windows-msvc
```

**Platform-Specific Notes**:

- **Darwin targets** (macOS): Use Docker with macOS SDK for cross-compilation from Linux
  - Docker image: `ghcr.io/rust-cross/cargo-zigbuild:latest`
  - Required for linking against system frameworks (IOKit, CoreFoundation, etc.)
  
- **Windows targets**: Use `cargo-xwin` (NOT `cargo-zigbuild`)
  - Requires: `llvm`, `clang`, `nasm` packages

- **Linux ARM64**: Build natively on `ubuntu-24.04-arm` runner

### Build Steps

1. Checkout code
2. Setup Rust toolchain with target platform
3. Build native module with cargo zigbuild/xwin
4. Copy `.node` file to `native/han-native.node` for embedding
5. Build Bun binary with `bun build --compile`
6. Upload artifacts to GitHub release

## Error Handling

The native module now throws errors with detailed diagnostics instead of silent fallback:

```
Failed to load han-native module. Tried:
@thebushidocollective/han-native: Cannot find module...
../../han-native: Cannot find module...
embedded-extract: <extraction error if any>
embedded: <direct load error>

This is a required dependency. Please ensure han is installed correctly.
```

This provides clear guidance for debugging installation issues.

## Files

### Implementation

- `packages/han-native/src/lib.rs` - NAPI exports and module structure
- `packages/han-native/src/db.rs` - SQLite connection and FTS/vector functions
- `packages/han-native/src/schema.rs` - Data structure definitions
- `packages/han-native/src/crud.rs` - Database CRUD operations
- `packages/han-native/src/indexer.rs` - JSONL → SQLite indexer
- `packages/han-native/src/jsonl/` - High-performance JSONL reader
- `packages/han-native/src/coordinator.rs` - Coordinator lock management
- `packages/han-native/src/watcher.rs` - File system watcher
- `packages/han-native/src/git.rs` - Git operations
- `packages/han-native/src/embedding.rs` - ONNX Runtime embeddings
- `packages/han-native/src/sentiment.rs` - Sentiment analysis
- `packages/han-native/src/task_timeline.rs` - Task timeline reconstruction
- `packages/han-native/src/transcript.rs` - JSONL transcript utilities

### Build Configuration

- `.github/workflows/release-binaries.yml` - Multi-platform build workflow
- `packages/han/scripts/build-bundle.js` - Bun compilation script
- `packages/han-native/Cargo.toml` - Rust dependencies

### TypeScript Layer

- `packages/han/lib/utils/native-loader.ts` - Module loading with fallbacks
- `packages/han/lib/db/index.ts` - TypeScript wrapper around native functions
- `packages/han/lib/services/coordinator-service.ts` - Primary consumer

## Related Systems

- [Coordinator Data Layer](./coordinator-data-layer.md) - Uses native module for indexing
- [Coordinator Daemon](./coordinator-daemon.md) - Runs coordinator lock and indexing
- [Hook System](./hook-system.md) - Uses native module for caching and validation
- [Build & Deployment](./build-deployment.md) - Compiles and releases native binaries
- [Han Memory System](./han-memory-system.md) - Uses FTS and vector search