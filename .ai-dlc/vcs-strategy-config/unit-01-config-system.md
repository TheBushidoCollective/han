---
status: completed
depends_on: []
branch: ai-dlc/vcs-strategy-config/01-config-system
discipline: backend
---

# unit-01-config-system

## Description

Implement the `.ai-dlc/settings.yml` configuration system with schema definition, loading logic, and per-intent override support.

## Discipline

backend - This unit involves TypeScript/shell configuration loading and YAML parsing in the ai-dlc plugin.

## Success Criteria

- [x] `.ai-dlc/settings.yml` schema defined with `git:` and `jj:` keys
- [x] JSON schema created at `patterns/ai-dlc/schemas/settings.schema.json` for editor autocomplete
- [x] Per-intent override supported via intent.md frontmatter `git:` / `jj:` key
- [x] Config loading function with precedence: intent → repo → defaults
- [x] Default values: `change_strategy: unit`, `elaboration_review: true`, `default_branch: auto`

## Notes

- `patterns/ai-dlc/lib/config.ts` - TypeScript config loading with `getMergedSettings()`
- `patterns/ai-dlc/lib/config.sh` - Shell script config loading with `get_ai_dlc_config()`
- JSON schema referenced via `$id` at `https://han.guru/schemas/ai-dlc-settings.schema.json`
- Uses `han parse yaml` for YAML parsing consistency between TypeScript and shell
