---
title: "Plugin Categories"
description: "Han plugins are organized into four categories: Core, Jutsu, Do, and Hashi. Each serves a specific purpose in the quality enforcement ecosystem."
---

Han plugins follow Japanese martial arts naming conventions, organizing by purpose. Each category serves a specific role in the quality enforcement ecosystem.

## Core - Foundation

The essential infrastructure that powers Han. Always required.

**What's included:**

- Quality enforcement through validation hooks
- Metrics tracking and confidence calibration
- Context7 integration for up-to-date library documentation
- Universal programming principles (SOLID, DRY, composition over inheritance)
- MCP servers for hooks and metrics
- Binary auto-installation on first session

**Key plugins:**

- **core** (`han-core`) - The technical foundation. Provides hooks, metrics, and all core infrastructure
- **bushido** - Optional philosophical layer based on seven Samurai virtues (義 Righteousness, 勇 Courage, 仁 Compassion, 礼 Respect, 誠 Honesty, 名誉 Honor, 忠義 Loyalty)

**When to install:**

Always. Core is required for Han to function. Bushido is optional—install only if its philosophical approach resonates with you. All technical capabilities come from core.

**Installation:**

```bash
han plugin install core

# Optional philosophy layer
han plugin install bushido
```

## Jutsu (術) - Technical Skills

Jutsu plugins are "techniques"—deep knowledge of specific technologies paired with automatic validation.

**What's included:**

- Technology-specific expertise (skills, commands)
- Validation hooks that run automatically
- Best practices and patterns
- Error detection and remediation guidance

**Examples:**

- **jutsu-typescript** - TypeScript expertise + type checking hooks
- **jutsu-playwright** - E2E testing knowledge + test validation
- **jutsu-nextjs** - Next.js patterns + build verification
- **jutsu-biome** - Code formatting + automatic linting
- **jutsu-python** - Python skills + validation
- **jutsu-rust** - Rust patterns + compilation checks

**When to install:**

Install jutsu plugins for every technology in your stack. They ensure Claude not only knows the technology but validates its work automatically.

**Installation:**

```bash
# Auto-detect and install all relevant jutsu plugins
han plugin install --auto

# Or install specific technologies
han plugin install jutsu-typescript
han plugin install jutsu-react
han plugin install jutsu-python
```

## Dō (道) - Specialized Agents

Do plugins provide specialized agents for complex, multi-phase workflows. Think of them as expert consultants with deep domain knowledge.

**What's included:**

- Autonomous agents for specific disciplines
- Multi-step workflows
- Domain-specific best practices
- Quality checklists and verification

**Examples:**

- **do-frontend-development** - UI/UX-focused agent with accessibility expertise
- **do-technical-documentation** - Documentation agent following best practices
- **do-accessibility-engineering** - Multiple agents for inclusive design
- **do-code-review** - Comprehensive code review with confidence-based filtering
- **do-debugging** - Systematic debugging workflows
- **do-architecture-design** - System architecture and planning

**When to install:**

Install do plugins for specialized tasks you perform regularly. Each agent brings deep expertise and handles complexity autonomously.

**Installation:**

```bash
# Browse available agents
han plugin search do-

# Install specific agents
han plugin install do-frontend-development
han plugin install do-code-review
```

## Hashi (橋) - External Bridges

Hashi plugins are MCP servers that connect Claude to external services and tools. They turn Claude into a universal interface for your development workflow.

**What's included:**

- MCP server implementations
- Authentication and authorization
- API integrations
- Tool-specific commands and workflows

**Examples:**

- **hashi-github** - GitHub Issues, PRs, code search, Actions
- **hashi-playwright-mcp** - Browser automation and testing
- **hashi-blueprints** - Codebase documentation and knowledge management
- **hashi-jira** - Issue tracking and project management
- **hashi-sentry** - Error tracking and monitoring

**When to install:**

Install hashi plugins for external services you use in your workflow. They enable Claude to interact with these services naturally through conversation.

**Installation:**

```bash
# Install to user settings (recommended for MCP servers)
han plugin install hashi-github
han plugin install hashi-playwright-mcp

# Or specify scope explicitly
han plugin install hashi-blueprints --scope user
```

## How They Work Together

Han plugins compose into a complete quality system. Here's a real example:

**Request:** "Add user authentication to the app"

**What happens:**

1. **Core** provides infrastructure and quality enforcement
2. **jutsu-nextjs** provides Next.js implementation knowledge
3. **jutsu-typescript** ensures type safety throughout
4. **do-frontend-development** handles UI components
5. **Validation hooks** run automatically (via core):
   - TypeScript compilation check
   - Next.js build verification
   - Test suite execution
6. **Core code review** analyzes the result
7. **hashi-github** can create a PR with changes

All of this happens automatically from one request. No manual intervention needed.

## Installation Scopes

Plugins can be installed to different scopes:

- **user** (default) - Shared across all projects (`~/.claude/settings.json`)
- **project** - Team settings for current project (`.claude/settings.json`)
- **local** - Personal overrides, gitignored (`.claude/settings.local.json`)

**Recommendations:**

- **user scope**: MCP servers (hashi-*), core plugins, general agents (do-*)
- **project scope**: Technology validation (jutsu-* with hooks)
- **local scope**: Personal preferences not shared with team

## Next Steps

- [Install Han](/docs/installation) and auto-detect your stack
- Browse the [plugin marketplace](https://han.guru/plugins/)
- Learn about [configuration](/docs/configuration)
- Explore the [CLI reference](/docs/cli)
