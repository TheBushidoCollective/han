---
status: pending
depends_on: []
branch: ai-dlc/vcs-strategy-config/01-config-system
discipline: backend
---

# unit-01-config-system

## Description

Implement the `.ai-dlc/settings.yml` configuration system with schema definition, loading logic, and per-intent override support.

## Discipline

backend - This unit involves TypeScript/shell configuration loading and YAML parsing in the jutsu-ai-dlc plugin.

## Success Criteria

- [ ] `.ai-dlc/settings.yml` schema defined with `git:` and `jj:` keys
- [ ] JSON schema created at `jutsu/jutsu-ai-dlc/schemas/settings.schema.json` for editor autocomplete
- [ ] Per-intent override supported via intent.md frontmatter `git:` / `jj:` key
- [ ] Config loading function with precedence: intent → repo → defaults
- [ ] Default values: `change_strategy: unit`, `elaboration_review: true`, `default_branch: auto`

## Notes

- Create `jutsu/jutsu-ai-dlc/lib/config.ts` for TypeScript config loading
- Create `jutsu/jutsu-ai-dlc/lib/config.sh` for shell script config loading (used by dag.sh)
- JSON schema should be referenced in settings.yml via `$schema` comment
- Consider using `yaml` package for parsing (already used elsewhere in han)
