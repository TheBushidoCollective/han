---
name: plugin-directory
summary: Filesystem organization with category-based directories and short plugin identifiers
---

# Plugin Directory Organization

Filesystem structure and conventions for organizing 180+ plugins across seven functional categories.

## Overview

The Han repository organizes plugins into category-based directories under `plugins/`. Each plugin uses a short identifier matching its directory name, with no prefixes. Categories group plugins by function rather than type.

## Architecture

### Directory Layout

```
plugins/
├── core/                       # Foundation plugin (1)
├── languages/                  # Programming languages (21)
│   ├── typescript/
│   ├── rust/
│   ├── python/
│   └── ...
├── validation/                 # Linters & formatters (13)
│   ├── biome/
│   ├── eslint/
│   └── ...
├── services/                   # External integrations (12)
│   ├── github/
│   ├── gitlab/
│   ├── linear/
│   └── ...
├── tools/                      # Development tools (40)
│   ├── playwright/
│   ├── vitest/
│   └── ...
├── frameworks/                 # Web frameworks (20)
│   ├── react/
│   ├── nextjs/
│   └── ...
├── disciplines/                # Domain expertise (29)
│   ├── frontend-development/
│   ├── api-engineering/
│   └── ...
├── patterns/                   # Design patterns (8)
│   ├── bdd/
│   ├── ddd/
│   └── ...
├── specialized/                # Domain-specific (12)
│   ├── ai-engineering/
│   ├── blockchain-development/
│   └── ...
└── bridges/                    # Legacy category (use services/)
    └── ...
```

### Category Breakdown

| Category | Directory | Pattern | Count | Purpose |
|----------|-----------|---------|-------|---------|
| Core | `core/` | Single plugin | 1 | Foundation, hooks, MCP servers |
| Languages | `languages/` | `{language}/` | 21 | Language expertise, LSP, validation |
| Validation | `validation/` | `{tool}/` | 13 | Linting, formatting, quality gates |
| Services | `services/` | `{service}/` | 12 | External API integrations via MCP |
| Tools | `tools/` | `{tool}/` | 40 | Development tooling, testing, automation |
| Frameworks | `frameworks/` | `{framework}/` | 20 | Framework patterns, LSP integration |
| Disciplines | `disciplines/` | `{practice}/` | 29 | Domain expertise, specialized agents |
| Patterns | `patterns/` | `{pattern}/` | 8 | Design patterns, architectural approaches |
| Specialized | `specialized/` | `{domain}/` | 12 | Domain-specific specialized plugins |

## Plugin Structure Patterns

### Core Plugin

```
plugins/core/
├── .claude-plugin/
│   └── plugin.json           # Includes mcpServers config
├── skills/                   # Quality principles
│   ├── professional-honesty/SKILL.md
│   ├── solid-principles/SKILL.md
│   ├── boy-scout-rule/SKILL.md
│   └── ...
├── hooks/                    # Session hooks
│   ├── context.sh
│   ├── datetime.sh
│   ├── setup.sh
│   └── ...
├── han-plugin.yml            # Hook definitions
└── README.md
```

**Characteristics**:

- Skills for quality principles and universal practices
- Session hooks (SessionStart, UserPromptSubmit, Setup)
- MCP servers (han for memory/tasks, context7 for docs)
- Foundation for all other plugins

### Language Plugin

```
plugins/languages/{language}/
├── .claude-plugin/
│   └── plugin.json           # May include lspServers config
├── skills/
│   ├── {language}-patterns/SKILL.md
│   ├── {language}-best-practices/SKILL.md
│   └── ...
├── hooks/                    # Validation hooks (optional)
│   └── hooks.json
├── scripts/                  # LSP entrypoints (optional)
│   └── lsp-entrypoint.sh
├── han-plugin.yml            # Hook definitions (optional)
└── README.md
```

**Examples**:

- `typescript/` - TypeScript expertise + LSP + type checking
- `rust/` - Rust expertise + LSP + compilation
- `python/` - Python expertise + LSP
- `go/` - Go expertise + LSP + compilation

**Characteristics**:

- Language-specific skills (patterns, idioms, best practices)
- LSP server integration for code intelligence
- Validation hooks (type checking, compilation)
- Smart caching (only run when source files change)

### Validation Plugin

```
plugins/validation/{tool}/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json            # Stop event hooks
├── han-plugin.yml            # Hook definitions
└── README.md
```

**Examples**:

- `biome/` - JS/TS linting + formatting
- `eslint/` - JS/TS linting
- `prettier/` - Multi-language formatting
- `clippy/` - Rust linting

**Characteristics**:

- Stop hooks for quality gates
- Auto-fix when possible
- Directory targeting (only run where config exists)
- Change detection (skip if no relevant changes)

### Service Plugin (MCP)

```
plugins/services/{service}/
├── .claude-plugin/
│   └── plugin.json           # Includes mcpServers config
├── skills/                   # Usage patterns (optional)
│   └── {service}-workflows/SKILL.md
├── han-plugin.yml            # Custom settings (optional)
└── README.md
```

**Examples**:

- `github/` - GitHub API integration (100+ tools)
- `gitlab/` - GitLab API integration
- `linear/` - Linear project management
- `sentry/` - Error tracking and monitoring

**MCP Configuration Pattern**:

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp"
    }
  }
}
```

**Characteristics**:

- MCP server integration (HTTP or stdio)
- External API access
- Zero-config authentication (OAuth via Claude Code)
- Optional skills for common workflows

### Framework Plugin

```
plugins/frameworks/{framework}/
├── .claude-plugin/
│   └── plugin.json           # May include lspServers config
├── skills/
│   ├── {framework}-patterns/SKILL.md
│   ├── {framework}-best-practices/SKILL.md
│   └── ...
├── scripts/                  # LSP entrypoints (optional)
│   └── lsp-entrypoint.sh
├── han-plugin.yml            # Hook definitions (optional)
└── README.md
```

**Examples**:

- `react/` - React patterns and hooks
- `nextjs/` - Next.js expertise + LSP
- `relay/` - Relay GraphQL framework + LSP
- `vue/` - Vue.js patterns + LSP

**Characteristics**:

- Framework-specific patterns and best practices
- LSP integration for framework-aware intelligence
- Optional validation hooks
- Code generation skills

### Discipline Plugin

```
plugins/disciplines/{practice}/
├── .claude-plugin/
│   └── plugin.json
├── agents/                   # Expert agents (optional)
│   ├── {role-1}.md
│   ├── {role-2}.md
│   └── ...
├── skills/                   # Domain skills (optional)
│   └── {skill}/SKILL.md
└── README.md
```

**Examples**:

- `frontend-development/` - Frontend engineering expertise
- `api-engineering/` - API design and development
- `security-engineering/` - Security practices
- `performance-engineering/` - Optimization and scaling

**Characteristics**:

- Domain-specific expertise
- Optional specialized agents
- Skills for reusable knowledge
- Guidance-based (rarely uses hooks)

### Tool Plugin

```
plugins/tools/{tool}/
├── .claude-plugin/
│   └── plugin.json           # May include mcpServers config
├── skills/
│   └── {tool}-usage/SKILL.md
├── han-plugin.yml            # Hook definitions (optional)
└── README.md
```

**Examples**:

- `playwright/` - Browser automation (has MCP)
- `vitest/` - Unit testing (has hooks)
- `docker/` - Containerization expertise
- `kubernetes/` - Container orchestration

**Characteristics**:

- Tool expertise and patterns
- Optional MCP integration
- Optional validation hooks
- Build and automation workflows

## File Conventions

### Required Files

**All Plugins**:

- `.claude-plugin/plugin.json` - Plugin metadata and configuration
- `README.md` - Documentation and usage guide

### Optional Files by Category

| Category | Skills | Agents | Hooks | LSP | MCP |
|----------|--------|--------|-------|-----|-----|
| Core | ✓ | ✗ | ✓ | ✗ | ✓ |
| Languages | ✓ | ✗ | Often | Often | ✗ |
| Validation | ✗ | ✗ | ✓ | ✗ | ✗ |
| Services | Optional | ✗ | Rarely | ✗ | ✓ |
| Tools | ✓ | ✗ | Sometimes | Rarely | Sometimes |
| Frameworks | ✓ | ✗ | Sometimes | Sometimes | ✗ |
| Disciplines | Optional | Optional | Rarely | ✗ | ✗ |

### Plugin Metadata (plugin.json)

```json
{
  "name": "typescript",
  "version": "1.10.0",
  "description": "TypeScript compiler validation and type checking for TypeScript projects.",
  "author": {
    "name": "The Bushido Collective",
    "url": "https://thebushido.co"
  },
  "homepage": "https://github.com/thebushidocollective/han",
  "repository": "https://github.com/thebushidocollective/han",
  "license": "Apache-2.0",
  "keywords": ["typescript", "tsc", "type-checking", "validation"]
}
```

**Required Fields**:

- `name` - Must match directory name (short identifier, no prefix)
- `version` - Semantic version
- `description` - Human-readable purpose
- `author` - Creator/maintainer (string or object)
- `license` - License identifier

**Optional Fields**:

- `keywords` - Searchable tags
- `homepage` - Documentation URL
- `repository` - Source code URL
- `lspServers` - LSP server configuration
- `mcpServers` - MCP server configuration

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

**Note**: Skills are directly invocable as slash commands. The old `commands/` directory is deprecated.

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

### Hook Configuration (han-plugin.yml)

```yaml
hooks:
  typecheck:
    event: Stop
    command: npx -y --package typescript tsc --noEmit
    description: Run TypeScript type checking
```

**Hook Properties**:

- `event` - Hook event (Stop, SessionStart, PostToolUse, etc.)
- `command` - Shell command to execute
- `description` - Human-readable description

### LSP Configuration (plugin.json)

```json
{
  "lspServers": {
    "typescript": {
      "command": "${CLAUDE_PLUGIN_ROOT}/scripts/lsp-entrypoint.sh",
      "args": ["--stdio"],
      "extensionToLanguage": {
        ".ts": "typescript",
        ".tsx": "typescriptreact"
      },
      "startupTimeout": 60000,
      "maxRestarts": 3
    }
  }
}
```

### MCP Configuration (plugin.json)

```json
{
  "mcpServers": {
    "github": {
      "type": "http",
      "url": "https://api.githubcopilot.com/mcp"
    }
  }
}
```

## Naming Conventions

### Plugin Names

Plugins are identified by **short names** matching their directory:

| Directory | Plugin Name | Installation Command |
|-----------|-------------|----------------------|
| `languages/typescript` | `typescript` | `han plugin install typescript` |
| `services/github` | `github` | `han plugin install github` |
| `validation/biome` | `biome` | `han plugin install biome` |
| `frameworks/react` | `react` | `han plugin install react` |
| `disciplines/frontend-development` | `frontend-development` | `han plugin install frontend-development` |

**NEVER use prefixed names**:

- ~~`jutsu-typescript`~~ → Use `typescript`
- ~~`hashi-github`~~ → Use `github`
- ~~`do-frontend-development`~~ → Use `frontend-development`

### File Names

- **Skills**: `{skill-name}/SKILL.md` (directory + uppercase file)
- **Agents**: `{role-name}.md` (kebab-case)
- **Scripts**: `{script-name}.sh` (kebab-case)

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
      "name": "typescript",
      "source": "./plugins/languages/typescript",
      "category": "Language",
      "keywords": ["typescript", "type-checking", "validation"]
    }
  ]
}
```

### Plugin Aliases

For backward compatibility, marketplace.json includes alias entries:

```json
{
  "name": "jutsu-typescript",
  "source": "./plugins/languages/typescript",
  "category": "Language"
}
```

This allows existing users with old plugin names in settings to continue working.

### CLI Auto-Detection

AI analyzes codebase and matches to plugin keywords:

```typescript
const codebaseAnalysis = {
  languages: ['TypeScript', 'JavaScript'],
  frameworks: ['React', 'Next.js'],
  tools: ['Biome', 'Playwright']
};

const recommendedPlugins = matchPlugins(codebaseAnalysis, marketplace);
// Returns: typescript, react, nextjs, biome, playwright
```

## Validation

### Structure Validation (claudelint)

Checks:

- `plugin.json` exists and is valid JSON
- Required fields present in `plugin.json`
- Skill files have frontmatter
- Agent files have frontmatter
- LSP/MCP configs match schema

### Marketplace Validation

Checks:

- Plugin name matches directory name
- Source path exists and is correct
- Category is valid enum value
- Keywords are non-empty array

### Build-Time Validation

Checks:

- All referenced files exist
- Markdown is valid
- Frontmatter parses correctly
- No broken cross-plugin references

## Migration from Old Structure

### Old vs New Naming

| Old Name | New Directory | New Name |
|----------|---------------|----------|
| `jutsu-typescript` | `languages/typescript` | `typescript` |
| `jutsu-biome` | `validation/biome` | `biome` |
| `hashi-github` | `services/github` | `github` |
| `hashi-playwright-mcp` | `tools/playwright` | `playwright` |
| `do-frontend-development` | `disciplines/frontend-development` | `frontend-development` |

### commands/ to skills/

Commands have been merged into skills. Skills are now directly invocable as slash commands:

```
Old: commands/review.md → /review
New: skills/review/SKILL.md → /review
```

The `commands/` directory is deprecated and removed from all plugins.

## Files

### Plugin Root

- `plugins/` - All plugins organized by category

### Category Directories

- `plugins/core/` - Core foundation plugin
- `plugins/languages/` - Language plugins
- `plugins/validation/` - Linting and formatting
- `plugins/services/` - External integrations
- `plugins/tools/` - Development tools
- `plugins/frameworks/` - Framework support
- `plugins/disciplines/` - Domain expertise

### Registry

- `.claude-plugin/marketplace.json` - Central plugin registry

### Validation

- `.github/workflows/claudelint.yml` - Structure validation CI

## Related Systems

- [Plugin Types](./plugin-types.md) - Detailed category descriptions
- [Plugin Installation](./plugin-installation.md) - How plugins are installed
- [Hook System](./hook-system.md) - How hooks work
- [Marketplace](./marketplace.md) - Plugin registry and distribution
- [Website](./website.md) - How plugins are displayed and searched