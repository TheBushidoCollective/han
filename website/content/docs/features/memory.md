---
title: "Memory System"
description: "Han's memory system provides full historical context - from instant rules to complete conversation history, with automatic pattern promotion."
---

Every codebase has quirks that aren't in the README. Claude figures these out, then next session... context is lost. Han's memory system fixes this with persistent context and automatic pattern promotion.

## Memory Layers

| Layer | Source | Speed | Contains |
|-------|--------|-------|----------|
| **Rules** | `.claude/rules/` | Instant | Conventions, patterns |
| **Transcripts** | Conversations | Fast | Full discussion history |
| **Team Memory** | Git + integrations | Varies | Commits, PRs, expertise |

All layers are searchable via the `memory` MCP tool. Transcripts and team memory are indexed using full-text search (BM25) for fast retrieval.

---

## Rules - The Learn Tool

Han lets Claude **teach itself** about your project by writing to `.claude/rules/`.

### How It Works

Han provides MCP tools that let Claude write to `.claude/rules/` - the modular rules directory that Claude Code loads automatically. When Claude discovers something worth remembering, it captures it.

```javascript
// Claude discovers the test command and captures it
learn({
  content: "# Commands\n\n- Run tests: `bun test --only-failures`",
  domain: "commands"
})
```

This creates `.claude/rules/commands.md`. Next session, Claude reads it automatically. The learning persists.

### Why Autonomous?

Confirmation dialogs create friction. Claude's learnings are low-stakes:

- **Git-tracked**: Reviewable and revertible
- **Scoped to Claude**: Only affects AI behavior
- **Additive**: Never destructive changes
- **Easily fixed**: Wrong learnings are trivially deleted

So Han lets Claude learn freely and informs you what was captured.

### MCP Tools

| Tool | Purpose |
|------|---------|
| `learn` | Write a learning to `.claude/rules/<domain>.md` |
| `memory_list` | List existing rule domains |
| `memory_read` | Read a domain's content (avoid duplicates) |
| `auto_learn` | Check status and trigger pattern promotion |

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

---

## Auto-Promotion Engine

Beyond manual learning, Han automatically promotes patterns to rules when they're observed repeatedly across your work.

### How It Works

1. As you work, Han tracks patterns from observations, research, and team memory
2. Each occurrence increases a pattern's confidence score (starts at 0.5, gains 0.15 per occurrence)
3. When a pattern reaches **3+ occurrences** and **≥0.8 confidence**, it's promoted to `.claude/rules/`

### Promotion Criteria

| Criteria | Threshold |
|----------|-----------|
| Minimum occurrences | 3 |
| Confidence score | ≥ 0.8 |
| Multiple authors (bonus) | +0.1 confidence |

### Domain Detection

Patterns are automatically classified into domains based on keywords:

| Domain | Keywords |
|--------|----------|
| testing | test, spec, mock, fixture, assert |
| api | endpoint, route, handler, request |
| auth | auth, login, session, token, jwt |
| database | db, query, migration, schema |
| error | error, exception, catch, throw |
| commands | command, cli, script, npm, bun |

### The `auto_learn` Tool

Check and manage auto-promotion:

```javascript
// View tracked patterns and statistics
auto_learn({ action: "status" })

// See patterns ready for promotion
auto_learn({ action: "candidates" })

// Trigger promotion cycle manually
auto_learn({ action: "promote" })
```

### Why This Matters

- **Emergent documentation**: Patterns document themselves through practice
- **Conservative**: High thresholds prevent noise
- **Transparent**: All promotions visible in git history
- **Low-stakes**: Git-tracked, reviewable, revertible

---

## Conversation Memory

Han searches your Claude Code conversation history and extracts context from past sessions.

### What's Captured

- **Transcripts**: Full conversation history from `~/.claude/projects/`
- **Summaries**: AI-generated summaries of work sessions
- **Cross-worktree**: Context from peer worktrees sharing the same git remote

Query with: `memory({ question: "what was I working on?" })`

---

## Team Memory

Team memory goes beyond personal sessions to research institutional knowledge from multiple sources.

### Knowledge Sources

| Source | What It Provides |
|--------|-----------------|
| **Git history** | Commits, diffs, who changed what |
| **GitHub** | PRs, reviews, issue discussions |
| **Linear** | Issue context, project decisions |
| **Jira** | Ticket history, sprint context |

### Research Engine

Team queries use a "research until confident" approach:

1. Generate initial search query from your question
2. Execute semantic search on indexed content
3. Assess confidence based on evidence found
4. If not confident, refine query and iterate
5. Return answer with citations

### Expertise Mapping

Find who knows what:

```javascript
memory({ question: "who should I talk to about payments?" })
```

Returns evidence-based answers:

- Commit frequency by author in relevant areas
- PR authorship and reviews
- Issue resolution history
- Confidence scores

### Provider Discovery

Team memory integrates with external sources through hashi plugins:

```bash
# Add GitHub integration
han plugin install hashi-github

# Add Linear integration
han plugin install hashi-linear
```

Each provider contributes to the team knowledge base. The research engine searches across all configured providers.

Query with: `memory({ question: "who knows about payments?" })`

---

## Indexing

Transcripts and team memory are indexed for fast search using BM25 full-text search.

### CLI Commands

```bash
# Index all content for current project
han index run

# Index specific layer
han index run --layer transcripts
han index run --layer team

# Search indexed content
han index search "authentication"
han index search "error handling" --layer team --limit 20

# Check index status
han index status
```

### Manual Indexing

Indexing is useful for:

- Initial setup after installing Han
- Troubleshooting search issues
- Forcing a reindex after data changes

---

## Unified Query Interface

The `memory` MCP tool routes questions to appropriate sources automatically:

| Question Type | Routes To |
|--------------|-----------|
| "What was I working on?" | Recent transcripts |
| "Continue where I left off" | Session context |
| "Who knows about X?" | Team memory research |
| "Why did we choose Y?" | Transcripts + team memory |
| "How do we handle Z?" | Rules + conventions |

You don't think about sources - you just ask questions.

---

## Storage Layout

```text
~/.claude/
  han/
    memory/
      index/
        fts.db              # Full-text search index
      projects/
        github.com_org_repo/
          meta.yaml         # Team memory metadata

  projects/
    {project-slug}/         # Claude transcripts (JSONL)

.claude/                    # In project repo (git-tracked)
  rules/                    # Permanent rules
```

---

## Configuration

Memory is enabled by default with the core plugin:

```bash
han plugin install core
```

### Disable Memory

```yaml
# han.yml
memory:
  enabled: false
```

### What Memory Isn't

- **Not a database**: Memory is flat files, human-readable and editable
- **Not permanent**: You can delete any learning
- **Not shared externally**: Everything stays local

---

## Next Steps

- Learn about [checkpoints](/docs/features/checkpoints) for session-scoped validation
- Explore the [MCP integrations](/docs/integrations) Han provides
- Read about [configuration](/docs/configuration) options
