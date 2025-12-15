---
title: "Memory System"
description: "Han's five-layer memory system provides full historical context - from instant rules to complete conversation history, with automatic pattern promotion."
---

Every codebase has quirks that aren't in the README. Claude figures these out, then next session... context is lost. Han's memory system fixes this with five layers of context and automatic pattern promotion.

## Five Layers of Memory

| Layer | Source | Speed | Contains |
|-------|--------|-------|----------|
| **1. Rules** | `.claude/rules/` | Instant | Conventions, patterns |
| **2. Summaries** | Session end | Fast | Work done, decisions |
| **3. Observations** | Tool usage | Fast | Files touched, commands |
| **4. Transcripts** | Conversations | Moderate | Full discussion history |
| **5. Team Memory** | Git + integrations | Varies | Commits, PRs, expertise |

All layers are searchable via the `memory` MCP tool. Layers 2-5 are indexed using full-text search (BM25) and semantic search for fast retrieval.

---

## Layer 1: Rules - The Learn Tool

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

## Layer 2-3: Session Memory

Han automatically captures what happens during sessions.

### Summaries (Layer 2)

AI-generated overviews created at session end:

- Work completed and in-progress
- Decisions made with rationale
- Key files touched
- Notes for next session

### Observations (Layer 3)

Raw tool usage logs captured in real-time:

- Every file read/edited
- Commands executed
- Timestamps for everything
- Full context trail

Query with: `memory({ question: "what was I working on?" })`

### Session End

When a session ends, Han:

1. Reads all observations from the session
2. Generates an AI summary
3. Indexes both for future search

CLI access:

```bash
# End session and create summary
han memory session-end --session-id <id>
```

---

## Layer 4: Transcript Search

Han searches your full Claude Code conversation history stored at `~/.claude/projects/`.

This recovers context that was previously lost:

- "What did we discuss about authentication?"
- "Why did we choose JWT over sessions?"
- Full reasoning, not just summaries

### Cross-Worktree Support

Working in multiple worktrees? Han finds context from peer worktrees sharing the same git remote. Context follows the repository, not just the directory.

Query with: `memory({ question: "what did we discuss about X?" })`

---

## Layer 5: Team Memory

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

All layers (except rules) are indexed for fast search using BM25 full-text search and semantic embeddings.

### CLI Commands

```bash
# Index all content for current project
han index run

# Index specific layer
han index run --layer transcripts
han index run --layer observations
han index run --layer summaries
han index run --layer team

# Index specific session
han index run --session <session-id>

# Search indexed content
han index search "authentication"
han index search "error handling" --layer team --limit 20

# Check index status
han index status
```

### Automatic Indexing

Indexing happens automatically at session end. Manual indexing is optional but useful for:

- Initial setup after installing Han
- Troubleshooting search issues
- Forcing a reindex after data changes

---

## Unified Query Interface

The `memory` MCP tool routes questions to appropriate layers automatically:

| Question Type | Routes To |
|--------------|-----------|
| "What was I working on?" | Personal sessions (Layer 2-3) |
| "Continue where I left off" | Recent session context |
| "Who knows about X?" | Team memory research (Layer 5) |
| "Why did we choose Y?" | Transcripts + team (Layer 4-5) |
| "How do we handle Z?" | Rules + conventions (Layer 1) |

You don't think about layers - you just ask questions.

---

## Storage Layout

```text
~/.claude/
  han/
    memory/
      personal/
        sessions/           # Layer 3: Raw observations (JSONL)
        summaries/          # Layer 2: AI summaries (YAML)
      index/
        fts.db              # Full-text search index
      projects/
        github.com_org_repo/
          meta.yaml         # Team memory metadata

  projects/
    {project-slug}/         # Layer 4: Claude transcripts (JSONL)

.claude/                    # In project repo (git-tracked)
  rules/                    # Layer 1: Permanent rules
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
