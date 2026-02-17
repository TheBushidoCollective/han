# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.2.0] - 2026-02-17

### Added

- backend rearchitecture — Rust crates replace han-native (#70) ([877601e0](../../commit/877601e0))

### Fixed

- move API Dockerfile into service directory for Railway build context ([75a8a4b9](../../commit/75a8a4b9))

## [2.2.0] - 2026-02-14

### Fixed

- move API Dockerfile into service directory for Railway build context ([75a8a4b9](../../commit/75a8a4b9))

## [2.2.0] - 2026-02-09

## [2.2.0] - 2026-02-06

### Fixed

- route Stop hooks through han hook run for caching and session-scoped files ([343716c2](../../commit/343716c2))
- use GITHUB_TOKEN for workflow dispatch, update plugin paths, fix hook output ([74f91f2d](../../commit/74f91f2d))

### Changed

- modernize hook system - direct plugin hooks (no orchestration) (#57) ([b0ee1566](../../commit/b0ee1566))

## [2.2.0] - 2026-01-30

### Changed

- group --check output by phase, rename hooks to convention ([67e678aa](../../commit/67e678aa))

## [2.2.0] - 2026-01-24

### Added

- use HAN_FILES from coordinator for session-scoped checks ([3969c632](../../commit/3969c632))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))

### Fixed

- correct hook variable and remove unused variable ([79166255](../../commit/79166255))

### Other

- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [2.1.2] - 2025-12-23

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Changed

- remove all prompt hooks ([01227fef](../../commit/01227fef))

### Other

- add comprehensive tests for critical untested systems ([23b61742](../../commit/23b61742))

## [2.1.1] - 2025-12-17

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Other

- add comprehensive tests for critical untested systems ([23b61742](../../commit/23b61742))

## [2.1.0] - 2025-12-16

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

## [2.1.0] - 2025-12-12

### Added

- unified YAML config, MCP memory tools, checkpoint system ([f74f40ed](../../commit/f74f40ed))

## [2.0.1] - 2025-12-08

### Changed

- redesign git-storytelling from enforcement to intelligent guidance ([78cfa3dc](../../commit/78cfa3dc))

## [1.4.1] - 2025-12-08

### Added

- add description field support to han-config.json ([f7c0c3f8](../../commit/f7c0c3f8))
- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))

### Fixed

- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.4.0] - 2025-12-08

### Added

- add description field support to han-config.json ([f7c0c3f8](../../commit/f7c0c3f8))
- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))

### Fixed

- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.3.16] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))

### Fixed

- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.3.15] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))

### Fixed

- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.3.14] - 2025-12-07

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

## [1.3.13] - 2025-12-06

### Added

- add comprehensive local rebasing guidance ([1049e0d6](../../commit/1049e0d6))

### Fixed

- add blank lines around fenced code blocks ([ab0b61bd](../../commit/ab0b61bd))

## [1.3.12] - 2025-12-06

### Added

- add comprehensive local rebasing guidance ([1049e0d6](../../commit/1049e0d6))

## [Unreleased]

### Added

- Comprehensive guidance on local rebasing and commit cleanup
- New "Cleaning Up Local Commits" section in commit-strategy skill
- Clear distinction between safe (local) and dangerous (pushed) rebasing
- Interactive rebase patterns and examples for cleaning up WIP commits
- Best practices for "commit often, clean up before pushing" workflow
- Safety guidelines and recovery instructions for rebasing

### Changed

- Updated README with rebasing guidance and examples
- Clarified "Time Machine" anti-pattern to allow local cleanup
- Added rebasing tips to "Tips for Success" section

## [1.3.11] - 2025-12-04

### Changed

- run hook through han for fail-fast ([2be3efe6](../../commit/2be3efe6))

## [1.3.10] - 2025-12-04

### Other

- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))

## [1.3.9] - 2025-12-03

### Other

- clarify commit behavior for unrelated changes ([bdfb4b18](../../commit/bdfb4b18))
