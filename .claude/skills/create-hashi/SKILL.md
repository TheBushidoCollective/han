---
description: Create a new bridge plugin for MCP server integration
---

# Create a Bridge (橋 - Hashi) Plugin

Create a new bridge plugin for: $ARGUMENTS

## What is a Bridge Plugin?

Bridge plugins provide access to external knowledge and capabilities through MCP servers. A bridge connects Claude Code to external services, APIs, databases, or specialized tools that extend Claude's capabilities.

## Plugin Structure

Create the following directory structure:

```
plugins/services/{service-name}/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (ONLY plugin.json goes here)
├── han-plugin.yml           # MCP server config + hooks + memory (at plugin root)
└── README.md               # Plugin documentation
```

### Categories

| Category | For | Examples |
|----------|-----|---------|
| `services/` | External service integrations | github, gitlab, sentry, reddit |
| `bridges/` | AI tool bridges | gemini-cli, opencode, kiro |

**IMPORTANT**:

- Only `plugin.json` goes inside `.claude-plugin/` (NO mcpServers here)
- MCP server config goes in `han-plugin.yml` at plugin root
- `han-plugin.yml` is the single source of truth for MCP config
- Bridge plugins typically don't include skills or agents

## Step 1: Create plugin.json

Create `.claude-plugin/plugin.json` (metadata only, NO mcpServers):

```json
{
  "name": "{service-name}",
  "version": "1.0.0",
  "description": "MCP server configuration for {Service Name} integration providing {key capabilities}.",
  "author": {
    "name": "The Bushido Collective",
    "url": "https://thebushido.co"
  },
  "homepage": "https://github.com/thebushidocollective/han",
  "repository": "https://github.com/thebushidocollective/han",
  "license": "MIT",
  "keywords": [
    "mcp",
    "{service-type}",
    "{capability}",
    "server"
  ]
}
```

## Step 2: Create han-plugin.yml

Create `han-plugin.yml` at the plugin root with the MCP server configuration.

### Preferred: HTTP Transport

```yaml
mcp:
  name: {server-name}
  description: {Brief description of capabilities}
  type: http
  url: https://mcp.service.com/mcp
```

### Alternative: NPX Package

```yaml
mcp:
  name: {server-name}
  description: {Brief description of capabilities}
  command: npx
  args:
    - -y
    - "@scope/package-name"
```

### With Environment Variables

```yaml
mcp:
  name: {server-name}
  description: {Brief description of capabilities}
  command: npx
  args:
    - -y
    - "@scope/package"
  env:
    API_KEY: ${SERVICE_API_KEY}
```

## Step 3: Write README.md

```markdown
# {Service Name}

{Description of what this MCP server provides}

## What This Plugin Provides

### MCP Server: {server-name}

- **{Capability 1}**: {Description}
- **{Capability 2}**: {Description}

## Installation

\`\`\`bash
han plugin install {service-name}
\`\`\`

## Configuration

Set required environment variables:

\`\`\`bash
export {ENV_VAR}="your-value-here"
\`\`\`
```

## Step 4: Register in Marketplace

Add your plugin to `.claude-plugin/marketplace.json`:

```json
{
  "name": "{service-name}",
  "description": "MCP server for {Service Name} integration providing {key capabilities}.",
  "source": "./plugins/services/{service-name}",
  "category": "Bridge",
  "keywords": [
    "mcp",
    "{keyword1}",
    "{keyword2}",
    "server"
  ]
}
```

## Best Practices

### DO

- Put MCP config in `han-plugin.yml`, NOT in `plugin.json`
- Prefer HTTP transport over stdio when available
- Use well-maintained MCP server packages
- Document all environment variables clearly

### DON'T

- Don't put mcpServers in plugin.json (use han-plugin.yml)
- Don't hardcode API keys or secrets
- Don't use Docker unless no HTTP or npx option exists

## Examples of Well-Structured Bridge Plugins

- **github**: HTTP transport with OAuth
- **sentry**: HTTP-based MCP server
- **reddit**: Simple uvx-based MCP server

## Questions?

See the [Han documentation](https://han.guru) or ask in [GitHub Discussions](https://github.com/thebushidocollective/han/discussions).
