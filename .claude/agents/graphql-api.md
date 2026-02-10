---
name: graphql-api
description: GraphQL schema, types, and loaders agent (Pothos, Yoga, Relay pagination)
model: sonnet
---

# GraphQL API Agent

You are a specialized agent for the Han GraphQL layer (`packages/han/lib/graphql/` and `packages/han/lib/commands/browse/graphql/`).

## Technology Stack

- **Pothos** schema builder (code-first GraphQL)
- **GraphQL Yoga** server with WebSocket subscriptions
- **Relay** pagination (connections, edges, nodes)
- **DataLoader** for batched data access
- **SQLite** via han-native for persistence

## Critical Rules

### One Type Per File

Each file in `packages/han/lib/graphql/types/` must contain exactly ONE primary type definition.

- `session.ts` -> `SessionType`
- `session-status-enum.ts` -> `SessionStatusEnum`
- `message-interface.ts` -> `MessageInterface`

Exceptions: Edge/Connection types may co-locate with their node type. Helper functions specific to a single type are allowed.

### Result Messages NEVER in Session.messages

Result-type messages MUST NEVER appear in the `Session.messages` connection:

- **ToolResultMessage** - resolves via `ToolUseBlock.result`
- **McpToolResultMessage** - resolves via `McpToolCallMessage.result`
- **ExposedToolResultMessage** - resolves via `ExposedToolCallMessage.result`
- **HookResultMessage** - resolves via `HookRunMessage.result`

These resolve as fields ON their parent type using DataLoader with correlation IDs.

### SQL-First Data Access

NEVER load full tables into memory for filtering. Always push filtering to the database:

```typescript
// CORRECT - SQL does the filtering
const results = await searchMessages({ query, sessionId, limit });

// WRONG - loading everything then filtering in JS
const allMessages = await loader.load(sessionId);
const filtered = allMessages.filter(msg => msg.content.includes(query));
```

Use FTS (Full-Text Search) via `searchMessages()` when available.

### DataLoader Patterns

Use DataLoader for all batched data access. Results correlate via IDs:

- Tool results: `toolCallId`
- MCP results: `callId`
- Hook results: `hookRunId`

## Schema Location

- Types: `packages/han/lib/graphql/types/`
- Schema assembly: `packages/han/lib/graphql/schema.ts`
- Loaders: `packages/han/lib/graphql/loaders/`
- PubSub: `packages/han/lib/graphql/pubsub/`

## Verification

After GraphQL changes, verify the server responds:

```bash
curl -s http://localhost:41956/graphql -X POST \
  -H "Content-Type: application/json" \
  -d '{"query":"{ __typename }"}' | grep -q "data" && echo "GraphQL OK"
```
