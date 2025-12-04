# Settings Management

Multi-scope settings handling with precedence rules.

## Overview

Han manages Claude Code settings across four scopes with well-defined precedence. Higher priority settings override lower ones, allowing user customization while respecting enterprise policies.

## Architecture

### Settings Scopes (Precedence Order)

| Priority | Scope | Location | Purpose |
|----------|-------|----------|---------|
| 1 (lowest) | User | `~/.claude/settings.json` | Personal global settings |
| 2 | Project | `.claude/settings.json` | Team-shared project settings |
| 3 | Local | `.claude/settings.local.json` | Personal project-specific (gitignored) |
| 4 (highest) | Enterprise | `~/.claude/managed-settings.json` | Cannot be overridden |

### Data Structures

```typescript
interface ClaudeSettings {
  extraKnownMarketplaces?: Record<string, MarketplaceConfig>;
  enabledPlugins?: Record<string, boolean>;
  hooks?: Record<string, unknown>;
}

interface MarketplaceConfig {
  source: {
    source: "directory" | "git" | "github";
    path?: string;
    url?: string;
    repo?: string;
  };
}
```

## API / Interface

### Core Functions

#### `getClaudeConfigDir(): string`

Returns the Claude config directory (`~/.claude`).

Respects `CLAUDE_CONFIG_DIR` environment variable override.

#### `getSettingsPaths(): { scope: SettingsScope; path: string }[]`

Returns all settings file paths in precedence order.

#### `readSettingsFile(path: string): ClaudeSettings | null`

Reads and parses a single settings file. Returns null if file doesn't exist or is invalid JSON.

#### `getMergedSettings(): ClaudeSettings`

Deep merges all settings files respecting precedence. Higher priority scopes override lower ones.

#### `getMergedPluginsAndMarketplaces()`

Returns merged plugin enablements and marketplace configurations.

```typescript
function getMergedPluginsAndMarketplaces(): {
  plugins: Map<string, string>;      // pluginName → marketplace
  marketplaces: Map<string, MarketplaceConfig>;
}
```

## Behavior

### Merge Strategy

**Plugin Enablement:**
- `"plugin@han": true` enables the plugin
- `"plugin@han": false` explicitly disables (removes from result)
- Later scopes override earlier ones

**Marketplace Configuration:**
- Configurations accumulate across scopes
- Later scopes override same-named marketplaces

### Example

Given these settings:

```json
// ~/.claude/settings.json (user)
{
  "enabledPlugins": {
    "bushido@han": true,
    "jutsu-biome@han": true
  }
}

// .claude/settings.local.json (local)
{
  "enabledPlugins": {
    "jutsu-biome@han": false
  }
}
```

Result: `bushido` enabled, `jutsu-biome` disabled (local override).

### Environment Variables

- `CLAUDE_CONFIG_DIR` - Override config directory location
- `CLAUDE_PROJECT_DIR` - Override project directory (default: cwd)

## Files

- `lib/claude-settings.ts` - All settings management functions
- `lib/commands/hook/dispatch.ts:215-220` - Uses merged settings for hook dispatch
- `lib/commands/mcp/tools.ts:153-160` - Uses merged settings for tool discovery

## Related Systems

- [Hook System](./hook-system.md) - Uses settings to discover enabled plugins
- [Plugin Installation](./plugin-installation.md) - Writes to settings files
