# MCP Server Environment

MCP servers run as separate processes and do NOT have access to Claude Code environment variables like `CLAUDE_SESSION_ID`.

## Key Points

- MCP servers are spawned as child processes by Claude Code
- They do NOT inherit Claude Code's environment context
- Session IDs, project paths, and other context must be passed via tool call arguments
- Never assume `process.env.CLAUDE_SESSION_ID` is available in MCP server code

## Correct Pattern

```typescript
// In MCP tool schema - require session_id as parameter
inputSchema: {
  properties: {
    session_id: {
      type: "string",
      description: "Claude session ID (required). Pass the value of CLAUDE_SESSION_ID from your session.",
    },
  },
  required: ["session_id"],
}

// In handler - get from args only
const sessionId = args.session_id as string;
```

## Wrong Pattern

```typescript
// WRONG - environment variable not available in MCP
const sessionId = process.env.CLAUDE_SESSION_ID;
```
