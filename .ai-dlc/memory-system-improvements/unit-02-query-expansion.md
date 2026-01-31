---
status: completed
depends_on: []
branch: ai-dlc/memory-system-improvements/02-query-expansion
discipline: backend
---

# unit-02-query-expansion

## Description

Implement automatic query expansion to bridge semantic gaps in FTS searches.

## Discipline

backend - This unit involves TypeScript utilities in the memory module.

## Success Criteria

- [ ] `expandQuery()` function that generates related terms
- [ ] Synonym map for common development terms (VCS→version control, auth→authentication, etc.)
- [ ] Acronym expansion (PR→pull request, MR→merge request, CI→continuous integration)
- [ ] Query expansion runs before FTS search in dal.ts
- [ ] Expanded query uses OR logic: `(vcs OR "version control" OR git)`
- [ ] Configurable expansion: none, minimal, full

## Notes

- Start with a static synonym map, can add embeddings later
- Keep expansion focused on development/programming domain
- Consider caching expanded queries
- Expansion should not slow down simple queries significantly
- Could use word embeddings for semantic expansion (overkill for v1)
