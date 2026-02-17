# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.10.0] - 2026-02-17

### Added

- backend rearchitecture — Rust crates replace han-native (#70) ([877601e0](../../commit/877601e0))

## [1.10.0] - 2026-02-07

### Added

- auto-generate hooks.json from han-plugin.yml with shorthand events ([f3a39941](../../commit/f3a39941))

### Fixed

- async Stop hooks, merge test/test-async, fix plugin name resolution ([ba6474e8](../../commit/ba6474e8))
- replace npx with direct han binary, fix auto-detect plugin matching ([11c3edfa](../../commit/11c3edfa))

### Changed

- remove file_filter, split test hooks into Stop + PostToolUse ([bd1b5e34](../../commit/bd1b5e34))

## [1.10.0] - 2026-02-07

### Added

- auto-generate hooks.json from han-plugin.yml with shorthand events ([f3a39941](../../commit/f3a39941))

### Fixed

- replace npx with direct han binary, fix auto-detect plugin matching ([11c3edfa](../../commit/11c3edfa))

## [1.10.0] - 2026-01-30

## [1.10.0] - 2026-01-24

## [1.9.0] - 2025-12-12

### Added

- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))

## [1.8.17] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))

### Fixed

- add -y flag to all npx commands to prevent interactive prompts ([c8385bf3](../../commit/c8385bf3))
- remove duplicate strings in hook commands ([63199a44](../../commit/63199a44))
- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.8.16] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- enhance prompt hook display with accordion format ([5a1e09d6](../../commit/5a1e09d6))

### Fixed

- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.8.15] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- enhance prompt hook display with accordion format ([5a1e09d6](../../commit/5a1e09d6))

### Fixed

- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.8.14] - 2025-12-07

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

## [1.8.13] - 2025-12-03

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

## [1.8.12] - 2025-12-03

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

## [1.8.11] - 2025-12-03

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

## [1.8.10] - 2025-12-03

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

## [1.8.9] - 2025-12-03

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

## [1.8.8] - 2025-12-03

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

## [1.8.7] - 2025-12-03

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

## [1.8.6] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))

## [1.8.5] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOGs ([d3773c3](../../commit/d3773c3))
- remove double blank lines from existing CHANGELOGs ([b829c36](../../commit/b829c36))
- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))

## [1.8.4] - 2025-12-03

### Fixed

- remove double blank lines from existing CHANGELOGs ([b829c36](../../commit/b829c36))
- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))

## [1.8.3] - 2025-12-03

### Fixed

- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))

## [1.8.2] - 2025-12-03

### Fixed

- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))

## [1.8.1] - 2025-12-03

### Fixed

- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))

## [1.8.0] - 2025-12-03

### Fixed

- source CLAUDE_ENV_FILE before running hook commands ([4558340](../../commit/4558340))
- remove SubagentStop hooks to prevent infinite loops ([870244c](../../commit/870244c))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))
