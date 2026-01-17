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
│  LAYER 1: Personal Memory (indexed sessions)                    │
│  ─────────────────────────────────────                          │
│  Session transcripts indexed in SQLite with FTS5                │
│  "What was I working on?" → Search session history              │
└─────────────────────────────────────────────────────────────────┘
```

## Personal Memory (Layer 1)

### Session Indexing

Sessions are stored in Claude Code's native JSONL format and indexed by Han:

```
Claude Code writes → ~/.claude/projects/{project}/sessions/{session}.jsonl
                                            ↓
                         Han indexer parses JSONL into SQLite
                                            ↓
                      Messages, tool calls, file changes stored in DB
```

The indexer runs on-demand (when you run `han browse` or validation hooks) and:

- Parses session transcripts incrementally
- Tracks file changes from Edit/Write tool uses
- Indexes message content via FTS5 for full-text search
- Records han events (sentiment analysis, hook results, etc.)

### Storage

All session data is stored in SQLite:

```
~/.claude/han/han.db
  ├── messages          # Session messages with FTS5 index
  ├── session_file_changes  # Files modified per session
  └── sessions          # Session metadata
```

### Querying Sessions

Use the Browse UI to search session history:

```bash
han browse
```

Or use the MCP tools for programmatic access.

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

- Semantic search with embeddings
- Cross-session pattern detection
- Automatic promotion to .claude/rules/
