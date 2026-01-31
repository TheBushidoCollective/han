---
workflow: default
created: 2026-01-31
status: active
---

# Plugin Reorganization: Branded to Tech Layer Categories

## Problem

Current plugin organization uses branding-based categories (jutsu/do/hashi) that:
- Require knowledge of the theme to understand
- Falsely imply component type (jutsu=hooks, do=agents, hashi=MCP)
- Make discovery non-intuitive ("where's TypeScript support?")
- Add unnecessary prefixes to plugin names (jutsu-typescript vs typescript)

## Solution

Reorganize plugins by tech layer - what they target/enhance:

| Old Structure | New Structure |
|---------------|---------------|
| `jutsu/jutsu-typescript` | `languages/typescript` |
| `jutsu/jutsu-react` | `frameworks/react` |
| `jutsu/jutsu-biome` | `validation/biome` |
| `jutsu/jutsu-bun` | `tools/bun` |
| `jutsu/jutsu-ai-dlc` | `patterns/ai-dlc` |
| `hashi/hashi-github` | `services/github` |
| `do/do-accessibility-engineering` | `disciplines/accessibility` |

Any plugin in any category can have hooks, MCP servers, agents, skills, and commands.

## Success Criteria

- [ ] All plugins moved from `jutsu/`, `do/`, `hashi/` to new category directories
- [ ] Plugin names no longer have prefixes (e.g., `typescript` not `jutsu-typescript`)
- [ ] Alias map in code resolves old names to new paths
- [ ] `han plugin install jutsu-typescript` still works (via alias resolution)
- [ ] Website plugin index reflects new structure and categories
- [ ] Marketplace.json updated with new plugin paths
- [ ] All cross-plugin dependencies updated to new names
- [ ] Existing user installations auto-migrate on next `han` run
- [ ] Minor version bump (backwards compatible)

## Context

### New Category Structure
```
languages/     - Programming language support (typescript, rust, go, elixir)
frameworks/    - Framework support (react, relay, nextjs, gluestack, ink)
validation/    - Code quality tools (biome, markdown, shellcheck)
tools/         - Development tools (bun, npm, yarn, playwright)
services/      - External service integrations (github, reddit, sentry, blueprints)
disciplines/   - Domains of expertise (accessibility, frontend, content, documentation)
patterns/      - Architectural/workflow patterns (ai-dlc, monorepo, atomic-design, git-storytelling)
core/          - Core han functionality (unchanged)
```

### Backwards Compatibility
- Alias resolution in code maps old names to new paths
- Auto-migration updates user installations
- Minor version bump indicates backwards compatible
