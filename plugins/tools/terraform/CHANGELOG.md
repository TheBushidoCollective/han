# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.10.0] - 2026-02-10

### Fixed

- remove PostToolUse from plugin hooks that don't use HAN_FILES ([128e3616](../../commit/128e3616))

## [1.10.0] - 2026-02-07

### Added

- add PostToolUse hooks to 19 plugins for incremental validation ([1577c302](../../commit/1577c302))
- auto-generate hooks.json from han-plugin.yml with shorthand events ([f3a39941](../../commit/f3a39941))

### Fixed

- async Stop hooks, merge test/test-async, fix plugin name resolution ([ba6474e8](../../commit/ba6474e8))

## [1.10.0] - 2026-02-07

### Added

- auto-generate hooks.json from han-plugin.yml with shorthand events ([f3a39941](../../commit/f3a39941))

## [1.10.0] - 2026-01-30

### Fixed

- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))

### Other

- Merge pull request #41 from TheBushidoCollective/han-1 ([0b677ba6](../../commit/0b677ba6))

## [1.10.0] - 2026-01-29

### Fixed

- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))

## [1.10.0] - 2026-01-24

### Fixed

- fix failing tests due to module path and missing exports ([3ff76091](../../commit/3ff76091))

### Changed

- extract complex inline hook commands to shell scripts ([953a540a](../../commit/953a540a))

## [1.9.0] - 2025-12-12

### Added

- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))

### Changed

- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))

## [1.8.18] - 2025-12-11

### Changed

- improve agent descriptions and remove unused SQLite types ([d327ef18](../../commit/d327ef18))

## [1.8.17] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- enhance prompt hook display with accordion format ([5a1e09d6](../../commit/5a1e09d6))

### Fixed

- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.8.16] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- enhance prompt hook display with accordion format ([5a1e09d6](../../commit/5a1e09d6))

### Fixed

- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.8.15] - 2025-12-07

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

## [1.8.14] - 2025-12-04

### Other

- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))

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
