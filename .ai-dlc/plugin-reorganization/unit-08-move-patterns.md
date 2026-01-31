---
status: pending
depends_on: []
branch: ai-dlc/plugin-reorganization/08-move-patterns
discipline: devops
---

# unit-08-move-patterns

## Description

Move workflow/pattern plugins from `jutsu/` to `patterns/` directory.

## Discipline

devops - File organization and plugin configuration updates

## Success Criteria

- [ ] `jutsu/jutsu-ai-dlc` → `patterns/ai-dlc`
- [ ] `jutsu/jutsu-git-storytelling` → `patterns/git-storytelling`
- [ ] All workflow definitions preserved
- [ ] Skills and commands updated

## Plugins to Move

| Old Path | New Path |
|----------|----------|
| `jutsu/jutsu-ai-dlc` | `patterns/ai-dlc` |
| `jutsu/jutsu-git-storytelling` | `patterns/git-storytelling` |

## Implementation Notes

These plugins define development patterns and workflows. The AI-DLC plugin is particularly important - ensure all skill references and workflow state management continues to work.
