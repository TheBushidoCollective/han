---
name: marketplace
summary: Central plugin registry with canonical names, backward-compatible aliases, and category-based organization
---

# Marketplace System

Central plugin registry with canonical names, backward-compatible aliases, and category-based organization.

## Overview

The marketplace system is the authoritative source for all Han plugins. It provides:

1. **Single source of truth** - `.claude-plugin/marketplace.json` in repository root
2. **120+ plugins** across 7 categories
3. **Canonical short names** - `typescript`, `github`, `biome` (no prefixes)
4. **Backward-compatible aliases** - `jutsu-typescript`, `hashi-github` still work
5. **Multi-channel distribution** - GitHub CDN, website, Claude Code integration

## Architecture

### Source of Truth

**File:** `.claude-plugin/marketplace.json`

**Location:** Repository root (`/Volumes/dev/src/github.com/thebushidocollective/han/.claude-plugin/marketplace.json`)

**Purpose:** Single authoritative source for all plugin metadata

**Access URL:**

```
https://raw.githubusercontent.com/thebushidocollective/han/main/.claude-plugin/marketplace.json
```

### Data Structure

```json
{
  "name": "han",
  "owner": {
    "name": "The Bushido Collective",
    "url": "https://thebushido.co"
  },
  "metadata": {
    "description": "Honor in software development...",
    "version": "3.0.0"
  },
  "plugins": [
    {
      "name": "typescript",
      "description": "TypeScript expertise with validation",
      "source": "./plugins/languages/typescript",
      "category": "Language",
      "keywords": ["typescript", "validation", "type-checking"]
    },
    {
      "name": "jutsu-typescript",  // ALIAS - DO NOT REMOVE
      "description": "TypeScript expertise with validation",
      "source": "./plugins/languages/typescript",  // Same source as canonical
      "category": "Language",
      "keywords": ["typescript", "validation", "type-checking"]
    }
  ]
}
```

## API / Interface

### Plugin Entry Schema

```typescript
interface MarketplacePlugin {
  name: string;              // Unique identifier (canonical or alias)
  description: string;       // Human-readable description
  source: string;            // Local path (./plugins/...) or remote URL
  category: PluginCategory;  // Classification
  keywords: string[];        // Searchable tags
}

type PluginCategory = 
  | "Core" 
  | "Language" 
  | "Validation" 
  | "Tool" 
  | "Framework" 
  | "Integration" 
  | "Discipline" 
  | "Specialized";
```

### Category Mapping

| Category | Directory | Count | Purpose | Examples |
|----------|-----------|-------|---------|----------|
| Core | `plugins/core/` | 2 | Foundation and quality principles | `bushido`, `core` |
| Language | `plugins/languages/` | 15 | Language-specific expertise | `typescript`, `rust`, `go`, `python` |
| Validation | `plugins/validation/` | 8 | Code quality and linting | `biome`, `eslint`, `rubocop`, `clippy` |
| Tool | `plugins/tools/` | 25 | Development tools | `docker`, `git`, `terraform`, `ansible` |
| Framework | `plugins/frameworks/` | 12 | Framework-specific skills | `nextjs`, `relay`, `phoenix`, `django` |
| Integration | `plugins/services/` | 18 | MCP servers for external services | `github`, `gitlab`, `linear`, `slack` |
| Discipline | `plugins/disciplines/` | 30 | Specialized agent roles | `frontend-development`, `api-engineering`, `security-engineering` |
| Specialized | `plugins/specialized/` | 10 | Domain-specific plugins | `aws`, `gcp`, `kubernetes`, `android` |

## Behavior

### Plugin Naming Convention

**Current (Canonical Names):**

Plugins use short, descriptive identifiers matching their directory name:

| Category | Directory | Plugin Name |
|----------|-----------|-------------|
| Languages | `languages/typescript` | `typescript` |
| Languages | `languages/rust` | `rust` |
| Validation | `validation/biome` | `biome` |
| Services | `services/github` | `github` |
| Disciplines | `disciplines/frontend-development` | `frontend-development` |

**Legacy (Aliases - MUST REMAIN):**

Old naming convention with prefixes is deprecated but aliases exist:

| Old Format | Canonical Name | Maps To |
|------------|----------------|---------|
| `jutsu-typescript` | `typescript` | `./plugins/languages/typescript` |
| `jutsu-biome` | `biome` | `./plugins/validation/biome` |
| `hashi-github` | `github` | `./plugins/services/github` |
| `hashi-gitlab` | `gitlab` | `./plugins/services/gitlab` |
| `do-frontend-development` | `frontend-development` | `./plugins/disciplines/frontend-development` |
| `do-api-engineering` | `api-engineering` | `./plugins/disciplines/api-engineering` |

### Alias Entry Requirements (CRITICAL)

**Why Aliases Must Remain:**

1. **Existing user installations** have old plugin names in settings files
2. **Claude Code resolves plugins** directly from marketplace.json by name
3. **Removing aliases breaks installations** - users see "Plugin not found" errors
4. **No client-side alias resolution** - marketplace.json is the source of truth

**Correct Alias Format:**

```json
{
  "name": "typescript",
  "description": "TypeScript expertise with validation",
  "source": "./plugins/languages/typescript",
  "category": "Language",
  "keywords": ["typescript", "validation"]
},
{
  "name": "jutsu-typescript",  // Alias entry
  "description": "TypeScript expertise with validation",
  "source": "./plugins/languages/typescript",  // Same source
  "category": "Language",
  "keywords": ["typescript", "validation"]
}
```

**Both entries point to the same directory. This is intentional and required.**

**FORBIDDEN - Do NOT Add These Fields:**

```json
// WRONG - causes Claude Code schema validation errors
{
  "name": "jutsu-typescript",
  "deprecated": true,          // DO NOT ADD
  "alias_for": "typescript",   // DO NOT ADD
  "source": "./plugins/languages/typescript",
  ...
}
```

Keep alias entries as normal plugin entries identical to canonical entries except for the name.

### Common Alias Patterns

| Pattern | Example | Maps To |
|---------|---------|---------|
| `jutsu-{name}` | `jutsu-typescript` | `languages/typescript` |
| `jutsu-{name}` | `jutsu-biome` | `validation/biome` |
| `hashi-{name}` | `hashi-github` | `services/github` |
| `hashi-{name}` | `hashi-gitlab` | `services/gitlab` |
| `do-{name}` | `do-api` | `disciplines/api-engineering` |
| `do-{name}-engineering` | `do-api-engineering` | `disciplines/api-engineering` |
| `do-{name}-development` | `do-frontend-development` | `disciplines/frontend-development` |

### Plugin Registration

**Manual Addition:**

1. Create plugin directory: `plugins/{category}/{name}/`
2. Add `.claude-plugin/plugin.json`
3. Add entry to marketplace.json (canonical name)
4. Add alias entries if needed (backward compatibility)
5. Ensure category matches directory structure
6. Provide descriptive keywords for searchability

**Validation (via claudelint):**

- Plugin name matches directory name (for canonical entries)
- Source path is valid and exists
- Category is one of allowed values
- Keywords are non-empty array
- Description is present and meaningful

### CLI Integration

**Fetch Flow:**

```typescript
// From lib/shared.ts
async function fetchMarketplace(): Promise<MarketplacePlugin[]> {
  const url = 'https://raw.githubusercontent.com/thebushidocollective/han/main/.claude-plugin/marketplace.json';
  const response = await fetch(url);
  const marketplace = await response.json();
  return marketplace.plugins;
}
```

**Usage:**

- **Plugin search:** Filter by keywords/name/category
- **Plugin install:** Validate plugin exists before installation
- **Auto-detection:** Match detected technologies to plugin keywords
- **Alias resolution:** Accept both canonical and alias names

**Caching:**

- Marketplace is fetched fresh on each command invocation
- No client-side caching (ensures latest plugins available)
- Fast fetch (~100ms) from GitHub CDN

**Alias Resolution:**

```typescript
// From lib/plugin-aliases.ts
const PLUGIN_ALIASES: Record<string, string> = {
  'jutsu-typescript': 'languages/typescript',
  'jutsu-biome': 'validation/biome',
  'hashi-github': 'services/github',
  'do-frontend-development': 'disciplines/frontend-development',
  // ... etc
};

function resolvePluginName(name: string): string {
  // Check if it's an alias
  const path = PLUGIN_ALIASES[name];
  if (path) {
    // Extract canonical name from path
    return path.split('/').pop() || name;
  }
  return name;
}
```

**Note:** CLI resolves aliases, but Claude Code does NOT - it reads marketplace.json directly.

### Website Integration

**Transformation (for web display):**

```typescript
// scripts/generate-marketplace.ts
function transformForWeb(marketplace: Marketplace): WebMarketplace {
  return {
    ...marketplace,
    plugins: marketplace.plugins
      .filter(p => !isAlias(p))  // Filter out alias entries for web display
      .map(plugin => ({
        ...plugin,
        source: plugin.source.startsWith('./')
          ? `https://github.com/thebushidocollective/han/tree/main${plugin.source.slice(1)}`
          : plugin.source
      }))
  };
}
```

**Purpose:**

- Convert local paths to GitHub URLs for web navigation
- Filter out alias entries (show only canonical names)
- Enable direct linking to plugin source code
- Preserve all other metadata unchanged

### Search Integration

Plugins are indexed for full-text search:

```typescript
// From website search index generation
const searchEntry = {
  name: plugin.name,
  category: plugin.category,
  description: plugin.description,
  keywords: plugin.keywords,
  // Additional fields from plugin scanning:
  skills: [...],     // Detected from skills/ directory
  commands: [...],   // Detected from commands/ directory (deprecated)
  agents: [...],     // Detected from agents/ directory
  hooks: [...]       // Detected from hooks/ directory
};
```

**Searchable Fields (weighted):**

1. Name (2.0x)
2. Description (1.5x)
3. Keywords (1.0x)
4. Skills (0.8x)
5. Category (0.5x)

## Plugin Lifecycle

### Addition

1. Create plugin in appropriate directory (`plugins/{category}/{name}/`)
2. Add `.claude-plugin/plugin.json`
3. Register canonical name in marketplace.json
4. Add alias entries if needed (for migration from old names)
5. Commit and push to main
6. Plugin available immediately via GitHub CDN

### Update

1. Modify plugin files
2. Update description/keywords in marketplace.json if needed
3. Commit and push
4. Changes reflected immediately in CLI and website

### Removal

1. **DO NOT remove alias entries** (breaks existing installations)
2. Can remove canonical entry if plugin is fully deprecated
3. Website regenerates without removed plugin
4. CLI will no longer find plugin in searches (unless alias exists)

### Versioning

**Marketplace Version:**

- Semantic versioning (e.g., "3.0.0")
- Incremented for breaking changes to marketplace structure
- Independent of individual plugin versions

**Plugin Versions:**

- Tracked in individual `.claude-plugin/plugin.json`
- Not exposed in marketplace.json (CLI uses latest from repo)

## Distribution Channels

### 1. GitHub Raw CDN

**URL:** `https://raw.githubusercontent.com/thebushidocollective/han/main/.claude-plugin/marketplace.json`

**Consumers:**

- CLI (direct fetch in `lib/shared.ts`)
- Claude Code (marketplace resolution)
- Third-party tools
- Manual inspection

**Benefits:**

- Always up-to-date
- Fast global CDN
- No additional infrastructure
- Single source of truth

### 2. GitHub Pages (Website)

**URL:** `https://han.guru/marketplace.json`

**Consumers:**

- Web application (han.guru)
- Search engines
- Discovery tools
- Documentation

**Benefits:**

- Human-readable web interface
- Search functionality
- Documentation rendering
- Plugin browsing

**Transformation:**

- Filters out alias entries
- Converts local paths to GitHub URLs
- Adds plugin scanning metadata (skills, hooks, etc.)

### 3. Claude Code Integration

**Registration in Settings:**

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

**Claude Code behavior:**

1. Fetches marketplace.json from GitHub
2. Resolves plugin names directly (no alias resolution)
3. Validates plugin exists in marketplace
4. Clones plugin source from repository

**Important:** Aliases MUST exist in marketplace.json for Claude Code to resolve them.

### 4. npm Registry (Indirect)

**Package:** `@thebushidocollective/han`

**Embedded:** NOT included in npm package

**Reason:** CLI fetches from GitHub to ensure latest plugin list without waiting for npm release

## Debugging Plugin Resolution

### "Plugin not found" Errors

**Check:**

1. Plugin name exists in marketplace.json (exact match)
2. Source path is correct: `./plugins/{category}/{name}`
3. Target directory actually exists in repository
4. For aliases: both alias and canonical entries exist
5. For aliases: both point to same source directory

**Common issues:**

- Alias removed from marketplace.json (re-add it)
- Source path missing `./plugins/` prefix
- Category changed but source path not updated
- Plugin directory renamed but marketplace not updated

### Alias Resolution

**CLI behavior:**

```
User installs: jutsu-typescript
    ↓
CLI resolves to: typescript (via plugin-aliases.ts)
    ↓
Validates: typescript exists in marketplace
    ↓
Adds to settings: typescript@han
```

**Claude Code behavior:**

```
Settings has: jutsu-typescript@han
    ↓
Claude Code fetches marketplace.json
    ↓
Finds entry: { name: "jutsu-typescript", source: "./plugins/languages/typescript" }
    ↓
Clones: plugins/languages/typescript
```

**Critical:** If alias entry missing, Claude Code fails to resolve.

## Files

### Source

- `.claude-plugin/marketplace.json` - Authoritative registry

### Generation

- `website/scripts/generate-marketplace.ts` - Web transformation script
- `website/scripts/generate-search-index.ts` - Search index builder

### Output

- `website/public/marketplace.json` - Web-formatted marketplace (canonical only)
- `website/public/search-index.json` - Search index
- `website/out/marketplace.json` - Build output

### Validation

- `.github/workflows/claudelint.yml` - Marketplace structure validation
- `scripts/validate-marketplace.sh` - Schema validation script

### Client Code

- `packages/han/lib/shared.ts` - Marketplace fetching
- `packages/han/lib/plugin-aliases.ts` - Alias resolution map

## Related Systems

- [Plugin Installation](./plugin-installation.md) - Consumes marketplace for validation
- [Website](./website.md) - Displays and searches marketplace
- [Plugin Directory](./plugin-directory.md) - Plugins registered in marketplace
- [Build & Deployment](./build-deployment.md) - Validates marketplace structure
- [Settings Management](./settings-management.md) - Plugin enablement format