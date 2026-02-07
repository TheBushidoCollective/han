# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.4.0] - 2026-02-07

### Added

- auto-generate hooks.json from han-plugin.yml with shorthand events ([f3a39941](../../commit/f3a39941))

### Fixed

- async Stop hooks, merge test/test-async, fix plugin name resolution ([ba6474e8](../../commit/ba6474e8))
- replace npx with direct han binary, fix auto-detect plugin matching ([11c3edfa](../../commit/11c3edfa))

### Changed

- remove file_filter, split test hooks into Stop + PostToolUse ([bd1b5e34](../../commit/bd1b5e34))

## [2.4.0] - 2026-02-07

### Added

- auto-generate hooks.json from han-plugin.yml with shorthand events ([f3a39941](../../commit/f3a39941))

### Fixed

- replace npx with direct han binary, fix auto-detect plugin matching ([11c3edfa](../../commit/11c3edfa))

## [2.4.0] - 2026-01-30

### Fixed

- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))

### Other

- Merge pull request #41 from TheBushidoCollective/han-1 ([0b677ba6](../../commit/0b677ba6))

## [2.4.0] - 2026-01-29

### Fixed

- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))

## [2.4.0] - 2026-01-24

### Fixed

- fix failing tests due to module path and missing exports ([3ff76091](../../commit/3ff76091))

## [2.3.0] - 2025-12-16

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

## [2.3.0] - 2025-12-12

### Added

- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))

## [2.2.17] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))

### Fixed

- update hook command and add -y to markdown linter ([e3fc1323](../../commit/e3fc1323))
- add -y flag to all npx commands to prevent interactive prompts ([c8385bf3](../../commit/c8385bf3))
- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- format jutsu-markdown han-config.json ([9757774e](../../commit/9757774e))
- fix han command ([fab172e8](../../commit/fab172e8))

## [2.2.16] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))

### Fixed

- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [2.2.15] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))

### Fixed

- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [2.2.14] - 2025-12-07

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

## [2.2.13] - 2025-12-03

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

## [2.2.12] - 2025-12-03

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

## [2.2.11] - 2025-12-03

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

## [2.2.10] - 2025-12-03

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
- remove nested code blocks causing MD031 warnings ([c1e1c823](../../commit/c1e1c823))
- simplify command example to fix markdown lint ([e76a3dfb](../../commit/e76a3dfb))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))

## [2.2.9] - 2025-12-03

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
- remove nested code blocks causing MD031 warnings ([c1e1c823](../../commit/c1e1c823))
- simplify command example to fix markdown lint ([e76a3dfb](../../commit/e76a3dfb))
- resolve markdownlint warnings in skills ([49666093](../../commit/49666093))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))

## [2.2.8] - 2025-12-03

### Added

- add markdown-specific skills ([6d3b67a8](../../commit/6d3b67a8))

### Fixed

- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([10c19571](../../commit/10c19571))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))
- remove nested code blocks causing MD031 warnings ([c1e1c823](../../commit/c1e1c823))
- simplify command example to fix markdown lint ([e76a3dfb](../../commit/e76a3dfb))
- resolve markdownlint warnings in skills ([49666093](../../commit/49666093))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))

## [2.2.7] - 2025-12-03

### Added

- add markdown-specific skills ([6d3b67a8](../../commit/6d3b67a8))

### Fixed

- remove double blank lines from CHANGELOGs ([10c19571](../../commit/10c19571))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))
- remove nested code blocks causing MD031 warnings ([c1e1c823](../../commit/c1e1c823))
- simplify command example to fix markdown lint ([e76a3dfb](../../commit/e76a3dfb))
- resolve markdownlint warnings in skills ([49666093](../../commit/49666093))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))
- rename jutsu-markdownlint to jutsu-markdown ([3c291222](../../commit/3c291222))

## [2.2.6] - 2025-12-03

### Added

- add markdown-specific skills ([6d3b67a8](../../commit/6d3b67a8))

### Fixed

- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))
- remove nested code blocks causing MD031 warnings ([c1e1c823](../../commit/c1e1c823))
- simplify command example to fix markdown lint ([e76a3dfb](../../commit/e76a3dfb))
- resolve markdownlint warnings in skills ([49666093](../../commit/49666093))

### Changed

- update hooks.json to new hook command format ([fa1974dd](../../commit/fa1974dd))
- rename jutsu-markdownlint to jutsu-markdown ([3c291222](../../commit/3c291222))

## [2.2.5] - 2025-12-03

### Added

- add markdown-specific skills ([6d3b67a](../../commit/6d3b67a))

### Fixed

- remove double blank lines from CHANGELOGs ([d3773c3](../../commit/d3773c3))
- remove double blank lines from existing CHANGELOGs ([b829c36](../../commit/b829c36))
- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))
- remove nested code blocks causing MD031 warnings ([c1e1c82](../../commit/c1e1c82))
- simplify command example to fix markdown lint ([e76a3df](../../commit/e76a3df))
- resolve markdownlint warnings in skills ([4966609](../../commit/4966609))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))
- rename jutsu-markdownlint to jutsu-markdown ([3c29122](../../commit/3c29122))

## [2.2.4] - 2025-12-03

### Added

- add markdown-specific skills ([6d3b67a](../../commit/6d3b67a))

### Fixed

- remove double blank lines from existing CHANGELOGs ([b829c36](../../commit/b829c36))
- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))
- remove nested code blocks causing MD031 warnings ([c1e1c82](../../commit/c1e1c82))
- simplify command example to fix markdown lint ([e76a3df](../../commit/e76a3df))
- resolve markdownlint warnings in skills ([4966609](../../commit/4966609))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))
- rename jutsu-markdownlint to jutsu-markdown ([3c29122](../../commit/3c29122))

## [2.2.3] - 2025-12-03

### Added

- add markdown-specific skills ([6d3b67a](../../commit/6d3b67a))

### Fixed

- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))
- remove nested code blocks causing MD031 warnings ([c1e1c82](../../commit/c1e1c82))
- simplify command example to fix markdown lint ([e76a3df](../../commit/e76a3df))
- resolve markdownlint warnings in skills ([4966609](../../commit/4966609))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))
- rename jutsu-markdownlint to jutsu-markdown ([3c29122](../../commit/3c29122))

## [2.2.2] - 2025-12-03

### Added

- add markdown-specific skills ([6d3b67a](../../commit/6d3b67a))

### Fixed

- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))
- remove nested code blocks causing MD031 warnings ([c1e1c82](../../commit/c1e1c82))
- simplify command example to fix markdown lint ([e76a3df](../../commit/e76a3df))
- resolve markdownlint warnings in skills ([4966609](../../commit/4966609))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))
- rename jutsu-markdownlint to jutsu-markdown ([3c29122](../../commit/3c29122))

## [2.2.1] - 2025-12-03

### Added

- add markdown-specific skills ([6d3b67a](../../commit/6d3b67a))

### Fixed

- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))
- remove nested code blocks causing MD031 warnings ([c1e1c82](../../commit/c1e1c82))
- simplify command example to fix markdown lint ([e76a3df](../../commit/e76a3df))
- resolve markdownlint warnings in skills ([4966609](../../commit/4966609))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))
- rename jutsu-markdownlint to jutsu-markdown ([3c29122](../../commit/3c29122))

## [2.2.0] - 2025-12-03

### Added

- add markdown-specific skills ([6d3b67a](../../commit/6d3b67a))

### Fixed

- remove nested code blocks causing MD031 warnings ([c1e1c82](../../commit/c1e1c82))
- simplify command example to fix markdown lint ([e76a3df](../../commit/e76a3df))
- resolve markdownlint warnings in skills ([4966609](../../commit/4966609))

### Changed

- update hooks.json to new hook command format ([fa1974d](../../commit/fa1974d))
- rename jutsu-markdownlint to jutsu-markdown ([3c29122](../../commit/3c29122))
