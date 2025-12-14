---
title: "Han's Five-Layer Memory System: Full Historical Context"
description: "How Han's memory system provides complete historical context through rules, summaries, observations, transcripts, and team knowledge."
date: "2025-12-13"
author: "The Bushido Collective"
tags: ["memory", "research", "mcp", "learning", "team", "transcripts"]
category: "Technical Deep Dive"
---

Our [previous post on project memory](/blog/project-memory-feature) introduced Han's `learn` tool - Claude autonomously capturing knowledge to `.claude/rules/`. That was step one.

But real memory is more than just writing things down. It's full historical context. It's knowing what you discussed three sessions ago. It's finding the reasoning behind decisions. It's patterns emerging from practice.

Han's Memory System delivers all five layers.

## Five Layers of Context

```text
Query: "What did we discuss about authentication?"
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 1: Rules (.claude/rules/)                             │
│ - Check for auth conventions, patterns                      │
│ - Fast, always available                                    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 2: Session Summaries                                  │
│ - High-level: "Implemented JWT auth", "Fixed login bug"     │
│ - Quick overview of work done                               │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 3: Observations                                       │
│ - Files touched: auth/jwt.ts, test/auth.test.ts             │
│ - Commands run: npm test, git commit                        │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 4: Transcripts ← FULL CONVERSATION HISTORY            │
│ - "Should we use JWT or sessions?"                          │
│ - "JWT is stateless, better for microservices"              │
│ - Decisions made, problems discussed, solutions explored    │
└─────────────────────────────────────────────────────────────┘
         │
         ▼
┌─────────────────────────────────────────────────────────────┐
│ Layer 5: Team Memory (git commits, PRs)                     │
│ - Who implemented auth: "john@example.com"                  │
│ - PR discussion, code review comments                       │
└─────────────────────────────────────────────────────────────┘
```

Each layer provides different depth. Together, they give Claude complete context.

## Layer 1: Rules - Instant Conventions

The fastest layer. Project conventions captured in `.claude/rules/`:

```markdown
# .claude/rules/auth.md

- Use JWT for stateless authentication
- Validate all inputs with zod
- Hash passwords with argon2
```

Always loaded, always available. Write rules manually with `learn()` or let them auto-promote from patterns.

## Layer 2: Session Summaries - Work Overview

When you stop a session, Han summarizes what happened:

```yaml
session_id: session-abc123
project: github.com/user/repo
started_at: 2025-12-13T10:00:00Z
ended_at: 2025-12-13T11:30:00Z

summary: "Implemented JWT authentication with refresh tokens"

work_items:
  - description: "Added JWT verification middleware"
    outcome: completed
    files: ["src/auth/middleware.ts"]

  - description: "Started refresh token rotation"
    outcome: in_progress

decisions:
  - description: "JWT over session cookies"
    rationale: "Stateless auth for API scalability"
```

Quick to search, gives you the "what" without the noise.

## Layer 3: Observations - Detailed Breadcrumbs

Every tool use is logged:

```jsonl
{"tool":"Read","files_read":["src/auth/jwt.ts"],"timestamp":"2025-12-13T10:15:00Z"}
{"tool":"Edit","files_modified":["src/auth/middleware.ts"],"timestamp":"2025-12-13T10:20:00Z"}
{"tool":"Bash","command":"npm test","timestamp":"2025-12-13T10:25:00Z"}
```

More detail than summaries. Search for "what files did I touch" or "did I run the tests."

## Layer 4: Transcripts - The Missing Link

**This is new.** Claude Code stores full conversation history at `~/.claude/projects/{slug}/*.jsonl`. Han can now search these.

Why does this matter? Because context lives in conversations:

```text
You: Should we use JWT or session-based auth?

Claude: JWT is better here because:
1. Your API is stateless
2. You need to support mobile clients
3. Microservices architecture benefits from...

You: What about refresh tokens?

Claude: Here's how we'll implement refresh token rotation...
```

That reasoning was lost when sessions ended. Not anymore.

### Cross-Worktree Search

Working on feature branches in separate worktrees? Han finds context from peer worktrees sharing the same git remote:

```text
You: What did we discuss about the payment refactor?

Claude: Found in peer worktree (feature/payments branch):
- Discussed switching from Stripe to internal processor
- Decided to keep Stripe for international, add internal for domestic
- Implementation started in src/payments/processor.ts
```

Same repo, different worktree, shared context.

## Layer 5: Team Memory - Institutional Knowledge

Your codebase contains institutional knowledge buried in commit messages, PR descriptions, and code reviews.

```text
You: Who knows about the payment system?

Claude: Based on git history research:

**Primary expert: Sarah Chen** (@schen)
- 47 commits touching payments/
- Authored the original Stripe integration (PR #234)

**Key decisions found:**
- Chose Stripe over Braintree for international support
- Moved to idempotency keys after duplicate charge incident
```

Citations included. Evidence-based answers.

## Search Acceleration: FTS Indexing

All layers (except rules) are indexed using full-text search (BM25) via LanceDB:

```bash
# Index all content
han index run

# Index specific layer
han index run --layer transcripts

# Search across layers
han index search "authentication"

# Check index status
han index status
```

Indexing happens automatically:

- **Session end**: Observations indexed via Stop hook
- **On-demand**: Transcripts indexed when first queried
- **Manual**: `han index run` for full reindex

## The Unified Query Interface

One tool routes all memory questions:

```javascript
memory({ question: "what was I working on?" })
// → Layer 2-3: Personal summaries and observations

memory({ question: "what did we discuss about auth?" })
// → Layer 4: Transcript search

memory({ question: "who knows about payments?" })
// → Layer 5: Team memory research

memory({ question: "how do we handle errors?" })
// → Layer 1: Rules/conventions
```

Claude determines the question type and searches appropriate layers.

## Auto-Promotion: Patterns Become Rules

Han watches for patterns and promotes them automatically:

1. **Pattern detection**: Extracts patterns from observations and research
2. **Tracking**: Stores patterns with occurrence counts and confidence
3. **Threshold**: When a pattern hits 3+ occurrences and 0.8+ confidence
4. **Promotion**: Written to `.claude/rules/{domain}.md`

```javascript
// Check auto-learning status
auto_learn({ action: "status" })
// → "Tracking 12 patterns, 3 ready for promotion"

// See what's ready
auto_learn({ action: "candidates" })

// Trigger promotion
auto_learn({ action: "promote" })
```

Conservative thresholds prevent noise. Only consistent patterns become rules.

## Storage Layout

```text
~/.claude/
  han/
    memory/
      personal/
        sessions/           # Layer 3: Raw observations (JSONL)
        summaries/          # Layer 2: AI summaries (YAML)

      index/
        fts.db              # FTS index (LanceDB/SQLite)

      projects/
        github.com_org_repo/
          meta.yaml         # Team memory metadata

  projects/
    {project-slug}/         # Layer 4: Claude transcripts (JSONL)
      *.jsonl

.claude/                    # In project repo (git-tracked)
  rules/                    # Layer 1: Permanent rules
    testing.md
    api.md
```

Personal memory stays local. Project rules are git-tracked.

## What This Enables

**Full conversation recall**: "What did we discuss about X?" searches actual conversations.

**Cross-worktree context**: Context follows the repo, not just the directory.

**Session continuity**: "Continue where I left off" with full context.

**Decision archaeology**: Find not just what was decided, but the reasoning.

**Expertise mapping**: "Who knows about X?" with cited evidence.

**Emergent documentation**: Rules reflect actual practice, not aspirational guidelines.

## Getting Started

Han's memory system activates with the core plugin:

```bash
han plugin install core
```

The hooks automatically:

- Capture tool observations (PostToolUse)
- Summarize and index sessions (Stop)
- Inject context (SessionStart)

For full transcript indexing:

```bash
han index run --layer transcripts
```

---

Memory isn't just storage. It's five layers of context working together - from instant conventions to full conversation history. Han delivers it all.
