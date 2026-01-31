---
status: pending
depends_on: []
branch: ai-dlc/plugin-reorganization/06-move-services
discipline: devops
---

# unit-06-move-services

## Description

Move external service integration plugins from `hashi/` to `services/` directory. Remove `hashi-` prefix.

## Discipline

devops - File organization and plugin configuration updates

## Success Criteria

- [ ] `hashi/hashi-blueprints` → `services/blueprints`
- [ ] `hashi/hashi-reddit` → `services/reddit`
- [ ] All MCP server configurations updated
- [ ] han-plugin.yml files updated with new paths

## Plugins to Move

| Old Path | New Path |
|----------|----------|
| `hashi/hashi-blueprints` | `services/blueprints` |
| `hashi/hashi-reddit` | `services/reddit` |

## Implementation Notes

These plugins define MCP servers. Ensure:
1. MCP server command paths are updated
2. Any cross-references to core plugin wrapper are updated
3. Claude Code settings examples in docs are updated
