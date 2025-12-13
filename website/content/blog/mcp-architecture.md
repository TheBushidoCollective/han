---
title: "Understanding Han's MCP Architecture: Bridges to the World"
description: "Deep dive into how Han uses the Model Context Protocol to connect Claude Code to external services like GitHub, Jira, and custom tools."
date: "2024-12-01"
author: "Jason Waldrip"
tags: ["mcp", "architecture", "integration", "github"]
category: "Technical Deep Dive"
---

Model Context Protocol (MCP) is the secret sauce that makes Han plugins so powerful. Let's explore how Han uses MCP to turn Claude Code into a universal development environment.

## What is MCP?

Model Context Protocol is an open standard for connecting AI assistants to external data sources and tools. Think of it as APIs for AI - a standardized way for Claude to interact with the world beyond its training data.

## Han's "Hashi" (Bridge) Plugins

In Han's architecture, plugins starting with `hashi-` are "bridges" - MCP servers that connect Claude to external services:

- `hashi-github`: GitHub Issues, PRs, Actions, Code Search
- `hashi-jira`: Jira tickets, sprints, workflows
- `hashi-playwright-mcp`: Browser automation and testing
- `hashi-linear`: Linear issues and project management
- `hashi-sentry`: Error tracking and performance monitoring

## Real Example: GitHub Integration

Let's see how the GitHub MCP server works in practice.

### Installation

```bash
han plugin install hashi-github
```

This adds an MCP server to your Claude Code configuration:

```json
{
  "mcpServers": {
    "github": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-github"],
      "env": {
        "GITHUB_PERSONAL_ACCESS_TOKEN": "${GITHUB_TOKEN}"
      }
    }
  }
}
```

### What It Unlocks

Now Claude can natively:

**Search code across repos**

```text
Find all usages of the deprecated API endpoint
```

Claude uses `search_code` tool:

```typescript
const results = await mcp.tools.search_code({
  query: 'useDeprecatedAPI language:typescript',
  owner: 'myorg'
})
```

**Create and update issues**

```text
Create an issue for the memory leak in the event handler
```

Claude uses `create_issue` tool with all the context:

```typescript
await mcp.tools.create_issue({
  owner: 'myorg',
  repo: 'myrepo',
  title: 'Memory leak in useEventListener hook',
  body: `## Description
Found memory leak in \`src/hooks/useEventListener.ts\`...

## Reproduction
1. Navigate to dashboard
2. Click task 10 times
3. Check memory profiler

## Fix
Add cleanup in useEffect return...`,
  labels: ['bug', 'priority:high']
})
```

**Review pull requests**

```text
Review PR #123 and provide feedback
```

Claude fetches the PR, analyzes the diff, checks for issues:

```typescript
const pr = await mcp.tools.get_pull_request({
  owner: 'myorg',
  repo: 'myrepo',
  pullNumber: 123
})

const diff = await mcp.tools.get_pull_request_diff({
  owner: 'myorg',
  repo: 'myrepo',
  pullNumber: 123
})

// Claude analyzes and adds review comments
await mcp.tools.add_review_comment({
  owner: 'myorg',
  repo: 'myrepo',
  pullNumber: 123,
  path: 'src/api.ts',
  line: 42,
  body: 'This could cause a race condition. Consider using a mutex.'
})
```

## Building Custom MCP Servers

Want to connect Claude to your internal tools? Create a custom hashi plugin.

### Example: Slack MCP Server

```typescript
// hashi-slack/server/tools.ts
import { McpServer } from '@modelcontextprotocol/sdk'

export const slackServer = new McpServer({
  name: 'slack',
  version: '1.0.0'
})

slackServer.tool('send_message', {
  description: 'Send a message to a Slack channel',
  parameters: {
    channel: { type: 'string', required: true },
    message: { type: 'string', required: true }
  },
  async execute({ channel, message }) {
    await slackClient.chat.postMessage({
      channel,
      text: message
    })
    return { success: true }
  }
})

slackServer.tool('search_messages', {
  description: 'Search Slack messages',
  parameters: {
    query: { type: 'string', required: true }
  },
  async execute({ query }) {
    const results = await slackClient.search.messages({ query })
    return results
  }
})
```

### Plugin Configuration

```json
{
  "name": "hashi-slack",
  "mcpServers": {
    "slack": {
      "command": "npx",
      "args": ["-y", "@myorg/han", "mcp", "slack"],
      "env": {
        "SLACK_TOKEN": "${SLACK_TOKEN}"
      }
    }
  }
}
```

Now Claude can:

```
Check Slack for any mentions of the production issue
```

```
Post to #engineering that the hotfix is deployed
```

## MCP Server Patterns

### 1. HTTP OAuth Servers

For cloud services with OAuth:

```json
{
  "mcpServers": {
    "sentry": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-sentry"],
      "env": {
        "SENTRY_AUTH_TOKEN": "${SENTRY_AUTH_TOKEN}",
        "SENTRY_ORG": "my-org"
      }
    }
  }
}
```

### 2. Local CLI Wrappers

For local tools:

```json
{
  "mcpServers": {
    "docker": {
      "command": "npx",
      "args": ["-y", "@myorg/mcp-docker"],
      "env": {}
    }
  }
}
```

### 3. Database Connections

For direct database access:

```json
{
  "mcpServers": {
    "postgres": {
      "command": "npx",
      "args": ["-y", "@modelcontextprotocol/server-postgres"],
      "env": {
        "DATABASE_URL": "${DATABASE_URL}"
      }
    }
  }
}
```

## Security Considerations

MCP servers can access sensitive data. Han follows these principles:

1. **Token isolation**: Environment variables, never hardcoded
2. **Least privilege**: Only request necessary scopes
3. **Local execution**: Servers run on your machine, not in the cloud
4. **Audit trail**: All MCP calls are logged

## Performance

MCP calls are asynchronous and don't block Claude's reasoning:

```typescript
// Claude can make multiple MCP calls in parallel
const [issues, prs, actions] = await Promise.all([
  github.list_issues({ state: 'open' }),
  github.list_pull_requests({ state: 'open' }),
  github.get_workflow_runs({ branch: 'main' })
])
```

## Han's Core MCP Server

Beyond external integrations, Han provides its own MCP server that exposes powerful built-in capabilities. This is where Han differs from simple plugin installers. The core MCP server runs via `han mcp server` and communicates over JSON-RPC via stdio.

### How It Works

When you install the core plugin, Han registers as an MCP server in Claude Code's configuration:

```json
{
  "mcpServers": {
    "han": {
      "command": "han",
      "args": ["mcp", "server"]
    }
  }
}
```

The server implements the MCP protocol (version 2024-11-05) and exposes tools in four categories:

1. **Plugin Hook Tools** - Dynamically generated from installed plugins
2. **Memory Tools** - Self-learning project rules
3. **Metrics Tools** - Task tracking and calibration
4. **Checkpoint Tools** - Session-scoped caching

### Plugin Hook Tools (Dynamic)

This is Han's key innovation: every hook defined in an installed plugin automatically becomes an MCP tool. When you install `jutsu-typescript`, Claude immediately gains access to a `jutsu_typescript_typecheck` tool.

The MCP server discovers these at runtime by scanning installed plugins:

```javascript
// From jutsu-bun/han-plugin.yml
hooks:
  test:
    command: bun test --only-failures
    dirsWith: [bun.lock, bun.lockb]
    description: Run Bun tests

// Becomes MCP tool:
{
  name: "jutsu_bun_test",
  description: "Run Bun tests. Triggers: 'run the tests', 'run bun tests',
    'check if tests pass'. Runs in directories containing: bun.lock,
    bun.lockb. Command: bun test --only-failures",
  inputSchema: {
    type: "object",
    properties: {
      cache: {
        type: "boolean",
        description: "Use cached results when files haven't changed"
      },
      directory: {
        type: "string",
        description: "Limit execution to a specific directory path"
      },
      verbose: {
        type: "boolean",
        description: "Show full command output in real-time"
      }
    }
  }
}
```

When Claude says "run the tests", it can now call this tool directly:

```javascript
// Claude calls:
await mcp.tools.jutsu_bun_test({ cache: true })

// Returns:
{
  content: [{ type: "text", text: "15 pass\n0 fail\n..." }]
}
```

All plugin hooks support three standard parameters:

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `cache` | `true` | Skip if files unchanged since last run |
| `directory` | all | Target specific directory |
| `verbose` | `false` | Stream output in real-time |

### Memory Tools (Self-Learning)

Han's memory system lets Claude write directly to `.claude/rules/`. Claude can teach itself about your project without asking permission.

**`learn`** - Capture project knowledge

```javascript
learn({
  content: "# API Rules\n\n- Validate all inputs with zod\n- Return
    consistent error format",
  domain: "api",
  paths: ["src/api/**/*.ts"],  // Optional: path-specific rules
  scope: "project",  // or "user" for personal preferences
  append: true  // Add to existing file
})
```

Creates `.claude/rules/api.md` with YAML frontmatter for path restrictions:

```markdown
---
globs: ["src/api/**/*.ts"]
---

# API Rules

- Validate all inputs with zod
- Return consistent error format
```

**`memory_list`** - See existing domains

```javascript
memory_list({ scope: "project" })
// Returns: ["api", "testing", "commands"]
```

**`memory_read`** - Read domain content

```javascript
memory_read({ domain: "api", scope: "project" })
// Returns the full markdown content
```

The memory system supports two scopes:

| Scope | Location | Purpose |
|-------|----------|---------|
| `project` | `.claude/rules/` | Team knowledge, git-tracked |
| `user` | `~/.claude/rules/` | Personal preferences |

### Metrics Tools (Self-Awareness)

Task tracking with confidence calibration. Claude records its work and estimates confidence, then compares against actual outcomes.

**`start_task`** - Begin tracking

```javascript
start_task({
  description: "Fix authentication timeout bug",
  type: "fix",  // implementation, fix, refactor, research
  estimated_complexity: "moderate"  // simple, moderate, complex
})
// Returns: { task_id: "task_abc123" }
```

**`update_task`** - Log progress

```javascript
update_task({
  task_id: "task_abc123",
  notes: "Found root cause - session expiry not refreshing"
})
```

**`complete_task`** - Record outcome

```javascript
complete_task({
  task_id: "task_abc123",
  outcome: "success",  // success, partial, failure
  confidence: 0.85,  // 0.0 to 1.0
  files_modified: ["src/auth/session.ts"],
  tests_added: 2
})
```

**`fail_task`** - Record failure with context

```javascript
fail_task({
  task_id: "task_abc123",
  reason: "Requires database migration that needs approval",
  attempted_solutions: [
    "Tried updating schema in-place",
    "Attempted backwards-compatible approach"
  ]
})
```

**`query_metrics`** - Analyze performance

```javascript
query_metrics({
  period: "week",  // day, week, month
  task_type: "fix",  // Optional filter
  outcome: "success"  // Optional filter
})
// Returns aggregated stats, success rates, calibration scores
```

All metrics are stored locally in `~/.claude/han/metrics/` as JSONL files. Nothing leaves your machine.

### Checkpoint Tools (Smart Caching)

Checkpoints track which files have changed since the last hook run, enabling intelligent caching.

**`checkpoint_list`** - See existing checkpoints

```javascript
checkpoint_list()
// Shows session and agent checkpoints with file counts
```

**`checkpoint_clean`** - Remove stale checkpoints

```javascript
checkpoint_clean({ maxAge: 24 })  // Hours
// Removes checkpoints older than 24 hours
```

Checkpoints are created automatically when hooks run with `cache=true`. Each checkpoint records file modification times, so subsequent runs can skip unchanged files.

### Tool Annotations

All Han MCP tools include MCP annotations for better AI behavior:

```javascript
{
  name: "learn",
  annotations: {
    title: "Learn",
    readOnlyHint: false,     // May modify files
    destructiveHint: false,  // Safe operation
    idempotentHint: true,    // Same input = same result
    openWorldHint: false     // Works with local files only
  }
}
```

### Blueprint Tools (via hashi-blueprints)

When the hashi-blueprints plugin is installed, additional MCP tools become available:

```javascript
search_blueprints({ keyword: "api" })
read_blueprint({ name: "cli-architecture" })
write_blueprint({
  name: "auth-system",
  summary: "Authentication and authorization architecture",
  content: "# Auth System\n\n## Overview..."
})
```

### Debugging the MCP Server

Run the MCP server manually to test:

```bash
# Start server in stdio mode
han mcp server

# Send a tools/list request
echo '{"jsonrpc":"2.0","id":1,"method":"tools/list"}' | han mcp server
```

Set timeouts via environment variable:

```bash
export HAN_MCP_TIMEOUT=600000  # 10 minutes (default)
```

## Available Hashi Plugins

Current MCP bridges in Han marketplace:

- **hashi-github**: GitHub platform integration
- **hashi-jira**: Atlassian Jira integration
- **hashi-linear**: Linear project management
- **hashi-playwright-mcp**: Browser automation
- **hashi-sentry**: Error tracking and monitoring
- **hashi-figma**: Design-to-code workflows
- **hashi-gitlab**: GitLab integration
- **hashi-blueprints**: Technical documentation management

## What's Next?

We're working on:

- **hashi-aws**: AWS resource management
- **hashi-vercel**: Deployment and preview URLs
- **hashi-stripe**: Payment and billing integration
- **hashi-notion**: Documentation and knowledge base

## Try It

Start with GitHub integration:

```bash
# Set your token
export GITHUB_TOKEN=ghp_your_token_here

# Install the plugin
han plugin install hashi-github

# Ask Claude to help with GitHub tasks
claude
```

Then try:

- "Create an issue for the bug we just found"
- "List all open PRs that need review"
- "Search for usages of the deprecated function"
- "Add review comments to PR #456"

Claude handles the API calls, authentication, and data formatting. You just describe what you want.

## Conclusion

MCP is the bridge between AI and the real world. Han's hashi plugins make that bridge easy to cross, turning Claude Code into a universal interface for your entire development workflow.

---

*Want to build your own MCP server? Check out the [MCP Documentation](/docs#mcp-server) or explore existing [hashi plugins](/plugins?category=hashi).*
