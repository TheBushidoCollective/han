---
workflow: default
created: 2026-01-30
status: active
---

# Third-Party Plugin Platform

## Problem

Currently, all Han plugins must live in the han repository. This limits ecosystem growth and prevents the community from creating and distributing their own plugins without contributing to the main repo.

## Solution

Enable third-party plugin development by:
1. Adding a `han create plugin` scaffolding command
2. Ensuring the han hook system works with externally-installed plugins
3. Providing comprehensive documentation for plugin authors
4. Creating example plugins as reference implementations

## Success Criteria

- [ ] `han create plugin` command scaffolds a valid plugin structure (jutsu, do, or hashi)
- [ ] Scaffolded plugin passes `claudelint` validation
- [ ] External plugins work with `han hook run` when installed via local path
- [ ] External plugins work with `han hook run` when installed via git URL
- [ ] External plugin hooks appear in han's hook orchestration
- [ ] Documentation explains plugin structure, hooks.json format, and distribution
- [ ] Example third-party plugin repo exists as reference

## Context

- Third-party plugins use standard Claude Code distribution methods (local, git, URL)
- All plugin types supported: jutsu, do, hashi
- No marketplace listing needed initially
- Plugins can use any naming convention
- Full integration with han's hook orchestration system
