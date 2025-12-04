# Specs Documentation Requirements

## When to Update specs/

Update or create specs/ documentation when making changes that involve:

- **New features** - Document the feature's purpose, behavior, and API
- **Architecture changes** - Update system design documentation
- **API modifications** - Document endpoint changes, parameters, responses
- **Configuration changes** - Document new options and their effects
- **Behavioral changes** - Update docs if system behavior differs from before

## specs/ Directory Structure

```
specs/
├── README.md           # Index of all specs with brief descriptions
├── {system-name}.md    # One file per system/feature/component
└── {another-system}.md
```

## Spec File Format

Each spec file should include:

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

Before creating a new spec:

1. **Check specs/README.md** for existing documentation
2. **Search specs/ for related terms** to avoid overlap
3. **Extend existing specs** rather than creating new files for related functionality
4. **Use consistent naming** - match the system/feature name used in code

## When NOT to Document

Skip specs/ documentation for:

- Bug fixes that don't change behavior
- Refactoring without API changes
- Test additions
- Documentation-only changes
- Minor style/formatting updates

## Ongoing Maintenance

When modifying a system that has specs/ documentation:

1. Read the existing spec first
2. Update the spec alongside code changes
3. Keep the spec accurate - remove outdated information
4. Cross-reference related specs if behavior overlaps
