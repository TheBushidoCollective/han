---
title: "Skills and Commands"
description: "How to create skills and slash commands that teach Claude specialized knowledge and workflows."
---

Skills and commands give Claude specialized knowledge about tools and workflows. They're markdown files with YAML frontmatter that Claude reads when relevant topics come up.

## Skills vs Commands

| Feature | Skills | Commands |
|---------|--------|----------|
| Location | `skills/skill-name/SKILL.md` | `commands/command-name.md` |
| Purpose | Deep knowledge about a topic | Specific workflow or action |
| Invocation | Automatic when topic is relevant | Explicit via `/command` |
| Length | Typically longer, more comprehensive | Usually focused and actionable |

## Creating Skills

Skills are organized in directories under `skills/`:

```
your-plugin/
├── skills/
│   ├── getting-started/
│   │   └── SKILL.md
│   ├── configuration/
│   │   └── SKILL.md
│   └── best-practices/
│       └── SKILL.md
```

### Skill File Format

Each skill is a markdown file named `SKILL.md`:

```markdown
---
name: skill-name
description: Brief description of when to use this skill.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Skill Title

Your skill content here...
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Unique identifier (kebab-case) |
| `description` | Yes | When Claude should use this skill |
| `allowed-tools` | No | Tools the skill can use (defaults to all) |

### Example: Complete Skill

```markdown
---
name: biome-configuration
description: Use when configuring Biome for a project - covers biome.json setup, rule configuration, and project-specific settings.
allowed-tools: [Read, Write, Edit, Bash, Glob, Grep]
---

# Biome Configuration

Expert knowledge for configuring Biome in JavaScript/TypeScript projects.

## Configuration File

Create `biome.json` in your project root:

\`\`\`json
{
  "$schema": "https://biomejs.dev/schemas/1.9.0/schema.json",
  "organizeImports": {
    "enabled": true
  },
  "linter": {
    "enabled": true,
    "rules": {
      "recommended": true
    }
  },
  "formatter": {
    "enabled": true,
    "indentStyle": "space",
    "indentWidth": 2
  }
}
\`\`\`

## Common Configurations

### Strict Mode

For maximum code quality:

\`\`\`json
{
  "linter": {
    "rules": {
      "all": true,
      "suspicious": {
        "noExplicitAny": "error"
      }
    }
  }
}
\`\`\`

### Ignoring Files

\`\`\`json
{
  "files": {
    "ignore": [
      "dist/**",
      "node_modules/**",
      "*.min.js"
    ]
  }
}
\`\`\`

## Troubleshooting

### Config Not Found

If Biome can't find your config:

1. Ensure `biome.json` is in the project root
2. Check file permissions
3. Validate JSON syntax with `npx biome check --config-path ./biome.json`

### Rule Conflicts

When rules conflict with your codebase:

1. Disable specific rules instead of categories
2. Use `warn` instead of `error` for gradual adoption
3. Document disabled rules with comments
```

## Creating Commands

Commands are slash commands users invoke directly:

```
your-plugin/
├── commands/
│   ├── validate.md
│   └── setup.md
```

### Command File Format

Commands are markdown files with frontmatter:

```markdown
---
description: Brief description of what this command does
---

# Command Implementation

Your command content here...
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `description` | Yes | Shown in command help |

### Example: Complete Command

```markdown
---
description: Set up Biome in the current project with sensible defaults
---

# Setup Biome

## Name

biome-setup - Initialize Biome configuration

## Synopsis

\`\`\`
/setup
\`\`\`

## Description

Creates a `biome.json` configuration file with recommended settings for the project.

## Implementation

1. Check if `biome.json` already exists
2. Detect project type (React, Node, TypeScript, etc.)
3. Generate appropriate configuration
4. Install Biome as a dev dependency
5. Add npm scripts for linting and formatting

## Steps

### 1. Check Existing Config

\`\`\`bash
if [ -f "biome.json" ]; then
  echo "biome.json already exists"
  exit 0
fi
\`\`\`

### 2. Detect Project Type

Check for indicators:
- `tsconfig.json` -> TypeScript
- React in dependencies -> React rules
- `next.config.js` -> Next.js specific rules

### 3. Generate Config

Create `biome.json` with detected settings.

### 4. Install

\`\`\`bash
npm install -D @biomejs/biome
\`\`\`

### 5. Add Scripts

Add to `package.json`:

\`\`\`json
{
  "scripts": {
    "lint": "biome check .",
    "lint:fix": "biome check --write .",
    "format": "biome format --write ."
  }
}
\`\`\`

## Examples

\`\`\`
/setup
\`\`\`

Sets up Biome with auto-detected configuration.
```

## Agent Files (Do Plugins)

For `do-*` plugins, agents are defined in the `agents/` directory:

```
do-your-discipline/
├── agents/
│   ├── specialist.md
│   └── reviewer.md
```

### Agent File Format

```markdown
---
name: agent-name
description: |
  Detailed description of when to use this agent.
  Include examples with the <example> tag format.
model: inherit
color: blue
---

# Agent Title

Your agent's system prompt and instructions...
```

### Frontmatter Fields

| Field | Required | Description |
|-------|----------|-------------|
| `name` | Yes | Agent identifier (kebab-case) |
| `description` | Yes | When to use, with examples |
| `model` | No | Model to use (`inherit` = current model) |
| `color` | No | UI color (blue, green, purple, teal, etc.) |

### Agent Description Format

Use structured examples:

```yaml
description: |
  Use this agent for code quality analysis and improvement recommendations.

  Examples:
  <example>
  Context: User wants to improve a module's code quality.
  user: 'Review the auth module for code quality issues'
  assistant: 'I'll use code-quality-analyzer to examine complexity,
  maintainability, and recommend improvements.'
  <commentary>This requires specialized analysis beyond simple linting.</commentary>
  </example>
```

## Writing Effective Content

### Be Specific

Bad:
```markdown
## Configuration
Configure the tool as needed for your project.
```

Good:
```markdown
## Configuration

Create `tool.config.js` in your project root:

\`\`\`javascript
module.exports = {
  rules: {
    'no-unused-vars': 'error',
  },
};
\`\`\`
```

### Include Real Commands

Bad:
```markdown
Run the linter to check your code.
```

Good:
```markdown
\`\`\`bash
# Check without fixing
npx my-linter check .

# Check and auto-fix
npx my-linter check --fix .

# Check specific files
npx my-linter check src/**/*.ts
\`\`\`
```

### Cover Edge Cases

Include troubleshooting sections:

```markdown
## Troubleshooting

### Error: Config file not found

**Cause**: Tool can't locate configuration file.

**Solution**:
1. Ensure config file is in project root
2. Check file name matches expected pattern
3. Verify file permissions

### Error: Parsing failed

**Cause**: Invalid configuration syntax.

**Solution**:
1. Validate JSON/YAML syntax
2. Check for trailing commas
3. Ensure all required fields are present
```

### Structure for Scanning

Use clear headings and lists:

```markdown
## Quick Reference

| Command | Description |
|---------|-------------|
| `check .` | Lint all files |
| `check --fix .` | Lint and auto-fix |
| `format .` | Format all files |

## Rule Categories

- **Correctness**: Catches bugs
- **Style**: Enforces consistency
- **Performance**: Identifies inefficiencies
```

## Organizing Skills

Group related skills logically:

```
skills/
├── getting-started/         # Setup and basics
│   └── SKILL.md
├── configuration/           # Config options
│   └── SKILL.md
├── rules/                   # Rule reference
│   └── SKILL.md
├── migration/               # Upgrading/migrating
│   └── SKILL.md
└── troubleshooting/         # Common issues
    └── SKILL.md
```

## Best Practices

1. **One topic per skill** - Keep skills focused

2. **Actionable content** - Include commands users can run

3. **Real examples** - Use actual code, not pseudocode

4. **Keep it current** - Update for new tool versions

5. **Test your content** - Verify commands work

6. **Include version info** - Note which tool versions apply

## Next Steps

- [Testing Plugins](/docs/plugin-development/testing) - Local testing workflow
- [Distribution](/docs/plugin-development/distribution) - Sharing your plugins
