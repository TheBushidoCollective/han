---
name: plugin-installation
summary: Multi-scope plugin installation with auto-detection, three-tier UX fallback, and npm distribution
---

# Plugin Installation

Multi-scope plugin installation with auto-detection, three-tier UX fallback, and npm distribution.

## Overview

Han provides a comprehensive plugin installation system that supports:

1. **Three installation scopes** - user, project, and local settings
2. **AI-powered auto-detection** - Agent SDK analyzes codebase to recommend plugins
3. **Three-tier UX fallback** - Setup hook, graceful degradation, documentation
4. **Short plugin names** - `typescript`, `github`, `biome` (no prefixes)
5. **Backward-compatible aliases** - `jutsu-typescript`, `hashi-github`, etc. still work
6. **npm distribution** - `@thebushidocollective/han` wrapper with platform binaries

## Architecture

### Installation Flow

```
User Command (han plugin install)
    ↓
┌─────────────────────────────────────┐
│ Installation Mode Selection         │
├─────────────────────────────────────┤
│ • --auto: AI + marker detection     │
│ • Explicit names: Direct install    │
│ • Interactive: Plugin selector UI   │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Marketplace Validation              │
├─────────────────────────────────────┤
│ Fetch marketplace.json from GitHub  │
│ Validate plugin names exist         │
│ Resolve aliases to canonical names  │
└─────────────────────────────────────┘
    ↓
┌─────────────────────────────────────┐
│ Settings Update                     │
├─────────────────────────────────────┤
│ User: ~/.claude/settings.json       │
│ Project: .claude/settings.json      │
│ Local: .claude/settings.local.json  │
└─────────────────────────────────────┘
```

### Binary Installation (Three-Tier Fallback)

```
Tier 1: Setup Hook (Auto-Install)
    ↓
Claude Code enables han plugin
    ↓
Setup hook runs (--init or --init-only)
    ↓
Detects if han binary exists
    ↓
┌─────────────────────────────────────┐
│ Found in PATH or ~/.claude/bin?     │
└─────────────────────────────────────┘
    │              │
    Yes            No
    │              │
    │              ↓
    │    Auto-install via curl
    │    curl -fsSL https://han.guru/install.sh | bash
    │              │
    │              ↓
    │    Install to ~/.claude/bin/han
    │              │
    └──────────────┘
            ↓
    Show PATH setup instructions
            ↓
Tier 2: Graceful Degradation
    ↓
Hook runs, han not found (exit 127)
    ↓
Show helpful error with install options
    ↓
Tier 3: Documentation
    ↓
Plugin README, han.guru, error messages
```

## API / Interface

### CLI Commands

#### `han plugin install [plugins...]`

Install plugins by name.

```bash
# Install specific plugins (short names)
han plugin install typescript github biome

# Auto-detect plugins for project
han plugin install --auto

# Install to different scopes
han plugin install --scope user playwright
han plugin install --scope project biome
han plugin install --scope local

# Interactive selection (no auto-detect)
han plugin install --interactive
```

**Options:**

- `--auto` - AI-powered detection with marker fallback
- `--scope <scope>` - Installation scope: user (default), project, local
- `--interactive` - Show plugin selector without auto-detection

#### `han plugin uninstall <plugins...>`

Remove plugins from settings.

```bash
han plugin uninstall typescript github
```

### Installation Scopes

| Scope | File | Behavior | Use Case |
|-------|------|----------|----------|
| **user** (default) | `~/.claude/settings.json` | Shared across all projects. Only adds plugins and cleans invalid ones (no removal of deselected). | MCP servers, general-purpose plugins (services, disciplines) |
| **project** | `.claude/settings.json` | Team-shared via git. Removes deselected plugins. | Project-specific validation hooks, team conventions |
| **local** | `.claude/settings.local.json` | Gitignored (.gitignore'd). Removes deselected plugins. | Personal preferences not shared with team |

**Scope recommendations:**

- **user**: Services (github, gitlab), disciplines (frontend-development), MCP servers
- **project**: Validation plugins with Stop hooks (biome, eslint, playwright)
- **local**: Personal tools and experimental plugins

### Plugin Naming

**Current (Correct):**

```bash
han plugin install typescript
han plugin install github
han plugin install biome
han plugin install frontend-development
```

**Legacy (Still Works via Aliases):**

```bash
han plugin install jutsu-typescript    # Resolves to typescript
han plugin install hashi-github        # Resolves to github
han plugin install do-frontend-development  # Resolves to frontend-development
```

## Behavior

### Auto-Detection with --auto Flag

**Two-stage detection:**

1. **Marker Detection (Instant)** - Scans for config files (tsconfig.json, .biome.json, etc.)
2. **AI Analysis (Optional)** - Agent SDK with Claude Haiku analyzes codebase

```typescript
// Detection flow
const markerDetection = detectPluginsByMarkers(pluginsWithDetection, cwd);
// Returns: { confident: [...], possible: [...] }

const aiPlugins = await detectPluginsWithAgent(callbacks);
// Agent analyzes file stats, git remote, project structure

const mergedPlugins = [...markerDetection.confident, ...markerDetection.possible, ...aiPlugins];
```

**Agent SDK Configuration:**

- Model: `claude-haiku`
- Tools: `read_file`, `glob`, `grep`
- Partial messages enabled
- Timeout: 60 seconds

**Prompt includes:**

- All available marketplace plugins
- Currently installed plugins
- Codebase file statistics (extension counts)
- Git remote URL (if available)
- Directory structure hints

**Agent returns:**

- JSON array of plugin names (preferred)
- Free text with plugin names (regex fallback)
- Always includes "bushido" as default

### Settings Update Behavior

```typescript
// Sync plugins to settings
function syncPluginsToSettings(
  selectedPlugins: string[],
  validPluginNames: Set<string>,
  scope: InstallScope
): PluginChanges {
  // 1. Add newly selected plugins
  // 2. Remove invalid plugins (all scopes)
  // 3. Remove deselected plugins (project/local only)
  // 4. Always include "core" plugin
  // 5. Update extraKnownMarketplaces with han marketplace
}
```

**Settings format:**

```json
{
  "extraKnownMarketplaces": {
    "han": {
      "source": {
        "source": "github",
        "repo": "thebushidocollective/han"
      }
    }
  },
  "enabledPlugins": {
    "core@han": true,
    "bushido@han": true,
    "typescript@han": true,
    "github@han": true
  }
}
```

**Plugin name format:** `{name}@{marketplace}`

### Binary Distribution

**npm wrapper package:**

```json
{
  "name": "@thebushidocollective/han",
  "bin": {
    "han": "./bin/han.js"
  },
  "optionalDependencies": {
    "@thebushidocollective/han-linux-x64": "^1.0.0",
    "@thebushidocollective/han-linux-arm64": "^1.0.0",
    "@thebushidocollective/han-darwin-x64": "^1.0.0",
    "@thebushidocollective/han-darwin-arm64": "^1.0.0",
    "@thebushidocollective/han-win32-x64": "^1.0.0"
  }
}
```

**Platform-specific packages:**

- Each contains a single binary for that platform
- Installed automatically based on `process.platform` and `process.arch`
- Falls back to download if optionalDependency install fails

**MCP server configuration:**

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

**Hooks use han directly:**

```yaml
hooks:
  context:
    event: SessionStart
    command: han hook context
```

**Install methods:**

1. **npx** (recommended for MCP/ephemeral environments)
   ```bash
   npx -y @thebushidocollective/han plugin install --auto
   ```

2. **curl installer** (recommended for permanent installation)
   ```bash
   curl -fsSL https://han.guru/install.sh | bash
   ```

3. **Homebrew** (macOS/Linux)
   ```bash
   brew install thebushidocollective/tap/han
   ```

### Setup Hook Auto-Install

**Hook definition (core/han-plugin.yml):**

```yaml
hooks:
  setup:
    event: Setup
    command: bash "${CLAUDE_PLUGIN_ROOT}/hooks/setup.sh"
    description: Ensure han binary is installed and available
```

**Setup script behavior:**

1. Checks for han in PATH or `~/.claude/bin/han`
2. If not found and `--init` or `--init-only` flag present:
   - Downloads install.sh from https://han.guru/install.sh
   - Executes installer (installs to `~/.claude/bin/han`)
   - Shows PATH setup instructions
3. If install fails:
   - Shows manual installation options (curl, Homebrew)
   - Exits with code 0 (doesn't block plugin installation)
4. If already installed:
   - Shows version info
   - No action needed

**PATH setup:**

```bash
# Add to ~/.bashrc or ~/.zshrc
export PATH="$HOME/.claude/bin:$PATH"
```

**Note:** han in `~/.claude/bin` is found by hooks even without PATH modification.

### Graceful Degradation

**If han binary not installed and hook runs:**

1. Hook command fails with exit code 127 (command not found)
2. Hook system detects the error
3. Shows user-friendly message:

```
✗ Han binary not found

The han plugin requires the han CLI, but it's not installed or not in PATH.

Quick Fix:

  Install via curl (recommended):
    curl -fsSL https://han.guru/install.sh | bash

  Or via Homebrew:
    brew install thebushidocollective/tap/han

After installing, restart your Claude Code session.
```

## User Flows

### Flow 1: Fresh Install (Happy Path)

```
1. User enables han plugin in Claude Code
2. Setup hook runs automatically (--init)
3. Detects han not installed
4. Auto-installs to ~/.claude/bin/han
5. Shows PATH setup instructions
6. User optionally adds to shell profile
7. ✓ Hooks work immediately
```

### Flow 2: Auto-Detect Plugins

```
1. User runs: han plugin install --auto
2. Marker detection scans for config files (instant)
3. AI analysis with Agent SDK (if enabled)
4. Plugin selector shows detected + all plugins
5. User selects plugins to install
6. Settings updated with selected plugins
7. ✓ Restart Claude Code to load plugins
```

### Flow 3: Explicit Plugin Installation

```
1. User runs: han plugin install typescript github biome
2. Marketplace validation (fetch from GitHub)
3. Validate all plugin names exist
4. Resolve aliases to canonical names
5. Add to settings with scope (default: user)
6. ✓ Plugins installed, restart Claude Code
```

### Flow 4: Interactive Selection

```
1. User runs: han plugin install --interactive
2. Fetch marketplace plugins
3. Show Ink UI plugin selector
4. User browses and selects plugins
5. Settings updated with selections
6. ✓ Restart Claude Code
```

## Components

### Core Files

- `lib/commands/plugin/install.ts` - CLI command handler
- `lib/install.ts` - Auto-detection orchestration (marker + AI)
- `lib/plugin-install.ts` - Core installation logic (deprecated, merged into install.ts)
- `lib/marker-detection.ts` - File marker-based plugin detection
- `lib/shared.ts` - Marketplace access, agent detection, settings
- `lib/install-interactive.tsx` - Ink UI component for AI detection
- `lib/plugin-selector.tsx` - Ink UI component for plugin selection
- `lib/plugin-aliases.ts` - Mapping of legacy names to current names

### Setup Hook Files

- `plugins/core/hooks/setup.sh` - Setup hook script with auto-install
- `plugins/core/hooks/han-not-found-helper.sh` - Helper error message
- `plugins/core/han-plugin.yml` - Setup hook registration

### Distribution Files

- `packages/han/package.json` - npm wrapper package
- `packages/han-{platform}/package.json` - Platform-specific binary packages
- `scripts/publish-npm.sh` - npm publishing automation

## Marketplace Integration

**Marketplace source:**

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

**Fetch URL:**

```
https://raw.githubusercontent.com/thebushidocollective/han/main/.claude-plugin/marketplace.json
```

**Marketplace structure:**

```json
{
  "name": "han",
  "owner": { ... },
  "metadata": { ... },
  "plugins": [
    {
      "name": "typescript",
      "description": "TypeScript expertise with validation",
      "source": "./plugins/languages/typescript",
      "category": "Language",
      "keywords": ["typescript", "validation"]
    },
    {
      "name": "jutsu-typescript",  // Alias for backward compatibility
      "description": "TypeScript expertise with validation",
      "source": "./plugins/languages/typescript",  // Same source
      "category": "Language",
      "keywords": ["typescript", "validation"]
    }
  ]
}
```

**Alias resolution:**

- CLI resolves aliases to canonical names before installation
- Claude Code resolves plugin names directly from marketplace.json
- Aliases MUST remain in marketplace.json for existing installations
- DO NOT add `deprecated` or `alias_for` fields (causes schema errors)

## Related Systems

- [Marketplace](./marketplace.md) - Plugin registry and distribution
- [Settings Management](./settings-management.md) - Where plugins are stored
- [Hook System](./hook-system.md) - Plugin hooks execution
- [Distribution Architecture](./distribution-architecture.md) - npm wrapper pattern