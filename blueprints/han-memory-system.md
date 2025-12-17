---
name: han-memory-system
summary: Complete architecture and implementation of Han Memory - team-shared semantic memory with personal session continuity, multi-layer racing, and self-learning promotion
---

# Han Memory System

A five-layer memory system that provides personal session continuity, team knowledge research, permanent wisdom, and **self-learning promotion** - all with zero setup, research-until-confident accuracy, and citation-backed answers.

## Implementation Status

| Phase | Component | Status |
|-------|-----------|--------|
| Phase 1 | Storage Layer | ✅ Complete |
| Phase 2 | Personal Memory Hooks | ✅ Complete |
| Phase 3 | Git Source Provider | ✅ Complete |
| Phase 3 | GitHub Source Provider | ✅ Complete |
| Phase 3 | Research Engine | ✅ Complete |
| Phase 3 | Team Query MCP Tool | ✅ Complete |
| Phase 4 | Query Router | ✅ Complete |
| Phase 5 | Native Embeddings (SurrealDB + ONNX) | ✅ Complete |
| Phase 6 | Auto-Promotion Engine | ✅ Complete |
| Phase 7 | **Multi-Layer Racing** | ✅ Complete |

## Vision

> **The best setup is no setup.**
> **The best sync is no sync.**
> **Just ask questions, get answers.**
> **Claude learns and writes, doesn't just suggest.**

Han Memory solves everything Claude Mem does AND more:

- Personal session continuity ("continue where I left off")
- Team knowledge ("who knows about payments?")
- Decision archaeology ("why did we choose X?")
- Permanent conventions (`.claude/rules/`)
- **Self-learning promotion** (patterns auto-promoted to rules)
- **Multi-layer racing** (search all layers in parallel)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Rules (.claude/rules/)                                │
│  ─────────────────────────────────────────                      │
│  Git-tracked, team-reviewed conventions                         │
│  Highest authority, always searched                             │
│  ↑ AUTO-PROMOTED from team memory when confidence >= 0.8        │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Summaries (~/.claude/han/memory/summaries/)           │
│  ─────────────────────────────────────────                      │
│  AI-compressed session overviews                                │
│  "What was I working on?" → Recent session context              │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: Observations (~/.claude/han/memory/sessions/)         │
│  ─────────────────────────────────────────                      │
│  Raw tool usage logs (append-only JSONL)                        │
│  Detailed work history for pattern extraction                   │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: Transcripts (~/.claude/projects/)                     │
│  ─────────────────────────────────────────                      │
│  Full conversation history with Claude                          │
│  "What did we discuss?" → Search past conversations             │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 5: Team Memory (git history)                             │
│  ─────────────────────────────────────────                      │
│  Git commits, PRs, Issues, Reviews                              │
│  Researched on-demand, cached in SurrealDB                      │
│  "Who knows X?" → Research until confident                      │
└─────────────────────────────────────────────────────────────────┘
```

## Multi-Layer Racing (Key Architecture)

**The memory system searches ALL layers in parallel**, not just one layer based on keyword classification.

### Old (Broken) Approach

```
Question → Classify by keywords → Pick ONE layer → Search → Low confidence? Too bad.
```

Problems with keyword routing:

- "How do we handle X" → ✅ matches "conventions"
- "How do engagements work" → ❌ doesn't match (no "we")
- "What production issues?" → ❌ doesn't match any pattern

### New (Racing) Approach

```
Question → Search ALL layers in parallel → Combine results → Return best matches
```

The `searchAllLayers()` function:

1. Races all layers concurrently using `Promise.all()`
2. Each layer returns results with confidence scores
3. Results are combined with source attribution
4. Best matches are returned regardless of which layer found them

### Layer Priority

When multiple layers have content:

1. **Rules** (highest authority - git-tracked conventions)
2. **Transcripts** (conversation history)
3. **Team Memory** (git/PRs)

### Result Format

```typescript
interface MemoryResult {
  answer: string;
  source: "rules" | "team" | "transcripts" | "combined";
  confidence: "high" | "medium" | "low";
  citations: Citation[];
  layersSearched: MemoryLayer[];  // Shows which layers were searched
}
```

## Native Backend Architecture

The memory system uses a pure-Rust native module (`han-native`) for cross-compilation compatibility:

```
┌─────────────────────────────────────────────────────────────────┐
│  han-native (Rust, napi-rs)                                     │
├─────────────────────────────────────────────────────────────────┤
│  SurrealDB (kv-surrealkv)       │  ONNX Runtime (ort)           │
│  ─────────────────────────      │  ───────────────────          │
│  • FTS with BM25 scoring        │  • load-dynamic feature       │
│  • Vector search with HNSW      │  • all-MiniLM-L6-v2 model     │
│  • Pure Rust, no native deps    │  • Runtime download on first  │
│  • Multi-process safe           │    use (~150MB + 90MB model)  │
├─────────────────────────────────────────────────────────────────┤
│  reqwest (rustls-tls)           │  Storage Location             │
│  ─────────────────────          │  ────────────────             │
│  • Pure Rust TLS                │  ~/.claude/han/memory/index/  │
│  • Downloads ONNX Runtime       │  • fts.db (FTS index)         │
│  • Downloads embedding model    │  • vectors.db (vector store)  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

- **No OpenSSL**: Uses rustls for TLS, enabling Linux cross-compilation
- **No link-time ONNX**: Uses `load-dynamic` to download ONNX Runtime at runtime
- **SurrealDB over LanceDB**: Avoids aws-lc-sys cross-compilation issues
- **Single binary**: All dependencies bundled, ONNX downloaded on first use

## MCP Tools

### `memory` (Unified Query Router)

**Primary entry point for all memory queries.** Searches all layers in parallel.

```typescript
interface MemoryParams {
  question: string;
}
```

For most questions, uses multi-layer racing. Only personal questions ("what was I working on?") are routed specifically to personal memory.

### `team_query` (Team Memory Research)

Direct access to team memory research engine.

```typescript
interface TeamQueryParams {
  question: string;
  limit?: number;  // Default: 10
}
```

Uses "research until confident" pattern to search:

- Git commits and diffs
- PR descriptions and reviews
- Indexed observations

### `learn` (Capture Conventions)

Proactively capture learnings to `.claude/rules/`.

```typescript
interface LearnParams {
  domain: string;    // e.g., "testing", "api", "auth"
  content: string;   // The learning to capture
  scope?: "project" | "user";
}
```

### `auto_learn` (Self-Learning Visibility)

Check status and trigger pattern promotion.

```typescript
interface AutoLearnParams {
  action: "status" | "candidates" | "promote";
}
```

- **status**: View tracked patterns and statistics
- **candidates**: See patterns ready for promotion
- **promote**: Manually trigger promotion cycle

## Auto-Promotion Engine

The self-learning system that **actively writes** to `.claude/rules/` instead of just suggesting.

### Promotion Criteria

Patterns are automatically promoted when they meet:

- **3+ occurrences** across different sources
- **0.8+ confidence** score (starts at 0.5, gains 0.15 per occurrence)
- **Multiple authors** (bonus: increases confidence by 0.1)
- **Not already documented** in rules

### Domain Detection

Patterns are classified into domains based on keywords:

| Domain | Keywords |
|--------|----------|
| testing | test, spec, mock, fixture, assert, expect |
| api | endpoint, route, handler, request, response |
| auth | auth, login, session, token, jwt, oauth |
| database | db, query, migration, schema, model, orm |
| error | error, exception, catch, throw, handle |
| logging | log, logger, debug, info, warn |
| config | config, env, environment, settings |
| build | build, compile, bundle, webpack, vite |
| commands | command, cli, script, npm, bun |

### Integration Points

- **After research**: `learnFromResearch()` extracts patterns from evidence
- **After indexing**: `learnFromObservations()` extracts patterns from observations
- **Manual trigger**: `auto_learn` MCP tool with `action: "promote"`

## Storage Layout

```
~/.claude/
  han/
    memory/
      personal/
        sessions/
          {date}-{session_id}.jsonl    # Raw observations (append-only)
        summaries/
          {date}-{session_id}.yaml     # AI-compressed summaries
      
      index/
        fts.db                          # SurrealDB FTS index
        vectors.db                      # SurrealDB vector store
      
      projects/
        github.com_org_repo/            # Denormalized git remote path
          meta.yaml                     # Index metadata, source cursors
    
    onnxruntime/                        # Downloaded ONNX Runtime
      onnxruntime-v1.20.1/
        lib/
          libonnxruntime.dylib          # Platform-specific library
    
    models/
      all-MiniLM-L6-v2/                 # Downloaded embedding model
        model.onnx
        tokenizer.json
          
.claude/                                # In project repo (git-tracked)
  rules/                                # Permanent wisdom - AUTO-PROMOTED
    api.md
    testing.md
    auth.md
```

## Hooks

| Hook | Event | File | Purpose |
|------|-------|------|---------|
| memory-capture | PostToolUse | `capture.ts` | Capture tool observations |
| memory-summarize | Stop | `summarize.ts` | AI summarize session |
| memory-context | SessionStart | `context-injection.ts` | Inject continuity context |

## Core Components

### Multi-Layer Search (`lib/commands/mcp/memory-router.ts`)

The `searchAllLayers()` function races all layers:

```typescript
async function searchAllLayers(question: string): Promise<MemoryResult> {
  const [rulesResult, transcriptsResult, teamResult] = await Promise.all([
    searchRules(question),
    searchTranscripts(question),
    searchTeamMemory(question),
  ]);
  
  // Combine results, prioritize by layer authority
  return combineResults([rulesResult, transcriptsResult, teamResult]);
}
```

### Research Engine (`lib/memory/research.ts`)

Implements "research until confident" pattern:

1. Generate initial search query from question
2. Execute semantic search on indexed observations
3. Assess confidence based on evidence
4. If not confident, refine query and iterate
5. **Extract and track patterns from evidence**
6. Return answer with citations and caveats

### Auto-Promotion Engine (`lib/memory/promotion.ts`)

Implements self-learning pattern detection and promotion:

- `trackPattern()` - Track patterns in session store
- `getPromotionCandidates()` - Find patterns meeting criteria
- `promotePattern()` - Write to `.claude/rules/{domain}.md`
- `autoPromotePatterns()` - Promote all ready patterns
- `learnFromResearch()` - Learn after research completes
- `learnFromObservations()` - Learn after indexing

### Vector Store (`lib/memory/vector-store.ts`)

Native embeddings layer using han-native:

- Uses `han-native` for ONNX Runtime embeddings (all-MiniLM-L6-v2, 384 dimensions)
- SurrealDB for vector storage with HNSW index
- Cosine similarity search
- Zero-config: downloads dependencies on first use
- Graceful fallback if native module unavailable

### FTS Indexer (`lib/memory/indexer.ts`)

Full-text search layer using han-native:

- SurrealDB with BM25 scoring
- Indexes observations, summaries, transcripts, team memory
- Per-project table namespacing

### Source Providers

**Git Provider** (`lib/memory/providers/git.ts`):

- Extracts commit messages and diffs
- Identifies file changes and patterns
- Maps authors to expertise areas

**GitHub Provider** (`lib/memory/providers/github.ts`):

- Requires `hashi-github` MCP server
- Extracts PR descriptions, reviews, comments
- Links commits to PR context

## Key Files

```
packages/han/
  lib/
    memory/
      storage.ts         # JSONL/YAML storage layer
      paths.ts           # Path resolution (personal, project)
      research.ts        # Research engine (research until confident)
      promotion.ts       # Auto-promotion engine (self-learning)
      capture.ts         # PostToolUse hook for observation capture
      summarize.ts       # Stop hook for session summarization
      context-injection.ts # SessionStart hook for continuity
      vector-store.ts    # Native embeddings layer (SurrealDB + ONNX)
      indexer.ts         # FTS indexer (SurrealDB BM25)
      types.ts           # Type definitions
      index.ts           # Module exports
      providers/
        git.ts           # Git source provider
        github.ts        # GitHub source provider (via MCP)
      
    commands/mcp/
      memory-router.ts   # Unified memory tool (multi-layer racing)
      team-memory.ts     # Team query tool
      auto-learn.ts      # Auto-learn status/trigger tool
      memory.ts          # Learn tool and memory file utilities
      server.ts          # MCP server with all tools

packages/han-native/
  src/
    lib.rs              # Main exports, file utilities
    db.rs               # SurrealDB wrapper (FTS + vector)
    embedding.rs        # ONNX Runtime embeddings
    download.rs         # Runtime download manager
```

## Test Coverage

- `memory-storage.test.ts`: Storage layer tests
- `memory-router.test.ts`: Query classification and multi-layer search tests (99 tests)
- `mcp-team-memory.test.ts`: Team query MCP tool tests
- `research.test.ts`: Research engine tests
- `promotion.test.ts`: Auto-promotion engine tests (25 tests)

## Self-Learning Philosophy

> **Claude should actively learn, not just suggest.**

The auto-promotion system is:

- **Low-stakes**: Git-tracked, reviewable, revertible
- **Additive**: Only adds new rules, never modifies existing
- **Conservative**: High thresholds prevent noise
- **Transparent**: All promotions visible in git history
