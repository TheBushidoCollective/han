---
status: pending
depends_on: []
branch: ai-dlc/backend-rearchitecture/01-han-db
discipline: backend
ticket: ""
---

# unit-01: han-db (SeaORM entities + dual-database abstraction)

## Description
Create the `han-db` Rust crate providing SeaORM entities for all 17 SQLite tables, with feature-flagged support for both SQLite and PostgreSQL backends. This is the data foundation that every other crate depends on.

## Discipline
backend - Rust crate with SeaORM, rusqlite (for FTS5/update_hook), and sqlx (for PostgreSQL).

## Domain Entities
All 17 tables from `packages/han-native/src/schema.sql`:
- repos, projects, sessions, session_files
- messages, session_summaries, session_compacts, session_todos
- native_tasks, hook_executions, orchestrations, pending_hooks, async_hook_queue
- frustration_events, session_file_changes, session_file_validations
- config_dirs, han_metadata

Plus 2 FTS5 virtual tables: messages_fts, generated_session_summaries_fts

## Data Sources
- **Input**: `packages/han-native/src/schema.sql` (27.5KB) - Definitive schema
- **Input**: `packages/han-native/src/crud.rs` (267KB, 7,216 lines) - All CRUD operations to port
- **Input**: `packages/han-native/src/db.rs` - Connection management patterns
- **Output**: SeaORM entities in `packages/han-rs/crates/han-db/src/entities/`

## Technical Specification

### Rust Workspace Setup
Create `packages/han-rs/Cargo.toml` as a workspace root:
```toml
[workspace]
resolver = "2"
members = ["crates/*"]

[workspace.dependencies]
sea-orm = { version = "1", features = ["runtime-tokio-rustls", "macros"] }
sea-orm-migration = "1"
rusqlite = { version = "0.32", features = ["bundled", "hooks", "vtab"] }
sqlite-vec = "0.1"
serde = { version = "1", features = ["derive"] }
serde_json = "1"
chrono = { version = "0.4", features = ["serde"] }
uuid = { version = "1", features = ["v4", "serde"] }
tokio = { version = "1", features = ["full"] }
```

### han-db Crate Structure
```
crates/han-db/
  Cargo.toml
  src/
    lib.rs              # Public API
    connection.rs       # DatabaseConnection factory (SQLite or PostgreSQL)
    entities/
      mod.rs            # Re-exports all entities
      repos.rs
      projects.rs
      sessions.rs
      messages.rs
      session_files.rs
      session_summaries.rs
      session_compacts.rs
      session_todos.rs
      native_tasks.rs
      hook_executions.rs
      orchestrations.rs
      pending_hooks.rs
      async_hook_queue.rs
      frustration_events.rs
      session_file_changes.rs
      session_file_validations.rs
      config_dirs.rs
      han_metadata.rs
    migrations/
      mod.rs
      m20260215_000001_initial.rs   # Full schema creation
    search.rs           # SearchBackend trait: FTS5 (SQLite) / tsvector (PostgreSQL)
```

### Feature Flags
```toml
[features]
default = ["sqlite"]
sqlite = ["sea-orm/sqlx-sqlite"]
postgres = ["sea-orm/sqlx-postgres"]
```

### Entity Generation
1. Run `sea-orm-cli generate entity -u sqlite://~/.han/han.db -o src/entities/` to bootstrap
2. Hand-tune generated entities:
   - Add proper column types for both backends (TEXT dates for SQLite, TIMESTAMP for PostgreSQL)
   - Add custom `From` implementations for query results
   - Add `Related` trait implementations for entity relationships
   - Ensure all indexes match the current schema

### SearchBackend Trait
```rust
pub trait SearchBackend: Send + Sync {
    async fn search_messages(&self, query: &str, session_id: Option<&str>, limit: u64) -> Result<Vec<MessageSearchResult>>;
    async fn search_summaries(&self, query: &str, limit: u64) -> Result<Vec<SummarySearchResult>>;
}
```
- `SqliteSearch` implementation uses FTS5 MATCH queries
- `PostgresSearch` implementation uses tsvector @@ plainto_tsquery

### Connection Factory
```rust
pub enum DbConfig {
    Sqlite { path: PathBuf },
    Postgres { url: String },
}

pub async fn connect(config: DbConfig) -> Result<DatabaseConnection> {
    match config {
        DbConfig::Sqlite { path } => {
            // WAL mode, 64MB cache, 5s busy timeout, foreign keys
            // Same PRAGMA setup as current han-native/src/db.rs
        }
        DbConfig::Postgres { url } => {
            // Connection pool via sqlx
        }
    }
}
```

### CRUD Operations
Port all operations from `crud.rs` into SeaORM patterns:
- `upsert_repo()` -> `repos::Entity::insert().on_conflict(...).exec()`
- `upsert_session()` -> `sessions::Entity::insert().on_conflict(...).exec()`
- `create_message()` -> `messages::Entity::insert().exec()`
- `get_session_messages()` -> `messages::Entity::find().filter(...).all()`
- All queries use RETURNING clause (no re-entrancy deadlock risk with SeaORM pools)
- Batch operations use `.insert_many()` where current code does multi-row inserts

## Success Criteria
- [ ] Rust workspace compiles: `cargo build` succeeds from `packages/han-rs/`
- [ ] All 17 entities generated and compile with both `sqlite` and `postgres` features
- [ ] SeaORM migrations create identical table structure to current `schema.sql`
- [ ] Integration tests against a real `~/.han/han.db` file: entity queries return identical results to current `han-native` CRUD functions
- [ ] SearchBackend trait works: FTS5 search returns same results as current `searchMessages()` NAPI function
- [ ] Connection factory correctly configures WAL mode, cache size, and PRAGMAs for SQLite
- [ ] 80% test coverage on all CRUD operations

## Boundaries
This unit does NOT handle:
- GraphQL types or resolvers (unit-03: han-api)
- JSONL parsing or file watching (unit-02: han-indexer)
- HTTP/gRPC server (unit-04: han-coordinator)
- Auth, encryption, billing (unit-06: han-server)

This unit ONLY provides: database entities, migrations, connection management, CRUD operations, and search.

## Notes
- The current `crud.rs` uses a global `Mutex<Connection>` singleton. SeaORM uses connection pooling. For SQLite, set pool size to 1 for writes (WAL allows concurrent reads). Test thoroughly for behavioral differences.
- RETURNING clause eliminates the Mutex re-entrancy deadlock documented in `.claude/rules/rust-mutex-deadlock.md`.
- FTS5 virtual tables cannot be created via SeaORM migrations. Use raw SQL in the migration for these.
- sqlite-vec tables are dynamically created. Include the creation logic but mark as optional.
