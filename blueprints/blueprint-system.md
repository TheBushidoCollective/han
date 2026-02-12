---
name: blueprint-system
summary: Skills-based blueprint management with frontmatter metadata
---

# Blueprint System

Skills-based blueprint management system using native Claude Code tools for technical documentation.

## Overview

The blueprint system is provided by the **blueprints** plugin, which includes skills, hooks, and auto-generated index files. Blueprints are stored as markdown files in `blueprints/` at the repository root, with YAML frontmatter containing metadata for discovery and indexing.

## Architecture

### Components

- **Blueprint Files** (`blueprints/*.md`) - Markdown files with frontmatter metadata
- **Skills** (`plugins/tools/blueprints/skills/`) - Guidelines for writing, maintaining, and organizing blueprints
- **Hooks** (`plugins/tools/blueprints/hooks/`) - SessionStart hook for index generation
- **Sync-Index CLI** (`packages/han/lib/commands/blueprints/index.ts`) - Generates `.claude/rules/blueprints/blueprints-index.md`
- **Frontmatter Parser** (`packages/han/lib/commands/mcp/blueprints.ts`) - Extracts `name` and `summary` from YAML frontmatter

### Data Flow

1. SessionStart hook runs `han blueprints sync-index`
2. CLI reads all `blueprints/*.md` files and parses frontmatter
3. Generates index at `.claude/rules/blueprints/blueprints-index.md`
4. Index is auto-loaded into Claude Code context as a rules file
5. Agent uses native tools (Glob, Grep, Read, Write) to interact with blueprints

## API / Interface

### Native Tool Patterns

#### List all blueprints

```
Glob("blueprints/*.md")
```

Returns all blueprint file paths.

#### Search by keyword

```
Grep("keyword", path: "blueprints/", output_mode: "files_with_matches")
```

Searches blueprint content and frontmatter for matching files.

#### Read a blueprint

```
Read("blueprints/system-name.md")
```

Returns the full file content including frontmatter.

#### Write a blueprint

```
Write("blueprints/system-name.md", content_with_frontmatter)
```

Creates or updates a blueprint. Content MUST include frontmatter:

```yaml
---
name: system-name
summary: Brief one-line description
---
```

### Blueprint File Format

Required frontmatter structure:

```yaml
---
name: system-name
summary: Brief one-line description
---
```

Rules:

- `name` must match filename (without .md)
- `summary` used for search and discovery
- Frontmatter required for index generation

## Behavior

### Blueprint Discovery

The auto-generated index at `.claude/rules/blueprints/blueprints-index.md` provides a table of all blueprints with their names and summaries. This is loaded into context at session start, giving the agent immediate awareness of available documentation.

For deeper searches, agents use `Glob` and `Grep` directly on the `blueprints/` directory.

### Frontmatter Parsing

Simple YAML parser for `name: value` pairs:

```typescript
const match = content.match(/^---\n([\s\S]*?)\n---\n([\s\S]*)$/);
const lines = frontmatter.split('\n');
for (const line of lines) {
  const [key, value] = line.split(':').map(s => s.trim());
  if (key === 'name' || key === 'summary') {
    metadata[key] = value;
  }
}
```

### Error Handling

- **Missing blueprints directory** - Sync-index returns count 0
- **Missing frontmatter** - File listed with placeholder summary
- **Write errors** - Propagated by the Write tool

## Files

- `plugins/tools/blueprints/.claude-plugin/plugin.json` - Plugin metadata
- `plugins/tools/blueprints/han-plugin.yml` - Plugin configuration
- `plugins/tools/blueprints/hooks/hooks.json` - SessionStart hook for sync-index
- `plugins/tools/blueprints/hooks/ensure-blueprints.md` - Documentation requirements
- `plugins/tools/blueprints/hooks/blueprint-system-info.md` - Tool usage reference
- `plugins/tools/blueprints/skills/` - Skill definitions
- `plugins/tools/blueprints/README.md` - Plugin documentation
- `packages/han/lib/commands/mcp/blueprints.ts` - Sync-index implementation
- `packages/han/lib/commands/blueprints/index.ts` - CLI command registration
- `blueprints/*.md` - Blueprint files with frontmatter

## Related Systems

- [CLI Architecture](./cli-architecture.md) - CLI command structure
- [Hook System](./hook-system.md) - SessionStart hook execution
- [Plugin Installation](./plugin-installation.md) - Installing blueprints plugin
