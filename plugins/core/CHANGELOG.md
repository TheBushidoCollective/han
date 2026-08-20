# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.12.1] - 2026-02-03

### Added

- multi-environment dashboard with central coordinator ([6246aec3](../../commit/6246aec3))
- add ai-dlc-elaborate skill for Claude Code skill/command unification (#51) ([ca2efeb3](../../commit/ca2efeb3))
- restore npx for MCP servers now that npm publishing works ([d9751921](../../commit/d9751921))

### Fixed

- move hooks.json to .claude-plugin directory ([a5cb5ad0](../../commit/a5cb5ad0))
- use han binary for core MCP server instead of npx ([bbdba3d1](../../commit/bbdba3d1))
- use han binary directly instead of npx until npm deployment works ([7b42ba54](../../commit/7b42ba54))

## [1.12.0] - 2026-02-02

### Added

- add ai-dlc-elaborate skill for Claude Code skill/command unification (#51) ([ca2efeb3](../../commit/ca2efeb3))
- restore npx for MCP servers now that npm publishing works ([d9751921](../../commit/d9751921))

### Fixed

- use han binary for core MCP server instead of npx ([bbdba3d1](../../commit/bbdba3d1))
- use han binary directly instead of npx until npm deployment works ([7b42ba54](../../commit/7b42ba54))

## [1.11.0] - 2026-02-01

### Added

- restore npx for MCP servers now that npm publishing works ([d9751921](../../commit/d9751921))

### Fixed

- use han binary for core MCP server instead of npx ([bbdba3d1](../../commit/bbdba3d1))
- use han binary directly instead of npx until npm deployment works ([7b42ba54](../../commit/7b42ba54))

## [1.10.3] - 2026-02-01

### Fixed

- use han binary directly instead of npx until npm deployment works ([7b42ba54](../../commit/7b42ba54))

## [1.10.2] - 2026-02-01

### Added

- reorganize plugins from branded to tech layer categories (#45) ([23a8c08a](../../commit/23a8c08a))

### Fixed

- embed install script instead of fetching from han.guru (#47) ([41dcde14](../../commit/41dcde14))

### Changed

- remove redundant LLM summary generation ([43ee8f8b](../../commit/43ee8f8b))

## [1.10.1] - 2026-01-31

### Added

- reorganize plugins from branded to tech layer categories (#45) ([23a8c08a](../../commit/23a8c08a))

### Changed

- remove redundant LLM summary generation ([43ee8f8b](../../commit/43ee8f8b))

## [1.10.0] - 2026-01-31

### Added

- reorganize plugins from branded to tech layer categories (#45) ([23a8c08a](../../commit/23a8c08a))

## [1.9.4] - 2026-01-30

### Added

- add SubagentPrompt hook for context injection to subagents ([a16668ba](../../commit/a16668ba))
- add pre-commit validation via PreToolUse hook ([477be1e5](../../commit/477be1e5))

### Fixed

- allow rm in /tmp/ for safe-operations ([fd302885](../../commit/fd302885))
- address shell injection and path traversal vulnerabilities ([e9d5a985](../../commit/e9d5a985))
- use updatedInput instead of deny for pre-commit validation ([7513ad98](../../commit/7513ad98))
- pass full context through pre-commit validation hook ([4c04f452](../../commit/4c04f452))
- pass session_id through pre-commit validation hook ([7d44693f](../../commit/7d44693f))
- resolve lint errors and update tests for refactored hook UI ([c293a849](../../commit/c293a849))
- resolve hook test failures ([4c22c83e](../../commit/4c22c83e))
- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))

### Changed

- replace jq/grep JSON parsing with han parse ([4211ef6a](../../commit/4211ef6a))

### Other

- Merge pull request #41 from TheBushidoCollective/han-1 ([0b677ba6](../../commit/0b677ba6))

## [1.9.3] - 2026-01-29

### Fixed

- resolve lint errors and update tests for refactored hook UI ([c293a849](../../commit/c293a849))
- resolve hook test failures ([4c22c83e](../../commit/4c22c83e))
- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))

## [1.9.2] - 2026-01-29

### Fixed

- resolve hook test failures ([4c22c83e](../../commit/4c22c83e))
- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))

## [1.9.1] - 2026-01-28

### Added

- auto-index Claude Code native tasks (TaskCreate/TaskUpdate) ([66953ce4](../../commit/66953ce4))

### Fixed

- block cp/mv commands that access files outside project ([418e5209](../../commit/418e5209))

### Other

- auto-format plugin.json files with biome ([85bcf9d6](../../commit/85bcf9d6))

## [1.9.0] - 2026-01-26

### Added

- add bundler plugins, package manager detection, and coordinator auto-start ([c7cb63f9](../../commit/c7cb63f9))
- add --skip-if-questioning flag to Stop hooks ([04c326dd](../../commit/04c326dd))
- show session names in browse UI instead of UUIDs ([d11845de](../../commit/d11845de))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))
- add session todos indexing and UI display ([dc161235](../../commit/dc161235))
- add async workflow pattern with polling-based progress monitoring ([a91f7843](../../commit/a91f7843))
- add session ID hook for workflow/memory tool integration ([42a283db](../../commit/42a283db))

### Fixed

- skip han installation when hanBinary is configured ([e179646c](../../commit/e179646c))

### Changed

- remove orchestrator, use direct MCP exposure with OAuth ([6e69b841](../../commit/6e69b841))
- major codebase cleanup and consolidation ([94d9d6db](../../commit/94d9d6db))

### Other

- Merge branch 'fix/react-native-web-violations' ([bc5f78a8](../../commit/bc5f78a8))
- optimize SessionStart from 6s to 2s ([44595593](../../commit/44595593))
- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [1.8.1] - 2026-01-26

### Added

- add --skip-if-questioning flag to Stop hooks ([04c326dd](../../commit/04c326dd))
- show session names in browse UI instead of UUIDs ([d11845de](../../commit/d11845de))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))
- add session todos indexing and UI display ([dc161235](../../commit/dc161235))
- add async workflow pattern with polling-based progress monitoring ([a91f7843](../../commit/a91f7843))
- add session ID hook for workflow/memory tool integration ([42a283db](../../commit/42a283db))

### Fixed

- skip han installation when hanBinary is configured ([e179646c](../../commit/e179646c))

### Changed

- remove orchestrator, use direct MCP exposure with OAuth ([6e69b841](../../commit/6e69b841))
- major codebase cleanup and consolidation ([94d9d6db](../../commit/94d9d6db))

### Other

- Merge branch 'fix/react-native-web-violations' ([bc5f78a8](../../commit/bc5f78a8))
- optimize SessionStart from 6s to 2s ([44595593](../../commit/44595593))
- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [1.8.0] - 2026-01-24

### Added

- add --skip-if-questioning flag to Stop hooks ([04c326dd](../../commit/04c326dd))
- show session names in browse UI instead of UUIDs ([d11845de](../../commit/d11845de))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))
- add session todos indexing and UI display ([dc161235](../../commit/dc161235))
- add async workflow pattern with polling-based progress monitoring ([a91f7843](../../commit/a91f7843))
- add session ID hook for workflow/memory tool integration ([42a283db](../../commit/42a283db))

### Changed

- remove orchestrator, use direct MCP exposure with OAuth ([6e69b841](../../commit/6e69b841))
- major codebase cleanup and consolidation ([94d9d6db](../../commit/94d9d6db))

### Other

- optimize SessionStart from 6s to 2s ([44595593](../../commit/44595593))
- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [1.7.1] - 2025-12-23

### Added

- add bash output capture instruction ([a99c803f](../../commit/a99c803f))

### Fixed

- cross-compile Windows builds from Linux too ([7d72ab5d](../../commit/7d72ab5d))

### Changed

- remove all prompt hooks ([01227fef](../../commit/01227fef))

### Other

- add comprehensive tests for critical untested systems ([23b61742](../../commit/23b61742))
- fix duplicate word in Discord link ([b7f9790c](../../commit/b7f9790c))

## [1.7.0] - 2025-12-23

### Added

- add bash output capture instruction ([a99c803f](../../commit/a99c803f))

### Fixed

- cross-compile Windows builds from Linux too ([7d72ab5d](../../commit/7d72ab5d))

### Other

- add comprehensive tests for critical untested systems ([23b61742](../../commit/23b61742))
- fix duplicate word in Discord link ([b7f9790c](../../commit/b7f9790c))
- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [1.6.2] - 2025-12-17

### Fixed

- cross-compile Windows builds from Linux too ([7d72ab5d](../../commit/7d72ab5d))

### Other

- add comprehensive tests for critical untested systems ([23b61742](../../commit/23b61742))
- fix duplicate word in Discord link ([b7f9790c](../../commit/b7f9790c))
- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [1.6.1] - 2025-12-16

### Added

- add legacy-code-safety skill and hook ([05e0d6ad](../../commit/05e0d6ad))

### Other

- fix duplicate word in Discord link ([b7f9790c](../../commit/b7f9790c))
- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

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
