---
name: han-memory-system
summary: Complete architecture and implementation of Han Memory - five-layer semantic memory with synthesis via Agent SDK, streaming output, and citation-backed answers
---

# Han Memory System

A five-layer memory system providing semantic search across rules, native summaries, transcripts, team memory (git), and external providers (GitHub) - synthesized via Agent SDK with streaming output and deep-linked citations to the Browse UI.

## Implementation Status

| Phase | Component | Status | Notes |
|-------|-----------|--------|-------|
| Phase 1 | Storage Layer | ✅ Complete | JSONL/YAML storage, paths |
| Phase 2 | Rules (file-based) | ✅ Complete | .claude/rules/ search |
| Phase 3 | Git Source Provider | ✅ Complete | Direct git log access |
| Phase 3b | Research Engine | ✅ Complete | "Research until confident" pattern |
| Phase 4 | Query Router (multi-layer racing) | ✅ Complete | Promise.all() parallel search |
| Phase 5 | Native Embeddings (SQLite + FTS5) | ✅ Complete | han-native with BM25 |
| Phase 6 | Auto-Promotion Engine | ✅ Complete | Pattern detection, promotion |
| Phase 7 | Transcript Indexing (FTS) | ✅ Complete | FTS index of session transcripts |
| Phase 8 | Vector Indexing Trigger | ✅ Complete | indexDocuments() auto-triggers vector indexing |
| Phase 9 | Hybrid Search (FTS + Vector) | ✅ Complete | hybridSearch() combines BM25 + vector |
| Phase 10 | Memory Agent (Agent SDK) | ✅ Complete | memory-agent.ts with read-only search |
| Phase 11 | Data Access Layer MCP | ✅ Complete | Direct search functions (searchMemoryLayers) |
| Phase 12 | Live Session Streaming | ✅ Complete | streaming.ts with PubSub + 100ms delay |
| Phase 13 | Browse UI Integration | ✅ Complete | SearchTab.tsx with GraphQL subscriptions |
| Phase 14 | Summaries (native Claude) | ✅ Complete | parseSummaries(), indexNativeSummaries(), searchNativeSummaries() |
| Phase 15 | GitHub Provider (via MCP) | ✅ Complete | searchExternalProviders() via provider-discovery.ts |

**Current State**: Memory Agent with live streaming is functional. All five layers (rules, summaries, transcripts, team, external providers) are searchable. Browse UI shows real-time progress (SEARCHING, FOUND, SYNTHESIZING) and final results with confidence levels and citations. GitHub PRs/issues are searchable when hashi-github is installed.

**Removed: Observations Layer** - Tool calls and intent are already captured in transcripts. Separate observation capture would duplicate data and create sync concerns. "Best sync is no sync."

## Phase 8: Vector Indexing Trigger

The embedding infrastructure is built but not triggered automatically. This phase wires up vector indexing alongside FTS:

```
Coordinator sees new JSONL lines
        │
        ├─► Index to FTS (BM25)        ← Already works
        │
        └─► Index to Vector Store      ← Phase 8 adds this
                │
                ├─► Generate embedding (ONNX Runtime)
                └─► Store in sqlite-vec
```

**Implementation:**

1. Modify `indexDocuments()` in `indexer.ts` to also call vector indexing
2. Batch embeddings generation for efficiency (up to 32 docs at once)
3. Use the same document content for both FTS and vector
4. Handle graceful degradation if ONNX unavailable

## Phase 9: Hybrid Search

Combine FTS (keyword) and Vector (semantic) search results:

```typescript
async function hybridSearch(query: string, limit: number): Promise<SearchResult[]> {
  const [ftsResults, vectorResults] = await Promise.all([
    searchFts(tableName, query, limit * 2),
    vectorSearch(tableName, query, limit * 2),
  ]);

  // Reciprocal Rank Fusion to combine scores
  return fuseResults(ftsResults, vectorResults, limit);
}
```

## Vision

> **The best setup is no setup.**
> **The best sync is no sync.**
> **Just ask questions, get answers.**
> **Claude learns and writes, doesn't just suggest.**
> **See how the system thinks in real-time.**

Han Memory solves everything Claude Mem does AND more:

- Personal session continuity ("continue where I left off")
- Team knowledge ("who knows about payments?")
- Decision archaeology ("why did we choose X?")
- Permanent conventions (`.claude/rules/`)
- **Self-learning promotion** (patterns auto-promoted to rules)
- **Multi-layer racing** (search all layers in parallel)
- **Streaming synthesis** (see how Claude thinks while researching)
- **Citation links** (click to view source in Browse UI)

## Architecture

### Agent Isolation Pattern (CRITICAL)

The memory system uses a **separate Claude Code SDK agent** with **READ-ONLY access** to memory data. The main agent does NOT have direct access to memory data tools.

```
┌─────────────────────────────────────────────────────────────────┐
│  MAIN AGENT (User's Claude Code session)                        │
│  ─────────────────────────────────────────                      │
│  • Has access to standard tools (Read, Write, Bash, etc.)       │
│  • Calls memory() MCP tool for memory queries                   │
│  • DOES NOT have direct access to memory data                   │
│  • Receives synthesized answers with citations                  │
├─────────────────────────────────────────────────────────────────┤
                              │ memory() tool call
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  MEMORY AGENT (Claude Code SDK Agent - READ-ONLY)               │
│  ─────────────────────────────────────────                      │
│  • Spawned via Claude Agent SDK                                 │
│  • Session ID returned for live streaming                       │
│  • Has access to:                                               │
│    1. Data Access Layer MCP (local data)                        │
│    2. Memory Provider MCPs (hashi-github, etc.)                 │
│  • Cannot modify files, cannot execute code                     │
│  • Synthesizes information into meaningful answers              │
│  • Returns citations as deep links to Browse UI                 │
├─────────────────────────────────────────────────────────────────┤
        │                                           │
        │ MCP tool calls                            │ MCP tool calls
        ▼                                           ▼
┌───────────────────────────────┐   ┌─────────────────────────────┐
│  HAN DATA-ACCESS-LAYER MCP    │   │  MEMORY PROVIDER MCPs       │
│  ─────────────────────────    │   │  ─────────────────────      │
│  Local data access ONLY:      │   │  External data sources:     │
│  • search_rules(query)        │   │  • hashi-github:            │
│  • search_transcripts(query)  │   │    search_prs, search_issues│
│  • search_git_history(query)  │   │  • hashi-gitlab:            │
│  • search_observations(query) │   │    search_mrs, search_issues│
│  • get_session(id)            │   │  • Future: notion, etc.     │
│  • get_commit(sha)            │   │                             │
│                               │   │  Memory Agent calls these   │
│  All tools READ-ONLY.         │   │  directly, not via DAL.     │
└───────────────────────────────┘   └─────────────────────────────┘
```

### Live Session Streaming

When a memory query is initiated (from Browse UI or han MCP), the Memory Agent session is **attachable** for live feedback:

```
┌─────────────────────────────────────────────────────────────────┐
│  BROWSE UI or HAN MCP                                           │
│  ─────────────────────                                          │
│  1. Call memory(question)                                       │
│  2. Receive session_id immediately                              │
│  3. Attach to session for live streaming                        │
│  4. See agent's "thinking" in real-time:                        │
│     🔍 Searching rules...                                       │
│     📚 Found: api.md mentions rate limiting                     │
│     🔍 Searching transcripts...                                 │
│     💬 Found: Discussion about 429 errors                       │
│     🔍 Querying GitHub PRs...                                   │
│     📝 Found: PR #42 added rate limit middleware                │
│     ✨ Synthesizing answer...                                   │
│  5. Receive final answer with citations                         │
└─────────────────────────────────────────────────────────────────┘
```

The experience is identical whether initiated from:

- **Browse UI**: Memory search page with live streaming panel
- **han MCP**: memory() tool returns session_id for streaming

### Why Agent Isolation?

1. **Security**: Memory data includes sensitive session history. Isolating to a read-only agent prevents accidental modifications.
2. **Consistency**: The memory agent always behaves the same way - it can only read and synthesize, never act.
3. **Reliability**: No fallback architecture needed. The agent either gets data or doesn't - consistent behavior.
4. **Separation of Concerns**: Main agent handles actions, memory agent handles knowledge retrieval.
5. **Observability**: Session attachment enables live feedback - see how the agent "thinks" while searching.

### Memory Agent MCP Configuration

The Memory Agent uses the Claude Agent SDK with **restricted tool access** - it can ONLY use MCP tools, not standard Claude Code tools like Bash, Read, or Write. This is enforced via the `allowedTools` parameter.

#### MCP Server Sources

**ALL Memory Agent MCP servers are discovered from plugins** via a single, unified mechanism. Plugins must have BOTH `mcp` AND `memory` keys in their `han-plugin.yml` to be discovered as memory providers.

```
┌─────────────────────────────────────────────────────────────────┐
│  MEMORY PROVIDER MCPs (All Plugin-Discovered)                   │
│  ────────────────────────────────────────────                   │
│  Discovery: Scan installed plugins' han-plugin.yml              │
│  Requirement: Plugin must have BOTH `mcp` AND `memory` keys     │
│                                                                 │
│  Core Providers (from core/han-plugin.yml):                     │
│    - memory-dal: Internal database (FTS, vector, hybrid search) │
│                                                                 │
│  Hashi Providers (from hashi-*/han-plugin.yml):                 │
│    - blueprints: Project documentation search                   │
│    - github: PRs, issues, code search                           │
│    - gitlab: MRs, issues                                        │
│    - (future: notion, confluence, etc.)                         │
└─────────────────────────────────────────────────────────────────┘
```

This unified discovery mechanism means:

- No hardcoded MCP servers in the Memory Agent code
- New providers are added by installing plugins, not modifying agent code
- Each plugin declares its own MCP config and allowed tools

#### Plugin-Based Memory Provider Discovery

Memory providers are discovered from installed Han plugins that have BOTH an `mcp` key (defining the MCP server) AND a `memory` key (defining which tools are allowed for memory queries).

**han-plugin.yml Structure:**

MCP servers can be defined in two places:

- `mcp_servers` (root) - available to Claude Code AND memory system
- `memory.mcp_servers` - memory-only MCP servers (not exposed to Claude Code)

```yaml
# Example 1: core/han-plugin.yml (shared MCP server)
# MCP servers available to Claude Code AND memory system
mcp_servers:
  memory-dal:
    name: memory-dal
    description: Han internal memory database with FTS and vector search
    command: han
    args: ["mcp", "memory"]

# Memory config - defines which tools the Memory Agent can use
memory:
  allowed_tools:
    - mcp__memory-dal__memory_search_fts
    - mcp__memory-dal__memory_search_vector
    - mcp__memory-dal__memory_search_hybrid
    - mcp__memory-dal__memory_list_layers
  system_prompt: |
    Search the internal Han memory database for relevant information.
```

```yaml
# Example 2: Memory-only MCP server (not exposed to Claude Code)
memory:
  # MCP servers ONLY for memory system
  mcp_servers:
    internal-search:
      command: han
      args: ["mcp", "internal-search"]
  allowed_tools:
    - mcp__internal-search__search
  system_prompt: |
    Search internal data sources.
```

**Discovery Logic:**

```typescript
// Pseudocode for provider discovery
async function discoverMemoryProviders(): Promise<MemoryProvider[]> {
  const providers: MemoryProvider[] = [];

  for (const plugin of installedPlugins) {
    const config = parseYaml(plugin.hanPluginYml);

    // Plugin must have memory.allowed_tools
    if (!config.memory?.allowed_tools?.length) continue;

    // Collect MCP servers from BOTH sources:
    // 1. Root mcp_servers - available to Claude Code AND memory
    // 2. memory.mcp_servers - memory-only MCP servers
    const allMcpServers = {
      ...config.mcp_servers,        // Available to Claude Code
      ...config.memory.mcp_servers, // Memory-only
    };

    // Create provider for each server with matching tools
    for (const [serverKey, serverConfig] of Object.entries(allMcpServers)) {
      const serverTools = config.memory.allowed_tools.filter(
        tool => tool.startsWith(`mcp__${serverKey}__`)
      );

      if (serverTools.length > 0) {
        providers.push({
          name: plugin.name,
          type: "mcp",
          mcpConfig: serverConfig,
          allowedTools: serverTools,
        });
      }
    }
  }

  return providers;
}
```

#### Tool Restriction via allowedTools

The Memory Agent is spawned with an explicit `allowedTools` array, preventing access to any tools not in the list:

```typescript
// memory-agent.ts
const { mcpServers, allowedTools } = await buildMemoryAgentMcpConfig();

const agent = query({
  prompt: synthesisPrompt,
  options: {
    model: "claude-sonnet-4-20250514",
    maxTurns: 10,
    mcpServers,
    allowedTools,  // CRITICAL: Only these tools are available
  },
});
```

**What's Allowed** (dynamically from discovered plugins):

- `mcp__memory-dal__memory_search_fts` (from core)
- `mcp__memory-dal__memory_search_hybrid` (from core)
- `mcp__github__list_pull_requests` (from hashi-github, if installed)
- Any tool listed in `memory.allowed_tools` of discovered plugins

**What's Blocked:**

- `Bash` (no shell access)
- `Read` / `Write` (no file access)
- `Edit` (no file modification)
- Any tool not explicitly in the allowedTools array

This ensures the Memory Agent is truly read-only and can only synthesize information from its connected MCP servers. The tool list is fully dynamic - adding a new memory provider plugin automatically makes its tools available.

### Data Layers (4 Layers)

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Rules (.claude/rules/ or ~/.claude/rules/)            │
│  ─────────────────────────────────────────                      │
│  FILE-BASED: Project-level or user-level conventions            │
│  Git-tracked, team-reviewed, highest authority                  │
│  ↑ AUTO-PROMOTED from patterns when confidence >= 0.8           │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Summaries (Claude message summary type)               │
│  ─────────────────────────────────────────                      │
│  USE NATIVE: Claude Code's built-in summary messages            │
│  No custom summarization needed - leverage the platform         │
│  "What was I working on?" → Recent session context              │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: Transcripts (~/.claude/projects/{id}/sessions/)       │
│  ─────────────────────────────────────────                      │
│  INDEXED: Full conversation history with Claude                 │
│  Contains tool calls, results, intent, reasoning - everything   │
│  No separate "observations" needed - it's all here              │
│  ⚠️ SYNC CONCERN: Handle disk deletion vs DB retention          │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: Providers (MCP memory functions)                      │
│  ─────────────────────────────────────────                      │
│  EXTENSIBLE: MCP functions calling external memory providers    │
│  Git commits, PRs, Issues, external knowledge bases             │
│  Plugin-based: hashi-github, hashi-gitlab, etc.                 │
└─────────────────────────────────────────────────────────────────┘
```

> **Note**: Observations layer was removed. Tool calls, results, and intent are already in transcripts. Duplicating this data would violate "best sync is no sync."

## Layer Mapping (Source of Truth)

| Layer | Source | Implementation |
|-------|--------|----------------|
| **Rules** | `.claude/rules/` (project) or `~/.claude/rules/` (user) | File-based, git-tracked |
| **Summaries** | Claude Code's message `summary` type | Native platform feature |
| **Observations** | Pre-tool use context | Intent capture before action |
| **Transcripts** | `~/.claude/projects/{projectId}/sessions/*.jsonl` | Indexed from disk |
| **Providers** | MCP tool calls | External memory via plugins |

## Transcript/Database Sync Concern

**Problem**: Conversations may be removed from disk (user deletion, cleanup) but remain indexed in the database.

**Solution**:

1. **Soft References**: Index stores session_id + file_path; query validates file exists before returning
2. **Periodic Reconciliation**: Background task compares indexed sessions against disk
3. **Lazy Cleanup**: On query, if source file missing, mark as stale and exclude
4. **User Control**: Provide `han memory gc` command to purge orphaned index entries

```typescript
// On transcript search
for (const result of indexResults) {
  if (!existsSync(result.sourcePath)) {
    markAsStale(result.id);  // Background cleanup
    continue;  // Don't return stale results
  }
  validResults.push(result);
}
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
│  SQLite (rusqlite)              │  ONNX Runtime (ort)           │
│  ─────────────────────────      │  ───────────────────          │
│  • FTS5 with BM25 scoring       │  • load-dynamic feature       │
│  • sqlite-vec for vectors       │  • all-MiniLM-L6-v2 model     │
│  • WAL mode for concurrency     │  • Runtime download on first  │
│  • Single unified database      │    use (~150MB + 90MB model)  │
├─────────────────────────────────────────────────────────────────┤
│  reqwest (rustls-tls)           │  Storage Location             │
│  ─────────────────────          │  ────────────────             │
│  • Pure Rust TLS                │  ~/.claude/han/han.db         │
│  • Downloads ONNX Runtime       │  ~/Library/Caches/han/        │
│  • Downloads embedding model    │    onnxruntime/, models/      │
└─────────────────────────────────────────────────────────────────┘
```

**Key Design Decisions:**

- **SQLite over SurrealDB**: Simpler, more portable, better tooling
- **No OpenSSL**: Uses rustls for TLS, enabling Linux cross-compilation
- **No link-time ONNX**: Uses `load-dynamic` to download ONNX Runtime at runtime
- **sqlite-vec**: Pure Rust vector extension, avoids aws-lc-sys issues
- **Single binary**: All dependencies bundled, ONNX/model downloaded on first use

## Embeddings Generation Pipeline

The embedding system uses ONNX Runtime with the `all-MiniLM-L6-v2` model for semantic similarity:

### Model Details

| Property | Value |
|----------|-------|
| Model | `all-MiniLM-L6-v2` (Sentence Transformers) |
| Dimensions | 384 |
| Max Sequence | 512 tokens |
| Source | HuggingFace |
| Size | ~90MB model + ~150MB ONNX Runtime |

### Embedding Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  1. FIRST USE: Download Dependencies                            │
│  ─────────────────────────────────────                          │
│  • Check ~/Library/Caches/han/onnxruntime/ for ONNX Runtime     │
│  • Download platform-specific build if missing (v1.20.1)        │
│    - macOS: onnxruntime-osx-arm64-1.20.1.tgz                   │
│    - Linux: onnxruntime-linux-x64-1.20.1.tgz                   │
│    - Windows: onnxruntime-win-x64-1.20.1.zip                   │
│  • Download model.onnx and tokenizer.json from HuggingFace      │
├─────────────────────────────────────────────────────────────────┤
│  2. TOKENIZATION                                                │
│  ─────────────────                                              │
│  • Load tokenizer.json with vocab, special tokens               │
│  • Add [CLS] token at start                                     │
│  • Tokenize text: lowercase, split on whitespace/punctuation    │
│  • Look up token IDs in vocab, use [UNK] for unknown            │
│  • Add [SEP] token at end                                       │
│  • Pad to 512 tokens with [PAD]                                 │
│  • Generate attention mask (1s for real tokens, 0s for padding) │
├─────────────────────────────────────────────────────────────────┤
│  3. INFERENCE                                                   │
│  ───────────────                                                │
│  • Create session with ONNX model (GraphOptimizationLevel::3)   │
│  • Prepare inputs: input_ids, attention_mask, token_type_ids    │
│  • Run inference through transformer layers                     │
│  • Output: (batch_size, hidden_size=384) sentence embeddings    │
├─────────────────────────────────────────────────────────────────┤
│  4. NORMALIZATION                                               │
│  ─────────────────                                              │
│  • Compute L2 norm: sqrt(sum(x_i^2))                            │
│  • Normalize each dimension: x_i / norm                         │
│  • Result: unit vectors for cosine similarity via dot product   │
└─────────────────────────────────────────────────────────────────┘
```

### Vector Storage (sqlite-vec)

```sql
-- Vector table creation
CREATE VIRTUAL TABLE {table}_vec USING vec0(
    doc_id TEXT PRIMARY KEY,
    content TEXT,
    metadata TEXT,
    embedding float[384]
);

-- Vector search (KNN)
SELECT doc_id, content, metadata, distance
FROM {table}_vec
WHERE embedding MATCH ?query_blob
ORDER BY distance
LIMIT ?limit;
```

The vector is stored as a binary blob (384 floats * 4 bytes = 1536 bytes per vector).

### Search Modes

| Mode | Storage | Scoring | Use Case |
|------|---------|---------|----------|
| FTS (BM25) | `{table}_fts` | Term frequency + IDF | Keyword matching |
| Vector | `{table}_vec` | Cosine similarity | Semantic similarity |
| Hybrid | Both | Combine scores | Best of both |

Currently, the memory system uses both modes in parallel and combines results based on confidence scores

## MCP Tools

### `memory` (Unified Query - Spawns Memory Agent)

**Primary entry point for all memory queries.** Spawns a Memory Agent session and returns session_id for live streaming.

```typescript
interface MemoryParams {
  question: string;
}

interface MemoryResponse {
  session_id: string;      // Attach to this for live streaming
  answer: string;          // Final synthesized answer
  confidence: "high" | "medium" | "low";
  citations: Citation[];   // Deep links to Browse UI
  searched_sources: string[];
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

### Data Access Layer MCP (Memory Agent Only)

These tools are exposed **only to the Memory Agent**, not to the main agent:

```typescript
// Local data search tools
search_rules(query: string): Promise<RuleResult[]>
search_transcripts(query: string, limit?: number): Promise<TranscriptResult[]>
search_git_history(query: string, limit?: number): Promise<GitResult[]>
search_observations(query: string, limit?: number): Promise<ObservationResult[]>

// Specific item retrieval
get_session(session_id: string): Promise<Session>
get_commit(sha: string): Promise<Commit>
get_rule(domain: string): Promise<Rule>
```

All tools are **READ-ONLY**. The Memory Agent cannot modify any data through these tools.

### Session Streaming (Browse UI / MCP)

Attach to a Memory Agent session for live feedback:

```typescript
// From Browse UI (GraphQL subscription)
subscription MemoryAgentStream($sessionId: ID!) {
  memoryAgentMessages(sessionId: $sessionId) {
    type    # "thinking" | "tool_call" | "result" | "answer"
    content
    timestamp
  }
}

// From han MCP (streaming response)
interface MemoryStreamEvent {
  type: "thinking" | "tool_call" | "result" | "answer";
  content: string;
  tool?: string;        // For tool_call events
  source?: string;      // For result events
}
```

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
      
      # Note: Memory index is now unified in ~/.claude/han/han.db
      
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
- SQLite with sqlite-vec for vector storage
- Cosine similarity search via KNN
- Zero-config: downloads ONNX/model on first use
- Graceful fallback if native module unavailable

### FTS Indexer (`lib/memory/indexer.ts`)

Full-text search layer using han-native:

- SQLite FTS5 with BM25 scoring
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
      vector-store.ts    # Native embeddings layer (SQLite + ONNX)
      indexer.ts         # FTS indexer (SQLite FTS5 + BM25)
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
    db.rs               # SQLite wrapper (FTS5 + sqlite-vec)
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

## Synthesis Layer (Agent SDK)

The synthesis layer is the "brain" that makes all the data meaningful. Instead of just returning raw results from each layer, it uses the Agent SDK to:

1. **Collect** - Query all memory layers in parallel
2. **Synthesize** - Understand intent and combine relevant information
3. **Stream** - Output reasoning in real-time for user visibility
4. **Cite** - Link every claim to its source in Browse UI

### Architecture

```typescript
import Anthropic from "@anthropic-ai/sdk";

interface SynthesisResult {
  answer: string;
  citations: Array<{
    text: string;
    source: MemoryLayer;
    browseUrl: string;  // Deep link: /sessions/{id}#msg-{idx}
  }>;
  reasoning: string[];  // Streamed thinking steps
}

async function synthesizeMemory(
  question: string,
  onChunk: (text: string) => void  // Streaming callback
): Promise<SynthesisResult> {
  // 1. Race all layers
  const [rules, summaries, observations, transcripts, providers] =
    await Promise.all([
      searchRules(question),
      searchSummaries(question),
      searchObservations(question),
      searchTranscripts(question),
      queryProviders(question),
    ]);

  // 2. Synthesize with Agent SDK
  const client = new Anthropic();
  const stream = client.messages.stream({
    model: "claude-sonnet-4-20250514",
    max_tokens: 4096,
    messages: [{
      role: "user",
      content: buildSynthesisPrompt(question, {
        rules, summaries, observations, transcripts, providers
      })
    }]
  });

  // 3. Stream output for live feedback
  const reasoning: string[] = [];
  for await (const event of stream) {
    if (event.type === "content_block_delta") {
      const text = event.delta.text;
      onChunk(text);  // Send to UI immediately
      reasoning.push(text);
    }
  }

  // 4. Parse citations from response
  const citations = extractCitations(reasoning.join(""));

  return { answer: reasoning.join(""), citations, reasoning };
}
```

### Streaming Output

When invoked from Browse UI or MCP, the user sees Claude's reasoning in real-time:

```
┌─────────────────────────────────────────────────────────────────┐
│  🔍 Searching rules...                                          │
│  📚 Found: api.md mentions rate limiting                        │
│  🔍 Searching transcripts...                                    │
│  💬 Found: Discussion about 429 errors in session abc123        │
│  🔍 Querying git history...                                     │
│  📝 Found: PR #42 added rate limit middleware                   │
│                                                                 │
│  ✨ Synthesizing answer...                                      │
│                                                                 │
│  Based on your project's conventions and history, rate limiting │
│  is handled by the middleware in src/api/rateLimit.ts [1].      │
│  This was added in PR #42 [2] after discussions about 429       │
│  errors [3].                                                    │
│                                                                 │
│  [1] .claude/rules/api.md                                       │
│  [2] github.com/org/repo/pull/42                                │
│  [3] /sessions/abc123#msg-15  ← Click to view in Browse         │
└─────────────────────────────────────────────────────────────────┘
```

### Citation Deep Links

Every citation links directly to the source in Browse UI:

| Source | URL Pattern | Example |
|--------|-------------|---------|
| Rules | `/memory?tab=rules&file={domain}` | `/memory?tab=rules&file=api` |
| Transcripts | `/sessions/{sessionId}#msg-{index}` | `/sessions/abc123#msg-15` |
| Git Commits | `/repos/{repoId}?commit={sha}` | External: GitHub/GitLab |
| PRs | External link | `github.com/org/repo/pull/42` |
| Observations | `/sessions/{sessionId}?view=observations` | `/sessions/abc123?view=observations` |

### Pre-Tool Observations (Layer 3)

Observations capture **intent**, not just action. Instead of logging "Read file X", capture:

```typescript
interface Observation {
  // What Claude was trying to accomplish
  intent: string;  // "Understanding how auth middleware validates tokens"

  // The tool used
  tool: string;    // "Read"
  input: object;   // { file_path: "src/auth/middleware.ts" }

  // Why this became meaningful (post-hoc)
  significance?: string;  // "Led to discovering JWT validation bug"

  timestamp: string;
}
```

This enables richer pattern detection:

- "Authentication investigations often start with middleware.ts"
- "Payment debugging usually involves 3+ file reads before success"

### Native Summaries (Layer 2)

Instead of custom summarization, leverage Claude Code's built-in message summary type:

```typescript
// Claude Code transcript message types
type MessageType = "user" | "assistant" | "summary";

// A summary message in the transcript
{
  type: "summary",
  message: {
    content: "Session focused on refactoring auth module...",
    context_window_compression: true
  },
  timestamp: "2025-01-15T10:30:00Z"
}
```

Benefits:

- No custom summarization logic needed
- Summaries already optimized for context compression
- Consistent with Claude Code's internal model

### Provider Plugin Interface

External memory providers are MCP functions that conform to this interface:

```typescript
interface MemoryProvider {
  name: string;           // "github", "gitlab", "notion"
  query(question: string): Promise<ProviderResult>;
}

interface ProviderResult {
  results: Array<{
    content: string;
    source: string;       // URL or identifier
    author?: string;
    timestamp?: string;
    confidence: number;   // 0-1
  }>;
  metadata: {
    queryTime: number;
    resultCount: number;
  };
}
```

Providers are discovered via installed hashi-* plugins:

- `hashi-github` → GitHub PRs, Issues, Discussions
- `hashi-gitlab` → GitLab MRs, Issues
- `hashi-notion` → Notion pages (future)
- `hashi-confluence` → Confluence docs (future)
