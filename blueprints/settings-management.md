---
name: settings-management
summary: Multi-scope settings with precedence rules
---

# Settings Management

Multi-scope settings handling with precedence rules.

## Overview

Han manages Claude Code settings across three scopes with well-defined precedence. Higher priority settings override lower ones, allowing user customization while respecting team settings.

## Architecture

### Settings Scopes (Precedence Order)

| Priority | Scope | Location | Purpose |
|----------|-------|----------|---------|
| 1 (lowest) | User | `~/.claude/settings.json` | Personal global settings |
| 2 | Project | `.claude/settings.json` | Team-shared project settings |
| 3 (highest) | Local | `.claude/settings.local.json` | Personal project-specific (gitignored) |

Note: Enterprise scope (`~/.claude/managed-settings.json`) exists in Claude Code but is not currently used by Han.

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
    "biome@han": true
  }
}

// .claude/settings.local.json (local)
{
  "enabledPlugins": {
    "biome@han": false
  }
}
```

Result: `bushido` enabled, `biome` disabled (local override).

### Environment Variables

- `CLAUDE_CONFIG_DIR` - Override config directory location
- `CLAUDE_PROJECT_DIR` - Override project directory (default: cwd)

## Plugin Naming

Plugins use short identifiers without category prefixes:

- `typescript` (not `jutsu-typescript`)
- `biome` (not `jutsu-biome`)
- `github` (not `hashi-github`)
- `frontend-development` (not `do-frontend-development`)

## Files

- `lib/config/claude-settings.ts` - All settings management functions
- `lib/config/han-settings.ts` - Han-specific configuration (han.yml)

## Related Systems

- [Hook System](./hook-system.md) - Uses settings to discover enabled plugins
- [Plugin Installation](./plugin-installation.md) - Writes to settings files