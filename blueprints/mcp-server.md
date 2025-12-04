# MCP Server

Model Context Protocol server exposing plugin hooks as tools.

## Overview

The Han MCP server implements the Model Context Protocol (MCP) over JSON-RPC 2.0, exposing plugin hooks as callable tools for Claude Code agent interactions. This allows the agent to invoke validation hooks, linters, and other plugin functionality.

## Architecture

### Protocol

- **Transport:** stdio (stdin/stdout)
- **Protocol:** JSON-RPC 2.0
- **MCP Version:** 2024-11-05

### Components

```
stdin (JSON-RPC requests)
    ↓
server.ts (request handler)
    ↓
tools.ts (tool discovery)
    ↓
validate.ts (execution)
    ↓
stdout (JSON-RPC responses)
```

## API / Interface

### MCP Methods

#### `initialize`

Returns server capabilities.

**Response:**

```json
{
  "protocolVersion": "2024-11-05",
  "capabilities": { "tools": {} },
  "serverInfo": { "name": "han", "version": "1.0.0" }
}
```

#### `initialized`

Notification that initialization is complete. No response body.

#### `ping`

Health check endpoint.

**Response:** `{}`

#### `tools/list`

Returns available tools discovered from installed plugins.

**Response:**

```json
{
  "tools": [
    {
      "name": "jutsu_typescript_lint",
      "description": "Lint TypeScript code...",
      "annotations": {
        "title": "Lint Typescript",
        "readOnlyHint": false,
        "destructiveHint": false,
        "idempotentHint": true,
        "openWorldHint": false
      },
      "inputSchema": {
        "type": "object",
        "properties": {
          "verbose": { "type": "boolean" },
          "failFast": { "type": "boolean" },
          "directory": { "type": "string" }
        }
      }
    }
  ]
}
```

#### `tools/call`

Execute a tool.

**Request:**

```json
{
  "name": "jutsu_typescript_lint",
  "arguments": {
    "verbose": false,
    "failFast": true,
    "directory": "packages/core"
  }
}
```

**Response:**

```json
{
  "content": [{ "type": "text", "text": "✅ All files passed" }],
  "isError": false
}
```

### Tool Schema

**Input Properties:**

- `verbose` (boolean) - Show full output in real-time
- `failFast` (boolean) - Stop on first failure (default: true)
- `directory` (string) - Limit to specific directory path

### Tool Annotations

```typescript
{
  title: "Lint TypeScript",      // Human-readable title
  readOnlyHint: false,           // May modify files
  destructiveHint: false,        // Not destructive
  idempotentHint: true,          // Safe to re-run
  openWorldHint: false           // Local files only
}
```

## Behavior

### Tool Discovery

1. Get merged plugins and marketplaces from settings
2. For each enabled plugin:
   a. Find plugin directory
   b. Load `han-config.json`
   c. Create tool for each hook
3. Cache discovered tools for session

**Tool Naming:**

- Format: `{pluginName}_{hookName}`
- Dashes replaced with underscores
- Example: `jutsu-typescript` + `lint` → `jutsu_typescript_lint`

### Tool Description Generation

Descriptions include natural language triggers:

```
Run TypeScript tests. Triggers: "run the tests", "run typescript tests",
"check if tests pass", "execute test suite".
Runs in directories containing: package.json.
Command: npm test
```

### Execution

1. Find tool by name in discovered tools
2. Extract parameters (verbose, failFast, directory)
3. Set `CLAUDE_PLUGIN_ROOT` environment variable
4. Execute via `runConfiguredHook()`
5. Capture output via console interception
6. Return result with success flag

### Output Capture

```typescript
// Console output captured
console.log = (...args) => {
  outputLines.push(args.join(" "));
  if (verbose) originalLog.apply(console, args);
};
```

## Files

- `lib/commands/mcp/index.ts` - Command registration
- `lib/commands/mcp/server.ts` - JSON-RPC server implementation
- `lib/commands/mcp/tools.ts` - Tool discovery and execution
- `lib/validate.ts` - Hook execution

## Related Systems

- [Hook System](./hook-system.md) - Hook definitions and execution
- [Settings Management](./settings-management.md) - Plugin discovery
