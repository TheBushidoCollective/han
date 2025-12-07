# Blueprints Documentation Requirements

## What are Blueprints?

Blueprints are **repository-wide system design documents** that describe the architecture, behavior, and implementation of major systems in a codebase. They provide a high-level understanding of how systems work, their components, and how they interact.

## Location: ALWAYS at Repository Root

**CRITICAL:** The `blueprints/` directory must ALWAYS be at the repository root, never in subdirectories or packages.

```
my-repo/
├── blueprints/           # ✅ CORRECT - at repo root
│   └── {system-name}.md
├── packages/
│   └── some-package/     # ❌ NEVER put blueprints/ here
└── src/
```

Blueprints describe systems that may span multiple packages or directories. A single system (like "authentication" or "hook-dispatch") may have implementation files across different parts of the codebase, but there should be ONE blueprint document at the repo root that describes the entire system.

## MCP Integration

**ALWAYS use the MCP tools** to interact with blueprints programmatically:

- `search_blueprints` - List all blueprints with names and summaries
- `read_blueprint` - Read full blueprint content by name
- `write_blueprint` - Create or update blueprints with frontmatter

**When working on implementation changes:**

1. **Before coding** - Use `search_blueprints` to find relevant blueprints
2. **Before modifying** - Use `read_blueprint` to understand current documentation
3. **After changes** - Use `write_blueprint` to update documentation

The MCP tools automatically handle frontmatter - you just provide the content.

## When to Update blueprints/

Update or create blueprints/ documentation when making changes that involve:

- **New features** - Document the feature's purpose, behavior, and API
- **Architecture changes** - Update system design documentation
- **API modifications** - Document endpoint changes, parameters, responses
- **Configuration changes** - Document new options and their effects
- **Behavioral changes** - Update docs if system behavior differs from before

## blueprints/ Directory Structure

```
{repo-root}/blueprints/
├── {system-name}.md    # One file per system/feature/component
└── {another-system}.md
```

**Note:** The README.md index is no longer required - blueprint discovery is handled by the MCP server using frontmatter metadata.

## Blueprint File Format

**REQUIRED:** Each blueprint file must include YAML frontmatter with `name` and `summary`:

```markdown
---
name: system-name
summary: Brief one-line description of the system
---

# {System Name}

Detailed description of what this system does.

## Overview

High-level explanation of the system's purpose and role.

## Architecture

How the system is structured (components, data flow, dependencies).

## API / Interface

Public methods, commands, endpoints, or configuration options.

## Behavior

How the system behaves in different scenarios.

## Files

Key files involved in this system:
- `path/to/file.ts` - Description
```

**Frontmatter Rules:**

- `name` must match the filename (without .md extension)
- `summary` should be a single line (used for search/discovery)
- Frontmatter is required for MCP tool integration

## De-duplication Rules

**CRITICAL:** Before creating a new blueprint, ALWAYS use the MCP tools:

```typescript
// 1. Search for existing blueprints related to your topic
const results = await search_blueprints({ keyword: "auth" });
// Returns: [{ name: "authentication", summary: "User auth system" }]

// 2. Read existing blueprint to check coverage
const blueprint = await read_blueprint({ name: "authentication" });

// 3. Only create new if truly distinct, otherwise update existing
await write_blueprint({
  name: "authentication",
  summary: "Updated summary",
  content: updatedContent
});
```

Rules:

1. **Always search first** - Use `search_blueprints` to find existing documentation
2. **Read before writing** - Use `read_blueprint` to understand current state
3. **Extend, don't duplicate** - Update existing blueprints for related functionality
4. **Use consistent naming** - Match the system/feature name used in code

## When NOT to Document

Skip blueprints/ documentation for:

- Bug fixes that don't change behavior
- Refactoring without API changes
- Test additions
- Documentation-only changes
- Minor style/formatting updates

## Ongoing Maintenance

When modifying a system that has blueprints/ documentation:

1. Read the existing blueprint first
2. Update the blueprint alongside code changes
3. Keep the blueprint accurate - remove outdated information
4. Cross-reference related blueprints if behavior overlaps
