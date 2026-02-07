# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-02-07

### Added

- auto-regenerate hooks.json when han-plugin.yml is edited ([f3e0d4af](../../commit/f3e0d4af))
- auto-generate hooks.json from han-plugin.yml with shorthand events ([f3a39941](../../commit/f3a39941))

### Fixed

- async Stop hooks, merge test/test-async, fix plugin name resolution ([ba6474e8](../../commit/ba6474e8))

### Changed

- remove file_filter, split test hooks into Stop + PostToolUse ([bd1b5e34](../../commit/bd1b5e34))
- add frontmatter metadata and memory config to agent definitions ([8104acfe](../../commit/8104acfe))

## [1.3.0] - 2026-02-07

### Added

- auto-generate hooks.json from han-plugin.yml with shorthand events ([f3a39941](../../commit/f3a39941))

### Changed

- add frontmatter metadata and memory config to agent definitions ([8104acfe](../../commit/8104acfe))

## [1.3.0] - 2026-02-06

### Changed

- add frontmatter metadata and memory config to agent definitions ([8104acfe](../../commit/8104acfe))

## [1.3.0] - 2026-01-30

## [1.3.0] - 2026-01-24

## [1.2.2] - 2025-12-17

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Other

- add comprehensive tests for critical untested systems ([23b61742](../../commit/23b61742))
- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [1.2.1] - 2025-12-16

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [1.2.1] - 2025-12-15

### BREAKING CHANGES

- make caching and fail-fast default behavior for hooks ([fa35e80f](../../commit/fa35e80f))

### Added

- add SubagentStart and SubagentStop hooks to all plugins ([a8925a99](../../commit/a8925a99))

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [1.2.0] - 2025-12-12

### Added

- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))

## [1.1.10] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- enhance prompt hook display with accordion format ([5a1e09d6](../../commit/5a1e09d6))

### Fixed

- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.1.9] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- enhance prompt hook display with accordion format ([5a1e09d6](../../commit/5a1e09d6))

### Fixed

- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.1.8] - 2025-12-07

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

## [1.1.7] - 2025-12-04

### Added

- use han hook run for output capture ([d1724bae](../../commit/d1724bae))

### Other

- format plugin.json files ([cd71dc86](../../commit/cd71dc86))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))

## [1.1.6] - 2025-12-04

### Other

- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))
