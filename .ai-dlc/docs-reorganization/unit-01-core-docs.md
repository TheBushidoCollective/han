---
status: pending
depends_on: []
branch: ai-dlc/docs-reorganization/01-core-docs
discipline: documentation
---

# unit-01-core-docs

## Description

Update the core documentation pages that define the overall plugin structure and onboarding experience. These are the most critical pages and should be updated first as they establish the terminology used throughout.

## Discipline

documentation - This unit will be executed by `do-technical-documentation` specialized agents.

## Files

- `content/docs/index.md` - Main docs landing page
- `content/docs/getting-started.md` - New user onboarding guide
- `content/docs/plugin-categories.md` - **Complete rewrite** for 9-category structure
- `content/docs/integrations.md` - External service integrations

## Success Criteria

- [ ] index.md updated with new category terminology
- [ ] getting-started.md uses new plugin names (typescript, biome, ruff, etc.)
- [ ] plugin-categories.md completely rewritten to explain:
  - Core (essential infrastructure)
  - Languages (programming language support)
  - Frameworks (framework integrations)
  - Validation (linting, formatting, type checking)
  - Tools (build tools, testing frameworks)
  - Services (external API integrations)
  - Disciplines (specialized agents)
  - Patterns (methodologies, workflows)
  - Specialized (niche tools)
- [ ] integrations.md updated with new hashi→services terminology
- [ ] No remaining jutsu/do/hashi references in these files

## Notes

The plugin-categories.md page is the most important - it should serve as the definitive reference for understanding the new category structure. Include examples of plugins in each category.
