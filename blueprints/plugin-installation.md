# Plugin Installation

Installation flow and marketplace integration.

## Overview

Han supports multiple installation paths: auto-detection using AI, explicit plugin names, and interactive selection. All paths validate against the marketplace and update Claude Code settings.

## Architecture

### Installation Paths

```
                    ┌─────────────────────┐
                    │   User Command      │
                    └─────────────────────┘
                              │
        ┌─────────────────────┼─────────────────────┐
        ▼                     ▼                     ▼
┌───────────────┐   ┌─────────────────┐   ┌─────────────────┐
│ --auto flag   │   │ Explicit names  │   │ Interactive UI  │
│               │   │                 │   │                 │
│ Agent detects │   │ Direct install  │   │ Ink component   │
│ plugins       │   │                 │   │ with selection  │
└───────────────┘   └─────────────────┘   └─────────────────┘
        │                     │                     │
        └─────────────────────┼─────────────────────┘
                              ▼
                    ┌─────────────────────┐
                    │ Marketplace         │
                    │ Validation          │
                    └─────────────────────┘
                              │
                              ▼
                    ┌─────────────────────┐
                    │ Settings Update     │
                    └─────────────────────┘
```

### Components

- `lib/commands/plugin/install.ts` - Installation command handler
- `lib/install.ts` - Auto-detection logic
- `lib/plugin-install.ts` - Core installation
- `lib/shared.ts` - Agent detection and marketplace access
- `lib/install-interactive.tsx` - Ink UI component

## API / Interface

### CLI Commands

#### `han plugin install [plugins...]`

Install plugins from the marketplace.

**Options:**

- `--auto` - Auto-detect plugins based on codebase analysis
- `--scope <scope>` - Installation scope (user, project, local)

**Examples:**

```bash
# Install specific plugins
han plugin install jutsu-typescript do-backend-development

# Auto-detect for project
han plugin install --auto

# Install to project scope
han plugin install --scope project jutsu-biome
```

#### `han plugin uninstall <plugins...>`

Remove installed plugins.

### Functions

#### `installPlugins(plugins, scope)`

Direct installation of named plugins.

1. Fetch marketplace plugins
2. Validate each plugin exists
3. Add to settings with scope
4. Report added/removed/invalid

#### `detectPluginsWithAgent(callbacks)`

AI-powered plugin detection.

1. Analyze codebase structure
2. Query Claude Haiku with plugin list
3. Parse recommendations
4. Validate against marketplace

## Behavior

### Auto-Detection Flow

```
1. Fetch marketplace (GitHub API)
2. Analyze codebase:
   - File statistics (counts by extension)
   - Project structure
   - Git remote URL
3. Build agent prompt with:
   - Available plugins list
   - Currently installed plugins
   - Codebase statistics
4. Query Claude Haiku:
   - Model: haiku
   - Tools: read_file, glob, grep
   - Partial messages enabled
5. Parse recommendations:
   - JSON array format preferred
   - Regex fallback for plugin names
6. Validate against marketplace
7. Always include "bushido"
```

### Settings Update

```typescript
// Plugin enablement format
{
  "enabledPlugins": {
    "bushido@han": true,
    "jutsu-typescript@han": true,
    "do-backend-development@han": true
  }
}
```

**Scope Behavior:**

- **user** - Shared across all projects, keeps invalid plugins
- **project** - Team-shared, removes deselected plugins
- **local** - Personal, removes deselected plugins

### Marketplace Integration

**Marketplace Source:**

```json
{
  "extraKnownMarketplaces": {
    "han": {
      "source": {
        "source": "github",
        "repo": "thebushidocollective/han"
      }
    }
  }
}
```

**Plugin Discovery:**

- Fetches `marketplace.json` from GitHub
- Lists all available plugins with metadata
- Supports directory and git sources

### Dispatch Hooks Setup

After installation, ensures dispatch hooks are configured:

```json
{
  "hooks": {
    "UserPromptSubmit": [{
      "hooks": [{
        "type": "command",
        "command": "npx -y @thebushidocollective/han hook dispatch UserPromptSubmit"
      }]
    }],
    "SessionStart": [{
      "hooks": [{
        "type": "command",
        "command": "npx -y @thebushidocollective/han hook dispatch SessionStart"
      }]
    }]
  }
}
```

## Files

- `lib/commands/plugin/install.ts` - Command handler
- `lib/install.ts` - Auto-detection orchestration
- `lib/plugin-install.ts` - Core installation logic
- `lib/shared.ts` - Marketplace access, agent detection
- `lib/install-interactive.tsx` - Interactive Ink UI

## Related Systems

- [Settings Management](./settings-management.md) - Where plugins are stored
- [Hook System](./hook-system.md) - Dispatch hooks setup
