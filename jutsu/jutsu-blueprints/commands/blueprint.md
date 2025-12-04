---
description: Research a specific system and create or update its blueprints/ documentation
---

# Blueprint Documentation Generator

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

Before creating a new blueprint:

1. **Read blueprints/README.md** if it exists
2. **Search blueprints/ directory** for related documentation
3. **Identify overlapping systems** that should be documented together

### 4. Write the Blueprint

Create or update `blueprints/{system-name}.md` with:

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

### 5. Update blueprints/README.md

Add an entry to the index:

```markdown
- [{System Name}](./{system-name}.md) - {brief description}
```

## Output

After completing the research and documentation:

1. Create/update the blueprint file
2. Update blueprints/README.md index
3. Report what was documented and any related systems that may need documentation
