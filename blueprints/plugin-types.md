---
name: plugin-types
summary: Plugin categories organized by function: core, languages, validation, services, tools, frameworks, disciplines
---

# Plugin Types

Plugin categories organized by function: core, languages, validation, services, tools, frameworks, disciplines.

## Overview

Han organizes plugins into seven functional categories, each serving a distinct purpose. Plugins are identified by their short name (matching their directory) rather than prefixed names.

| Category | Purpose | Contains | Example Count |
|----------|---------|----------|---------------|
| Core | Foundation | Skills, Hooks, MCP Servers | 1 |
| Languages | Language Support | Skills, LSP Servers, Validation | 21 |
| Validation | Linting & Formatting | Hooks, Validation Commands | 13 |
| Services | External Integrations | MCP Servers, Skills | 12 |
| Tools | Development Tools | Skills, MCP Servers | 40 |
| Frameworks | Framework Support | Skills, LSP Servers | 20 |
| Disciplines | Specialized Agents | Agents, Skills | 29 |

## Core - Foundation

### Purpose

Core quality principles, workflow orchestration, and infrastructure. Every Han installation starts with the core plugin.

### Structure

```
plugins/core/
├── .claude-plugin/
│   └── plugin.json       # Includes mcpServers config
├── skills/               # Quality principles
│   ├── professional-honesty/SKILL.md
│   ├── solid-principles/SKILL.md
│   └── ...
├── hooks/                # Session hooks
│   ├── context.sh
│   ├── datetime.sh
│   └── ...
└── han-plugin.yml        # Hook definitions
```

### Key Features

- **Quality Skills** - SOLID principles, Boy Scout Rule, etc.
- **Session Hooks** - SessionStart (context injection), UserPromptSubmit (datetime)
- **MCP Servers** - han (memory, task tracking), context7 (documentation)
- **Foundation** - Provides base for all other plugins

### When to Use

Always installed. Provides foundation for all other plugins.

## Languages - Language Support

### Purpose

Language-specific expertise, type checking, and compilation for programming languages.

### Structure

```
plugins/languages/{language}/
├── .claude-plugin/
│   └── plugin.json       # May include lspServers config
├── skills/
│   └── {language}-patterns/SKILL.md
├── hooks/                # Validation hooks (optional)
│   └── scripts/
├── scripts/              # LSP entrypoints (optional)
│   └── lsp-entrypoint.sh
└── han-plugin.yml        # Hook definitions (optional)
```

### Examples

| Plugin | Purpose | Has LSP | Has Validation |
|--------|---------|---------|----------------|
| `typescript` | TypeScript expertise + type checking | Yes | Yes |
| `rust` | Rust expertise + compilation | Yes | Yes |
| `python` | Python expertise | Yes | Optional |
| `go` | Go expertise + compilation | Yes | Yes |

### Key Features

- **Language Expertise** - Best practices, patterns, anti-patterns
- **LSP Integration** - Code intelligence, autocomplete, diagnostics
- **Type Checking** - Compilation and type validation hooks
- **Smart Caching** - Only run when relevant files change

### When to Use

Install for languages used in your project. Multiple language plugins can coexist.

## Validation - Linting & Formatting

### Purpose

Code quality enforcement through linters and formatters.

### Structure

```
plugins/validation/{tool}/
├── .claude-plugin/
│   └── plugin.json
├── hooks/
│   └── hooks.json        # Stop event hooks
└── han-plugin.yml        # Hook definitions
```

### Examples

| Plugin | Purpose | Trigger |
|--------|---------|---------|
| `biome` | JS/TS linting + formatting | Stop |
| `eslint` | JS/TS linting | Stop |
| `prettier` | Multi-language formatting | Stop |
| `clippy` | Rust linting | Stop |

### Key Features

- **Stop Hooks** - Run linters/formatters when Claude stops
- **Auto-Fix** - Automatically apply fixes when possible
- **Smart Targeting** - Only run in directories with config files
- **Change Detection** - Skip validation if no relevant files changed

### When to Use

Install for validation tools configured in your project. Provides automatic quality gates.

## Services - External Integrations

### Purpose

MCP server integrations connecting Claude Code to external services and APIs.

### Structure

```
plugins/services/{service}/
├── .claude-plugin/
│   └── plugin.json       # Includes mcpServers config
├── skills/               # Service usage patterns (optional)
│   └── {service}-workflows/SKILL.md
└── han-plugin.yml        # May define custom settings
```

### Examples

| Plugin | Service | Tools Available | Use Cases |
|--------|---------|-----------------|-----------|
| `github` | GitHub API | 100+ (issues, PRs, code search) | Code review, PR creation |
| `gitlab` | GitLab API | Projects, MRs, pipelines | CI/CD workflows |
| `linear` | Linear API | Issues, projects, workflows | Project management |
| `jira` | Jira API | Tickets, sprints, boards | Issue tracking |
| `sentry` | Error tracking | Issues, performance, releases | Error monitoring |
| `reddit` | Reddit API | Posts, comments, subreddits | Community monitoring |

### MCP Configuration

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

### When to Use

Install for external service integration. MCP tools become available automatically.

## Tools - Development Tools

### Purpose

Development tooling expertise including testing, building, automation, and specialized utilities.

### Structure

```
plugins/tools/{tool}/
├── .claude-plugin/
│   └── plugin.json       # May include mcpServers config
├── skills/
│   └── {tool}-usage/SKILL.md
└── han-plugin.yml        # Hook definitions (optional)
```

### Examples

| Plugin | Purpose | Has MCP | Has Hooks |
|--------|---------|---------|-----------|
| `playwright` | Browser automation + testing | Yes | Optional |
| `vitest` | Unit testing framework | No | Yes |
| `jest` | JavaScript testing | No | Yes |
| `pytest` | Python testing | No | Yes |
| `docker` | Containerization | No | No |
| `kubernetes` | Container orchestration | No | No |

### Key Features

- **Tool Expertise** - Best practices, patterns, common workflows
- **MCP Integration** - Some tools expose APIs (Playwright, etc.)
- **Test Execution** - Hooks to run tests on Stop
- **Build Automation** - Skills for build workflows

### When to Use

Install for development tools used in your project. Provides expertise and automation.

## Frameworks - Framework Support

### Purpose

Framework-specific expertise, patterns, and LSP integration for web frameworks and libraries.

### Structure

```
plugins/frameworks/{framework}/
├── .claude-plugin/
│   └── plugin.json       # May include lspServers config
├── skills/
│   └── {framework}-patterns/SKILL.md
├── scripts/              # LSP entrypoints (optional)
│   └── lsp-entrypoint.sh
└── han-plugin.yml        # Hook definitions (optional)
```

### Examples

| Plugin | Purpose | Has LSP | Category |
|--------|---------|---------|----------|
| `react` | React patterns + hooks | No | Frontend |
| `nextjs` | Next.js expertise | Yes | Full-stack |
| `relay` | Relay GraphQL framework | Yes | State management |
| `vue` | Vue.js patterns | Yes | Frontend |
| `rails` | Ruby on Rails expertise | No | Backend |
| `django` | Django patterns | No | Backend |

### Key Features

- **Framework Patterns** - Best practices, component design, state management
- **LSP Integration** - Framework-specific code intelligence
- **Validation** - Framework-specific linting and type checking
- **Code Generation** - Skills for common scaffolding tasks

### When to Use

Install for frameworks used in your project. Multiple framework plugins can coexist.

## Disciplines - Specialized Agents

### Purpose

Specialized agents with domain expertise for different engineering roles and practices.

### Structure

```
plugins/disciplines/{practice}/
├── .claude-plugin/
│   └── plugin.json
├── agents/               # Expert agents (optional)
│   ├── {role-1}.md
│   └── {role-2}.md
├── skills/               # Domain skills (optional)
│   └── {skill}/SKILL.md
└── README.md
```

### Examples

| Plugin | Focus Area | Agents/Skills |
|--------|------------|---------------|
| `backend-development` | Backend engineering | API design, data modeling |
| `frontend-development` | Frontend engineering | Component architecture, UX |
| `security-engineering` | Security practices | Threat modeling, secure coding |
| `api-engineering` | API design | REST, GraphQL, versioning |
| `performance-engineering` | Optimization | Profiling, caching, scaling |
| `accessibility-engineering` | A11y compliance | WCAG, ARIA, semantic HTML |

### Key Features

- **Domain Expertise** - Specialized knowledge for practice areas
- **Multi-Role Coverage** - Multiple perspectives within domain
- **Skills** - Reusable domain knowledge
- **Optional Agents** - Specialized personas for complex domains

### When to Use

Install for domain expertise relevant to your work. Provides guidance-based support.

## Additional Categories

### Patterns

Specialized design patterns and architectural approaches:

- `bdd` - Behavior-driven development
- `ddd` - Domain-driven design
- `event-sourcing` - Event-sourced architectures
- `microservices` - Microservice patterns

### Specialized

Domain-specific specialized plugins:

- `ai-engineering` - AI/ML development
- `blockchain-development` - Blockchain and Web3
- `embedded-development` - Embedded systems
- `game-development` - Game development

### Bridges (Legacy)

Older category name for services. Use `services/` for new plugins.

### Bushido (Legacy)

Old name for `core` plugin. Use `core` for references.

## Plugin Naming

Plugins are identified by their **short name** matching their directory:

| Directory | Plugin Name | Installation |
|-----------|-------------|--------------|
| `plugins/languages/typescript` | `typescript` | `han plugin install typescript` |
| `plugins/services/github` | `github` | `han plugin install github` |
| `plugins/validation/biome` | `biome` | `han plugin install biome` |
| `plugins/frameworks/react` | `react` | `han plugin install react` |
| `plugins/disciplines/frontend-development` | `frontend-development` | `han plugin install frontend-development` |

**Never use prefixed names** like `jutsu-typescript`, `hashi-github`, `do-frontend-development`. These are deprecated.

## Comparison

| Aspect | Core | Languages | Validation | Services | Tools | Frameworks | Disciplines |
|--------|------|-----------|------------|----------|-------|------------|-------------|
| Skills | Yes | Yes | No | Optional | Yes | Yes | Yes |
| Agents | No | No | No | No | No | No | Optional |
| Hooks | Yes | Often | Yes | Rarely | Sometimes | Sometimes | Rarely |
| MCP | Yes | No | No | Yes | Sometimes | No | No |
| LSP | No | Often | No | No | Rarely | Sometimes | No |
| Dependencies | None | Core | Core | Core | Core | Core | Core |

## Related Systems

- [Plugin Directory](./plugin-directory.md) - Filesystem organization details
- [Plugin Installation](./plugin-installation.md) - How plugins are installed
- [Hook System](./hook-system.md) - How hooks work
- [MCP Server](./mcp-server.md) - How MCP integration works