---
status: completed
depends_on: ["01-core-backend", "02-authentication", "04-permissions"]
branch: ai-dlc/han-team-platform/07-shared-memory
---

# unit-07-shared-memory

## Description

Extend the han memory system to work across team sessions while respecting privacy boundaries. Enable asking broad questions that synthesize insights from multiple sessions the user has access to.

## Success Criteria

- [ ] Memory queries scope to user's permitted sessions
- [ ] Cross-session synthesis with source attribution
- [ ] Privacy-aware response generation (no leaking private data)
- [ ] Team-level learnings aggregation
- [ ] Personal vs team memory separation
- [ ] Memory search across org with permission filtering
- [ ] Caching for common queries
- [ ] Rate limiting to prevent abuse

## Technical Notes

### Query Flow
```
memoryQuery(user, question):
  permittedSessions = getPermittedSessions(user)
  relevantChunks = vectorSearch(question, permittedSessions)
  synthesis = llmSynthesize(question, relevantChunks)
  return synthesis with citations
```

### Privacy Enforcement
- Filter session IDs before vector search
- Double-check permissions on retrieved chunks
- Redact any content from non-permitted sessions
- Log queries for audit

### Memory Layers
1. Personal - User's own sessions (always accessible)
2. Project - Sessions in projects user belongs to
3. Team - Sessions visible via repo permissions
4. Org - Aggregated learnings (no raw session data)

### Technical Components
- Extend existing memory MCP server
- Add `teamMemory` query endpoint
- Vector store with session_id metadata
- Permission filter as vector search pre-filter
