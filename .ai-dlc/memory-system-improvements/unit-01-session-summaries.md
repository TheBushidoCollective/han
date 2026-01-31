---
status: completed
depends_on: []
branch: ai-dlc/memory-system-improvements/01-session-summaries
discipline: backend
---

# unit-01-session-summaries

## Description

Implement session-level summary generation and indexing, enabling "which session discussed X" queries.

## Discipline

backend - This unit involves Rust indexer modifications and database schema changes.

## Success Criteria

- [ ] `session_summaries` table created with FTS index
- [ ] Summary schema: session_id, topics (array), files_modified, tools_used, outcome, created_at
- [ ] Summary generated after session ends (detect via gap in messages or explicit end)
- [ ] Use LLM to generate summary from session transcript (last N messages)
- [ ] Summaries searchable via `memory_search_fts` with layer="summaries"
- [ ] Backfill command to generate summaries for existing sessions

## Notes

- Consider using Haiku for summary generation (fast, cheap)
- Summary should be 2-3 sentences max
- Topics should be extracted as keywords/tags for better FTS
- Could trigger summary generation in the indexer when session appears complete
- Alternative: generate summary lazily on first query
