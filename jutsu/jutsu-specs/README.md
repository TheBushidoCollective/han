# jutsu-specs

Technical specification documentation skills and enforcement for Claude Code projects.

## Purpose

Keep implementation documentation (`specs/` directory) in sync with your codebase through:

- **Hooks** that remind you to document and verify documentation
- **Commands** to generate and update documentation
- **Skills** for writing effective technical specifications

## Installation

```bash
# Via Claude Code
/plugin install jutsu-specs@han

# Or manually in .claude/settings.json
{
  "enabledPlugins": {
    "jutsu-specs@han": true
  }
}
```

## Hooks

### UserPromptSubmit

Injects documentation requirements into every prompt, reminding you when to create or update specs.

### Stop

Prompt-based hook that asks Claude to verify specs match the changes just made, offering to update documentation if needed.

## Commands

### `/specs <system-name>`

Research a specific system and create or update its documentation:

```
/specs mcp-server
/specs authentication
/specs lib/commands/hook
```

### `/specs-all`

Deeply research all systems and create comprehensive documentation:

```
/specs-all
```

This command:
1. Discovers all systems in the codebase
2. Audits existing specs for accuracy
3. Creates missing documentation
4. Updates outdated specs
5. Maintains the specs/README.md index

## Skills

- **specs-writing** - How to write effective technical specifications
- **specs-maintenance** - Keeping specs in sync with implementation
- **specs-organization** - Directory structure and avoiding duplication

## specs/ Directory Structure

```
specs/
├── README.md           # Index of all specs
├── system-name.md      # One file per system
└── feature-name.md     # One file per feature
```

## De-duplication

The plugin enforces de-duplication through:

1. **Search before creating** - Check existing docs first
2. **Index maintenance** - specs/README.md tracks all specs
3. **Cross-references** - Link between specs instead of copying
4. **Merge guidance** - Combine related systems when appropriate

## Spec File Template

```markdown
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

Links to related specs.
```

## License

MIT
