---
status: in_progress
depends_on: []
branch: ai-dlc/docs-reorganization/04-config-docs
discipline: documentation
---

# unit-04-config-docs

## Description

Update configuration documentation to use new plugin names and terminology.

## Discipline

documentation - This unit will be executed by `do-technical-documentation` specialized agents.

## Files

- `content/docs/configuration/index.md` - Configuration overview
- `content/docs/configuration/caching.md` - Caching configuration

## Success Criteria

- [ ] han.yml examples use new plugin names
- [ ] Configuration examples updated
- [ ] No remaining jutsu/do/hashi references

## Notes

Update examples like:
```yaml
typescript:
  typecheck:
    enabled: true
```
