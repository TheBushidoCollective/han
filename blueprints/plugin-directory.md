# Plugin Directory Organization

Filesystem structure and conventions for organizing 120+ plugins across four categories.

## Overview

The Han repository organizes plugins into four top-level directories based on their purpose: bushido/ (core), jutsu/ (techniques), do/ (disciplines), and hashi/ (bridges). Each directory follows consistent structure patterns while allowing category-specific variations.

## Architecture

### Directory Layout

```
han/
├── bushido/                    # Core foundation (1 plugin)
├── jutsu/                      # Techniques (88 plugins)
│   ├── jutsu-typescript/
│   ├── jutsu-biome/
│   └── ...
├── do/                         # Disciplines (30 plugins)
│   ├── do-backend-development/
│   ├── do-frontend-development/
│   └── ...
└── hashi/                      # Bridges (9 plugins)
    ├── hashi-github/
    ├── hashi-playwright-mcp/
    └── ...
```

### Category Breakdown

| Category | Directory | Pattern | Count | Purpose |
|----------|-----------|---------|-------|---------|
| Core | `bushido/` | Single plugin | 1 | Foundation principles and quality skills |
| Technique | `jutsu/` | `jutsu-{tool}/` | 88 | Tool-specific expertise with validation |
| Discipline | `do/` | `do-{practice}/` | 30 | Specialized agents for development practices |
| Bridge | `hashi/` | `hashi-{service}/` | 9 | MCP servers for external integrations |

## Plugin Structure Patterns

### Core Plugin

```
core/
├── .claude-plugin/
│   ├── plugin.json
│   ├── hooks.json
│   └── .mcp.json          # MCP server configuration
├── skills/
│   ├── professional-honesty/SKILL.md
│   ├── solid-principles/SKILL.md
│   └── ...
├── commands/
│   ├── develop.md
│   ├── review.md
│   └── ...
└── README.md
```

**Characteristics**:

- Skills for quality principles and universal practices
- Workflow commands (/develop, /review, /refactor)
- Hooks for enforcement and quality gates
- MCP servers (han + context7) for infrastructure
- Foundation for all other plugins

### Technique Plugin (Jutsu)

```
jutsu/jutsu-{tool}/
├── .claude-plugin/
│   ├── plugin.json
│   └── hooks.json (optional)
├── skills/
│   ├── {tool}-patterns/SKILL.md
│   ├── {tool}-best-practices/SKILL.md
│   └── ...
├── hooks/                      # Validation hooks (if present)
│   ├── hooks.json             # Claude Code event hooks
│   └── *.md                   # Hook documentation
├── han-config.json            # Validation commands (if present)
└── README.md
```

**Examples**:

- `jutsu-typescript/` - TypeScript expertise + type-checking
- `jutsu-biome/` - Biome linting + formatting validation
- `jutsu-pytest/` - Python testing + test execution

**Characteristics**:

- Tool-specific skills
- Validation hooks (lint, test, typecheck, format)
- Smart caching (ifChanged patterns)
- Directory targeting (dirsWith markers)

### Discipline Plugin (Do)

```
do/do-{practice}/
├── .claude-plugin/
│   └── plugin.json
├── agents/
│   ├── {role-1}.md
│   ├── {role-2}.md
│   └── ...
├── commands/ (optional)
│   └── ...
├── hooks/ (optional)
│   └── ...
└── README.md
```

**Examples**:

- `do-backend-development/` - Backend engineering agents
- `do-frontend-development/` - Frontend engineering agents
- `do-security-engineering/` - Security-focused agents

**Agent Roles**:

- API architect
- Database designer
- Performance optimizer
- Security auditor
- etc.

**Characteristics**:

- Specialized agents for practice areas
- Multi-role coverage
- Can include workflow commands
- Can include quality hooks

### Bridge Plugin (Hashi)

```
hashi/hashi-{service}/
├── .claude-plugin/
│   ├── plugin.json
│   └── .mcp.json              # MCP server configuration
├── commands/ (optional)
│   └── {command}.md
└── README.md
```

**Examples**:

- `hashi-github/` - 100+ GitHub API tools
- `hashi-playwright-mcp/` - Browser automation tools
- `hashi-context7/` - Documentation lookup tools

**Characteristics**:

- MCP server integration
- External service bridging
- Tool exposure via MCP protocol
- Can include slash commands for common workflows

## File Conventions

### Required Files

**All Plugins**:

- `.claude-plugin/plugin.json` - Plugin metadata
- `README.md` - Documentation

**Category-Specific**:

- Core: `.claude-plugin/.mcp.json` (MCP servers)
- Jutsu: `skills/` directory
- Do: `agents/` directory
- Hashi: `.claude-plugin/.mcp.json` (MCP servers)

### Optional Files

- `.claude-plugin/hooks.json` - Claude Code event hooks
- `hooks/*.md` - Hook documentation
- `commands/*.md` - Slash commands
- `han-config.json` - Validation hook configuration
- `han-config.yml` - User hook overrides (not committed)

### Plugin Metadata (plugin.json)

```json
{
  "name": "jutsu-typescript",
  "version": "1.0.0",
  "description": "TypeScript expertise with type-checking validation",
  "author": "The Bushido Collective",
  "license": "MIT",
  "keywords": ["typescript", "type-checking", "validation"]
}
```

**Required Fields**:

- `name` - Must match directory name
- `version` - Semantic version
- `description` - Human-readable purpose
- `author` - Creator/maintainer
- `license` - License identifier

**Optional Fields**:

- `keywords` - Searchable tags
- `homepage` - Documentation URL
- `repository` - Source code URL

### Skill Files (skills/*/SKILL.md)

```
skills/{skill-name}/SKILL.md
```

**Frontmatter** (required):

```yaml
---
description: Brief description of the skill
---
```

**Content**:

- Markdown documentation of expertise
- Code examples
- Best practices
- Anti-patterns to avoid

### Command Files (commands/*.md)

```
commands/{command-name}.md
```

**Frontmatter** (required):

```yaml
---
description: Brief description of the command
---
```

**Content**:

- Command prompt/instructions
- Usage examples
- Expected behavior

### Agent Files (agents/*.md)

```
agents/{role-name}.md
```

**Frontmatter** (required):

```yaml
---
description: Brief description of the agent role
---
```

**Content**:

- Agent personality and expertise
- Responsibilities
- Decision-making framework
- Interaction patterns

### Hook Configuration (han-config.json)

```json
{
  "hooks": {
    "lint": {
      "command": "npm run lint",
      "dirsWith": ["package.json"],
      "ifChanged": ["**/*.{ts,tsx,js,jsx}"],
      "idleTimeout": 5000
    },
    "typecheck": {
      "command": "npx tsc --noEmit",
      "dirsWith": ["tsconfig.json"],
      "ifChanged": ["**/*.{ts,tsx}"]
    }
  }
}
```

**Hook Properties**:

- `command` - Shell command to execute
- `dirsWith` - Marker files for target directories
- `ifChanged` - Glob patterns for change detection
- `idleTimeout` - Max idle time before timeout (optional)

## Naming Conventions

### Plugin Names

- **Bushido**: `bushido` (single plugin)
- **Jutsu**: `jutsu-{tool}` (e.g., `jutsu-typescript`, `jutsu-biome`)
- **Do**: `do-{practice}` (e.g., `do-backend-development`, `do-security-engineering`)
- **Hashi**: `hashi-{service}` (e.g., `hashi-github`, `hashi-playwright-mcp`)

### File Names

- **Skills**: `{skill-name}/SKILL.md` (directory + uppercase file)
- **Commands**: `{command-name}.md` (kebab-case)
- **Agents**: `{role-name}.md` (kebab-case)
- **Hooks**: `hooks.json` (reserved), `*.md` (documentation)

### Directory Names

- Kebab-case for all directories
- Meaningful, descriptive names
- Avoid abbreviations unless widely known

## Discovery Mechanisms

### Marketplace Registration

All plugins must be registered in `.claude-plugin/marketplace.json`:

```json
{
  "plugins": [
    {
      "name": "jutsu-typescript",
      "source": "./jutsu/jutsu-typescript",
      "category": "Technique",
      "keywords": ["typescript", "type-checking"]
    }
  ]
}
```

### Search Index Generation

Website scans plugin directories to detect:

- Skills: `glob("skills/*/SKILL.md")`
- Commands: `glob("commands/*.md")`
- Agents: `glob("agents/*.md")`
- Hooks: `glob("hooks/*.md")`

### CLI Auto-Detection

AI analyzes codebase and matches to plugin keywords:

```typescript
const codebaseAnalysis = {
  languages: ['TypeScript', 'JavaScript'],
  frameworks: ['React', 'Next.js'],
  tools: ['Biome', 'Playwright']
};

const recommendedPlugins = matchPlugins(codebaseAnalysis, marketplace);
// Returns: jutsu-typescript, jutsu-biome, jutsu-react, hashi-playwright-mcp
```

## Validation

### Structure Validation (claudelint)

Checks:

- plugin.json exists and is valid JSON
- Required fields present in plugin.json
- Skill files have frontmatter
- Command files have frontmatter
- Agent files have frontmatter
- Hooks.json matches schema

### Marketplace Validation

Checks:

- Plugin name matches directory name
- Source path exists
- Category is valid enum value
- Keywords are non-empty array

### Build-Time Validation

Checks:

- All referenced files exist
- Markdown is valid
- Frontmatter parses correctly
- No broken links between plugins

## Migration Guidelines

### Adding a New Plugin

1. Create directory in appropriate category
2. Add `.claude-plugin/plugin.json`
3. Create content (skills/commands/agents/hooks)
4. Register in marketplace.json
5. Run claudelint validation
6. Commit and push

### Moving a Plugin Between Categories

1. Move directory to new category
2. Rename directory to match new pattern
3. Update marketplace.json entry
4. Update any cross-references
5. Validate with claudelint

### Deprecating a Plugin

1. Mark as deprecated in plugin.json
2. Add deprecation notice to README
3. Keep in marketplace for 1 release
4. Remove from marketplace.json
5. Archive directory (don't delete immediately)

## Files

### Category Roots

- `bushido/` - Core foundation plugin
- `jutsu/` - Technique plugins
- `do/` - Discipline plugins
- `hashi/` - Bridge plugins

### Registry

- `.claude-plugin/marketplace.json` - Central plugin registry

### Validation

- `.github/workflows/claudelint.yml` - Structure validation

## Related Systems

- [Marketplace System](./marketplace.md) - Plugin registry and distribution
- [Plugin Installation](./plugin-installation.md) - How plugins are installed
- [Website](./website.md) - How plugins are displayed and searched
- [Plugin Types](./plugin-types.md) - Detailed category descriptions
