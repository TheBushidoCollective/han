---
title: "More Than Just Skills or Agents: An Introduction to Han Claude Plugins"
description: "Discover what makes Han plugins unique—a comprehensive system combining skills, agents, validation hooks, and MCP integrations for Claude Code."
date: "2024-11-30"
author: "Jason Waldrip"
tags: ["han", "plugins", "claude-code", "introduction"]
category: "Getting Started"
---

When you first hear about Han, you might think it's just another collection of prompts or agents for Claude Code. But Han is something more—a complete plugin ecosystem that transforms how you work with AI-assisted development.

## What is a Han Plugin?

A Han plugin is a packaged bundle that can include any combination of:

- **Skills**: Specialized knowledge domains that Claude can invoke
- **Agents**: Autonomous workflows for complex multi-step tasks
- **Commands**: Quick slash commands for common operations
- **Hooks**: Automatic validation that runs at key development lifecycle points
- **MCP Servers**: Bridges to external tools and services

Most importantly, these components work together as a cohesive system, not just isolated features.

## The Plugin Families

Han plugins follow Japanese martial arts naming conventions, organizing by purpose:

### Core - The Foundation

The `core` plugin (also known as `han-core`) is the essential infrastructure that powers the Han marketplace:

- Quality enforcement through validation hooks
- Metrics tracking and calibration
- Context7 integration for up-to-date library documentation
- Universal programming principles (SOLID, DRY, composition over inheritance)
- All core skills, commands, and slash commands
- MCP servers for hooks and metrics

Think of Core as the technical foundation that makes everything work.

### Bushido (武士道) - Optional Philosophy

The `bushido` plugin adds a philosophical layer based on the seven Samurai virtues. If you choose to install it, these principles guide how Claude approaches development work:

- 義 Righteousness: Transparency in reasoning
- 勇 Courage: Challenge and recommend improvements
- 仁 Compassion: Assume positive intent
- 礼 Respect: Honor existing work
- 誠 Honesty: Truthfulness over comfort
- 名誉 Honor: Quality ownership
- 忠義 Loyalty: Long-term thinking

This is purely cultural—you get all the technical capabilities from `core` regardless. Install `bushido` only if this philosophical approach resonates with you.

### Jutsu (術) - Technical Skills

Jutsu plugins are "techniques"—deep knowledge of specific technologies with automatic validation:

- **jutsu-typescript**: TypeScript expertise + type checking hooks
- **jutsu-playwright**: E2E testing knowledge + test validation
- **jutsu-nextjs**: Next.js patterns + build verification
- **jutsu-biome**: Code formatting + automatic linting

Each jutsu plugin not only teaches Claude the technology but ensures quality through hooks.

### Do (道) - Specialized Disciplines

Do plugins provide specialized agents for specific workflows:

- **do-frontend-development**: UI/UX-focused agent with accessibility expertise
- **do-technical-documentation**: Documentation agent following best practices
- **do-accessibility-engineering**: Multiple agents for inclusive design

These agents have deep expertise in their domain and can handle complex, multi-phase tasks autonomously.

### Hashi (橋) - External Bridges

Hashi plugins are MCP servers that connect Claude to external services:

- **hashi-github**: GitHub Issues, PRs, code search, Actions
- **hashi-playwright-mcp**: Browser automation and testing
- **hashi-blueprints**: Codebase documentation and knowledge management

These turn Claude into a universal interface for your development tools.

## How They Work Together

Here's where Han becomes more than the sum of its parts. Let me show you a real example:

**Scenario**: You ask Claude to "Add user authentication to the app"

**What happens**:

1. **Core** provides the infrastructure and quality enforcement
2. **jutsu-nextjs** provides deep Next.js knowledge for implementation
3. **jutsu-typescript** ensures type safety throughout
4. **do-frontend-development** agent handles the UI components
5. **Validation hooks** automatically run (via core):
   - TypeScript compilation check
   - Next.js build verification
   - Test suite execution
6. **Core code review** analyzes the result
7. **hashi-github** can create a PR with the changes

(If you've installed the optional `bushido` plugin, its seven virtues also guide the overall approach.)

All of this happens automatically. You make one request, and the entire system ensures quality from planning through delivery.

## Why This Matters

Traditional AI coding assistants give you suggestions. You're responsible for:

- Running tests manually
- Checking types yourself
- Remembering to lint
- Hoping you didn't break anything
- Following up on quality issues

With Han plugins:

- Quality checks run automatically
- Specialized agents handle complex tasks
- External tools integrate seamlessly
- Validation happens in real-time
- You get confidence, not just code

## Getting Started

The beauty of Han's plugin system is that you can start simple and layer on complexity:

**Day 1**: Install the core infrastructure

```bash
npx @thebushidocollective/han plugin install core
```

**Optional**: If the Bushido philosophy resonates with you, add it:

```bash
npx @thebushidocollective/han plugin install bushido
```

(Not required—`core` provides all the technical capabilities.)

**Day 2**: Add your stack's jutsu plugins

```bash
npx @thebushidocollective/han plugin install jutsu-typescript
npx @thebushidocollective/han plugin install jutsu-react
```

**Day 3**: Add specialized agents as needed

```bash
npx @thebushidocollective/han plugin install do-frontend-development
```

**Day 4**: Connect external tools

```bash
npx @thebushidocollective/han plugin install hashi-github
```

Each addition enhances the system without adding complexity to your workflow.

## Real-World Impact

I built the Han marketplace website using Han plugins. Here's what that looked like:

- Asked Claude to "create a plugin marketplace website"
- **Core** provided the infrastructure and quality enforcement
- **jutsu-nextjs** provided App Router expertise
- **jutsu-typescript** caught type errors immediately
- **jutsu-biome** kept code formatted
- **Validation hooks** ran after every change
- Result: Production-ready site with 100% type coverage in hours, not days

The difference wasn't just speed—it was confidence. Every change was automatically validated. Every feature was properly typed. Every commit was reviewed.

## Not Just Another Tool

Han isn't trying to replace your tools or your judgment. It's a framework that:

- Captures expertise in reusable packages
- Enforces quality automatically
- Connects your development ecosystem
- Scales with your needs

Skills teach Claude what to do. Agents handle how to do it. Hooks ensure it's done right. MCP servers connect it all.

That's what makes Han more than just skills or agents—it's a complete development enhancement system.

## Try It

Start with the core infrastructure:

```bash
npx @thebushidocollective/han plugin install core
```

Then ask Claude to help with something. You'll notice the difference immediately—not just in what Claude can do, but in the confidence you have in the results.

(If you'd like to add the Bushido philosophy, you can install it anytime with `npx @thebushidocollective/han plugin install bushido`)

---

*Want to explore the plugin marketplace? Check out the [140+ available plugins](/plugins) or dive into the [documentation](/docs).*
