# Han Wrapper for Ephemeral Environments

## Problem
In Claude Code Web and other ephemeral environments, installing binaries doesn't persist between sessions.

## Solution
A thin wrapper script (`core/hooks/han-wrapper.sh`) that:
1. Checks for `HAN_BIN` env var (for command chaining)
2. Falls back to `~/.local/bin/han-bin`
3. Auto-downloads binary via `install.sh` if not found
4. Exports `HAN_BIN` for child processes

## MCP Servers
MCP servers use the wrapper directly since Claude Code spawns them:
```yaml
command: "${CLAUDE_PLUGIN_ROOT}/hooks/han-wrapper.sh"
args: ["mcp", "memory"]
```

## Hooks
Hooks go through the orchestrator which controls execution environment - no wrapper path needed in hook definitions.

## install.sh
Respects `HAN_INSTALL_TARGET` env var:
- Default: installs to `han` (manual installs)
- Wrapper sets: `han-bin` (so wrapper stays in place)
