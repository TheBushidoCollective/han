---
name: rust-graphql-migration
summary: [PROPOSAL] Migration plan for tight DB-GraphQL coupling with Seaography, Relay connections, and sqlite3_update_hook subscriptions
---

# Rust GraphQL Migration

**Status: Proposal / Future Plan**

This document describes a **proposed** migration of the GraphQL coordinator from TypeScript to Rust. This is **not** the current architecture. The current implementation is documented in [Coordinator Data Layer](./coordinator-data-layer.md) and [Coordinator Daemon](./coordinator-daemon.md).

---

Migration plan to move the GraphQL coordinator from TypeScript to Rust, achieving tight DB-GraphQL coupling with SQL-like queryability and Relay-compliant connections.

## Goals

1. **Tight DB-GraphQL coupling** - Schema derived from database, not hand-written types
2. **SQL-like queryability** - Filters, ordering, aggregations at the GraphQL layer
3. **Connections everywhere** - Relay Connection spec, no lists
4. **Real-time subscriptions** - sqlite3_update_hook for change detection
5. **Single binary** - No Node.js runtime for coordinator

## Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Rust Coordinator Binary                            │
│                                                                              │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         async-graphql Server                            │ │
│  │                                                                         │ │
│  │  ┌─────────────────────┐  ┌─────────────────────────────────────────┐  │ │
│  │  │   SeaORM Entities   │  │        Custom Resolvers                 │  │ │
│  │  │   (Auto-generated)  │  │   (Content blocks, aggregations)        │  │ │
│  │  │                     │  │                                         │  │ │
│  │  │  • Repo             │  │  • ContentBlock (union)                 │  │ │
│  │  │  • Project          │  │  • Message discriminated types          │  │ │
│  │  │  • Session          │  │  • FTS search resolvers                 │  │ │
│  │  │  • Message          │  │  • Aggregation resolvers                │  │ │
│  │  │  • Task             │  │  • Settings (from YAML)                 │  │ │
│  │  │  • HookExecution    │  │  • Slot management (runtime)            │  │ │
│  │  │  └─────────────────┘  └─────────────────────────────────────────┘  │ │
│  │                                                                         │ │
│  │  ┌─────────────────────────────────────────────────────────────────┐   │ │
│  │  │              Relay Connection Layer                              │   │ │
│  │  │  • Generic Connection<T> with edges, pageInfo                    │   │ │
│  │  │  • Cursor encoding/decoding                                      │   │ │
│  │  │  • first/after/last/before pagination                            │   │ │
│  │  └─────────────────────────────────────────────────────────────────┘   │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                    Subscription Layer                                   │ │
│  │                                                                         │ │
│  │  sqlite3_update_hook ──► broadcast::channel ──► GraphQL Subscriptions   │ │
│  │                                                                         │ │
│  │  Change events: { table, action, rowid }                               │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
│                                      │                                       │
│  ┌────────────────────────────────────────────────────────────────────────┐ │
│  │                         SQLite Database                                 │ │
│  │                                                                         │ │
│  │  rusqlite + sqlite3_update_hook for native change notifications        │ │
│  └────────────────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────────────────┘
```

## Database-First Schema Generation

### SeaORM Entity Generation

Generate SeaORM entities from existing SQLite schema:

```bash
# Install tools
cargo install sea-orm-cli

# Generate entities from han.db
sea-orm-cli generate entity \
  -u sqlite://~/.claude/han/han.db \
  -o packages/han-coordinator/src/entities
```

This produces typed entities for:

- `repos`, `projects`, `sessions`, `session_files`
- `messages`, `session_summaries`, `session_compacts`, `session_todos`
- `tasks`, `hook_executions`, `hook_cache`
- `frustration_events`, `session_file_changes`, `session_file_validations`

### GraphQL Schema from Entities

Use `seaography` macros to derive GraphQL types:

```rust
use seaography::{Builder, BuilderContext};

let schema = Builder::new(db_connection)
    // Auto-generate from SeaORM entities
    .register_entity::<entity::repos::Entity>()
    .register_entity::<entity::projects::Entity>()
    .register_entity::<entity::sessions::Entity>()
    .register_entity::<entity::messages::Entity>()
    .register_entity::<entity::tasks::Entity>()
    .register_entity::<entity::hook_executions::Entity>()
    // ... all entities
    .build();
```

## Relay Connection Spec

### Generic Connection Implementation

Replace Seaography's `nodes` pagination with Relay connections:

```rust
use async_graphql::*;

/// Generic Relay-compliant connection
#[derive(SimpleObject)]
#[graphql(concrete(name = "SessionConnection", params(Session)))]
#[graphql(concrete(name = "MessageConnection", params(Message)))]
#[graphql(concrete(name = "ProjectConnection", params(Project)))]
pub struct Connection<T: OutputType> {
    pub edges: Vec<Edge<T>>,
    pub page_info: PageInfo,
    pub total_count: i64,
}

#[derive(SimpleObject)]
pub struct Edge<T: OutputType> {
    pub node: T,
    pub cursor: String,
}

#[derive(SimpleObject)]
pub struct PageInfo {
    pub has_next_page: bool,
    pub has_previous_page: bool,
    pub start_cursor: Option<String>,
    pub end_cursor: Option<String>,
}

/// Cursor encoding: base64(type:id)
fn encode_cursor(type_name: &str, id: &str) -> String {
    use base64::{engine::general_purpose::STANDARD, Engine};
    STANDARD.encode(format!("{}:{}", type_name, id))
}

fn decode_cursor(cursor: &str) -> Result<(String, String), Error> {
    use base64::{engine::general_purpose::STANDARD, Engine};
    let decoded = STANDARD.decode(cursor)?;
    let s = String::from_utf8(decoded)?;
    let parts: Vec<&str> = s.splitn(2, ':').collect();
    Ok((parts[0].to_string(), parts[1].to_string()))
}
```

### Connection Arguments

All collection fields use connection args:

```rust
#[derive(InputObject)]
pub struct ConnectionArgs {
    pub first: Option<i32>,
    pub after: Option<String>,
    pub last: Option<i32>,
    pub before: Option<String>,
}

/// Apply connection pagination to a SeaORM query
async fn apply_connection_args<E, C>(
    query: Select<E>,
    args: ConnectionArgs,
    db: &DatabaseConnection,
) -> Result<Connection<E::Model>>
where
    E: EntityTrait,
    E::Model: OutputType,
{
    // Decode cursors to get offset
    let (offset, limit, reverse) = match (args.first, args.after, args.last, args.before) {
        (Some(first), after, None, None) => {
            let offset = after.map(|c| decode_cursor_offset(&c)).unwrap_or(0);
            (offset, first, false)
        }
        (None, None, Some(last), before) => {
            let offset = before.map(|c| decode_cursor_offset(&c)).unwrap_or(0);
            (offset.saturating_sub(last as usize), last, true)
        }
        _ => (0, 20, false), // Default
    };

    // Execute count and paginated query
    let total_count = query.clone().count(db).await?;
    let items = query
        .offset(offset as u64)
        .limit(limit as u64)
        .all(db)
        .await?;

    // Build edges with cursors
    let edges: Vec<Edge<E::Model>> = items
        .into_iter()
        .enumerate()
        .map(|(i, item)| Edge {
            cursor: encode_cursor(E::default().table_name(), &(offset + i).to_string()),
            node: item,
        })
        .collect();

    Ok(Connection {
        page_info: PageInfo {
            has_next_page: (offset + edges.len()) < total_count as usize,
            has_previous_page: offset > 0,
            start_cursor: edges.first().map(|e| e.cursor.clone()),
            end_cursor: edges.last().map(|e| e.cursor.clone()),
        },
        edges,
        total_count: total_count as i64,
    })
}
```

## SQL-Like Queryability

### Filter System

Generate filter types from entities:

```rust
#[derive(InputObject)]
pub struct SessionFilter {
    pub id: Option<StringFilter>,
    pub status: Option<StringFilter>,
    pub project_id: Option<StringFilter>,
    pub started_at: Option<DateTimeFilter>,
    pub and: Option<Vec<SessionFilter>>,
    pub or: Option<Vec<SessionFilter>>,
    pub not: Option<Box<SessionFilter>>,
}

#[derive(InputObject)]
pub struct StringFilter {
    pub eq: Option<String>,
    pub ne: Option<String>,
    pub contains: Option<String>,
    pub starts_with: Option<String>,
    pub ends_with: Option<String>,
    pub in_: Option<Vec<String>>,
    pub not_in: Option<Vec<String>>,
    pub is_null: Option<bool>,
}

#[derive(InputObject)]
pub struct DateTimeFilter {
    pub eq: Option<DateTime>,
    pub gt: Option<DateTime>,
    pub gte: Option<DateTime>,
    pub lt: Option<DateTime>,
    pub lte: Option<DateTime>,
    pub between: Option<(DateTime, DateTime)>,
}
```

### Order By System

```rust
#[derive(InputObject)]
pub struct SessionOrderBy {
    pub id: Option<OrderDirection>,
    pub status: Option<OrderDirection>,
    pub started_at: Option<OrderDirection>,
    pub updated_at: Option<OrderDirection>,
}

#[derive(Enum, Copy, Clone, Eq, PartialEq)]
pub enum OrderDirection {
    Asc,
    Desc,
}
```

### Query Example

```graphql
query {
  sessions(
    filter: {
      status: { eq: "active" }
      started_at: { gte: "2025-01-01T00:00:00Z" }
      or: [
        { project_id: { eq: "proj-1" } }
        { project_id: { eq: "proj-2" } }
      ]
    }
    orderBy: { started_at: DESC }
    first: 20
    after: "Y3Vyc29yOjEw"
  ) {
    edges {
      node {
        id
        status
        messageCount
        project {
          name
        }
      }
      cursor
    }
    pageInfo {
      hasNextPage
      endCursor
    }
    totalCount
  }
}
```

## Subscriptions via sqlite3_update_hook

### Update Hook Setup

```rust
use rusqlite::hooks::Action;
use tokio::sync::broadcast;

#[derive(Clone, Debug)]
pub struct DbChangeEvent {
    pub table: String,
    pub action: ChangeAction,
    pub rowid: i64,
}

#[derive(Clone, Debug, Copy)]
pub enum ChangeAction {
    Insert,
    Update,
    Delete,
}

/// Setup sqlite3_update_hook on connection
pub fn setup_update_hook(
    conn: &Connection,
    tx: broadcast::Sender<DbChangeEvent>,
) {
    conn.update_hook(Some(move |action: Action, _db: &str, table: &str, rowid: i64| {
        let change_action = match action {
            Action::SQLITE_INSERT => ChangeAction::Insert,
            Action::SQLITE_UPDATE => ChangeAction::Update,
            Action::SQLITE_DELETE => ChangeAction::Delete,
            _ => return,
        };

        let _ = tx.send(DbChangeEvent {
            table: table.to_string(),
            action: change_action,
            rowid,
        });
    }));
}
```

### GraphQL Subscriptions

```rust
use async_graphql::*;
use tokio_stream::{Stream, StreamExt, wrappers::BroadcastStream};

pub struct SubscriptionRoot;

#[Subscription]
impl SubscriptionRoot {
    /// Subscribe to session changes
    async fn session_updated(
        &self,
        ctx: &Context<'_>,
        session_id: Option<ID>,
    ) -> impl Stream<Item = Session> {
        let tx = ctx.data_unchecked::<broadcast::Sender<DbChangeEvent>>();
        let db = ctx.data_unchecked::<DatabaseConnection>();

        BroadcastStream::new(tx.subscribe())
            .filter_map(move |event| {
                let event = event.ok()?;
                if event.table != "sessions" {
                    return None;
                }
                // Optionally filter by session_id
                Some(event)
            })
            .then(move |event| async move {
                // Fetch updated session from DB
                entity::sessions::Entity::find_by_id(event.rowid)
                    .one(db)
                    .await
                    .ok()
                    .flatten()
            })
            .filter_map(|s| s)
    }

    /// Subscribe to new messages in a session
    async fn message_added(
        &self,
        ctx: &Context<'_>,
        session_id: ID,
    ) -> impl Stream<Item = MessageEdge> {
        let tx = ctx.data_unchecked::<broadcast::Sender<DbChangeEvent>>();
        let db = ctx.data_unchecked::<DatabaseConnection>().clone();
        let sid = session_id.to_string();

        BroadcastStream::new(tx.subscribe())
            .filter_map(move |event| {
                let event = event.ok()?;
                if event.table != "messages" || event.action != ChangeAction::Insert {
                    return None;
                }
                Some(event)
            })
            .then(move |event| {
                let db = db.clone();
                let sid = sid.clone();
                async move {
                    let msg = entity::messages::Entity::find_by_id(event.rowid)
                        .one(&db)
                        .await
                        .ok()
                        .flatten()?;

                    // Filter by session_id
                    if msg.session_id != sid {
                        return None;
                    }

                    Some(MessageEdge {
                        node: msg.into(),
                        cursor: encode_cursor("Message", &event.rowid.to_string()),
                    })
                }
            })
            .filter_map(|e| e)
    }
}
```

## Custom Types Layer

### Content Block Union

Content blocks are parsed from `messages.raw_json`:

```rust
#[derive(Union)]
pub enum ContentBlock {
    Text(TextBlock),
    Thinking(ThinkingBlock),
    ToolUse(ToolUseBlock),
    ToolResult(ToolResultBlock),
    Image(ImageBlock),
}

#[derive(SimpleObject)]
pub struct TextBlock {
    pub block_type: ContentBlockType,
    pub text: String,
}

#[derive(SimpleObject)]
pub struct ToolUseBlock {
    pub block_type: ContentBlockType,
    pub tool_call_id: String,
    pub name: String,
    pub input: String,  // JSON string
    pub category: ToolCategory,
    #[graphql(skip)]
    pub session_id: String,  // For loading result
}

#[ComplexObject]
impl ToolUseBlock {
    /// Load tool result via DataLoader pattern
    async fn result(&self, ctx: &Context<'_>) -> Option<ToolResultBlock> {
        let loader = ctx.data_unchecked::<DataLoader<ToolResultLoader>>();
        loader.load_one(self.tool_call_id.clone()).await.ok().flatten()
    }
}

/// Parse content blocks from raw_json
fn parse_content_blocks(raw_json: &str) -> Vec<ContentBlock> {
    let parsed: serde_json::Value = serde_json::from_str(raw_json).ok()?;
    let content = parsed.get("message")?.get("content")?;

    match content {
        Value::String(s) => vec![ContentBlock::Text(TextBlock {
            block_type: ContentBlockType::Text,
            text: s.clone(),
        })],
        Value::Array(blocks) => blocks.iter().filter_map(parse_block).collect(),
        _ => vec![],
    }
}

fn parse_block(block: &Value) -> Option<ContentBlock> {
    let block_type = block.get("type")?.as_str()?;
    match block_type {
        "text" => Some(ContentBlock::Text(TextBlock {
            block_type: ContentBlockType::Text,
            text: block.get("text\")?.as_str()?.to_string(),
        })),
        "thinking" => Some(ContentBlock::Thinking(ThinkingBlock {
            block_type: ContentBlockType::Thinking,
            thinking: block.get("thinking")?.as_str()?.to_string(),
        })),
        "tool_use" => Some(ContentBlock::ToolUse(ToolUseBlock {
            block_type: ContentBlockType::ToolUse,
            tool_call_id: block.get("id")?.as_str()?.to_string(),
            name: block.get("name")?.as_str()?.to_string(),
            input: serde_json::to_string(block.get("input")?).ok()?,
            category: categorize_tool(block.get("name")?.as_str()?),
            session_id: String::new(),  // Set by caller
        })),
        // ... other block types
        _ => None,
    }
}
```

### Message Discriminated Types

Messages are typed by `message_type` column:

```rust
#[derive(Interface)]
#[graphql(
    field(name = "id\", ty = "ID"),
    field(name = "timestamp", ty = "DateTime"),
    field(name = "session_id", ty = "String"),
)]
pub enum Message {
    User(UserMessage),
    Assistant(AssistantMessage),
    Summary(SummaryMessage),
    System(SystemMessage),
    HookRun(HookRunMessage),
    McpToolCall(McpToolCallMessage),
    // ... other message types
}

impl From<entity::messages::Model> for Message {
    fn from(m: entity::messages::Model) -> Self {
        match m.message_type.as_str() {
            "user" => Message::User(UserMessage::from(m)),
            "assistant" => Message::Assistant(AssistantMessage::from(m)),
            "summary" => Message::Summary(SummaryMessage::from(m)),
            "system" => Message::System(SystemMessage::from(m)),
            "han_event" => match m.tool_name.as_deref() {
                Some("hook_run") => Message::HookRun(HookRunMessage::from(m)),
                Some("mcp_tool_call") => Message::McpToolCall(McpToolCallMessage::from(m)),
                _ => Message::Unknown(UnknownMessage::from(m)),
            },
            _ => Message::Unknown(UnknownMessage::from(m)),
        }
    }
}
```

## DataLoader Pattern

Batch loading for N+1 prevention:

```rust
use async_graphql::dataloader::{DataLoader, Loader};

pub struct ToolResultLoader {
    db: DatabaseConnection,
}

#[async_trait::async_trait]
impl Loader<String> for ToolResultLoader {
    type Value = ToolResultBlock;
    type Error = async_graphql::Error;

    async fn load(&self, keys: &[String]) -> Result<HashMap<String, Self::Value>, Self::Error> {
        // Batch query for all tool results by tool_call_id
        let results = entity::messages::Entity::find()
            .filter(entity::messages::Column::ParentId.is_in(keys.to_vec()))
            .all(&self.db)
            .await?;

        Ok(results
            .into_iter()
            .filter_map(|m| {
                let parent_id = m.parent_id.clone()?;
                Some((parent_id, parse_tool_result(&m)?))
            })
            .collect())
    }
}

// Register loaders in context
pub fn create_schema(db: DatabaseConnection, change_tx: broadcast::Sender<DbChangeEvent>) -> Schema {
    Schema::build(QueryRoot, MutationRoot, SubscriptionRoot)
        .data(db.clone())
        .data(change_tx)
        .data(DataLoader::new(
            ToolResultLoader { db: db.clone() },
            tokio::spawn,
        ))
        .data(DataLoader::new(
            SessionMessagesLoader { db: db.clone() },
            tokio::spawn,
        ))
        // ... other loaders
        .finish()
}
```

## Migration Phases

### Phase 1: Foundation

1. Create `packages/han-coordinator/` Rust crate
2. Generate SeaORM entities from schema.sql
3. Implement generic Connection type
4. Implement filter/orderBy input types
5. Setup rusqlite with update_hook

**Deliverable**: Basic CRUD queries with Relay pagination for all entities

### Phase 2: Custom Types

1. Implement ContentBlock union and parsing
2. Implement Message interface and discriminated types
3. Wire up DataLoaders for tool results, hook results
4. Add computed fields on Session (summary, todos, etc.)

**Deliverable**: Full message rendering with content blocks

### Phase 3: Subscriptions

1. Wire sqlite3_update_hook to broadcast channel
2. Implement sessionUpdated subscription
3. Implement messageAdded subscription with @prependEdge support
4. Add filtered subscriptions (by session, by project)

**Deliverable**: Real-time updates in browse-client

### Phase 4: Advanced Features

1. FTS search via messages_fts virtual table
2. Aggregation resolvers (activity data, metrics)
3. Settings types (read from YAML/JSON files)
4. Slot management (runtime state)

**Deliverable**: Feature parity with TypeScript implementation

### Phase 5: Cutover

1. Update browse command to spawn Rust binary
2. Deprecate TypeScript GraphQL layer
3. Remove Node.js dependency from coordinator
4. Update CI/CD for Rust binary distribution

**Deliverable**: Single Rust binary coordinator

## File Structure

```
packages/han-coordinator/
├── Cargo.toml
├── src/
│   ├── main.rs                 # Axum server entry
│   ├── lib.rs                  # Library exports
│   ├── db/
│   │   ├── mod.rs
│   │   ├── connection.rs       # rusqlite setup + update_hook
│   │   └── migrations.rs       # Schema migrations
│   ├── entities/               # SeaORM generated
│   │   ├── mod.rs
│   │   ├── repos.rs
│   │   ├── projects.rs
│   │   ├── sessions.rs
│   │   ├── messages.rs
│   │   └── ...
│   ├── graphql/
│   │   ├── mod.rs
│   │   ├── schema.rs           # Schema builder
│   │   ├── query.rs            # QueryRoot
│   │   ├── mutation.rs         # MutationRoot
│   │   ├── subscription.rs     # SubscriptionRoot
│   │   ├── connection.rs       # Generic Connection<T>
│   │   ├── filters.rs          # Filter input types
│   │   ├── loaders.rs          # DataLoaders
│   │   └── types/
│   │       ├── mod.rs
│   │       ├── content_block.rs
│   │       ├── message.rs
│   │       ├── session.rs      # Session with computed fields
│   │       └── ...
│   └── subscriptions/
│       ├── mod.rs
│       └── change_events.rs    # sqlite3_update_hook integration
```

## Dependencies

```toml
[dependencies]
# GraphQL
async-graphql = { version = "7", features = ["dataloader"] }
async-graphql-axum = "7"

# Database
sea-orm = { version = "1", features = ["sqlx-sqlite", "runtime-tokio-native-tls"] }
rusqlite = { version = "0.32", features = ["hooks", "bundled"] }

# Web server
axum = { version = "0.7", features = ["ws"] }
tokio = { version = "1", features = ["full"] }
tower-http = { version = "0.5", features = ["cors"] }

# Serialization
serde = { version = "1", features = ["derive"] }
serde_json = "1"

# Utilities
base64 = "0.22"
chrono = { version = "0.4", features = ["serde"] }
```

## Related

- [Coordinator Data Layer](./coordinator-data-layer.md) - Current indexing architecture
- [Browse Architecture](./browse-architecture.md) - Frontend integration
- [Native Module](./native-module.md) - Existing Rust code in han-native