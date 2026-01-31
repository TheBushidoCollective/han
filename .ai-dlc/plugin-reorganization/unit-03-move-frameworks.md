---
status: completed
depends_on: []
branch: ai-dlc/plugin-reorganization/03-move-frameworks
discipline: devops
---

# unit-03-move-frameworks

## Description

Move framework-specific plugins from `jutsu/` to `frameworks/` directory. Remove `jutsu-` prefix.

## Discipline

devops - File organization and plugin configuration updates

## Success Criteria

- [ ] `jutsu/jutsu-relay` → `frameworks/relay`
- [ ] `jutsu/jutsu-gluestack` → `frameworks/gluestack`
- [ ] `jutsu/jutsu-ink` → `frameworks/ink` (if exists)
- [ ] All han-plugin.yml files updated
- [ ] Cross-plugin dependencies updated

## Plugins to Move

| Old Path | New Path |
|----------|----------|
| `jutsu/jutsu-relay` | `frameworks/relay` |
| `jutsu/jutsu-gluestack` | `frameworks/gluestack` |

## Implementation Notes

1. Create `frameworks/` directory
2. Move each plugin directory
3. Update han-plugin.yml name field
4. Update marketplace.json entries
