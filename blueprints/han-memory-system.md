---
name: han-memory-system
summary: Complete architecture and implementation plan for Han Memory - team-shared semantic memory with personal session continuity
---

# Han Memory System

A three-layer memory system that provides personal session continuity, team knowledge research, and permanent wisdom - all with zero setup, research-until-confident accuracy, and citation-backed answers.

## Vision

> **The best setup is no setup.**
> **The best sync is no sync.**
> **Just ask questions, get answers.**

Han Memory solves everything Claude Mem does AND more:

- Personal session continuity ("continue where I left off")
- Team knowledge ("who knows about payments?")
- Decision archaeology ("why did we choose X?")
- Permanent conventions (`.claude/rules/`)

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│  LAYER 3: Permanent Wisdom (.claude/rules/)                     │
│  ─────────────────────────────────────────                      │
│  Git-tracked, team-reviewed conventions                         │
│  Always loaded, highest authority                               │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 2: Team Memory (authoritative sources)                   │
│  ─────────────────────────────────────────                      │
│  Git commits, PRs, Issues, Reviews                              │
│  Researched on-demand, cached in LanceDB                        │
│  "Who knows X?" → Research until confident                      │
├─────────────────────────────────────────────────────────────────┤
│  LAYER 1: Personal Memory (local sessions)                      │
│  ─────────────────────────────────────────                      │
│  Session capture, AI summaries, continuity                      │
│  "What was I working on?" → Check recent sessions               │
└─────────────────────────────────────────────────────────────────┘
```

## Storage Layout

All derived memory data lives in Claude's data directory (near transcripts), NOT in the project repo.

```
~/.claude/
  han/
    memory/
      personal/
        sessions/
          {date}-{session_id}.jsonl    # Raw observations (append-only)
        summaries/
          {date}-{session_id}.yaml     # AI-compressed summaries
        .index/                         # Personal LanceDB index
      
      projects/
        github.com_org_repo/            # Denormalized git remote path
          .index/                       # Team memory LanceDB index
          meta.yaml                     # Index metadata, source cursors
        gitlab.com_team_project/
          .index/
          meta.yaml
          
  projects/                             # Claude Code's existing structure
    {project-hash}/
      transcripts/                      # Where Claude already stores transcripts
      
.claude/                                # In project repo (git-tracked)
  rules/                                # Permanent wisdom ONLY
    api.md
    testing.md
```

### Why This Structure?

| Location | What | Why |
|----------|------|-----|
| `~/.claude/han/memory/personal/` | Session observations | Personal, not project-specific |
| `~/.claude/han/memory/projects/{repo}/` | Team index | Derived from git/PRs, rebuilt anytime |
| `.claude/rules/` | Permanent wisdom | Team-reviewed, git-tracked, authoritative |

### Denormalized Project Path

Convert git remote URL to filesystem-safe path:

```typescript
function getProjectMemoryPath(gitRemote: string): string {
  // git@github.com:org/repo.git → github.com_org_repo
  // https://github.com/org/repo → github.com_org_repo
  
  const normalized = gitRemote
    .replace(/^(git@|https?:\/\/)/, '')
    .replace(/\.git$/, '')
    .replace(/[/:]/g, '_');
    
  return path.join(
    os.homedir(),
    '.claude',
    'han',
    'memory',
    'projects',
    normalized
  );
}
```

### Benefits

1. **Project repo stays clean** - Only `.claude/rules/` is tracked
2. **Near transcripts** - All Claude data in one place (`~/.claude/`)
3. **Portable** - Index rebuilds from sources, no need to copy
4. **Multi-worktree safe** - Same index regardless of worktree location
5. **Cross-clone consistent** - Same remote = same memory path

## Core Principles

### 1. Lazy Evaluation (YAGNIUYNI)

Index builds on-demand when queries need it:

- First query for a topic → research and index
- Subsequent queries → use cached index
- No upfront `sync` command required

### 2. Research Until Confident

Uncertainty triggers deeper research, not early "I don't know":

- Level 1: Quick scan (keywords)
- Level 2: Read actual content (diffs, PRs)
- Level 3: Follow leads (linked issues, referenced docs)
- Only admit "don't know" after exhausting sources

### 3. Always Cite Sources

Every claim backed by evidence:

- "Alice designed the payment system [PR #234]"
- Include excerpts from source material
- State confidence level and caveats

### 4. Zero Setup

No daemons, no ports, no npm install dance:

- LanceDB is pure WebAssembly
- Hooks capture data automatically
- Index builds lazily when needed

## Implementation Phases

### Phase 1: Foundation

**Goal:** Core storage and basic personal memory

#### 1.1 Storage Layer

```typescript
// packages/han/lib/memory/storage.ts

import * as lancedb from "@lancedb/lancedb";
import { homedir } from "os";
import { join } from "path";

const HAN_MEMORY_ROOT = join(homedir(), ".claude", "han", "memory");

interface MemoryStore {
  // Paths
  getPersonalPath(): string;
  getProjectPath(gitRemote: string): string;
  
  // Personal
  appendObservation(session: string, obs: RawObservation): Promise<void>;
  getSessionObservations(session: string): Promise<RawObservation[]>;
  storeSessionSummary(session: string, summary: SessionSummary): Promise<void>;
  getRecentSessions(limit: number): Promise<SessionSummary[]>;
  
  // Team (index)
  indexObservations(project: string, observations: IndexedObservation[]): Promise<void>;
  search(project: string, query: string, filters?: SearchFilters): Promise<SearchResult[]>;
  
  // Metadata
  getIndexMetadata(project: string): Promise<IndexMetadata>;
  updateIndexMetadata(project: string, meta: Partial<IndexMetadata>): Promise<void>;
}

function createMemoryStore(): MemoryStore {
  return {
    getPersonalPath() {
      return join(HAN_MEMORY_ROOT, "personal");
    },
    
    getProjectPath(gitRemote: string) {
      const normalized = normalizeGitRemote(gitRemote);
      return join(HAN_MEMORY_ROOT, "projects", normalized);
    },
    
    // ... implementations
  };
}
```

#### 1.2 Observation Schema

```typescript
interface RawObservation {
  id: string;
  session_id: string;
  timestamp: number;
  tool: string;
  input_summary: string;
  output_summary: string;
  files_read: string[];
  files_modified: string[];
}

interface SessionSummary {
  session_id: string;
  project: string;
  started_at: number;
  ended_at: number;
  summary: string;
  work_items: WorkItem[];
  in_progress: string[];
  decisions: Decision[];
}

interface IndexedObservation {
  id: string;
  source: string;           // "git:commit:abc" | "github:pr:123"
  type: ObservationType;
  timestamp: number;
  author: string;
  summary: string;
  detail: string;
  files: string[];
  patterns: string[];
  embedding: number[];
}
```

#### 1.3 Session Capture Hook

```typescript
// core/hooks/memory-capture.ts (PostToolUse)

async function captureToolUse(event: ToolUseEvent): Promise<HookResult> {
  const observation: RawObservation = {
    id: generateId(),
    session_id: event.session_id,
    timestamp: Date.now(),
    tool: event.tool_name,
    input_summary: quickSummarize(event.tool_input, 200),
    output_summary: quickSummarize(event.tool_result, 500),
    files_read: extractFilesRead(event),
    files_modified: extractFilesModified(event),
  };
  
  await storage.appendObservation(event.session_id, observation);
  
  return { continue: true };
}
```

#### 1.4 Session Summary Hook

```typescript
// core/hooks/memory-summarize.ts (Stop)

async function summarizeSession(event: StopEvent): Promise<HookResult> {
  const observations = await storage.getSessionObservations(event.session_id);
  
  if (observations.length === 0) {
    return { continue: true };
  }
  
  // AI summarization (batch at end, not real-time)
  const summary = await aiSummarizeSession(observations);
  
  await storage.storeSessionSummary(event.session_id, summary);
  
  return { continue: true };
}
```

### Phase 2: Personal Memory

**Goal:** Session continuity and "what was I working on?"

#### 2.1 Context Injection

```typescript
// core/hooks/memory-context.ts (SessionStart)

async function injectContext(event: SessionStartEvent): Promise<HookResult> {
  const context: string[] = [];
  
  // Recent sessions
  const recent = await storage.getRecentSessions(5);
  if (recent.length > 0) {
    context.push(formatRecentSessions(recent));
  }
  
  // In-progress work
  const inProgress = recent.flatMap(s => s.in_progress);
  if (inProgress.length > 0) {
    context.push(formatInProgress(inProgress));
  }
  
  return {
    continue: true,
    additionalContext: context.join('\n\n'),
  };
}
```

#### 2.2 Personal Query MCP Tool

```typescript
// MCP Tool: memory_personal

interface MemoryPersonalParams {
  query: "recent" | "continue" | "search";
  search_text?: string;
  limit?: number;
}

async function memoryPersonal(params: MemoryPersonalParams) {
  switch (params.query) {
    case "recent":
      return formatRecentSessions(await storage.getRecentSessions(params.limit || 5));
      
    case "continue":
      const recent = await storage.getRecentSessions(1);
      if (recent.length === 0) return "No recent sessions found.";
      return formatContinuationContext(recent[0]);
      
    case "search":
      return searchPersonalMemory(params.search_text, params.limit);
  }
}
```

### Phase 3: Team Memory

**Goal:** Research-based team knowledge from authoritative sources

#### 3.1 Source Providers

Each provider extracts observations from a source:

```typescript
// packages/han/lib/memory/providers/git.ts

interface MemoryProvider {
  name: string;
  isAvailable(): Promise<boolean>;
  extract(options: ExtractOptions): Promise<ExtractedObservation[]>;
  enrich?(observations: ExtractedObservation[]): Promise<ExtractedObservation[]>;
}

const gitProvider: MemoryProvider = {
  name: "git",
  
  async isAvailable() {
    return existsSync(".git");
  },
  
  async extract(options) {
    const commits = await getCommits(options.since);
    const observations: ExtractedObservation[] = [];
    
    for (const commit of commits) {
      const diff = await getCommitDiff(commit.sha);
      observations.push({
        source: `git:commit:${commit.sha}`,
        type: inferType(commit, diff),
        timestamp: commit.timestamp,
        author: commit.author,
        summary: commit.message,
        detail: await aiSummarizeDiff(diff),  // AI only when extracting
        files: diff.files,
      });
    }
    
    return observations;
  },
};
```

```typescript
// packages/han/lib/memory/providers/github.ts

const githubProvider: MemoryProvider = {
  name: "github",
  
  async isAvailable() {
    // Check if hashi-github MCP is available
    return await mcpToolAvailable("github", "list_pull_requests");
  },
  
  async extract(options) {
    const prs = await mcp.call("list_pull_requests", { state: "all", since: options.since });
    const observations: ExtractedObservation[] = [];
    
    for (const pr of prs) {
      observations.push({
        source: `github:pr:${pr.number}`,
        type: "decision",
        timestamp: pr.merged_at || pr.created_at,
        author: pr.author,
        summary: pr.title,
        detail: pr.body,
        files: pr.files,
      });
      
      // Also extract review comments
      const reviews = await mcp.call("get_pr_reviews", { pr: pr.number });
      for (const review of reviews) {
        observations.push({
          source: `github:review:${pr.number}:${review.id}`,
          type: "discussion",
          timestamp: review.submitted_at,
          author: review.author,
          summary: `Review on PR #${pr.number}`,
          detail: review.body,
          files: review.files_commented,
        });
      }
    }
    
    return observations;
  },
  
  // Enrich git commits with PR context
  async enrich(observations) {
    for (const obs of observations) {
      if (obs.source.startsWith("git:commit:")) {
        const sha = obs.source.split(":")[2];
        const pr = await findPRForCommit(sha);
        if (pr) {
          obs.pr_context = {
            number: pr.number,
            title: pr.title,
            description: pr.body,
          };
        }
      }
    }
    return observations;
  },
};
```

#### 3.2 Research Engine

```typescript
// packages/han/lib/memory/research.ts

interface ResearchResult {
  answer: string;
  confidence: "high" | "medium" | "low";
  citations: Citation[];
  caveats: string[];
}

async function research(question: string): Promise<ResearchResult> {
  const leads: Lead[] = [{ type: "initial", query: question }];
  const explored = new Set<string>();
  const evidence: Evidence[] = [];
  
  while (leads.length > 0) {
    const lead = leads.shift()!;
    if (explored.has(lead.id)) continue;
    explored.add(lead.id);
    
    // Investigate this lead
    const findings = await investigateLead(lead);
    evidence.push(...findings.evidence);
    
    // Check if we can answer confidently
    const assessment = assessConfidence(question, evidence);
    if (assessment.confident) {
      return formatAnswer(question, evidence, assessment);
    }
    
    // Add new leads discovered
    leads.push(...findings.newLeads);
  }
  
  // Exhausted all leads
  return {
    answer: "I researched thoroughly but couldn't find a definitive answer.",
    confidence: "low",
    citations: evidence.map(e => e.citation),
    caveats: ["Searched: " + Array.from(explored).join(", ")],
  };
}

async function investigateLead(lead: Lead): Promise<InvestigationResult> {
  switch (lead.type) {
    case "initial":
      // Start with quick scan
      return quickScan(lead.query);
      
    case "commit":
      // Read actual commit content
      return investigateCommit(lead.sha);
      
    case "pr":
      // Read PR description, reviews, linked issues
      return investigatePR(lead.number);
      
    case "file":
      // Read file, check git blame
      return investigateFile(lead.path);
      
    case "reference":
      // Follow a reference (e.g., "See RFC-12")
      return investigateReference(lead.ref);
  }
}
```

#### 3.3 Team Query MCP Tool

```typescript
// MCP Tool: memory_team

interface MemoryTeamParams {
  question: string;
  // Optional hints to narrow search
  timeframe?: string;      // "last week", "last month", "2024-Q4"
  authors?: string[];
  types?: ObservationType[];
  files?: string[];        // Glob patterns
}

async function memoryTeam(params: MemoryTeamParams): Promise<string> {
  const gitRemote = await getGitRemote();
  const projectPath = storage.getProjectPath(gitRemote);
  
  // Ensure index is fresh enough
  await ensureIndexFresh(projectPath, params);
  
  // Research until confident
  const result = await research(params.question);
  
  // Format with citations
  return formatResearchResult(result);
}

async function ensureIndexFresh(projectPath: string, params: MemoryTeamParams) {
  const meta = await storage.getIndexMetadata(projectPath);
  const staleThreshold = Date.now() - (60 * 60 * 1000); // 1 hour
  
  // Check what sources need updating
  const providers = await getAvailableProviders();
  const staleProviders = providers.filter(p => {
    const lastIndexed = meta.sources[p.name]?.indexed_at || 0;
    return lastIndexed < staleThreshold;
  });
  
  if (staleProviders.length > 0) {
    // Extract and index
    for (const provider of staleProviders) {
      const observations = await provider.extract({ since: meta.sources[provider.name]?.last_item });
      await storage.indexObservations(projectPath, observations);
      await storage.updateIndexMetadata(projectPath, {
        sources: {
          [provider.name]: {
            indexed_at: Date.now(),
            last_item: observations[observations.length - 1]?.timestamp,
          },
        },
      });
    }
  }
}
```

### Phase 4: Query Router

**Goal:** Single entry point that routes to the right layer

```typescript
// MCP Tool: memory (unified)

interface MemoryParams {
  question: string;
}

async function memory(params: MemoryParams): Promise<string> {
  const classification = classifyQuestion(params.question);
  
  switch (classification.type) {
    case "personal_recent":
      // "What was I working on?"
      return memoryPersonal({ query: "recent" });
      
    case "personal_continue":
      // "Continue where I left off"
      return memoryPersonal({ query: "continue" });
      
    case "team_expertise":
      // "Who knows about X?"
      return memoryTeam({ question: params.question });
      
    case "team_temporal":
      // "What did we do last week?"
      return memoryTeam({ 
        question: params.question,
        timeframe: extractTimeframe(params.question),
      });
      
    case "team_decisions":
      // "What decisions did we make about X?"
      return memoryTeam({
        question: params.question,
        types: ["decision"],
      });
      
    case "conventions":
      // "How do we handle X?" - check rules first
      const rules = await checkRules(params.question);
      if (rules) return rules;
      return memoryTeam({ question: params.question });
      
    default:
      // Research broadly
      return memoryTeam({ question: params.question });
  }
}

function classifyQuestion(question: string): Classification {
  const q = question.toLowerCase();
  
  if (q.includes("i was") || q.includes("what was i")) {
    return { type: "personal_recent" };
  }
  if (q.includes("continue") || q.includes("pick up") || q.includes("left off")) {
    return { type: "personal_continue" };
  }
  if (q.includes("who knows") || q.includes("who worked on") || q.includes("expert")) {
    return { type: "team_expertise" };
  }
  if (q.includes("last week") || q.includes("last month") || q.includes("recently")) {
    return { type: "team_temporal" };
  }
  if (q.includes("decision") || q.includes("why did we") || q.includes("chose")) {
    return { type: "team_decisions" };
  }
  if (q.includes("convention") || q.includes("how do we") || q.includes("should we")) {
    return { type: "conventions" };
  }
  
  return { type: "general" };
}
```

### Phase 5: Embeddings

**Goal:** Semantic search with local embedding generation

```typescript
// packages/han/lib/memory/embeddings.ts

import { pipeline } from "@xenova/transformers";

let embedder: Pipeline | null = null;

async function getEmbedder() {
  if (!embedder) {
    // Downloads model on first use (~30MB)
    embedder = await pipeline(
      "feature-extraction",
      "Xenova/all-MiniLM-L6-v2"
    );
  }
  return embedder;
}

async function embed(text: string): Promise<number[]> {
  const embedder = await getEmbedder();
  const result = await embedder(text, {
    pooling: "mean",
    normalize: true,
  });
  return Array.from(result.data);
}

async function embedBatch(texts: string[]): Promise<number[][]> {
  const embedder = await getEmbedder();
  const results = await Promise.all(
    texts.map(text => embedder(text, { pooling: "mean", normalize: true }))
  );
  return results.map(r => Array.from(r.data));
}
```

### Phase 6: Promotion Path

**Goal:** High-confidence patterns → `.claude/rules/`

```typescript
// packages/han/lib/memory/promotion.ts

interface PromotionCandidate {
  pattern: string;
  confidence: number;
  evidence: Citation[];
  suggested_domain: string;
  suggested_content: string;
}

async function identifyPromotionCandidates(): Promise<PromotionCandidate[]> {
  // Find patterns that appear multiple times with high confidence
  const patterns = await findRecurringPatterns();
  
  return patterns
    .filter(p => p.occurrences >= 3 && p.confidence >= 0.8)
    .map(p => ({
      pattern: p.description,
      confidence: p.confidence,
      evidence: p.citations,
      suggested_domain: inferDomain(p),
      suggested_content: formatAsRule(p),
    }));
}

// MCP Tool: memory_promote
async function memoryPromote() {
  const candidates = await identifyPromotionCandidates();
  
  if (candidates.length === 0) {
    return "No patterns ready for promotion yet.";
  }
  
  return formatPromotionSuggestions(candidates);
}
```

## MCP Tools Summary

| Tool | Purpose | Layer |
|------|---------|-------|
| `memory` | Unified query (auto-routes) | All |
| `memory_personal` | Recent sessions, continuity | Personal |
| `memory_team` | Team knowledge research | Team |
| `memory_promote` | Suggest patterns for rules | Promotion |

## Hooks Summary

| Hook | Event | Purpose |
|------|-------|---------|
| `memory-capture` | PostToolUse | Capture tool observations |
| `memory-summarize` | Stop | AI summarize session |
| `memory-context` | SessionStart | Inject continuity context |

## Plugin Structure

```
core/
  hooks/
    hooks.json           # Hook definitions
    memory-capture.md    # PostToolUse capture
    memory-summarize.md  # Stop summarization  
    memory-context.md    # SessionStart injection
    
packages/han/
  lib/
    memory/
      storage.ts         # LanceDB storage layer
      paths.ts           # Path resolution (personal, project)
      research.ts        # Research engine
      embeddings.ts      # Local embedding generation
      providers/
        git.ts           # Git source provider
        github.ts        # GitHub source provider
        jira.ts          # Jira source provider
      promotion.ts       # Pattern → rules promotion
      
    commands/mcp/
      memory.ts          # Unified MCP tool
      memory-personal.ts # Personal memory tool
      memory-team.ts     # Team memory tool
      memory-promote.ts  # Promotion tool
```

## Dependencies

```json
{
  "@lancedb/lancedb": "^0.4.0",
  "@xenova/transformers": "^2.17.0"
}
```

Both are pure JS/Wasm - no native bindings, no setup required.

## Success Criteria

1. **Zero setup**: `memory "who knows about auth?"` works immediately
2. **Personal continuity**: "Continue where I left off" restores context
3. **Team knowledge**: "Who knows about X?" returns cited answer
4. **Research rigor**: Never guesses, always cites sources
5. **No native bindings**: Works on any platform without compilation
6. **Lazy indexing**: Only indexes what's needed, when needed
7. **Clean project repos**: Only `.claude/rules/` tracked, all indexes in `~/.claude/han/`

## Future Enhancements

- Transcript learning (opt-in, extract from conversation history)
- Cross-project memory (patterns across repositories)
- Team analytics ("most active areas this sprint")
- Memory decay (compact old observations)
- Conflict detection ("Alice and Bob have different approaches to X")
