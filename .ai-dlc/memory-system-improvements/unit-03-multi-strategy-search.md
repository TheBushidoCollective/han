---
status: pending
depends_on: [unit-02-query-expansion]
branch: ai-dlc/memory-system-improvements/03-multi-strategy-search
discipline: backend
---

# unit-03-multi-strategy-search

## Description

Make the memory agent try multiple search strategies before returning low confidence.

## Discipline

backend - This unit modifies the memory agent and DAL search logic.

## Success Criteria

- [ ] Agent tries at least 3 strategies before returning low confidence
- [ ] Strategies: direct FTS, expanded FTS, semantic search, session summaries
- [ ] Parallel execution where strategies are independent
- [ ] Results merged with Reciprocal Rank Fusion or similar
- [ ] Deduplication of results across strategies
- [ ] Timeout per strategy (don't wait forever for slow vector search)
- [ ] Confidence score increases with each successful strategy that returns results

## Notes

- Modify `memory-agent.ts` to instruct agent about multi-strategy approach
- Or implement strategy orchestration in dal.ts `memory_search_hybrid`
- Consider: should agent decide strategies or should it be automatic?
- Automatic is faster but less flexible
- Agent-driven allows reasoning about which strategies to try
