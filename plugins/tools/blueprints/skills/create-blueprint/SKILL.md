---
name: create-blueprint
user-invocable: false
description: Research a specific system and create or update its blueprints/ documentation
---

## Name

blueprints:create-blueprint - Generate or update blueprint documentation for a specific system

## Synopsis

```text
/blueprint <system-name>
```

## Description

Research a specific system in the codebase and create or update its technical blueprint documentation in the `blueprints/` directory at the **repository root**.

## Important: Blueprint Location

**CRITICAL:** Blueprints MUST be created at the repository root, never in subdirectories or packages.

- ✅ `{repo-root}/blueprints/{system-name}.md`
- ❌ `{repo-root}/packages/foo/blueprints/{system-name}.md`
- ❌ `{repo-root}/src/blueprints/{system-name}.md`

Blueprints are repository-wide system design documents. A single system may span multiple packages or directories, but there should be ONE blueprint at the repo root describing the entire system.

## Implementation

You are tasked with creating or updating technical blueprint documentation for a specific system.

## Process

### 1. Identify the Target System

The user will specify which system to document. This could be:

- A feature name (e.g., "authentication", "caching")
- A directory path (e.g., "lib/commands/mcp")
- A component name (e.g., "MCP server", "hook dispatcher")

### 2. Deep Research Phase

Thoroughly investigate the system:

1. **Find all relevant files** using Glob and Grep
2. **Read the implementation** to understand:
   - Entry points and public APIs
   - Internal architecture and data flow
   - Dependencies and integrations
   - Configuration options
   - Error handling and edge cases
3. **Check for existing documentation**:
   - README files in the directory
   - Inline code comments
   - Existing blueprints/ files
   - Test files (they document expected behavior)

### 3. Check for Duplicates

Before creating a new blueprint, **use the MCP tools**:

1. **Use `list_blueprints()`** to see all existing blueprints
2. **Use `search_blueprints({ keyword: "system-name" })`** to find related documentation
3. **Use `read_blueprint({ name: "related-system" })`** to check for overlap
4. **Identify overlapping systems** that should be documented together

### 4. Write the Blueprint

**Use `write_blueprint` to create or update the blueprint**:

```
write_blueprint({
  name: "system-name",
  summary: "Brief one-line description",
  content: "# {System Name}\n\n..."
})
```

The blueprint content should follow this structure:

```markdown
# {System Name}

{Brief one-line description}

## Overview

{2-3 paragraphs explaining the system's purpose, why it exists, and its role in the larger system}

## Architecture

{Describe the system structure}

### Components

- **{Component A}** - {description}
- **{Component B}** - {description}

### Data Flow

{How data moves through the system}

### Dependencies

- {Dependency 1} - {why it's needed}
- {Dependency 2} - {why it's needed}

## API / Interface

### Public Functions/Methods

#### `functionName(params)`

{Description}

**Parameters:**
- `param1` (type) - {description}

**Returns:** {description}

### Commands

{If applicable, document CLI commands}

### Configuration

{Document configuration options}

## Behavior

### Normal Operation

{How the system behaves under normal conditions}

### Error Handling

{How errors are handled}

### Edge Cases

{Notable edge cases and how they're handled}

## Files

Key implementation files:

- `path/to/main.ts` - {brief description}
- `path/to/helper.ts` - {brief description}

## Related Systems

- [{Related System}](./related-system.md) - {relationship description}
```

## Output

After completing the research and documentation:

1. Create/update the blueprint using `write_blueprint`
2. Report what was documented and any related systems that may need documentation

**Note:** The blueprint index is automatically managed by the MCP tools - you don't need to manually update README files.
