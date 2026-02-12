---
name: metrics-system
summary: Automatic task tracking via Claude Code native TaskCreate/TaskUpdate indexed from JSONL transcripts
---

# Metrics System

Automatic task tracking leveraging Claude Code's native task system, indexed from JSONL transcripts for visibility in the Browse UI.

## Overview

Task tracking in Han is now **fully automatic**. There is no manual MCP server or self-reporting workflow. Instead, Han leverages Claude Code's built-in task tools (`TaskCreate`, `TaskUpdate`, `TaskList`, `TaskGet`) and automatically indexes these events from the JSONL transcript into SQLite for historical analysis and visualization in the Browse UI.

This approach:
- **Eliminates manual reporting overhead** - No MCP tool calls needed
- **Provides immediate value** - Tasks are visible in Claude Code and Browse UI
- **Ensures consistency** - Task state is single-source-of-truth from JSONL
- **Enables historical analysis** - All task data indexed and queryable via GraphQL

## Architecture

```
Claude Code Session
    ↓
Agent uses TaskCreate({ subject, description, activeForm })
    ↓
Task created in Claude Code's task system
    ↓
Event written to {session-id}.jsonl transcript
    ↓
Han coordinator watches JSONL file
    ↓
Incremental indexer processes new lines
    ↓
TaskCreate event → native_tasks table (INSERT)
    ↓
Browse UI queries via GraphQL
    ↓
Tasks visible in sidebar "Tasks" tab
    ↓
Agent uses TaskUpdate({ taskId, status: "in_progress" })
    ↓
Event written to JSONL transcript
    ↓
Indexer updates native_tasks table
    ↓
Browse UI reflects updated status
    ↓
Agent completes work
    ↓
TaskUpdate({ taskId, status: "completed" })
    ↓
Task marked completed with timestamp
    ↓
Full task lifecycle tracked in database
```

## Components

### 1. Claude Code Native Task System

**Tools Available to Agents**:

```typescript
// Create a new task
TaskCreate({
  subject: "Fix authentication bug in login flow",
  description: "Users can't log in with special characters in password. Need to add proper escaping.",
  activeForm: "Fixing authentication bug"  // Shown in spinner when in_progress
})

// Update task status or details
TaskUpdate({
  taskId: "1",
  status: "in_progress"  // pending → in_progress → completed
})

TaskUpdate({
  taskId: "1",
  status: "completed"
})

// List all tasks
TaskList()  // Returns task summaries

// Get task details
TaskGet({ taskId: "1" })  // Returns full task with description
```

**When to Use**:

- Implementing features
- Fixing bugs
- Refactoring code
- Research tasks
- Any substantive work that benefits from tracking

**When NOT to Use**:

- Reading files
- Simple questions
- Trivial operations

### 2. JSONL Transcript Events

When Claude Code receives TaskCreate/TaskUpdate tool calls, it writes structured events to the session JSONL:

**TaskCreate Event**:

```json
{
  "type": "tool_use",
  "id": "msg_abc123",
  "timestamp": "2026-02-12T10:30:00.000Z",
  "role": "assistant",
  "content": [{
    "type": "tool_use",
    "id": "toolu_xyz789",
    "name": "TaskCreate",
    "input": {
      "subject": "Fix authentication bug",
      "description": "Add proper escaping for special characters",
      "activeForm": "Fixing authentication bug"
    }
  }]
}
```

**TaskUpdate Event**:

```json
{
  "type": "tool_use",
  "id": "msg_def456",
  "timestamp": "2026-02-12T10:45:00.000Z",
  "role": "assistant",
  "content": [{
    "type": "tool_use",
    "id": "toolu_abc123",
    "name": "TaskUpdate",
    "input": {
      "taskId": "1",
      "status": "completed"
    }
  }]
}
```

### 3. Han Native Module Indexer

**Location**: `packages/han-native/src/indexer.rs`

**Responsibility**: Watch JSONL files and incrementally index new events into SQLite

**Process**:

1. File watcher detects changes to `{session-id}.jsonl`
2. Indexer reads lines after `last_indexed_line` (incremental)
3. Parse JSON events and extract tool calls
4. Detect TaskCreate/TaskUpdate tool calls
5. Transform to `NativeTaskInput` or `NativeTaskUpdate` structures
6. Insert/update `native_tasks` table
7. Update `sessions.last_indexed_line` for next incremental run

**Database Schema** (`native_tasks` table):

```sql
CREATE TABLE native_tasks (
  id TEXT PRIMARY KEY,              -- Unique task ID (from TaskCreate)
  session_id TEXT NOT NULL,         -- Which session created the task
  message_id TEXT NOT NULL,         -- JSONL message ID that created/updated
  subject TEXT NOT NULL,            -- Brief title
  description TEXT,                 -- Detailed requirements
  status TEXT NOT NULL,             -- pending | in_progress | completed | deleted
  active_form TEXT,                 -- Present continuous form (e.g., "Fixing bug")
  owner TEXT,                       -- Agent owner (for team tasks)
  blocks TEXT,                      -- JSON array of task IDs this blocks
  blocked_by TEXT,                  -- JSON array of task IDs blocking this
  created_at TEXT NOT NULL,         -- ISO 8601 timestamp
  updated_at TEXT NOT NULL,         -- Last update timestamp
  completed_at TEXT,                -- Completion timestamp
  line_number INTEGER NOT NULL      -- JSONL line where event occurred
);

CREATE INDEX idx_native_tasks_session ON native_tasks(session_id);
CREATE INDEX idx_native_tasks_status ON native_tasks(status);
```

**Incremental Indexing**:

The indexer tracks `last_indexed_line` per session to avoid re-processing:

```rust
pub fn index_session_file(
  db_path: &str,
  file_path: &str,
  source_config_dir: Option<&str>
) -> IndexResult {
  // 1. Get last indexed line from database
  let last_line = crud::get_last_indexed_line(db_path, session_id)?;

  // 2. Read only new lines
  let new_lines = jsonl::read_page(file_path, last_line, BATCH_SIZE);

  // 3. Process each line
  for line in new_lines {
    let json = parse_json(&line.content)?;

    // 4. Extract tool calls
    if let Some(tool_use) = extract_tool_use(&json) {
      match tool_use.name.as_str() {
        "TaskCreate" => {
          let input = NativeTaskInput {
            id: generate_task_id(),
            session_id: session_id.clone(),
            message_id: json["id"].as_str()?,
            subject: tool_use.input["subject"].as_str()?,
            description: tool_use.input.get("description"),
            active_form: tool_use.input.get("activeForm"),
            timestamp: json["timestamp"].as_str()?,
            line_number: line.line_number,
          };
          crud::create_native_task(db_path, input)?;
        }
        "TaskUpdate" => {
          let update = NativeTaskUpdate {
            id: tool_use.input["taskId"].as_str()?,
            session_id: session_id.clone(),
            message_id: json["id"].as_str()?,
            status: tool_use.input.get("status"),
            subject: tool_use.input.get("subject"),
            description: tool_use.input.get("description"),
            active_form: tool_use.input.get("activeForm"),
            owner: tool_use.input.get("owner"),
            add_blocks: tool_use.input.get("addBlocks"),
            add_blocked_by: tool_use.input.get("addBlockedBy"),
            timestamp: json["timestamp"].as_str()?,
            line_number: line.line_number,
          };
          crud::update_native_task(db_path, update)?;
        }
        _ => {}
      }
    }
  }

  // 5. Update last_indexed_line
  crud::update_session_last_indexed(db_path, session_id, final_line)?;
}
```

### 4. GraphQL API

**Location**: `packages/han/lib/graphql/types/native-task.ts`

**Purpose**: Expose task data to Browse UI via GraphQL queries and subscriptions

**Schema**:

```graphql
type NativeTask implements Node {
  id: ID!
  sessionId: String!
  messageId: String!
  subject: String!
  description: String
  status: TaskStatus!
  activeForm: String
  owner: String
  blocks: [String!]
  blockedBy: [String!]
  createdAt: DateTime!
  updatedAt: DateTime!
  completedAt: DateTime
  lineNumber: Int!
}

enum TaskStatus {
  PENDING
  IN_PROGRESS
  COMPLETED
  DELETED
}

type Session {
  # ...
  tasks(
    status: TaskStatus
    first: Int
    after: String
  ): NativeTaskConnection!
}

type Query {
  session(id: ID!): Session
  nativeTask(sessionId: String!, taskId: String!): NativeTask
}

type Subscription {
  taskCreated(sessionId: String!): NativeTask!
  taskUpdated(sessionId: String!): NativeTask!
}
```

**DataLoader Integration**:

```typescript
// packages/han/lib/graphql/loaders/native-task-loader.ts
export const nativeTaskLoader = new DataLoader<
  { sessionId: string },
  NativeTask[]
>(async (keys) => {
  const sessionIds = keys.map(k => k.sessionId);
  const tasks = await getSessionNativeTasks(dbPath, sessionIds);
  return sessionIds.map(id => tasks.filter(t => t.sessionId === id));
});
```

**Subscription Publishing**:

The indexer publishes events to GraphQL pubsub when tasks are created/updated:

```typescript
// After indexing new task events
pubsub.publish(`task:created:${sessionId}`, task);
pubsub.publish(`task:updated:${sessionId}`, task);
```

### 5. Browse UI Sidebar

**Location**: `packages/browse-client/src/components/organisms/SessionSidebar.tsx`

**Purpose**: Display tasks in session detail sidebar

**Features**:

- List all tasks for the session
- Filter by status (pending, in_progress, completed)
- Show task metadata (subject, status, timestamps)
- Real-time updates via GraphQL subscriptions
- Visual indicators for task state

**Query**:

```graphql
query SessionTasks($sessionId: ID!) {
  session(id: $sessionId) {
    tasks(first: 50) {
      edges {
        node {
          id
          subject
          description
          status
          activeForm
          owner
          createdAt
          updatedAt
          completedAt
        }
      }
    }
  }
}
```

## Task Lifecycle

### Example Workflow

**1. User Request**

> "Add JWT authentication to the API"

**2. Agent Creates Task**

```typescript
const { data } = await TaskCreate({
  subject: "Add JWT authentication",
  description: "Implement JWT token generation and validation for API endpoints",
  activeForm: "Adding JWT authentication"
});
// Returns: { taskId: "1" }
```

**3. Event Written to JSONL**

```json
{
  "type": "tool_use",
  "id": "msg_abc123",
  "timestamp": "2026-02-12T10:30:00.000Z",
  "content": [{
    "type": "tool_use",
    "name": "TaskCreate",
    "input": {
      "subject": "Add JWT authentication",
      "description": "Implement JWT token generation...",
      "activeForm": "Adding JWT authentication"
    }
  }]
}
```

**4. Indexer Processes Event**

```rust
// Han coordinator detects new line in JSONL
// Extracts TaskCreate tool use
// Creates NativeTask in database with status="pending"
```

**5. Task Visible in Browse UI**

```
Session: snug-dreaming-knuth
├─ Messages (145)
└─ Tasks (1)
   └─ Add JWT authentication [PENDING]
      Created: 10:30 AM
```

**6. Agent Starts Work**

```typescript
await TaskUpdate({
  taskId: "1",
  status: "in_progress"
});
```

**7. Database Updated**

```sql
UPDATE native_tasks
SET status = 'in_progress',
    updated_at = '2026-02-12T10:31:00.000Z'
WHERE id = '1';
```

**8. UI Updates in Real-Time**

```
Tasks (1)
└─ Add JWT authentication [IN PROGRESS]  🔄
   Started: 10:31 AM
```

**9. Agent Completes Work**

```typescript
await TaskUpdate({
  taskId: "1",
  status: "completed"
});
```

**10. Final State**

```sql
UPDATE native_tasks
SET status = 'completed',
    updated_at = '2026-02-12T10:45:00.000Z',
    completed_at = '2026-02-12T10:45:00.000Z'
WHERE id = '1';
```

```
Tasks (1)
└─ Add JWT authentication [COMPLETED] ✓
   Completed: 10:45 AM (15 minutes)
```

## Use Cases

### 1. Real-Time Task Visibility

**Question**: What tasks is the agent working on right now?

**Solution**: Browse UI sidebar shows all tasks with real-time status updates

**Benefits**:
- No need to ask the agent "what are you doing?"
- Clear visibility into multi-step workflows
- Task dependencies visible (blocks/blockedBy)

### 2. Historical Task Analysis

**Question**: How long did that refactoring take?

**Query**:

```graphql
query SessionTasks($sessionId: ID!) {
  session(id: $sessionId) {
    tasks(status: COMPLETED) {
      edges {
        node {
          subject
          createdAt
          completedAt
          # Calculate duration client-side
        }
      }
    }
  }
}
```

**Insight**: Track time spent on tasks, identify patterns

### 3. Cross-Session Task Tracking

**Question**: Which sessions involved database schema changes?

**Query**:

```graphql
query TaskSearch($keyword: String!) {
  searchNativeTasks(query: $keyword) {
    edges {
      node {
        subject
        description
        session {
          id
          slug
          startedAt
        }
      }
    }
  }
}
```

**Insight**: Find all sessions that touched specific areas of the codebase

### 4. Team Coordination

**Question**: Which tasks are blocked on other work?

**Query**:

```graphql
query BlockedTasks($sessionId: ID!) {
  session(id: $sessionId) {
    tasks(first: 50) {
      edges {
        node {
          subject
          status
          blockedBy  # Array of task IDs
          blocks     # Array of task IDs
        }
      }
    }
  }
}
```

**Insight**: Identify bottlenecks, unblock parallel work

## Migration from Legacy Metrics

The old `hashi-han-metrics` MCP server with manual `start_task` / `complete_task` calls has been **removed**. It is replaced by this automatic system.

### What Changed

| Old Approach | New Approach |
|--------------|--------------|
| Manual MCP tool calls | Automatic via native TaskCreate/Update |
| Agent self-assessment (confidence, outcome) | Task state only (pending/in_progress/completed) |
| Hook validation correlation | Not applicable (no self-assessment to validate) |
| SQLite `tasks` table | SQLite `native_tasks` table |
| SessionStart hook injecting instructions | No special hooks needed |
| Stop hook validation | Not applicable |

### Migration Path

If you have old task data in the `tasks` table:

1. Old data remains queryable for historical analysis
2. New sessions use `native_tasks` table exclusively
3. Browse UI shows native tasks only
4. Old metrics queries still work against `tasks` table

### Benefits of New Approach

1. **Zero overhead** - No manual reporting, just use native tools
2. **Immediate value** - Tasks visible in Claude Code UI immediately
3. **Single source of truth** - JSONL is canonical, database is derived
4. **No calibration needed** - No self-assessment, just state tracking
5. **Simpler mental model** - Create task, update status, done

## Performance Characteristics

### Indexing Performance

- **Incremental**: Only new JSONL lines processed
- **Fast**: Rust implementation with mmap and SIMD
- **Concurrent**: WAL mode allows reads during indexing
- **Low latency**: Typically < 100ms for small increments

### Query Performance

- **Indexed**: `session_id` and `status` indexed for fast lookups
- **Batch-friendly**: DataLoader batches requests efficiently
- **Cached**: GraphQL layer caches task lists per session
- **Subscription-based**: Real-time updates without polling

### Storage

- **Minimal**: ~500 bytes per task (subject, description, metadata)
- **Append-only**: No updates to JSONL (source of truth)
- **Compacted**: SQLite vacuums automatically

## Privacy & Security

**Local-First**:
- All data stored in SQLite at `~/.han/han.db`
- No network calls
- No external tracking

**User-Owned**:
- Database is portable and queryable
- Can export, backup, or delete
- Full transparency

**Minimal Data**:
- Task subjects and descriptions (user-controlled)
- No PII unless user includes it
- No conversation content

## Integration Points

### With Coordinator Daemon

Tasks are indexed by the coordinator:

- Single-process indexing (lock-based coordination)
- Incremental updates on file changes
- Publishes GraphQL subscription events

See: [Coordinator Daemon](./coordinator-daemon.md)

### With Browse UI

Tasks appear in the session sidebar:

- Real-time updates via subscriptions
- Filterable by status
- Shows full task lifecycle

See: [Browse Architecture](./browse-architecture.md)

### With JSONL Indexer

Tasks are extracted from JSONL transcripts:

- Detects TaskCreate/TaskUpdate tool uses
- Transforms to database records
- Maintains `last_indexed_line` for incremental processing

See: [Coordinator Data Layer](./coordinator-data-layer.md)

## Future Enhancements

Potential additions based on usage:

1. **Task Dependencies Graph**
   - Visualize blocks/blockedBy relationships
   - Critical path analysis
   - Parallel work identification

2. **Task Templates**
   - Common task patterns (fix, feature, refactor)
   - Pre-filled descriptions
   - Suggested dependencies

3. **Task Metrics**
   - Average duration by type
   - Completion rate trends
   - Bottleneck detection

4. **Cross-Session Task Linking**
   - Mark tasks as related across sessions
   - Follow-up task tracking
   - Long-running initiative tracking

5. **Task Search**
   - Full-text search via FTS5
   - Filter by date range, status, owner
   - Aggregate statistics

## Related Blueprints

- [Coordinator Data Layer](./coordinator-data-layer.md) - JSONL indexing architecture
- [Browse Architecture](./browse-architecture.md) - UI for task visualization
- [Native Module](./native-module.md) - Rust implementation of indexer
- [Hook System](./hook-system.md) - Integration with validation hooks

## References

- Native task CRUD: `packages/han-native/src/crud.rs`
- JSONL indexer: `packages/han-native/src/indexer.rs`
- GraphQL types: `packages/han/lib/graphql/types/native-task.ts`
- Browse UI sidebar: `packages/browse-client/src/components/organisms/SessionSidebar.tsx`
- Database schema: `packages/han-native/src/schema.rs`