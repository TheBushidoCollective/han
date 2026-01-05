---
name: han-events-logging
summary: Session-scoped logging of Han events (hooks, MCP calls) to JSONL files indexed into SQLite for Browse UI visibility
---

# Han Events Logging

Session-scoped logging of Han events (hooks, MCP tool calls, exposed tool proxying) to JSONL files that are indexed into SQLite and displayed in the Browse session screens.

## Problem Statement

Currently, Han operations (hook executions, MCP tool calls, memory queries) happen invisibly. Users have no way to:

- See what hooks ran during a session
- Track MCP tool invocations and their results
- Debug why a hook failed or took a long time
- Understand the timeline of Han activity within a Claude Code session

## Solution: Session-Scoped Event Logs

Each session gets a companion Han event log file that mirrors Claude Code's JSONL transcripts:

```
~/.claude/projects/{project-slug}/
├── {session-id}.jsonl          # Claude Code transcript
└── {session-id}-han.jsonl      # Han events log
```

Events are indexed into SQLite alongside session messages and displayed in the Browse UI.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    Han Event Sources                             │
│                                                                  │
│  [Hook Dispatch]  [MCP Server]  [Exposed Tools]  [Memory]       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Event Logger                                  │
│                                                                  │
│  lib/events/logger.ts                                            │
│  - Appends events to {session-id}-han.jsonl                      │
│  - Thread-safe file writes                                       │
│  - Structured event format                                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    JSONL Event Files                             │
│                                                                  │
│  ~/.claude/projects/{project-slug}/{session-id}-han.jsonl        │
│                                                                  │
│  Format: One JSON object per line                                │
│  - Mirrors Claude Code transcript structure                      │
│  - Indexed by coordinator                                        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Coordinator Indexing                          │
│                                                                  │
│  - Watches for *-han.jsonl files                                 │
│  - Incremental indexing (same pattern as transcripts)            │
│  - Inserts into han_events table                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    SQLite Database                               │
│                                                                  │
│  han_events table:                                               │
│  - id, session_id, event_type, data, timestamp, line_number     │
│  - FTS index for content search                                  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    Browse UI                                     │
│                                                                  │
│  Session Detail Page:                                            │
│  - Timeline view with Han events interleaved                     │
│  - Filter by event type (hooks, mcp, memory)                     │
│  - Expandable event details                                      │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Event Types

### Hook Events

```typescript
interface HookEvent {
  type: "hook_start" | "hook_complete" | "hook_error";
  plugin: string;
  hook: string;
  directory: string;
  cached: boolean;
  // For complete/error:
  duration_ms?: number;
  exit_code?: number;
  output?: string;
  error?: string;
}
```

### MCP Tool Events

```typescript
interface McpToolEvent {
  type: "mcp_tool_call" | "mcp_tool_result";
  tool: string;
  // For call:
  arguments?: Record<string, unknown>;
  // For result:
  success?: boolean;
  duration_ms?: number;
  result?: unknown;
  error?: string;
}
```

### Exposed Tool Events

```typescript
interface ExposedToolEvent {
  type: "exposed_tool_call" | "exposed_tool_result";
  server: string;
  tool: string;
  prefixed_name: string;
  // For call:
  arguments?: Record<string, unknown>;
  // For result:
  success?: boolean;
  duration_ms?: number;
  result?: unknown;
  error?: string;
}
```

### Memory Events

```typescript
interface MemoryEvent {
  type: "memory_query" | "memory_learn";
  // For query:
  question?: string;
  route?: "personal" | "team" | "rules";
  // For learn:
  domain?: string;
  scope?: "project" | "user";
  // Result:
  success: boolean;
  duration_ms?: number;
}
```

## JSONL Event Format

Each line in the `-han.jsonl` file:

```json
{
  "id": "evt_abc123",
  "type": "hook_complete",
  "timestamp": "2025-01-15T10:30:00.123Z",
  "data": {
    "plugin": "jutsu-biome",
    "hook": "lint",
    "directory": "/path/to/project",
    "cached": false,
    "duration_ms": 1523,
    "exit_code": 0,
    "output": "Checked 42 files..."
  }
}
```

## Storage Strategy: Unified Messages Table

Han events are stored in the existing `messages` table rather than a separate table. This ensures:

- Consistent line numbering for pagination
- Single timeline query without UNION
- Simpler schema

For han_event messages:

- `message_type`: `'han_event'`
- `role`: `NULL`
- `content`: JSON string with full event data
- `tool_name`: Event subtype (e.g., `hook_start`, `mcp_tool_call`)

### Indexer Interleaving

The coordinator indexes both files and interleaves based on timestamp:

1. Read new lines from `{session-id}.jsonl` (Claude messages)
2. Read new lines from `{session-id}-han.jsonl` (Han events)
3. Sort all new entries by timestamp
4. Assign `line_number` sequentially (continuing from last indexed)
5. Insert into messages table

## Implementation Files

### New Files

- `lib/events/logger.ts` - Event logger with file append
- `lib/events/types.ts` - Event type definitions
- `lib/db/han-events.ts` - SQLite operations for events

### Modified Files

- `lib/commands/hook/dispatch.ts` - Log hook events
- `lib/commands/hook/run.ts` - Log individual hook executions
- `lib/commands/mcp/server.ts` - Log MCP tool calls
- `lib/commands/mcp/memory.ts` - Log memory operations
- `han-native/src/schema.sql` - Add han_events table
- `han-native/src/indexer.rs` - Index *-han.jsonl files
- `packages/browse-client/src/components/pages/SessionDetailPage/` - Display events

## API

### Event Logger

```typescript
// lib/events/logger.ts
export class EventLogger {
  constructor(sessionId: string, projectSlug: string);

  logHookStart(plugin: string, hook: string, directory: string, cached: boolean): void;
  logHookComplete(plugin: string, hook: string, directory: string, duration_ms: number, exit_code: number, output: string): void;
  logHookError(plugin: string, hook: string, directory: string, error: string): void;

  logMcpToolCall(tool: string, args: Record<string, unknown>): string;  // Returns event ID
  logMcpToolResult(eventId: string, success: boolean, duration_ms: number, result?: unknown, error?: string): void;

  logMemoryQuery(question: string, route: string, success: boolean, duration_ms: number): void;
  logMemoryLearn(domain: string, scope: string, success: boolean): void;
}

// Get logger for current session
export function getEventLogger(): EventLogger | null;
```

### GraphQL Schema Addition

```graphql
type HanEvent {
  id: ID!
  sessionId: ID!
  eventType: String!
  data: JSON
  timestamp: DateTime!
}

extend type Session {
  hanEvents(
    first: Int
    after: String
    eventType: String
  ): HanEventConnection!
}

type HanEventConnection {
  edges: [HanEventEdge!]!
  pageInfo: PageInfo!
  totalCount: Int!
}
```

## Browse UI Integration

### Session Detail Page

Add a "Han Activity" tab or interleave events in the message timeline:

```
┌─────────────────────────────────────────────────────────────────┐
│ Session: abc-123                                     ⚙️ Events   │
├─────────────────────────────────────────────────────────────────┤
│ 10:30:00  [User] Help me fix the linting errors                 │
│ 10:30:01  [Han] 🔧 Hook: jutsu-biome/lint started               │
│ 10:30:03  [Han] ✓ Hook: jutsu-biome/lint completed (2.3s)       │
│ 10:30:05  [Claude] I've run the linter...                       │
│ 10:30:10  [Han] 🔧 MCP: context7_resolve-library-id called      │
│ 10:30:12  [Han] ✓ MCP: context7_resolve-library-id (1.8s)       │
│ 10:30:15  [Claude] According to the React docs...               │
└─────────────────────────────────────────────────────────────────┘
```

### Event Detail Expansion

Clicking an event shows full details:

```
┌─────────────────────────────────────────────────────────────────┐
│ Hook: jutsu-biome/lint                                    ✓ OK  │
├─────────────────────────────────────────────────────────────────┤
│ Directory: /Users/john/project                                   │
│ Duration: 2,312ms                                               │
│ Exit Code: 0                                                    │
│ Cached: No                                                      │
├─────────────────────────────────────────────────────────────────┤
│ Output:                                                         │
│ ┌───────────────────────────────────────────────────────────┐  │
│ │ Checked 42 files in 2.31s                                 │  │
│ │ No errors found.                                          │  │
│ └───────────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────────┘
```

## Session ID Discovery

Events are tied to Claude Code sessions. Session ID is obtained from:

1. `HAN_SESSION_ID` environment variable (set by hook dispatch)
2. MCP server context (from stdin payload)
3. Fallback: Generate temporary ID (logged events may not link to session)

## Performance Considerations

- **Append-only writes**: Events are appended, never modified
- **Buffered writes**: Batch multiple events before fsync
- **Incremental indexing**: Same pattern as JSONL transcripts
- **Lazy loading**: Events loaded on demand in UI

## Configuration

```yaml
# han.yml
events:
  enabled: true        # Master switch (default: true)
  log_output: true     # Include command output (default: true, false saves space)
  max_output_length: 10000  # Truncate output (default: 10KB)
```

## Related

- [Coordinator Data Layer](./coordinator-data-layer.md) - Indexing pattern
- [Hook System](./hook-system.md) - Hook execution
- [MCP Server](./mcp-server.md) - MCP tool handling
- [Browse Architecture](./browse-architecture.md) - UI integration
