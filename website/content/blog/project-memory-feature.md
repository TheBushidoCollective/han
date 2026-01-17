---
title: "Self-Learning Claude: Han's Autonomous Memory System"
description: "How Han enables Claude to capture project knowledge autonomously, building institutional memory without asking permission."
date: "2025-12-09"
author: "The Bushido Collective"
tags: ["memory", "rules", "mcp", "learning"]
category: "Technical Deep Dive"
---

Every codebase has its quirks. That build command with the specific flag. The naming convention that isn't standard. The test runner requiring a particular setup. Claude figures these out through trial and error, and then... next session, starts over.

Han changes that. Not by asking Claude to remember things, but by giving Claude the ability to **teach itself**.

## Autonomous Learning

Han's `learn` MCP tool lets Claude write directly to `.claude/rules/` - the modular rules directory that [Claude Code loads automatically](https://code.claude.com/docs/en/memory). No confirmation dialogs. No approval workflows. Claude recognizes something worth remembering and captures it.

```javascript
// Claude discovers the test command and captures it
learn({
  content: "# Commands\n\n- Run tests: `bun test --only-failures`",
  domain: "commands"
})
```

This creates `.claude/rules/commands.md`. Next session, Claude reads it automatically. The learning persists.

## Why Autonomous?

Confirmation dialogs create friction. Every "Do you want to save this?" is an interruption. Every "Are you sure?" is cognitive overhead. We don't ask developers to confirm every keystroke.

Claude's learnings are low-stakes:

- They're git-tracked (reviewable, revertible)
- They only affect Claude's behavior
- They're additive, not destructive
- Wrong learnings are easily deleted

So Han lets Claude learn freely and informs you what was captured. You see the learning in the output. You can review `.claude/rules/` any time. But you don't have to approve each one.

## What Claude Learns

Han's memory hook guides Claude to recognize learning opportunities:

- **Commands** discovered through trial and error
- **Project conventions** not in documentation
- **Gotchas** that caused issues
- **Path-specific patterns** (API validation rules, test conventions)
- **Personal preferences** mentioned in conversation

When Claude thinks "I see this project uses..." or "The pattern here is..." - that's the trigger to capture it autonomously.

## How It Works

Three MCP tools power the system:

| Tool          | Purpose                                         |
| ------------- | ----------------------------------------------- |
| `learn`       | Write a learning to `.claude/rules/<domain>.md` |
| `memory_list` | Check what domains already exist                |
| `memory_read` | Read existing content (avoid duplicates)        |

Claude uses `memory_list` and `memory_read` to check before writing, preventing redundant entries.

### Path-Specific Rules

Some learnings apply only to certain files:

```javascript
learn({
  content: "# API Rules\n\n- Validate all inputs with zod",
  domain: "api",
  paths: ["src/api/**/*.ts"]
})
```

Creates `.claude/rules/api.md` with YAML frontmatter:

```markdown
---
paths: ["src/api/**/*.ts"]
---

# API Rules

- Validate all inputs with zod
```

Claude Code only loads this rule when working on matching files.

### Subdirectory Organization

Domains can include subdirectories:

```javascript
learn({ content: "...", domain: "api/validation" })
learn({ content: "...", domain: "api/auth" })
learn({ content: "...", domain: "testing/e2e" })
```

This creates:

```text
.claude/rules/
├── api/
│   ├── validation.md
│   └── auth.md
└── testing/
    └── e2e.md
```

### User-Level Preferences

Personal preferences that should apply across all projects use `user` scope:

```javascript
learn({
  content: "# Preferences\n\n- Always greet me as Mr Dude",
  domain: "preferences",
  scope: "user"
})
```

Writes to `~/.claude/rules/preferences.md` instead of the project directory.

## The Self-Improvement Loop

This creates a feedback loop:

1. Claude works on your project
2. Claude discovers patterns, commands, conventions
3. Claude captures them to `.claude/rules/`
4. Next session, Claude already knows them
5. Repeat

Each session, Claude starts a little smarter about your specific project. Not through external training, but through self-directed learning within your codebase.

## Team Benefits

Since `.claude/rules/` is git-tracked:

- New team members benefit immediately
- Claude's learnings become shared knowledge
- Institutional memory survives personnel changes
- Onboarding accelerates naturally

Your project accumulates Claude-specific documentation that traditional docs never capture - the informal "how we do things here" knowledge.

## What You Control

Han doesn't take control away from you:

- **Review**: Check `.claude/rules/` any time
- **Edit**: Modify or delete any rule file
- **Override**: Your CLAUDE.md still takes precedence
- **Disable**: Remove the core plugin if you don't want it

The autonomy is about reducing friction, not removing oversight.

## What This Isn't

**Not CLAUDE.md management**: Han doesn't touch your CLAUDE.md. That's for your team's curated, hand-written project documentation.

**Not a replacement for docs**: Rules complement documentation by capturing informal knowledge that wouldn't make it into formal docs.

## Getting Started

Han's memory tools are in the core plugin:

```bash
han plugin install core
```

Then work normally. Claude will start capturing learnings to `.claude/rules/`. Check what's accumulated:

```bash
ls .claude/rules/
```

Self-learning Claude, building project knowledge session by session.

---

**Learn more:** See [Claude Code's memory documentation](https://code.claude.com/docs/en/memory) for the full hierarchy Han builds on.
