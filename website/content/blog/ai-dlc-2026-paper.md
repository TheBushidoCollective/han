---
title: "AI-DLC 2026 Launches Its Own Home"
description: "The AI-DLC methodology now has a dedicated website at ai-dlc.dev, with deep Han integration for seamless autonomous development workflows."
date: "2026-02-02"
author: "The Bushido Collective"
tags: ["methodology", "autonomous-agents", "ai-development", "announcement"]
category: "Announcements"
---

AI-DLC 2026 has grown up. What started as a methodology paper hosted on han.guru has evolved into a full-fledged platform with its own home at **[ai-dlc.dev](https://ai-dlc.dev)**.

## Why a Dedicated Site?

AI-DLC is more than a Han plugin. It's a comprehensive methodology for autonomous AI-driven development that works across tools, teams, and organizations. Giving it a dedicated home allows:

- **Deeper documentation**: Full runbooks, tooling guides, and adoption playbooks
- **Broader reach**: Developers using Cursor, Aider, GitHub Copilot, or other AI tools can adopt AI-DLC without needing Han
- **Focused evolution**: The methodology can evolve independently while maintaining tight integration with Han

## Seamless Han Integration

For Han users, nothing changes in your workflow. The AI-DLC plugin is still available in the Han marketplace:

```bash
han plugin install ai-dlc
```

The plugin now sources from [github:thebushidocollective/ai-dlc](https://github.com/thebushidocollective/ai-dlc), giving you:

- **Always up-to-date**: Get the latest AI-DLC features without waiting for Han releases
- **Full methodology**: All skills, commands, hats, and workflows
- **Subagent context injection**: Han's orchestrator automatically injects AI-DLC context into subagents
- **Worktree management**: `han worktree` commands work seamlessly with AI-DLC's branch conventions

## What's at ai-dlc.dev?

The new site includes everything you need to adopt AI-DLC:

**The Paper**: The complete AI-DLC 2026 methodology, covering human-on-the-loop workflows, backpressure-driven quality, and autonomous development loops.

**Runbooks**: Step-by-step guides for specific scenarios:
- Mode selection (when to use HITL vs HOTL)
- Writing completion criteria
- Tooling setup for different AI assistants
- Organizational adoption strategies

**Tooling Guides**: Platform-specific guides for Claude Code, Cursor, Aider, Windsurf, GitHub Copilot, and more.

## The Core Insight Remains

AI-DLC 2026 introduced **human-on-the-loop (HOTL)** as a distinct operating mode from traditional human-in-the-loop workflows:

- **HITL**: Human validates each step. AI proposes, human approves, AI executes.
- **HOTL**: Human defines success criteria. AI iterates autonomously through quality gates, alerting humans only when stuck.

Han's validation hooks provide the quality gates. AI-DLC provides the methodology. Together, they enable truly autonomous development workflows.

## Get Started

**New to AI-DLC?** Start at [ai-dlc.dev](https://ai-dlc.dev) to understand the methodology.

**Han user?** Install the plugin and you're ready:

```bash
han plugin install ai-dlc
```

**Already using AI-DLC?** Your workflows continue unchanged. The plugin now pulls from the dedicated repository, ensuring you always have the latest features.

---

*AI-DLC 2026 is an open methodology. Contributions welcome at [github.com/thebushidocollective/ai-dlc](https://github.com/thebushidocollective/ai-dlc).*
