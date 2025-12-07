---
name: marketplace
summary: Central plugin registry and distribution
---

# Marketplace System

Central registry of all plugins with metadata, validation, and multi-channel distribution.

## Overview

The marketplace system serves as the source of truth for all 120+ Han plugins. It provides a unified registry that powers both the CLI installation process and the website discovery interface.

## Architecture

### Source of Truth

**File**: `.claude-plugin/marketplace.json`

**Location**: Repository root

**Purpose**: Single authoritative source for all plugin metadata

### Data Structure

```json
{
  "name": "han",
  "owner": {
    "name": "The Bushido Collective",
    "url": "https://thebushido.co"
  },
  "metadata": {
    "description": "A curated marketplace of Claude Code plugins",
    "version": "3.0.0",
    "url": "https://han.guru"
  },
  "plugins": [
    {
      "name": "bushido",
      "description": "Core foundation with quality principles",
      "source": "./bushido",
      "category": "Core",
      "keywords": ["quality", "principles", "foundation"]
    },
    {
      "name": "jutsu-typescript",
      "description": "TypeScript expertise with validation",
      "source": "./jutsu/jutsu-typescript",
      "category": "Technique",
      "keywords": ["typescript", "validation", "type-checking"]
    }
  ]
}
```

## API / Interface

### Plugin Entry Schema

```typescript
interface PluginEntry {
  name: string;              // Unique plugin identifier
  description: string;       // Human-readable description
  source: string;            // Local path or remote URL
  category: PluginCategory;  // Classification
  keywords: string[];        // Searchable tags
}

type PluginCategory = "Core" | "Technique" | "Discipline" | "Bridge";
```

### Category Mapping

| Category    | Directory | Count | Purpose |
|-------------|-----------|-------|---------|
| Core        | bushido/  | 1     | Foundation principles and quality skills |
| Technique   | jutsu/    | 88    | Tool-specific expertise and validation |
| Discipline  | do/       | 30    | Specialized agents for practices |
| Bridge      | hashi/    | 9     | MCP servers for external integrations |

## Behavior

### Plugin Registration

**Manual Addition**:

1. Create plugin directory with `.claude-plugin/plugin.json`
2. Add entry to marketplace.json
3. Ensure category matches directory structure
4. Provide descriptive keywords for searchability

**Validation** (via claudelint):

- Plugin name matches directory name
- Source path is valid and exists
- Category is one of allowed values
- Keywords are non-empty array
- Description is present and meaningful

### CLI Integration

**Fetch Flow**:

```typescript
// From lib/shared.ts
async function fetchMarketplace(): Promise<Marketplace> {
  const url = 'https://raw.githubusercontent.com/thebushidocollective/han/main/.claude-plugin/marketplace.json';
  const response = await fetch(url);
  return await response.json();
}
```

**Usage**:

- Plugin search: Filter by keywords/name
- Plugin install: Validate plugin exists before installation
- Auto-detection: Match detected technologies to plugin keywords

**Caching**:

- Marketplace is fetched fresh on each command invocation
- No client-side caching (ensures latest plugins available)
- Fast fetch (~100ms) from GitHub CDN

### Website Integration

**Transformation** (see [Website System](./website.md)):

```typescript
// scripts/generate-marketplace.ts
function transformForWeb(marketplace: Marketplace): WebMarketplace {
  return {
    ...marketplace,
    plugins: marketplace.plugins.map(plugin => ({
      ...plugin,
      source: plugin.source.startsWith('./')
        ? `https://github.com/thebushidocollective/han/tree/main${plugin.source.slice(1)}`
        : plugin.source
    }))
  };
}
```

**Purpose**:

- Convert local paths to GitHub URLs for web navigation
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
  commands: [...],   // Detected from commands/ directory
  agents: [...],     // Detected from agents/ directory
  hooks: [...]       // Detected from hooks/ directory
};
```

**Searchable Fields** (weighted):

1. Name (2.0x)
2. Description (1.5x)
3. Keywords (1.0x)
4. Skills (0.8x)
5. Commands (0.8x)

## Plugin Lifecycle

### Addition

1. Create plugin in appropriate directory
2. Add `.claude-plugin/plugin.json`
3. Register in marketplace.json
4. Commit and push to main
5. Plugin available immediately via GitHub CDN

### Update

1. Modify plugin files
2. Update description/keywords in marketplace.json if needed
3. Commit and push
4. Changes reflected immediately

### Removal

1. Remove plugin directory
2. Remove entry from marketplace.json
3. Website regenerates without removed plugin
4. CLI will no longer find plugin in searches

### Versioning

**Marketplace Version**:

- Semantic versioning (e.g., "3.0.0")
- Incremented for breaking changes to marketplace structure
- Independent of individual plugin versions

**Plugin Versions**:

- Tracked in individual `.claude-plugin/plugin.json`
- Not exposed in marketplace.json (CLI uses latest from repo)

## Distribution Channels

### 1. GitHub Raw CDN

**URL**: `https://raw.githubusercontent.com/thebushidocollective/han/main/.claude-plugin/marketplace.json`

**Consumers**:

- CLI (direct fetch)
- Third-party tools
- Manual inspection

**Benefits**:

- Always up-to-date
- Fast global CDN
- No additional infrastructure

### 2. GitHub Pages (Website)

**URL**: `https://han.guru/marketplace.json`

**Consumers**:

- Web application
- Search engines
- Discovery tools

**Benefits**:

- Human-readable web interface
- Search functionality
- Documentation rendering

### 3. npm Registry

**Package**: `@thebushidocollective/han`

**Embedded**: Not included in npm package (CLI fetches from GitHub)

**Reason**: Ensures users always get latest plugin list without waiting for npm release

## Files

### Source

- `.claude-plugin/marketplace.json` - Authoritative registry

### Generation

- `website/scripts/generate-marketplace.ts` - Web transformation script
- `website/scripts/generate-search-index.ts` - Search index builder

### Output

- `website/public/marketplace.json` - Web-formatted marketplace
- `website/public/search-index.json` - Search index

### Validation

- `.github/workflows/claudelint.yml` - Marketplace structure validation

## Related Systems

- [Plugin Installation](./plugin-installation.md) - Consumes marketplace for validation
- [Website](./website.md) - Displays and searches marketplace
- [Plugin Directory](./plugin-directory.md) - Plugins registered in marketplace
- [Build & Deployment](./build-deployment.md) - Validates marketplace structure
