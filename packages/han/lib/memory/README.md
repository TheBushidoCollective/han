# Han Memory System

A three-layer memory architecture for personal session continuity and team knowledge sharing.

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Permanent Wisdom (.claude/rules/)                     │
│  ─────────────────────────────────────                          │
│  Git-tracked, team-reviewed conventions                         │
│  Always loaded, highest authority                               │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Team Memory (authoritative sources)                   │
│  ─────────────────────────────────────                          │
│  Git commits, PRs, Issues, Reviews                              │
│  Researched on-demand, cached in LanceDB                        │
│  "Who knows X?" → Research until confident                      │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: Personal Memory (local sessions)                      │
│  ─────────────────────────────────────                          │
│  Session capture, AI summaries, continuity                      │
│  "What was I working on?" → Check recent sessions               │
└─────────────────────────────────────────────────────────────────┘
```

## Personal Memory (Layer 1)

### Session Lifecycle

Sessions are long-lived and don't have explicit start/end hooks. Instead:

1. **Capture (PostToolUse hook)**: Records tool usage as observations continuously
2. **Query (on-demand)**: Search observations via the `memory` MCP tool

The `session_id` comes from Claude Code and is passed implicitly with each PostToolUse event.

### Observation Capture

The PostToolUse hook captures tool usage automatically:

```
PostToolUse fired → han memory capture (reads stdin) → captureToolUse()
                                                            ↓
                                        Appends to ~/.claude/han/memory/sessions/{session_id}.jsonl
```

Each observation includes:

- Tool name and input/output summaries
- Files read and modified
- Timestamp

### CLI Command

```bash
# Called automatically from PostToolUse hook
# Reads event from stdin, extracts session_id, tool_name, tool_input, tool_result
han memory capture
```

### Optional Summarization

Summaries can be generated on-demand if needed:

```bash
han memory session-end --session-id abc123
```

This extracts patterns from observations:

**Work Items**:

- Groups related file modifications (e.g., component + styles + test)
- Infers outcome from subsequent test results

**In Progress**:

- Identifies consecutive reads without corresponding edits

**Decisions**:

- Finds research (WebSearch, Read) followed by implementation (Write, Edit)

### Storage

All personal memory stored in `~/.claude/han/memory/personal/`:

```
~/.claude/han/memory/personal/
  sessions/
    2025-12-12-abc123.jsonl    # Raw observations (append-only)
  summaries/
    2025-12-12-abc123.yaml     # Session summary
  .index/                       # Vector search index (future)
```

## Testing

```bash
# Unit tests
bun test test/memory-summarize.test.ts

# Integration tests
bun test test/memory-integration.test.ts

# All memory tests
bun test test/memory*.test.ts
```

## Future Enhancements

- AI-powered summarization (optional, using local models)
- Semantic search with embeddings
- Cross-session pattern detection
- Automatic promotion to .claude/rules/
