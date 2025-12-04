# Blueprints Documentation Requirements

## What are Blueprints?

Blueprints are **repository-wide system design documents** that describe the architecture, behavior, and implementation of major systems in a codebase. They provide a high-level understanding of how systems work, their components, and how they interact.

## Location: ALWAYS at Repository Root

**CRITICAL:** The `blueprints/` directory must ALWAYS be at the repository root, never in subdirectories or packages.

```
my-repo/
├── blueprints/           # ✅ CORRECT - at repo root
│   ├── README.md
│   └── {system-name}.md
├── packages/
│   └── some-package/     # ❌ NEVER put blueprints/ here
└── src/
```

Blueprints describe systems that may span multiple packages or directories. A single system (like "authentication" or "hook-dispatch") may have implementation files across different parts of the codebase, but there should be ONE blueprint document at the repo root that describes the entire system.

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
├── README.md           # Index of all blueprints with brief descriptions
├── {system-name}.md    # One file per system/feature/component
└── {another-system}.md
```

## Blueprint File Format

Each blueprint file should include:

```markdown
# {System Name}

Brief description of what this system does.

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

## De-duplication Rules

Before creating a new blueprint:

1. **Check blueprints/README.md** for existing documentation
2. **Search blueprints/ for related terms** to avoid overlap
3. **Extend existing blueprints** rather than creating new files for related functionality
4. **Use consistent naming** - match the system/feature name used in code

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
