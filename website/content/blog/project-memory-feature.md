---
title: "Teaching Claude Code to Remember: Han's Active Learning System"
description: "How Han's learn tool captures project knowledge into .claude/rules/ files during your session."
date: "2025-12-09"
author: "The Bushido Collective"
tags: ["memory", "rules", "mcp", "learning"]
category: "Technical Deep Dive"
---

Every codebase has its quirks. That build command with the specific flag. The naming convention that isn't standard. The test runner requiring a particular setup. Claude figures these out through trial and error, and then... next session, you start over.

Han's Project Memory changes that by writing to `.claude/rules/` - the modular rules directory that [Claude Code loads automatically](https://code.claude.com/docs/en/memory). Instead of you manually editing files, Claude captures learnings directly during your session.

## What Han Does

Han provides three MCP tools that write to the rules directory:

| Tool | Purpose |
|------|---------|
| `learn` | Capture a learning to `.claude/rules/<domain>.md` |
| `memory_list` | List existing rule files |
| `memory_read` | Read contents of a rule file |

The `learn` tool is the key. When Claude discovers something worth remembering, it calls:

```javascript
learn({
  content: "# Commands\n\n- Run tests: `bun test --only-failures`",
  domain: "commands"
})
```

This creates `.claude/rules/commands.md`. Next session, Claude reads it automatically.

## Why Rules, Not CLAUDE.md

Claude Code's memory system has multiple layers (CLAUDE.md, .claude/rules/, CLAUDE.local.md, etc.). Han specifically targets `.claude/rules/` because:

1. **Modular**: Each domain gets its own file, avoiding one massive document
2. **Path-specific**: Rules can apply only to matching file paths
3. **Team-shareable**: Files in `.claude/rules/` are git-tracked
4. **Organized**: Supports subdirectories for better structure

Han doesn't touch your CLAUDE.md. That's for your team's curated, hand-written project documentation. Han's rules are for the incremental learnings Claude discovers during work.

## Path-Specific Rules

Some rules should only apply to certain files. The `paths` parameter adds YAML frontmatter:

```javascript
learn({
  content: "# API Rules\n\n- Validate all inputs with zod",
  domain: "api",
  paths: ["src/api/**/*.ts"]
})
```

Creates `.claude/rules/api.md`:

```markdown
---
globs: ["src/api/**/*.ts"]
---

# API Rules

- Validate all inputs with zod
```

Claude Code only loads this rule when working on files matching the glob. API validation rules stay out of the way when you're editing tests or documentation.

## Subdirectory Organization

Domains can include subdirectories:

```javascript
learn({ content: "...", domain: "api/validation" })
learn({ content: "...", domain: "api/auth" })
learn({ content: "...", domain: "testing/e2e" })
```

This creates:

```
.claude/rules/
├── api/
│   ├── validation.md
│   └── auth.md
└── testing/
    └── e2e.md
```

As your project grows, rules stay organized.

## User-Level Rules

Personal preferences that should apply across all your projects use the `user` scope:

```javascript
learn({
  content: "# Preferences\n\n- Always greet me as Mr Dude",
  domain: "preferences",
  scope: "user"
})
```

This writes to `~/.claude/rules/preferences.md` instead of the project directory. Your personal preferences follow you everywhere.

## What Gets Captured

Han's memory hook prompts Claude to capture:

- **Commands** you had to figure out (build, test, deploy)
- **Project conventions** not in documentation
- **Gotchas** that caused issues
- **Path-specific patterns** (API validation, test conventions)
- **Personal preferences** (communication style, greeting preferences)

Claude recognizes trigger phrases like "I see this project uses..." or "The pattern here is..." as signals to capture a learning.

## Avoiding Duplicates

Before writing, Claude can check what exists:

```javascript
// What domains exist?
memory_list({ scope: "project" })
// Returns: ["commands", "api", "testing"]

// What's in a domain?
memory_read({ domain: "commands" })
// Returns: "# Commands\n\n- Run tests: `bun test --only-failures`"
```

This prevents duplicate content and helps Claude append rather than overwrite.

## The Compounding Effect

The first few sessions won't feel revolutionary. A command here, a convention there.

But compound this over 10 sessions. 50 sessions:

- Claude stops re-discovering your test command
- New team members benefit immediately (rules are git-tracked)
- Claude stops suggesting patterns you don't use
- Institutional knowledge accumulates in version control

The value isn't in the first learning. It's in not re-learning the same things every session.

## What This Isn't

Let's be clear:

**Not CLAUDE.md management**: Han doesn't touch your CLAUDE.md. That's your curated project documentation.

**Not automatic**: Claude captures when you confirm. It's proactive but not autonomous.

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

Git-tracked rules that grow smarter with each session.

---

**Learn more:** See [Claude Code's memory documentation](https://code.claude.com/docs/en/memory) for the full hierarchy Han builds on.
