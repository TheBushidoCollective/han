---
status: completed
depends_on: [unit-01-session-summaries, unit-03-multi-strategy-search]
branch: ai-dlc/memory-system-improvements/05-fallback-mechanisms
discipline: backend
---

# unit-05-fallback-mechanisms

## Description

Add fallback mechanisms when primary search strategies return empty results.

## Discipline

backend - This unit adds fallback logic and direct database access.

## Success Criteria

- [ ] Direct database query fallback when MCP tools return empty
- [ ] Recent sessions scan: check last N sessions for temporal queries ("what was I working on")
- [ ] Transcript grep fallback: search raw JSONL files if FTS fails
- [ ] Clarification prompts for ambiguous queries
- [ ] Fallback chain: FTS → semantic → summaries → recent → grep → clarify
- [ ] Hybrid search used by default, not as last resort

## Notes

- Fallbacks should be invisible to user unless all fail
- Consider adding `memory_grep_transcripts` tool for raw search
- Recent sessions scan could use file modification time
- Clarification should be rare - most queries should be answerable
- Fallback performance matters - grep is slow on large transcript dirs
