# Example Jutsu Plugin

A reference implementation for third-party Han plugins. This plugin demonstrates the correct structure, configuration, and best practices for creating Han plugins.

## Purpose

Use this plugin as a template and learning resource when developing your own Han plugins. It showcases:

- Proper directory structure
- Valid plugin.json configuration
- Hook definitions in han-plugin.yml
- Skill files with correct frontmatter
- Command files for slash commands
- Hook scripts that integrate with Han

## Installation

### From Local Path

```bash
# Clone the Han repository
git clone https://github.com/thebushidocollective/han.git
cd han

# Install the example plugin
han plugin install examples/example-jutsu-plugin --scope project
```

### Direct Path Installation

```bash
han plugin install /path/to/han/examples/example-jutsu-plugin --scope project
```

## Features

### Skills

#### plugin-development

Comprehensive guidance for creating Han plugins. Invoke with:

```
Skill("example-jutsu-plugin:plugin-development")
```

Covers:
- Plugin types (jutsu, do, hashi)
- Directory structure
- Configuration files
- Hook development
- Best practices

### Commands

#### /example-jutsu-plugin:greet

A simple greeting command demonstrating slash command functionality.

### Hooks

#### validate-example

A Stop hook that demonstrates validation hook structure. Runs when Claude completes work and shows how hooks integrate with the Han orchestrator.

## Directory Structure

```
example-jutsu-plugin/
├── .claude-plugin/
│   └── plugin.json         # Plugin metadata
├── han-plugin.yml          # Hook configuration
├── skills/
│   └── plugin-development/
│       └── SKILL.md        # Plugin development skill
├── commands/
│   └── greet.md           # Greeting command
├── hooks/
│   └── validate-example.sh # Example validation hook
└── README.md              # This file
```

## Creating Your Own Plugin

1. **Start with the scaffolder:**
   ```bash
   han create plugin --type jutsu --name my-tool
   ```

2. **Or copy this example:**
   ```bash
   cp -r examples/example-jutsu-plugin my-plugin
   # Update plugin.json with your plugin name
   # Customize skills, commands, and hooks
   ```

3. **Validate your plugin:**
   ```bash
   cd my-plugin
   han plugin validate
   ```

4. **Test locally:**
   ```bash
   han plugin install /path/to/my-plugin --scope project
   ```

## Plugin Types

- **jutsu-*** - Skills and validation hooks for languages/tools
- **do-*** - Specialized agents for specific disciplines
- **hashi-*** - MCP servers bridging external services

## Configuration Reference

### plugin.json

```json
{
  "name": "example-jutsu-plugin",
  "version": "1.0.0",
  "description": "Plugin description",
  "author": {
    "name": "Author Name",
    "url": "https://author-website.com"
  },
  "license": "Apache-2.0",
  "keywords": ["keyword1", "keyword2"]
}
```

### han-plugin.yml

```yaml
hooks:
  my-hook:
    event: Stop              # Hook event type
    command: bash "hooks/my-hook.sh"
    description: What the hook does
    if_changed:              # Optional: only run if files changed
      - "**/*.ts"
    dirs_with:               # Optional: only run in specific dirs
      - "config.json"
```

### SKILL.md

```markdown
---
name: skill-name
description: When to use this skill
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Skill Content

Documentation and guidance...
```

## License

Apache-2.0
