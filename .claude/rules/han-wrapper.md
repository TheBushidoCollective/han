# Han Wrapper for Ephemeral Environments

## Problem
In Claude Code Web and other ephemeral environments, installing binaries doesn't persist between sessions.

## Solution
Each plugin that needs to run han includes a `han` script at its root that:
1. Checks for `HAN_BIN` env var (for command chaining)
2. Falls back to `~/.local/bin/han-bin`
3. Auto-downloads binary from GitHub releases if not found
4. Exports `HAN_BIN` for child processes

## MCP Servers
MCP servers reference the local han script:
```json
{
  "mcpServers": {
    "han": {
      "command": "${CLAUDE_PLUGIN_ROOT}/han",
      "args": ["mcp"]
    }
  }
}
```

## Plugin Structure
Plugins that spawn han processes include:
```
plugin-name/
├── han                    # Wrapper script with auto-install
├── .claude-plugin/
│   └── plugin.json        # References ${CLAUDE_PLUGIN_ROOT}/han
└── ...
```

## Hooks
Hooks go through the orchestrator which controls execution environment - no wrapper path needed in hook definitions.
