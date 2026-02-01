---
status: pending
depends_on: []
branch: ai-dlc/docs-reorganization/02-installation-docs
discipline: documentation
---

# unit-02-installation-docs

## Description

Update installation documentation to use new plugin names and category terminology.

## Discipline

documentation - This unit will be executed by `do-technical-documentation` specialized agents.

## Files

- `content/docs/installation/index.md` - Installation overview
- `content/docs/installation/plugins.md` - Plugin installation guide
- `content/docs/installation/scopes.md` - Installation scopes (user/project/local)

## Success Criteria

- [ ] All installation commands use new plugin names
- [ ] Examples updated from `jutsu-typescript` to `typescript`
- [ ] Scope recommendations updated for new category structure
- [ ] No remaining jutsu/do/hashi references

## Notes

Update the scope recommendations:
- **user** (default): Services plugins, general-purpose tools
- **project**: Validation plugins with hooks
- **local**: Personal preferences not shared with team
