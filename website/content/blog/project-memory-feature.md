---
title: "Teaching Claude Code to Remember: The Project Memory Feature"
subtitle: "How the core plugin helps Claude learn your codebase over time"
date: 2025-12-12
author: The Bushido Collective
---

Every codebase has its quirks. That build command that needs a specific flag. The naming convention that isn't quite standard. The test runner that requires a particular setup. Usually, you discover these through trial and error, Claude figures them out, and then... next session, you start over.

The core plugin's new Project Memory feature changes that. Not dramatically, not overnight, but steadily. It's a foundation that gets stronger with use.

## What It Actually Does

Project Memory is four interconnected pieces:

**1. The `learn` MCP Tool** - Claude can actively capture learnings using the `learn` tool, which writes to `.claude/rules/<domain>.md` files in the proper Claude Code format.

**2. A Memory Learning Hook** - After you submit prompts, Claude gets a gentle reminder to capture what it learned. Not every prompt, just when something worth remembering surfaces.

**3. A Project Memory Skill** - Guidance on how to organize project instructions using Claude Code's native memory system (CLAUDE.md, .claude/rules/, and CLAUDE.local.md).

**4. Trigger Phrase Recognition** - Claude learns to recognize when it's discovering something worth remembering: "I see this project uses...", "The pattern here is...", "This convention isn't documented..."

When these elements work together, Claude starts building institutional knowledge about your project. The first session, it learns your test command. The second session, it already knows it.

## The Memory Hierarchy

Claude Code reads project instructions from several places, in order of precedence:

1. **Enterprise policy** (if applicable, managed by your organization)
2. **User memory** (`~/.claude/CLAUDE.md` - your personal defaults)
3. **Project memory** (`CLAUDE.md` in the root - shared with your team)
4. **Modular rules** (`.claude/rules/*.md` - path-specific instructions)
5. **Local memory** (`CLAUDE.local.md` - your personal, gitignored preferences)

Later sources override earlier ones. This means your team can set project-wide conventions in CLAUDE.md, while you keep personal preferences in CLAUDE.local.md.

## What Gets Remembered

The feature guides Claude to capture:

- **Commands you had to figure out** - That test command with the specific flags, the build process that requires specific order
- **Project conventions not in docs** - Naming patterns, code organization, patterns that are "just how we do it here"
- **Gotchas that cost time** - Edge cases, workarounds, things that tripped you up once
- **Architecture insights** - Structure that took effort to understand
- **Path-specific rules** - API routes need zod validation, test files use specific patterns

## How It Works in Practice

Let's say you're working on a TypeScript project. In the first session, Claude has to discover:

```bash
# Oh, this project uses bun, not npm
bun test

# And they prefer --only-failures for iteration
bun test --only-failures
```

With Project Memory active, Claude can call the `learn` tool:

```javascript
learn({
  content: "# Commands\n\n- Run tests: `bun test --only-failures`",
  domain: "commands"
})
```

This creates `.claude/rules/commands.md`. Next session? Claude already knows.

### Path-Specific Rules

Suppose Claude realizes your API code has a consistent pattern. It can capture this with path restrictions:

```javascript
learn({
  content: "# API Rules\n\n- Validate all inputs with zod\n- Return consistent error format",
  domain: "api",
  paths: ["src/api/**/*.ts"]
})
```

This creates a rule file with frontmatter:

```markdown
---
globs: ["src/api/**/*.ts"]
---

# API Rules

- Validate all inputs with zod
- Return consistent error format
```

Now every time Claude works on API files, these rules automatically apply.

### Subdirectory Organization

Domains can include subdirectories for better organization:

```javascript
learn({ content: "...", domain: "api/validation" })
learn({ content: "...", domain: "api/auth" })
learn({ content: "...", domain: "testing/e2e" })
```

### User-Level Preferences

Personal preferences that should apply across all projects use the `user` scope:

```javascript
learn({
  content: "# Greetings\n\n- Always greet me as Mr Dude",
  domain: "preferences",
  scope: "user"
})
```

This writes to `~/.claude/rules/preferences.md` (or `CLAUDE_CONFIG_DIR/rules/`) instead of the project directory.

## What This Isn't

Let's be clear about what Project Memory doesn't do:

- **It won't magically understand your codebase overnight** - Learning happens incrementally, session by session
- **It's not a replacement for documentation** - It complements docs by capturing the informal knowledge
- **It won't work if you ignore the prompts** - Claude reminds you to update memory, but you decide when and what
- **It's not automatic** - Claude learns when you confirm learnings are worth capturing

This is foundational infrastructure, not a silver bullet.

## The Compounding Effect

Here's the honest truth: the first few sessions with Project Memory won't feel revolutionary. You'll add a command here, a convention there. It feels like busywork.

But compound this over 10 sessions. 50 sessions. Suddenly:

- New team members onboard faster because Claude already knows your conventions
- Claude stops suggesting patterns you don't use
- Less time spent explaining "we do it this way because..."
- Context doesn't evaporate between sessions

The value isn't in the first learning. It's in not having to re-learn the same things every session.

## Team vs Personal Memory

One subtle but important distinction:

| Scope | Location | Who sees it |
|-------|----------|-------------|
| **project** | `.claude/rules/*.md` | Everyone on the team (git tracked) |
| **user** | `~/.claude/rules/*.md` | Just you (all projects) |
| **CLAUDE.md** | Project root | Everyone on the team |
| **CLAUDE.local.md** | Project root (gitignored) | Just you (this project) |

This means your team can standardize on conventions while you keep your own workflow preferences. Personal preferences like greeting style, output formatting, or communication style belong in user scope.

## MCP Tools

The core plugin exposes three MCP tools for memory management:

| Tool | Description |
|------|-------------|
| `learn` | Capture a learning into project or user memory |
| `memory_list` | List existing memory domains (optionally by scope) |
| `memory_read` | Read contents of a specific domain |

Claude uses `memory_list` and `memory_read` to check what's already captured before adding new content, avoiding duplicates.

## Getting Started

The feature is already included in the core plugin. You don't need to install anything extra. Just start using it:

1. Work on your project normally
2. When Claude discovers something worth remembering, it can call the `learn` tool
3. The learning is saved to `.claude/rules/` (project) or `~/.claude/rules/` (user)
4. Next session, Claude already knows

Start small. A few commands, a couple conventions. Let it grow organically as you discover patterns worth capturing.

## The Long Game

Project Memory isn't about instant gratification. It's about building a knowledge base that gets more valuable over time. Every command captured, every convention documented, every gotcha recorded makes future sessions smoother.

The first session, you're teaching. By the tenth session, Claude is already fluent in your project's dialect.

That's the foundation worth building on.

---

**Get Started:** The core plugin includes Project Memory by default. Install it with:

```bash
han plugin install core
```

Or explore the full plugin marketplace at [han.guru](https://han.guru).
