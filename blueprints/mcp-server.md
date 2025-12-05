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

## External MCP Integrations

In addition to Han's own MCP server (`hashi-han`), Han provides several hashi plugins that integrate with external MCP servers:

### hashi-figma

**Purpose:** Design-to-code workflow integration

**Transport:** HTTP (local Figma Desktop app at `http://127.0.0.1:3845/mcp`)

**Capabilities:**

- Frame-to-code generation (React, Vue, HTML/CSS)
- Design token extraction
- Component library sync
- Implementation guidance from designs

**Slash Commands:**

- `/figma:generate-component` - Convert Figma frames to production code
- `/figma:extract-tokens` - Extract design tokens (colors, typography, spacing)
- `/figma:sync-design-system` - Sync component library
- `/figma:analyze-frame` - Get implementation guidance

**Authentication:** Zero-config (Figma Desktop handles authentication)

### hashi-sentry

**Purpose:** Production observability and error tracking

**Transport:** Remote HTTP OAuth (`https://mcp.sentry.dev/mcp`)

**Capabilities:**

- Error investigation and triage
- Performance analysis
- Release health monitoring
- Incident response with Seer AI integration
- Custom event queries

**Slash Commands:**

- `/investigate-errors` - Triage and analyze production errors
- `/analyze-performance` - Debug performance regressions
- `/check-releases` - Monitor release health metrics
- `/incident-response` - Coordinated incident handling
- `/query-events` - Custom event queries

**Authentication:** OAuth flow via Sentry

### hashi-han-metrics

**Purpose:** Agent performance tracking and calibration

**Transport:** STDIO (local subprocess)

**Capabilities:**

- Self-reporting task tracking
- Objective validation via hooks
- Calibration metrics
- Success rate analysis
- Confidence assessment

**MCP Tools:**

- `start_task` - Begin tracking a task
- `update_task` - Log progress
- `complete_task` - Mark complete with confidence
- `fail_task` - Record failure with details
- `query_metrics` - Query performance analytics

**Hooks:**

- SessionStart: Inject tracking instructions
- Stop: Validate self-assessments against hook results

**Storage:** Local SQLite at `~/.claude/metrics/metrics.db`

## MCP Server Categories

Han supports two categories of MCP servers:

### 1. Hook Execution (hashi-han)

Exposes Han plugin hooks as MCP tools for natural language execution. Dynamically discovers tools based on installed plugins.

**Use Case:** "Run the TypeScript tests" → calls `jutsu_typescript_test` tool

### 2. External Integrations (hashi-*)

Bridges Claude Code with external services and tools via their official MCP servers.

**Use Cases:**

- Design → Code (hashi-figma)
- Production Monitoring (hashi-sentry)
- Performance Tracking (hashi-han-metrics)
- GitHub Operations (hashi-github)
- Project Management (hashi-linear, hashi-jira, hashi-clickup)

## Related Systems

- [Hook System](./hook-system.md) - Hook definitions and execution
- [Settings Management](./settings-management.md) - Plugin discovery
- [Metrics System](./metrics-system.md) - Performance tracking via hashi-han-metrics
- [SDLC Coverage](./sdlc-coverage.md) - MCP integrations across SDLC phases
