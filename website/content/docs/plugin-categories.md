---
title: "Plugin Categories"
description: "Han plugins are organized into nine categories: Core, Language, Framework, Validation, Tool, Integration, Discipline, Pattern, and Specialized. Each serves a specific purpose in the quality enforcement ecosystem."
---

Han plugins are organized into nine categories, each serving a specific role in the development workflow. This structure makes it easy to find the right plugins for your stack.

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

- **core** - The technical foundation. Provides hooks, metrics, and all core infrastructure
- **bushido** - Optional philosophical layer based on seven Samurai virtues (義 Righteousness, 勇 Courage, 仁 Compassion, 礼 Respect, 誠 Honesty, 名誉 Honor, 忠義 Loyalty)

**When to install:**

Always. Core is required for Han to function. Bushido is optional—install only if its philosophical approach resonates with you. All technical capabilities come from core.

**Installation:**

```bash
han plugin install core

# Optional philosophy layer
han plugin install bushido
```

## Language - Programming Language Support

Language plugins provide deep knowledge of specific programming languages, including idioms, best practices, and type systems.

**What's included:**

- Language-specific expertise and patterns
- Type system knowledge
- Concurrency and async patterns
- Memory management (for systems languages)
- Idiomatic code guidance

**Examples:**

- **typescript** - TypeScript type system mastery
- **python** - Type hints, async patterns, data modeling
- **rust** - Ownership, error handling, async programming
- **go** - Concurrency, interfaces, error handling
- **java** - Streams, concurrency, generics
- **ruby** - Metaprogramming, blocks, gems
- **elixir** - OTP, pattern matching, Ecto
- **swift** - Protocol-oriented programming, concurrency

**When to install:**

Install language plugins for every programming language in your project. They ensure Claude understands language-specific patterns and best practices.

**Installation:**

```bash
# Auto-detect languages in your project
han plugin install --auto

# Or install specific languages
han plugin install typescript
han plugin install python
han plugin install rust
```

## Framework - Framework Integrations

Framework plugins provide expertise for specific web, mobile, and backend frameworks.

**What's included:**

- Framework-specific architecture patterns
- Component and module organization
- Data fetching and state management
- Routing and navigation patterns
- Performance optimization techniques

**Examples:**

- **react** - Hooks, context, performance optimization
- **nextjs** - App Router, Server Components, data fetching
- **django** - ORM, class-based views, REST framework
- **rails** - MVC patterns, Active Record, Hotwire
- **phoenix** - LiveView, channels, Ecto integration
- **vue** - Composition API, components, reactivity
- **fastapi** - Dependency injection, async patterns
- **expo** - React Native with config, router, updates

**When to install:**

Install framework plugins for every framework your project uses. They ensure Claude follows framework conventions and best practices.

**Installation:**

```bash
# Auto-detect frameworks
han plugin install --auto

# Or install specific frameworks
han plugin install react
han plugin install nextjs
han plugin install django
```

## Validation - Code Quality Enforcement

Validation plugins handle linting, formatting, type checking, and static analysis. They run automatically via Stop hooks.

**What's included:**

- Automatic validation on conversation end
- Configuration and rule customization
- Editor integration guidance
- CI/CD integration patterns

**Examples:**

- **biome** - Fast JavaScript/TypeScript linting and formatting
- **eslint** - JavaScript/TypeScript linting with custom rules
- **prettier** - Code formatting for multiple languages
- **rubocop** - Ruby linting and style enforcement
- **pylint** - Python linting and code quality
- **clippy** - Rust linting and code quality
- **checkstyle** - Java code quality and style
- **shellcheck** - Shell script validation

**When to install:**

Install validation plugins for every linter and formatter your project uses. They ensure code quality is enforced automatically.

**Installation:**

```bash
# Auto-detect linters in your project
han plugin install --auto

# Or install specific validators
han plugin install biome
han plugin install eslint
han plugin install rubocop
```

## Tool - Development Tools

Tool plugins cover build systems, testing frameworks, package managers, and other development utilities.

**What's included:**

- Build and bundler configuration
- Testing framework expertise
- Package management best practices
- CI/CD and automation patterns

**Examples:**

- **playwright** - End-to-end testing and automation
- **jest** - JavaScript testing framework
- **pytest** - Python testing framework
- **webpack** - Build and bundling configuration
- **docker-compose** - Container orchestration
- **kubernetes** - Cloud-native deployment
- **terraform** - Infrastructure as code
- **graphql** - Schema design and queries

**When to install:**

Install tool plugins for every build tool, test framework, and utility your project depends on.

**Installation:**

```bash
# Auto-detect tools
han plugin install --auto

# Or install specific tools
han plugin install playwright
han plugin install jest
han plugin install webpack
```

## Integration - External Services

Integration plugins connect Claude to external services via MCP (Model Context Protocol). They enable Claude to interact with APIs, issue trackers, and other platforms.

**What's included:**

- MCP server definitions
- Authentication and authorization
- API integrations
- Tool-specific commands and workflows

**Examples:**

- **github** - Issues, PRs, Actions, code search
- **gitlab** - Issues, merge requests, CI/CD
- **jira** - Ticket management, JQL search
- **linear** - Issue management, project tracking
- **figma** - Design-to-code workflows
- **sentry** - Error tracking and monitoring
- **playwright-mcp** - Browser automation via MCP
- **blueprints** - Technical documentation management

**Dual-Mode Operation:**

Integration plugins support two operation modes:

| Mode | Tools Visible | Use Case |
|------|---------------|----------|
| **Orchestrator** (default) | None—Han manages all tools via `han_workflow` | Reduced context, unified interface |
| **Direct** | All backend MCP tools exposed individually | Full tool access when needed |

In orchestrator mode, Han exposes a single `han_workflow` tool that can invoke any backend capability. This reduces context usage from 50+ tools to ~5.

**When to install:**

Install integration plugins for external services you use in your workflow. They enable Claude to interact with these services naturally through conversation.

**Installation:**

```bash
# Install to user settings (recommended for MCP servers)
han plugin install github
han plugin install playwright-mcp

# Or specify scope explicitly
han plugin install blueprints --scope user
```

**Switching modes:**

```yaml
# han.yml - disable orchestrator for direct MCP access
orchestrator:
  enabled: false
```

## Discipline - Specialized AI Agents

Discipline plugins provide specialized agents for complex, multi-phase workflows. Think of them as expert consultants with deep domain knowledge.

**What's included:**

- Autonomous agents for specific disciplines
- Multi-step workflows
- Domain-specific best practices
- Quality checklists and verification

**Examples:**

- **frontend** - UI/UX development with accessibility expertise
- **backend** - API design, system architecture
- **accessibility** - WCAG, ARIA, inclusive design
- **security** - Secure architecture, vulnerability assessment
- **documentation** - Technical writing and knowledge management
- **quality** - Testing strategies and QA
- **architecture** - System design and patterns
- **data-engineering** - ETL pipelines, streaming, warehousing

**When to install:**

Install discipline plugins for specialized tasks you perform regularly. Each agent brings deep expertise and handles complexity autonomously.

**Installation:**

```bash
# Browse available agents
han plugin search discipline

# Install specific agents
han plugin install frontend
han plugin install security
han plugin install documentation
```

## Pattern - Methodologies and Workflows

Pattern plugins encode development methodologies, design patterns, and workflow practices.

**What's included:**

- Methodology guidance and enforcement
- Workflow patterns and best practices
- Design system principles
- Quality process enforcement

**Examples:**

- **[ai-dlc](https://ai-dlc.dev)** - AI-driven development lifecycle methodology
- **tdd** - Test-Driven Development with red-green-refactor
- **bdd** - Behavior-Driven Development collaboration patterns
- **atomic-design** - Component-based design system (atoms, molecules, organisms)
- **monorepo** - Monorepo architecture and tooling
- **functional-programming** - FP principles and patterns
- **oop** - Object-oriented design patterns
- **git-storytelling** - Meaningful commit history practices

**When to install:**

Install pattern plugins to enforce development methodologies your team follows.

**Installation:**

```bash
# Install methodology patterns
han plugin install ai-dlc
han plugin install tdd
han plugin install atomic-design
```

## Specialized - Niche and Platform-Specific

Specialized plugins cover niche technologies, platform-specific tools, and domain-specific utilities.

**What's included:**

- Platform-specific validation (iOS, Android)
- Domain-specific tools (ML, VoIP)
- Project-specific utilities
- Niche technology support

**Examples:**

- **android** - Android development with Gradle validation
- **ios** - iOS development with Xcode validation
- **tensorflow** - Machine learning framework skills
- **fnox** - Secrets management validation
- **claude-agent-sdk** - Claude Agent SDK projects
- **han-plugins** - Han plugin development
- **sentry** - Error monitoring patterns
- **sip** - VoIP and real-time communications

**When to install:**

Install specialized plugins when working with niche technologies or platform-specific features.

**Installation:**

```bash
# Install platform-specific plugins
han plugin install android
han plugin install ios

# Install domain-specific plugins
han plugin install tensorflow
```

## How They Work Together

Han plugins compose into a complete quality system. Here's a real example:

**Request:** "Add user authentication to the app"

**What happens:**

1. **core** provides infrastructure and quality enforcement
2. **nextjs** (Framework) provides Next.js implementation knowledge
3. **typescript** (Language) ensures type safety throughout
4. **frontend** (Discipline) handles UI components
5. **Validation hooks** run automatically (via core):
   - Biome linting check
   - TypeScript compilation check
   - Next.js build verification
   - Test suite execution
6. **github** (Integration) can create a PR with changes

All of this happens automatically from one request. No manual intervention needed.

## Installation Scopes

Plugins can be installed to different scopes:

- **user** (default) - Shared across all projects (`~/.claude/settings.json`)
- **project** - Team settings for current project (`.claude/settings.json`)
- **local** - Personal overrides, gitignored (`.claude/settings.local.json`)

**Recommendations:**

- **user scope**: MCP servers (Integration plugins), core plugins, Discipline plugins
- **project scope**: Language, Framework, Validation plugins with hooks
- **local scope**: Personal preferences not shared with team

## Next Steps

- [Install Han](/docs/installation) and auto-detect your stack
- Browse the [plugin marketplace](https://han.guru/plugins/)
- Learn about [configuration](/docs/configuration)
- Explore the [CLI reference](/docs/cli)
