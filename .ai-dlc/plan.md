# Implementation Plan: Unit 07 - Shared Memory

## Overview

Extend han memory system for team sessions while respecting privacy boundaries.

## Memory Layer Scoping

| Layer | Team Mode |
|-------|-----------|
| Personal | User's own sessions (always accessible) |
| Project | Sessions in projects user belongs to |
| Team | Sessions visible via repo permissions |
| Org | Aggregated learnings only (no raw data) |

## Implementation Phases

### Phase 1: Permission-Aware Query Interface

1. **`packages/han/lib/memory/team-memory-query.ts`** (new)
   - `queryTeamMemory(params)` with userId and orgId
   - `getPermittedSessionIds(userId, orgId)`

2. **`packages/han/lib/memory/permission-filter.ts`** (new)
   - `filterSearchResultsByPermission(results, userId)`
   - `applySessionIdPreFilter(sessionIds)`

### Phase 2: Session ID Filtering in Search

1. **Modify `packages/han/lib/memory/indexer.ts`**:
   - `searchFtsWithSessionFilter(tableName, query, sessionIds)`
   - `hybridSearchWithSessionFilter()`

2. **`packages/han-native/src/crud.rs`**:
   - `search_messages_with_session_filter(query, session_ids, limit)`

### Phase 3: Team Memory MCP Extension

1. **`packages/han/lib/commands/mcp/dal.ts`**:
   - Add `team_memory_search` tool
   - Add `team_memory_layers` tool

### Phase 4: Privacy-Aware Synthesis

1. **`packages/han/lib/memory/team-memory-agent.ts`** (new)
   - Double-checks permissions on retrieved chunks
   - Source attribution with visibility metadata
   - Privacy guidelines in agent prompt

### Phase 5: Aggregated Org Learnings

1. **`packages/han/lib/memory/org-learnings.ts`** (new)
   - `aggregatePatterns(orgId)`
   - `getOrgConventions(orgId)`

### Phase 6: Caching and Rate Limiting

1. **`packages/han/lib/memory/team-memory-cache.ts`** (new)
   - Cache permitted session IDs (5 min TTL)
   - Cache common queries (1 hour TTL)

2. **`packages/han/lib/memory/rate-limiter.ts`** (new)
   - Per-user rate limits

### Phase 7: Audit Logging

1. **`packages/han/lib/memory/audit-logger.ts`** (new)
   - Log: user, query, sessions accessed
   - PostgreSQL audit table

## GraphQL Schema

```graphql
extend type Query {
  teamMemory(question: String!, scope: MemoryScope): TeamMemoryResult!
  orgLearnings(limit: Int): [OrgLearning!]!
}

enum MemoryScope { PERSONAL, PROJECT, TEAM, ORG }

type TeamMemoryResult {
  answer: String!
  confidence: ConfidenceLevel!
  citations: [TeamCitation!]!
  sessionsSearched: Int!
}

type TeamCitation {
  source: String!
  sessionId: String
  visibility: CitationVisibility!
}
```

## Data Flow

```
Query → Get User → Get Permitted Sessions → Pre-filter
     → Hybrid Search → Double-check Permissions
     → Memory Agent Synthesis → Citations + Visibility
```

## Security

- Defense in depth: checks at API, search, synthesis
- Fail-closed: deny on permission check failure
- Audit trail: all queries logged
- Rate limiting: prevent enumeration
