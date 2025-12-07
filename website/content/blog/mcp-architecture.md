---
title: "Understanding Han's MCP Architecture: Bridges to the World"
description: "Deep dive into how Han uses the Model Context Protocol to connect Claude Code to external services like GitHub, Jira, and custom tools."
date: "2025-01-05"
author: "The Bushido Collective"
tags: ["mcp", "architecture", "integration", "github"]
category: "Technical Deep Dive"
---

Model Context Protocol (MCP) is the secret sauce that makes Han plugins so powerful. Let's explore how Han uses MCP to turn Claude Code into a universal development environment.

## What is MCP?

Model Context Protocol is an open standard for connecting AI assistants to external data sources and tools. Think of it as APIs for AI—a standardized way for Claude to interact with the world beyond its training data.

## Han's "Hashi" (Bridge) Plugins

In Han's architecture, plugins starting with `hashi-` are "bridges"—MCP servers that connect Claude to external services:

- `hashi-github`: GitHub Issues, PRs, Actions, Code Search
- `hashi-jira`: Jira tickets, sprints, workflows
- `hashi-playwright-mcp`: Browser automation and testing
- `hashi-linear`: Linear issues and project management
- `hashi-sentry`: Error tracking and performance monitoring

## Real Example: GitHub Integration

Let's see how the GitHub MCP server works in practice.

### Installation

```bash
npx @thebushidocollective/han plugin install hashi-github
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

## Available Hashi Plugins

Current MCP bridges in Han marketplace:

- **hashi-github**: GitHub platform integration
- **hashi-jira**: Atlassian Jira integration
- **hashi-linear**: Linear project management
- **hashi-playwright-mcp**: Browser automation
- **hashi-sentry**: Error tracking and monitoring
- **hashi-figma**: Design-to-code workflows
- **hashi-gitlab**: GitLab integration

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
npx @thebushidocollective/han plugin install hashi-github

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
