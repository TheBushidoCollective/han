---
status: completed
depends_on: []
branch: ai-dlc/plugin-reorganization/02-move-languages
discipline: devops
---

# unit-02-move-languages

## Description

Move language-specific plugins from `jutsu/` to `languages/` directory. Remove `jutsu-` prefix from plugin names.

## Discipline

devops - File organization and plugin configuration updates

## Success Criteria

- [ ] `jutsu/jutsu-typescript` → `languages/typescript`
- [ ] `jutsu/jutsu-rust` → `languages/rust`
- [ ] All han-plugin.yml files updated with new paths
- [ ] Cross-plugin dependencies updated (if any)
- [ ] No broken imports or references

## Plugins to Move

| Old Path | New Path |
|----------|----------|
| `jutsu/jutsu-typescript` | `languages/typescript` |
| `jutsu/jutsu-rust` | `languages/rust` |

## Implementation Notes

1. Create `languages/` directory
2. Move each plugin directory
3. Rename plugin in han-plugin.yml (remove jutsu- prefix)
4. Update any internal path references
5. Update marketplace.json entry
