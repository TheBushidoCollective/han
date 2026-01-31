---
status: pending
depends_on: []
branch: ai-dlc/plugin-reorganization/07-move-disciplines
discipline: devops
---

# unit-07-move-disciplines

## Description

Move discipline/expertise plugins from `do/` to `disciplines/` directory. Remove `do-` prefix.

## Discipline

devops - File organization and plugin configuration updates

## Success Criteria

- [ ] `do/do-accessibility-engineering` → `disciplines/accessibility`
- [ ] `do/do-frontend-development` → `disciplines/frontend`
- [ ] `do/do-content-creator` → `disciplines/content`
- [ ] `do/do-technical-documentation` → `disciplines/documentation`
- [ ] `do/do-prompt-engineering` → `disciplines/prompts`
- [ ] `do/do-claude-plugin-development` → `disciplines/plugin-development`
- [ ] All agent definitions preserved
- [ ] Skills and commands updated

## Plugins to Move

| Old Path | New Path |
|----------|----------|
| `do/do-accessibility-engineering` | `disciplines/accessibility` |
| `do/do-frontend-development` | `disciplines/frontend` |
| `do/do-content-creator` | `disciplines/content` |
| `do/do-technical-documentation` | `disciplines/documentation` |
| `do/do-prompt-engineering` | `disciplines/prompts` |
| `do/do-claude-plugin-development` | `disciplines/plugin-development` |

## Implementation Notes

These plugins define specialized agents via Task tool. Agent type names in system prompts may need updating to match new plugin names.
