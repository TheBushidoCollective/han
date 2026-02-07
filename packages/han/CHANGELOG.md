# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [3.9.0] - 2026-02-07

### Added

- auto-generate hooks.json from han-plugin.yml with shorthand events ([f3a39941](../../commit/f3a39941))
- use marketplace.json as source of truth and auto-run on session start ([93d75cd8](../../commit/93d75cd8))
- auto-detect reindex needs and coordinator version upgrades ([f34082f6](../../commit/f34082f6))
- add wrap-subagent-context command and fix hook timeouts ([f8a87bc3](../../commit/f8a87bc3))
- add async hook queue for PostToolUse non-blocking validation ([4a0436e8](../../commit/4a0436e8))

### Fixed

- skip opening browser in test environments during han browse ([febd1476](../../commit/febd1476))
- migrate deprecated plugin names in YAML config files ([06882b3b](../../commit/06882b3b))
- improve npm wrapper resolution, simplify migration, remove stale MCP entry ([b10b4868](../../commit/b10b4868))
- use imported HAN_VERSION instead of process.env for health endpoint ([670532cd](../../commit/670532cd))
- fix marketplace source paths, stale alias, and missing SKILL.md names (#60) ([4774fca5](../../commit/4774fca5))
- run plugin install from git root to prevent nested config writes ([c1d2e419](../../commit/c1d2e419))
- replace npx with direct han binary, fix auto-detect plugin matching ([11c3edfa](../../commit/11c3edfa))
- update plugin discovery to use marketplace.json ([d07a773d](../../commit/d07a773d))
- fix CORS configuration and improve error logging ([1bab9383](../../commit/1bab9383))
- add explicit CORS preflight handling ([74b65d3a](../../commit/74b65d3a))
- fix CORS and remove dev proxy ([76d28a9e](../../commit/76d28a9e))
- fix CORS by reflecting request origin ([ef48da2f](../../commit/ef48da2f))
- filter deleted files from HAN_FILES in hooks ([c9d0e59e](../../commit/c9d0e59e))
- pass --version through to hanBinary when configured ([a2941a85](../../commit/a2941a85))
- remove unused async-hook-executor and async-hook-client ([d50a95d4](../../commit/d50a95d4))

### Changed

- modernize hook system and consolidate plugin structure ([fffa4297](../../commit/fffa4297))

### Other

- Merge remote-tracking branch 'origin/main' ([64362994](../../commit/64362994))
- updates ([186ef119](../../commit/186ef119))
- Merge main into branch ([b6c53dce](../../commit/b6c53dce))

## [3.8.2] - 2026-02-06

### Added

- use marketplace.json as source of truth and auto-run on session start ([93d75cd8](../../commit/93d75cd8))
- auto-detect reindex needs and coordinator version upgrades ([f34082f6](../../commit/f34082f6))
- add wrap-subagent-context command and fix hook timeouts ([f8a87bc3](../../commit/f8a87bc3))
- reject deprecated naming and use short names ([c7b594cc](../../commit/c7b594cc))
- add async hook queue for PostToolUse non-blocking validation ([4a0436e8](../../commit/4a0436e8))

### Fixed

- fix marketplace source paths, stale alias, and missing SKILL.md names (#60) ([4774fca5](../../commit/4774fca5))
- run plugin install from git root to prevent nested config writes ([c1d2e419](../../commit/c1d2e419))
- replace npx with direct han binary, fix auto-detect plugin matching ([11c3edfa](../../commit/11c3edfa))
- update plugin discovery to use marketplace.json ([d07a773d](../../commit/d07a773d))
- fix CORS configuration and improve error logging ([1bab9383](../../commit/1bab9383))
- add explicit CORS preflight handling ([74b65d3a](../../commit/74b65d3a))
- fix CORS and remove dev proxy ([76d28a9e](../../commit/76d28a9e))
- fix CORS by reflecting request origin ([ef48da2f](../../commit/ef48da2f))
- filter deleted files from HAN_FILES in hooks ([c9d0e59e](../../commit/c9d0e59e))
- pass --version through to hanBinary when configured ([a2941a85](../../commit/a2941a85))
- remove unused async-hook-executor and async-hook-client ([d50a95d4](../../commit/d50a95d4))
- resolve CLAUDE_PLUGIN_ROOT for subdirectory workspaces ([7b002ce0](../../commit/7b002ce0))
- update plugin tests to use new short naming ([cf28c711](../../commit/cf28c711))
- update plugin install test for new naming convention ([53350595](../../commit/53350595))

### Changed

- modernize hook system - direct plugin hooks (no orchestration) (#57) ([b0ee1566](../../commit/b0ee1566))
- modernize hook system and consolidate plugin structure ([fffa4297](../../commit/fffa4297))

### Other

- Merge remote-tracking branch 'origin/main' ([64362994](../../commit/64362994))
- updates ([186ef119](../../commit/186ef119))
- Merge main into branch ([b6c53dce](../../commit/b6c53dce))
- format plugin-aliases.ts ([17181c1e](../../commit/17181c1e))

## [3.8.1] - 2026-02-05

### Added

- use marketplace.json as source of truth and auto-run on session start ([93d75cd8](../../commit/93d75cd8))
- auto-detect reindex needs and coordinator version upgrades ([f34082f6](../../commit/f34082f6))
- add wrap-subagent-context command and fix hook timeouts ([f8a87bc3](../../commit/f8a87bc3))
- reject deprecated naming and use short names ([c7b594cc](../../commit/c7b594cc))
- add wildcard support to sessionMessageAdded subscription ([ee8c11d8](../../commit/ee8c11d8))
- add async hook queue for PostToolUse non-blocking validation ([4a0436e8](../../commit/4a0436e8))

### Fixed

- run plugin install from git root to prevent nested config writes ([c1d2e419](../../commit/c1d2e419))
- replace npx with direct han binary, fix auto-detect plugin matching ([11c3edfa](../../commit/11c3edfa))
- update plugin discovery to use marketplace.json ([d07a773d](../../commit/d07a773d))
- fix CORS configuration and improve error logging ([1bab9383](../../commit/1bab9383))
- add explicit CORS preflight handling ([74b65d3a](../../commit/74b65d3a))
- fix CORS and remove dev proxy ([76d28a9e](../../commit/76d28a9e))
- fix CORS by reflecting request origin ([ef48da2f](../../commit/ef48da2f))
- filter deleted files from HAN_FILES in hooks ([c9d0e59e](../../commit/c9d0e59e))
- pass --version through to hanBinary when configured ([a2941a85](../../commit/a2941a85))
- remove unused async-hook-executor and async-hook-client ([d50a95d4](../../commit/d50a95d4))
- resolve CLAUDE_PLUGIN_ROOT for subdirectory workspaces ([7b002ce0](../../commit/7b002ce0))
- update plugin tests to use new short naming ([cf28c711](../../commit/cf28c711))
- update plugin install test for new naming convention ([53350595](../../commit/53350595))

### Changed

- modernize hook system - direct plugin hooks (no orchestration) (#57) ([b0ee1566](../../commit/b0ee1566))
- modernize hook system and consolidate plugin structure ([fffa4297](../../commit/fffa4297))

### Other

- Merge remote-tracking branch 'origin/main' ([64362994](../../commit/64362994))
- updates ([186ef119](../../commit/186ef119))
- Merge main into branch ([b6c53dce](../../commit/b6c53dce))
- format plugin-aliases.ts ([17181c1e](../../commit/17181c1e))

## [3.8.0] - 2026-02-05

### Added

- use marketplace.json as source of truth and auto-run on session start ([93d75cd8](../../commit/93d75cd8))
- auto-detect reindex needs and coordinator version upgrades ([f34082f6](../../commit/f34082f6))
- add wrap-subagent-context command and fix hook timeouts ([f8a87bc3](../../commit/f8a87bc3))
- reject deprecated naming and use short names ([c7b594cc](../../commit/c7b594cc))
- add wildcard support to sessionMessageAdded subscription ([ee8c11d8](../../commit/ee8c11d8))
- add async hook queue for PostToolUse non-blocking validation ([4a0436e8](../../commit/4a0436e8))

### Fixed

- fix CORS configuration and improve error logging ([1bab9383](../../commit/1bab9383))
- add explicit CORS preflight handling ([74b65d3a](../../commit/74b65d3a))
- fix CORS and remove dev proxy ([76d28a9e](../../commit/76d28a9e))
- fix CORS by reflecting request origin ([ef48da2f](../../commit/ef48da2f))
- filter deleted files from HAN_FILES in hooks ([c9d0e59e](../../commit/c9d0e59e))
- pass --version through to hanBinary when configured ([a2941a85](../../commit/a2941a85))
- remove unused async-hook-executor and async-hook-client ([d50a95d4](../../commit/d50a95d4))
- resolve CLAUDE_PLUGIN_ROOT for subdirectory workspaces ([7b002ce0](../../commit/7b002ce0))
- update plugin tests to use new short naming ([cf28c711](../../commit/cf28c711))
- update plugin install test for new naming convention ([53350595](../../commit/53350595))

### Changed

- modernize hook system - direct plugin hooks (no orchestration) (#57) ([b0ee1566](../../commit/b0ee1566))
- modernize hook system and consolidate plugin structure ([fffa4297](../../commit/fffa4297))

### Other

- Merge remote-tracking branch 'origin/main' ([64362994](../../commit/64362994))
- updates ([186ef119](../../commit/186ef119))
- Merge main into branch ([b6c53dce](../../commit/b6c53dce))
- format plugin-aliases.ts ([17181c1e](../../commit/17181c1e))

## [3.7.9] - 2026-02-05

### Added

- auto-detect reindex needs and coordinator version upgrades ([f34082f6](../../commit/f34082f6))
- add wrap-subagent-context command and fix hook timeouts ([f8a87bc3](../../commit/f8a87bc3))
- reject deprecated naming and use short names ([c7b594cc](../../commit/c7b594cc))
- add wildcard support to sessionMessageAdded subscription ([ee8c11d8](../../commit/ee8c11d8))
- add async hook queue for PostToolUse non-blocking validation ([4a0436e8](../../commit/4a0436e8))

### Fixed

- fix CORS configuration and improve error logging ([1bab9383](../../commit/1bab9383))
- add explicit CORS preflight handling ([74b65d3a](../../commit/74b65d3a))
- fix CORS and remove dev proxy ([76d28a9e](../../commit/76d28a9e))
- fix CORS by reflecting request origin ([ef48da2f](../../commit/ef48da2f))
- filter deleted files from HAN_FILES in hooks ([c9d0e59e](../../commit/c9d0e59e))
- pass --version through to hanBinary when configured ([a2941a85](../../commit/a2941a85))
- remove unused async-hook-executor and async-hook-client ([d50a95d4](../../commit/d50a95d4))
- resolve CLAUDE_PLUGIN_ROOT for subdirectory workspaces ([7b002ce0](../../commit/7b002ce0))
- update plugin tests to use new short naming ([cf28c711](../../commit/cf28c711))
- update plugin install test for new naming convention ([53350595](../../commit/53350595))

### Changed

- modernize hook system - direct plugin hooks (no orchestration) (#57) ([b0ee1566](../../commit/b0ee1566))
- modernize hook system and consolidate plugin structure ([fffa4297](../../commit/fffa4297))

### Other

- Merge remote-tracking branch 'origin/main' ([64362994](../../commit/64362994))
- updates ([186ef119](../../commit/186ef119))
- Merge main into branch ([b6c53dce](../../commit/b6c53dce))
- format plugin-aliases.ts ([17181c1e](../../commit/17181c1e))
- Add Han Learns: Automatic plugin detection and installation (#54) ([7edbf7bf](../../commit/7edbf7bf))

## [3.7.8] - 2026-02-05

### Added

- auto-detect reindex needs and coordinator version upgrades ([f34082f6](../../commit/f34082f6))
- add wrap-subagent-context command and fix hook timeouts ([f8a87bc3](../../commit/f8a87bc3))
- reject deprecated naming and use short names ([c7b594cc](../../commit/c7b594cc))
- add wildcard support to sessionMessageAdded subscription ([ee8c11d8](../../commit/ee8c11d8))
- add async hook queue for PostToolUse non-blocking validation ([4a0436e8](../../commit/4a0436e8))

### Fixed

- fix CORS configuration and improve error logging ([1bab9383](../../commit/1bab9383))
- add explicit CORS preflight handling ([74b65d3a](../../commit/74b65d3a))
- fix CORS and remove dev proxy ([76d28a9e](../../commit/76d28a9e))
- fix CORS by reflecting request origin ([ef48da2f](../../commit/ef48da2f))
- filter deleted files from HAN_FILES in hooks ([c9d0e59e](../../commit/c9d0e59e))
- pass --version through to hanBinary when configured ([a2941a85](../../commit/a2941a85))
- remove unused async-hook-executor and async-hook-client ([d50a95d4](../../commit/d50a95d4))
- resolve CLAUDE_PLUGIN_ROOT for subdirectory workspaces ([7b002ce0](../../commit/7b002ce0))
- update plugin tests to use new short naming ([cf28c711](../../commit/cf28c711))
- update plugin install test for new naming convention ([53350595](../../commit/53350595))

### Changed

- modernize hook system - direct plugin hooks (no orchestration) (#57) ([b0ee1566](../../commit/b0ee1566))
- modernize hook system and consolidate plugin structure ([fffa4297](../../commit/fffa4297))

### Other

- Merge remote-tracking branch 'origin/main' ([64362994](../../commit/64362994))
- updates ([186ef119](../../commit/186ef119))
- Merge main into branch ([b6c53dce](../../commit/b6c53dce))
- format plugin-aliases.ts ([17181c1e](../../commit/17181c1e))
- Add Han Learns: Automatic plugin detection and installation (#54) ([7edbf7bf](../../commit/7edbf7bf))

## [3.7.7] - 2026-02-05

### Added

- auto-detect reindex needs and coordinator version upgrades ([f34082f6](../../commit/f34082f6))
- add wrap-subagent-context command and fix hook timeouts ([f8a87bc3](../../commit/f8a87bc3))
- reject deprecated naming and use short names ([c7b594cc](../../commit/c7b594cc))
- add wildcard support to sessionMessageAdded subscription ([ee8c11d8](../../commit/ee8c11d8))
- add async hook queue for PostToolUse non-blocking validation ([4a0436e8](../../commit/4a0436e8))

### Fixed

- add explicit CORS preflight handling ([74b65d3a](../../commit/74b65d3a))
- fix CORS and remove dev proxy ([76d28a9e](../../commit/76d28a9e))
- fix CORS by reflecting request origin ([ef48da2f](../../commit/ef48da2f))
- filter deleted files from HAN_FILES in hooks ([c9d0e59e](../../commit/c9d0e59e))
- pass --version through to hanBinary when configured ([a2941a85](../../commit/a2941a85))
- remove unused async-hook-executor and async-hook-client ([d50a95d4](../../commit/d50a95d4))
- resolve CLAUDE_PLUGIN_ROOT for subdirectory workspaces ([7b002ce0](../../commit/7b002ce0))
- update plugin tests to use new short naming ([cf28c711](../../commit/cf28c711))
- update plugin install test for new naming convention ([53350595](../../commit/53350595))

### Changed

- modernize hook system - direct plugin hooks (no orchestration) (#57) ([b0ee1566](../../commit/b0ee1566))
- modernize hook system and consolidate plugin structure ([fffa4297](../../commit/fffa4297))

### Other

- Merge remote-tracking branch 'origin/main' ([64362994](../../commit/64362994))
- updates ([186ef119](../../commit/186ef119))
- Merge main into branch ([b6c53dce](../../commit/b6c53dce))
- format plugin-aliases.ts ([17181c1e](../../commit/17181c1e))
- Add Han Learns: Automatic plugin detection and installation (#54) ([7edbf7bf](../../commit/7edbf7bf))

## [3.7.6] - 2026-02-05

### Added

- auto-detect reindex needs and coordinator version upgrades ([f34082f6](../../commit/f34082f6))
- add wrap-subagent-context command and fix hook timeouts ([f8a87bc3](../../commit/f8a87bc3))
- reject deprecated naming and use short names ([c7b594cc](../../commit/c7b594cc))
- add wildcard support to sessionMessageAdded subscription ([ee8c11d8](../../commit/ee8c11d8))
- add async hook queue for PostToolUse non-blocking validation ([4a0436e8](../../commit/4a0436e8))

### Fixed

- fix CORS and remove dev proxy ([76d28a9e](../../commit/76d28a9e))
- fix CORS by reflecting request origin ([ef48da2f](../../commit/ef48da2f))
- filter deleted files from HAN_FILES in hooks ([c9d0e59e](../../commit/c9d0e59e))
- pass --version through to hanBinary when configured ([a2941a85](../../commit/a2941a85))
- remove unused async-hook-executor and async-hook-client ([d50a95d4](../../commit/d50a95d4))
- resolve CLAUDE_PLUGIN_ROOT for subdirectory workspaces ([7b002ce0](../../commit/7b002ce0))
- update plugin tests to use new short naming ([cf28c711](../../commit/cf28c711))
- update plugin install test for new naming convention ([53350595](../../commit/53350595))

### Changed

- modernize hook system - direct plugin hooks (no orchestration) (#57) ([b0ee1566](../../commit/b0ee1566))
- modernize hook system and consolidate plugin structure ([fffa4297](../../commit/fffa4297))

### Other

- Merge remote-tracking branch 'origin/main' ([64362994](../../commit/64362994))
- updates ([186ef119](../../commit/186ef119))
- Merge main into branch ([b6c53dce](../../commit/b6c53dce))
- format plugin-aliases.ts ([17181c1e](../../commit/17181c1e))
- Add Han Learns: Automatic plugin detection and installation (#54) ([7edbf7bf](../../commit/7edbf7bf))

## [3.7.5] - 2026-02-05

### Added

- auto-detect reindex needs and coordinator version upgrades ([f34082f6](../../commit/f34082f6))
- add wrap-subagent-context command and fix hook timeouts ([f8a87bc3](../../commit/f8a87bc3))
- reject deprecated naming and use short names ([c7b594cc](../../commit/c7b594cc))
- add wildcard support to sessionMessageAdded subscription ([ee8c11d8](../../commit/ee8c11d8))
- add async hook queue for PostToolUse non-blocking validation ([4a0436e8](../../commit/4a0436e8))
- multi-environment dashboard with central coordinator ([6246aec3](../../commit/6246aec3))

### Fixed

- fix CORS by reflecting request origin ([ef48da2f](../../commit/ef48da2f))
- filter deleted files from HAN_FILES in hooks ([c9d0e59e](../../commit/c9d0e59e))
- pass --version through to hanBinary when configured ([a2941a85](../../commit/a2941a85))
- remove unused async-hook-executor and async-hook-client ([d50a95d4](../../commit/d50a95d4))
- resolve CLAUDE_PLUGIN_ROOT for subdirectory workspaces ([7b002ce0](../../commit/7b002ce0))
- update plugin tests to use new short naming ([cf28c711](../../commit/cf28c711))
- update plugin install test for new naming convention ([53350595](../../commit/53350595))

### Changed

- modernize hook system - direct plugin hooks (no orchestration) (#57) ([b0ee1566](../../commit/b0ee1566))
- modernize hook system and consolidate plugin structure ([fffa4297](../../commit/fffa4297))

### Other

- Merge remote-tracking branch 'origin/main' ([64362994](../../commit/64362994))
- updates ([186ef119](../../commit/186ef119))
- Merge main into branch ([b6c53dce](../../commit/b6c53dce))
- format plugin-aliases.ts ([17181c1e](../../commit/17181c1e))
- Add Han Learns: Automatic plugin detection and installation (#54) ([7edbf7bf](../../commit/7edbf7bf))

## [3.7.4] - 2026-02-04

### Added

- reject deprecated naming and use short names ([c7b594cc](../../commit/c7b594cc))
- add wildcard support to sessionMessageAdded subscription ([ee8c11d8](../../commit/ee8c11d8))
- multi-environment dashboard with central coordinator ([6246aec3](../../commit/6246aec3))
- add configurable VCS strategy with jj support (#49) ([4cba29e8](../../commit/4cba29e8))
- add Codecov coverage reporting ([6381cbb3](../../commit/6381cbb3))
- add ai-dlc-elaborate skill for Claude Code skill/command unification (#51) ([ca2efeb3](../../commit/ca2efeb3))

### Fixed

- resolve CLAUDE_PLUGIN_ROOT for subdirectory workspaces ([7b002ce0](../../commit/7b002ce0))
- update plugin tests to use new short naming ([cf28c711](../../commit/cf28c711))
- update plugin install test for new naming convention ([53350595](../../commit/53350595))

### Changed

- modernize hook system - direct plugin hooks (no orchestration) (#57) ([b0ee1566](../../commit/b0ee1566))

### Other

- format plugin-aliases.ts ([17181c1e](../../commit/17181c1e))
- Add Han Learns: Automatic plugin detection and installation (#54) ([7edbf7bf](../../commit/7edbf7bf))

## [3.7.3] - 2026-02-04

### Added

- reject deprecated naming and use short names ([c7b594cc](../../commit/c7b594cc))
- add wildcard support to sessionMessageAdded subscription ([ee8c11d8](../../commit/ee8c11d8))
- multi-environment dashboard with central coordinator ([6246aec3](../../commit/6246aec3))
- add configurable VCS strategy with jj support (#49) ([4cba29e8](../../commit/4cba29e8))
- add Codecov coverage reporting ([6381cbb3](../../commit/6381cbb3))
- add ai-dlc-elaborate skill for Claude Code skill/command unification (#51) ([ca2efeb3](../../commit/ca2efeb3))

### Fixed

- resolve CLAUDE_PLUGIN_ROOT for subdirectory workspaces ([7b002ce0](../../commit/7b002ce0))
- update plugin tests to use new short naming ([cf28c711](../../commit/cf28c711))
- update plugin install test for new naming convention ([53350595](../../commit/53350595))

### Changed

- modernize hook system - direct plugin hooks (no orchestration) (#57) ([b0ee1566](../../commit/b0ee1566))

### Other

- format plugin-aliases.ts ([17181c1e](../../commit/17181c1e))
- Add Han Learns: Automatic plugin detection and installation (#54) ([7edbf7bf](../../commit/7edbf7bf))

## [3.7.2] - 2026-02-03

### Added

- reject deprecated naming and use short names ([c7b594cc](../../commit/c7b594cc))
- add wildcard support to sessionMessageAdded subscription ([ee8c11d8](../../commit/ee8c11d8))
- multi-environment dashboard with central coordinator ([6246aec3](../../commit/6246aec3))
- add configurable VCS strategy with jj support (#49) ([4cba29e8](../../commit/4cba29e8))
- add Codecov coverage reporting ([6381cbb3](../../commit/6381cbb3))
- add ai-dlc-elaborate skill for Claude Code skill/command unification (#51) ([ca2efeb3](../../commit/ca2efeb3))

### Fixed

- resolve CLAUDE_PLUGIN_ROOT for subdirectory workspaces ([7b002ce0](../../commit/7b002ce0))
- update plugin tests to use new short naming ([cf28c711](../../commit/cf28c711))
- update plugin install test for new naming convention ([53350595](../../commit/53350595))
- route all native imports through centralized loader ([0d673732](../../commit/0d673732))

### Other

- format plugin-aliases.ts ([17181c1e](../../commit/17181c1e))
- Add Han Learns: Automatic plugin detection and installation (#54) ([7edbf7bf](../../commit/7edbf7bf))

## [3.7.1] - 2026-02-03

### Added

- multi-environment dashboard with central coordinator ([6246aec3](../../commit/6246aec3))
- add configurable VCS strategy with jj support (#49) ([4cba29e8](../../commit/4cba29e8))
- add Codecov coverage reporting ([6381cbb3](../../commit/6381cbb3))
- add ai-dlc-elaborate skill for Claude Code skill/command unification (#51) ([ca2efeb3](../../commit/ca2efeb3))

### Fixed

- route all native imports through centralized loader ([0d673732](../../commit/0d673732))

### Other

- Add Han Learns: Automatic plugin detection and installation (#54) ([7edbf7bf](../../commit/7edbf7bf))

## [3.7.0] - 2026-02-02

### Added

- multi-environment dashboard with central coordinator ([6246aec3](../../commit/6246aec3))
- add configurable VCS strategy with jj support (#49) ([4cba29e8](../../commit/4cba29e8))
- add Codecov coverage reporting ([6381cbb3](../../commit/6381cbb3))
- add ai-dlc-elaborate skill for Claude Code skill/command unification (#51) ([ca2efeb3](../../commit/ca2efeb3))

### Fixed

- route all native imports through centralized loader ([0d673732](../../commit/0d673732))

## [3.6.0] - 2026-02-02

### Added

- add Codecov coverage reporting ([6381cbb3](../../commit/6381cbb3))
- add ai-dlc-elaborate skill for Claude Code skill/command unification (#51) ([ca2efeb3](../../commit/ca2efeb3))

### Fixed

- route all native imports through centralized loader ([0d673732](../../commit/0d673732))

## [3.5.0] - 2026-02-02

### Added

- add ai-dlc-elaborate skill for Claude Code skill/command unification (#51) ([ca2efeb3](../../commit/ca2efeb3))

### Fixed

- route all native imports through centralized loader ([0d673732](../../commit/0d673732))

## [3.4.2] - 2026-02-01

### Fixed

- route all native imports through centralized loader ([0d673732](../../commit/0d673732))
- remove migration from install flow, use canonical names ([5435a20b](../../commit/5435a20b))

## [3.4.1] - 2026-02-01

### Added

- reorganize plugins from branded to tech layer categories (#45) ([23a8c08a](../../commit/23a8c08a))
- add fallback mechanisms for empty search results ([28c35c40](../../commit/28c35c40))
- add multi-strategy search with RRF fusion ([a8e91537](../../commit/a8e91537))
- export session completion and summary modules ([5b05cfb5](../../commit/5b05cfb5))
- add backfill-summaries CLI command ([364e4832](../../commit/364e4832))
- add summaries layer to DAL search ([e027235b](../../commit/e027235b))
- add LLM summary generator using Haiku ([2a179b9e](../../commit/2a179b9e))
- add session completion detection ([0b680273](../../commit/0b680273))
- add query expansion for FTS semantic bridging ([dce20c86](../../commit/dce20c86))

### Fixed

- remove migration from install flow, use canonical names ([5435a20b](../../commit/5435a20b))
- update han.test.ts for new migrated plugin names ([ca85f0eb](../../commit/ca85f0eb))
- update plugin alias tests for new path structure ([6a66b876](../../commit/6a66b876))
- enable npm publishing for han CLI ([535031db](../../commit/535031db))
- embed install script instead of fetching from han.guru (#47) ([41dcde14](../../commit/41dcde14))
- sync plugin-aliases.ts with marketplace paths ([fa6ebb40](../../commit/fa6ebb40))
- fix type inference for LIMITS constants ([546d3f95](../../commit/546d3f95))
- address PR review feedback ([9ab3a8a7](../../commit/9ab3a8a7))
- update alias tests to match current implementation ([357da7f2](../../commit/357da7f2))
- add JS fallbacks for native module functions ([4f97cd39](../../commit/4f97cd39))
- restore readFileSync import for scanRecentSessions ([e8bd05e5](../../commit/e8bd05e5))
- address high priority code review feedback ([18ed10c4](../../commit/18ed10c4))
- increase timeout for slow doctor diagnostic test ([bca229ac](../../commit/bca229ac))
- resolve pre-existing CI failures ([8402ff65](../../commit/8402ff65))
- resolve CI validation failures ([933b13ae](../../commit/933b13ae))

### Changed

- rename plugin-development to claude-plugin-development ([abf402c4](../../commit/abf402c4))
- remove redundant LLM summary generation ([43ee8f8b](../../commit/43ee8f8b))

### Other

- Revert "fix: add JS fallbacks for native module functions" ([47627249](../../commit/47627249))
- Merge branch 'ai-dlc/memory-system-improvements/03-multi-strategy-search' into ai-dlc/memory-system-improvements/05-fallback-mechanisms ([464b4822](../../commit/464b4822))

## [3.3.1] - 2026-01-29

### Added

- add bug warning for affected hook types ([512a0ff4](../../commit/512a0ff4))
- simulate Claude Code plugin output capture bug ([56bc93cd](../../commit/56bc93cd))
- show Claude Code plugin hooks first ([beec10f0](../../commit/beec10f0))
- add phase timing stats to hook test command ([1e7a4d90](../../commit/1e7a4d90))
- add hook test command and show all hooks by default ([8155a54e](../../commit/8155a54e))

### Fixed

- resolve lint errors and update tests for refactored hook UI ([c293a849](../../commit/c293a849))
- use process.execPath instead of process.argv[1] ([d391f426](../../commit/d391f426))
- resolve hook test failures ([4c22c83e](../../commit/4c22c83e))
- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))
- use merged settings from all scopes ([7dc9de77](../../commit/7dc9de77))
- route all native imports through centralized loader ([ec5509b0](../../commit/ec5509b0))
- use direct .node file loading instead of conditional require ([d9495ab9](../../commit/d9495ab9))
- exclude deleted files from modified list ([61828d4d](../../commit/61828d4d))
- externalize han-native to prevent bundling napi-rs loader ([3b67eeeb](../../commit/3b67eeeb))

### Changed

- split output into Claude Code vs Han sections ([c25881c8](../../commit/c25881c8))

### Other

- update test names to match renamed checks ([737be0c3](../../commit/737be0c3))
- Merge pull request #40 from TheBushidoCollective/claude/issue-39-20260128-0049 ([33f47b91](../../commit/33f47b91))

## [3.3.0] - 2026-01-29

### Added

- add phase timing stats to hook test command ([1e7a4d90](../../commit/1e7a4d90))
- add hook test command and show all hooks by default ([8155a54e](../../commit/8155a54e))

### Fixed

- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))
- use merged settings from all scopes ([7dc9de77](../../commit/7dc9de77))
- route all native imports through centralized loader ([ec5509b0](../../commit/ec5509b0))
- use direct .node file loading instead of conditional require ([d9495ab9](../../commit/d9495ab9))
- exclude deleted files from modified list ([61828d4d](../../commit/61828d4d))
- externalize han-native to prevent bundling napi-rs loader ([3b67eeeb](../../commit/3b67eeeb))

### Other

- update test names to match renamed checks ([737be0c3](../../commit/737be0c3))
- Merge pull request #40 from TheBushidoCollective/claude/issue-39-20260128-0049 ([33f47b91](../../commit/33f47b91))

## [3.2.0] - 2026-01-29

### Added

- add hook test command and show all hooks by default ([8155a54e](../../commit/8155a54e))

### Fixed

- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))
- use merged settings from all scopes ([7dc9de77](../../commit/7dc9de77))
- route all native imports through centralized loader ([ec5509b0](../../commit/ec5509b0))
- use direct .node file loading instead of conditional require ([d9495ab9](../../commit/d9495ab9))
- exclude deleted files from modified list ([61828d4d](../../commit/61828d4d))
- externalize han-native to prevent bundling napi-rs loader ([3b67eeeb](../../commit/3b67eeeb))

### Other

- update test names to match renamed checks ([737be0c3](../../commit/737be0c3))
- Merge pull request #40 from TheBushidoCollective/claude/issue-39-20260128-0049 ([33f47b91](../../commit/33f47b91))

## [3.1.6] - 2026-01-29

### Fixed

- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))
- use merged settings from all scopes ([7dc9de77](../../commit/7dc9de77))
- route all native imports through centralized loader ([ec5509b0](../../commit/ec5509b0))
- use direct .node file loading instead of conditional require ([d9495ab9](../../commit/d9495ab9))
- exclude deleted files from modified list ([61828d4d](../../commit/61828d4d))
- externalize han-native to prevent bundling napi-rs loader ([3b67eeeb](../../commit/3b67eeeb))

### Other

- update test names to match renamed checks ([737be0c3](../../commit/737be0c3))
- Merge pull request #40 from TheBushidoCollective/claude/issue-39-20260128-0049 ([33f47b91](../../commit/33f47b91))

## [3.1.5] - 2026-01-28

### Fixed

- use merged settings from all scopes ([7dc9de77](../../commit/7dc9de77))
- route all native imports through centralized loader ([ec5509b0](../../commit/ec5509b0))
- use direct .node file loading instead of conditional require ([d9495ab9](../../commit/d9495ab9))
- exclude deleted files from modified list ([61828d4d](../../commit/61828d4d))
- externalize han-native to prevent bundling napi-rs loader ([3b67eeeb](../../commit/3b67eeeb))

### Other

- update test names to match renamed checks ([737be0c3](../../commit/737be0c3))
- Merge pull request #40 from TheBushidoCollective/claude/issue-39-20260128-0049 ([33f47b91](../../commit/33f47b91))

## [3.1.4] - 2026-01-28

### Fixed

- route all native imports through centralized loader ([ec5509b0](../../commit/ec5509b0))
- use direct .node file loading instead of conditional require ([d9495ab9](../../commit/d9495ab9))
- exclude deleted files from modified list ([61828d4d](../../commit/61828d4d))
- externalize han-native to prevent bundling napi-rs loader ([3b67eeeb](../../commit/3b67eeeb))

### Other

- Merge pull request #40 from TheBushidoCollective/claude/issue-39-20260128-0049 ([33f47b91](../../commit/33f47b91))

## [3.1.3] - 2026-01-26

### BREAKING CHANGES

- bump to v3.0.0 and fix workflow trigger token ([53a8cb8f](../../commit/53a8cb8f))

### Added

- implement hash cycle detection for hook recursion ([3de384ab](../../commit/3de384ab))
- add bundler plugins, package manager detection, and coordinator auto-start ([c7cb63f9](../../commit/c7cb63f9))
- add list_blueprints MCP tool ([7caf3e29](../../commit/7caf3e29))
- add --skip-if-questioning flag to Stop hooks ([04c326dd](../../commit/04c326dd))
- skip Stop hook check when agent is waiting for user input ([baba2d47](../../commit/baba2d47))
- hot-reload 6-day TLS certificates without restart ([a7a40ef0](../../commit/a7a40ef0))
- add --local flag for local vs remote dashboard ([7c609b69](../../commit/7c609b69))
- add keep-alive for active connections and sessions ([90cf11db](../../commit/90cf11db))
- add HookCheckStateMessage display in message timeline ([9a045168](../../commit/9a045168))
- add GraphQL @defer support for incremental data loading ([220d8724](../../commit/220d8724))
- add actionable hook failure guidance to SessionStart ([4d4fc2b5](../../commit/4d4fc2b5))
- use HAN_FILES from coordinator for session-scoped checks ([3969c632](../../commit/3969c632))
- add detailed coordinator logging for performance debugging ([32fbb6be](../../commit/32fbb6be))
- add project list to repo detail page ([97a3b4b3](../../commit/97a3b4b3))
- show session names in browse UI instead of UUIDs ([d11845de](../../commit/d11845de))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))
- implement deferred hook execution system ([96418bbd](../../commit/96418bbd))
- add session todos indexing and UI display ([dc161235](../../commit/dc161235))
- add coordinator-managed global slot system ([8c68e9c1](../../commit/8c68e9c1))
- add async workflow pattern with polling-based progress monitoring ([a91f7843](../../commit/a91f7843))
- add session ID hook for workflow/memory tool integration ([42a283db](../../commit/42a283db))

### Fixed

- canonicalize file paths in session changes and validation lookups ([3ce7bd31](../../commit/3ce7bd31))
- add 5-second timeout to TLS certificate fetches ([5298c8e5](../../commit/5298c8e5))
- treat SubagentStop as Stop hook for proper timeout handling ([5b09b88d](../../commit/5b09b88d))
- add 5s timeout to TLS certificate fetch ([defd5ffb](../../commit/defd5ffb))
- always skip Stop hooks when agent asks a question ([bcfcd9cb](../../commit/bcfcd9cb))
- detect implicit questions without question marks ([2e1aa67a](../../commit/2e1aa67a))
- run Stop hooks if file modifications occurred ([4b06b66c](../../commit/4b06b66c))
- skip Stop hooks for Q&A exchanges in both directions ([b93243fd](../../commit/b93243fd))
- create session before orchestration to satisfy FK constraint ([598a3c1d](../../commit/598a3c1d))
- delete stale validation records for deleted files ([5f34c3bc](../../commit/5f34c3bc))
- improve question detection in orchestrator skip logic ([4fe04442](../../commit/4fe04442))
- remove CORS wildcard from coordinator GraphQL server ([0321399c](../../commit/0321399c))
- prefix unused marketplace parameter with underscore ([bc038174](../../commit/bc038174))
- make port availability test more robust ([c5c8c598](../../commit/c5c8c598))
- fix syntax error in openBrowser callback ([41b6c544](../../commit/41b6c544))
- local mode always uses HTTP for offline scenarios ([60fb82df](../../commit/60fb82df))
- clarify hook failure attempt message ([15e71a32](../../commit/15e71a32))
- show correct GraphQL URL in console ([982b46ce](../../commit/982b46ce))
- support HTTPS in health check ([22ebc660](../../commit/22ebc660))
- remove duplicate coordinatorProtocol declaration ([3de087fb](../../commit/3de087fb))
- prevent caching for hooks without ifChanged filters ([837d0585](../../commit/837d0585))
- enable @defer support in GraphQL Yoga ([eb65532c](../../commit/eb65532c))
- correct HAN_FILES path handling for absolute paths ([beed531e](../../commit/beed531e))
- resolve biome lint warnings for HAN_FILES substitution ([3386d38e](../../commit/3386d38e))
- resolve markdownlint MD032 and MD025 errors in paper and blog ([bc9b8e20](../../commit/bc9b8e20))
- remove PluginMcpConfig export (interface no longer exists) ([b1413c79](../../commit/b1413c79))
- update memory provider tests for MCP-based discovery ([896522c0](../../commit/896522c0))
- address validation workflow failures ([947483db](../../commit/947483db))
- correct hook variable and remove unused variable ([79166255](../../commit/79166255))
- filter validation to only hooks matching session-changed files ([8eeb8c5d](../../commit/8eeb8c5d))
- prevent false positives in cache validation check ([4d53fe14](../../commit/4d53fe14))
- always record file validations regardless of session changes ([bc7d466a](../../commit/bc7d466a))
- remove composite cache key bug in orchestration and validation ([11245e12](../../commit/11245e12))
- resolve marketplace paths relative to project root, not CWD ([40a4e685](../../commit/40a4e685))
- resolve Stop hook orchestration loop with synchronous execution ([d29d4e9f](../../commit/d29d4e9f))
- Stop hooks now return within 5 seconds via timeout-based deferral ([ee6e11fc](../../commit/ee6e11fc))
- skip logging hook_run for han hook commands ([de986310](../../commit/de986310))
- fix failing tests due to module path and missing exports ([3ff76091](../../commit/3ff76091))

### Changed

- remove han_workflow system completely ([717d7b9b](../../commit/717d7b9b))
- extract health check logic into reusable function ([b866aeaf](../../commit/b866aeaf))
- always open browser, remove --no-open flag ([4a7a7544](../../commit/4a7a7544))
- restructure CLI commands to use coordinator subcommand ([7ecba4d5](../../commit/7ecba4d5))
- simplify memory provider auth via plugin inheritance ([ebed64a4](../../commit/ebed64a4))
- replace cache/checkpoints options with onlyChanged, always cache ([0b019ed2](../../commit/0b019ed2))
- replace HTML tags with React Native Web components ([beadc9ab](../../commit/beadc9ab))
- major codebase cleanup and consolidation ([94d9d6db](../../commit/94d9d6db))
- consolidate GraphQL and API implementations ([e633b374](../../commit/e633b374))
- update CLI, hooks, memory, and MCP tooling ([d7bd5df8](../../commit/d7bd5df8))

### Other

- add comprehensive tests for hash cycle detection ([853b25e1](../../commit/853b25e1))
- format build-info.generated.ts ([1677154d](../../commit/1677154d))
- auto-format plugin.json files with biome ([85bcf9d6](../../commit/85bcf9d6))
- format coordinator server CORS config ([bb41e4f3](../../commit/bb41e4f3))
- Merge branch 'fix/react-native-web-violations' ([bc5f78a8](../../commit/bc5f78a8))
- Merge pull request #34 from TheBushidoCollective/fix/cors-restrictions ([9859f865](../../commit/9859f865))
- use template literal for string concatenation ([1798f3b6](../../commit/1798f3b6))
- format blueprints.ts with biome ([48e133c6](../../commit/48e133c6))
- remove orphaned workflow system tests ([6a9e873c](../../commit/6a9e873c))
- skip flaky memory-storage tests ([b2e16080](../../commit/b2e16080))
- skip flaky session-file-validation test ([f3862ce1](../../commit/f3862ce1))
- apply biome formatting to shouldStayAlive ([0dc875de](../../commit/0dc875de))
- optimize SessionStart from 6s to 2s ([44595593](../../commit/44595593))
- add timeout protection to SessionStart hook queries ([08b33f7c](../../commit/08b33f7c))
- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))
- add comprehensive tests for deferred hook execution system ([843d31b6](../../commit/843d31b6))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [3.1.2] - 2026-01-26

### BREAKING CHANGES

- bump to v3.0.0 and fix workflow trigger token ([53a8cb8f](../../commit/53a8cb8f))

### Added

- implement hash cycle detection for hook recursion ([3de384ab](../../commit/3de384ab))
- add bundler plugins, package manager detection, and coordinator auto-start ([c7cb63f9](../../commit/c7cb63f9))
- add list_blueprints MCP tool ([7caf3e29](../../commit/7caf3e29))
- add --skip-if-questioning flag to Stop hooks ([04c326dd](../../commit/04c326dd))
- skip Stop hook check when agent is waiting for user input ([baba2d47](../../commit/baba2d47))
- hot-reload 6-day TLS certificates without restart ([a7a40ef0](../../commit/a7a40ef0))
- add --local flag for local vs remote dashboard ([7c609b69](../../commit/7c609b69))
- add keep-alive for active connections and sessions ([90cf11db](../../commit/90cf11db))
- add HookCheckStateMessage display in message timeline ([9a045168](../../commit/9a045168))
- add GraphQL @defer support for incremental data loading ([220d8724](../../commit/220d8724))
- add actionable hook failure guidance to SessionStart ([4d4fc2b5](../../commit/4d4fc2b5))
- use HAN_FILES from coordinator for session-scoped checks ([3969c632](../../commit/3969c632))
- add detailed coordinator logging for performance debugging ([32fbb6be](../../commit/32fbb6be))
- add project list to repo detail page ([97a3b4b3](../../commit/97a3b4b3))
- show session names in browse UI instead of UUIDs ([d11845de](../../commit/d11845de))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))
- implement deferred hook execution system ([96418bbd](../../commit/96418bbd))
- add session todos indexing and UI display ([dc161235](../../commit/dc161235))
- add coordinator-managed global slot system ([8c68e9c1](../../commit/8c68e9c1))
- add async workflow pattern with polling-based progress monitoring ([a91f7843](../../commit/a91f7843))
- add session ID hook for workflow/memory tool integration ([42a283db](../../commit/42a283db))

### Fixed

- canonicalize file paths in session changes and validation lookups ([3ce7bd31](../../commit/3ce7bd31))
- add 5-second timeout to TLS certificate fetches ([5298c8e5](../../commit/5298c8e5))
- treat SubagentStop as Stop hook for proper timeout handling ([5b09b88d](../../commit/5b09b88d))
- add 5s timeout to TLS certificate fetch ([defd5ffb](../../commit/defd5ffb))
- always skip Stop hooks when agent asks a question ([bcfcd9cb](../../commit/bcfcd9cb))
- detect implicit questions without question marks ([2e1aa67a](../../commit/2e1aa67a))
- run Stop hooks if file modifications occurred ([4b06b66c](../../commit/4b06b66c))
- skip Stop hooks for Q&A exchanges in both directions ([b93243fd](../../commit/b93243fd))
- create session before orchestration to satisfy FK constraint ([598a3c1d](../../commit/598a3c1d))
- delete stale validation records for deleted files ([5f34c3bc](../../commit/5f34c3bc))
- improve question detection in orchestrator skip logic ([4fe04442](../../commit/4fe04442))
- remove CORS wildcard from coordinator GraphQL server ([0321399c](../../commit/0321399c))
- prefix unused marketplace parameter with underscore ([bc038174](../../commit/bc038174))
- make port availability test more robust ([c5c8c598](../../commit/c5c8c598))
- fix syntax error in openBrowser callback ([41b6c544](../../commit/41b6c544))
- local mode always uses HTTP for offline scenarios ([60fb82df](../../commit/60fb82df))
- clarify hook failure attempt message ([15e71a32](../../commit/15e71a32))
- show correct GraphQL URL in console ([982b46ce](../../commit/982b46ce))
- support HTTPS in health check ([22ebc660](../../commit/22ebc660))
- remove duplicate coordinatorProtocol declaration ([3de087fb](../../commit/3de087fb))
- prevent caching for hooks without ifChanged filters ([837d0585](../../commit/837d0585))
- enable @defer support in GraphQL Yoga ([eb65532c](../../commit/eb65532c))
- correct HAN_FILES path handling for absolute paths ([beed531e](../../commit/beed531e))
- resolve biome lint warnings for HAN_FILES substitution ([3386d38e](../../commit/3386d38e))
- resolve markdownlint MD032 and MD025 errors in paper and blog ([bc9b8e20](../../commit/bc9b8e20))
- remove PluginMcpConfig export (interface no longer exists) ([b1413c79](../../commit/b1413c79))
- update memory provider tests for MCP-based discovery ([896522c0](../../commit/896522c0))
- address validation workflow failures ([947483db](../../commit/947483db))
- correct hook variable and remove unused variable ([79166255](../../commit/79166255))
- filter validation to only hooks matching session-changed files ([8eeb8c5d](../../commit/8eeb8c5d))
- prevent false positives in cache validation check ([4d53fe14](../../commit/4d53fe14))
- always record file validations regardless of session changes ([bc7d466a](../../commit/bc7d466a))
- remove composite cache key bug in orchestration and validation ([11245e12](../../commit/11245e12))
- resolve marketplace paths relative to project root, not CWD ([40a4e685](../../commit/40a4e685))
- resolve Stop hook orchestration loop with synchronous execution ([d29d4e9f](../../commit/d29d4e9f))
- Stop hooks now return within 5 seconds via timeout-based deferral ([ee6e11fc](../../commit/ee6e11fc))
- skip logging hook_run for han hook commands ([de986310](../../commit/de986310))
- fix failing tests due to module path and missing exports ([3ff76091](../../commit/3ff76091))

### Changed

- remove han_workflow system completely ([717d7b9b](../../commit/717d7b9b))
- extract health check logic into reusable function ([b866aeaf](../../commit/b866aeaf))
- always open browser, remove --no-open flag ([4a7a7544](../../commit/4a7a7544))
- restructure CLI commands to use coordinator subcommand ([7ecba4d5](../../commit/7ecba4d5))
- simplify memory provider auth via plugin inheritance ([ebed64a4](../../commit/ebed64a4))
- replace cache/checkpoints options with onlyChanged, always cache ([0b019ed2](../../commit/0b019ed2))
- replace HTML tags with React Native Web components ([beadc9ab](../../commit/beadc9ab))
- major codebase cleanup and consolidation ([94d9d6db](../../commit/94d9d6db))
- consolidate GraphQL and API implementations ([e633b374](../../commit/e633b374))
- update CLI, hooks, memory, and MCP tooling ([d7bd5df8](../../commit/d7bd5df8))

### Other

- add comprehensive tests for hash cycle detection ([853b25e1](../../commit/853b25e1))
- format build-info.generated.ts ([1677154d](../../commit/1677154d))
- auto-format plugin.json files with biome ([85bcf9d6](../../commit/85bcf9d6))
- format coordinator server CORS config ([bb41e4f3](../../commit/bb41e4f3))
- Merge branch 'fix/react-native-web-violations' ([bc5f78a8](../../commit/bc5f78a8))
- Merge pull request #34 from TheBushidoCollective/fix/cors-restrictions ([9859f865](../../commit/9859f865))
- use template literal for string concatenation ([1798f3b6](../../commit/1798f3b6))
- format blueprints.ts with biome ([48e133c6](../../commit/48e133c6))
- remove orphaned workflow system tests ([6a9e873c](../../commit/6a9e873c))
- skip flaky memory-storage tests ([b2e16080](../../commit/b2e16080))
- skip flaky session-file-validation test ([f3862ce1](../../commit/f3862ce1))
- apply biome formatting to shouldStayAlive ([0dc875de](../../commit/0dc875de))
- optimize SessionStart from 6s to 2s ([44595593](../../commit/44595593))
- add timeout protection to SessionStart hook queries ([08b33f7c](../../commit/08b33f7c))
- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))
- add comprehensive tests for deferred hook execution system ([843d31b6](../../commit/843d31b6))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [3.1.1] - 2026-01-26

### BREAKING CHANGES

- bump to v3.0.0 and fix workflow trigger token ([53a8cb8f](../../commit/53a8cb8f))

### Added

- add bundler plugins, package manager detection, and coordinator auto-start ([c7cb63f9](../../commit/c7cb63f9))
- add list_blueprints MCP tool ([7caf3e29](../../commit/7caf3e29))
- add --skip-if-questioning flag to Stop hooks ([04c326dd](../../commit/04c326dd))
- skip Stop hook check when agent is waiting for user input ([baba2d47](../../commit/baba2d47))
- hot-reload 6-day TLS certificates without restart ([a7a40ef0](../../commit/a7a40ef0))
- add --local flag for local vs remote dashboard ([7c609b69](../../commit/7c609b69))
- add keep-alive for active connections and sessions ([90cf11db](../../commit/90cf11db))
- add HookCheckStateMessage display in message timeline ([9a045168](../../commit/9a045168))
- add GraphQL @defer support for incremental data loading ([220d8724](../../commit/220d8724))
- add actionable hook failure guidance to SessionStart ([4d4fc2b5](../../commit/4d4fc2b5))
- use HAN_FILES from coordinator for session-scoped checks ([3969c632](../../commit/3969c632))
- add detailed coordinator logging for performance debugging ([32fbb6be](../../commit/32fbb6be))
- add project list to repo detail page ([97a3b4b3](../../commit/97a3b4b3))
- show session names in browse UI instead of UUIDs ([d11845de](../../commit/d11845de))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))
- implement deferred hook execution system ([96418bbd](../../commit/96418bbd))
- add session todos indexing and UI display ([dc161235](../../commit/dc161235))
- add coordinator-managed global slot system ([8c68e9c1](../../commit/8c68e9c1))
- add async workflow pattern with polling-based progress monitoring ([a91f7843](../../commit/a91f7843))
- add session ID hook for workflow/memory tool integration ([42a283db](../../commit/42a283db))

### Fixed

- add 5s timeout to TLS certificate fetch ([defd5ffb](../../commit/defd5ffb))
- always skip Stop hooks when agent asks a question ([bcfcd9cb](../../commit/bcfcd9cb))
- detect implicit questions without question marks ([2e1aa67a](../../commit/2e1aa67a))
- run Stop hooks if file modifications occurred ([4b06b66c](../../commit/4b06b66c))
- skip Stop hooks for Q&A exchanges in both directions ([b93243fd](../../commit/b93243fd))
- create session before orchestration to satisfy FK constraint ([598a3c1d](../../commit/598a3c1d))
- delete stale validation records for deleted files ([5f34c3bc](../../commit/5f34c3bc))
- improve question detection in orchestrator skip logic ([4fe04442](../../commit/4fe04442))
- remove CORS wildcard from coordinator GraphQL server ([0321399c](../../commit/0321399c))
- prefix unused marketplace parameter with underscore ([bc038174](../../commit/bc038174))
- make port availability test more robust ([c5c8c598](../../commit/c5c8c598))
- fix syntax error in openBrowser callback ([41b6c544](../../commit/41b6c544))
- local mode always uses HTTP for offline scenarios ([60fb82df](../../commit/60fb82df))
- clarify hook failure attempt message ([15e71a32](../../commit/15e71a32))
- show correct GraphQL URL in console ([982b46ce](../../commit/982b46ce))
- support HTTPS in health check ([22ebc660](../../commit/22ebc660))
- remove duplicate coordinatorProtocol declaration ([3de087fb](../../commit/3de087fb))
- prevent caching for hooks without ifChanged filters ([837d0585](../../commit/837d0585))
- enable @defer support in GraphQL Yoga ([eb65532c](../../commit/eb65532c))
- correct HAN_FILES path handling for absolute paths ([beed531e](../../commit/beed531e))
- resolve biome lint warnings for HAN_FILES substitution ([3386d38e](../../commit/3386d38e))
- resolve markdownlint MD032 and MD025 errors in paper and blog ([bc9b8e20](../../commit/bc9b8e20))
- remove PluginMcpConfig export (interface no longer exists) ([b1413c79](../../commit/b1413c79))
- update memory provider tests for MCP-based discovery ([896522c0](../../commit/896522c0))
- address validation workflow failures ([947483db](../../commit/947483db))
- correct hook variable and remove unused variable ([79166255](../../commit/79166255))
- filter validation to only hooks matching session-changed files ([8eeb8c5d](../../commit/8eeb8c5d))
- prevent false positives in cache validation check ([4d53fe14](../../commit/4d53fe14))
- always record file validations regardless of session changes ([bc7d466a](../../commit/bc7d466a))
- remove composite cache key bug in orchestration and validation ([11245e12](../../commit/11245e12))
- resolve marketplace paths relative to project root, not CWD ([40a4e685](../../commit/40a4e685))
- resolve Stop hook orchestration loop with synchronous execution ([d29d4e9f](../../commit/d29d4e9f))
- Stop hooks now return within 5 seconds via timeout-based deferral ([ee6e11fc](../../commit/ee6e11fc))
- skip logging hook_run for han hook commands ([de986310](../../commit/de986310))
- fix failing tests due to module path and missing exports ([3ff76091](../../commit/3ff76091))

### Changed

- remove han_workflow system completely ([717d7b9b](../../commit/717d7b9b))
- extract health check logic into reusable function ([b866aeaf](../../commit/b866aeaf))
- always open browser, remove --no-open flag ([4a7a7544](../../commit/4a7a7544))
- restructure CLI commands to use coordinator subcommand ([7ecba4d5](../../commit/7ecba4d5))
- simplify memory provider auth via plugin inheritance ([ebed64a4](../../commit/ebed64a4))
- replace cache/checkpoints options with onlyChanged, always cache ([0b019ed2](../../commit/0b019ed2))
- replace HTML tags with React Native Web components ([beadc9ab](../../commit/beadc9ab))
- major codebase cleanup and consolidation ([94d9d6db](../../commit/94d9d6db))
- consolidate GraphQL and API implementations ([e633b374](../../commit/e633b374))
- update CLI, hooks, memory, and MCP tooling ([d7bd5df8](../../commit/d7bd5df8))

### Other

- format coordinator server CORS config ([bb41e4f3](../../commit/bb41e4f3))
- Merge branch 'fix/react-native-web-violations' ([bc5f78a8](../../commit/bc5f78a8))
- Merge pull request #34 from TheBushidoCollective/fix/cors-restrictions ([9859f865](../../commit/9859f865))
- use template literal for string concatenation ([1798f3b6](../../commit/1798f3b6))
- format blueprints.ts with biome ([48e133c6](../../commit/48e133c6))
- remove orphaned workflow system tests ([6a9e873c](../../commit/6a9e873c))
- skip flaky memory-storage tests ([b2e16080](../../commit/b2e16080))
- skip flaky session-file-validation test ([f3862ce1](../../commit/f3862ce1))
- apply biome formatting to shouldStayAlive ([0dc875de](../../commit/0dc875de))
- optimize SessionStart from 6s to 2s ([44595593](../../commit/44595593))
- add timeout protection to SessionStart hook queries ([08b33f7c](../../commit/08b33f7c))
- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))
- add comprehensive tests for deferred hook execution system ([843d31b6](../../commit/843d31b6))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [3.1.0] - 2026-01-26

### BREAKING CHANGES

- bump to v3.0.0 and fix workflow trigger token ([53a8cb8f](../../commit/53a8cb8f))

### Added

- add bundler plugins, package manager detection, and coordinator auto-start ([c7cb63f9](../../commit/c7cb63f9))
- add list_blueprints MCP tool ([7caf3e29](../../commit/7caf3e29))
- add --skip-if-questioning flag to Stop hooks ([04c326dd](../../commit/04c326dd))
- skip Stop hook check when agent is waiting for user input ([baba2d47](../../commit/baba2d47))
- hot-reload 6-day TLS certificates without restart ([a7a40ef0](../../commit/a7a40ef0))
- add --local flag for local vs remote dashboard ([7c609b69](../../commit/7c609b69))
- add keep-alive for active connections and sessions ([90cf11db](../../commit/90cf11db))
- add HookCheckStateMessage display in message timeline ([9a045168](../../commit/9a045168))
- add GraphQL @defer support for incremental data loading ([220d8724](../../commit/220d8724))
- add actionable hook failure guidance to SessionStart ([4d4fc2b5](../../commit/4d4fc2b5))
- use HAN_FILES from coordinator for session-scoped checks ([3969c632](../../commit/3969c632))
- add detailed coordinator logging for performance debugging ([32fbb6be](../../commit/32fbb6be))
- add project list to repo detail page ([97a3b4b3](../../commit/97a3b4b3))
- show session names in browse UI instead of UUIDs ([d11845de](../../commit/d11845de))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))
- implement deferred hook execution system ([96418bbd](../../commit/96418bbd))
- add session todos indexing and UI display ([dc161235](../../commit/dc161235))
- add coordinator-managed global slot system ([8c68e9c1](../../commit/8c68e9c1))
- add async workflow pattern with polling-based progress monitoring ([a91f7843](../../commit/a91f7843))
- add session ID hook for workflow/memory tool integration ([42a283db](../../commit/42a283db))

### Fixed

- detect implicit questions without question marks ([2e1aa67a](../../commit/2e1aa67a))
- run Stop hooks if file modifications occurred ([4b06b66c](../../commit/4b06b66c))
- skip Stop hooks for Q&A exchanges in both directions ([b93243fd](../../commit/b93243fd))
- create session before orchestration to satisfy FK constraint ([598a3c1d](../../commit/598a3c1d))
- delete stale validation records for deleted files ([5f34c3bc](../../commit/5f34c3bc))
- improve question detection in orchestrator skip logic ([4fe04442](../../commit/4fe04442))
- remove CORS wildcard from coordinator GraphQL server ([0321399c](../../commit/0321399c))
- prefix unused marketplace parameter with underscore ([bc038174](../../commit/bc038174))
- make port availability test more robust ([c5c8c598](../../commit/c5c8c598))
- fix syntax error in openBrowser callback ([41b6c544](../../commit/41b6c544))
- local mode always uses HTTP for offline scenarios ([60fb82df](../../commit/60fb82df))
- clarify hook failure attempt message ([15e71a32](../../commit/15e71a32))
- show correct GraphQL URL in console ([982b46ce](../../commit/982b46ce))
- support HTTPS in health check ([22ebc660](../../commit/22ebc660))
- remove duplicate coordinatorProtocol declaration ([3de087fb](../../commit/3de087fb))
- prevent caching for hooks without ifChanged filters ([837d0585](../../commit/837d0585))
- enable @defer support in GraphQL Yoga ([eb65532c](../../commit/eb65532c))
- correct HAN_FILES path handling for absolute paths ([beed531e](../../commit/beed531e))
- resolve biome lint warnings for HAN_FILES substitution ([3386d38e](../../commit/3386d38e))
- resolve markdownlint MD032 and MD025 errors in paper and blog ([bc9b8e20](../../commit/bc9b8e20))
- remove PluginMcpConfig export (interface no longer exists) ([b1413c79](../../commit/b1413c79))
- update memory provider tests for MCP-based discovery ([896522c0](../../commit/896522c0))
- address validation workflow failures ([947483db](../../commit/947483db))
- correct hook variable and remove unused variable ([79166255](../../commit/79166255))
- filter validation to only hooks matching session-changed files ([8eeb8c5d](../../commit/8eeb8c5d))
- prevent false positives in cache validation check ([4d53fe14](../../commit/4d53fe14))
- always record file validations regardless of session changes ([bc7d466a](../../commit/bc7d466a))
- remove composite cache key bug in orchestration and validation ([11245e12](../../commit/11245e12))
- resolve marketplace paths relative to project root, not CWD ([40a4e685](../../commit/40a4e685))
- resolve Stop hook orchestration loop with synchronous execution ([d29d4e9f](../../commit/d29d4e9f))
- Stop hooks now return within 5 seconds via timeout-based deferral ([ee6e11fc](../../commit/ee6e11fc))
- skip logging hook_run for han hook commands ([de986310](../../commit/de986310))
- fix failing tests due to module path and missing exports ([3ff76091](../../commit/3ff76091))

### Changed

- remove han_workflow system completely ([717d7b9b](../../commit/717d7b9b))
- extract health check logic into reusable function ([b866aeaf](../../commit/b866aeaf))
- always open browser, remove --no-open flag ([4a7a7544](../../commit/4a7a7544))
- restructure CLI commands to use coordinator subcommand ([7ecba4d5](../../commit/7ecba4d5))
- simplify memory provider auth via plugin inheritance ([ebed64a4](../../commit/ebed64a4))
- replace cache/checkpoints options with onlyChanged, always cache ([0b019ed2](../../commit/0b019ed2))
- replace HTML tags with React Native Web components ([beadc9ab](../../commit/beadc9ab))
- major codebase cleanup and consolidation ([94d9d6db](../../commit/94d9d6db))
- consolidate GraphQL and API implementations ([e633b374](../../commit/e633b374))
- update CLI, hooks, memory, and MCP tooling ([d7bd5df8](../../commit/d7bd5df8))

### Other

- format coordinator server CORS config ([bb41e4f3](../../commit/bb41e4f3))
- Merge branch 'fix/react-native-web-violations' ([bc5f78a8](../../commit/bc5f78a8))
- Merge pull request #34 from TheBushidoCollective/fix/cors-restrictions ([9859f865](../../commit/9859f865))
- use template literal for string concatenation ([1798f3b6](../../commit/1798f3b6))
- format blueprints.ts with biome ([48e133c6](../../commit/48e133c6))
- remove orphaned workflow system tests ([6a9e873c](../../commit/6a9e873c))
- skip flaky memory-storage tests ([b2e16080](../../commit/b2e16080))
- skip flaky session-file-validation test ([f3862ce1](../../commit/f3862ce1))
- apply biome formatting to shouldStayAlive ([0dc875de](../../commit/0dc875de))
- optimize SessionStart from 6s to 2s ([44595593](../../commit/44595593))
- add timeout protection to SessionStart hook queries ([08b33f7c](../../commit/08b33f7c))
- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))
- add comprehensive tests for deferred hook execution system ([843d31b6](../../commit/843d31b6))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [3.0.3] - 2026-01-26

### BREAKING CHANGES

- bump to v3.0.0 and fix workflow trigger token ([53a8cb8f](../../commit/53a8cb8f))

### Added

- add list_blueprints MCP tool ([7caf3e29](../../commit/7caf3e29))
- add --skip-if-questioning flag to Stop hooks ([04c326dd](../../commit/04c326dd))
- skip Stop hook check when agent is waiting for user input ([baba2d47](../../commit/baba2d47))
- hot-reload 6-day TLS certificates without restart ([a7a40ef0](../../commit/a7a40ef0))
- add --local flag for local vs remote dashboard ([7c609b69](../../commit/7c609b69))
- add keep-alive for active connections and sessions ([90cf11db](../../commit/90cf11db))
- add HookCheckStateMessage display in message timeline ([9a045168](../../commit/9a045168))
- add GraphQL @defer support for incremental data loading ([220d8724](../../commit/220d8724))
- add actionable hook failure guidance to SessionStart ([4d4fc2b5](../../commit/4d4fc2b5))
- use HAN_FILES from coordinator for session-scoped checks ([3969c632](../../commit/3969c632))
- add detailed coordinator logging for performance debugging ([32fbb6be](../../commit/32fbb6be))
- add project list to repo detail page ([97a3b4b3](../../commit/97a3b4b3))
- show session names in browse UI instead of UUIDs ([d11845de](../../commit/d11845de))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))
- implement deferred hook execution system ([96418bbd](../../commit/96418bbd))
- add session todos indexing and UI display ([dc161235](../../commit/dc161235))
- add coordinator-managed global slot system ([8c68e9c1](../../commit/8c68e9c1))
- add async workflow pattern with polling-based progress monitoring ([a91f7843](../../commit/a91f7843))
- add session ID hook for workflow/memory tool integration ([42a283db](../../commit/42a283db))

### Fixed

- detect implicit questions without question marks ([2e1aa67a](../../commit/2e1aa67a))
- run Stop hooks if file modifications occurred ([4b06b66c](../../commit/4b06b66c))
- skip Stop hooks for Q&A exchanges in both directions ([b93243fd](../../commit/b93243fd))
- create session before orchestration to satisfy FK constraint ([598a3c1d](../../commit/598a3c1d))
- delete stale validation records for deleted files ([5f34c3bc](../../commit/5f34c3bc))
- improve question detection in orchestrator skip logic ([4fe04442](../../commit/4fe04442))
- remove CORS wildcard from coordinator GraphQL server ([0321399c](../../commit/0321399c))
- prefix unused marketplace parameter with underscore ([bc038174](../../commit/bc038174))
- make port availability test more robust ([c5c8c598](../../commit/c5c8c598))
- fix syntax error in openBrowser callback ([41b6c544](../../commit/41b6c544))
- local mode always uses HTTP for offline scenarios ([60fb82df](../../commit/60fb82df))
- clarify hook failure attempt message ([15e71a32](../../commit/15e71a32))
- show correct GraphQL URL in console ([982b46ce](../../commit/982b46ce))
- support HTTPS in health check ([22ebc660](../../commit/22ebc660))
- remove duplicate coordinatorProtocol declaration ([3de087fb](../../commit/3de087fb))
- prevent caching for hooks without ifChanged filters ([837d0585](../../commit/837d0585))
- enable @defer support in GraphQL Yoga ([eb65532c](../../commit/eb65532c))
- correct HAN_FILES path handling for absolute paths ([beed531e](../../commit/beed531e))
- resolve biome lint warnings for HAN_FILES substitution ([3386d38e](../../commit/3386d38e))
- resolve markdownlint MD032 and MD025 errors in paper and blog ([bc9b8e20](../../commit/bc9b8e20))
- remove PluginMcpConfig export (interface no longer exists) ([b1413c79](../../commit/b1413c79))
- update memory provider tests for MCP-based discovery ([896522c0](../../commit/896522c0))
- address validation workflow failures ([947483db](../../commit/947483db))
- correct hook variable and remove unused variable ([79166255](../../commit/79166255))
- filter validation to only hooks matching session-changed files ([8eeb8c5d](../../commit/8eeb8c5d))
- prevent false positives in cache validation check ([4d53fe14](../../commit/4d53fe14))
- always record file validations regardless of session changes ([bc7d466a](../../commit/bc7d466a))
- remove composite cache key bug in orchestration and validation ([11245e12](../../commit/11245e12))
- resolve marketplace paths relative to project root, not CWD ([40a4e685](../../commit/40a4e685))
- resolve Stop hook orchestration loop with synchronous execution ([d29d4e9f](../../commit/d29d4e9f))
- Stop hooks now return within 5 seconds via timeout-based deferral ([ee6e11fc](../../commit/ee6e11fc))
- skip logging hook_run for han hook commands ([de986310](../../commit/de986310))
- fix failing tests due to module path and missing exports ([3ff76091](../../commit/3ff76091))

### Changed

- remove han_workflow system completely ([717d7b9b](../../commit/717d7b9b))
- extract health check logic into reusable function ([b866aeaf](../../commit/b866aeaf))
- always open browser, remove --no-open flag ([4a7a7544](../../commit/4a7a7544))
- restructure CLI commands to use coordinator subcommand ([7ecba4d5](../../commit/7ecba4d5))
- simplify memory provider auth via plugin inheritance ([ebed64a4](../../commit/ebed64a4))
- replace cache/checkpoints options with onlyChanged, always cache ([0b019ed2](../../commit/0b019ed2))
- replace HTML tags with React Native Web components ([beadc9ab](../../commit/beadc9ab))
- major codebase cleanup and consolidation ([94d9d6db](../../commit/94d9d6db))
- consolidate GraphQL and API implementations ([e633b374](../../commit/e633b374))
- update CLI, hooks, memory, and MCP tooling ([d7bd5df8](../../commit/d7bd5df8))

### Other

- format coordinator server CORS config ([bb41e4f3](../../commit/bb41e4f3))
- Merge branch 'fix/react-native-web-violations' ([bc5f78a8](../../commit/bc5f78a8))
- Merge pull request #34 from TheBushidoCollective/fix/cors-restrictions ([9859f865](../../commit/9859f865))
- use template literal for string concatenation ([1798f3b6](../../commit/1798f3b6))
- format blueprints.ts with biome ([48e133c6](../../commit/48e133c6))
- remove orphaned workflow system tests ([6a9e873c](../../commit/6a9e873c))
- skip flaky memory-storage tests ([b2e16080](../../commit/b2e16080))
- skip flaky session-file-validation test ([f3862ce1](../../commit/f3862ce1))
- apply biome formatting to shouldStayAlive ([0dc875de](../../commit/0dc875de))
- optimize SessionStart from 6s to 2s ([44595593](../../commit/44595593))
- add timeout protection to SessionStart hook queries ([08b33f7c](../../commit/08b33f7c))
- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))
- add comprehensive tests for deferred hook execution system ([843d31b6](../../commit/843d31b6))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [3.0.2] - 2026-01-26

### BREAKING CHANGES

- bump to v3.0.0 and fix workflow trigger token ([53a8cb8f](../../commit/53a8cb8f))

### Added

- add list_blueprints MCP tool ([7caf3e29](../../commit/7caf3e29))
- add --skip-if-questioning flag to Stop hooks ([04c326dd](../../commit/04c326dd))
- skip Stop hook check when agent is waiting for user input ([baba2d47](../../commit/baba2d47))
- hot-reload 6-day TLS certificates without restart ([a7a40ef0](../../commit/a7a40ef0))
- add --local flag for local vs remote dashboard ([7c609b69](../../commit/7c609b69))
- add keep-alive for active connections and sessions ([90cf11db](../../commit/90cf11db))
- add HookCheckStateMessage display in message timeline ([9a045168](../../commit/9a045168))
- add GraphQL @defer support for incremental data loading ([220d8724](../../commit/220d8724))
- add actionable hook failure guidance to SessionStart ([4d4fc2b5](../../commit/4d4fc2b5))
- use HAN_FILES from coordinator for session-scoped checks ([3969c632](../../commit/3969c632))
- add detailed coordinator logging for performance debugging ([32fbb6be](../../commit/32fbb6be))
- add project list to repo detail page ([97a3b4b3](../../commit/97a3b4b3))
- show session names in browse UI instead of UUIDs ([d11845de](../../commit/d11845de))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))
- implement deferred hook execution system ([96418bbd](../../commit/96418bbd))
- add session todos indexing and UI display ([dc161235](../../commit/dc161235))
- add coordinator-managed global slot system ([8c68e9c1](../../commit/8c68e9c1))
- add async workflow pattern with polling-based progress monitoring ([a91f7843](../../commit/a91f7843))
- add session ID hook for workflow/memory tool integration ([42a283db](../../commit/42a283db))

### Fixed

- run Stop hooks if file modifications occurred ([4b06b66c](../../commit/4b06b66c))
- skip Stop hooks for Q&A exchanges in both directions ([b93243fd](../../commit/b93243fd))
- create session before orchestration to satisfy FK constraint ([598a3c1d](../../commit/598a3c1d))
- delete stale validation records for deleted files ([5f34c3bc](../../commit/5f34c3bc))
- improve question detection in orchestrator skip logic ([4fe04442](../../commit/4fe04442))
- remove CORS wildcard from coordinator GraphQL server ([0321399c](../../commit/0321399c))
- prefix unused marketplace parameter with underscore ([bc038174](../../commit/bc038174))
- make port availability test more robust ([c5c8c598](../../commit/c5c8c598))
- fix syntax error in openBrowser callback ([41b6c544](../../commit/41b6c544))
- local mode always uses HTTP for offline scenarios ([60fb82df](../../commit/60fb82df))
- clarify hook failure attempt message ([15e71a32](../../commit/15e71a32))
- show correct GraphQL URL in console ([982b46ce](../../commit/982b46ce))
- support HTTPS in health check ([22ebc660](../../commit/22ebc660))
- remove duplicate coordinatorProtocol declaration ([3de087fb](../../commit/3de087fb))
- prevent caching for hooks without ifChanged filters ([837d0585](../../commit/837d0585))
- enable @defer support in GraphQL Yoga ([eb65532c](../../commit/eb65532c))
- correct HAN_FILES path handling for absolute paths ([beed531e](../../commit/beed531e))
- resolve biome lint warnings for HAN_FILES substitution ([3386d38e](../../commit/3386d38e))
- resolve markdownlint MD032 and MD025 errors in paper and blog ([bc9b8e20](../../commit/bc9b8e20))
- remove PluginMcpConfig export (interface no longer exists) ([b1413c79](../../commit/b1413c79))
- update memory provider tests for MCP-based discovery ([896522c0](../../commit/896522c0))
- address validation workflow failures ([947483db](../../commit/947483db))
- correct hook variable and remove unused variable ([79166255](../../commit/79166255))
- filter validation to only hooks matching session-changed files ([8eeb8c5d](../../commit/8eeb8c5d))
- prevent false positives in cache validation check ([4d53fe14](../../commit/4d53fe14))
- always record file validations regardless of session changes ([bc7d466a](../../commit/bc7d466a))
- remove composite cache key bug in orchestration and validation ([11245e12](../../commit/11245e12))
- resolve marketplace paths relative to project root, not CWD ([40a4e685](../../commit/40a4e685))
- resolve Stop hook orchestration loop with synchronous execution ([d29d4e9f](../../commit/d29d4e9f))
- Stop hooks now return within 5 seconds via timeout-based deferral ([ee6e11fc](../../commit/ee6e11fc))
- skip logging hook_run for han hook commands ([de986310](../../commit/de986310))
- fix failing tests due to module path and missing exports ([3ff76091](../../commit/3ff76091))

### Changed

- remove han_workflow system completely ([717d7b9b](../../commit/717d7b9b))
- extract health check logic into reusable function ([b866aeaf](../../commit/b866aeaf))
- always open browser, remove --no-open flag ([4a7a7544](../../commit/4a7a7544))
- restructure CLI commands to use coordinator subcommand ([7ecba4d5](../../commit/7ecba4d5))
- simplify memory provider auth via plugin inheritance ([ebed64a4](../../commit/ebed64a4))
- replace cache/checkpoints options with onlyChanged, always cache ([0b019ed2](../../commit/0b019ed2))
- replace HTML tags with React Native Web components ([beadc9ab](../../commit/beadc9ab))
- major codebase cleanup and consolidation ([94d9d6db](../../commit/94d9d6db))
- consolidate GraphQL and API implementations ([e633b374](../../commit/e633b374))
- update CLI, hooks, memory, and MCP tooling ([d7bd5df8](../../commit/d7bd5df8))

### Other

- format coordinator server CORS config ([bb41e4f3](../../commit/bb41e4f3))
- Merge branch 'fix/react-native-web-violations' ([bc5f78a8](../../commit/bc5f78a8))
- Merge pull request #34 from TheBushidoCollective/fix/cors-restrictions ([9859f865](../../commit/9859f865))
- use template literal for string concatenation ([1798f3b6](../../commit/1798f3b6))
- format blueprints.ts with biome ([48e133c6](../../commit/48e133c6))
- remove orphaned workflow system tests ([6a9e873c](../../commit/6a9e873c))
- skip flaky memory-storage tests ([b2e16080](../../commit/b2e16080))
- skip flaky session-file-validation test ([f3862ce1](../../commit/f3862ce1))
- apply biome formatting to shouldStayAlive ([0dc875de](../../commit/0dc875de))
- optimize SessionStart from 6s to 2s ([44595593](../../commit/44595593))
- add timeout protection to SessionStart hook queries ([08b33f7c](../../commit/08b33f7c))
- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))
- add comprehensive tests for deferred hook execution system ([843d31b6](../../commit/843d31b6))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [3.0.1] - 2026-01-26

### BREAKING CHANGES

- bump to v3.0.0 and fix workflow trigger token ([53a8cb8f](../../commit/53a8cb8f))

### Added

- add list_blueprints MCP tool ([7caf3e29](../../commit/7caf3e29))
- add --skip-if-questioning flag to Stop hooks ([04c326dd](../../commit/04c326dd))
- skip Stop hook check when agent is waiting for user input ([baba2d47](../../commit/baba2d47))
- hot-reload 6-day TLS certificates without restart ([a7a40ef0](../../commit/a7a40ef0))
- add --local flag for local vs remote dashboard ([7c609b69](../../commit/7c609b69))
- add keep-alive for active connections and sessions ([90cf11db](../../commit/90cf11db))
- add HookCheckStateMessage display in message timeline ([9a045168](../../commit/9a045168))
- add GraphQL @defer support for incremental data loading ([220d8724](../../commit/220d8724))
- add actionable hook failure guidance to SessionStart ([4d4fc2b5](../../commit/4d4fc2b5))
- use HAN_FILES from coordinator for session-scoped checks ([3969c632](../../commit/3969c632))
- add detailed coordinator logging for performance debugging ([32fbb6be](../../commit/32fbb6be))
- add project list to repo detail page ([97a3b4b3](../../commit/97a3b4b3))
- show session names in browse UI instead of UUIDs ([d11845de](../../commit/d11845de))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))
- implement deferred hook execution system ([96418bbd](../../commit/96418bbd))
- add session todos indexing and UI display ([dc161235](../../commit/dc161235))
- add coordinator-managed global slot system ([8c68e9c1](../../commit/8c68e9c1))
- add async workflow pattern with polling-based progress monitoring ([a91f7843](../../commit/a91f7843))
- add session ID hook for workflow/memory tool integration ([42a283db](../../commit/42a283db))

### Fixed

- skip Stop hooks for Q&A exchanges in both directions ([b93243fd](../../commit/b93243fd))
- create session before orchestration to satisfy FK constraint ([598a3c1d](../../commit/598a3c1d))
- delete stale validation records for deleted files ([5f34c3bc](../../commit/5f34c3bc))
- improve question detection in orchestrator skip logic ([4fe04442](../../commit/4fe04442))
- remove CORS wildcard from coordinator GraphQL server ([0321399c](../../commit/0321399c))
- prefix unused marketplace parameter with underscore ([bc038174](../../commit/bc038174))
- make port availability test more robust ([c5c8c598](../../commit/c5c8c598))
- fix syntax error in openBrowser callback ([41b6c544](../../commit/41b6c544))
- local mode always uses HTTP for offline scenarios ([60fb82df](../../commit/60fb82df))
- clarify hook failure attempt message ([15e71a32](../../commit/15e71a32))
- show correct GraphQL URL in console ([982b46ce](../../commit/982b46ce))
- support HTTPS in health check ([22ebc660](../../commit/22ebc660))
- remove duplicate coordinatorProtocol declaration ([3de087fb](../../commit/3de087fb))
- prevent caching for hooks without ifChanged filters ([837d0585](../../commit/837d0585))
- enable @defer support in GraphQL Yoga ([eb65532c](../../commit/eb65532c))
- correct HAN_FILES path handling for absolute paths ([beed531e](../../commit/beed531e))
- resolve biome lint warnings for HAN_FILES substitution ([3386d38e](../../commit/3386d38e))
- resolve markdownlint MD032 and MD025 errors in paper and blog ([bc9b8e20](../../commit/bc9b8e20))
- remove PluginMcpConfig export (interface no longer exists) ([b1413c79](../../commit/b1413c79))
- update memory provider tests for MCP-based discovery ([896522c0](../../commit/896522c0))
- address validation workflow failures ([947483db](../../commit/947483db))
- correct hook variable and remove unused variable ([79166255](../../commit/79166255))
- filter validation to only hooks matching session-changed files ([8eeb8c5d](../../commit/8eeb8c5d))
- prevent false positives in cache validation check ([4d53fe14](../../commit/4d53fe14))
- always record file validations regardless of session changes ([bc7d466a](../../commit/bc7d466a))
- remove composite cache key bug in orchestration and validation ([11245e12](../../commit/11245e12))
- resolve marketplace paths relative to project root, not CWD ([40a4e685](../../commit/40a4e685))
- resolve Stop hook orchestration loop with synchronous execution ([d29d4e9f](../../commit/d29d4e9f))
- Stop hooks now return within 5 seconds via timeout-based deferral ([ee6e11fc](../../commit/ee6e11fc))
- skip logging hook_run for han hook commands ([de986310](../../commit/de986310))
- fix failing tests due to module path and missing exports ([3ff76091](../../commit/3ff76091))

### Changed

- remove han_workflow system completely ([717d7b9b](../../commit/717d7b9b))
- extract health check logic into reusable function ([b866aeaf](../../commit/b866aeaf))
- always open browser, remove --no-open flag ([4a7a7544](../../commit/4a7a7544))
- restructure CLI commands to use coordinator subcommand ([7ecba4d5](../../commit/7ecba4d5))
- simplify memory provider auth via plugin inheritance ([ebed64a4](../../commit/ebed64a4))
- replace cache/checkpoints options with onlyChanged, always cache ([0b019ed2](../../commit/0b019ed2))
- replace HTML tags with React Native Web components ([beadc9ab](../../commit/beadc9ab))
- major codebase cleanup and consolidation ([94d9d6db](../../commit/94d9d6db))
- consolidate GraphQL and API implementations ([e633b374](../../commit/e633b374))
- update CLI, hooks, memory, and MCP tooling ([d7bd5df8](../../commit/d7bd5df8))

### Other

- format coordinator server CORS config ([bb41e4f3](../../commit/bb41e4f3))
- Merge branch 'fix/react-native-web-violations' ([bc5f78a8](../../commit/bc5f78a8))
- Merge pull request #34 from TheBushidoCollective/fix/cors-restrictions ([9859f865](../../commit/9859f865))
- use template literal for string concatenation ([1798f3b6](../../commit/1798f3b6))
- format blueprints.ts with biome ([48e133c6](../../commit/48e133c6))
- remove orphaned workflow system tests ([6a9e873c](../../commit/6a9e873c))
- skip flaky memory-storage tests ([b2e16080](../../commit/b2e16080))
- skip flaky session-file-validation test ([f3862ce1](../../commit/f3862ce1))
- apply biome formatting to shouldStayAlive ([0dc875de](../../commit/0dc875de))
- optimize SessionStart from 6s to 2s ([44595593](../../commit/44595593))
- add timeout protection to SessionStart hook queries ([08b33f7c](../../commit/08b33f7c))
- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))
- add comprehensive tests for deferred hook execution system ([843d31b6](../../commit/843d31b6))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [2.3.2] - 2026-01-26

### Added

- add list_blueprints MCP tool ([7caf3e29](../../commit/7caf3e29))
- add --skip-if-questioning flag to Stop hooks ([04c326dd](../../commit/04c326dd))
- skip Stop hook check when agent is waiting for user input ([baba2d47](../../commit/baba2d47))
- hot-reload 6-day TLS certificates without restart ([a7a40ef0](../../commit/a7a40ef0))
- add --local flag for local vs remote dashboard ([7c609b69](../../commit/7c609b69))
- add keep-alive for active connections and sessions ([90cf11db](../../commit/90cf11db))
- add HookCheckStateMessage display in message timeline ([9a045168](../../commit/9a045168))
- add GraphQL @defer support for incremental data loading ([220d8724](../../commit/220d8724))
- add actionable hook failure guidance to SessionStart ([4d4fc2b5](../../commit/4d4fc2b5))
- use HAN_FILES from coordinator for session-scoped checks ([3969c632](../../commit/3969c632))
- add detailed coordinator logging for performance debugging ([32fbb6be](../../commit/32fbb6be))
- add project list to repo detail page ([97a3b4b3](../../commit/97a3b4b3))
- show session names in browse UI instead of UUIDs ([d11845de](../../commit/d11845de))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))
- implement deferred hook execution system ([96418bbd](../../commit/96418bbd))
- add session todos indexing and UI display ([dc161235](../../commit/dc161235))
- add coordinator-managed global slot system ([8c68e9c1](../../commit/8c68e9c1))
- add async workflow pattern with polling-based progress monitoring ([a91f7843](../../commit/a91f7843))
- add session ID hook for workflow/memory tool integration ([42a283db](../../commit/42a283db))

### Fixed

- create session before orchestration to satisfy FK constraint ([598a3c1d](../../commit/598a3c1d))
- delete stale validation records for deleted files ([5f34c3bc](../../commit/5f34c3bc))
- improve question detection in orchestrator skip logic ([4fe04442](../../commit/4fe04442))
- remove CORS wildcard from coordinator GraphQL server ([0321399c](../../commit/0321399c))
- prefix unused marketplace parameter with underscore ([bc038174](../../commit/bc038174))
- make port availability test more robust ([c5c8c598](../../commit/c5c8c598))
- fix syntax error in openBrowser callback ([41b6c544](../../commit/41b6c544))
- local mode always uses HTTP for offline scenarios ([60fb82df](../../commit/60fb82df))
- clarify hook failure attempt message ([15e71a32](../../commit/15e71a32))
- show correct GraphQL URL in console ([982b46ce](../../commit/982b46ce))
- support HTTPS in health check ([22ebc660](../../commit/22ebc660))
- remove duplicate coordinatorProtocol declaration ([3de087fb](../../commit/3de087fb))
- prevent caching for hooks without ifChanged filters ([837d0585](../../commit/837d0585))
- enable @defer support in GraphQL Yoga ([eb65532c](../../commit/eb65532c))
- correct HAN_FILES path handling for absolute paths ([beed531e](../../commit/beed531e))
- resolve biome lint warnings for HAN_FILES substitution ([3386d38e](../../commit/3386d38e))
- resolve markdownlint MD032 and MD025 errors in paper and blog ([bc9b8e20](../../commit/bc9b8e20))
- remove PluginMcpConfig export (interface no longer exists) ([b1413c79](../../commit/b1413c79))
- update memory provider tests for MCP-based discovery ([896522c0](../../commit/896522c0))
- address validation workflow failures ([947483db](../../commit/947483db))
- correct hook variable and remove unused variable ([79166255](../../commit/79166255))
- filter validation to only hooks matching session-changed files ([8eeb8c5d](../../commit/8eeb8c5d))
- prevent false positives in cache validation check ([4d53fe14](../../commit/4d53fe14))
- always record file validations regardless of session changes ([bc7d466a](../../commit/bc7d466a))
- remove composite cache key bug in orchestration and validation ([11245e12](../../commit/11245e12))
- resolve marketplace paths relative to project root, not CWD ([40a4e685](../../commit/40a4e685))
- resolve Stop hook orchestration loop with synchronous execution ([d29d4e9f](../../commit/d29d4e9f))
- Stop hooks now return within 5 seconds via timeout-based deferral ([ee6e11fc](../../commit/ee6e11fc))
- skip logging hook_run for han hook commands ([de986310](../../commit/de986310))
- fix failing tests due to module path and missing exports ([3ff76091](../../commit/3ff76091))

### Changed

- remove han_workflow system completely ([717d7b9b](../../commit/717d7b9b))
- extract health check logic into reusable function ([b866aeaf](../../commit/b866aeaf))
- always open browser, remove --no-open flag ([4a7a7544](../../commit/4a7a7544))
- restructure CLI commands to use coordinator subcommand ([7ecba4d5](../../commit/7ecba4d5))
- simplify memory provider auth via plugin inheritance ([ebed64a4](../../commit/ebed64a4))
- replace cache/checkpoints options with onlyChanged, always cache ([0b019ed2](../../commit/0b019ed2))
- replace HTML tags with React Native Web components ([beadc9ab](../../commit/beadc9ab))
- major codebase cleanup and consolidation ([94d9d6db](../../commit/94d9d6db))
- consolidate GraphQL and API implementations ([e633b374](../../commit/e633b374))
- update CLI, hooks, memory, and MCP tooling ([d7bd5df8](../../commit/d7bd5df8))

### Other

- format coordinator server CORS config ([bb41e4f3](../../commit/bb41e4f3))
- Merge branch 'fix/react-native-web-violations' ([bc5f78a8](../../commit/bc5f78a8))
- Merge pull request #34 from TheBushidoCollective/fix/cors-restrictions ([9859f865](../../commit/9859f865))
- use template literal for string concatenation ([1798f3b6](../../commit/1798f3b6))
- format blueprints.ts with biome ([48e133c6](../../commit/48e133c6))
- remove orphaned workflow system tests ([6a9e873c](../../commit/6a9e873c))
- skip flaky memory-storage tests ([b2e16080](../../commit/b2e16080))
- skip flaky session-file-validation test ([f3862ce1](../../commit/f3862ce1))
- apply biome formatting to shouldStayAlive ([0dc875de](../../commit/0dc875de))
- optimize SessionStart from 6s to 2s ([44595593](../../commit/44595593))
- add timeout protection to SessionStart hook queries ([08b33f7c](../../commit/08b33f7c))
- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))
- add comprehensive tests for deferred hook execution system ([843d31b6](../../commit/843d31b6))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [2.3.1] - 2025-12-23

### Added

- add bash output capture instruction ([a99c803f](../../commit/a99c803f))
- add hanBinary re-exec, enhanced version, and doctor command ([8443f2e2](../../commit/8443f2e2))
- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Fixed

- address test failures from prompt hook removal ([dcf0e0c3](../../commit/dcf0e0c3))
- clear CLAUDE_CONFIG_DIR in test isolation ([d14925bf](../../commit/d14925bf))
- isolate tests from user's global config ([ef867b48](../../commit/ef867b48))
- make vector store test more robust for CI ([8b46922d](../../commit/8b46922d))
- fix test flakiness in CI ([47f9d4a1](../../commit/47f9d4a1))
- make memory capture error handling truly silent ([ef1a8a1f](../../commit/ef1a8a1f))
- cross-compile Windows builds from Linux too ([7d72ab5d](../../commit/7d72ab5d))
- also set HOME env var to prevent fallback to user's real plugins ([4ef9ce2a](../../commit/4ef9ce2a))
- remove mock.module() to prevent test pollution ([8c276bf2](../../commit/8c276bf2))
- use absolute path for han binary fallback in dispatch-e2e ([95a8d693](../../commit/95a8d693))
- TypeScript error in completions.ts and correct bun test flag ([c3000442](../../commit/c3000442))
- add SubagentStart to valid hook types and fix bun test flag ([992436fc](../../commit/992436fc))

### Other

- add comprehensive tests for critical untested systems ([23b61742](../../commit/23b61742))

## [2.3.0] - 2025-12-23

### Added

- add bash output capture instruction ([a99c803f](../../commit/a99c803f))
- add hanBinary re-exec, enhanced version, and doctor command ([8443f2e2](../../commit/8443f2e2))
- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Fixed

- clear CLAUDE_CONFIG_DIR in test isolation ([d14925bf](../../commit/d14925bf))
- isolate tests from user's global config ([ef867b48](../../commit/ef867b48))
- make vector store test more robust for CI ([8b46922d](../../commit/8b46922d))
- fix test flakiness in CI ([47f9d4a1](../../commit/47f9d4a1))
- make memory capture error handling truly silent ([ef1a8a1f](../../commit/ef1a8a1f))
- cross-compile Windows builds from Linux too ([7d72ab5d](../../commit/7d72ab5d))
- also set HOME env var to prevent fallback to user's real plugins ([4ef9ce2a](../../commit/4ef9ce2a))
- remove mock.module() to prevent test pollution ([8c276bf2](../../commit/8c276bf2))
- use absolute path for han binary fallback in dispatch-e2e ([95a8d693](../../commit/95a8d693))
- TypeScript error in completions.ts and correct bun test flag ([c3000442](../../commit/c3000442))
- add SubagentStart to valid hook types and fix bun test flag ([992436fc](../../commit/992436fc))
- add describe.serial to more env-modifying tests ([56d49205](../../commit/56d49205))
- restore describe.serial and bump Bun to 1.3.4 ([8fd9a0b2](../../commit/8fd9a0b2))
- centralize native module loading with retry logic ([c255908d](../../commit/c255908d))
- replace describe.serial with describe for CI compatibility ([8abb86f6](../../commit/8abb86f6))

### Other

- add comprehensive tests for critical untested systems ([23b61742](../../commit/23b61742))
- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [2.2.3] - 2025-12-22

### Added

- add hanBinary re-exec, enhanced version, and doctor command ([8443f2e2](../../commit/8443f2e2))
- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Fixed

- clear CLAUDE_CONFIG_DIR in test isolation ([d14925bf](../../commit/d14925bf))
- isolate tests from user's global config ([ef867b48](../../commit/ef867b48))
- make vector store test more robust for CI ([8b46922d](../../commit/8b46922d))
- fix test flakiness in CI ([47f9d4a1](../../commit/47f9d4a1))
- make memory capture error handling truly silent ([ef1a8a1f](../../commit/ef1a8a1f))
- cross-compile Windows builds from Linux too ([7d72ab5d](../../commit/7d72ab5d))
- also set HOME env var to prevent fallback to user's real plugins ([4ef9ce2a](../../commit/4ef9ce2a))
- remove mock.module() to prevent test pollution ([8c276bf2](../../commit/8c276bf2))
- use absolute path for han binary fallback in dispatch-e2e ([95a8d693](../../commit/95a8d693))
- TypeScript error in completions.ts and correct bun test flag ([c3000442](../../commit/c3000442))
- add SubagentStart to valid hook types and fix bun test flag ([992436fc](../../commit/992436fc))
- add describe.serial to more env-modifying tests ([56d49205](../../commit/56d49205))
- restore describe.serial and bump Bun to 1.3.4 ([8fd9a0b2](../../commit/8fd9a0b2))
- centralize native module loading with retry logic ([c255908d](../../commit/c255908d))
- replace describe.serial with describe for CI compatibility ([8abb86f6](../../commit/8abb86f6))
- remove vendored OpenSSL, use platform native TLS ([51a81c9b](../../commit/51a81c9b))

### Other

- add comprehensive tests for critical untested systems ([23b61742](../../commit/23b61742))
- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [2.2.2] - 2025-12-22

### Added

- add hanBinary re-exec, enhanced version, and doctor command ([8443f2e2](../../commit/8443f2e2))
- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Fixed

- isolate tests from user's global config ([ef867b48](../../commit/ef867b48))
- make vector store test more robust for CI ([8b46922d](../../commit/8b46922d))
- fix test flakiness in CI ([47f9d4a1](../../commit/47f9d4a1))
- make memory capture error handling truly silent ([ef1a8a1f](../../commit/ef1a8a1f))
- cross-compile Windows builds from Linux too ([7d72ab5d](../../commit/7d72ab5d))
- also set HOME env var to prevent fallback to user's real plugins ([4ef9ce2a](../../commit/4ef9ce2a))
- remove mock.module() to prevent test pollution ([8c276bf2](../../commit/8c276bf2))
- use absolute path for han binary fallback in dispatch-e2e ([95a8d693](../../commit/95a8d693))
- TypeScript error in completions.ts and correct bun test flag ([c3000442](../../commit/c3000442))
- add SubagentStart to valid hook types and fix bun test flag ([992436fc](../../commit/992436fc))
- add describe.serial to more env-modifying tests ([56d49205](../../commit/56d49205))
- restore describe.serial and bump Bun to 1.3.4 ([8fd9a0b2](../../commit/8fd9a0b2))
- centralize native module loading with retry logic ([c255908d](../../commit/c255908d))
- replace describe.serial with describe for CI compatibility ([8abb86f6](../../commit/8abb86f6))
- remove vendored OpenSSL, use platform native TLS ([51a81c9b](../../commit/51a81c9b))

### Other

- add comprehensive tests for critical untested systems ([23b61742](../../commit/23b61742))
- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [2.2.1] - 2025-12-22

### Added

- add hanBinary re-exec, enhanced version, and doctor command ([8443f2e2](../../commit/8443f2e2))
- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Fixed

- make vector store test more robust for CI ([8b46922d](../../commit/8b46922d))
- fix test flakiness in CI ([47f9d4a1](../../commit/47f9d4a1))
- make memory capture error handling truly silent ([ef1a8a1f](../../commit/ef1a8a1f))
- cross-compile Windows builds from Linux too ([7d72ab5d](../../commit/7d72ab5d))
- also set HOME env var to prevent fallback to user's real plugins ([4ef9ce2a](../../commit/4ef9ce2a))
- remove mock.module() to prevent test pollution ([8c276bf2](../../commit/8c276bf2))
- use absolute path for han binary fallback in dispatch-e2e ([95a8d693](../../commit/95a8d693))
- TypeScript error in completions.ts and correct bun test flag ([c3000442](../../commit/c3000442))
- add SubagentStart to valid hook types and fix bun test flag ([992436fc](../../commit/992436fc))
- add describe.serial to more env-modifying tests ([56d49205](../../commit/56d49205))
- restore describe.serial and bump Bun to 1.3.4 ([8fd9a0b2](../../commit/8fd9a0b2))
- centralize native module loading with retry logic ([c255908d](../../commit/c255908d))
- replace describe.serial with describe for CI compatibility ([8abb86f6](../../commit/8abb86f6))
- remove vendored OpenSSL, use platform native TLS ([51a81c9b](../../commit/51a81c9b))
- trigger release on han-native changes ([3df8db77](../../commit/3df8db77))

### Other

- add comprehensive tests for critical untested systems ([23b61742](../../commit/23b61742))
- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [2.2.0] - 2025-12-16

### Added

- add hanBinary re-exec, enhanced version, and doctor command ([8443f2e2](../../commit/8443f2e2))
- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Fixed

- cross-compile Windows builds from Linux too ([7d72ab5d](../../commit/7d72ab5d))
- also set HOME env var to prevent fallback to user's real plugins ([4ef9ce2a](../../commit/4ef9ce2a))
- remove mock.module() to prevent test pollution ([8c276bf2](../../commit/8c276bf2))
- use absolute path for han binary fallback in dispatch-e2e ([95a8d693](../../commit/95a8d693))
- TypeScript error in completions.ts and correct bun test flag ([c3000442](../../commit/c3000442))
- add SubagentStart to valid hook types and fix bun test flag ([992436fc](../../commit/992436fc))
- add describe.serial to more env-modifying tests ([56d49205](../../commit/56d49205))
- restore describe.serial and bump Bun to 1.3.4 ([8fd9a0b2](../../commit/8fd9a0b2))
- centralize native module loading with retry logic ([c255908d](../../commit/c255908d))
- replace describe.serial with describe for CI compatibility ([8abb86f6](../../commit/8abb86f6))
- remove vendored OpenSSL, use platform native TLS ([51a81c9b](../../commit/51a81c9b))
- trigger release on han-native changes ([3df8db77](../../commit/3df8db77))
- use real createResearchEngine in mcp-team-memory tests ([78a63ad7](../../commit/78a63ad7))
- filter follow-up queries in mock by pattern ([208b99b4](../../commit/208b99b4))
- return results only on first search call ([103ac36d](../../commit/103ac36d))
- use direct mock search function for deterministic tests ([d27ac866](../../commit/d27ac866))
- make research tests deterministic with scoreOverrides Map ([ed8676a5](../../commit/ed8676a5))
- use hasOwnProperty for _testScore check ([13b59a99](../../commit/13b59a99))
- make research tests deterministic with explicit scores ([1af0d686](../../commit/1af0d686))

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [2.1.1] - 2025-12-16

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Fixed

- cross-compile Windows builds from Linux too ([7d72ab5d](../../commit/7d72ab5d))
- also set HOME env var to prevent fallback to user's real plugins ([4ef9ce2a](../../commit/4ef9ce2a))
- remove mock.module() to prevent test pollution ([8c276bf2](../../commit/8c276bf2))
- use absolute path for han binary fallback in dispatch-e2e ([95a8d693](../../commit/95a8d693))
- TypeScript error in completions.ts and correct bun test flag ([c3000442](../../commit/c3000442))
- add SubagentStart to valid hook types and fix bun test flag ([992436fc](../../commit/992436fc))
- add describe.serial to more env-modifying tests ([56d49205](../../commit/56d49205))
- restore describe.serial and bump Bun to 1.3.4 ([8fd9a0b2](../../commit/8fd9a0b2))
- centralize native module loading with retry logic ([c255908d](../../commit/c255908d))
- replace describe.serial with describe for CI compatibility ([8abb86f6](../../commit/8abb86f6))
- remove vendored OpenSSL, use platform native TLS ([51a81c9b](../../commit/51a81c9b))
- trigger release on han-native changes ([3df8db77](../../commit/3df8db77))
- use real createResearchEngine in mcp-team-memory tests ([78a63ad7](../../commit/78a63ad7))
- filter follow-up queries in mock by pattern ([208b99b4](../../commit/208b99b4))
- return results only on first search call ([103ac36d](../../commit/103ac36d))
- use direct mock search function for deterministic tests ([d27ac866](../../commit/d27ac866))
- make research tests deterministic with scoreOverrides Map ([ed8676a5](../../commit/ed8676a5))
- use hasOwnProperty for _testScore check ([13b59a99](../../commit/13b59a99))
- make research tests deterministic with explicit scores ([1af0d686](../../commit/1af0d686))
- graceful degradation when native module unavailable ([fb03e69c](../../commit/fb03e69c))

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))
- improve memory indexer module documentation ([fd19b28a](../../commit/fd19b28a))
- add memory and metrics commands to README ([3364b80b](../../commit/3364b80b))

## [2.1.0] - 2025-12-16

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))
- add historical context system with FTS indexing ([0ea5fb75](../../commit/0ea5fb75))

### Fixed

- also set HOME env var to prevent fallback to user's real plugins ([4ef9ce2a](../../commit/4ef9ce2a))
- remove mock.module() to prevent test pollution ([8c276bf2](../../commit/8c276bf2))
- use absolute path for han binary fallback in dispatch-e2e ([95a8d693](../../commit/95a8d693))
- TypeScript error in completions.ts and correct bun test flag ([c3000442](../../commit/c3000442))
- add SubagentStart to valid hook types and fix bun test flag ([992436fc](../../commit/992436fc))
- add describe.serial to more env-modifying tests ([56d49205](../../commit/56d49205))
- restore describe.serial and bump Bun to 1.3.4 ([8fd9a0b2](../../commit/8fd9a0b2))
- centralize native module loading with retry logic ([c255908d](../../commit/c255908d))
- replace describe.serial with describe for CI compatibility ([8abb86f6](../../commit/8abb86f6))
- remove vendored OpenSSL, use platform native TLS ([51a81c9b](../../commit/51a81c9b))
- trigger release on han-native changes ([3df8db77](../../commit/3df8db77))
- use real createResearchEngine in mcp-team-memory tests ([78a63ad7](../../commit/78a63ad7))
- filter follow-up queries in mock by pattern ([208b99b4](../../commit/208b99b4))
- return results only on first search call ([103ac36d](../../commit/103ac36d))
- use direct mock search function for deterministic tests ([d27ac866](../../commit/d27ac866))
- make research tests deterministic with scoreOverrides Map ([ed8676a5](../../commit/ed8676a5))
- use hasOwnProperty for _testScore check ([13b59a99](../../commit/13b59a99))
- make research tests deterministic with explicit scores ([1af0d686](../../commit/1af0d686))
- graceful degradation when native module unavailable ([fb03e69c](../../commit/fb03e69c))

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))
- improve memory indexer module documentation ([fd19b28a](../../commit/fd19b28a))
- add memory and metrics commands to README ([3364b80b](../../commit/3364b80b))

## [2.0.5] - 2025-12-16

### Added

- add historical context system with FTS indexing ([0ea5fb75](../../commit/0ea5fb75))

### Fixed

- also set HOME env var to prevent fallback to user's real plugins ([4ef9ce2a](../../commit/4ef9ce2a))
- remove mock.module() to prevent test pollution ([8c276bf2](../../commit/8c276bf2))
- use absolute path for han binary fallback in dispatch-e2e ([95a8d693](../../commit/95a8d693))
- TypeScript error in completions.ts and correct bun test flag ([c3000442](../../commit/c3000442))
- add SubagentStart to valid hook types and fix bun test flag ([992436fc](../../commit/992436fc))
- add describe.serial to more env-modifying tests ([56d49205](../../commit/56d49205))
- restore describe.serial and bump Bun to 1.3.4 ([8fd9a0b2](../../commit/8fd9a0b2))
- centralize native module loading with retry logic ([c255908d](../../commit/c255908d))
- replace describe.serial with describe for CI compatibility ([8abb86f6](../../commit/8abb86f6))
- remove vendored OpenSSL, use platform native TLS ([51a81c9b](../../commit/51a81c9b))
- trigger release on han-native changes ([3df8db77](../../commit/3df8db77))
- use real createResearchEngine in mcp-team-memory tests ([78a63ad7](../../commit/78a63ad7))
- filter follow-up queries in mock by pattern ([208b99b4](../../commit/208b99b4))
- return results only on first search call ([103ac36d](../../commit/103ac36d))
- use direct mock search function for deterministic tests ([d27ac866](../../commit/d27ac866))
- make research tests deterministic with scoreOverrides Map ([ed8676a5](../../commit/ed8676a5))
- use hasOwnProperty for _testScore check ([13b59a99](../../commit/13b59a99))
- make research tests deterministic with explicit scores ([1af0d686](../../commit/1af0d686))
- graceful degradation when native module unavailable ([fb03e69c](../../commit/fb03e69c))

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))
- improve memory indexer module documentation ([fd19b28a](../../commit/fd19b28a))
- add memory and metrics commands to README ([3364b80b](../../commit/3364b80b))
- update website for v2.0.0 features ([53cf28bd](../../commit/53cf28bd))

## [2.0.4] - 2025-12-15

### Added

- add historical context system with FTS indexing ([0ea5fb75](../../commit/0ea5fb75))

### Fixed

- remove mock.module() to prevent test pollution ([8c276bf2](../../commit/8c276bf2))
- use absolute path for han binary fallback in dispatch-e2e ([95a8d693](../../commit/95a8d693))
- TypeScript error in completions.ts and correct bun test flag ([c3000442](../../commit/c3000442))
- add SubagentStart to valid hook types and fix bun test flag ([992436fc](../../commit/992436fc))
- add describe.serial to more env-modifying tests ([56d49205](../../commit/56d49205))
- restore describe.serial and bump Bun to 1.3.4 ([8fd9a0b2](../../commit/8fd9a0b2))
- centralize native module loading with retry logic ([c255908d](../../commit/c255908d))
- replace describe.serial with describe for CI compatibility ([8abb86f6](../../commit/8abb86f6))
- remove vendored OpenSSL, use platform native TLS ([51a81c9b](../../commit/51a81c9b))
- trigger release on han-native changes ([3df8db77](../../commit/3df8db77))
- use real createResearchEngine in mcp-team-memory tests ([78a63ad7](../../commit/78a63ad7))
- filter follow-up queries in mock by pattern ([208b99b4](../../commit/208b99b4))
- return results only on first search call ([103ac36d](../../commit/103ac36d))
- use direct mock search function for deterministic tests ([d27ac866](../../commit/d27ac866))
- make research tests deterministic with scoreOverrides Map ([ed8676a5](../../commit/ed8676a5))
- use hasOwnProperty for _testScore check ([13b59a99](../../commit/13b59a99))
- make research tests deterministic with explicit scores ([1af0d686](../../commit/1af0d686))
- graceful degradation when native module unavailable ([fb03e69c](../../commit/fb03e69c))

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))
- improve memory indexer module documentation ([fd19b28a](../../commit/fd19b28a))
- add memory and metrics commands to README ([3364b80b](../../commit/3364b80b))
- update website for v2.0.0 features ([53cf28bd](../../commit/53cf28bd))

## [2.0.3] - 2025-12-15

### BREAKING CHANGES

- make caching and fail-fast default behavior for hooks ([fa35e80f](../../commit/fa35e80f))

### Added

- add historical context system with FTS indexing ([0ea5fb75](../../commit/0ea5fb75))
- add SubagentStart and SubagentStop hooks to all plugins ([a8925a99](../../commit/a8925a99))
- add memory system with team and personal storage ([4ac6eadf](../../commit/4ac6eadf))

### Fixed

- remove vendored OpenSSL, use platform native TLS ([51a81c9b](../../commit/51a81c9b))
- trigger release on han-native changes ([3df8db77](../../commit/3df8db77))
- use real createResearchEngine in mcp-team-memory tests ([78a63ad7](../../commit/78a63ad7))
- filter follow-up queries in mock by pattern ([208b99b4](../../commit/208b99b4))
- return results only on first search call ([103ac36d](../../commit/103ac36d))
- use direct mock search function for deterministic tests ([d27ac866](../../commit/d27ac866))
- make research tests deterministic with scoreOverrides Map ([ed8676a5](../../commit/ed8676a5))
- use hasOwnProperty for _testScore check ([13b59a99](../../commit/13b59a99))
- make research tests deterministic with explicit scores ([1af0d686](../../commit/1af0d686))
- graceful degradation when native module unavailable ([fb03e69c](../../commit/fb03e69c))
- simplify native module loading with top-level require ([ea594223](../../commit/ea594223))
- use import.meta.dir for bunfs native module extraction ([629aa9f9](../../commit/629aa9f9))
- extract native module from bunfs to temp before loading ([250cc9ba](../../commit/250cc9ba))

### Other

- improve memory indexer module documentation ([fd19b28a](../../commit/fd19b28a))
- add memory and metrics commands to README ([3364b80b](../../commit/3364b80b))
- update website for v2.0.0 features ([53cf28bd](../../commit/53cf28bd))

## [2.0.2] - 2025-12-14

### BREAKING CHANGES

- make caching and fail-fast default behavior for hooks ([fa35e80f](../../commit/fa35e80f))

### Added

- add historical context system with FTS indexing ([0ea5fb75](../../commit/0ea5fb75))
- add SubagentStart and SubagentStop hooks to all plugins ([a8925a99](../../commit/a8925a99))
- add memory system with team and personal storage ([4ac6eadf](../../commit/4ac6eadf))

### Fixed

- trigger release on han-native changes ([3df8db77](../../commit/3df8db77))
- use real createResearchEngine in mcp-team-memory tests ([78a63ad7](../../commit/78a63ad7))
- filter follow-up queries in mock by pattern ([208b99b4](../../commit/208b99b4))
- return results only on first search call ([103ac36d](../../commit/103ac36d))
- use direct mock search function for deterministic tests ([d27ac866](../../commit/d27ac866))
- make research tests deterministic with scoreOverrides Map ([ed8676a5](../../commit/ed8676a5))
- use hasOwnProperty for _testScore check ([13b59a99](../../commit/13b59a99))
- make research tests deterministic with explicit scores ([1af0d686](../../commit/1af0d686))
- graceful degradation when native module unavailable ([fb03e69c](../../commit/fb03e69c))
- simplify native module loading with top-level require ([ea594223](../../commit/ea594223))
- use import.meta.dir for bunfs native module extraction ([629aa9f9](../../commit/629aa9f9))
- extract native module from bunfs to temp before loading ([250cc9ba](../../commit/250cc9ba))
- align native module naming with workflow matrix ([7ed1812f](../../commit/7ed1812f))

### Other

- improve memory indexer module documentation ([fd19b28a](../../commit/fd19b28a))
- add memory and metrics commands to README ([3364b80b](../../commit/3364b80b))
- update website for v2.0.0 features ([53cf28bd](../../commit/53cf28bd))

## [2.0.1] - 2025-12-14

### BREAKING CHANGES

- make caching and fail-fast default behavior for hooks ([fa35e80f](../../commit/fa35e80f))

### Added

- add historical context system with FTS indexing ([0ea5fb75](../../commit/0ea5fb75))
- add SubagentStart and SubagentStop hooks to all plugins ([a8925a99](../../commit/a8925a99))
- add memory system with team and personal storage ([4ac6eadf](../../commit/4ac6eadf))

### Fixed

- use real createResearchEngine in mcp-team-memory tests ([78a63ad7](../../commit/78a63ad7))
- filter follow-up queries in mock by pattern ([208b99b4](../../commit/208b99b4))
- return results only on first search call ([103ac36d](../../commit/103ac36d))
- use direct mock search function for deterministic tests ([d27ac866](../../commit/d27ac866))
- make research tests deterministic with scoreOverrides Map ([ed8676a5](../../commit/ed8676a5))
- use hasOwnProperty for _testScore check ([13b59a99](../../commit/13b59a99))
- make research tests deterministic with explicit scores ([1af0d686](../../commit/1af0d686))
- graceful degradation when native module unavailable ([fb03e69c](../../commit/fb03e69c))
- simplify native module loading with top-level require ([ea594223](../../commit/ea594223))
- use import.meta.dir for bunfs native module extraction ([629aa9f9](../../commit/629aa9f9))
- extract native module from bunfs to temp before loading ([250cc9ba](../../commit/250cc9ba))
- align native module naming with workflow matrix ([7ed1812f](../../commit/7ed1812f))
- skip marketplace-cache tests in CI due to Bun fetch mocking bug ([68e06390](../../commit/68e06390))

### Other

- improve memory indexer module documentation ([fd19b28a](../../commit/fd19b28a))
- add memory and metrics commands to README ([3364b80b](../../commit/3364b80b))
- update website for v2.0.0 features ([53cf28bd](../../commit/53cf28bd))

## [1.61.7] - 2025-12-13

### Added

- make memory-learning hook explicitly autonomous ([fd2b4e0e](../../commit/fd2b4e0e))
- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))
- add OpenTelemetry integration for enterprise observability ([aa2afab9](../../commit/aa2afab9))

### Fixed

- extract native module from bunfs to temp before loading ([1e506841](../../commit/1e506841))
- align native module naming with workflow matrix ([70760b21](../../commit/70760b21))
- skip marketplace-cache tests in CI due to Bun fetch mocking bug ([99273d9f](../../commit/99273d9f))
- harden no-excuses rule to prevent categorizing failures ([bb30c9c6](../../commit/bb30c9c6))
- prefix unused hookType parameter with underscore ([717549b1](../../commit/717549b1))
- sync package-lock.json and add weighted frustration metrics ([ff37f37d](../../commit/ff37f37d))
- pass stdin payload to hooks during test execution ([06eff448](../../commit/06eff448))

### Changed

- use marker-based detection for gaps and install ([687b89c5](../../commit/687b89c5))
- use dynamic scanning for plugin detection configs ([5a89530a](../../commit/5a89530a))
- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))

### Other

- reframe project memory as autonomous self-learning ([f917b23f](../../commit/f917b23f))
- Merge pull request #15 from TheBushidoCollective/claude/issue-14-20251211-1808 ([dbfe42d8](../../commit/dbfe42d8))

## [1.61.6] - 2025-12-12

### Added

- make memory-learning hook explicitly autonomous ([fd2b4e0e](../../commit/fd2b4e0e))
- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))
- add OpenTelemetry integration for enterprise observability ([aa2afab9](../../commit/aa2afab9))

### Fixed

- align native module naming with workflow matrix ([70760b21](../../commit/70760b21))
- skip marketplace-cache tests in CI due to Bun fetch mocking bug ([99273d9f](../../commit/99273d9f))
- harden no-excuses rule to prevent categorizing failures ([bb30c9c6](../../commit/bb30c9c6))
- prefix unused hookType parameter with underscore ([717549b1](../../commit/717549b1))
- sync package-lock.json and add weighted frustration metrics ([ff37f37d](../../commit/ff37f37d))
- pass stdin payload to hooks during test execution ([06eff448](../../commit/06eff448))

### Changed

- use marker-based detection for gaps and install ([687b89c5](../../commit/687b89c5))
- use dynamic scanning for plugin detection configs ([5a89530a](../../commit/5a89530a))
- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))

### Other

- reframe project memory as autonomous self-learning ([f917b23f](../../commit/f917b23f))
- Merge pull request #15 from TheBushidoCollective/claude/issue-14-20251211-1808 ([dbfe42d8](../../commit/dbfe42d8))

## [1.61.5] - 2025-12-12

### Added

- make memory-learning hook explicitly autonomous ([fd2b4e0e](../../commit/fd2b4e0e))
- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))
- add OpenTelemetry integration for enterprise observability ([aa2afab9](../../commit/aa2afab9))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))

### Fixed

- skip marketplace-cache tests in CI due to Bun fetch mocking bug ([99273d9f](../../commit/99273d9f))
- harden no-excuses rule to prevent categorizing failures ([bb30c9c6](../../commit/bb30c9c6))
- prefix unused hookType parameter with underscore ([717549b1](../../commit/717549b1))
- sync package-lock.json and add weighted frustration metrics ([ff37f37d](../../commit/ff37f37d))
- pass stdin payload to hooks during test execution ([06eff448](../../commit/06eff448))

### Changed

- use marker-based detection for gaps and install ([687b89c5](../../commit/687b89c5))
- use dynamic scanning for plugin detection configs ([5a89530a](../../commit/5a89530a))
- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))

### Other

- reframe project memory as autonomous self-learning ([f917b23f](../../commit/f917b23f))
- Merge pull request #15 from TheBushidoCollective/claude/issue-14-20251211-1808 ([dbfe42d8](../../commit/dbfe42d8))

## [1.61.4] - 2025-12-12

### Added

- add OpenTelemetry integration for enterprise observability ([aa2afab9](../../commit/aa2afab9))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))
- add HAN_NO_FAIL_FAST env var to override --fail-fast ([7f0edaa3](../../commit/7f0edaa3))
- pipe stdin to hooks for session_id propagation ([6856a395](../../commit/6856a395))
- add plugins keyword and trigger release workflow ([06742cac](../../commit/06742cac))

### Fixed

- sync package-lock.json and add weighted frustration metrics ([ff37f37d](../../commit/ff37f37d))
- pass stdin payload to hooks during test execution ([06eff448](../../commit/06eff448))
- make hook failure output focus on subagent delegation ([3a7a54fe](../../commit/3a7a54fe))
- make hook failure output more actionable for agent ([030fd7e7](../../commit/030fd7e7))
- remove tests for non-existent extractPluginName function ([4deef62a](../../commit/4deef62a))
- extract plugin name from versioned cache paths correctly ([8fbd1740](../../commit/8fbd1740))

### Changed

- use marker-based detection for gaps and install ([687b89c5](../../commit/687b89c5))
- use dynamic scanning for plugin detection configs ([5a89530a](../../commit/5a89530a))
- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))
- consolidate Windows build into matrix with cargo-xwin ([aeedd7ae](../../commit/aeedd7ae))
- centralize plugin name extraction logic ([2175952e](../../commit/2175952e))

### Other

- Merge pull request #15 from TheBushidoCollective/claude/issue-14-20251211-1808 ([dbfe42d8](../../commit/dbfe42d8))
- Merge pull request #13 from TheBushidoCollective/claude/issue-12-20251210-1809 ([c2830cb7](../../commit/c2830cb7))

## [1.61.3] - 2025-12-11

### Added

- add OpenTelemetry integration for enterprise observability ([aa2afab9](../../commit/aa2afab9))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))
- add HAN_NO_FAIL_FAST env var to override --fail-fast ([7f0edaa3](../../commit/7f0edaa3))
- pipe stdin to hooks for session_id propagation ([6856a395](../../commit/6856a395))
- add plugins keyword and trigger release workflow ([06742cac](../../commit/06742cac))

### Fixed

- sync package-lock.json and add weighted frustration metrics ([ff37f37d](../../commit/ff37f37d))
- make hook failure output focus on subagent delegation ([3a7a54fe](../../commit/3a7a54fe))
- make hook failure output more actionable for agent ([030fd7e7](../../commit/030fd7e7))
- remove tests for non-existent extractPluginName function ([4deef62a](../../commit/4deef62a))
- extract plugin name from versioned cache paths correctly ([8fbd1740](../../commit/8fbd1740))

### Changed

- use marker-based detection for gaps and install ([687b89c5](../../commit/687b89c5))
- use dynamic scanning for plugin detection configs ([5a89530a](../../commit/5a89530a))
- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))
- consolidate Windows build into matrix with cargo-xwin ([aeedd7ae](../../commit/aeedd7ae))
- centralize plugin name extraction logic ([2175952e](../../commit/2175952e))

### Other

- Merge pull request #13 from TheBushidoCollective/claude/issue-12-20251210-1809 ([c2830cb7](../../commit/c2830cb7))

## [1.61.2] - 2025-12-11

### Added

- add OpenTelemetry integration for enterprise observability ([aa2afab9](../../commit/aa2afab9))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))
- add HAN_NO_FAIL_FAST env var to override --fail-fast ([7f0edaa3](../../commit/7f0edaa3))
- pipe stdin to hooks for session_id propagation ([6856a395](../../commit/6856a395))
- add plugins keyword and trigger release workflow ([06742cac](../../commit/06742cac))

### Fixed

- sync package-lock.json and add weighted frustration metrics ([ff37f37d](../../commit/ff37f37d))
- make hook failure output focus on subagent delegation ([3a7a54fe](../../commit/3a7a54fe))
- make hook failure output more actionable for agent ([030fd7e7](../../commit/030fd7e7))
- remove tests for non-existent extractPluginName function ([4deef62a](../../commit/4deef62a))
- extract plugin name from versioned cache paths correctly ([8fbd1740](../../commit/8fbd1740))

### Changed

- use dynamic scanning for plugin detection configs ([5a89530a](../../commit/5a89530a))
- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))
- consolidate Windows build into matrix with cargo-xwin ([aeedd7ae](../../commit/aeedd7ae))
- centralize plugin name extraction logic ([2175952e](../../commit/2175952e))

### Other

- Merge pull request #13 from TheBushidoCollective/claude/issue-12-20251210-1809 ([c2830cb7](../../commit/c2830cb7))

## [1.61.1] - 2025-12-11

### Added

- add OpenTelemetry integration for enterprise observability ([aa2afab9](../../commit/aa2afab9))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))
- add HAN_NO_FAIL_FAST env var to override --fail-fast ([7f0edaa3](../../commit/7f0edaa3))
- pipe stdin to hooks for session_id propagation ([6856a395](../../commit/6856a395))
- add plugins keyword and trigger release workflow ([06742cac](../../commit/06742cac))

### Fixed

- sync package-lock.json and add weighted frustration metrics ([ff37f37d](../../commit/ff37f37d))
- make hook failure output focus on subagent delegation ([3a7a54fe](../../commit/3a7a54fe))
- make hook failure output more actionable for agent ([030fd7e7](../../commit/030fd7e7))
- remove tests for non-existent extractPluginName function ([4deef62a](../../commit/4deef62a))
- extract plugin name from versioned cache paths correctly ([8fbd1740](../../commit/8fbd1740))

### Changed

- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))
- consolidate Windows build into matrix with cargo-xwin ([aeedd7ae](../../commit/aeedd7ae))
- centralize plugin name extraction logic ([2175952e](../../commit/2175952e))

### Other

- Merge pull request #13 from TheBushidoCollective/claude/issue-12-20251210-1809 ([c2830cb7](../../commit/c2830cb7))

## [1.61.0] - 2025-12-11

### Added

- add OpenTelemetry integration for enterprise observability ([aa2afab9](../../commit/aa2afab9))
- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))
- add HAN_NO_FAIL_FAST env var to override --fail-fast ([7f0edaa3](../../commit/7f0edaa3))
- pipe stdin to hooks for session_id propagation ([6856a395](../../commit/6856a395))
- add plugins keyword and trigger release workflow ([06742cac](../../commit/06742cac))

### Fixed

- make hook failure output focus on subagent delegation ([3a7a54fe](../../commit/3a7a54fe))
- make hook failure output more actionable for agent ([030fd7e7](../../commit/030fd7e7))
- remove tests for non-existent extractPluginName function ([4deef62a](../../commit/4deef62a))
- extract plugin name from versioned cache paths correctly ([8fbd1740](../../commit/8fbd1740))

### Changed

- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))
- consolidate Windows build into matrix with cargo-xwin ([aeedd7ae](../../commit/aeedd7ae))
- centralize plugin name extraction logic ([2175952e](../../commit/2175952e))

### Other

- Merge pull request #13 from TheBushidoCollective/claude/issue-12-20251210-1809 ([c2830cb7](../../commit/c2830cb7))

## [1.60.1] - 2025-12-11

### Added

- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))
- add HAN_NO_FAIL_FAST env var to override --fail-fast ([7f0edaa3](../../commit/7f0edaa3))
- pipe stdin to hooks for session_id propagation ([6856a395](../../commit/6856a395))
- add plugins keyword and trigger release workflow ([06742cac](../../commit/06742cac))

### Fixed

- make hook failure output focus on subagent delegation ([3a7a54fe](../../commit/3a7a54fe))
- make hook failure output more actionable for agent ([030fd7e7](../../commit/030fd7e7))
- remove tests for non-existent extractPluginName function ([4deef62a](../../commit/4deef62a))
- extract plugin name from versioned cache paths correctly ([8fbd1740](../../commit/8fbd1740))

### Changed

- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))
- consolidate Windows build into matrix with cargo-xwin ([aeedd7ae](../../commit/aeedd7ae))
- centralize plugin name extraction logic ([2175952e](../../commit/2175952e))

### Other

- Merge pull request #13 from TheBushidoCollective/claude/issue-12-20251210-1809 ([c2830cb7](../../commit/c2830cb7))

## [1.60.0] - 2025-12-11

### Added

- add DeepWiki MCP server alongside Context7 ([a8cc19f2](../../commit/a8cc19f2))
- add HAN_NO_FAIL_FAST env var to override --fail-fast ([7f0edaa3](../../commit/7f0edaa3))
- pipe stdin to hooks for session_id propagation ([6856a395](../../commit/6856a395))
- add plugins keyword and trigger release workflow ([06742cac](../../commit/06742cac))

### Fixed

- make hook failure output focus on subagent delegation ([3a7a54fe](../../commit/3a7a54fe))
- make hook failure output more actionable for agent ([030fd7e7](../../commit/030fd7e7))
- remove tests for non-existent extractPluginName function ([4deef62a](../../commit/4deef62a))
- extract plugin name from versioned cache paths correctly ([8fbd1740](../../commit/8fbd1740))
- resolve linting and formatting issues from stop hooks ([9e242e55](../../commit/9e242e55))
- add cwd to spawnSync calls in CLI integration tests ([cd4d701d](../../commit/cd4d701d))
- skip marketplace-cache tests when module loading fails due to Bun bug ([052bfc9e](../../commit/052bfc9e))
- skip marketplace-cache tests in CI due to Bun bug ([92567a62](../../commit/92567a62))
- use dynamic import for marketplace-cache in update.ts ([c81294ad](../../commit/c81294ad))
- rename marketplace-cache.test.ts to load first ([4b8c4816](../../commit/4b8c4816))

### Changed

- consolidate Windows build into matrix with cargo-xwin ([aeedd7ae](../../commit/aeedd7ae))
- centralize plugin name extraction logic ([2175952e](../../commit/2175952e))

### Other

- Merge pull request #13 from TheBushidoCollective/claude/issue-12-20251210-1809 ([c2830cb7](../../commit/c2830cb7))

## [1.59.0] - 2025-12-11

### Added

- add HAN_NO_FAIL_FAST env var to override --fail-fast ([7f0edaa3](../../commit/7f0edaa3))
- pipe stdin to hooks for session_id propagation ([6856a395](../../commit/6856a395))
- add plugins keyword and trigger release workflow ([06742cac](../../commit/06742cac))

### Fixed

- make hook failure output focus on subagent delegation ([3a7a54fe](../../commit/3a7a54fe))
- make hook failure output more actionable for agent ([030fd7e7](../../commit/030fd7e7))
- remove tests for non-existent extractPluginName function ([4deef62a](../../commit/4deef62a))
- extract plugin name from versioned cache paths correctly ([8fbd1740](../../commit/8fbd1740))
- resolve linting and formatting issues from stop hooks ([9e242e55](../../commit/9e242e55))
- add cwd to spawnSync calls in CLI integration tests ([cd4d701d](../../commit/cd4d701d))
- skip marketplace-cache tests when module loading fails due to Bun bug ([052bfc9e](../../commit/052bfc9e))
- skip marketplace-cache tests in CI due to Bun bug ([92567a62](../../commit/92567a62))
- use dynamic import for marketplace-cache in update.ts ([c81294ad](../../commit/c81294ad))
- rename marketplace-cache.test.ts to load first ([4b8c4816](../../commit/4b8c4816))

### Changed

- consolidate Windows build into matrix with cargo-xwin ([aeedd7ae](../../commit/aeedd7ae))
- centralize plugin name extraction logic ([2175952e](../../commit/2175952e))

### Other

- Merge pull request #13 from TheBushidoCollective/claude/issue-12-20251210-1809 ([c2830cb7](../../commit/c2830cb7))

## [1.58.0] - 2025-12-10

### Added

- pipe stdin to hooks for session_id propagation ([6856a395](../../commit/6856a395))
- add plugins keyword and trigger release workflow ([06742cac](../../commit/06742cac))

### Fixed

- remove tests for non-existent extractPluginName function ([4deef62a](../../commit/4deef62a))
- extract plugin name from versioned cache paths correctly ([8fbd1740](../../commit/8fbd1740))
- resolve linting and formatting issues from stop hooks ([9e242e55](../../commit/9e242e55))
- add cwd to spawnSync calls in CLI integration tests ([cd4d701d](../../commit/cd4d701d))
- skip marketplace-cache tests when module loading fails due to Bun bug ([052bfc9e](../../commit/052bfc9e))
- skip marketplace-cache tests in CI due to Bun bug ([92567a62](../../commit/92567a62))
- use dynamic import for marketplace-cache in update.ts ([c81294ad](../../commit/c81294ad))
- rename marketplace-cache.test.ts to load first ([4b8c4816](../../commit/4b8c4816))
- remove global ink mock that was breaking other test files ([b5e6b73a](../../commit/b5e6b73a))

### Changed

- consolidate Windows build into matrix with cargo-xwin ([aeedd7ae](../../commit/aeedd7ae))
- centralize plugin name extraction logic ([2175952e](../../commit/2175952e))

### Other

- Merge pull request #13 from TheBushidoCollective/claude/issue-12-20251210-1809 ([c2830cb7](../../commit/c2830cb7))
- trigger workflow after test mock fix ([21c80815](../../commit/21c80815))

## [1.57.0] - 2025-12-10

### Added

- add plugins keyword and trigger release workflow ([06742cac](../../commit/06742cac))

### Fixed

- remove tests for non-existent extractPluginName function ([4deef62a](../../commit/4deef62a))
- extract plugin name from versioned cache paths correctly ([8fbd1740](../../commit/8fbd1740))
- resolve linting and formatting issues from stop hooks ([9e242e55](../../commit/9e242e55))
- add cwd to spawnSync calls in CLI integration tests ([cd4d701d](../../commit/cd4d701d))
- skip marketplace-cache tests when module loading fails due to Bun bug ([052bfc9e](../../commit/052bfc9e))
- skip marketplace-cache tests in CI due to Bun bug ([92567a62](../../commit/92567a62))
- use dynamic import for marketplace-cache in update.ts ([c81294ad](../../commit/c81294ad))
- rename marketplace-cache.test.ts to load first ([4b8c4816](../../commit/4b8c4816))
- remove global ink mock that was breaking other test files ([b5e6b73a](../../commit/b5e6b73a))

### Changed

- consolidate Windows build into matrix with cargo-xwin ([aeedd7ae](../../commit/aeedd7ae))
- centralize plugin name extraction logic ([2175952e](../../commit/2175952e))

### Other

- Merge pull request #13 from TheBushidoCollective/claude/issue-12-20251210-1809 ([c2830cb7](../../commit/c2830cb7))
- trigger workflow after test mock fix ([21c80815](../../commit/21c80815))
- trigger workflow after bun test fix ([cc6099f8](../../commit/cc6099f8))

## [1.56.10] - 2025-12-10

### Fixed

- remove tests for non-existent extractPluginName function ([4deef62a](../../commit/4deef62a))
- extract plugin name from versioned cache paths correctly ([8fbd1740](../../commit/8fbd1740))
- resolve linting and formatting issues from stop hooks ([9e242e55](../../commit/9e242e55))
- add cwd to spawnSync calls in CLI integration tests ([cd4d701d](../../commit/cd4d701d))
- skip marketplace-cache tests when module loading fails due to Bun bug ([052bfc9e](../../commit/052bfc9e))
- skip marketplace-cache tests in CI due to Bun bug ([92567a62](../../commit/92567a62))
- use dynamic import for marketplace-cache in update.ts ([c81294ad](../../commit/c81294ad))
- rename marketplace-cache.test.ts to load first ([4b8c4816](../../commit/4b8c4816))
- remove global ink mock that was breaking other test files ([b5e6b73a](../../commit/b5e6b73a))
- regenerate package-lock.json for CI compatibility ([c4d4e0f9](../../commit/c4d4e0f9))
- resolve biome lint warnings in test files ([2fa44c23](../../commit/2fa44c23))

### Changed

- consolidate Windows build into matrix with cargo-xwin ([aeedd7ae](../../commit/aeedd7ae))
- centralize plugin name extraction logic ([2175952e](../../commit/2175952e))

### Other

- Merge pull request #13 from TheBushidoCollective/claude/issue-12-20251210-1809 ([c2830cb7](../../commit/c2830cb7))
- trigger workflow after test mock fix ([21c80815](../../commit/21c80815))
- trigger workflow after bun test fix ([cc6099f8](../../commit/cc6099f8))
- trigger workflow test after bun install fix ([539debbf](../../commit/539debbf))

## [1.56.9] - 2025-12-10

### Fixed

- resolve linting and formatting issues from stop hooks ([9e242e55](../../commit/9e242e55))
- add cwd to spawnSync calls in CLI integration tests ([cd4d701d](../../commit/cd4d701d))
- skip marketplace-cache tests when module loading fails due to Bun bug ([052bfc9e](../../commit/052bfc9e))
- skip marketplace-cache tests in CI due to Bun bug ([92567a62](../../commit/92567a62))
- use dynamic import for marketplace-cache in update.ts ([c81294ad](../../commit/c81294ad))
- rename marketplace-cache.test.ts to load first ([4b8c4816](../../commit/4b8c4816))
- remove global ink mock that was breaking other test files ([b5e6b73a](../../commit/b5e6b73a))
- regenerate package-lock.json for CI compatibility ([c4d4e0f9](../../commit/c4d4e0f9))
- resolve biome lint warnings in test files ([2fa44c23](../../commit/2fa44c23))

### Changed

- rename bushido-han package to han with expanded test coverage ([a320585d](../../commit/a320585d))

### Other

- trigger workflow after test mock fix ([21c80815](../../commit/21c80815))
- trigger workflow after bun test fix ([cc6099f8](../../commit/cc6099f8))
- trigger workflow test after bun install fix ([539debbf](../../commit/539debbf))

## [1.56.8] - 2025-12-10

### Fixed

- add cwd to spawnSync calls in CLI integration tests ([cd4d701d](../../commit/cd4d701d))
- skip marketplace-cache tests when module loading fails due to Bun bug ([052bfc9e](../../commit/052bfc9e))
- skip marketplace-cache tests in CI due to Bun bug ([92567a62](../../commit/92567a62))
- use dynamic import for marketplace-cache in update.ts ([c81294ad](../../commit/c81294ad))
- rename marketplace-cache.test.ts to load first ([4b8c4816](../../commit/4b8c4816))
- remove global ink mock that was breaking other test files ([b5e6b73a](../../commit/b5e6b73a))
- regenerate package-lock.json for CI compatibility ([c4d4e0f9](../../commit/c4d4e0f9))
- resolve biome lint warnings in test files ([2fa44c23](../../commit/2fa44c23))

### Changed

- rename bushido-han package to han with expanded test coverage ([a320585d](../../commit/a320585d))

### Other

- trigger workflow after test mock fix ([21c80815](../../commit/21c80815))
- trigger workflow after bun test fix ([cc6099f8](../../commit/cc6099f8))
- trigger workflow test after bun install fix ([539debbf](../../commit/539debbf))

## [1.56.7] - 2025-12-10

### Fixed

- skip marketplace-cache tests when module loading fails due to Bun bug ([052bfc9e](../../commit/052bfc9e))
- skip marketplace-cache tests in CI due to Bun bug ([92567a62](../../commit/92567a62))
- use dynamic import for marketplace-cache in update.ts ([c81294ad](../../commit/c81294ad))
- rename marketplace-cache.test.ts to load first ([4b8c4816](../../commit/4b8c4816))
- remove global ink mock that was breaking other test files ([b5e6b73a](../../commit/b5e6b73a))
- regenerate package-lock.json for CI compatibility ([c4d4e0f9](../../commit/c4d4e0f9))
- resolve biome lint warnings in test files ([2fa44c23](../../commit/2fa44c23))

### Changed

- rename bushido-han package to han with expanded test coverage ([a320585d](../../commit/a320585d))

### Other

- trigger workflow after test mock fix ([21c80815](../../commit/21c80815))
- trigger workflow after bun test fix ([cc6099f8](../../commit/cc6099f8))
- trigger workflow test after bun install fix ([539debbf](../../commit/539debbf))

## [1.56.6] - 2025-12-10

### Fixed

- skip marketplace-cache tests in CI due to Bun bug ([92567a62](../../commit/92567a62))
- use dynamic import for marketplace-cache in update.ts ([c81294ad](../../commit/c81294ad))
- rename marketplace-cache.test.ts to load first ([4b8c4816](../../commit/4b8c4816))
- remove global ink mock that was breaking other test files ([b5e6b73a](../../commit/b5e6b73a))
- regenerate package-lock.json for CI compatibility ([c4d4e0f9](../../commit/c4d4e0f9))
- resolve biome lint warnings in test files ([2fa44c23](../../commit/2fa44c23))

### Changed

- rename bushido-han package to han with expanded test coverage ([a320585d](../../commit/a320585d))

### Other

- trigger workflow after test mock fix ([21c80815](../../commit/21c80815))
- trigger workflow after bun test fix ([cc6099f8](../../commit/cc6099f8))
- trigger workflow test after bun install fix ([539debbf](../../commit/539debbf))

## [1.56.5] - 2025-12-08

### Added

- add han-config.json to configure custom build command ([88424dd2](../../commit/88424dd2))
- add CLI command for frustration detection ([ec3ec78f](../../commit/ec3ec78f))
- add sentiment package for user frustration detection ([768f8d39](../../commit/768f8d39))
- add description field support to han-config.json ([f7c0c3f8](../../commit/f7c0c3f8))

### Fixed

- improve SQLite concurrency and lock handling for metrics ([99561b65](../../commit/99561b65))
- make search useInput hook only active when not typing ([0359940b](../../commit/0359940b))
- remove unused variable and add ts-expect-error for TerminalRenderer ([680cfbea](../../commit/680cfbea))
- wait for marketplace load before enabling search in --auto mode ([e2ae8342](../../commit/e2ae8342))
- remove bun.lock from han-native to prevent jutsu-bun hook ([372d7fd1](../../commit/372d7fd1))
- correct native module embedding for cross-platform builds ([9769a3f7](../../commit/9769a3f7))
- make native module loading lazy to prevent eager load failures ([889d476a](../../commit/889d476a))
- resolve interface freeze in search mode with --auto flag ([be6f8737](../../commit/be6f8737))
- remove unused error variable in catch block ([eac573e9](../../commit/eac573e9))
- read user prompt from stdin hook event JSON ([359f6b43](../../commit/359f6b43))
- remove async database calls from CLI detect-frustration ([e828663f](../../commit/e828663f))
- use han-config.yml instead of han-config.json for package overrides ([e5bfc843](../../commit/e5bfc843))
- add -y flag to remaining npx typescript commands ([03543a73](../../commit/03543a73))

### Changed

- remove hashi-han-metrics plugin ([88aa8245](../../commit/88aa8245))

### Other

- format code with biome and rebuild native module ([50e3fbd1](../../commit/50e3fbd1))

## [1.56.4] - 2025-12-08

### Added

- add han-config.json to configure custom build command ([88424dd2](../../commit/88424dd2))
- add CLI command for frustration detection ([ec3ec78f](../../commit/ec3ec78f))
- add sentiment package for user frustration detection ([768f8d39](../../commit/768f8d39))
- add description field support to han-config.json ([f7c0c3f8](../../commit/f7c0c3f8))

### Fixed

- remove unused variable and add ts-expect-error for TerminalRenderer ([680cfbea](../../commit/680cfbea))
- wait for marketplace load before enabling search in --auto mode ([e2ae8342](../../commit/e2ae8342))
- remove bun.lock from han-native to prevent jutsu-bun hook ([372d7fd1](../../commit/372d7fd1))
- correct native module embedding for cross-platform builds ([9769a3f7](../../commit/9769a3f7))
- make native module loading lazy to prevent eager load failures ([889d476a](../../commit/889d476a))
- resolve interface freeze in search mode with --auto flag ([be6f8737](../../commit/be6f8737))
- remove unused error variable in catch block ([eac573e9](../../commit/eac573e9))
- read user prompt from stdin hook event JSON ([359f6b43](../../commit/359f6b43))
- remove async database calls from CLI detect-frustration ([e828663f](../../commit/e828663f))
- use han-config.yml instead of han-config.json for package overrides ([e5bfc843](../../commit/e5bfc843))
- add -y flag to remaining npx typescript commands ([03543a73](../../commit/03543a73))
- convert hook timeout from seconds to milliseconds ([985ecde3](../../commit/985ecde3))

### Changed

- remove hashi-han-metrics plugin ([88aa8245](../../commit/88aa8245))

### Other

- format code with biome and rebuild native module ([50e3fbd1](../../commit/50e3fbd1))

## [1.56.3] - 2025-12-08

### Added

- add han-config.json to configure custom build command ([88424dd2](../../commit/88424dd2))
- add CLI command for frustration detection ([ec3ec78f](../../commit/ec3ec78f))
- add sentiment package for user frustration detection ([768f8d39](../../commit/768f8d39))
- add description field support to han-config.json ([f7c0c3f8](../../commit/f7c0c3f8))

### Fixed

- wait for marketplace load before enabling search in --auto mode ([e2ae8342](../../commit/e2ae8342))
- remove bun.lock from han-native to prevent jutsu-bun hook ([372d7fd1](../../commit/372d7fd1))
- correct native module embedding for cross-platform builds ([9769a3f7](../../commit/9769a3f7))
- make native module loading lazy to prevent eager load failures ([889d476a](../../commit/889d476a))
- resolve interface freeze in search mode with --auto flag ([be6f8737](../../commit/be6f8737))
- remove unused error variable in catch block ([eac573e9](../../commit/eac573e9))
- read user prompt from stdin hook event JSON ([359f6b43](../../commit/359f6b43))
- remove async database calls from CLI detect-frustration ([e828663f](../../commit/e828663f))
- use han-config.yml instead of han-config.json for package overrides ([e5bfc843](../../commit/e5bfc843))
- add -y flag to remaining npx typescript commands ([03543a73](../../commit/03543a73))
- convert hook timeout from seconds to milliseconds ([985ecde3](../../commit/985ecde3))

### Changed

- remove hashi-han-metrics plugin ([88aa8245](../../commit/88aa8245))

### Other

- format code with biome and rebuild native module ([50e3fbd1](../../commit/50e3fbd1))

## [1.56.2] - 2025-12-08

### Added

- add han-config.json to configure custom build command ([88424dd2](../../commit/88424dd2))
- add CLI command for frustration detection ([ec3ec78f](../../commit/ec3ec78f))
- add sentiment package for user frustration detection ([768f8d39](../../commit/768f8d39))
- add description field support to han-config.json ([f7c0c3f8](../../commit/f7c0c3f8))

### Fixed

- remove bun.lock from han-native to prevent jutsu-bun hook ([372d7fd1](../../commit/372d7fd1))
- correct native module embedding for cross-platform builds ([9769a3f7](../../commit/9769a3f7))
- make native module loading lazy to prevent eager load failures ([889d476a](../../commit/889d476a))
- resolve interface freeze in search mode with --auto flag ([be6f8737](../../commit/be6f8737))
- remove unused error variable in catch block ([eac573e9](../../commit/eac573e9))
- read user prompt from stdin hook event JSON ([359f6b43](../../commit/359f6b43))
- remove async database calls from CLI detect-frustration ([e828663f](../../commit/e828663f))
- use han-config.yml instead of han-config.json for package overrides ([e5bfc843](../../commit/e5bfc843))
- add -y flag to remaining npx typescript commands ([03543a73](../../commit/03543a73))
- convert hook timeout from seconds to milliseconds ([985ecde3](../../commit/985ecde3))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Changed

- remove hashi-han-metrics plugin ([88aa8245](../../commit/88aa8245))

### Other

- format code with biome and rebuild native module ([50e3fbd1](../../commit/50e3fbd1))

## [1.56.1] - 2025-12-08

### Added

- add description field support to han-config.json ([f7c0c3f8](../../commit/f7c0c3f8))
- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- move storage to ~/.claude/han/metrics ([0f72ad9b](../../commit/0f72ad9b))

### Fixed

- add -y flag to remaining npx typescript commands ([03543a73](../../commit/03543a73))
- convert hook timeout from seconds to milliseconds ([985ecde3](../../commit/985ecde3))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))
- expand CLAUDE_PLUGIN_ROOT environment variable in han hook reference ([9a381c85](../../commit/9a381c85))
- add biome-ignore for intentional string concatenation ([daff77bd](../../commit/daff77bd))
- properly output CLAUDE_PLUGIN_ROOT for expansion in hooks ([cc97a3eb](../../commit/cc97a3eb))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.56.0] - 2025-12-08

### Added

- add description field support to han-config.json ([f7c0c3f8](../../commit/f7c0c3f8))
- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- move storage to ~/.claude/han/metrics ([0f72ad9b](../../commit/0f72ad9b))
- add agent detection to han explain ([245601e8](../../commit/245601e8))

### Fixed

- convert hook timeout from seconds to milliseconds ([985ecde3](../../commit/985ecde3))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))
- expand CLAUDE_PLUGIN_ROOT environment variable in han hook reference ([9a381c85](../../commit/9a381c85))
- add biome-ignore for intentional string concatenation ([daff77bd](../../commit/daff77bd))
- properly output CLAUDE_PLUGIN_ROOT for expansion in hooks ([cc97a3eb](../../commit/cc97a3eb))
- correct plugin path detection in han explain ([c5b90b40](../../commit/c5b90b40))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.55.3] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- move storage to ~/.claude/han/metrics ([0f72ad9b](../../commit/0f72ad9b))
- add agent detection to han explain ([245601e8](../../commit/245601e8))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- convert hook timeout from seconds to milliseconds ([985ecde3](../../commit/985ecde3))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))
- expand CLAUDE_PLUGIN_ROOT environment variable in han hook reference ([9a381c85](../../commit/9a381c85))
- add biome-ignore for intentional string concatenation ([daff77bd](../../commit/daff77bd))
- properly output CLAUDE_PLUGIN_ROOT for expansion in hooks ([cc97a3eb](../../commit/cc97a3eb))
- correct plugin path detection in han explain ([c5b90b40](../../commit/c5b90b40))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.55.2] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- move storage to ~/.claude/han/metrics ([0f72ad9b](../../commit/0f72ad9b))
- add agent detection to han explain ([245601e8](../../commit/245601e8))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))
- expand CLAUDE_PLUGIN_ROOT environment variable in han hook reference ([9a381c85](../../commit/9a381c85))
- add biome-ignore for intentional string concatenation ([daff77bd](../../commit/daff77bd))
- properly output CLAUDE_PLUGIN_ROOT for expansion in hooks ([cc97a3eb](../../commit/cc97a3eb))
- correct plugin path detection in han explain ([c5b90b40](../../commit/c5b90b40))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.55.1] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- move storage to ~/.claude/han/metrics ([0f72ad9b](../../commit/0f72ad9b))
- add agent detection to han explain ([245601e8](../../commit/245601e8))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- expand CLAUDE_PLUGIN_ROOT environment variable in han hook reference ([9a381c85](../../commit/9a381c85))
- add biome-ignore for intentional string concatenation ([daff77bd](../../commit/daff77bd))
- properly output CLAUDE_PLUGIN_ROOT for expansion in hooks ([cc97a3eb](../../commit/cc97a3eb))
- correct plugin path detection in han explain ([c5b90b40](../../commit/c5b90b40))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))
- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.55.0] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- move storage to ~/.claude/han/metrics ([0f72ad9b](../../commit/0f72ad9b))
- add agent detection to han explain ([245601e8](../../commit/245601e8))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- expand CLAUDE_PLUGIN_ROOT environment variable in han hook reference ([9a381c85](../../commit/9a381c85))
- add biome-ignore for intentional string concatenation ([daff77bd](../../commit/daff77bd))
- properly output CLAUDE_PLUGIN_ROOT for expansion in hooks ([cc97a3eb](../../commit/cc97a3eb))
- correct plugin path detection in han explain ([c5b90b40](../../commit/c5b90b40))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))
- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))

## [1.54.0] - 2025-12-07

### Added

- move storage to ~/.claude/han/metrics ([0f72ad9b](../../commit/0f72ad9b))
- add agent detection to han explain ([245601e8](../../commit/245601e8))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- expand CLAUDE_PLUGIN_ROOT environment variable in han hook reference ([9a381c85](../../commit/9a381c85))
- add biome-ignore for intentional string concatenation ([daff77bd](../../commit/daff77bd))
- properly output CLAUDE_PLUGIN_ROOT for expansion in hooks ([cc97a3eb](../../commit/cc97a3eb))
- correct plugin path detection in han explain ([c5b90b40](../../commit/c5b90b40))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))
- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))
- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))

## [1.53.3] - 2025-12-07

### Added

- add agent detection to han explain ([245601e8](../../commit/245601e8))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- expand CLAUDE_PLUGIN_ROOT environment variable in han hook reference ([9a381c85](../../commit/9a381c85))
- add biome-ignore for intentional string concatenation ([daff77bd](../../commit/daff77bd))
- properly output CLAUDE_PLUGIN_ROOT for expansion in hooks ([cc97a3eb](../../commit/cc97a3eb))
- correct plugin path detection in han explain ([c5b90b40](../../commit/c5b90b40))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))
- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))
- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))

## [1.53.2] - 2025-12-07

### Added

- add agent detection to han explain ([245601e8](../../commit/245601e8))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- add biome-ignore for intentional string concatenation ([daff77bd](../../commit/daff77bd))
- properly output CLAUDE_PLUGIN_ROOT for expansion in hooks ([cc97a3eb](../../commit/cc97a3eb))
- correct plugin path detection in han explain ([c5b90b40](../../commit/c5b90b40))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))
- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))
- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))

## [1.53.1] - 2025-12-07

### Added

- add agent detection to han explain ([245601e8](../../commit/245601e8))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- properly output CLAUDE_PLUGIN_ROOT for expansion in hooks ([cc97a3eb](../../commit/cc97a3eb))
- correct plugin path detection in han explain ([c5b90b40](../../commit/c5b90b40))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))
- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))
- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))

## [1.53.0] - 2025-12-07

### Added

- add agent detection to han explain ([245601e8](../../commit/245601e8))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- correct plugin path detection in han explain ([c5b90b40](../../commit/c5b90b40))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))
- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))
- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))
- rename han-core to core and update website ([190f876b](../../commit/190f876b))

## [1.52.3] - 2025-12-07

### Added

- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- correct plugin path detection in han explain ([c5b90b40](../../commit/c5b90b40))
- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))
- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))
- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))
- rename han-core to core and update website ([190f876b](../../commit/190f876b))

## [1.52.2] - 2025-12-07

### Added

- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))
- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))
- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))
- rename han-core to core and update website ([190f876b](../../commit/190f876b))

## [1.52.1] - 2025-12-07

### Added

- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))
- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))
- rename han-core to core and update website ([190f876b](../../commit/190f876b))

## [1.52.0] - 2025-12-07

### Added

- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))
- rename han-core to core and update website ([190f876b](../../commit/190f876b))

## [1.51.3] - 2025-12-07

### Added

- add new CLI commands and jutsu-claude-agent-sdk plugin ([977acadc](../../commit/977acadc))

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))
- test source code in CI instead of building binary ([00f09311](../../commit/00f09311))
- update tests to default to binary-only distribution ([f9a99152](../../commit/f9a99152))
- resolve linting and typecheck issues ([72af6050](../../commit/72af6050))

### Changed

- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))
- rename han-core to core and update website ([190f876b](../../commit/190f876b))
- remove TypeScript build step from binary-only distribution ([30fccf9b](../../commit/30fccf9b))

### Other

- add binary distribution architecture comment to main.ts ([89655dc5](../../commit/89655dc5))
- migrate test suite to bun test (partial - 42/56 tests) ([07ce2c16](../../commit/07ce2c16))

## [1.51.2] - 2025-12-07

### Added

- add new CLI commands and jutsu-claude-agent-sdk plugin ([977acadc](../../commit/977acadc))
- add user frustration detection and tracking ([b02e0866](../../commit/b02e0866))
- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))

### Fixed

- test source code in CI instead of building binary ([00f09311](../../commit/00f09311))
- update tests to default to binary-only distribution ([f9a99152](../../commit/f9a99152))
- resolve linting and typecheck issues ([72af6050](../../commit/72af6050))
- replace better-sqlite3 with bun:sqlite for binary compatibility ([9d1b2125](../../commit/9d1b2125))
- show helpful error for binary builds instead of crashing ([33bcfc77](../../commit/33bcfc77))
- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))

### Changed

- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))
- rename han-core to core and update website ([190f876b](../../commit/190f876b))
- remove TypeScript build step from binary-only distribution ([30fccf9b](../../commit/30fccf9b))

### Other

- add binary distribution architecture comment to main.ts ([89655dc5](../../commit/89655dc5))
- migrate test suite to bun test (partial - 42/56 tests) ([07ce2c16](../../commit/07ce2c16))
- switch test suite from Node.js to Bun for bun:sqlite compatibility ([9f6ee999](../../commit/9f6ee999))
- apply biome formatting to plugin.json and import ordering ([963a99f6](../../commit/963a99f6))
- document npx wrapper + platform binary distribution ([dbfaa7ba](../../commit/dbfaa7ba))
- document npx wrapper + platform binary distribution ([6e478daa](../../commit/6e478daa))
- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))

## [1.51.1] - 2025-12-07

### Added

- add new CLI commands and jutsu-claude-agent-sdk plugin ([977acadc](../../commit/977acadc))
- add user frustration detection and tracking ([b02e0866](../../commit/b02e0866))
- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))
- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- test source code in CI instead of building binary ([00f09311](../../commit/00f09311))
- update tests to default to binary-only distribution ([f9a99152](../../commit/f9a99152))
- resolve linting and typecheck issues ([72af6050](../../commit/72af6050))
- replace better-sqlite3 with bun:sqlite for binary compatibility ([9d1b2125](../../commit/9d1b2125))
- show helpful error for binary builds instead of crashing ([33bcfc77](../../commit/33bcfc77))
- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))

### Changed

- rename han-core to core and update website ([190f876b](../../commit/190f876b))
- remove TypeScript build step from binary-only distribution ([30fccf9b](../../commit/30fccf9b))

### Other

- add binary distribution architecture comment to main.ts ([89655dc5](../../commit/89655dc5))
- migrate test suite to bun test (partial - 42/56 tests) ([07ce2c16](../../commit/07ce2c16))
- switch test suite from Node.js to Bun for bun:sqlite compatibility ([9f6ee999](../../commit/9f6ee999))
- apply biome formatting to plugin.json and import ordering ([963a99f6](../../commit/963a99f6))
- document npx wrapper + platform binary distribution ([dbfaa7ba](../../commit/dbfaa7ba))
- document npx wrapper + platform binary distribution ([6e478daa](../../commit/6e478daa))
- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))

## [1.51.0] - 2025-12-06

### Added

- add new CLI commands and jutsu-claude-agent-sdk plugin ([977acadc](../../commit/977acadc))
- add user frustration detection and tracking ([b02e0866](../../commit/b02e0866))
- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))
- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- test source code in CI instead of building binary ([00f09311](../../commit/00f09311))
- update tests to default to binary-only distribution ([f9a99152](../../commit/f9a99152))
- resolve linting and typecheck issues ([72af6050](../../commit/72af6050))
- replace better-sqlite3 with bun:sqlite for binary compatibility ([9d1b2125](../../commit/9d1b2125))
- show helpful error for binary builds instead of crashing ([33bcfc77](../../commit/33bcfc77))
- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))

### Changed

- remove TypeScript build step from binary-only distribution ([30fccf9b](../../commit/30fccf9b))
- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- add binary distribution architecture comment to main.ts ([89655dc5](../../commit/89655dc5))
- migrate test suite to bun test (partial - 42/56 tests) ([07ce2c16](../../commit/07ce2c16))
- switch test suite from Node.js to Bun for bun:sqlite compatibility ([9f6ee999](../../commit/9f6ee999))
- apply biome formatting to plugin.json and import ordering ([963a99f6](../../commit/963a99f6))
- document npx wrapper + platform binary distribution ([dbfaa7ba](../../commit/dbfaa7ba))
- document npx wrapper + platform binary distribution ([6e478daa](../../commit/6e478daa))
- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))
- update README for CLI integration ([34407550](../../commit/34407550))

## [1.50.1] - 2025-12-06

### Added

- add user frustration detection and tracking ([b02e0866](../../commit/b02e0866))
- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))
- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- test source code in CI instead of building binary ([00f09311](../../commit/00f09311))
- update tests to default to binary-only distribution ([f9a99152](../../commit/f9a99152))
- resolve linting and typecheck issues ([72af6050](../../commit/72af6050))
- replace better-sqlite3 with bun:sqlite for binary compatibility ([9d1b2125](../../commit/9d1b2125))
- show helpful error for binary builds instead of crashing ([33bcfc77](../../commit/33bcfc77))
- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))

### Changed

- remove TypeScript build step from binary-only distribution ([30fccf9b](../../commit/30fccf9b))
- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- add binary distribution architecture comment to main.ts ([89655dc5](../../commit/89655dc5))
- migrate test suite to bun test (partial - 42/56 tests) ([07ce2c16](../../commit/07ce2c16))
- switch test suite from Node.js to Bun for bun:sqlite compatibility ([9f6ee999](../../commit/9f6ee999))
- apply biome formatting to plugin.json and import ordering ([963a99f6](../../commit/963a99f6))
- document npx wrapper + platform binary distribution ([dbfaa7ba](../../commit/dbfaa7ba))
- document npx wrapper + platform binary distribution ([6e478daa](../../commit/6e478daa))
- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))
- update README for CLI integration ([34407550](../../commit/34407550))

## [1.50.0] - 2025-12-06

### Added

- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))
- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- show helpful error for binary builds instead of crashing ([33bcfc77](../../commit/33bcfc77))
- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))
- update README for CLI integration ([34407550](../../commit/34407550))

## [1.49.5] - 2025-12-06

### Added

- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- show helpful error for binary builds instead of crashing ([33bcfc77](../../commit/33bcfc77))
- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))
- update README for CLI integration ([34407550](../../commit/34407550))

## [1.49.4] - 2025-12-06

### Added

- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))
- disable distributed fail-fast for MCP tools ([79d93e94](../../commit/79d93e94))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))
- update README for CLI integration ([34407550](../../commit/34407550))

## [1.49.3] - 2025-12-06

### Added

- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))
- disable distributed fail-fast for MCP tools ([79d93e94](../../commit/79d93e94))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- update README for CLI integration ([34407550](../../commit/34407550))

## [1.49.2] - 2025-12-06

### Added

- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))
- disable distributed fail-fast for MCP tools ([79d93e94](../../commit/79d93e94))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- update README for CLI integration ([34407550](../../commit/34407550))

## [1.49.1] - 2025-12-05

### Added

- add pre-push hook verification feature ([65bcac74](../../commit/65bcac74))
- add hook verify command for validation testing ([e9f4ffe8](../../commit/e9f4ffe8))
- add HAN_DISABLE_HOOKS environment variable for global hook disable ([ae87177e](../../commit/ae87177e))
- add real-time streaming to hook test output viewer ([c00fbda8](../../commit/c00fbda8))
- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))

### Fixed

- disable distributed fail-fast for MCP tools ([79d93e94](../../commit/79d93e94))
- use merged settings for hook run command ([0f535f33](../../commit/0f535f33))
- handle Ctrl+C gracefully in hook test --execute ([c6834331](../../commit/c6834331))
- remove unused imports from hook-test.ts ([d585d855](../../commit/d585d855))
- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))

### Changed

- stream hook output within Ink UI instead of unmounting ([47b71d96](../../commit/47b71d96))

### Other

- simplify hook verify cache test ([c24adb83](../../commit/c24adb83))
- add tests for hook verify command ([7bce40dc](../../commit/7bce40dc))
- apply biome formatting to hook test files ([a03e95fd](../../commit/a03e95fd))
- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.49.0] - 2025-12-05

### Added

- add pre-push hook verification feature ([65bcac74](../../commit/65bcac74))
- add hook verify command for validation testing ([e9f4ffe8](../../commit/e9f4ffe8))
- add HAN_DISABLE_HOOKS environment variable for global hook disable ([ae87177e](../../commit/ae87177e))
- add real-time streaming to hook test output viewer ([c00fbda8](../../commit/c00fbda8))
- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))

### Fixed

- use merged settings for hook run command ([0f535f33](../../commit/0f535f33))
- handle Ctrl+C gracefully in hook test --execute ([c6834331](../../commit/c6834331))
- remove unused imports from hook-test.ts ([d585d855](../../commit/d585d855))
- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))

### Changed

- stream hook output within Ink UI instead of unmounting ([47b71d96](../../commit/47b71d96))

### Other

- simplify hook verify cache test ([c24adb83](../../commit/c24adb83))
- add tests for hook verify command ([7bce40dc](../../commit/7bce40dc))
- apply biome formatting to hook test files ([a03e95fd](../../commit/a03e95fd))
- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.6] - 2025-12-05

### Added

- add HAN_DISABLE_HOOKS environment variable for global hook disable ([ae87177e](../../commit/ae87177e))
- add real-time streaming to hook test output viewer ([c00fbda8](../../commit/c00fbda8))
- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))

### Fixed

- use merged settings for hook run command ([0f535f33](../../commit/0f535f33))
- handle Ctrl+C gracefully in hook test --execute ([c6834331](../../commit/c6834331))
- remove unused imports from hook-test.ts ([d585d855](../../commit/d585d855))
- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))

### Changed

- stream hook output within Ink UI instead of unmounting ([47b71d96](../../commit/47b71d96))

### Other

- apply biome formatting to hook test files ([a03e95fd](../../commit/a03e95fd))
- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.5] - 2025-12-05

### Added

- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))

### Fixed

- remove unused imports from hook-test.ts ([d585d855](../../commit/d585d855))
- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))

### Changed

- stream hook output within Ink UI instead of unmounting ([47b71d96](../../commit/47b71d96))

### Other

- apply biome formatting to hook test files ([a03e95fd](../../commit/a03e95fd))
- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.4] - 2025-12-05

### Added

- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))

### Fixed

- remove unused imports from hook-test.ts ([d585d855](../../commit/d585d855))
- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))

### Changed

- stream hook output within Ink UI instead of unmounting ([47b71d96](../../commit/47b71d96))

### Other

- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.3] - 2025-12-05

### Added

- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))

### Fixed

- remove unused imports from hook-test.ts ([d585d855](../../commit/d585d855))
- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))

### Other

- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.2] - 2025-12-05

### Added

- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))

### Fixed

- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))

### Other

- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.1] - 2025-12-04

### Added

- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))

### Fixed

- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))

### Other

- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.0] - 2025-12-04

### Added

- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))

### Fixed

- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))

### Other

- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))
- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))

## [1.47.4] - 2025-12-04

### Added

- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))
- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))

### Fixed

- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))

### Other

- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))
- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))

## [1.47.3] - 2025-12-04

### Added

- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))
- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))

### Fixed

- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))
- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))

## [1.47.2] - 2025-12-04

### Added

- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))
- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))

### Fixed

- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))
- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))

## [1.47.1] - 2025-12-04

### Added

- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))
- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))

### Fixed

- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))
- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))

## [1.47.0] - 2025-12-04

### Added

- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))
- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))

### Fixed

- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))
- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))

## [1.46.0] - 2025-12-04

### Added

- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))
- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))

### Fixed

- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))
- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.45.2] - 2025-12-04

### Added

- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))
- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))

### Fixed

- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))
- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.45.1] - 2025-12-04

### Added

- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))
- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))

### Fixed

- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.45.0] - 2025-12-04

### Added

- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))
- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))

### Fixed

- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))
- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.44.2] - 2025-12-04

### Added

- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))
- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))

### Fixed

- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))
- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.44.1] - 2025-12-04

### Added

- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))
- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))

### Fixed

- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))
- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.44.0] - 2025-12-04

### Added

- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))
- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))
- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))

### Fixed

- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))
- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.42.3] - 2025-12-04

### Added

- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))
- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))

### Fixed

- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))
- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.42.2] - 2025-12-04

### Added

- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))
- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))

### Fixed

- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))
- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))

## [1.42.1] - 2025-12-04

### Added

- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))
- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))

### Fixed

- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))
- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))

## [1.42.0] - 2025-12-04

### Added

- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))
- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))

### Fixed

- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))
- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))

## [1.41.2] - 2025-12-04

### Added

- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))
- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))

### Fixed

- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))
- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))

## [1.41.1] - 2025-12-04

### Added

- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))

### Fixed

- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))
- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))

## [1.41.0] - 2025-12-04

### Added

- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))

### Fixed

- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))
- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))

## [1.40.0] - 2025-12-04

### Added

- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))
- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))

### Fixed

- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))
- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))
- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))
- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.6] - 2025-12-04

### Added

- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))
- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))

### Fixed

- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))
- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))
- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))
- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.5] - 2025-12-03

### Added

- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))
- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))
- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))
- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.4] - 2025-12-03

### Added

- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))
- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))
- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))
- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.3] - 2025-12-03

### Added

- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))
- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.2] - 2025-12-03

### Added

- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))
- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.1] - 2025-12-03

### Added

- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.0] - 2025-12-03

### Added

- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.38.0] - 2025-12-03

### Added

- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.37.1] - 2025-12-03

### Added

- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))
- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.37.0] - 2025-12-03

### Added

- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))
- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.36.7] - 2025-12-03

### Added

- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))
- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))
- remove double blank lines from CHANGELOGs ([dbe3a96f](../../commit/dbe3a96f))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.36.6] - 2025-12-03

### Added

- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))
- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))
- remove double blank lines from CHANGELOGs ([dbe3a96f](../../commit/dbe3a96f))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.36.5] - 2025-12-03

### Added

- inject dispatch hooks on plugin install ([1d3119b9](../../commit/1d3119b9))

### Fixed

- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))
- remove double blank lines from CHANGELOGs ([dbe3a96f](../../commit/dbe3a96f))
- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([480d6c7d](../../commit/480d6c7d))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))

## [1.36.4] - 2025-12-03

### Added

- inject dispatch hooks on plugin install ([1d3119b9](../../commit/1d3119b9))
- add hook dispatch command for Claude Code bug workaround ([96cf0d24](../../commit/96cf0d24))
- add npx cache self-repair and remove JS fallback ([37ae33f9](../../commit/37ae33f9))

### Fixed

- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))
- remove double blank lines from CHANGELOGs ([dbe3a96f](../../commit/dbe3a96f))
- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([480d6c7d](../../commit/480d6c7d))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- use local plugin store for hook dispatch ([c80f1c99](../../commit/c80f1c99))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))
- clear log lines when transitioning to plugin selector ([2e40ee6c](../../commit/2e40ee6c))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([d56a0ad3](../../commit/d56a0ad3))
