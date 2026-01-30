---
status: pending
depends_on: []
branch: ai-dlc/third-party-plugins/01-cli-scaffolding
discipline: backend
---

# unit-01-cli-scaffolding

## Description

Add `han create plugin` command to scaffold new plugin projects with the correct structure, configuration files, and boilerplate code.

## Discipline

backend - This unit involves CLI development using the existing han CLI architecture (Commander.js, Ink).

## Success Criteria

- [ ] `han create plugin` command exists and is documented in help
- [ ] Interactive prompts ask for plugin type (jutsu, do, hashi) and name
- [ ] Scaffolded jutsu plugin has: plugin.json, hooks.json, skills/, commands/
- [ ] Scaffolded do plugin has: plugin.json, agents/ with agent definitions
- [ ] Scaffolded hashi plugin has: plugin.json, mcp server configuration
- [ ] All scaffolded plugins pass `claudelint` validation
- [ ] Generated plugin.json has correct schema and required fields

## Notes

- Use Ink for interactive CLI experience (consistent with existing han UX)
- Plugin structure must match what claudelint expects
- Consider adding `--type` and `--name` flags for non-interactive use
- Reference existing plugin structures in jutsu/, do/, hashi/ directories
