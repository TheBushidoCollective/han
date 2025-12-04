# Plugin Types

Bushido, Jutsu, Do, and Hashi plugin categories.

## Overview

Han organizes plugins into four categories, each serving a distinct purpose:

| Type | Purpose | Contains | Count |
|------|---------|----------|-------|
| Bushido | Foundation | Commands, Skills, Hooks | 1 |
| Jutsu | Techniques | Skills, Hooks | 80+ |
| Do | Disciplines | Agents | 33 |
| Hashi | Bridges | MCP Servers, Commands | 8 |

## Bushido - Foundation

### Purpose

Core quality principles and workflow orchestration. Every Han installation starts with Bushido.

### Structure

```
bushido/
├── .claude-plugin/
│   └── plugin.json
├── commands/           # Workflow commands
│   ├── develop.md     # 7-phase development
│   ├── review.md      # Multi-agent review
│   └── ...
├── skills/             # Quality principles
│   ├── solid-principles/
│   ├── boy-scout-rule/
│   └── ...
└── hooks/              # Quality enforcement
    ├── hooks.json
    └── *.md
```

### Key Features

- **14 Commands** - Structured workflows (`/develop`, `/review`, `/refactor`)
- **18 Skills** - Quality principles and practices
- **Event Hooks** - Enforcement at SessionStart, Stop, UserPromptSubmit

### When to Use

Always installed. Provides foundation for all other plugins.

## Jutsu - Techniques

### Purpose

Tool-specific expertise for languages, frameworks, and validation tools.

### Structure

```
jutsu-{tool}/
├── .claude-plugin/
│   └── plugin.json
├── skills/             # Tool expertise
│   └── {skill}/
│       └── SKILL.md
├── hooks/              # Validation hooks (optional)
│   └── hooks.json
└── han-config.json     # Hook definitions (optional)
```

### Key Features

- **Skills** - Deep knowledge of specific tools
- **Validation Hooks** - Run linters/formatters at Stop
- **Caching** - Only run when relevant files change

### Examples

| Plugin | Purpose | Has Hooks |
|--------|---------|-----------|
| jutsu-biome | JS/TS linting | Yes |
| jutsu-typescript | TypeScript expertise | Optional |
| jutsu-pytest | Python testing | Optional |
| jutsu-bdd | BDD methodology | Yes |

### When to Use

Install for specific tools in your project. Multiple jutsu plugins can coexist.

## Do - Disciplines

### Purpose

Specialized agents with domain expertise for different engineering roles.

### Structure

```
do-{discipline}/
├── .claude-plugin/
│   └── plugin.json
├── agents/             # Expert agents
│   ├── {role-1}.md
│   └── {role-2}.md
└── README.md
```

### Key Features

- **Expert Agents** - Specialized personas with domain knowledge
- **Multiple Roles** - Each plugin may have several agents
- **No Hooks** - Guidance-based, not enforcement

### Examples

| Plugin | Agents |
|--------|--------|
| do-backend-development | Backend Architect, API Designer |
| do-frontend-development | Presentation Engineer |
| do-security-engineering | Security Analyst |
| do-accessibility-engineering | Accessibility Engineer |

### Agent Format

```yaml
---
name: backend-architect
description: Use when designing data models and system architecture
color: yellow
model: inherit
---

# Backend Architect

You are a Senior Backend Architect...
```

### When to Use

Install for domain expertise. Agents are invoked when Claude needs specialized guidance.

## Hashi - Bridges

### Purpose

MCP server integrations connecting Claude Code to external services.

### Structure

```
hashi-{service}/
├── .claude-plugin/
│   └── plugin.json    # Contains mcpServers config
├── commands/           # Wrapper commands (optional)
│   └── {command}.md
└── README.md
```

### Key Features

- **MCP Servers** - External API access via Model Context Protocol
- **Zero-Config Auth** - Uses existing CLI authentication
- **Tool Exposure** - Makes API tools available to agent

### Examples

| Plugin | Service | Tools |
|--------|---------|-------|
| hashi-github | GitHub API | 100+ (issues, PRs, code search) |
| hashi-playwright-mcp | Browser automation | Navigate, click, screenshot |
| hashi-context7 | Documentation | Library docs lookup |

### MCP Configuration

```json
{
  "mcpServers": {
    "github": {
      "command": "sh",
      "args": ["-c", "GITHUB_PERSONAL_ACCESS_TOKEN=$(gh auth token) docker run -i --rm -e GITHUB_PERSONAL_ACCESS_TOKEN ghcr.io/github/github-mcp-server"]
    }
  }
}
```

### When to Use

Install for external service integration. MCP tools become available automatically.

## Comparison

| Aspect | Bushido | Jutsu | Do | Hashi |
|--------|---------|-------|-----|-------|
| Primary Content | Commands, Skills | Skills | Agents | MCP Servers |
| Has Commands | Yes | Rarely | No | Sometimes |
| Has Skills | Yes | Yes | No | No |
| Has Agents | No | No | Yes | No |
| Has Hooks | Yes | Often | Rarely | No |
| Has MCP | No | No | No | Yes |
| Dependencies | None | Bushido | Bushido | None |

## Plugin Discovery

Plugins are organized by type in the marketplace:

```
han/
├── bushido/           # 1 plugin
├── jutsu/             # 80+ plugins
├── do/                # 33 plugins
└── hashi/             # 8 plugins
```

## Related Systems

- [Plugin Installation](./plugin-installation.md) - How plugins are installed
- [Hook System](./hook-system.md) - How hooks work
- [MCP Server](./mcp-server.md) - How MCP integration works
