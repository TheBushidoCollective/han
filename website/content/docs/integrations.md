---
title: "MCP Integrations"
description: "Han provides an MCP server and integrates with external MCP servers."
---

Han uses the Model Context Protocol (MCP) to connect Claude Code to external services and provide built-in capabilities. MCP is an open standard for connecting AI assistants to data sources and tools.

## Han's Built-in MCP Server

Han provides its own MCP server that runs via `han mcp server` and exposes powerful built-in capabilities. When you install the core plugin, Han registers as an MCP server in Claude Code's configuration.

### How It Works

The Han MCP server is automatically configured:

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

The server implements MCP protocol version 2024-11-05 and exposes tools in four categories:

### 1. Plugin Hook Tools (Dynamic)

Every hook defined in an installed plugin automatically becomes an MCP tool. When you install `jutsu-typescript`, Claude immediately gains access to a `jutsu_typescript_typecheck` tool.

Example from `jutsu-bun/han-plugin.yml`:

```yaml
hooks:
  test:
    command: bun test --only-failures
    dirsWith: [bun.lock, bun.lockb]
    description: Run Bun tests
```

This becomes an MCP tool:

```javascript
{
  name: "jutsu_bun_test",
  description: "Run Bun tests. Triggers: 'run the tests'...",
  inputSchema: {
    type: "object",
    properties: {
      cache: { type: "boolean" },
      directory: { type: "string" },
      verbose: { type: "boolean" }
    }
  }
}
```

All plugin hooks support three standard parameters:

| Parameter | Default | Purpose |
|-----------|---------|---------|
| `cache` | `true` | Skip if files unchanged since last run |
| `directory` | all | Target specific directory |
| `verbose` | `false` | Stream output in real-time |

### 2. Memory Tools (Self-Learning)

Han's memory system lets Claude write to `.claude/rules/` to capture project knowledge.

**`learn`** - Capture project knowledge:

```javascript
learn({
  content: "# API Rules\n\n- Validate all inputs with zod",
  domain: "api",
  paths: ["src/api/**/*.ts"],  // Optional: path-specific rules
  scope: "project",  // or "user" for personal preferences
  append: true  // Add to existing file
})
```

**`memory_list`** - See existing domains:

```javascript
memory_list({ scope: "project" })
// Returns: ["api", "testing", "commands"]
```

**`memory_read`** - Read domain content:

```javascript
memory_read({ domain: "api", scope: "project" })
```

Memory scopes:

| Scope | Location | Purpose |
|-------|----------|---------|
| `project` | `.claude/rules/` | Team knowledge, git-tracked |
| `user` | `~/.claude/rules/` | Personal preferences |

### 3. Metrics Tools (Self-Awareness)

Task tracking with confidence calibration. See [Local Metrics](/docs/metrics) for details.

**`start_task`** - Begin tracking:

```javascript
start_task({
  description: "Fix authentication timeout bug",
  type: "fix",
  estimated_complexity: "moderate"
})
```

**`complete_task`** - Record outcome:

```javascript
complete_task({
  task_id: "task_abc123",
  outcome: "success",
  confidence: 0.85,
  files_modified: ["src/auth/session.ts"]
})
```

**`query_metrics`** - Analyze performance:

```javascript
query_metrics({
  period: "week",
  task_type: "fix"
})
```

### 4. Checkpoint Tools (Smart Caching)

Track file changes since last hook run for intelligent caching.

**`checkpoint_list`** - See existing checkpoints
**`checkpoint_clean`** - Remove stale checkpoints

## External MCP Servers (Hashi Plugins)

Han's "hashi" (bridge) plugins connect Claude to external services via MCP. Each hashi plugin provides tools for interacting with a specific service, with Han managing how those tools are exposed to Claude Code.

### Dual-Mode Architecture

Han uses a **dual-mode architecture** for hashi plugins that optimizes context usage:

| Mode | When Active | Behavior |
|------|-------------|----------|
| **Orchestrator** (default) | `orchestrator.enabled: true` | Han manages all tools centrally. Hashi MCP servers return no tools—Han's orchestrator exposes a unified workflow interface. |
| **Direct** | `orchestrator.enabled: false` | Each hashi plugin proxies directly to its MCP server, exposing all tools individually. |

**Why this matters:**

- **Orchestrator mode** reduces context overhead by exposing ~5 tools instead of 50+ from multiple backends
- **Direct mode** gives you full access to individual MCP tools when needed
- Switch between modes via `han.yml` configuration

### How It Works

When you install a hashi plugin, it registers an MCP server that routes through Han:

```json
{
  "mcpServers": {
    "github": {
      "command": "han",
      "args": ["mcp", "hashi-github", "github"]
    }
  }
}
```

Han then decides what to expose based on orchestrator configuration:

- **Orchestrator enabled**: Returns a stub MCP with no tools. Han's main MCP server provides a `han_workflow` tool that can invoke any backend capability.
- **Orchestrator disabled**: Proxies to the actual MCP server (e.g., GitHub's official MCP), exposing all its tools directly.

### Available Hashi Plugins

- **hashi-github** - GitHub Issues, PRs, Actions, Code Search
- **hashi-jira** - Jira tickets, sprints, workflows
- **hashi-playwright-mcp** - Browser automation and testing
- **hashi-linear** - Linear issues and project management
- **hashi-sentry** - Error tracking and performance monitoring
- **hashi-figma** - Design-to-code workflows
- **hashi-gitlab** - GitLab integration
- **hashi-blueprints** - Technical documentation management

### Installing External MCP Servers

Install a hashi plugin to add its MCP server:

```bash
# Install GitHub integration
han plugin install hashi-github
```

This adds the MCP server to your Claude Code configuration, routing through Han:

```json
{
  "mcpServers": {
    "github": {
      "command": "han",
      "args": ["mcp", "hashi-github", "github"]
    }
  }
}
```

### Configuring the Orchestrator

Control orchestrator behavior in `han.yml`:

```yaml
# Enable orchestrator (default) - Han manages all tools
orchestrator:
  enabled: true
  workflow:
    enabled: true
    max_steps: 20
    timeout: 300

# Or disable to use direct MCP access
orchestrator:
  enabled: false
```

### How MCP Tools Appear in Claude Code

Once installed, MCP tools are available to Claude automatically. You can simply ask Claude to use them:

**Examples:**

```text
"Create an issue for the bug we just found"
"List all open PRs that need review"
"Search for usages of the deprecated function"
"Run the tests"
"Take a screenshot of the login page"
```

Claude will use the appropriate MCP tool (`create_issue`, `list_pull_requests`, `search_code`, `jutsu_bun_test`, `browser_take_screenshot`, etc.) based on your request.

### Real Example: GitHub Integration

After installing hashi-github, Claude can:

**Search code across repos:**

```javascript
const results = await mcp.tools.search_code({
  query: 'useDeprecatedAPI language:typescript',
  owner: 'myorg'
})
```

**Create issues with context:**

```javascript
await mcp.tools.create_issue({
  owner: 'myorg',
  repo: 'myrepo',
  title: 'Memory leak in useEventListener hook',
  body: '## Description\nFound memory leak...',
  labels: ['bug', 'priority:high']
})
```

**Review pull requests:**

```javascript
const diff = await mcp.tools.get_pull_request_diff({
  owner: 'myorg',
  repo: 'myrepo',
  pullNumber: 123
})
```

## Security Considerations

MCP servers can access sensitive data. Han follows these principles:

1. **Token isolation** - Environment variables, never hardcoded
2. **Least privilege** - Only request necessary scopes
3. **Local execution** - Servers run on your machine, not in the cloud
4. **Audit trail** - All MCP calls are logged

## Performance

MCP calls are asynchronous and don't block Claude's reasoning:

```javascript
// Claude can make multiple MCP calls in parallel
const [issues, prs, actions] = await Promise.all([
  github.list_issues({ state: 'open' }),
  github.list_pull_requests({ state: 'open' }),
  github.get_workflow_runs({ branch: 'main' })
])
```

## Getting Started

Start with GitHub integration:

```bash
# Set your token
export GITHUB_TOKEN=ghp_your_token_here

# Install the plugin
han plugin install hashi-github

# Ask Claude to help with GitHub tasks
```

Then try:

- "Create an issue for the bug we just found"
- "List all open PRs that need review"
- "Search for usages of the deprecated function"

Claude handles the API calls, authentication, and data formatting. You just describe what you want.

## Learn More

- [Local Metrics](/docs/metrics) - Built-in task tracking and calibration
- [Plugin Marketplace](/plugins) - Browse all available plugins
- [MCP Documentation](https://modelcontextprotocol.io) - Official MCP specification
