---
description: Create a new hashi (teacher) plugin for MCP server integration
---

# Create a Hashi (橋 - Bridge) Plugin

Create a new hashi plugin for: $ARGUMENTS

## What is a Hashi?

Hashis are "bridges" in the Han marketplace - they provide access to external knowledge and capabilities through MCP servers. A hashi connects Claude Code to external services, APIs, databases, or specialized tools that extend Claude's capabilities.

## Plugin Structure

Create the following directory structure:

```
hashi/hashi-{service-name}/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (ONLY plugin.json goes here)
├── han-plugin.yml           # MCP server config + hooks + memory (at plugin root)
├── commands/                # Slash commands (optional)
│   └── {command-name}.md
└── README.md               # Plugin documentation
```

**IMPORTANT**:

- Only `plugin.json` goes inside `.claude-plugin/` (NO mcpServers here)
- MCP server config goes in `han-plugin.yml` at plugin root
- `han-plugin.yml` is the single source of truth for MCP config

Note: Hashi plugins typically don't include skills or agents - they provide tools through MCP servers.

## Step 1: Create plugin.json

Create `.claude-plugin/plugin.json` (metadata only, NO mcpServers):

```json
{
  "name": "hashi-{service-name}",
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
    "server",
    "{category}"
  ]
}
```

**Note**: Do NOT include `mcpServers` in plugin.json - it goes in `han-plugin.yml`.

## Step 2: Create han-plugin.yml

Create `han-plugin.yml` at the plugin root with the MCP server configuration:

```yaml
# hashi-{service-name} plugin configuration
# This plugin provides {Service Name} integration via MCP server

# MCP server definition (managed by Han MCP orchestrator)
mcp:
  name: {server-name}
  description: {Brief description of capabilities}
  command: {command}
  args:
    - {arg1}
    - {arg2}
  env:
    {ENV_VAR}: ${PLACEHOLDER}
  capabilities:
    - category: {Category}
      summary: {What this server enables}
      examples:
        - {Example use case 1}
        - {Example use case 2}
        - {Example use case 3}

# No hooks - MCP server plugins don't have validation hooks
hooks: {}

# Memory provider for team memory extraction (optional)
memory:
  allowed_tools:
    - mcp__{server-name}__{tool_name_1}
    - mcp__{server-name}__{tool_name_2}
  system_prompt: |
    {Instructions for how to use this MCP server for memory queries}
```

### MCP Configuration Types

#### Stdio MCP Server (most common)

```yaml
mcp:
  name: service-name
  description: Service integration
  command: uvx
  args:
    - package-name
  env: {}
```

#### NPM Package MCP Server

```yaml
mcp:
  name: service-name
  description: Service integration
  command: npx
  args:
    - -y
    - "@scope/package-name"
```

#### HTTP/Remote MCP Server

```yaml
mcp:
  name: service-name
  description: Service integration
  type: http
  url: https://mcp.service.com/mcp
```

#### With Environment Variables

```yaml
mcp:
  name: service-name
  description: Service integration
  command: npx
  args:
    - -y
    - "@scope/package"
  env:
    API_KEY: ${SERVICE_API_KEY}
    API_URL: https://api.service.com
```

### Environment Variable Patterns

- **Required API Keys**: Use `${SERVICE_NAME_API_KEY}` format
- **Optional Configuration**: Provide sensible defaults
- **Shell Commands**: Use `$(command)` for dynamic values

## Step 3: Write README.md

Create a comprehensive README:

```markdown
# Hashi: {Service Name}

{Compelling description of what this MCP server provides and why it's valuable}

## What This Hashi Provides

### MCP Server: {server-name}

{Detailed description of the MCP server's capabilities}

This hashi connects Claude Code to {service} and provides:

- **{Capability 1}**: {Description}
- **{Capability 2}**: {Description}
- **{Capability 3}**: {Description}
- **{Capability 4}**: {Description}

### Available Tools

Once installed, Claude Code gains access to these tools:

- \`{tool-name-1}\`: {What it does}
- \`{tool-name-2}\`: {What it does}
- \`{tool-name-3}\`: {What it does}
- \`{tool-name-4}\`: {What it does}

## Installation

### Prerequisites

{List any prerequisites}

- {Requirement 1}
- {Requirement 2}
- {API key or authentication requirements}

### Via Han Marketplace

\`\`\`bash
han plugin install hashi-{service-name}
\`\`\`

Or install manually:

\`\`\`bash
claude plugin marketplace add thebushidocollective/han
claude plugin install hashi-{service-name}@han
\`\`\`

### Configuration

{If environment variables are required:}

1. Set required environment variables:

\`\`\`bash
export {ENV_VAR}="your-value-here"
\`\`\`

Or add to your shell profile (\`~/.zshrc\`, \`~/.bashrc\`):

\`\`\`bash
echo 'export {ENV_VAR}="your-value-here"' >> ~/.zshrc
source ~/.zshrc
\`\`\`

## Usage

### Example 1: {Use Case}

{Practical example of using the MCP server}

### Example 2: {Use Case}

{Another practical example}

## Tool Reference

### \`{tool-name-1}\`

**Purpose**: {What this tool does}

**Parameters**:
- \`{param1}\` (required): {description}
- \`{param2}\` (optional): {description}

## Limitations

{Known limitations of the MCP server or service}

- {Limitation 1}
- {Limitation 2}

## Troubleshooting

### Issue: {Common Problem}

**Solution**: {How to resolve}

## Related Plugins

{List related hashis or jutsus}

- **hashi-{related}**: {What it provides}

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Links

- [{Service} Documentation]({url})
- [{MCP Server Package}]({npm or pypi url})
- [MCP Protocol Specification](https://modelcontextprotocol.io)
```

## Step 4: Create Commands (Optional)

If your hashi provides useful workflows, create commands in the `commands/` directory:

```markdown
---
description: Brief description of what this command does
---

# Command Title

{Instructions for Claude on how to use the MCP tools for this workflow}

## Steps

1. {Step 1 using MCP tools}
2. {Step 2 using MCP tools}
3. {Step 3 using MCP tools}
```

## Step 5: Register in Marketplace

Add your plugin to `.claude-plugin/marketplace.json`:

```json
{
  "name": "hashi-{service-name}",
  "description": "MCP server for {Service Name} integration providing {key capabilities}.",
  "source": "./hashi/hashi-{service-name}",
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

✅ Put MCP config in `han-plugin.yml`, NOT in `plugin.json`
✅ Use well-maintained MCP server packages
✅ Document all environment variables clearly
✅ Provide practical usage examples
✅ Include security considerations
✅ Document tool parameters and return values
✅ Add commands for common workflows
✅ Include memory provider config for team memory integration

### DON'T

❌ Don't put mcpServers in plugin.json (use han-plugin.yml)
❌ Don't hardcode API keys or secrets
❌ Don't skip documentation of required setup
❌ Don't forget to test with actual API credentials
❌ Don't ignore rate limits and quotas

## MCP Server Categories

### Knowledge & Documentation

- Context7: Up-to-date library documentation
- Web search and crawling
- Documentation aggregators

### Development Tools

- Git operations
- GitHub/GitLab integration
- Playwright browser automation
- Database clients

### External Services

- Cloud providers (AWS, GCP, Azure)
- Communication (Slack, Discord)
- Project management (Jira, Linear)
- Social media (Reddit, Twitter)

## Testing Your Hashi

1. Install locally:

   ```bash
   han plugin install /path/to/hashi-{name}
   ```

2. Verify MCP server connects:

   ```bash
   # Check Claude Code logs for connection errors
   tail -f ~/.claude/logs/claude.log
   ```

3. Test tools are available:

   ```
   # In Claude Code, ask to use specific tools
   "Can you use the {tool-name} tool to {action}?"
   ```

## Examples of Well-Structured Hashis

Reference these examples:

- **hashi-github**: Excellent han-plugin.yml with memory provider
- **hashi-sentry**: HTTP-based MCP server example
- **hashi-reddit**: Simple uvx-based MCP server

## MCP Resources

- [MCP Specification](https://modelcontextprotocol.io)
- [MCP SDK (TypeScript)](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP SDK (Python)](https://github.com/modelcontextprotocol/python-sdk)
- [MCP Servers List](https://github.com/modelcontextprotocol/servers)

## Questions?

See the [Han documentation](https://thebushidocollective.github.io/han) or ask in [GitHub Discussions](https://github.com/thebushidocollective/han/discussions).
