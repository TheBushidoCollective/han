# Hashi Plugin MCP Transport Best Practices

## Prefer HTTP Transport Over stdio

When creating hashi plugins, prefer HTTP-based MCP servers over stdio/Docker:

### HTTP Transport (Best)
```json
{
  "mcpServers": {
    "service": {
      "type": "http",
      "url": "https://mcp.service.com/mcp"
    }
  }
}
```

**Benefits:**
- Zero installation required
- No Docker dependency
- Instant startup
- Provider-managed updates
- OAuth handled by Claude Code

**Services with HTTP endpoints:**
- GitHub: `https://api.githubcopilot.com/mcp`
- GitLab: `https://gitlab.com/api/v4/mcp`
- Linear: `https://mcp.linear.app/mcp`
- ClickUp: `https://mcp.clickup.com/mcp`

### npx On-Demand (Good Alternative)
```json
{
  "mcpServers": {
    "service": {
      "command": "npx",
      "args": ["-y", "@service/mcp@latest"]
    }
  }
}
```

**Use when:**
- Service doesn't provide HTTP endpoint
- MCP server available as npm package
- Want automatic version updates

**Examples:**
- `@playwright/mcp@latest`
- `@modelcontextprotocol/server-*`

### Avoid Docker Unless Necessary

Only use Docker when:
- No HTTP endpoint available
- No npm package available
- Server requires specific runtime environment

**Problem with Docker:**
- Requires Docker daemon running
- Large image downloads
- Slower startup
- Connection failures if Docker not started
- Poor UX on systems without Docker
