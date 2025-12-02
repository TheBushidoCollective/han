---
description: Create a new sensei (teacher) plugin for MCP server integration
---

# Create a Sensei (先生 - Teacher) Plugin

Create a new sensei plugin for: $ARGUMENTS

## What is a Sensei?

Senseis are "teachers" in the Han marketplace - they provide access to external knowledge and capabilities through MCP servers. A sensei connects Claude Code to external services, APIs, databases, or specialized tools that extend Claude's capabilities.

## Plugin Structure

Create the following directory structure:

```
sensei/sensei-{service-name}/
├── .claude-plugin/
│   └── plugin.json          # Plugin metadata (ONLY plugin.json goes here)
├── han-config.json          # Han hook configurations (optional, at plugin root)
├── hooks/
│   └── hooks.json           # Claude Code hooks (optional)
└── README.md               # Plugin documentation
```

**IMPORTANT**:
- Only `plugin.json` goes inside `.claude-plugin/`
- `hooks.json` goes in the `hooks/` directory
- `han-config.json` stays at the plugin root (NOT in hooks/)

Note: Sensei plugins typically don't include skills or agents - they provide tools through MCP servers.

## Step 1: Create plugin.json

Create `.claude-plugin/plugin.json`:

```json
{
  "name": "sensei-{service-name}",
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
  ],
  "mcpServers": {
    "{server-name}": {
      "command": "{command}",
      "args": [{command-args}],
      "env": {
        "{ENV_VAR}": "{value or placeholder}"
      }
    }
  }
}
```

### mcpServers Configuration

The `mcpServers` field defines one or more MCP server connections:

#### NPM Package MCP Server

```json
"mcpServers": {
  "service-name": {
    "command": "npx",
    "args": ["-y", "@scope/package-name"]
  }
}
```

#### Node.js Script MCP Server

```json
"mcpServers": {
  "service-name": {
    "command": "node",
    "args": ["/path/to/server.js"]
  }
}
```

#### Python MCP Server

```json
"mcpServers": {
  "service-name": {
    "command": "python",
    "args": ["-m", "package_name"]
  }
}
```

#### UV-based Python MCP Server

```json
"mcpServers": {
  "service-name": {
    "command": "uvx",
    "args": ["package-name"]
  }
}
```

#### With Environment Variables

```json
"mcpServers": {
  "service-name": {
    "command": "npx",
    "args": ["-y", "@scope/package"],
    "env": {
      "API_KEY": "${SERVICE_API_KEY}",
      "API_URL": "https://api.service.com"
    }
  }
}
```

### Environment Variable Patterns

- **Required API Keys**: Use `${SERVICE_NAME_API_KEY}` format
- **Optional Configuration**: Provide sensible defaults
- **Multiple Servers**: Each server can have its own env config

## Step 2: Create .mcp.json

Create `.mcp.json` to document the MCP server configuration:

```json
{
  "mcpServers": {
    "{server-name}": {
      "command": "{command}",
      "args": [{command-args}],
      "env": {
        "{ENV_VAR}": "${PLACEHOLDER_OR_VALUE}"
      }
    }
  }
}
```

This file serves as:

- Documentation for users
- Template for manual installation
- Reference for the plugin system

## Step 3: Write README.md

Create a comprehensive README:

```markdown
# Sensei: {Service Name}

{Compelling description of what this MCP server provides and why it's valuable}

## What This Sensei Provides

### MCP Server: {server-name}

{Detailed description of the MCP server's capabilities}

This sensei connects Claude Code to {service} and provides:

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

### Available Resources

{If the MCP server provides resources:}

- \`{resource-type}://{pattern}\`: {What resources are available}

## Installation

### Prerequisites

{List any prerequisites}

- {Requirement 1}
- {Requirement 2}
- {API key or authentication requirements}

### Via Han Marketplace

\`\`\`bash
npx @thebushidocollective/han plugin install {plugin-name}
\`\`\`

Or install manually:

\`\`\`bash
claude plugin marketplace add thebushidocollective/han
claude plugin install sensei-{service-name}@han
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

2. {Additional configuration steps if needed}

### Manual Installation

If not using Han, add to your Claude Code settings (\`~/.claude/settings.json\`):

\`\`\`json
{
  "mcpServers": {
    "{server-name}": {
      "command": "{command}",
      "args": [{args}],
      "env": {
        "{ENV_VAR}": "${VALUE}"
      }
    }
  }
}
\`\`\`

## Usage

### Example 1: {Use Case}

{Practical example of using the MCP server}

\`\`\`
User: {example request}
Claude: {uses {tool-name} tool to accomplish task}
\`\`\`

### Example 2: {Use Case}

{Another practical example}

\`\`\`
User: {example request}
Claude: {uses {tool-name} tool to accomplish task}
\`\`\`

### Example 3: {Use Case}

{Another practical example}

\`\`\`
User: {example request}
Claude: {uses {tool-name} tool to accomplish task}
\`\`\`

## Tool Reference

### \`{tool-name-1}\`

**Purpose**: {What this tool does}

**Parameters**:
- \`{param1}\` (required): {description}
- \`{param2}\` (optional): {description}

**Example**:
\`\`\`json
{
  "{param1}": "value",
  "{param2}": "value"
}
\`\`\`

### \`{tool-name-2}\`

**Purpose**: {What this tool does}

**Parameters**:
- \`{param1}\` (required): {description}
- \`{param2}\` (optional): {description}

**Example**:
\`\`\`json
{
  "{param1}": "value",
  "{param2}": "value"
}
\`\`\`

## Security Considerations

{Important security notes}

- {Security consideration 1}
- {Security consideration 2}
- {Security consideration 3}

## Limitations

{Known limitations of the MCP server or service}

- {Limitation 1}
- {Limitation 2}
- {Limitation 3}

## Troubleshooting

### Issue: {Common Problem}

**Solution**: {How to resolve}

### Issue: {Common Problem}

**Solution**: {How to resolve}

### Issue: {Common Problem}

**Solution**: {How to resolve}

## Related Plugins

{List related senseis or bukis}

- **sensei-{related}**: {What it provides}
- **buki-{related}**: {What it provides}

## Contributing

See [CONTRIBUTING.md](../../CONTRIBUTING.md) for guidelines.

## License

MIT License - See [LICENSE](../../LICENSE) for details.

## Links

- [{Service} Documentation]({url})
- [{MCP Server Package}]({npm or pypi url})
- [MCP Protocol Specification](https://modelcontextprotocol.io)
```

## Step 4: Register in Marketplace

Add your plugin to `.claude-plugin/marketplace.json`:

```json
{
  "plugins": {
    "sensei-{service-name}": {
      "source": "directory",
      "path": "./sensei/sensei-{service-name}"
    }
  }
}
```

## Best Practices

### DO

✅ Use well-maintained MCP server packages
✅ Document all environment variables clearly
✅ Provide practical usage examples
✅ Include security considerations
✅ Test the MCP server connection thoroughly
✅ Document tool parameters and return values
✅ Explain when to use this sensei
✅ Include troubleshooting guidance
✅ Use descriptive tool names that indicate their purpose
✅ Handle authentication securely

### DON'T

❌ Don't hardcode API keys or secrets
❌ Don't skip documentation of required setup
❌ Don't forget to test with actual API credentials
❌ Don't ignore rate limits and quotas
❌ Don't skip error handling documentation
❌ Don't assume users know the external service
❌ Don't neglect to document tool limitations
❌ Don't forget to explain what problems this solves

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

### AI & ML Services

- OpenAI integration
- Anthropic integration
- Image generation
- Embeddings

### Data & Analytics

- Database queries
- Data transformation
- Analytics APIs
- Time series data

### External Services

- Cloud providers (AWS, GCP, Azure)
- Communication (Slack, Discord)
- Project management (Jira, Linear)
- CI/CD platforms

## MCP Server Development

If creating a custom MCP server (not using an existing package):

### Server Implementation

1. Choose a language (TypeScript, Python recommended)
2. Implement MCP protocol handlers
3. Define tools and/or resources
4. Handle authentication
5. Publish package to npm or PyPI

### Server Repository Structure

```
your-mcp-server/
├── src/
│   └── index.ts         # Server implementation
├── package.json
├── tsconfig.json
└── README.md
```

### Example MCP Server (TypeScript)

```typescript
import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';

const server = new Server({
  name: 'your-server-name',
  version: '1.0.0',
}, {
  capabilities: {
    tools: {},
  },
});

server.setRequestHandler('tools/list', async () => {
  return {
    tools: [
      {
        name: 'your_tool',
        description: 'What your tool does',
        inputSchema: {
          type: 'object',
          properties: {
            param: { type: 'string', description: 'Parameter description' },
          },
          required: ['param'],
        },
      },
    ],
  };
});

server.setRequestHandler('tools/call', async (request) => {
  if (request.params.name === 'your_tool') {
    // Implement tool logic
    return {
      content: [
        { type: 'text', text: 'Tool result' },
      ],
    };
  }
  throw new Error('Unknown tool');
});

const transport = new StdioServerTransport();
await server.connect(transport);
```

## Testing Your Sensei

1. Install locally:

   ```bash
   claude plugin install /path/to/sensei-{name}@local
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

4. Test with real credentials:
   - Set up actual API keys
   - Perform real operations
   - Verify results are correct

5. Test error handling:
   - Invalid credentials
   - Rate limits
   - Network errors

## Examples of Well-Structured Senseis

Reference these examples:

- **sensei-context7**: Excellent documentation and clear setup
- **sensei-playwright-mcp**: Good tool documentation

## MCP Resources

- [MCP Specification](https://modelcontextprotocol.io)
- [MCP SDK (TypeScript)](https://github.com/modelcontextprotocol/typescript-sdk)
- [MCP SDK (Python)](https://github.com/modelcontextprotocol/python-sdk)
- [MCP Servers List](https://github.com/modelcontextprotocol/servers)

## Questions?

See the [Han documentation](https://thebushidocollective.github.io/han) or ask in [GitHub Discussions](https://github.com/thebushidocollective/han/discussions).
