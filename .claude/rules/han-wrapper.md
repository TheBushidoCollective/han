# Han Distribution for Ephemeral Environments

## Problem
In Claude Code Web and other ephemeral environments, installing binaries doesn't persist between sessions.

## Solution
Han is distributed via npm with a wrapper package that auto-installs platform-specific binaries:

1. `@thebushidocollective/han` - Wrapper that detects platform and loads correct binary
2. `@thebushidocollective/han-{platform}` - Platform-specific binary packages

## MCP Servers
MCP servers use npx to run han:
```json
{
  "mcpServers": {
    "han": {
      "command": "npx",
      "args": ["-y", "@thebushidocollective/han", "mcp"]
    }
  }
}
```

## Distribution Packages
- `@thebushidocollective/han-linux-x64`
- `@thebushidocollective/han-linux-arm64`
- `@thebushidocollective/han-darwin-x64`
- `@thebushidocollective/han-darwin-arm64`
- `@thebushidocollective/han-win32-x64`

## Hooks
Hooks reference `han` directly - npx handles installation:
```yaml
hooks:
  context:
    event: SessionStart
    command: han hook context
```

## Benefits
- No wrapper scripts in the repository
- Single source of truth (npm packages)
- Works in any environment with Node.js
- Auto-updates to latest version with `npx -y`
