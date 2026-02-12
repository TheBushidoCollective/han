---
name: generate-blueprints
description: Deeply research all systems and create or update blueprints/ documentation for the entire codebase
---

## Name

blueprints:generate-blueprints - Generate comprehensive blueprint documentation for the entire codebase

## Synopsis

```text
/blueprints
```

## Description

Comprehensively document all systems in the codebase by creating or updating the `blueprints/` directory at the **repository root** with technical documentation for each major system.

## Important: Blueprint Location

**CRITICAL:** Blueprints MUST be created at the repository root, never in subdirectories or packages.

- `{repo-root}/blueprints/`
- `{repo-root}/packages/foo/blueprints/`
- `{repo-root}/src/blueprints/`

Blueprints are repository-wide system design documents. Systems may span multiple packages or directories, but all blueprints belong in a single `blueprints/` directory at the repo root.

## Implementation

You are tasked with comprehensively documenting all systems in this codebase.

## Process

### Phase 1: Discovery

1. **Analyze project structure** to identify all major systems:
   - Top-level directories and their purposes
   - Package/module boundaries
   - Entry points (main files, CLI commands, API endpoints)
   - Configuration systems

2. **Read existing documentation**:
   - README.md files at all levels
   - Any existing blueprints/ directory
   - Inline documentation patterns
   - Test files for behavioral documentation

3. **Create a system inventory**:
   - List all distinct systems/features
   - Note dependencies between systems
   - Identify documentation gaps

### Phase 2: Audit Existing Blueprints

Audit existing documentation using native tools:

1. **List all blueprints**: Use `Glob("blueprints/*.md")` to find all existing blueprint files
2. **Read each blueprint**: Use `Read("blueprints/{name}.md")` to check each documented system:
   - Does the blueprint match current implementation?
   - Are there new features not documented?
   - Is any documented functionality removed?
3. **Identify orphaned blueprints** (documentation for removed systems)

### Phase 3: Prioritize Documentation

Order systems by importance:

1. **Core systems** - Central functionality everything depends on
2. **Public APIs** - User-facing features and interfaces
3. **Integration points** - How systems connect
4. **Supporting systems** - Utilities and helpers

### Phase 4: Generate Documentation

For each system, use the `Write` tool to create or update the blueprint file:

```
Write("blueprints/{system-name}.md", content)
```

Each file MUST include YAML frontmatter:

```markdown
---
name: system-name
summary: Brief one-line description
---

# {System Name}

{Brief description}

## Overview

{Purpose and role in the larger system}

## Architecture

{Structure, components, data flow}

## API / Interface

{Public methods, commands, configuration}

## Behavior

{Normal operation, error handling, edge cases}

## Files

{Key implementation files with descriptions}

## Related Systems

{Links to related blueprints}
```

### Phase 5: Index Management

**The blueprint index is automatically managed** by the SessionStart hook. When you run `han blueprints sync-index`, the index is updated at `.claude/rules/blueprints/blueprints-index.md`.

You don't need to manually create or update any index files - just focus on creating quality blueprint content using the Write tool.

## De-duplication Strategy

When documenting, actively prevent duplicates:

1. **Check before creating** - Use `Glob("blueprints/*.md")` and `Grep` to search for existing coverage
2. **Read existing blueprints** - Use `Read("blueprints/{name}.md")` to check content
3. **Merge related systems** - Document tightly coupled systems together
4. **Use cross-references** - Link between blueprints rather than duplicating
5. **One source of truth** - Each concept documented in exactly one place

## Output

After completing:

1. List all systems discovered
2. List blueprints created/updated
3. Note any systems that couldn't be documented (why)
4. Identify areas needing future documentation

**Remember:** Use native tools (Glob, Grep, Read, Write) to manage blueprint files. The frontmatter format (`name` and `summary` fields) enables discovery via the auto-generated index.
