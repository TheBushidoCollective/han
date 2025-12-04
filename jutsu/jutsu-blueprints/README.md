# jutsu-blueprints

Technical blueprint documentation skills and enforcement for Claude Code projects.

## Purpose

Keep implementation documentation (`blueprints/` directory) in sync with your codebase through:

- **Hooks** that remind you to document and verify documentation
- **Commands** to generate and update documentation
- **Skills** for writing effective technical blueprints

## Installation

```bash
# Via Claude Code
/plugin install jutsu-blueprints@han

# Or manually in .claude/settings.json
{
  "enabledPlugins": {
    "jutsu-blueprints@han": true
  }
}
```

## Hooks

### UserPromptSubmit

Injects documentation requirements into every prompt, reminding you when to create or update blueprints.

### Stop

Prompt-based hook that asks Claude to verify blueprints match the changes just made, offering to update documentation if needed.

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
5. Maintains the blueprints/README.md index

## Skills

- **blueprints-writing** - How to write effective technical blueprints
- **blueprints-maintenance** - Keeping blueprints in sync with implementation
- **blueprints-organization** - Directory structure and avoiding duplication

## blueprints/ Directory Structure

```
blueprints/
├── README.md           # Index of all blueprints
├── system-name.md      # One file per system
└── feature-name.md     # One file per feature
```

## De-duplication

The plugin enforces de-duplication through:

1. **Search before creating** - Check existing docs first
2. **Index maintenance** - blueprints/README.md tracks all blueprints
3. **Cross-references** - Link between blueprints instead of copying
4. **Merge guidance** - Combine related systems when appropriate

## Blueprint File Template

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

Links to related blueprints.
```

## License

MIT
