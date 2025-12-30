# MCP Tool Access Patterns

## Two Ways to Access Hashi Plugin Tools

### 1. Direct Exposure (`expose: true`)
Tools are directly available as `{serverId}_{toolName}` in Claude Code:
```yaml
mcp:
  name: my-server
  expose: true  # Tools appear directly
```
**Used by:** context7, deepwiki, blueprints

### 2. Dynamic via Orchestrator (default)
Tools are accessed through `han_workflow` tool which spawns Agent SDK agents:
```yaml
mcp:
  name: my-server
  # No expose flag - accessed via han_workflow
```
**Used by:** All other hashi plugins (github, reddit, playwright, etc.)

## han_workflow Tool

The orchestrator provides a single `han_workflow` tool that:
1. Analyzes user intent via `selectBackendsForIntent()`
2. Discovers available backends from installed hashi plugins
3. Spawns Agent SDK agents with selected MCP servers
4. Runs workflows autonomously and returns results

Example usage:
```
han_workflow({ intent: "Get hot posts from r/ClaudeAI" })
```

The orchestrator dynamically connects to the reddit MCP server without needing `expose: true`.
