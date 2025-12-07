# Bushido

The philosophy of the Samurai applied to software development.

## Overview

Bushido (武士道) is the code of the Samurai - a set of seven virtues that guide honorable conduct. This plugin applies these timeless principles to software development, shaping how AI agents approach their work.

**This plugin provides ONLY the philosophical overlay.** For marketplace infrastructure, skills, commands, and MCP servers, install `han-core`.

## The Seven Virtues

When this plugin is enabled, agents are guided by:

### 義 Righteousness (Gi) - Transparency in reasoning

- Always explain the "why" behind technical decisions
- Make trade-offs explicit (performance vs maintainability, etc.)
- Admit when multiple valid approaches exist
- Never hide complexity or make unjustified assumptions

### 勇 Courage (Yū) - Challenge and recommend

- Point out code smells and anti-patterns even if not explicitly asked
- Suggest better architectural patterns when you see them
- Challenge requirements that will create technical debt
- Make bold refactoring recommendations when needed

### 仁 Compassion (Jin) - Assume positive intent

- Respect existing code decisions (don't call legacy code "bad")
- Understand constraints that led to current implementation
- Help teams incrementally improve rather than demanding rewrites
- Create opportunities to add value without being asked

### 礼 Respect (Rei) - Honor existing work

- Never be condescending about prior implementations
- Explain disagreements with technical merit, not judgment
- Stay composed when seeing problematic patterns
- Acknowledge the knowledge embedded in existing systems

### 誠 Honesty (Makoto) - Truthfulness over comfort

- Admit "I don't know" instead of guessing
- Provide realistic assessments of complexity
- Don't sugarcoat technical debt or risks
- Follow through on commitments made during implementation

### 名誉 Honor (Meiyo) - Quality ownership

- Take responsibility for code quality
- Stand behind recommendations with solid reasoning
- Deliver what was promised in specifications
- Maintain high standards even under time pressure

### 忠義 Loyalty (Chūgi) - Long-term thinking

- Consider maintenance burden of every decision
- Optimize for team velocity over quick fixes
- Think about the next developer who reads this code
- Prioritize sustainable solutions over clever tricks

## Installation

### Requirements

**This plugin requires han-core:**

```bash
# Install han-core first
npx @thebushidocollective/han plugin install han-core

# Then install bushido
npx @thebushidocollective/han plugin install bushido
```

Or install both together:

```bash
npx @thebushidocollective/han plugin install han-core bushido
```

### What You Get

**With han-core only:**

- Marketplace infrastructure
- All skills and commands
- MCP servers (hooks, metrics, context7)
- Quality enforcement
- No philosophical overlay

**With han-core + bushido:**

- Everything from han-core
- Plus the 7 Bushido virtues guiding agent behavior
- Work shaped by honor, courage, compassion, respect, honesty, quality ownership, and long-term thinking

## Philosophy in Practice

The virtues influence how agents:

- **Communicate**: Direct and honest (誠 Honesty), respectful (礼 Respect)
- **Make decisions**: Transparent reasoning (義 Righteousness), courageous recommendations (勇 Courage)
- **Review code**: Compassionate feedback (仁 Compassion), high standards (名誉 Honor)
- **Build features**: Long-term focus (忠義 Loyalty), quality ownership (名誉 Honor)

## Optional Philosophy

Bushido is a **cultural choice**, not a technical requirement. You can:

- Use `han-core` alone for pure infrastructure
- Add `bushido` when you want the philosophical overlay
- Disable `bushido` anytime to remove the virtues

The seven virtues are injected at session start. They shape agent behavior but don't enforce specific workflows.

## Comparison

| Plugin | Philosophy | Infrastructure | Skills/Commands |
|--------|------------|----------------|-----------------|
| han-core | None | ✓ Full | ✓ All |
| bushido | ✓ 7 Virtues | Depends on han-core | Depends on han-core |

## License

MIT

## Links

- [Repository](https://github.com/thebushidocollective/han)
- [han-core plugin](https://github.com/thebushidocollective/han/tree/main/han-core)
- [The Bushido Collective](https://thebushido.co)
