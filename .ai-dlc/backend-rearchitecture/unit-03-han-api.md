---
status: completed
depends_on:
  - unit-01-han-db
branch: ai-dlc/backend-rearchitecture/03-han-api
discipline: backend
ticket: ""
---

# unit-03: han-api (async-graphql schema + Relay connections)

## Description
Create the `han-api` Rust crate providing the complete async-graphql schema with Relay-compliant connections, Hasura-style filters/ordering, DataLoaders, and database-agnostic subscriptions. This crate is shared by both `han-coordinator` (SQLite) and `han-server` (PostgreSQL).

## Discipline
backend - Rust crate using async-graphql with DataLoader, SeaORM integration, and broadcast-channel subscriptions.

## Domain Entities
All ~90 GraphQL types currently defined in `packages/han/lib/graphql/types/`:

**Core types**: Session, Project, Repo, ConfigDir, ActiveSlot, Plugin, PluginCategory, PluginStats
**Message interface**: 20+ concrete types - AssistantMessage, RegularUserMessage, CommandUserMessage, InterruptUserMessage, MetaUserMessage, ToolResultUserMessage, SummaryMessage, SystemMessage, HookRunMessage, HookResultMessage, McpToolCallMessage, McpToolResultMessage, ExposedToolCallMessage, ExposedToolResultMessage, HookDatetimeMessage, HookReferenceMessage, HookFileChangeMessage, HookValidationMessage, HookValidationCacheMessage, HookScriptMessage, HookCheckStateMessage, MemoryLearnMessage, MemoryQueryMessage, QueueOperationMessage, FileHistorySnapshotMessage, SentimentAnalysisMessage, UnknownEventMessage
**Content blocks**: TextBlock, ThinkingBlock, ToolUseBlock, ToolResultBlock, ImageBlock (union type)
**Metrics**: MetricsData, Task, TaskConnection, DailyActivity, HourlyActivity, DailyModelTokens, ModelTokenEntry, FrustrationSummary
**Memory**: MemoryQuery, MemorySearchResult, MemoryAgentResult, MemoryAgentProgress, Citation
**Hooks**: HookExecution, HookExecutionConnection, HookStats, HookTypeStat
**Tasks**: NativeTask, NativeTaskStatus enum
**Dashboard**: DashboardAnalytics (computed), ClaudeSettingsSummary, HanConfigSummary
**Enums**: EventAction, MemoryEventType, PluginScope, TodoStatus, ContentBlockType, ToolCategory, MemoryLayer, MemorySource, Confidence, MetricsPeriod, TaskStatus, TaskType, TaskOutcome

## Data Sources
- **Input**: `packages/han/lib/graphql/types/` (90+ TypeScript files) - Every type definition to port
- **Input**: `packages/han/lib/graphql/schema.ts` (53KB) - Schema builder with all query/mutation/subscription roots
- **Input**: `packages/han/lib/graphql/loaders.ts` - DataLoader batch patterns
- **Input**: `packages/han/lib/graphql/pubsub.ts` - Subscription topic definitions
- **Input**: `packages/han/lib/graphql/builder.ts` - Pothos builder config (global ID encoding)
- **Runtime**: `DatabaseConnection` from han-db (SQLite or PostgreSQL)
- **Runtime**: `broadcast::Sender<DbChangeEvent>` for subscriptions

## Technical Specification

### Crate Structure
```
crates/han-api/
  Cargo.toml
  src/
    lib.rs                  # build_schema() function
    schema.rs               # Schema builder combining all roots
    query.rs                # QueryRoot - all top-level queries
    mutation.rs             # MutationRoot (if any mutations exist)
    subscription.rs         # SubscriptionRoot - all subscriptions
    connection.rs           # Generic Connection<T>, Edge<T>, PageInfo
    filters.rs              # Hasura-style StringFilter, DateTimeFilter, etc.
    node.rs                 # Relay Node interface + global ID encode/decode
    context.rs              # GraphQLContext type definition
    loaders/
      mod.rs
      tool_result.rs        # ToolResultBlock by toolCallId
      hook_result.rs        # HookResultMessage by hookRunId
      mcp_result.rs         # McpToolResultMessage by callId
      exposed_result.rs     # ExposedToolResultMessage by callId
      session_messages.rs   # Messages batch-loaded by session
      paired_events.rs      # All paired event extraction
    types/
      mod.rs
      session.rs            # Session with computed fields (summary, todoCount, tokenUsage)
      project.rs
      repo.rs
      config_dir.rs
      active_slot.rs
      plugin.rs
      message/
        mod.rs              # Message interface enum
        interface.rs        # Shared fields trait
        assistant.rs
        user/
          mod.rs            # UserMessage sub-interface
          regular.rs
          command.rs
          interrupt.rs
          meta.rs
          tool_result.rs
        summary.rs
        system.rs
        hook_run.rs
        hook_result.rs
        mcp_tool_call.rs
        mcp_tool_result.rs
        exposed_tool_call.rs
        exposed_tool_result.rs
        hook_datetime.rs
        hook_reference.rs
        hook_file_change.rs
        hook_validation.rs
        hook_validation_cache.rs
        hook_script.rs
        hook_check_state.rs
        memory_learn.rs
        memory_query.rs
        queue_operation.rs
        file_history_snapshot.rs
        sentiment_analysis.rs
        unknown_event.rs
      content_block/
        mod.rs              # ContentBlock union
        text.rs
        thinking.rs
        tool_use.rs         # With nested result via DataLoader
        tool_result.rs
        image.rs
        block_type_enum.rs
        tool_category.rs
        tool_metadata.rs
      metrics/
        mod.rs
        metrics_data.rs
        task.rs
        daily_activity.rs
        hourly_activity.rs
        model_tokens.rs
        frustration.rs
      memory/
        mod.rs
        query.rs
        search_result.rs
        agent_result.rs
        agent_progress.rs
        citation.rs
      hook_execution.rs
      native_task.rs
      dashboard.rs
      settings.rs
      enums/
        mod.rs              # All enum types
      team/                 # Team-specific types (feature-gated)
        mod.rs
        user.rs
        team.rs
        team_member.rs
```

### Critical: Global ID Encoding
The current Pothos schema uses `Typename:id` format (colon-delimited, NOT base64). The Rust implementation MUST match exactly:
```rust
pub fn encode_global_id(type_name: &str, id: &str) -> String {
    format!("{}:{}", type_name, id)
}
pub fn decode_global_id(global_id: &str) -> Option<(&str, &str)> {
    global_id.split_once(':')
}
```
This is NOT the standard Relay base64 encoding. The browse-client depends on this format.

### Generic Relay Connection
```rust
#[derive(SimpleObject)]
#[graphql(concrete(name = "SessionConnection", params(SessionType)))]
#[graphql(concrete(name = "MessageConnection", params(MessageInterface)))]
// ... all connection types
pub struct Connection<T: OutputType> {
    pub edges: Vec<Edge<T>>,
    pub page_info: PageInfo,
    pub total_count: i64,
}
```

### Hasura-Style Filters
```rust
#[derive(InputObject)]
pub struct SessionFilter {
    pub id: Option<StringFilter>,
    pub status: Option<StringFilter>,
    pub project_path: Option<StringFilter>,
    pub started_at: Option<DateTimeFilter>,
    pub and: Option<Vec<SessionFilter>>,
    pub or: Option<Vec<SessionFilter>>,
    pub not: Option<Box<SessionFilter>>,
}
```

### Subscriptions
All subscriptions accept a `broadcast::Receiver<DbChangeEvent>` from context. They are database-agnostic:
```rust
#[Subscription]
impl SubscriptionRoot {
    async fn session_updated(&self, ctx: &Context<'_>, id: Option<ID>) -> impl Stream<Item = SessionType>;
    async fn session_message_added(&self, ctx: &Context<'_>, session_id: ID) -> impl Stream<Item = MessageEdge>;
    async fn session_added(&self, ctx: &Context<'_>) -> impl Stream<Item = SessionType>;
    async fn hook_result_added(&self, ctx: &Context<'_>, session_id: ID) -> impl Stream<Item = HookResultMessage>;
    async fn session_todos_changed(&self, ctx: &Context<'_>, session_id: ID) -> impl Stream<Item = Vec<SessionTodo>>;
    async fn session_files_changed(&self, ctx: &Context<'_>, session_id: ID) -> impl Stream<Item = Vec<SessionFileChange>>;
}
```

### Schema Builder
```rust
pub fn build_schema(
    db: DatabaseConnection,
    change_tx: broadcast::Sender<DbChangeEvent>,
    mode: ApiMode,  // Local or Hosted
) -> Schema<QueryRoot, MutationRoot, SubscriptionRoot> {
    Schema::build(QueryRoot, MutationRoot, SubscriptionRoot)
        .data(db.clone())
        .data(change_tx)
        .data(DataLoader::new(ToolResultLoader::new(db.clone()), tokio::spawn))
        .data(DataLoader::new(HookResultLoader::new(db.clone()), tokio::spawn))
        // ... all loaders
        .finish()
}
```

### Message Type Discrimination
Messages are discriminated by `message_type` column + `tool_name` for han_events:
```rust
#[derive(Interface)]
#[graphql(
    field(name = "id", ty = "ID"),
    field(name = "timestamp", ty = "Option<String>"),
    field(name = "session_id", ty = "String"),
)]
pub enum MessageInterface {
    Assistant(AssistantMessage),
    RegularUser(RegularUserMessage),
    CommandUser(CommandUserMessage),
    // ... all 20+ types
    Unknown(UnknownEventMessage),
}
```

### CRITICAL: Result messages NEVER appear in Session.messages connection
Per `.claude/rules/graphql/message-types.md`:
- ToolResultMessage -> resolved as `ToolUseBlock.result` field via DataLoader
- HookResultMessage -> resolved as `HookRunMessage.result` field via DataLoader
- McpToolResultMessage -> resolved as `McpToolCallMessage.result` field
- ExposedToolResultMessage -> resolved as `ExposedToolCallMessage.result` field
- The Session.messages connection filters these out

## Success Criteria
- [ ] async-graphql SDL export matches current Pothos SDL for ALL types consumed by browse-client
- [ ] Relay compiler (`relay-compiler`) succeeds against Rust-served schema with zero browse-client changes
- [ ] Global ID encoding uses `Typename:id` format (not base64)
- [ ] All Relay connections implement first/after/last/before pagination correctly
- [ ] DataLoaders batch-load paired events (tool results, hook results, MCP results)
- [ ] Subscription resolvers compile and accept `broadcast::Receiver<DbChangeEvent>`
- [ ] Hasura-style filters work for sessions, messages, and hook executions
- [ ] Result messages are excluded from Session.messages connection
- [ ] Content block parsing from raw_json matches current TypeScript parser
- [ ] 80% test coverage on resolvers and DataLoaders

## Boundaries
This unit does NOT handle:
- Database entity definitions (unit-01: han-db)
- JSONL indexing (unit-02: han-indexer)
- HTTP/WS server or gRPC (unit-04: han-coordinator)
- Team-specific auth or business logic (unit-06: han-server, though team types stubs are here)

This unit ONLY provides: the async-graphql schema as a library crate. It exports a `build_schema()` function that takes a DB connection and broadcast channel.

## Notes
- The SDL comparison is the critical gate. Use `schema.sdl()` from async-graphql and diff against the exported Pothos SDL. Any difference means the browse-client will break.
- Content block parsing is complex - 6 block types with nested structures. Port the exact parsing logic from `packages/han/lib/graphql/types/content-blocks/content-block-parser.ts`.
- The team/ types directory is feature-gated. They only compile when the `team` feature is enabled (used by han-server). The local coordinator doesn't need them.
- Some types have computed fields (Session.summary, Session.todoCount) that require additional DB queries. These use SeaORM queries, not raw SQL.


