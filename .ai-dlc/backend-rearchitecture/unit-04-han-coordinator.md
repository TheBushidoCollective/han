---
status: completed
depends_on:
  - unit-01-han-db
  - unit-02-han-indexer
  - unit-03-han-api
branch: ai-dlc/backend-rearchitecture/04-han-coordinator
discipline: backend
ticket: ""
---

# unit-04: han-coordinator (Rust binary with embedded API + indexer + gRPC hook execution)

## Description
Create the `han-coordinator` Rust binary that runs locally as a daemon. It embeds han-api (GraphQL over HTTP/WS), han-indexer (JSONL file watcher), gRPC server (tonic) for CLI communication, and the hook execution engine that runs shell commands with streaming output.

## Discipline
backend - Rust binary using Axum (HTTP/WS), tonic (gRPC), and embedded han-api/han-indexer/han-db crates.

## Domain Entities
- **Coordinator lock** - File-based lock at `~/.han/coordinator.lock` (JSON: pid, acquired_at, heartbeat_at)
- **DbChangeEvent** - sqlite3_update_hook events (table, action, rowid)
- **Protobuf services** - Coordinator, Sessions, Indexer, HookOps, Slots, Memory
- **Slot** - Runtime-only active session slot (not persisted)
- **Hook execution** - Shell command execution with stdout/stderr streaming

## Data Sources
- **Input**: `packages/han/lib/commands/coordinator/` - Current TypeScript coordinator to replace
- **Input**: `packages/han/lib/services/coordinator-service.ts` - Coordinator lifecycle, indexing, pubsub wiring
- **Input**: `packages/han/lib/commands/browse/server.ts` - HTTP/WS server setup
- **Input**: `packages/han-native/src/coordinator.rs` - Lock management
- **Input**: `packages/han/lib/commands/hook/` - Hook dispatch and execution logic to absorb
- **Runtime**: SQLite at `~/.han/han.db`
- **Runtime**: JSONL files at `~/.claude/projects/*/`
- **Runtime**: Plugin hooks from installed plugins' `hooks/hooks.json` files

## Technical Specification

### Crate Structure
```
crates/han-coordinator/
  Cargo.toml
  src/
    main.rs                 # Binary entry point, CLI args, daemon mode
    server.rs               # Axum HTTP/WS server (GraphQL + static files)
    grpc.rs                 # tonic gRPC server implementation
    lock.rs                 # Coordinator lock management (file-based)
    tls.rs                  # mkcert TLS certificate management
    subscriptions.rs        # sqlite3_update_hook -> broadcast::Sender
    hooks/
      mod.rs                # Hook orchestration engine
      executor.rs           # Shell command execution with streaming
      cache.rs              # File validation caching (SHA-based skip)
      discovery.rs          # Plugin hook discovery (reads hooks.json files)
```

### Proto Definitions (`han-proto` crate)
```
crates/han-proto/
  Cargo.toml
  proto/
    coordinator.proto
  src/
    lib.rs                  # Generated code via tonic-build
  build.rs                  # tonic-build configuration
```

```protobuf
syntax = "proto3";
package han.coordinator.v1;

service CoordinatorService {
  rpc Health(HealthRequest) returns (HealthResponse);
  rpc Shutdown(ShutdownRequest) returns (ShutdownResponse);
  rpc Status(StatusRequest) returns (StatusResponse);
}

service SessionService {
  rpc GetActive(GetActiveSessionRequest) returns (SessionResponse);
  rpc Get(GetSessionRequest) returns (SessionResponse);
  rpc List(ListSessionsRequest) returns (ListSessionsResponse);
}

service IndexerService {
  rpc TriggerScan(TriggerScanRequest) returns (TriggerScanResponse);
  rpc Status(IndexerStatusRequest) returns (IndexerStatusResponse);
}

service HookService {
  // Main entry point: execute hooks for an event with streaming output
  rpc ExecuteHooks(ExecuteHooksRequest) returns (stream HookOutput);
  // Record a hook execution result (for external hook runners)
  rpc RecordExecution(RecordExecutionRequest) returns (RecordExecutionResponse);
  // File validation cache
  rpc CheckFileValidation(CheckFileValidationRequest) returns (CheckFileValidationResponse);
  rpc RecordFileValidation(RecordFileValidationRequest) returns (RecordFileValidationResponse);
  // Pending hooks queue
  rpc GetPendingHooks(GetPendingHooksRequest) returns (GetPendingHooksResponse);
}

service SlotService {
  rpc Acquire(AcquireSlotRequest) returns (AcquireSlotResponse);
  rpc Release(ReleaseSlotRequest) returns (ReleaseSlotResponse);
  rpc List(ListSlotsRequest) returns (ListSlotsResponse);
}

service MemoryService {
  rpc Search(MemorySearchRequest) returns (MemorySearchResponse);
  rpc IndexDocument(IndexDocumentRequest) returns (IndexDocumentResponse);
}

// Hook execution streaming messages
message HookOutput {
  oneof output {
    HookStdout stdout = 1;       // stdout line from hook command
    HookStderr stderr = 2;       // stderr line from hook command
    HookCompleted completed = 3;  // hook finished with exit code
    HookError error = 4;         // hook failed to start
  }
}

message ExecuteHooksRequest {
  string event = 1;              // Stop, PreToolUse, PostToolUse, etc.
  string session_id = 2;
  string cwd = 3;                // Project working directory
  optional string tool_name = 4; // For PreToolUse/PostToolUse matcher
  optional string tool_input = 5;// JSON string of tool input
  optional string stdin_payload = 6; // Full stdin JSON for hook commands
}
```

### HTTP/WS Server (`server.rs`)
Axum server on port 41956 (HTTP) and 41957 (HTTPS):
- `POST /graphql` -> async-graphql handler
- `GET /graphql` (WebSocket upgrade) -> graphql-ws subscriptions
- `GET /health` -> health check endpoint
- `GET /*` -> static file serving (browse-client assets from `out/` directory)
- CORS headers for local development

### gRPC Server (`grpc.rs`)
tonic server multiplexed on the same port via HTTP/2:
- All 6 services from the proto definition
- `HookService.ExecuteHooks` is server-streaming: coordinator runs the shell commands and streams stdout/stderr back line-by-line

### sqlite3_update_hook -> Subscriptions (`subscriptions.rs`)
```rust
pub fn setup_subscriptions(conn: &rusqlite::Connection) -> broadcast::Sender<DbChangeEvent> {
    let (tx, _) = broadcast::channel(4096);
    let tx_clone = tx.clone();
    conn.update_hook(Some(move |action, _db, table, rowid| {
        let _ = tx_clone.send(DbChangeEvent { table: table.to_string(), action: action.into(), rowid });
    }));
    tx
}
```
This channel is passed to `han_api::build_schema()` for GraphQL subscriptions.

### Hook Execution Engine (`hooks/`)
The coordinator absorbs all hook orchestration currently in the CLI:

1. **Discovery** (`discovery.rs`): Read `hooks/hooks.json` from all installed plugins. Cache the hook configurations.
2. **Cache** (`cache.rs`): File validation caching. SHA256 hash comparison to skip unchanged files. Query han-db for cached results.
3. **Executor** (`executor.rs`): Run shell commands via `std::process::Command`. Capture stdout/stderr line-by-line. Stream output back via gRPC server-streaming (`HookOutput` messages). Handle timeouts, exit codes, and errors.
4. **Orchestration** (`mod.rs`): For a given event (Stop, PreToolUse, etc.), determine which hooks to run based on matchers, caching, and plugin configuration. Execute them in order. Return aggregated results.

### Coordinator Lock (`lock.rs`)
Same file-based protocol as current `han-native/src/coordinator.rs`:
- Lock file at `~/.han/coordinator.lock` (JSON with pid, timestamps)
- 30-second stale timeout
- 10-second heartbeat interval
- Platform-aware process existence check (Unix: kill signal 0)

### Daemon Mode
- `--daemon` flag: fork and detach, write PID file
- `--foreground` flag: run in foreground (for development)
- `--port` flag: override default port 41956
- Signal handling: SIGTERM/SIGINT for graceful shutdown

## Success Criteria
- [ ] `han-coordinator --foreground --port 41956` starts and serves GraphQL
- [ ] `curl -s http://localhost:41956/graphql -X POST -H "Content-Type: application/json" -d '{"query":"{ __typename }"}' ` returns valid data
- [ ] WebSocket subscriptions connect at `ws://localhost:41956/graphql`
- [ ] gRPC health check responds on the same port
- [ ] `HookService.ExecuteHooks` streams stdout/stderr from a hook command in real-time
- [ ] Hook caching correctly skips unchanged files (SHA comparison)
- [ ] sqlite3_update_hook fires and subscriptions deliver to connected browse-clients
- [ ] Browse-client loads and renders sessions with real-time updates
- [ ] Coordinator lock prevents multiple instances
- [ ] Daemon mode correctly backgrounds with PID file
- [ ] 80% test coverage on gRPC handlers and hook execution

## Boundaries
This unit does NOT handle:
- Database entities (unit-01: han-db)
- JSONL parsing logic (unit-02: han-indexer - but this unit EMBEDS the indexer)
- GraphQL types (unit-03: han-api - but this unit EMBEDS the API)
- CLI gRPC client (unit-05: cli-grpc)
- Team auth/billing (unit-06: han-server)

This unit PROVIDES: the complete local coordinator binary that embeds han-db, han-indexer, and han-api, plus gRPC services and hook execution.

## Notes
- The Axum server and tonic gRPC server can share the same TCP listener using `tower::Service` routing by HTTP version (HTTP/1.1 -> Axum, HTTP/2 -> tonic).
- The hook execution engine needs access to the project working directory (passed via `cwd` in the gRPC request). It runs commands with that as the CWD.
- For TLS, the coordinator currently uses `coordinator.local.han.guru` with mkcert. Port this certificate management.
- The browse-client static files may be embedded in the binary via `include_dir!` or served from a known filesystem path.


