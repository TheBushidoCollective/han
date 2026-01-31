---
workflow: default
created: 2026-01-30
completed: 2026-01-30
status: complete
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

- [x] `han create plugin` command scaffolds a valid plugin structure (jutsu, do, or hashi)
- [x] Scaffolded plugin passes `claudelint` validation
- [x] External plugins work with `han hook run` when installed via local path
- [x] External plugins work with `han hook run` when installed via git URL
- [x] External plugin hooks appear in han's hook orchestration
- [x] Documentation explains plugin structure, hooks.json format, and distribution
- [x] Example third-party plugin repo exists as reference

## Context

- Third-party plugins use standard Claude Code distribution methods (local, git, URL)
- All plugin types supported: jutsu, do, hashi
- No marketplace listing needed initially
- Plugins can use any naming convention
- Full integration with han's hook orchestration system
