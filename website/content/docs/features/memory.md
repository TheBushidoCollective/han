---
title: "Memory System"
description: "Han's five-layer memory system provides full historical context - from instant rules to complete conversation history."
---

Every codebase has quirks that aren't in the README. Claude figures these out, then next session... context is lost. Han's memory system fixes this with five layers of context.

## Five Layers of Memory

| Layer | Source | Speed | Contains |
|-------|--------|-------|----------|
| **1. Rules** | `.claude/rules/` | Instant | Conventions, patterns |
| **2. Summaries** | Session end | Fast | Work done, decisions |
| **3. Observations** | Tool usage | Fast | Files touched, commands |
| **4. Transcripts** | Conversations | Moderate | Full discussion history |
| **5. Team Memory** | Git history | Varies | Commits, PRs, expertise |

All layers are searchable via the `memory` MCP tool. Layers 2-5 are indexed using full-text search (BM25) for fast retrieval.

---

## Layer 1: Rules - The Learn Tool

Han lets Claude **teach itself** about your project by writing to `.claude/rules/`.

## How It Works

Han provides MCP tools that let Claude write to `.claude/rules/` - the modular rules directory that Claude Code loads automatically. When Claude discovers something worth remembering, it captures it.

```javascript
// Claude discovers the test command and captures it
learn({
  content: "# Commands\n\n- Run tests: `bun test --only-failures`",
  domain: "commands"
})
```

This creates `.claude/rules/commands.md`. Next session, Claude reads it automatically. The learning persists.

## Why Autonomous?

Confirmation dialogs create friction. Claude's learnings are low-stakes:

- **Git-tracked**: Reviewable and revertible
- **Scoped to Claude**: Only affects AI behavior
- **Additive**: Never destructive changes
- **Easily fixed**: Wrong learnings are trivially deleted

So Han lets Claude learn freely and informs you what was captured.

## MCP Tools

Three tools power the memory system:

| Tool | Purpose |
|------|---------|
| `learn` | Write a learning to `.claude/rules/<domain>.md` |
| `memory_list` | List existing rule domains |
| `memory_read` | Read a domain's content (avoid duplicates) |

### The `learn` Tool

Write project knowledge to a specific domain:

```javascript
learn({
  content: "# Build Commands\n\n- Dev: `bun run dev`\n- Test: `bun test`",
  domain: "commands"
})
```

Creates `.claude/rules/commands.md`:

```markdown
# Build Commands

- Dev: `bun run dev`
- Test: `bun test`
```

### Path-Specific Rules

Some learnings apply only to certain files:

```javascript
learn({
  content: "# API Rules\n\n- Validate all inputs with zod",
  domain: "api-validation",
  paths: ["src/api/**/*.ts"]
})
```

Creates `.claude/rules/api-validation.md` with YAML frontmatter:

```markdown
---
globs: ["src/api/**/*.ts"]
---

# API Rules

- Validate all inputs with zod
```

Claude Code only loads this rule when working on matching files.

### Subdirectory Organization

Organize learnings into hierarchies:

```javascript
learn({ content: "...", domain: "api/validation" })
learn({ content: "...", domain: "api/auth" })
learn({ content: "...", domain: "testing/e2e" })
```

Creates:

```text
.claude/rules/
├── api/
│   ├── validation.md
│   └── auth.md
└── testing/
    └── e2e.md
```

### User-Level Preferences

Personal preferences across all projects use `user` scope:

```javascript
learn({
  content: "# Preferences\n\n- Use concise responses\n- Prefer functional patterns",
  domain: "preferences",
  scope: "user"
})
```

Writes to `~/.claude/rules/preferences.md` instead of the project directory.

## What Claude Learns

Han's memory hook guides Claude to recognize learning opportunities:

| Type | Example |
|------|---------|
| **Commands** | Build scripts, test runners, deployment commands |
| **Conventions** | Naming patterns, file organization, code style |
| **Gotchas** | Common mistakes, edge cases, workarounds |
| **Architecture** | Module boundaries, data flow, key abstractions |
| **Preferences** | Communication style, formatting choices |

When Claude thinks "I see this project uses..." or "The pattern here is..." - that's the trigger to capture it.

## The Self-Improvement Loop

Each session, Claude gets smarter about your project:

1. Claude works on your code
2. Claude discovers patterns, commands, conventions
3. Claude captures them to `.claude/rules/`
4. Next session, Claude already knows them
5. Repeat

Not through external training, but through self-directed learning within your codebase.

## Team Benefits

Since `.claude/rules/` is git-tracked:

- **Immediate onboarding**: New team members benefit instantly
- **Shared knowledge**: Claude's learnings become team knowledge
- **Institutional memory**: Survives personnel changes
- **Living documentation**: Captures the informal "how we do things"

## Memory vs CLAUDE.md

| File | Purpose | Who Writes |
|------|---------|------------|
| `CLAUDE.md` | Curated project instructions | You (the developer) |
| `.claude/rules/` | Discovered project knowledge | Claude (autonomously) |

Han never touches your CLAUDE.md. That's for your team's hand-written documentation. The rules directory captures knowledge that wouldn't make it into formal docs.

## Directory Structure

```text
.claude/
├── rules/                    # Claude's learned knowledge
│   ├── commands.md           # Build/test commands
│   ├── conventions.md        # Code style, naming
│   ├── api/
│   │   ├── validation.md     # API-specific rules
│   │   └── auth.md
│   └── testing/
│       └── e2e.md
├── settings.json             # Project settings
└── settings.local.json       # Local overrides (gitignored)
```

User-level rules live in `~/.claude/rules/`.

## Reviewing and Editing

You maintain full control:

```bash
# See what Claude has learned
ls .claude/rules/

# Read a specific domain
cat .claude/rules/commands.md

# Edit or delete any rule
vim .claude/rules/conventions.md
rm .claude/rules/outdated-info.md
```

Wrong learnings? Just delete the file. Claude will relearn correctly.

## Triggering Learning

Han's UserPromptSubmit hook includes guidance for when to learn:

- After discovering undocumented commands
- When figuring out project conventions
- After encountering (and solving) gotchas
- When noticing patterns worth preserving

Claude autonomously evaluates each session for learning opportunities.

## Configuration

Memory tools are part of the core plugin:

```bash
han plugin install core
```

No additional configuration needed. Claude will start learning automatically.

## What Memory Isn't

**Not a database**: Memory is flat markdown files, human-readable and editable.

**Not permanent**: You can delete any learning. Nothing is locked in.

**Not shared externally**: Everything stays in your project or user directory.

---

## Layer 2-3: Session Memory

Han automatically captures what happens during sessions:

**Summaries** (Layer 2): AI-generated overviews at session end

- Work completed and in-progress
- Decisions made with rationale
- Key files touched

**Observations** (Layer 3): Raw tool usage logs

- Every file read/edited
- Commands executed
- Timestamps for everything

Query with: `memory({ question: "what was I working on?" })`

---

## Layer 4: Transcript Search

**New in this release.** Han can search your full Claude Code conversation history stored at `~/.claude/projects/`.

This recovers context that was previously lost:

- "What did we discuss about authentication?"
- "Why did we choose JWT over sessions?"
- Full reasoning, not just summaries

### Cross-Worktree Support

Working in multiple worktrees? Han finds context from peer worktrees sharing the same git remote.

Query with: `memory({ question: "what did we discuss about X?" })`

---

## Layer 5: Team Memory

Research institutional knowledge from git history:

- Who has expertise in what areas
- Why decisions were made (PR discussions)
- Historical context from commits

Query with: `memory({ question: "who knows about payments?" })`

---

## Indexing

All layers (except rules) are indexed for fast search:

```bash
# Index all content
han index run

# Index specific layer
han index run --layer transcripts

# Search directly
han index search "authentication"
```

Indexing happens automatically at session end. Manual indexing is optional.

## Next Steps

- Learn about [checkpoints](/docs/features/checkpoints) for session-scoped validation
- Explore the [MCP integrations](/docs/integrations) Han provides
- Read about [configuration](/docs/configuration) options
