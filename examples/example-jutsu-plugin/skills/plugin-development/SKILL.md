---
name: plugin-development
description: Use when creating or modifying Han plugins. Covers plugin structure, configuration, hooks, skills, and best practices.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Han Plugin Development

This skill provides comprehensive guidance for developing Han plugins.

## Plugin Types

Han supports three plugin types:

1. **Jutsu (Technique)** - Skills and validation hooks for languages/tools
2. **Do (Discipline)** - Specialized agents for specific domains
3. **Hashi (Bridge)** - MCP servers for external integrations

## Directory Structure

Every plugin must follow this structure:

```
my-plugin/
├── .claude-plugin/
│   └── plugin.json      # Plugin metadata (required)
├── han-plugin.yml       # Hook configuration (optional)
├── skills/              # Skills directory (optional)
│   └── my-skill/
│       └── SKILL.md     # Skill definition
├── commands/            # Commands directory (optional)
│   └── my-command.md    # Slash command
├── hooks/               # Hook scripts (optional)
│   └── my-hook.sh       # Hook implementation
└── README.md            # Documentation
```

## plugin.json (Required)

The plugin.json file defines metadata:

```json
{
  "name": "my-plugin-name",
  "version": "1.0.0",
  "description": "What the plugin does",
  "author": {
    "name": "Author Name",
    "url": "https://author-website.com"
  },
  "license": "MIT",
  "keywords": ["keyword1", "keyword2"]
}
```

Required fields:
- `name` - Must match directory name
- `version` - Semantic versioning

## han-plugin.yml (Hooks)

Define validation hooks that run at lifecycle events:

```yaml
hooks:
  my-validation:
    event: Stop                    # When to run
    command: bash "hooks/my-hook.sh"
    description: What this hook does

    # Optional filters:
    if_changed:                    # Only run if these files changed
      - "**/*.ts"
    dirs_with:                     # Only run in dirs containing
      - "package.json"
```

### Hook Events

- `Setup` - Plugin installation
- `SessionStart` - Session begins
- `UserPromptSubmit` - User sends message
- `PreToolUse` - Before tool execution
- `PostToolUse` - After tool execution
- `Stop` - Work completion (validation)
- `SubagentStop` - Subagent completion

### Hook Environment Variables

Scripts receive:
- `CLAUDE_PLUGIN_ROOT` - Plugin directory path
- `HAN_SESSION_ID` - Current session ID
- `HAN_PROJECT_DIR` - Project directory
- `HAN_FILES` - Changed files (space-separated)

## Skills (SKILL.md)

Skills provide domain expertise:

```markdown
---
name: skill-name
description: When to use this skill
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Skill Title

Skill content with guidance, examples, and best practices.
```

Required frontmatter:
- `name` - Skill identifier
- `description` - When Claude should use this skill

## Commands (Slash Commands)

Commands provide slash command functionality:

```markdown
---
description: What the command does
---

Command implementation content...
```

Invoke with: `/plugin-name:command-name`

## Validation

Before publishing, validate your plugin:

```bash
cd my-plugin
han plugin validate
```

This checks:
- Required files exist
- JSON/YAML syntax is valid
- Frontmatter is correct
- No misplaced files

## Best Practices

### Hook Scripts

1. **Use `set -e`** - Exit on first error
2. **Quote variables** - `"${HAN_FILES}"` not `$HAN_FILES`
3. **Clear error messages** - Write to stderr on failure
4. **Exit codes** - 0 for success, non-zero for failure

### Skills

1. **Specific descriptions** - Help Claude know when to use
2. **Practical examples** - Show real usage patterns
3. **Progressive detail** - Start simple, add complexity
4. **Troubleshooting** - Include common issues

### General

1. **Follow naming conventions** - jutsu-*, do-*, hashi-*
2. **Include README** - Installation and usage docs
3. **Version properly** - Use semantic versioning
4. **Test locally** - Install via path before publishing

## Local Installation

Test your plugin locally:

```bash
# Install from local path
han plugin install /path/to/my-plugin --scope project

# Or add to .claude/settings.json manually
```

## Publishing

Share your plugin:

1. Push to a git repository
2. Add to the Han marketplace (optional)
3. Users install via: `han plugin install github:user/repo`

## Troubleshooting

### Hook Not Running

- Check `event` matches lifecycle point
- Verify `command` path is correct
- Check `if_changed`/`dirs_with` filters

### Validation Fails

- Run `han plugin validate` for specific errors
- Check plugin.json syntax
- Verify skill frontmatter

### Skill Not Found

- Check SKILL.md path and naming
- Verify frontmatter has required fields
- Skill name should match directory name
