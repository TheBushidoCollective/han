# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.6.0] - 2025-12-14

### Added

- add legacy-code-safety skill and hook ([05e0d6ad](../../commit/05e0d6ad))
- add SubagentStart and SubagentStop hooks to all plugins ([a8925a99](../../commit/a8925a99))
- make memory-learning hook explicitly autonomous ([e1260fb6](../../commit/e1260fb6))

### Fixed

- harden no-excuses rule to prevent categorizing failures ([9d29eb7b](../../commit/9d29eb7b))

## [1.5.1] - 2025-12-12

### Added

- make memory-learning hook explicitly autonomous ([fd2b4e0e](../../commit/fd2b4e0e))
- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))
- add no-excuses hook to prevent dismissing pre-existing issues ([cbf8ce8c](../../commit/cbf8ce8c))
- add project memory skill and learning hooks ([e4e69780](../../commit/e4e69780))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))

### Fixed

- harden no-excuses rule to prevent categorizing failures ([bb30c9c6](../../commit/bb30c9c6))
- fix markdown linting errors in project-memory files ([3db56cdd](../../commit/3db56cdd))

### Changed

- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([770201dc](../../commit/770201dc))

## [1.5.0] - 2025-12-12

### Added

- make memory-learning hook explicitly autonomous ([fd2b4e0e](../../commit/fd2b4e0e))
- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))
- add no-excuses hook to prevent dismissing pre-existing issues ([cbf8ce8c](../../commit/cbf8ce8c))
- add project memory skill and learning hooks ([e4e69780](../../commit/e4e69780))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))

### Fixed

- fix markdown linting errors in project-memory files ([3db56cdd](../../commit/3db56cdd))

### Changed

- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([770201dc](../../commit/770201dc))

## [1.4.0] - 2025-12-12

### Added

- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))
- add no-excuses hook to prevent dismissing pre-existing issues ([cbf8ce8c](../../commit/cbf8ce8c))
- add project memory skill and learning hooks ([e4e69780](../../commit/e4e69780))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))

### Fixed

- fix markdown linting errors in project-memory files ([3db56cdd](../../commit/3db56cdd))

### Changed

- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([770201dc](../../commit/770201dc))

## [1.3.0] - 2025-12-11

### Added

- add no-excuses hook to prevent dismissing pre-existing issues ([cbf8ce8c](../../commit/cbf8ce8c))
- add project memory skill and learning hooks ([e4e69780](../../commit/e4e69780))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))

### Fixed

- fix markdown linting errors in project-memory files ([3db56cdd](../../commit/3db56cdd))

### Changed

- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([770201dc](../../commit/770201dc))

## [1.2.1] - 2025-12-11

### Added

- add project memory skill and learning hooks ([e4e69780](../../commit/e4e69780))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))

### Fixed

- fix markdown linting errors in project-memory files ([3db56cdd](../../commit/3db56cdd))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([770201dc](../../commit/770201dc))

## [1.1.1] - 2025-12-11

### Added

- add project memory skill and learning hooks ([e4e69780](../../commit/e4e69780))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))

### Fixed

- fix markdown linting errors in project-memory files ([3db56cdd](../../commit/3db56cdd))

## [1.1.0] - 2025-12-11

### Added

- add project memory skill and learning hooks ([e4e69780](../../commit/e4e69780))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))

### Fixed

- use dynamic import for marketplace-cache in update.ts ([c81294ad](../../commit/c81294ad))

## [1.0.9] - 2025-12-10

### Fixed

- use dynamic import for marketplace-cache in update.ts ([c81294ad](../../commit/c81294ad))
- read user prompt from stdin hook event JSON ([359f6b43](../../commit/359f6b43))

### Changed

- rename bushido-han package to han with expanded test coverage ([a320585d](../../commit/a320585d))

### Other

- format code with biome and rebuild native module ([50e3fbd1](../../commit/50e3fbd1))
- format JSON files ([6b574250](../../commit/6b574250))

## [1.0.8] - 2025-12-09

### Added

- integrate sentiment detection into core plugin ([ef388e52](../../commit/ef388e52))

### Fixed

- read user prompt from stdin hook event JSON ([359f6b43](../../commit/359f6b43))
- add -y flag to remaining npx typescript commands ([03543a73](../../commit/03543a73))
- atomic binary update in SessionStart hook ([44a38628](../../commit/44a38628))

### Changed

- rename bushido-han package to han with expanded test coverage ([a320585d](../../commit/a320585d))

### Other

- format code with biome and rebuild native module ([50e3fbd1](../../commit/50e3fbd1))
- format JSON files ([6b574250](../../commit/6b574250))

## [1.0.7] - 2025-12-08

### Added

- integrate sentiment detection into core plugin ([ef388e52](../../commit/ef388e52))

### Fixed

- read user prompt from stdin hook event JSON ([359f6b43](../../commit/359f6b43))
- add -y flag to remaining npx typescript commands ([03543a73](../../commit/03543a73))
- atomic binary update in SessionStart hook ([44a38628](../../commit/44a38628))
- convert hook timeout from seconds to milliseconds ([985ecde3](../../commit/985ecde3))
- remove duplicate strings in hook commands ([63199a44](../../commit/63199a44))
- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))
- add trailing newline to core/hooks/hooks.json ([8daeca51](../../commit/8daeca51))

### Other

- format JSON files ([6b574250](../../commit/6b574250))
- change mcp locations ([d9df0157](../../commit/d9df0157))

## [1.0.6] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- add session metrics tracking to SessionStart hook ([abe7af4a](../../commit/abe7af4a))

### Fixed

- atomic binary update in SessionStart hook ([44a38628](../../commit/44a38628))
- convert hook timeout from seconds to milliseconds ([985ecde3](../../commit/985ecde3))
- remove duplicate strings in hook commands ([63199a44](../../commit/63199a44))
- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))
- add trailing newline to core/hooks/hooks.json ([8daeca51](../../commit/8daeca51))

### Other

- change mcp locations ([d9df0157](../../commit/d9df0157))

## [1.0.5] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- add session metrics tracking to SessionStart hook ([abe7af4a](../../commit/abe7af4a))

### Fixed

- convert hook timeout from seconds to milliseconds ([985ecde3](../../commit/985ecde3))
- remove duplicate strings in hook commands ([63199a44](../../commit/63199a44))
- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))
- add trailing newline to core/hooks/hooks.json ([8daeca51](../../commit/8daeca51))

### Other

- change mcp locations ([d9df0157](../../commit/d9df0157))

## [1.0.4] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- add session metrics tracking to SessionStart hook ([abe7af4a](../../commit/abe7af4a))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- remove duplicate strings in hook commands ([63199a44](../../commit/63199a44))
- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))
- add trailing newline to core/hooks/hooks.json ([8daeca51](../../commit/8daeca51))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))

## [1.0.3] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- add session metrics tracking to SessionStart hook ([abe7af4a](../../commit/abe7af4a))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))
- add trailing newline to core/hooks/hooks.json ([8daeca51](../../commit/8daeca51))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))

## [1.0.2] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- add session metrics tracking to SessionStart hook ([abe7af4a](../../commit/abe7af4a))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))
- add epistemic rigor enforcement and spinning wheels detection ([9ebce22b](../../commit/9ebce22b))

### Fixed

- add trailing newline to core/hooks/hooks.json ([8daeca51](../../commit/8daeca51))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))

## [1.0.1] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- add session metrics tracking to SessionStart hook ([abe7af4a](../../commit/abe7af4a))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))
- add epistemic rigor enforcement and spinning wheels detection ([9ebce22b](../../commit/9ebce22b))

### Fixed

- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))

han-core is the essential infrastructure for the Han plugin marketplace, created by consolidating:

- Infrastructure from `bushido` (delegation, skill transparency, quality enforcement)
- MCP servers from `hashi-han` (hook commands)
- MCP servers from `hashi-han-metrics` (task tracking)
- Context7 integration from `bushido`

### Features

**Infrastructure Hooks:**

- `ensure-subagent.md` - Delegation protocol for do-*/hashi-*/jutsu-* agents
- `ensure-skill-use.md` - Skill selection transparency
- `pre-push-check.sh` - Git push quality validation
- `no-time-estimates.md` - Time estimate enforcement
- `metrics-tracking.md` - Task tracking instructions

**MCP Servers:**

- `han` - Unified server providing hook command execution and task tracking/metrics (consolidated from hashi-han and hashi-han-metrics)
- `context7` - Up-to-date library documentation

**Skills (16 total):**

Universal programming principles including SOLID, simplicity principles, boy-scout-rule, professional-honesty, proof-of-work, and more.

**Commands (12 total):**

Workflow orchestration including /develop, /review, /plan, /architect, and more.

### Migration

**From bushido 1.x:**

```bash
han plugin install han-core
```

**From hashi-han:**

```bash
han plugin uninstall hashi-han
han plugin install han-core
```

**From hashi-han-metrics:**

```bash
han plugin uninstall hashi-han-metrics
han plugin install han-core
```

### Philosophy Separation

The Bushido philosophy (7 virtues) remains in the separate `bushido` plugin. Install both for the full experience:

```bash
han plugin install han-core bushido
```
