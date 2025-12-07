---
name: blueprints-organization
description: Use when managing blueprints directory structure and avoiding duplication. Always search_blueprints before creating to prevent duplicate documentation. Handles naming conventions and cross-references.
allowed-tools: [Read, Write, Edit, Grep, Glob, mcp__plugin_hashi-blueprints_blueprints__search_blueprints, mcp__plugin_hashi-blueprints_blueprints__read_blueprint, mcp__plugin_hashi-blueprints_blueprints__write_blueprint]
---

# Organizing Technical Blueprints

## Directory Structure

```
blueprints/
├── README.md              # Index and overview
├── {system-name}.md       # One file per system
├── {feature-name}.md      # One file per feature
└── {integration-name}.md  # One file per integration
```

### Flat vs Nested

**Prefer flat structure** for most projects:

- Easier to navigate
- Simpler cross-references
- Less organizational overhead

**Use subdirectories** only for very large projects:

```
blueprints/
├── README.md
├── core/
│   ├── README.md
│   └── *.md
├── features/
│   └── *.md
└── integrations/
    └── *.md
```

## Naming Conventions

### File Names

- Use kebab-case: `user-authentication.md`
- Match system/feature names in code
- Be specific: `api-rate-limiting.md` not `api.md`
- Avoid generic names: `utils.md`, `helpers.md`

### Good Names

- `mcp-server.md` - Specific system
- `settings-merge.md` - Specific feature
- `github-integration.md` - Specific integration

### Bad Names

- `overview.md` - Too generic (use README.md)
- `misc.md` - Catch-all is a smell
- `new-feature.md` - Not descriptive

## The blueprints/README.md Index

Every blueprints/ directory needs an index:

```markdown
# Technical Blueprints

Implementation documentation for {Project Name}.

## Overview

Brief description of what this project does and how blueprints are organized.

## Systems

Core systems and their documentation:

### Core

- [Settings Management](./settings-management.md) - How configuration is loaded and merged
- [Plugin System](./plugin-system.md) - Plugin discovery and loading

### Features

- [MCP Server](./mcp-server.md) - Model Context Protocol implementation
- [Hook Dispatch](./hook-dispatch.md) - How hooks are executed

### Integrations

- [GitHub Integration](./github-integration.md) - GitHub API integration

## Contributing

When adding new blueprints:
1. Check for existing related documentation
2. Use consistent naming and structure
3. Update this index
```

## Avoiding Duplication

### The Duplication Problem

Duplicate documentation:

- Gets out of sync
- Confuses readers
- Wastes maintenance effort

### Prevention Strategies

1. **Search before creating** using MCP tools

   ```typescript
   // Search for existing blueprints
   const results = await search_blueprints({ keyword: "auth" });
   // Returns: [{ name: "authentication", summary: "..." }]

   // Read existing blueprint to check coverage
   const blueprint = await read_blueprint({ name: "authentication" });
   ```

2. **One source of truth**
   - Each concept documented once
   - Other locations link to the source

3. **Merge related topics**
   - Combine tightly coupled systems
   - Split only when truly independent

4. **Cross-reference liberally**

   ```markdown
   For authentication details, see [User Authentication](./user-authentication.md).
   ```

### When to Split vs Merge

**Keep together** when:

- Systems are tightly coupled
- Understanding one requires understanding the other
- They share significant context

**Split apart** when:

- Systems can be understood independently
- Different audiences need different docs
- File would exceed ~500 lines

## Handling Overlap

When systems overlap:

### Option 1: Primary Location + References

Document in one place, reference from others:

```markdown
# System A

## Authentication

This system uses shared authentication. See [Authentication](./authentication.md) for details.
```

### Option 2: Shared Section

Create a shared blueprint that both reference:

```markdown
# System A
Uses [Shared Auth](./shared-auth.md)

# System B
Uses [Shared Auth](./shared-auth.md)

# Shared Auth
Details here...
```

### Option 3: Inline with Scope

Document the overlap in each, scoped to that system:

```markdown
# System A

## Authentication (System A Specific)

How System A specifically uses authentication...
```

## Deprecation

When systems are removed:

1. **Delete the blueprint file** - Don't keep "for history"
2. **Update the index** - Remove from README.md
3. **Fix broken links** - Update any references
4. **Git history** - Use version control for history

## Auditing Organization

Periodically check:

- [ ] All blueprint files in index?
- [ ] All index entries have files?
- [ ] No obvious duplicates?
- [ ] Names match code terminology?
- [ ] Cross-references work?
- [ ] No orphaned files?

## Tools

### Find Orphaned Blueprints

```bash
# Files not in README.md
for f in blueprints/*.md; do
  grep -q "$(basename $f)" blueprints/README.md || echo "Orphan: $f"
done
```

### Find Duplicate Topics

```bash
# Similar file names
ls blueprints/*.md | xargs -n1 basename | sort | uniq -d

# Similar content
grep -l "specific term" blueprints/*.md
```
