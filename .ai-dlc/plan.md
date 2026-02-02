# Implementation Plan: Fallback Mechanisms

## Overview

This unit adds fallback mechanisms when primary search strategies return empty results. The goal is to ensure the memory system can always provide some response, even when FTS and vector search fail, by cascading through increasingly "expensive" but reliable search methods.

## Dependencies Already Merged

This branch includes:
- unit-01: Session summaries (searchSummariesNative, generated_session_summaries table)
- unit-02: Query expansion (expandQuery with acronyms/synonyms)
- unit-03: Multi-strategy search (multiStrategySearch with parallel strategies and RRF)
- unit-04: Transparent failures (getLayerStats, SearchMetadata, formatSearchSummary)

## Phase 1: Create Fallback Search Module

**File**: `packages/han/lib/memory/fallback-search.ts`

```typescript
export type FallbackStrategy =
  | "recent_sessions"  // Scan last N sessions by modification time
  | "transcript_grep"  // Raw grep through JSONL files
  | "clarification";   // Ask user for more details

export interface FallbackResult {
  strategy: FallbackStrategy;
  results: SearchResultWithCitation[];
  duration: number;
  success: boolean;
  needsClarification?: boolean;
  clarificationPrompt?: string;
}
```

## Phase 2: Recent Sessions Scan

Implement scanning the N most recently modified sessions for temporal queries:

```typescript
export async function scanRecentSessions(
  query: string,
  options: { limit?: number } = {}
): Promise<SearchResultWithCitation[]> {
  // Use database to get recent sessions ordered by last activity
  // Check generated summaries first (fast)
  // Score based on recency and keyword match
}

function calculateTemporalScore(session: Session, query: string): number {
  // Higher score for more recent sessions
  // Decay: 1.0 for now, 0.5 for 24h ago, 0.25 for 48h ago
  const recencyScore = Math.exp(-hoursAgo / 24);
  // Keyword matching boost
  return recencyScore * keywordBoost;
}
```

## Phase 3: Raw JSONL Grep Fallback

Implement direct grep through JSONL files when FTS fails:

```typescript
export async function grepTranscripts(
  query: string,
  options: { timeout?: number; limit?: number } = {}
): Promise<SearchResultWithCitation[]> {
  // Get all transcript files from findAllTranscriptFiles()
  // Sort by modification time (newest first)
  // Grep through files with timeout
  // Parse JSON entries and check for query match
}
```

## Phase 4: Clarification Prompts

Add clarification logic for ambiguous queries:

```typescript
export function needsClarification(
  query: string,
  searchResult: MultiStrategySearchResult
): { needs: boolean; prompt?: string } {
  // Too vague patterns
  // No results from any strategy
  // Low confidence with few results
}

export function detectTemporalQuery(query: string): boolean {
  // "what was I working on", "recently", "yesterday", "last week"
}
```

## Phase 5: Extend Multi-Strategy Search with Fallbacks

**File**: `packages/han/lib/memory/multi-strategy-search.ts`

Add `multiStrategySearchWithFallbacks()`:

```typescript
export async function multiStrategySearchWithFallbacks(
  options: MultiStrategySearchOptions & { enableFallbacks?: boolean }
): Promise<MultiStrategySearchResult & {
  fallbacksUsed: FallbackStrategy[];
  clarificationPrompt?: string;
}> {
  // Run primary strategies first
  const primaryResult = await multiStrategySearch(searchOptions, searchFns);

  // Only use fallbacks if enabled and primary returned nothing
  if (enableFallbacks && primaryResult.results.length === 0) {
    // Fallback 1: Recent sessions scan (for temporal queries)
    // Fallback 2: Raw grep (slow but thorough)
    // Fallback 3: Clarification
  }
}
```

## Phase 6: Add MCP Tool for Grep Fallback

**File**: `packages/han/lib/commands/mcp/dal.ts`

Add `memory_grep_transcripts` tool:

```typescript
{
  name: "memory_grep_transcripts",
  description:
    "Raw grep search through transcript JSONL files. Use as a last resort " +
    "when FTS returns nothing. Slower but guaranteed to find exact matches.",
  inputSchema: {
    type: "object",
    properties: {
      query: { type: "string" },
      limit: { type: "number" },
      timeout: { type: "number" },
    },
    required: ["query"],
  },
}
```

## Phase 7: Update Memory Agent Prompt

**File**: `packages/han/lib/memory/memory-agent.ts`

Add fallback guidance to system prompt:

```
## Search Strategy

Use this priority order for searching:
1. **memory_search_multi_strategy** - Primary search (FTS + semantic + summaries in parallel)
2. **memory_search_fts** with expansion - If multi-strategy returns few results
3. **memory_grep_transcripts** - Only if FTS returns nothing (slow but thorough)

## Handling Empty Results

If no results found:
1. Try rephrasing the query with synonyms
2. Use grep as final fallback
3. If still nothing, clearly state "I couldn't find information about X" with suggestions

## Temporal Queries

For "what was I working on" type queries:
1. Search generated summaries
2. Check recent session metadata
3. Provide chronological summary of recent activity
```

## Phase 8: Add Tests

**File**: `packages/han/lib/memory/__tests__/fallback-search.test.ts`

- Test recent sessions scan
- Test grep fallback
- Test clarification detection
- Test temporal query detection
- Test fallback chain orchestration

## Files Summary

| Action | File |
|--------|------|
| NEW | `packages/han/lib/memory/fallback-search.ts` |
| NEW | `packages/han/lib/memory/__tests__/fallback-search.test.ts` |
| MODIFY | `packages/han/lib/memory/multi-strategy-search.ts` |
| MODIFY | `packages/han/lib/commands/mcp/dal.ts` |
| MODIFY | `packages/han/lib/memory/memory-agent.ts` |
| MODIFY | `packages/han/lib/memory/index.ts` |

## Success Criteria Checklist

- [ ] Direct database query fallback when MCP tools return empty
- [ ] Recent sessions scan: check last N sessions for temporal queries
- [ ] Transcript grep fallback: search raw JSONL files if FTS fails
- [ ] Clarification prompts for ambiguous queries
- [ ] Fallback chain: FTS → semantic → summaries → recent → grep → clarify
- [ ] Hybrid search used by default, not as last resort
