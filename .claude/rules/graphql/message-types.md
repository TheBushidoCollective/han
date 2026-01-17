# Message Types - Critical Rules

## NEVER Include Result Messages in Session.messages Connection

**RULE: Result-type messages (messages that are follow-ups/responses to other messages) MUST NEVER appear in the `Session.messages` connection.**

Result messages include:
1. **ToolResultMessage** - Response to ToolUseBlock (linked via `toolCallId`)
2. **McpToolResultMessage** - Response to McpToolCallMessage (linked via `callId`)
3. **ExposedToolResultMessage** - Response to ExposedToolCallMessage (linked via `callId`)
4. **HookResultMessage** - Response to HookRunMessage (linked via `hookRunId`)
5. **Any message whose purpose is to respond to a parent message**

These result types MUST be:
- Resolved as fields ON their parent type (e.g., `ToolUseBlock.result`, `HookRunMessage.result`)
- Loaded via DataLoader using their correlation ID
- NEVER shown as separate messages in the timeline
- NEVER returned from the messages connection

## Correct Pattern

```graphql
type ToolUseBlock {
  toolCallId: String!
  name: String!
  input: String!
  # Result resolved via DataLoader using toolCallId
  result: ToolResultBlock
}
```

## Anti-Pattern (NEVER DO THIS)

```typescript
// Passing results as props - use GraphQL fields instead
<MessageCard toolResultsMap={toolResultsMap} />
```

## Testing Requirements

BDD tests MUST verify:
- Tool result messages don't appear in messages timeline
- Result counts match tool use counts
- No "Unknown event" cards for known types
