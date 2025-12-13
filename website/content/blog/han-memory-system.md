---
title: "Beyond Project Memory: Han's Three-Layer Memory System"
description: "How Han's memory system goes beyond simple rule capture to provide session continuity, team knowledge research, and self-learning promotion."
date: "2025-12-13"
author: "The Bushido Collective"
tags: ["memory", "research", "mcp", "learning", "team"]
category: "Technical Deep Dive"
---

Our [previous post on project memory](/blog/project-memory-feature) introduced Han's `learn` tool - Claude autonomously capturing knowledge to `.claude/rules/`. That was step one.

But real memory is more than just writing things down. It's continuity across sessions. It's knowing who on your team knows what. It's patterns emerging from practice, not just explicit capture.

Han's Memory System delivers all three.

## Three Layers of Memory

```text
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Permanent Wisdom (.claude/rules/)                     │
│  ─────────────────────────────────────────                      │
│  Git-tracked, team-reviewed conventions                         │
│  Always loaded, highest authority                               │
│  ↑ AUTO-PROMOTED from Layer 2 when confidence >= 0.8            │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Team Memory (authoritative sources)                   │
│  ─────────────────────────────────────────                      │
│  Git commits, PRs, Issues, Reviews                              │
│  Researched on-demand via MCP                                   │
│  "Who knows X?" → Research until confident                      │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: Personal Memory (local sessions)                      │
│  ─────────────────────────────────────────                      │
│  Session capture, AI summaries, continuity                      │
│  "What was I working on?" → Check recent sessions               │
└─────────────────────────────────────────────────────────────────┘
```

Each layer serves a different purpose. Together, they create genuine memory.

## Layer 1: Personal Memory - Session Continuity

Ever close a Claude session and lose your context? Han captures what happened.

**During the session**: Every tool use is logged - files read, edits made, commands run. Not the full conversation (that's private), but the actions taken.

**When you stop**: Han's AI summarizes the session into structured YAML:

```yaml
session:
  duration: 45m
  files_touched: 12

work_items:
  - description: "Implemented user authentication"
    files: ["src/auth.ts", "src/middleware.ts"]
    status: completed

  - description: "Started payment integration"
    files: ["src/payments/stripe.ts"]
    status: in_progress
    next_steps:
      - "Add webhook handler"
      - "Write integration tests"

decisions:
  - choice: "JWT over session cookies"
    rationale: "Stateless auth for API scalability"
```

**Next session**: Han injects this context automatically. Claude doesn't start from scratch - it knows what you were doing.

```text
You: continue where I left off

Claude: Based on your last session, you were implementing payment integration.
You completed user authentication (JWT-based) and started the Stripe setup.
Next steps were adding a webhook handler and writing integration tests.
Let me continue with the webhook handler...
```

No manual handoff. No "remind me what we did." Just continuity.

## Layer 2: Team Memory - Research Until Confident

Your codebase contains institutional knowledge. It's in commit messages, PR descriptions, code review comments. But who has time to search through 3,000 commits?

Han's research engine does.

```text
You: who knows about the payment processing system?

Claude: Based on my research of the git history:

**Primary expert: Sarah Chen** (@schen)
- 47 commits touching payments/
- Authored the original Stripe integration (PR #234)
- Most recent: refactored error handling last month

**Secondary: Michael Torres** (@mtorres)
- 12 commits, mainly webhook handlers
- Reviewed most payment PRs

**Key decisions found:**
- Chose Stripe over Braintree for international support (PR #234)
- Moved to idempotency keys after duplicate charge incident (commit abc123)

Citations:
- [PR #234] "Stripe integration for payments"
- [commit abc123] "fix: add idempotency to prevent duplicates"
```

This isn't keyword matching. It's a **research engine** that:

1. Generates search queries from your question
2. Searches indexed commits, PRs, and observations
3. Assesses confidence based on evidence found
4. If not confident, refines the query and searches again
5. Returns answers with citations and caveats

The "research until confident" pattern means Claude doesn't guess. It keeps investigating until it has evidence or admits uncertainty.

### Sources

Han pulls from multiple sources:

| Source | What's extracted |
|--------|------------------|
| Git commits | Messages, diffs, authors, timestamps |
| GitHub PRs | Descriptions, reviews, comments |
| GitHub Issues | Context, decisions, discussions |
| Session observations | Tool uses, file touches, patterns |

All indexed locally using LanceDB for fast semantic search.

## Layer 3: Permanent Wisdom - Auto-Promotion

Here's where it gets interesting. Han doesn't just wait for you to call `learn()`. It **watches for patterns** and promotes them automatically.

### How Auto-Promotion Works

As Claude researches and works:

1. **Pattern detection**: Han extracts patterns from evidence and observations
2. **Pattern tracking**: Patterns are stored with occurrence counts and confidence scores
3. **Threshold check**: When a pattern hits 3+ occurrences and 0.8+ confidence
4. **Automatic promotion**: Pattern is written to `.claude/rules/{domain}.md`

```text
# Auto-promoted to .claude/rules/testing.md

- Always run tests before committing
  - Pattern detected in 5 commits from 3 different authors
  - Confidence: 92%
```

### The Self-Learning Loop

```text
Research → Detect patterns → Track occurrences → Promote when ready
    ↓                                                    ↓
    └──────────── Rules loaded next session ←────────────┘
```

Claude learns from your team's actual practices. Not what the README says to do - what developers actually do.

### Promotion Criteria

Not everything gets promoted. Patterns must meet:

- **3+ occurrences** across different sources
- **0.8+ confidence** score
- **Multiple authors** (bonus: increases confidence)
- **Not already documented** in rules

This prevents noise. Only consistent, team-wide patterns become rules.

### Visibility

You're never in the dark:

```javascript
// Check auto-learning status
auto_learn({ action: "status" })
// → "Tracking 12 patterns, 3 ready for promotion"

// See what's ready
auto_learn({ action: "candidates" })
// → Lists patterns meeting threshold

// Manually trigger promotion
auto_learn({ action: "promote" })
// → Writes ready patterns to .claude/rules/
```

## The Unified Query Interface

One tool routes all memory questions:

```javascript
memory({ question: "what was I working on?" })
// → Routes to personal memory

memory({ question: "who knows about auth?" })
// → Routes to team memory research

memory({ question: "how do we handle errors?" })
// → Routes to conventions (rules)
```

Claude figures out what kind of question it is and goes to the right layer.

## Storage Layout

```text
~/.claude/
  han/
    memory/
      personal/
        sessions/           # Raw observations (append-only JSONL)
        summaries/          # AI-compressed YAML summaries
        .index/             # Personal LanceDB index

      projects/
        github.com_org_repo/
          .index/           # Team memory LanceDB index
          meta.yaml         # Index metadata, source cursors

.claude/                    # In project repo (git-tracked)
  rules/                    # Permanent wisdom - auto-promoted
    testing.md
    api.md
    auth.md
```

Personal memory stays local. Project rules are git-tracked.

## Philosophy: Learn, Don't Suggest

Traditional AI assistants suggest. "You might want to add this to your documentation." "Consider saving this for later."

Han's philosophy is different:

> **Claude should actively learn, not just suggest.**

The auto-promotion system is:

- **Low-stakes**: Git-tracked, reviewable, revertible
- **Additive**: Only adds new rules, never modifies existing
- **Conservative**: High thresholds prevent noise
- **Transparent**: All promotions visible in git history

If Claude sees a pattern three times from multiple authors, that's not a suggestion - that's how your team works. Write it down.

## What This Enables

**Session continuity**: "Continue where I left off" just works.

**Onboarding acceleration**: New Claude sessions inherit all learned patterns immediately.

**Expertise mapping**: "Who knows about X?" with cited evidence.

**Decision archaeology**: "Why did we choose Y?" traced back to the PR.

**Institutional memory**: Team knowledge survives personnel changes.

**Emergent documentation**: Rules that reflect actual practice, not aspirational guidelines.

## Getting Started

Han's memory system activates with the core plugin:

```bash
han plugin install core
```

The hooks automatically:

- Capture tool observations (PostToolUse)
- Summarize sessions (Stop)
- Inject context (SessionStart)

Memory queries are available via MCP. Auto-promotion runs after research.

---

Memory isn't just storage. It's continuity, research, and learning. Han delivers all three.
