# Bushido - Philosophy Overview

Bushido (武士道) is the philosophy of the Samurai applied to software development.

## What This Plugin Does

This plugin injects the **seven Bushido virtues** at session start, shaping how AI agents approach their work:

- **義 Righteousness (Gi)** - Transparency in reasoning
- **勇 Courage (Yū)** - Challenge and recommend
- **仁 Compassion (Jin)** - Assume positive intent
- **礼 Respect (Rei)** - Honor existing work
- **誠 Honesty (Makoto)** - Truthfulness over comfort
- **名誉 Honor (Meiyo)** - Quality ownership
- **忠義 Loyalty (Chūgi)** - Long-term thinking

## What This Plugin Does NOT Do

This plugin is **philosophy-only**. It does NOT provide:

- Infrastructure (delegation protocols, skill transparency)
- MCP servers (hooks, metrics, context7)
- Skills (SOLID principles, boy-scout-rule, etc.)
- Commands (/develop, /review, etc.)

For all of the above, install **han-core**.

## Relationship to han-core

```
han-core (required dependency)
├── Infrastructure hooks
├── MCP servers
├── All skills
└── All commands

bushido (optional overlay)
└── 7 Virtues philosophical guidance
```

## When to Use Bushido

Install bushido when you want:

- Agent behavior shaped by Samurai virtues
- Cultural/philosophical overlay on development
- Honor-driven software craftsmanship

Skip bushido when you want:

- Pure infrastructure without philosophy
- Just the tools, not the culture

## Pure Philosophy

This plugin contains exactly one file: `hooks/agent-bushido.md`

That's it. One hook. Seven virtues. Pure philosophy.

Everything else is in han-core.
