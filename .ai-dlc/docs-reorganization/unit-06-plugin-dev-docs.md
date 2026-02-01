---
status: completed
depends_on: []
branch: ai-dlc/docs-reorganization/06-plugin-dev-docs
discipline: documentation
---

# unit-06-plugin-dev-docs

## Description

Update plugin development documentation to reflect new category structure and naming conventions.

## Discipline

documentation - This unit will be executed by `do-technical-documentation` specialized agents.

## Files

- `content/docs/plugin-development/index.md` - Plugin development overview
- `content/docs/plugin-development/types.md` - Plugin types documentation
- `content/docs/plugin-development/hooks.md` - Hook development guide
- `content/docs/plugin-development/skills.md` - Skill development guide
- `content/docs/plugin-development/testing.md` - Plugin testing guide
- `content/docs/plugin-development/distribution.md` - Distribution guide

## Success Criteria

- [x] types.md rewritten to explain new category structure:
  - No more jutsu/do/hashi terminology
  - Explain 9 tech layer categories
  - Update directory structure examples
- [x] All example plugin names updated
- [x] Hook development examples use new names
- [x] Distribution guide uses new marketplace categories
- [x] No remaining jutsu/do/hashi references

## Notes

The types.md page is particularly important - it defines what each plugin category means for developers creating new plugins. Update the directory structure examples:

```
languages/typescript/
frameworks/react/
validation/biome/
tools/docker/
services/github/
disciplines/frontend/
patterns/ai-dlc/
specialized/blockchain/
```
