---
name: han-memory-system
summary: Memory system with Agent SDK synthesis, multi-strategy search (FTS/Vector/Hybrid), plugin-discovered MCP providers, and read-only Memory Agent for autonomous research
---

# Han Memory System

A memory system that combines multi-strategy search (FTS, vector, hybrid) with Agent SDK-powered synthesis. Memory queries spawn a read-only Memory Agent that autonomously searches across multiple layers and returns synthesized answers with citations.

## Implementation Status

All phases complete. The memory system is production-ready with:

- **Multi-strategy search** - FTS, vector, hybrid, and semantic summaries
- **Memory Agent** - Read-only agent spawned via Agent SDK for autonomous research
- **Plugin-based providers** - MCP servers discovered from installed plugins
- **Data Access Layer** - Unified MCP server exposing search tools
- **Fallback mechanisms** - Recent session scan, raw grep, clarification prompts
- **Query expansion** - Automatic acronym and synonym expansion
- **Citation deep links** - Browse UI integration for source viewing

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│  USER or BROWSE UI                                              │
│  ─────────────────                                              │
│  1. Call memory(question)          (via han MCP tool)           │
│  2. Receive session_id             (for live streaming)         │
│  3. Attach to session              (optional live progress)     │
│  4. Receive answer + citations     (synthesized result)         │
└─────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│  MEMORY AGENT (Claude Agent SDK - READ-ONLY)                    │
│  ─────────────────────────────────────                          │
│  • Spawned via queryMemoryAgent()                               │
│  • Has ONLY MCP tools (no Bash/Read/Write/Glob)                │
│  • Searches memory layers autonomously                          │
│  • Synthesizes findings into answer                             │
│  • Returns structured JSON via outputFormat                     │
│  • Session attachable for live streaming                        │
├─────────────────────────────────────────────────────────────────┤
                    │                           │
                    │ MCP tool calls            │ MCP tool calls
                    ▼                           ▼
┌────────────────────────────────┐   ┌─────────────────────────────┐
│  MEMORY-DAL MCP                │   │  PROVIDER MCPs              │
│  ───────────────               │   │  ──────────────             │
│  Tools (all read-only):        │   │  Discovered from plugins:   │
│  • memory_search_fts           │   │  • blueprints (core)        │
│  • memory_search_vector        │   │  • github (hashi-github)    │
│  • memory_search_hybrid        │   │  • gitlab (hashi-gitlab)    │
│  • memory_search_multi_strategy│   │  • (future providers)       │
│  • memory_search_with_fallbacks│   │                             │
│  • memory_list_layers          │   │  Each plugin defines:       │
│  • memory_scan_recent_sessions │   │  • allowed_tools            │
│  • memory_grep_transcripts     │   │  • system_prompt            │
└────────────────────────────────┘   └─────────────────────────────┘
                    │
                    ▼
┌─────────────────────────────────────────────────────────────────┐
│  DATA LAYER                                                     │
│  ──────────                                                     │
│  ~/.han/han.db (SQLite)                                         │
│  • FTS5 tables with BM25 scoring                                │
│  • sqlite-vec for vector search                                 │
│  • Indexed transcripts, summaries, team memory                  │
│                                                                 │
│  ~/.claude/projects/{id}/sessions/*.jsonl                       │
│  • Raw JSONL for fallback grep                                  │
└─────────────────────────────────────────────────────────────────┘
```

## Memory Agent (Read-Only Agent SDK)

The Memory Agent is a **separate agent** spawned via Claude Agent SDK. It has read-only access to memory search tools and autonomously researches questions.

### Key Characteristics

1. **Tool Restriction** - Only MCP tools are allowed (via `allowedTools` parameter). Bash, Read, Write, Glob are blocked.
2. **Structured Output** - Uses `outputFormat: { type: 'json_schema' }` for consistent responses.
3. **Plugin Discovery** - MCP servers and allowed tools discovered from installed plugins with `memory.allowed_tools`.
4. **Session Attachable** - Returns `session_id` for live streaming of research progress.
5. **Citation Linking** - Returns Browse UI deep links for sources.

### Memory Agent Flow

```typescript
// 1. User calls memory tool
const result = await queryMemoryAgent({
  question: "How do we handle authentication?",
  projectPath: "/path/to/project",
  limit: 10,
  model: 'haiku'
});

// 2. Memory Agent spawned
const agent = query({
  prompt: synthesisPrompt,
  options: {
    model: 'haiku',
    mcpServers: {},  // Inherited from enabled plugins
    allowedTools: [  // Discovered from plugins
      'mcp__memory-dal__memory_search_fts',
      'mcp__memory-dal__memory_search_hybrid',
      'mcp__blueprints__search_blueprints',
      // ... other provider tools
    ],
    outputFormat: { type: 'json_schema', schema: MEMORY_AGENT_OUTPUT_SCHEMA }
  }
});

// 3. Agent searches autonomously
// - Calls memory_search_with_fallbacks
// - Calls search_blueprints (if blueprints plugin enabled)
// - Synthesizes findings

// 4. Returns structured result
{
  sessionId: "mem-1234567890-abc123",
  answer: "Authentication is handled via JWT middleware...",
  confidence: "high",
  citations: [
    { source: "rules:api", excerpt: "...", layer: "rules" },
    { source: "transcript:xyz789:42", excerpt: "...", layer: "transcripts" }
  ],
  searchedLayers: ["rules", "transcripts", "blueprints"],
  success: true
}
```

### MCP Tool Discovery

Memory Agent tools are discovered from plugins with BOTH `mcp` and `memory` keys in `han-plugin.yml`:

```yaml
# Example: core/han-plugin.yml
memory:
  allowed_tools:
    - mcp__memory-dal__memory_search_fts
    - mcp__memory-dal__memory_search_vector
    - mcp__memory-dal__memory_search_hybrid
    - mcp__memory-dal__memory_list_layers
  system_prompt: |
    Search the internal Han memory database for relevant information.
    Use memory_search_with_fallbacks for comprehensive coverage.
```

```yaml
# Example: hashi-github/han-plugin.yml (if it had memory integration)
memory:
  allowed_tools:
    - mcp__github__search_pull_requests
    - mcp__github__search_issues
  system_prompt: |
    Search GitHub for PRs and issues relevant to the query.
```

The `discoverProviders()` function scans all enabled plugins and builds:
- List of allowed MCP tools
- System prompts for tool usage guidance
- MCP server configs (inherited from enabled plugins)

## Data Access Layer MCP

The DAL MCP server (`han mcp memory`) exposes read-only search tools to the Memory Agent.

### Core Search Tools

| Tool | Description | Use Case |
|------|-------------|----------|
| `memory_search_fts` | Full-text search (BM25) | Keyword/phrase matching |
| `memory_search_vector` | Semantic similarity search | Conceptual queries |
| `memory_search_hybrid` | FTS + Vector with RRF | Best balanced results |
| `memory_search_multi_strategy` | **Parallel multi-strategy** | High confidence via fusion |
| `memory_search_with_fallbacks` | **Comprehensive with fallbacks** | Guaranteed coverage |
| `memory_list_layers` | List available layers | Discovery |
| `memory_scan_recent_sessions` | Temporal session scan | "What was I working on?" |
| `memory_grep_transcripts` | Raw JSONL grep | Last resort fallback |

### Search Strategies

**Multi-Strategy Search** runs multiple approaches in parallel and fuses results:

1. **direct_fts** - Exact keyword matching (no expansion)
2. **expanded_fts** - FTS with query expansion (acronyms/synonyms)
3. **semantic** - Vector similarity search
4. **summaries** - Session summaries with topics

Results are fused using **Reciprocal Rank Fusion (RRF)** with k=60.

### Fallback Mechanisms

When primary search returns no results, automatic fallbacks:

1. **Recent Sessions Scan** - Temporal query detection ("what was I working on yesterday")
2. **Raw JSONL Grep** - Slow but thorough file search
3. **Clarification Prompt** - Suggests query refinements if nothing found

### Query Expansion

Automatic expansion bridges semantic gaps:

- **None** - Exact match only
- **Minimal** (default) - Acronyms (PR → pull request, CI → continuous integration)
- **Full** - Acronyms + synonyms (refactor → refactoring, bug → issue)

## Memory Layers

The system searches across 4 layers:

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 1: Rules (.claude/rules/)                                │
│  ────────────────────────────────────                           │
│  • Project conventions, team agreements                         │
│  • Git-tracked, reviewable                                      │
│  • Highest authority layer                                      │
│  • Searched via FTS index                                       │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Summaries (generated via han-native)                  │
│  ────────────────────────────────────────                       │
│  • Generated summaries with topics, outcomes                    │
│  • Files modified, tools used, message counts                   │
│  • Semantic session overview                                    │
│  • Searched via FTS on summary text + topics                    │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 3: Transcripts (JSONL sessions)                          │
│  ────────────────────────────────────────                       │
│  • Full conversation history                                    │
│  • Tool calls, results, reasoning                               │
│  • Indexed via han-native (FTS5)                                │
│  • Fallback: raw JSONL grep                                     │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 4: Team (git commits, PRs)                               │
│  ────────────────────────────────────                           │
│  • Git history indexed to SQLite                                │
│  • External providers via MCP (GitHub, GitLab)                  │
│  • Links commits to discussions                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Storage Architecture

### Single Database: ~/.han/han.db

All indexed data lives in a single SQLite database:

```sql
-- Transcripts (indexed from JSONL)
messages (id, session_id, role, content, tool_name, tool_input, tool_result, ...)
messages_fts (FTS5 virtual table for BM25 search)

-- Generated summaries
generated_summaries (session_id, summary_text, topics, outcome, files_modified, ...)

-- Team memory (git)
team_{remote}_commits (sha, author, message, timestamp, ...)
team_{remote}_commits_fts (FTS5 for commit search)

-- Rules (future - currently file-based)
-- Vector tables (sqlite-vec)
-- ...
```

### JSONL Transcripts

Raw JSONL files remain at:
```
~/.claude/projects/{projectId}/sessions/*.jsonl
```

Used for:
- Fallback grep search
- Source of truth for indexing
- Re-indexing after schema changes

## MCP Server Exposure

Han exposes a **single MCP server** with multiple sub-servers:

```json
// core/.mcp.json
{
  "mcpServers": {
    "han": {
      "command": "npx",
      "args": ["-y", "@thebushidocollective/han", "mcp"]
    }
  }
}
```

The `han mcp` command routes to sub-servers:

```bash
han mcp           # Main MCP (unified memory tool + exposed tools)
han mcp memory    # DAL MCP (search tools for Memory Agent)
```

### Unified Memory Tool

The main MCP exposes a single `memory` tool that spawns the Memory Agent:

```typescript
{
  name: "memory",
  description: "Query memory with auto-routing...",
  inputSchema: {
    properties: {
      question: { type: "string" },
      session_id: { type: "string" }
    }
  }
}
```

This tool:
1. Spawns Memory Agent session
2. Returns session_id immediately
3. Streams progress (optional)
4. Returns synthesized answer with citations

## Plugin-Based Memory Providers

External memory providers are discovered from installed plugins with `memory.allowed_tools`:

```yaml
# hashi-github/han-plugin.yml
mcp_servers:
  github:
    type: http
    url: https://api.githubcopilot.com/mcp

memory:
  allowed_tools:
    - mcp__github__search_pull_requests
    - mcp__github__search_issues
  system_prompt: |
    Search GitHub for PRs and issues relevant to the query.
```

When hashi-github is installed:
- Memory Agent inherits access to GitHub MCP
- `allowed_tools` are added to Memory Agent's tool list
- System prompt guides tool usage

## Citations and Browse UI Integration

Every search result includes Browse UI deep links:

```typescript
interface SearchResultWithCitation {
  id: string;              // "transcript:xyz789:42"
  content: string;         // Relevant excerpt
  score: number;           // Relevance score
  layer: string;           // "transcripts"
  browseUrl?: string;      // "/sessions/xyz789#msg-42"
  metadata: {
    sessionId?: string;
    messageId?: string;
    lineNumber?: number;
    topics?: string[];
    // ... layer-specific metadata
  };
}
```

### URL Patterns

| Source | URL Pattern | Example |
|--------|-------------|---------|
| Transcript | `/sessions/{sessionId}#msg-{id}` | `/sessions/abc123#msg-42` |
| Summary | `/sessions/{sessionId}` | `/sessions/abc123` |
| Rules | `/memory?tab=rules&file={domain}` | `/memory?tab=rules&file=api` |
| Git Commit | `/repos?commit={sha}` | `/repos?commit=a1b2c3d` |
| GitHub PR | External link | `github.com/org/repo/pull/123` |

## File Locations

```
packages/han/lib/
  memory/
    memory-agent.ts           # Memory Agent spawning + structured output
    provider-discovery.ts     # Plugin-based provider discovery
    multi-strategy-search.ts  # Parallel strategy orchestration
    fallback-search.ts        # Recent sessions + grep fallbacks
    query-expansion.ts        # Acronym/synonym expansion
    indexer.ts                # FTS/vector indexing
    transcript-search.ts      # Native module wrappers
    streaming.ts              # Live progress streaming
    types.ts                  # Shared interfaces

  commands/mcp/
    server.ts                 # Main MCP (unified memory tool)
    dal.ts                    # DAL MCP (search tools)
    team-memory.ts            # Team query MCP (legacy)
    auto-learn.ts             # Auto-learn MCP (future)

plugins/core/
  .mcp.json                   # MCP server definition
  han-plugin.yml              # Memory provider config

~/.han/
  han.db                      # Single SQLite database
  onnxruntime/                # Downloaded ONNX Runtime
  models/                     # Embedding models
```

## Usage Examples

### From Main Agent (via MCP tool)

```typescript
// User asks in Claude Code session
"What did we decide about error handling?"

// Claude calls memory tool
await memory({
  question: "What did we decide about error handling?",
  session_id: process.env.CLAUDE_SESSION_ID
});

// Returns:
{
  answer: "Error handling uses a centralized middleware pattern...",
  confidence: "high",
  citations: [
    { source: "rules:api", excerpt: "...", browseUrl: "/memory?tab=rules&file=api" },
    { source: "transcript:abc123:15", excerpt: "...", browseUrl: "/sessions/abc123#msg-15" }
  ],
  searchedLayers: ["rules", "transcripts"]
}
```

### From Browse UI (GraphQL)

```graphql
mutation SearchMemory($question: String!) {
  searchMemory(question: $question) {
    sessionId
    answer
    confidence
    citations {
      source
      excerpt
      browseUrl
    }
  }
}
```

### Direct Tool Calls (Memory Agent only)

The Memory Agent can call DAL tools directly:

```typescript
// Inside Memory Agent session
await memory_search_with_fallbacks({
  query: "authentication middleware",
  layer: "all",
  limit: 10,
  expansion: "minimal"
});

// Returns multi-strategy results with fallbacks
{
  results: [...],
  strategiesAttempted: 4,
  strategiesSucceeded: 3,
  confidence: "high",
  fallbacksUsed: []  // or ["recent_sessions", "grep"] if needed
}
```

## Performance Characteristics

### Search Strategy Timing

| Strategy | Typical Duration | Notes |
|----------|-----------------|-------|
| direct_fts | 5-20ms | BM25 via SQLite FTS5 |
| expanded_fts | 10-30ms | +expansion overhead |
| semantic | 50-200ms | Embedding + vector search |
| summaries | 5-15ms | Smaller corpus, fast FTS |
| recent_sessions | 100-300ms | File scan, fallback only |
| grep | 1-5s | Slow, last resort |

### Memory Agent Overhead

- Agent spawning: ~500ms (SDK initialization)
- Tool calls: 50-300ms per call (strategy dependent)
- Synthesis: 1-3s (LLM generation)
- Total: 2-5s for typical query

### Optimization Strategies

1. **Parallel Execution** - All strategies run concurrently
2. **Early Termination** - 5s timeout per strategy
3. **Smart Fallbacks** - Only trigger when primary strategies fail
4. **Result Caching** - Identical queries within session reuse results
5. **Model Selection** - Haiku for speed, Sonnet for quality

## Future Enhancements

### Planned

1. **Auto-Promotion Engine** - Pattern detection and rule generation
2. **Session Resumption** - Attach to existing Memory Agent sessions
3. **Streaming Progress** - Real-time search progress in Browse UI
4. **Rule Indexing** - Move rules from file-based to database
5. **Vector Search for Transcripts** - Currently FTS-only, add embeddings

### Under Consideration

1. **Provider Ranking** - Score providers by reliability
2. **Query Refinement** - Iterative search with clarification
3. **Cross-Session Learning** - Detect patterns across users
4. **External Sync** - Export/import to Notion, Confluence

## Key Principles

> **The best setup is no setup.**
> **The best sync is no sync.**
> **Just ask questions, get answers.**

The memory system is:

- **Zero-config** - Works out of the box, discovers plugins automatically
- **Read-only** - Memory Agent cannot modify data, only synthesize
- **Observable** - Session streaming shows research process
- **Extensible** - New providers via plugins, not code changes
- **Reliable** - Graceful degradation when providers unavailable
- **Fast** - Parallel search with timeouts, no blocking