---
status: completed
depends_on: []
branch: ai-dlc/plugin-reorganization/05-move-tools
discipline: devops
---

# unit-05-move-tools

## Description

Move development tool plugins from `jutsu/` to `tools/` directory.

## Discipline

devops - File organization and plugin configuration updates

## Success Criteria

- [ ] `jutsu/jutsu-bun` → `tools/bun`
- [ ] `jutsu/jutsu-playwright` → `tools/playwright`
- [ ] `jutsu/jutsu-playwright-bdd` → `tools/playwright-bdd`
- [ ] `jutsu/jutsu-act` → `tools/act`
- [ ] All han-plugin.yml files updated

## Plugins to Move

| Old Path | New Path |
|----------|----------|
| `jutsu/jutsu-bun` | `tools/bun` |
| `jutsu/jutsu-playwright` | `tools/playwright` |
| `jutsu/jutsu-playwright-bdd` | `tools/playwright-bdd` |
| `jutsu/jutsu-act` | `tools/act` |

## Implementation Notes

These plugins provide tooling integrations (test runners, build tools). Hook definitions and commands should be preserved.
