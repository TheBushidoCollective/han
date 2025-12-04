---
description: Deeply research all systems and create or update specs/ documentation for the entire codebase
---

# Full Specs Documentation Generator

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
   - Any existing specs/ directory
   - Inline documentation patterns
   - Test files for behavioral documentation

3. **Create a system inventory**:
   - List all distinct systems/features
   - Note dependencies between systems
   - Identify documentation gaps

### Phase 2: Audit Existing Specs

If specs/ exists:

1. **Read specs/README.md** for the current index
2. **Check each documented system**:
   - Does the spec match current implementation?
   - Are there new features not documented?
   - Is any documented functionality removed?
3. **Identify orphaned specs** (documentation for removed systems)

### Phase 3: Prioritize Documentation

Order systems by importance:

1. **Core systems** - Central functionality everything depends on
2. **Public APIs** - User-facing features and interfaces
3. **Integration points** - How systems connect
4. **Supporting systems** - Utilities and helpers

### Phase 4: Generate Documentation

For each system, create or update `specs/{system-name}.md`:

```markdown
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

{Links to related specs}
```

### Phase 5: Create/Update Index

Update `specs/README.md`:

```markdown
# Technical Specifications

This directory contains implementation documentation for {project name}.

## Systems

### Core

- [{System A}](./system-a.md) - {description}
- [{System B}](./system-b.md) - {description}

### Features

- [{Feature X}](./feature-x.md) - {description}

### Integrations

- [{Integration Y}](./integration-y.md) - {description}

## Documentation Standards

See [jutsu-specs](https://github.com/thebushidocollective/han) for documentation guidelines.
```

## De-duplication Strategy

When documenting, actively prevent duplicates:

1. **Check before creating** - Search specs/ for existing coverage
2. **Merge related systems** - Document tightly coupled systems together
3. **Use cross-references** - Link between specs rather than duplicating
4. **One source of truth** - Each concept documented in exactly one place

## Output

After completing:

1. List all systems discovered
2. List specs created/updated
3. Note any systems that couldn't be documented (why)
4. Identify areas needing future documentation
