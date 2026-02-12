---
name: coordinator-daemon
summary: Coordinator daemon with GraphQL server, lazy startup, file watching, and unified data access via han-native
---

# Coordinator Daemon Architecture

## Overview

The coordinator is a lazily-started daemon that serves as the central GraphQL server and data indexer for all Han processes. It runs a single GraphQL endpoint with WebSocket subscriptions and indexes Claude Code JSONL transcripts into SQLite.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│              Coordinator Daemon (:41956 HTTP, :41957 TLS)       │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │              GraphQL Server (Pothos)                     │   │
│  │         Queries + Mutations + Subscriptions              │   │
│  │              HTTP/HTTPS + WebSocket                      │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                  │
│  ┌──────────────┐  ┌────────┴───────┐  ┌──────────────────┐   │
│  │ File Watcher │  │   han-native   │  │     PubSub       │   │
│  │ (FSEvents/   │  │ SQLite (WAL)   │  │  (Subscriptions) │   │
│  │  inotify)    │  │  FTS5, Vec     │  │                  │   │
│  └──────┬───────┘  └────────┬───────┘  └──────────────────┘   │
│         │                   │                                  │
│         │ Indexes JSONL    │ Batch queries                    │
│         │ on file change   │ for GraphQL                      │
│         └──────────────────►│                                  │
│                             │                                  │
└─────────────────────────────────────────────────────────────────┘
        ▲                    ▲                    ▲
        │                    │                    │
  HTTPS/WSS :41957    HTTPS/WSS :41957    HTTPS/WSS :41957
        │                    │                    │
┌───────┴───────┐   ┌────────┴───────┐   ┌───────┴───────┐
│    Browse     │   │   MCP Server   │   │     Hooks     │
│ (static files)│   │ (GraphQL client│   │(GraphQL client│
│   :41956*     │   │   + codegen)   │   │  + codegen)   │
└───────┬───────┘   └────────────────┘   └───────────────┘
        │
   Static files*
        │
┌───────┴───────┐
│   Frontend    │
│   (Relay)     │──── connects to :41957 ────►
└───────────────┘

* Browse serves static files only in local mode (`--local`)
  Default mode uses hosted dashboard at dashboard.local.han.guru
```

## Ports

| Port | Service | Purpose |
|---------|---------|---------|
| 41956 | HTTP | GraphQL server (HTTP only, no TLS) |
| 41957 | HTTPS/WSS | GraphQL server (TLS via coordinator.local.han.guru) |

## Components

### Coordinator Daemon

**Location:** `packages/han/lib/commands/coordinator/`

**Responsibilities:**

- GraphQL server with queries, mutations, and subscriptions
- SQLite database management (WAL mode for concurrent reads)
- JSONL file watching via native watcher (FSEvents/inotify)
- Incremental indexing (only processes new lines)
- PubSub for real-time subscription events
- Single source of truth for all data

**Lifecycle:**

- Lazily started by first client (browse, MCP, hooks)
- Runs as detached daemon process
- PID file at `~/.han/coordinator.pid`
- Stays running until explicitly stopped or system restart
- Single-instance coordination via lock file

**CLI Commands:**

```bash
han coordinator start   # Start daemon (if not running)
han coordinator stop    # Stop daemon gracefully
han coordinator status  # Check if running, show PID
```

**File Structure:**

```
packages/han/lib/commands/coordinator/
├── index.ts          # Exports and port configuration
├── daemon.ts         # Process management (PID, logs)
├── server.ts         # GraphQL server setup
├── health.ts         # Health check endpoint
└── types.ts          # Type definitions
```

### GraphQL Server

**Location:** `packages/han/lib/commands/coordinator/server.ts`

**Stack:**

- **Pothos GraphQL** - Type-safe schema builder
- **graphql-yoga** - GraphQL server with WebSocket support
- **Bun.serve()** - HTTP/HTTPS server

**Endpoints:**

- `GET /health` - Health check (returns coordinator status)
- `POST /graphql` - GraphQL queries and mutations
- `WS /graphql` - GraphQL subscriptions (via graphql-ws protocol)

**Schema Location:** `packages/han/lib/graphql/schema.ts`

**Key Features:**

- Relay-style pagination with `@prependEdge` directive
- Real-time subscriptions via PubSub
- DataLoader pattern for efficient batch queries
- Unified error handling

### Browse (Static Server)

**Location:** `packages/han/lib/commands/browse/`

**Two Modes:**

1. **Remote (default)** - Opens `https://dashboard.local.han.guru`
   - Frontend hosted on Railway
   - Connects to local coordinator via TLS
   - No local static server needed

2. **Local (`--local`)** - Serves static files locally
   - Dev mode: Vite with HMR on port 41956
   - Prod mode: Bun.build() + simple HTTP server
   - Ensures coordinator is running on startup

**No longer responsible for:**

- GraphQL handling (moved to coordinator)
- WebSocket proxying (frontend connects directly)
- PubSub (moved to coordinator)

### Frontend (Relay)

**Location:** `packages/browse-client/`

**Connection:**

```typescript
// Direct connection to coordinator daemon
const GRAPHQL_HTTP = 'https://coordinator.local.han.guru:41957/graphql';
const GRAPHQL_WS = 'wss://coordinator.local.han.guru:41957/graphql';
```

**Stack:**

- React Native Web (cross-platform UI)
- Gluestack UI (component library)
- Relay (GraphQL client with subscriptions)
- React Router (navigation)

### MCP Server / Hooks

**GraphQL Client:**

- Use `graphql-request` + GraphQL Code Generator
- Type-safe operations generated from schema
- Connect to `https://coordinator.local.han.guru:41957/graphql`

## Lazy Startup Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    Client starts (browse/MCP)                   │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
              ┌───────────────────────────────┐
              │ Check if coordinator running  │
              │ (GET /health endpoint)        │
              └───────────────────────────────┘
                     │              │
                 Healthy         Unhealthy
                     │              │
                     ▼              ▼
              ┌──────────┐  ┌─────────────────┐
              │ Continue │  │ Spawn daemon:   │
              └──────────┘  │ han coordinator │
                            │ start           │
                            │                 │
                            │ Wait for ready  │
                            │ (poll /health)  │
                            │                 │
                            │ Then continue   │
                            └─────────────────┘
```

**Helper function:**

```typescript
// packages/han/lib/commands/coordinator/daemon.ts
export async function ensureCoordinator(port?: number): Promise<CoordinatorStatus> {
  const effectivePort = port ?? getCoordinatorPort();
  
  // Check if already running
  const health = await checkHealth(effectivePort);
  if (health?.status === 'ok') {
    return { running: true, port: effectivePort };
  }
  
  // Spawn daemon as detached process
  const hanBinary = getHanBinary();
  spawn(hanBinary, ['coordinator', 'start'], {
    detached: true,
    stdio: 'ignore'
  }).unref();
  
  // Wait for health check to pass (timeout: 10s)
  await waitForHealth(effectivePort, 10000);
  
  return { running: true, port: effectivePort };
}
```

## Data Layer Integration

The coordinator uses the `han-native` Rust module for all data operations:

**SQLite Database:** `~/.han/han.db`

- **WAL mode** - Concurrent reads while coordinator indexes
- **FTS5** - Full-text search on messages
- **sqlite-vec** - Vector similarity search
- **Single writer** - Only coordinator writes, all others read

**Indexing Flow:**

1. File watcher detects JSONL change (FSEvents/inotify)
2. Native watcher calls `indexSessionFile(filePath)`
3. Rust parser reads new lines, parses JSON, inserts to SQLite
4. PubSub notifies GraphQL subscribers of new data

**Database Schema:**

```sql
repos             -- Git repositories
projects          -- Worktrees/paths within repos
sessions          -- Claude Code sessions
messages          -- Individual messages (line-based indexing)
native_tasks      -- Claude Code TaskCreate/TaskUpdate events
session_todos     -- TodoWrite task state
session_file_changes -- Edit/Write/NotebookEdit tracking
session_file_validations -- Hook result caching
hook_executions   -- Hook run history
```

## File Watcher

**Implementation:** `han-native/src/watcher.rs`

**Strategy:**

- Primary: FSEvents (macOS) / inotify (Linux) for real-time events
- Fallback: 30-second periodic full scan (catches missed events)
- Multi-path support: Can watch multiple config directories (multi-environment)

**What it watches:**

- `~/.claude/projects/**/*.jsonl` (default)
- Additional paths via `configDirs` registry

**Event handling:**

```
File change event
    ↓
Queue index job
    ↓
Rust indexer processes new lines
    ↓
Insert to SQLite
    ↓
Publish PubSub event
    ↓
GraphQL subscriptions notify clients
```

## PubSub Events

**Implementation:** `packages/han/lib/graphql/pubsub.ts`

**Events:**

- `sessionAdded` - New session created
- `sessionUpdated` - Session metadata changed
- `sessionMessageAdded` - New message in session (with edge data for Relay)
- `sessionTodosChanged` - TodoWrite state updated
- `sessionFilesChanged` - File modified by tool
- `sessionHooksChanged` - Hook executed
- `toolResultAdded` - Tool result available
- `hookResultAdded` - Hook result available

**Relay Integration:**

```typescript
// PubSub payload includes edge data for @prependEdge
publishSessionMessageAdded(sessionId, messageIndex, {
  node: { id, timestamp, type, rawJson, ... },
  cursor: base64(`cursor:${messageIndex}`)
});
```

## Health Check

**Endpoint:** `GET /health`

**Response:**

```json
{
  "status": "ok",
  "version": "0.45.0",
  "port": 41957,
  "uptime": 3600000,
  "coordinator": {
    "isCoordinator": true,
    "heartbeat": "2025-01-15T10:30:00Z"
  }
}
```

**Used by:**

- Lazy startup (detect if daemon running)
- Health monitoring
- Version mismatch detection

## Coordinator Service

**Implementation:** `packages/han/lib/services/coordinator-service.ts`

**Single-Instance Pattern:**

```typescript
export async function startCoordinatorService(): Promise<void> {
  // Initialize database
  await initDb();
  
  // Try to acquire coordinator lock (via han-native)
  const isCoordinator = coordinator.tryAcquire();
  
  if (isCoordinator) {
    // Start coordinating: file watching + indexing
    await startCoordinating();
  } else {
    // Become reader, poll to take over if coordinator dies
    scheduleCoordinatorCheck();
  }
}
```

**Heartbeat:**

- Coordinator updates heartbeat every 5 seconds
- Lock is considered stale after 30 seconds
- Other instances can take over stale locks

**Coordinating Responsibilities:**

1. Start file watcher
2. Run initial full scan and index
3. Process file events incrementally
4. Publish PubSub events on data changes
5. Maintain heartbeat

## Version Management

**Problem:** Coordinator may be older version than clients

**Solution:** Automatic restart on version mismatch

```typescript
// In GraphQL context
export function checkClientVersion(clientVersion: string): boolean {
  if (clientVersion > coordinatorVersion) {
    console.log('Client newer than coordinator, scheduling restart');
    
    // Release lock gracefully
    setTimeout(() => {
      stopCoordinatorService();
      // Newer client will detect coordinator is down and become new coordinator
    }, 1000);
    
    return true;
  }
  return false;
}
```

## CORS Configuration

Coordinator allows requests from browse and dashboard origins:

```typescript
cors: {
  origin: [
    'http://localhost:41956',           // Local browse
    'https://dashboard.local.han.guru', // Hosted dashboard
  ],
  credentials: true
}
```

## TLS Support

**Domain:** `coordinator.local.han.guru`

- DNS A record points to `127.0.0.1`
- Valid Let's Encrypt certificate
- Allows HTTPS from browser to localhost
- Required for WebSocket connections from hosted dashboard

**Certificate Location:** `~/.han/coordinator.pem`, `~/.han/coordinator-key.pem`

**Auto-fetch:** Coordinator downloads cert on startup if missing

## Performance Optimizations

**Batch Queries:**

```typescript
// DataLoader pattern - batch multiple requests into single SQL query
const messageCountLoader = new DataLoader(async (sessionIds: string[]) => {
  return messages.countBatch(sessionIds); // Single SQL query with IN clause
});
```

**SQL Aggregation:**

```typescript
// Dashboard analytics - 850 queries → 10 queries
const dashboardData = await queryDashboardAggregates(cutoffDate);
// Returns: sessions, messages, tasks, costs, activity, hooks, etc.
```

**Incremental Indexing:**

- Only processes new lines since last index
- Upserts prevent duplicates
- Line-based cursor tracking per session

**Periodic Full Scan:**

- 30-second background scan catches missed events
- Only indexes sessions with new data
- Minimal overhead (only stats file to detect changes)

## Shutdown

**Graceful shutdown:**

```typescript
export function stopCoordinatorService(): void {
  if (isCoordinator) {
    watcher.stop();           // Stop file watcher
    coordinator.release();    // Release lock
  }
  
  // GraphQL server cleanup happens in server.ts
}
```

**Process signals:**

- `SIGTERM` - Graceful shutdown
- `SIGINT` (Ctrl+C) - Graceful shutdown
- PID file removed on clean exit

## Monitoring

**Logs:** `~/.han/coordinator.log`

**Metrics tracked:**

- Sessions indexed
- Messages indexed
- Index duration
- File events processed
- Subscription connections
- GraphQL query counts

## Error Handling

**JSONL parse errors:**

- Logged but don't stop indexing
- Partial data inserted where possible
- `error` field in `IndexResult`

**SQLite errors:**

- WAL mode prevents most concurrency issues
- Retry logic for transient errors
- Corrupted database detected via `PRAGMA integrity_check`

**Network errors:**

- Health check retries with exponential backoff
- Subscription reconnection automatic (Relay)

## Related Blueprints

- [Coordinator Data Layer](./coordinator-data-layer.md) - Database schema and indexing
- [GraphQL Schema](./graphql-schema.md) - Type definitions and resolvers
- [Browse Architecture](./browse-architecture.md) - Frontend integration
- [Hook System](./hook-system.md) - Hook execution and caching