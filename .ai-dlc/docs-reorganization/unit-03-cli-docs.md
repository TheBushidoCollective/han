---
status: pending
depends_on: []
branch: ai-dlc/docs-reorganization/03-cli-docs
discipline: documentation
---

# unit-03-cli-docs

## Description

Update CLI documentation to use new plugin names and terminology.

## Discipline

documentation - This unit will be executed by `do-technical-documentation` specialized agents.

## Files

- `content/docs/cli/index.md` - CLI overview
- `content/docs/cli/hooks.md` - Hook commands documentation
- `content/docs/cli/plugins.md` - Plugin management commands
- `content/docs/cli/other.md` - Other CLI commands

## Success Criteria

- [ ] All CLI examples use new plugin names
- [ ] Hook command examples updated
- [ ] Plugin list/install examples use new names
- [ ] No remaining jutsu/do/hashi references

## Notes

Focus on command examples like:
- `han plugin install typescript`
- `han hook run typescript typecheck`
