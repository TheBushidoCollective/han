---
status: completed
depends_on: []
branch: ai-dlc/plugin-reorganization/04-move-validation
discipline: devops
---

# unit-04-move-validation

## Description

Move code quality and validation plugins from `jutsu/` to `validation/` directory.

## Discipline

devops - File organization and plugin configuration updates

## Success Criteria

- [ ] `jutsu/jutsu-biome` → `validation/biome`
- [ ] `jutsu/jutsu-markdown` → `validation/markdown`
- [ ] `jutsu/jutsu-shellcheck` → `validation/shellcheck`
- [ ] All han-plugin.yml files updated
- [ ] Hook references still work

## Plugins to Move

| Old Path | New Path |
|----------|----------|
| `jutsu/jutsu-biome` | `validation/biome` |
| `jutsu/jutsu-markdown` | `validation/markdown` |
| `jutsu/jutsu-shellcheck` | `validation/shellcheck` |

## Implementation Notes

These plugins define validation hooks (lint, format, typecheck). Ensure hook orchestration still finds them after move.
