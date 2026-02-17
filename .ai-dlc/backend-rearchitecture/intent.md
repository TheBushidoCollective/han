---
workflow: default
mode: OHOTL
git:
  change_strategy: unit
  auto_merge: true
  auto_squash: false
testing:
  unit_tests: true
  integration_tests: true
  coverage_threshold: 80
  e2e_tests: true
created: 2026-02-15T00:00:00-07:00
status: active
epic: ""
---

# Han Backend Rearchitecture

## Problem

The current architecture has four problems:

1. **Tangled layers** - The coordinator, GraphQL API, indexer, and CLI are interleaved across TypeScript and Rust (NAPI) with no clean boundaries.
2. **Teams doesn't work** - `han-team-server` (TypeScript/Hono/PostgreSQL) was built as a separate codebase from the local coordinator. Two separate GraphQL schemas, two separate DB layers, never integrated.
3. **No typesafe IPC** - The CLI communicates with the coordinator through direct NAPI function calls (Rust `Mutex<Connection>` singleton), not a proper protocol.
4. **Performance ceiling** - The GraphQL layer is TypeScript (Pothos) calling into Rust NAPI for every DB operation, adding serialization overhead.

## Solution

Decompose into four clean layers with a shared Rust API crate that works against both SQLite (local) and PostgreSQL (teams):

1. **han-api** (Rust library crate) - async-graphql + SeaORM. Hasura-like auto-CRUD with Relay connections, filters, ordering. Shared by coordinator (SQLite) and server (PostgreSQL). Same schema, same types, same resolvers.
2. **han-coordinator** (Rust binary) - Embeds han-api + han-indexer. Serves GraphQL over HTTP/WS for browse-client. Serves gRPC for CLI. Handles hook orchestration and execution with streaming output. Runs locally.
3. **han CLI** (pure Bun binary) - Zero native dependencies. Delegates everything to coordinator via gRPC. Translates Claude Code hook calls into gRPC requests, returns streamed output. Manages coordinator binary lifecycle.
4. **han-server** (Rust binary) - Reuses han-api with PostgreSQL. Adds auth, encryption, billing, sync. Deployed on Railway for teams.

### Architecture

```
LOCAL MACHINE                              RAILWAY (TEAMS)
+-----------------------------------+      +----------------------------+
| han-coordinator (Rust binary)     |      | han-server (Rust binary)   |
|                                   |      |                            |
| +-------------------------------+ |      | +------------------------+ |
| | han-api (SQLite, embedded)    |<------>| | han-api (PostgreSQL)   |<--- team dashboard
| | GraphQL + Relay connections   | |  ^   | | Same schema, same types| |
| +-------------------------------+ |  |   | +------------------------+ |
|                                   |  |   |                            |
| +-------------------------------+ |  |   | +------------------------+ |
| | han-indexer                   | |  |   | | Auth (JWT/OAuth)       | |
| | JSONL watcher + parser        | |  |   | | Encryption (AES-GCM)   | |
| +-------------------------------+ |  |   | | Billing (Stripe)       | |
|                                   |  |   | +------------------------+ |
| +-------------------------------+ |  |   +----------------------------+
| | gRPC server (tonic)           |<---+--- CLI (gRPC client)
| | Hook execution + streaming    | |      browse-client connects
| | Coordinator ops, slots        | |      to either via GraphQL
| +-------------------------------+ |
+-----------------------------------+

CLI (TypeScript/Bun) - pure Bun, zero native deps
+-----------------------------------+
| Hooks, MCP, plugin management     |
| gRPC client -> coordinator        |
| No NAPI, no Rust, no native deps  |
| Bun builtins for git/hash/glob    |
+-----------------------------------+
```

## Domain Model

### Entities

**Local (SQLite):**
- **Session** - Claude Code session. id, status, projectPath, startedAt, updatedAt, slug, modelId, tokenUsage
- **Message** - JSONL transcript line. 20+ discriminated types (Assistant, User, HookRun, McpToolCall, Summary, etc.). Contains ContentBlocks (Text, Thinking, ToolUse, ToolResult, Image)
- **Project** - Tracked project directory. id, path, name
- **Repo** - Git repository. id, url, provider, owner, name
- **NativeTask** - TaskCreate/TaskUpdate entry. id, subject, status, owner, blocks, blockedBy
- **HookExecution** - Hook run record. id, sessionId, hookName, event, exitCode, duration
- **SessionFile** - JSONL file tracking. sessionId, filePath, lastIndexedLine
- **SessionSummary/Compact** - Event-sourced session state snapshots
- **SessionTodo** - Task list state per session
- **SessionFileChange/Validation** - File modification and linting tracking
- **ConfigDir** - Registered Claude Code config directory
- **Slot** - Active coordinator slot (runtime only, not persisted)

**Teams (PostgreSQL, additions):**
- **User** - GitHub OAuth identity. id, githubId, avatarUrl
- **Team** - Multi-tenant org. id, slug, plan tier
- **TeamMember** - Membership. userId, teamId, role (admin/member)
- **ApiKey** - API auth. keyHash, expiresAt
- **SyncedSession** - Remote session data. teamId, userId, sessionId, metadata (JSONB)
- **TeamInvite** - 24-hour invite codes

### Relationships
- Session belongs to Project (via projectPath)
- Project belongs to Repo (git remote)
- Message belongs to Session
- NativeTask belongs to Session
- HookExecution belongs to Session
- ToolResultBlock nested under ToolUseBlock (via toolCallId) - never in main timeline
- HookResultMessage nested under HookRunMessage (via hookRunId) - never in main timeline
- Team has many TeamMembers, TeamMembers reference Users
- SyncedSession belongs to Team and User

### Data Sources
- **SQLite** (`~/.han/han.db`) - Local coordinator. All local entities. FTS5 for search. sqlite-vec for embeddings.
- **PostgreSQL** (Railway) - Team server. Same entities + team entities. tsvector for search.
- **JSONL files** (`~/.claude/projects/*/`) - Raw Claude Code transcripts. Source of truth indexed into SQLite by han-indexer.
- **Filesystem** - Plugin configs, hooks.json, han-plugin.yml, settings files. Read by coordinator for hook orchestration.

### Data Gaps
- **No shared schema** - SQLite schema (han-native) and PostgreSQL schema (han-team-server) were built independently. SeaORM entities will unify them.
- **No sync protocol** - Local coordinator doesn't push data to team server. Need sync format defined in han-server.
- **Subscription backends differ** - sqlite3_update_hook (local) vs LISTEN/NOTIFY (PostgreSQL). Unified behind broadcast::Sender<DbChangeEvent> trait.

## Success Criteria

### Infrastructure
- [ ] Rust workspace at `packages/han-rs/` compiles with `cargo build` for all 5 platform targets
- [ ] `han-coordinator` binary starts, serves GraphQL on port 41956, and responds to gRPC calls
- [ ] `han-server` binary starts, serves GraphQL against PostgreSQL, and handles auth

### Schema Parity
- [ ] async-graphql SDL output matches the current Pothos SDL for all types used by browse-client
- [ ] Relay compiler succeeds against the Rust-served schema with zero browse-client changes
- [ ] All subscriptions (sessionUpdated, messageAdded, etc.) fire in real-time via sqlite3_update_hook

### Data Layer
- [ ] SeaORM entities operate identically against SQLite and PostgreSQL for all CRUD operations
- [ ] FTS search returns identical results to current han-native FTS5 implementation
- [ ] JSONL indexer produces identical SQLite rows as current han-native indexer

### CLI Integration
- [ ] CLI communicates with coordinator exclusively via gRPC (zero NAPI imports)
- [ ] Hook orchestration, caching, and file validation are delegated to the coordinator via gRPC
- [ ] Hook command execution happens in the coordinator with streaming output back to CLI
- [ ] The CLI is a "dumb" layer - translates Claude Code hook calls into gRPC requests, returns streamed output
- [ ] CLI auto-starts coordinator binary if not running
- [ ] CLI is a pure Bun binary with no native dependencies
- [ ] MCP server queries route through gRPC to the coordinator

### Teams
- [ ] Team dashboard connects to `han-server` (PostgreSQL) and renders sessions
- [ ] Auth flow (GitHub OAuth -> JWT) works end-to-end
- [ ] Local coordinator can sync session data to team server

## Context

### Key Design Decisions

1. **SeaORM for dual-database** - Feature flags select SQLite or PostgreSQL backend. Same entities compile against both. Dialect-specific queries (FTS5 vs tsvector, update_hook vs LISTEN/NOTIFY) live behind traits.

2. **Coordinator executes hooks with streaming** - The coordinator receives hook events via gRPC, loads plugin hooks, evaluates caching/skip logic, executes shell commands (std::process::Command), and streams stdout/stderr back to the CLI via gRPC server-streaming. The CLI just forwards output to Claude Code.

3. **gRPC via ConnectRPC** - TypeScript client uses `@connectrpc/connect` + `buf` code generation. No heavy `grpc-node` native dependency. Rust server uses tonic.

4. **Hasura-like auto-CRUD** - Seaography macros auto-generate CRUD resolvers from SeaORM entities. Custom resolvers layer on for content blocks, message discrimination, computed fields, FTS search, and analytics.

5. **No NAPI bridge** - Clean cutover: existing han-native stays untouched until the Rust coordinator binary replaces the TypeScript coordinator, then CLI switches to gRPC, then han-native is deleted.

### Existing Code to Port
- `packages/han-native/src/crud.rs` (267KB, 7,216 lines) - All CRUD operations -> SeaORM entities
- `packages/han-native/src/schema.sql` (27.5KB) - 17 tables, 2 FTS5, 50+ indexes -> SeaORM migrations
- `packages/han/lib/graphql/types/` (90+ files) - TypeScript GraphQL types -> async-graphql types
- `packages/han/lib/graphql/schema.ts` (53KB) - Pothos schema -> async-graphql schema builder
- `packages/han-team-server/` - Auth, crypto, billing, team logic -> han-server
