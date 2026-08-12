---
title: "MCP Integrations"
description: "Han provides an MCP server and integrates with external MCP servers."
---

Han uses the Model Context Protocol (MCP) to connect Claude Code to external services and provide built-in capabilities. MCP is an open standard for connecting AI assistants to data sources and tools.

## Han's Built-in MCP Server

Han provides its own MCP server, started with `han mcp`, which exposes built-in capabilities. When you install the core plugin, Han registers as an MCP server in Claude Code's configuration.

### How It Works

The Han MCP server is automatically configured:

```json
{
  "mcpServers": {
    "han": {
      "command": "han",
      "args": ["mcp"]
    }
  }
}
```

The server implements MCP protocol version 2024-11-05.

### What It Exposes

The main `han mcp` server exposes a deliberately small surface:

| Tool | Purpose |
|------|---------|
| `memory` | Query memory with auto-routing across personal sessions, team knowledge, and project conventions |

That is the server's only tool of its own. It takes a `question` string and an optional `session_id`, and routes the question to the right memory layer itself, so there is no separate tool per layer:

```javascript
memory({ question: "what was I working on?" })
memory({ question: "who knows about authentication?" })
memory({ question: "how do we handle errors?" })
```

`memory` disappears from the tool list when `memory.enabled` is `false` in `han.yml`.

### Re-exposed Backend Tools

Beyond its own tool, `han mcp` re-exposes the tools of any installed plugin whose MCP server sets `expose: true`. Those arrive prefixed with the server name, so `context7`'s `resolve-library-id` becomes `context7_resolve-library-id`, and their descriptions are tagged with the originating server.

This is how a single `han` entry in `mcpServers` can front several backends without you registering each one.

## Specialized MCP Servers

Two further servers ship alongside the main one and are started explicitly.

### `han mcp blueprints`

Technical blueprint documentation management.

| Tool | Purpose |
|------|---------|
| `list_blueprints` | List every blueprint in the repository with summaries |
| `search_blueprints` | Filter blueprints by keyword, to avoid duplicating an existing one |
| `read_blueprint` | Read one blueprint's full markdown content |
| `write_blueprint` | Create or update a blueprint, managing frontmatter automatically |

### `han mcp memory`

The read-only Memory Data Access Layer, for agents that need to drive search directly rather than through the auto-routing `memory` tool.

| Tool | Purpose |
|------|---------|
| `memory_search_multi_strategy` | Recommended. Runs several strategies in parallel and fuses them with Reciprocal Rank Fusion |
| `memory_search_with_fallbacks` | Multi-strategy search that escalates through fallbacks when nothing matches |
| `memory_search_hybrid` | FTS plus vector similarity, fused |
| `memory_search_fts` | Full-text BM25 search, best for exact phrases |
| `memory_search_vector` | Semantic similarity search |
| `memory_grep_transcripts` | Raw grep over transcript JSONL, a last resort |
| `memory_scan_recent_sessions` | Scan most recently modified sessions, for temporal queries |
| `memory_list_layers` | List which memory layers have data |

The searchable layers are `rules` (project conventions from `.claude/rules/`), `transcripts` (past sessions), `summaries` (session summaries with topics), and `team` (git commits and PRs, available when a git remote is configured).

## External MCP Servers (Integration Plugins)

Integration plugins connect Claude to external services via MCP. Each integration plugin provides tools for interacting with a specific service, with Han managing how those tools are exposed to Claude Code.

### How Integration Plugins Are Wired

An integration plugin ships a `.mcp.json` (or an `mcp_servers:` block in `han-plugin.yml`) declaring its backend server. Claude Code can talk to that server directly, and Han additionally re-exposes it through `han mcp` when the plugin marks it `expose: true`:

```yaml
# han-plugin.yml
mcp_servers:
  github:
    command: npx
    args: ["-y", "@modelcontextprotocol/server-github"]
    expose: true
```

With `expose: true`, Han opens a pooled connection to the backend, prefixes each of its tools with the server name, and serves them from the single `han` MCP entry. Without it, the plugin's server stands on its own and Claude Code connects to it directly.

Pool behaviour is tunable in `han.yml`:

```yaml
orchestrator:
  backends:
    idle_timeout: 300   # Seconds before an idle backend connection is closed
    max_connections: 10
```

`orchestrator.backends` is the only `orchestrator` subsection Han reads. Earlier documentation described an `orchestrator.enabled` switch and a unified `han_workflow` tool that toggled between "orchestrator" and "direct" modes; neither exists in the code.

### Available Integration Plugins

- **github** - GitHub Issues, PRs, Actions, Code Search
- **jira** - Jira tickets, sprints, workflows
- **playwright-mcp** - Browser automation and testing
- **linear** - Linear issues and project management
- **sentry-mcp** - Error tracking and performance monitoring
- **figma** - Design-to-code workflows
- **gitlab** - GitLab integration
- **blueprints** - Technical documentation management

### Installing External MCP Servers

Install an integration plugin to add its MCP server:

```bash
# Install GitHub integration
han plugin install github
```

This adds the MCP server to your Claude Code configuration, routing through Han:

```json
{
  "mcpServers": {
    "github": {
      "command": "han",
      "args": ["mcp", "github", "github"]
    }
  }
}
```

### Tuning the Backend Pool

The only MCP behaviour you configure in `han.yml` is the connection pool Han keeps for exposed backends:

```yaml
orchestrator:
  backends:
    idle_timeout: 300   # Seconds before an idle backend connection is closed
    max_connections: 10
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

Claude will use the appropriate MCP tool (`create_issue`, `list_pull_requests`, `search_code`, `bun_test`, `browser_take_screenshot`, etc.) based on your request.

### Real Example: GitHub Integration

After installing the github plugin, Claude can:

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
han plugin install github

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
