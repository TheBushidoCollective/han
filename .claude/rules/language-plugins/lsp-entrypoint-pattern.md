# LSP Entrypoint Scripts - Graceful Degradation Pattern

## Problem: LSP Crashes When Config Not Found

LSP servers that require configuration files (like Relay, ESLint, Biome) will crash on startup if the config isn't found in expected locations. This is problematic in:

- Monorepos with configs in subdirectories
- Projects that don't use the tool
- Multi-language repositories

### Example: Relay LSP in Monorepo

```
project-root/
  .claude/settings.json          # Project settings
  packages/
    browse-client/
      relay.config.json           # Relay config here (not at root)
```

The relay LSP runs from project root and can't find `packages/browse-client/relay.config.json`, causing a crash.

## Solution: Defensive Entrypoint Scripts

Make LSP entrypoint scripts check for required configs and exit gracefully if not found:

```bash
#!/usr/bin/env bash
# LSP entrypoint with graceful degradation
set -e

# Install tool if needed
if ! command -v the-lsp-tool &> /dev/null; then
  npm install -g the-lsp-tool
fi

# Check for config in common locations
if [ $# -gt 0 ]; then
  # Config path provided as argument
  exec the-lsp-tool lsp "$@"
elif [ -f "package.json" ] && grep -q '"configKey"' package.json; then
  # Config in package.json
  exec the-lsp-tool lsp
elif [ -f ".configfile" ]; then
  # Config file in root
  exec the-lsp-tool lsp
else
  # No config found - exit gracefully (exit 0 = no error)
  echo "No config found. LSP disabled for this project." >&2
  exit 0
fi
```

## Benefits of This Approach

1. **Plugin stays enabled** - Skills and other features remain available
2. **No startup errors** - Graceful exit prevents crash logs
3. **Works everywhere** - LSP runs where config exists, skips where it doesn't
4. **No user configuration** - Automatic per-project behavior
5. **Clean repository** - No symlinks or workarounds needed

## Implementation Pattern

For any jutsu plugin with LSP servers:

1. **Check for config** before starting LSP
2. **Exit with code 0** if config not found (not an error)
3. **Log informative message** to stderr explaining why LSP is disabled
4. **Support multiple config formats** (package.json, .configrc, config.js, etc.)
5. **Allow explicit config path** as argument for advanced users

## Implemented In

- `relay` - Checks for relay.config.json, relay.config.js, or package.json

## Should Be Applied To

- Any jutsu plugin with optional LSP servers
- LSP servers that require project-specific configuration
- Tools that aren't used in every project
