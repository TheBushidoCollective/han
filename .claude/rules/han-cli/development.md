# Han Binary Configuration

## Local Development Override

When developing han locally, the `.claude/han.yml` file can specify a custom binary:

```yaml
hanBinary: bun "$(git rev-parse --show-toplevel)/packages/han/lib/main.ts"
```

This causes all `han` CLI calls to delegate to the local TypeScript source instead of the installed binary.

## How It Works

1. When hooks run `han hook ...`, the han wrapper checks for `hanBinary` in `.claude/han.yml`
2. If set, it executes the specified command instead of the installed binary
3. This enables live development without rebuilding/reinstalling

## Configuration Locations

- `.claude/han.yml` - Project-specific han configuration (including hanBinary override)
- `han.yml` (root) - Additional project settings (plugin enables/disables)
- `~/.claude/settings.json` - User Claude Code settings
- `.claude/settings.json` - Project Claude Code settings
