---
name: blueprint-system
summary: MCP-based blueprint management with frontmatter metadata
---

# Blueprint System

MCP-based blueprint management system providing programmatic access to technical documentation.

## Overview

The blueprint system is provided by:

1. **hashi-blueprints** - Unified MCP server, skills, and documentation for blueprint management

Blueprints are stored as markdown files in `blueprints/` at the repository root, with YAML frontmatter containing metadata for programmatic access.

## Architecture

### Components

- **MCP Server** (`packages/bushido-han/lib/commands/mcp/blueprints.ts`) - JSON-RPC server exposing blueprint tools
- **Blueprint Files** (`blueprints/*.md`) - Markdown files with frontmatter metadata
- **Frontmatter Parser** - Extracts `name` and `summary` from YAML frontmatter
- **File System Operations** - Search, read, and write blueprint files

### Data Flow

1. Claude Code invokes MCP tool (e.g., `search_blueprints`)
2. MCP server receives JSON-RPC request over stdio
3. Server parses frontmatter from all blueprint files
4. Results filtered by keyword (if provided)
5. Metadata returned as JSON to Claude Code

## API / Interface

### MCP Tools

#### `search_blueprints`

List all blueprints with optional keyword filtering.

**Parameters:**

- `keyword` (optional) - Filter by name or summary

**Returns:**

```typescript
{
  blueprints: Array<{
    name: string;
    summary: string;
  }>
}
```

**Example:**

```typescript
await search_blueprints({ keyword: "mcp" });
// Returns: [{ name: "mcp-server", summary: "Model Context Protocol..." }]
```

#### `read_blueprint`

Read full blueprint content by name.

**Parameters:**

- `name` (required) - Blueprint name without .md extension

**Returns:**

```typescript
{
  name: string;
  summary: string;
  content: string;  // Markdown without frontmatter
}
```

**Example:**

```typescript
await read_blueprint({ name: "mcp-server" });
```

#### `write_blueprint`

Create or update a blueprint with frontmatter.

**Parameters:**

- `name` (required) - Blueprint name (without .md)
- `summary` (required) - One-line summary
- `content` (required) - Markdown content (frontmatter added automatically)

**Returns:**

```typescript
{
  success: boolean;
  message: string;
}
```

**Example:**

```typescript
await write_blueprint({
  name: "new-system",
  summary: "Description of new system",
  content: "# New System\n\n## Overview\n..."
});
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
- Frontmatter required for MCP integration

## Behavior

### Blueprint Discovery

1. Server scans `blueprints/` directory at repository root
2. Reads all `.md` files except `README.md`
3. Parses frontmatter from each file
4. Builds in-memory index of metadata
5. Returns filtered/sorted results

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

- **Missing blueprints directory** - Returns empty array
- **Missing frontmatter** - Returns placeholder summary
- **Invalid name** - Throws error with clear message
- **Write errors** - Propagates filesystem errors

## Files

- `hashi/hashi-blueprints/.claude-plugin/plugin.json` - Plugin metadata and MCP server config
- `hashi/hashi-blueprints/README.md` - Plugin documentation
- `packages/bushido-han/lib/commands/mcp/blueprints.ts` - MCP server implementation
- `packages/bushido-han/lib/commands/mcp/index.ts` - Command registration
- `hashi/hashi-blueprints/hooks/ensure-blueprints.md` - Blueprint documentation requirements
- `blueprints/*.md` - Blueprint files with frontmatter

## Related Systems

- [MCP Server](./mcp-server.md) - JSON-RPC protocol implementation
- [Plugin Installation](./plugin-installation.md) - Installing hashi-blueprints
- [CLI Architecture](./cli-architecture.md) - MCP command structure

## Installation

```bash
han plugin install hashi-blueprints@han
```

This adds the MCP server to Claude Code settings:

```json
{
  "mcpServers": {
    "blueprints": {
      "command": "npx",
      "args": ["-y", "@thebushidocollective/han", "mcp", "blueprints"]
    }
  }
}
```

## Migration from README-based System

Previous system:

- Central `blueprints/README.md` with manual index
- No structured metadata
- Prompt injection for discovery

New system:

- Frontmatter metadata in each blueprint
- MCP tools for programmatic access
- No README.md required (optional for humans)

Migration steps:

1. Add frontmatter to existing blueprints
2. Install hashi-blueprints plugin
3. Update hashi-blueprints documentation
4. Remove or simplify README.md (optional)
