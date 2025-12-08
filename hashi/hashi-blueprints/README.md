# hashi-blueprints

MCP server for managing technical blueprint documentation with programmatic tools, skills, and quality enforcement.

## Overview

This plugin provides comprehensive blueprint management through:

- **MCP Server** - Programmatic access to blueprints via JSON-RPC tools
- **Skills** - Guidelines for writing effective technical blueprints
- **Commands** - Generate and update documentation
- **Hooks** - Enforcement and reminders for documentation requirements

## Installation

```bash
han plugin install hashi-blueprints@han
```

This installs both the MCP server and the skills/commands/hooks.

## MCP Tools

The MCP server exposes three tools for programmatic blueprint access:

### search_blueprints

List all available blueprints with their names and summaries.

**Parameters:**

- `keyword` (optional): Filter blueprints by keyword in name or summary

**Returns:**

```typescript
{
  blueprints: Array<{
    name: string;
    summary: string;
  }>
}
```

### read_blueprint

Read the full content of a specific blueprint.

**Parameters:**

- `name` (required): Blueprint name (without .md extension)

**Returns:**

```typescript
{
  name: string;
  summary: string;
  content: string; // Markdown content without frontmatter
}
```

### write_blueprint

Create or update a blueprint with frontmatter.

**Parameters:**

- `name` (required): Blueprint name (without .md extension)
- `summary` (required): Short summary of the blueprint
- `content` (required): Markdown content (frontmatter added automatically)

**Returns:**

```typescript
{
  success: boolean;
  message: string;
}
```

## Commands

### `/blueprint <system-name>`

Research a specific system and create or update its documentation:

```
/blueprint mcp-server
/blueprint authentication
/blueprint lib/commands/hook
```

### `/blueprints`

Deeply research all systems and create comprehensive documentation:

```
/blueprints
```

This command:

1. Discovers all systems in the codebase
2. Audits existing blueprints for accuracy
3. Creates missing documentation
4. Updates outdated blueprints
5. Uses MCP tools to manage blueprint files

## Skills

- **blueprints-writing** - How to write effective technical blueprints
- **blueprints-maintenance** - Keeping blueprints in sync with implementation
- **blueprints-organization** - Directory structure and avoiding duplication

## Hooks

### UserPromptSubmit

Injects documentation requirements into every prompt, reminding you when to create or update blueprints.

### Stop

Prompt-based hook that asks Claude to verify blueprints match the changes just made, offering to update documentation if needed.

## Blueprint Format

All blueprints must include YAML frontmatter:

```markdown
---
name: system-name
summary: Brief description of what this system does
---

# System Name

[Blueprint content...]
```

### Blueprint File Template

```markdown
---
name: system-name
summary: One-line description
---

# System Name

Brief description.

## Overview

Purpose and role in the larger system.

## Architecture

Components, data flow, dependencies.

## API / Interface

Public methods, commands, configuration.

## Behavior

Normal operation, error handling, edge cases.

## Files

Key implementation files with descriptions.

## Related Systems

Links to related blueprints.
```

## blueprints/ Directory Structure

```
blueprints/
├── system-name.md      # One file per system
└── feature-name.md     # One file per feature
```

**Note:** The README.md index is no longer required - blueprint discovery is handled by the MCP server using frontmatter metadata.

## De-duplication

The plugin enforces de-duplication through:

1. **Search before creating** - Use `search_blueprints` MCP tool
2. **Cross-references** - Link between blueprints instead of copying
3. **Merge guidance** - Combine related systems when appropriate
4. **MCP-based discovery** - Frontmatter metadata enables programmatic search

## Related Plugins

- **bushido**: Core quality principles and standards

## License

MIT
