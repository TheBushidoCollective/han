---
status: pending
depends_on: []
branch: ai-dlc/third-party-plugins/03-documentation
discipline: documentation
---

# unit-03-documentation

## Description

Create comprehensive documentation for third-party plugin authors, covering plugin structure, configuration, hooks, skills, and distribution methods.

## Discipline

documentation - This unit will be executed by `do-technical-documentation` specialized agents.

## Success Criteria

- [ ] Plugin author guide exists on han.guru website
- [ ] Guide explains plugin.json schema with examples
- [ ] Guide explains hooks.json format and hook types
- [ ] Guide covers skills and commands file format
- [ ] Guide explains how to test plugins locally
- [ ] Guide documents distribution methods (local, git, URL)
- [ ] Examples for each plugin type (jutsu, do, hashi) included

## Notes

- Place documentation in website/content/docs/ or similar
- Include code snippets and complete examples
- Reference the `han create plugin` command for getting started
- Link to claudelint for validation
- Consider a "Quick Start" section for experienced developers
