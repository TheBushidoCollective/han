---
title: "Documentation"
description: "Everything you need to know about installing, configuring, and using Han plugins."
---

Welcome to the Han documentation. Han brings automatic quality gates to Claude Code—every conversation ends with validation. Linting, formatting, type-checking, and tests run automatically, catching issues before they ship.

## Quick Links

- [What is Han?](/docs/getting-started) - Learn how Han works and what makes it unique
- [Installation](/docs/installation) - Get started with Han in minutes
- [Plugin Categories](/docs/plugin-categories) - Explore the nine categories of Han plugins
- [Configuration](/docs/configuration) - Customize Han for your workflow
- [Plugin Development](/docs/plugin-development) - Create your own Han plugins
- [CLI Reference](/docs/cli) - Complete command-line interface guide
- [Metrics System](/docs/metrics) - Understand how Han tracks and improves quality

## What Makes Han Different

Han is more than just a collection of prompts or skills. It's a complete plugin ecosystem that combines:

- **Automatic Validation** - Quality checks run at key development lifecycle points
- **Smart Caching** - Only validates when relevant files change, using native Rust hashing
- **Local Metrics** - Tracks success rates and confidence calibration, all on your machine
- **MCP Integration** - Seamlessly connects Claude to external tools and services

## Plugin Marketplace

Browse over 139 plugins across nine categories at [han.guru/plugins](https://han.guru/plugins/):

- **Core** - Essential infrastructure (always required)
- **Language** - Programming language support (typescript, python, rust, go, java, ruby)
- **Framework** - Framework integrations (react, nextjs, django, rails, phoenix, vue)
- **Validation** - Linting, formatting, type checking (biome, eslint, prettier, rubocop, pylint)
- **Tool** - Build tools, testing frameworks, dev tools (playwright, jest, webpack, docker-compose)
- **Integration** - MCP servers for external services (github, jira, figma, sentry, linear)
- **Discipline** - Specialized AI agents (frontend, backend, accessibility, security)
- **Pattern** - Methodologies and workflows (ai-dlc, tdd, bdd, atomic-design, monorepo)
- **Specialized** - Niche or platform-specific tools (android, ios, tensorflow, fnox)

## Get Help

- Browse the [plugin marketplace](https://han.guru/plugins/)
- Read the [blog](https://han.guru/blog/) for in-depth articles
- Visit [The Bushido Collective](https://thebushido.co) for support
