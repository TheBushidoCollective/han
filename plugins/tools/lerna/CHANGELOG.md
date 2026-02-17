# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.4.0] - 2026-02-17

### Added

- backend rearchitecture — Rust crates replace han-native (#70) ([877601e0](../../commit/877601e0))

## [1.4.0] - 2026-02-07

### Added

- auto-generate hooks.json from han-plugin.yml with shorthand events ([f3a39941](../../commit/f3a39941))

## [1.4.0] - 2026-01-30

## [1.4.0] - 2026-01-24

### Changed

- extract complex inline hook commands to shell scripts ([953a540a](../../commit/953a540a))

## [1.3.1] - 2025-12-13

### BREAKING CHANGES

- make caching and fail-fast default behavior for hooks ([491fd7a1](../../commit/491fd7a1))

### Added

- add SubagentStart and SubagentStop hooks to all plugins ([1b4dba0d](../../commit/1b4dba0d))
- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))

### Changed

- normalize hook names to remove duplicative prefixes ([e182590e](../../commit/e182590e))

## [1.3.0] - 2025-12-12

### Added

- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))

## [1.2.17] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))

### Fixed

- add -y flag to all npx commands to prevent interactive prompts ([c8385bf3](../../commit/c8385bf3))
- remove duplicate strings in hook commands ([63199a44](../../commit/63199a44))
- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.2.16] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- enhance prompt hook display with accordion format ([5a1e09d6](../../commit/5a1e09d6))

### Fixed

- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.2.15] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- enhance prompt hook display with accordion format ([5a1e09d6](../../commit/5a1e09d6))

### Fixed

- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.2.14] - 2025-12-07

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

## [1.2.13] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))
- remove double blank lines from CHANGELOGs ([7d5bfb37](../../commit/7d5bfb37))
- remove double blank lines from CHANGELOGs ([ae2fa50f](../../commit/ae2fa50f))
- remove double blank lines from CHANGELOGs ([4a1daf78](../../commit/4a1daf78))
- remove double blank lines from CHANGELOGs ([84d69e10](../../commit/84d69e10))
- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([10c19571](../../commit/10c19571))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))

## [1.2.12] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOGs ([7d5bfb37](../../commit/7d5bfb37))
- remove double blank lines from CHANGELOGs ([ae2fa50f](../../commit/ae2fa50f))
- remove double blank lines from CHANGELOGs ([4a1daf78](../../commit/4a1daf78))
- remove double blank lines from CHANGELOGs ([84d69e10](../../commit/84d69e10))
- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([10c19571](../../commit/10c19571))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))

## [1.2.11] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOGs ([ae2fa50f](../../commit/ae2fa50f))
- remove double blank lines from CHANGELOGs ([4a1daf78](../../commit/4a1daf78))
- remove double blank lines from CHANGELOGs ([84d69e10](../../commit/84d69e10))
- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([10c19571](../../commit/10c19571))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))

## [1.2.10] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOGs ([4a1daf78](../../commit/4a1daf78))
- remove double blank lines from CHANGELOGs ([84d69e10](../../commit/84d69e10))
- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([10c19571](../../commit/10c19571))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))

## [1.2.9] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOGs ([84d69e10](../../commit/84d69e10))
- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([10c19571](../../commit/10c19571))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))

## [1.2.8] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([10c19571](../../commit/10c19571))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))

## [1.2.7] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOGs ([10c19571](../../commit/10c19571))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))

## [1.2.6] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))

## [1.2.5] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOGs ([d3773c3](../../commit/d3773c3))
- remove double blank lines from existing CHANGELOGs ([b829c36](../../commit/b829c36))
- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))

## [1.2.4] - 2025-12-03

### Fixed

- remove double blank lines from existing CHANGELOGs ([b829c36](../../commit/b829c36))
- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))

## [1.2.3] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))

## [1.2.2] - 2025-12-03

### Fixed

- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))

## [1.2.1] - 2025-12-03

### Fixed

- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))

## [1.2.0] - 2025-12-03

### Fixed

- source CLAUDE_ENV_FILE before running hook commands ([4558340](../../commit/4558340))
- remove SubagentStop hooks to prevent infinite loops ([870244c](../../commit/870244c))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))
