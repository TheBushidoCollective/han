# Message Types - Timeline Display Rules

## All Messages Appear Chronologically in Timeline

All message types — including result messages — appear in the `Session.messages` connection in chronological order. This gives users a complete view of what happened during a session.

Result messages include:
1. **ToolResultUserMessage** - User messages containing tool_result content blocks
2. **McpToolResultMessage** - Response to McpToolCallMessage (linked via `callId`)
3. **ExposedToolResultMessage** - Response to ExposedToolCallMessage (linked via `callId`)
4. **HookResultMessage** - Response to HookRunMessage (linked via `hookRunId`)
5. **SentimentAnalysisMessage** - Sentiment analysis of user messages

## Dual Access Pattern

Result messages are accessible in two ways:

1. **In the timeline** — shown chronologically with subway line connectors linking them visually to their parent messages
2. **As fields on parent types** — e.g., `ToolUseBlock.result`, `HookRunMessage.result`, `McpToolCallMessage.result` for convenient inline access without scrolling

```graphql
type ToolUseBlock {
  toolCallId: String!
  name: String!
  input: String!
  # Also accessible inline on the parent
  result: ToolResultBlock
}
```

## Subway Line Visual Connectors

Parent-child message pairs are connected with colored vertical lines (subway lines) on the left margin. The `parentId` field on messages identifies the relationship. Colors are consistent per group (hashed from parent ID).

## Chat Alignment

Messages use left/right alignment based on type:

**Right-aligned (user input):**
- `RegularUserMessage` — real human input
- `CommandUserMessage` — slash commands
- `InterruptUserMessage` — user interruptions

**Left-aligned (agent/system):**
- All other message types (assistant, system, hooks, tools, results, etc.)

## Anti-Pattern (NEVER DO THIS)

```typescript
// Passing results as props - use GraphQL fields instead
<MessageCard toolResultsMap={toolResultsMap} />
```

## Testing Requirements

BDD tests MUST verify:
- Result messages appear in the timeline with subway lines
- No "Unknown event" cards for known types
- User messages are right-aligned, agent messages are left-aligned
