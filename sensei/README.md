# Sensei (先生) - Teachers

This directory contains all **sensei** plugins - Model Context Protocol
(MCP) server integrations that provide additional capabilities to
Claude Code through external tools and services.

## What is Sensei?

In the Bushido tradition, **sensei** (先生) means "teacher" - one who
has gone before and guides others on the path. In software development,
sensei plugins connect Claude Code to external knowledge sources and
services through the Model Context Protocol.

## Available Teachers

### Context7

**Plugin:** `sensei-context7`

Provides access to up-to-date documentation and code examples for any
library or framework through the Context7 MCP server.

**Features:**

- Real-time library documentation
- Code examples and patterns
- Framework-specific guidance
- Multi-version support

**MCP Server:** `@upstash/context7-mcp`

**Usage:**

```bash
# The MCP server is automatically available
# Claude can fetch library docs on-demand
```

### Playwright MCP

**Plugin:** `sensei-playwright-mcp`

Provides browser automation and end-to-end testing capabilities through
the Playwright MCP server.

**Features:**

- Browser automation
- Test execution
- Screenshot capture
- Network interception

**MCP Server:** `@executeautomation/playwright-mcp-server`

**Usage:**

```bash
# The MCP server is automatically available
# Claude can control browsers and run tests
```

## What is Model Context Protocol (MCP)?

MCP is a protocol that allows Claude Code to interact with external
tools and services. MCP servers provide:

- **Tools** - Functions Claude can call
- **Resources** - Data Claude can access
- **Prompts** - Templates Claude can use

## Plugin Structure

Each sensei plugin follows this structure:

```text
sensei-{service}/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata with mcpServers config
└── README.md                # Plugin documentation
```

## MCP Server Configuration

MCP servers are configured in `plugin.json`:

```json
{
  "name": "sensei-{service}",
  "mcpServers": {
    "server-name": {
      "command": "npx",
      "args": ["-y", "@package/name"]
    }
  }
}
```

## Creating New Sensei Plugins

To add a new MCP server integration:

1. Create a new `sensei-{service}` directory
2. Add `.claude-plugin/plugin.json` with MCP server config
3. Document the MCP server capabilities in README.md
4. Register in marketplace.json
5. Test the MCP server integration

## Quality Standards

All sensei plugins must:

- Have valid `mcpServers` configuration (object, not array)
- Document MCP server capabilities clearly
- Include usage examples
- Pass claudelint validation

## Finding MCP Servers

Discover available MCP servers:

- [MCP Servers Registry](https://github.com/modelcontextprotocol/servers)
- [Awesome MCP Servers](https://github.com/punkpeye/awesome-mcp-servers)
- npm registry: search for "mcp-server"

## License

MIT License - see individual plugin directories for details.
