---
status: pending
depends_on: []
branch: ai-dlc/memory-system-improvements/04-transparent-failures
discipline: backend
---

# unit-04-transparent-failures

## Description

Make the memory system report what was searched and what failed, instead of vague "I don't have access" messages.

## Discipline

backend - This unit modifies search result formatting and agent prompts.

## Success Criteria

- [ ] Search results include metadata: layers_searched, total_results, query_used
- [ ] Empty results return structured explanation: "Searched messages in 147 sessions, 0 matches"
- [ ] Agent prompt instructs to report search stats, not claim lack of access
- [ ] Suggestions for refining query when results are empty
- [ ] Layer availability reported: "transcripts: available, team: not indexed, rules: 23 files"
- [ ] Never output "I don't have access" when data exists but search returned empty

## Notes

- Modify DAL search functions to return metadata alongside results
- Update memory agent system prompt with transparency instructions
- Add `getLayerStats()` function to report what's indexed
- Consider: should we always show stats or only on low confidence?
