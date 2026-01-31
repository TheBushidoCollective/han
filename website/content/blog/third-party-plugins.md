---
title: "Build Your Own Han Plugins: The Ecosystem Is Now Open"
description: "Han now supports third-party plugins. Create custom validation hooks, specialized agents, or MCP integrations and share them with your team or the world."
date: "2026-01-30"
author: "The Bushido Collective"
tags: ["han", "plugins", "third-party", "plugin-development", "claude-code"]
category: "Announcements"
---

Until now, Han plugins lived exclusively in the main repository. If you wanted custom validation hooks for your proprietary linter or an MCP integration for your internal API, you had two options: submit a PR to the public marketplace or go without.

That changes today. Han now fully supports third-party plugins. You can build, test, and distribute your own plugins without touching the main repository.

## What This Unlocks

The third-party plugin system opens up possibilities that were previously impractical:

**Private Tooling**: Build plugins for internal tools, proprietary APIs, or company-specific workflows. Install them from local paths or private Git repos.

**Custom Validation**: Create hooks that enforce your team's coding standards, run proprietary linters, or integrate with your CI pipeline.

**Specialized Agents**: Define AI agents tuned for your domain - whether that's your specific tech stack, compliance requirements, or industry terminology.

**External Integrations**: Connect Claude to any service via MCP, from internal databases to third-party APIs that don't have public Han plugins.

## The `han create plugin` Command

Creating a new plugin is now a single command:

```bash
han create plugin
```

This launches an interactive wizard that walks you through the setup:

```
? Plugin type (use arrow keys)
❯ jutsu - Skills and validation hooks for languages/tools
  do - Specialized agents for specific disciplines
  hashi - MCP servers bridging external services

? Plugin name (without prefix): my-linter
? Description: Custom linting rules for our codebase
? Author name: Your Name
? Author URL (optional): https://your-site.com
```

The scaffolder generates a complete plugin structure with all required files, ready for customization.

For automation and CI environments, use non-interactive mode:

```bash
han create plugin \
  --type jutsu \
  --name my-linter \
  --description "Custom linting rules for our codebase" \
  --author "Your Name"
```

## Three Plugin Types

Each plugin type serves a distinct purpose:

### Jutsu: Skills with Validation Hooks

Jutsu plugins combine knowledge about a tool with automatic quality checks. They're the backbone of Han's validation system.

A jutsu plugin might include:

- Skills that teach Claude about your linter's configuration options
- A Stop hook that runs your linter after every change
- Commands for common operations like `--fix` mode

Example `han-plugin.yml`:

```yaml
hooks:
  lint:
    command: "npx my-linter check ${HAN_FILES}"
    dirs_with:
      - "my-linter.config.js"
    if_changed:
      - "**/*.{js,jsx,ts,tsx}"
    description: "Run custom linting rules"
```

### Do: Specialized Agents

Do plugins define AI agents with focused expertise. They're useful for complex workflows that benefit from specialized context.

An agent definition is a markdown file with frontmatter:

```markdown
---
name: code-quality-analyzer
description: |
  Use this agent for analyzing code quality, identifying technical debt,
  and recommending improvements.
model: inherit
color: purple
---

# Code Quality Analyzer

You are a Code Quality Analyzer specializing in identifying
technical debt, code smells, and improvement opportunities.

## Core Responsibilities

1. **Complexity Analysis**: Identify overly complex functions
2. **Maintainability Review**: Assess code readability
3. **Pattern Detection**: Find anti-patterns and suggest alternatives
```

### Hashi: MCP Integrations

Hashi plugins connect Claude to external services via MCP servers. They can use HTTP transport (preferred) or stdio.

Example `.mcp.json` for HTTP transport:

```json
{
  "mcpServers": {
    "my-api": {
      "type": "http",
      "url": "https://mcp.my-api.com/mcp"
    }
  }
}
```

Or for npx-based servers:

```json
{
  "mcpServers": {
    "my-api": {
      "command": "npx",
      "args": ["-y", "@my-org/mcp-server-my-api"]
    }
  }
}
```

## Plugin Structure

All Han plugins follow the same base structure:

```
your-plugin/
├── .claude-plugin/
│   └── plugin.json      # Required: metadata
├── han-plugin.yml       # Hook configuration (optional)
├── skills/              # Skills (optional)
│   └── skill-name/
│       └── SKILL.md
├── commands/            # Slash commands (optional)
│   └── command-name.md
├── agents/              # Agents for do-* plugins
│   └── agent-name.md
├── .mcp.json            # MCP config for hashi-* plugins
├── README.md
└── CHANGELOG.md
```

The `.claude-plugin/plugin.json` file is required:

```json
{
  "name": "jutsu-my-linter",
  "version": "1.0.0",
  "description": "Custom linting rules for our codebase",
  "author": {
    "name": "Your Name",
    "url": "https://your-site.com"
  },
  "license": "MIT",
  "keywords": ["linting", "code-quality"]
}
```

## See All Your Hooks

The new `han hook list` command shows every hook from every installed plugin:

```bash
han hook list
```

Output:

```
Available Hooks:

  jutsu-bun:
    test - Run Bun tests
    build - Build the Bun project

  jutsu-typescript:
    typecheck - Type-check TypeScript code for type errors

  jutsu-my-linter:
    lint - Run custom linting rules
```

Filter by plugin or get JSON output for scripting:

```bash
han hook list --plugin jutsu-my-linter
han hook list --json
```

## Distribution Options

You have multiple ways to distribute plugins:

### Local Path (Development and Private Plugins)

```bash
han plugin install --path ./my-plugin
han plugin install --path /absolute/path/to/plugin
```

### Git Repository (Team Sharing)

```bash
han plugin install --git https://github.com/org/my-plugin
han plugin install --git git@github.com:org/private-plugin.git --tag v1.0.0
```

### URL Archive (Quick Sharing)

```bash
han plugin install --url https://example.com/plugins/my-plugin-1.0.0.tar.gz
```

### Han Marketplace (Public Distribution)

Submit a PR to the Han repository to list your plugin in the public marketplace:

```bash
han plugin install my-plugin  # After marketplace acceptance
```

## Validation

Before distributing, validate your plugin structure:

```bash
cd my-plugin
han plugin validate .
```

This checks:

- Required files are present
- `plugin.json` schema is valid
- Hook configurations are correct
- Skill frontmatter is valid

## Quick Start

Here's the fastest path to a working plugin:

```bash
# 1. Create the plugin
han create plugin --type jutsu --name my-tool \
  --description "My custom validation" \
  --author "Your Name"

# 2. Navigate to the plugin
cd jutsu-my-tool

# 3. Customize the generated files
# Edit han-plugin.yml, add skills, etc.

# 4. Validate
han plugin validate .

# 5. Install locally to test
han plugin install --path . --scope project

# 6. Test it
han hook run jutsu-my-tool lint --verbose
```

## Reference Implementation

The `examples/example-jutsu-plugin/` directory in the Han repository contains a complete reference implementation. It demonstrates:

- Proper directory structure
- Valid `plugin.json` configuration
- Hook definitions in `han-plugin.yml`
- Skill files with correct frontmatter
- Command files for slash commands
- Working hook scripts

Clone it as a starting point:

```bash
cp -r examples/example-jutsu-plugin my-plugin
# Update plugin.json with your plugin name
# Customize as needed
```

## What This Means for the Ecosystem

Opening Han to third-party plugins is about more than just code. It's about enabling a community of Claude Code users to share their best practices, integrate their tools, and build on each other's work.

We expect to see:

- **Industry-specific plugins** for compliance, domain knowledge, and specialized workflows
- **Team-internal plugins** that codify organizational standards
- **Integration plugins** for tools and services not yet in the marketplace
- **Experimental plugins** that push the boundaries of what Claude Code can do

The [Plugin Development Guide](/docs/plugin-development) has everything you need to get started. We're looking forward to seeing what you build.

---

*Ready to create your first plugin? Run `han create plugin` and follow the prompts. Have questions? Join the discussion on [GitHub](https://github.com/thebushidocollective/han/discussions).*
