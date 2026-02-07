# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-02-07

### Added

- add PostToolUse hooks to 19 plugins for incremental validation ([1577c302](../../commit/1577c302))
- auto-generate hooks.json from han-plugin.yml with shorthand events ([f3a39941](../../commit/f3a39941))

### Fixed

- async Stop hooks, merge test/test-async, fix plugin name resolution ([ba6474e8](../../commit/ba6474e8))

## [1.3.0] - 2026-02-07

### Added

- auto-generate hooks.json from han-plugin.yml with shorthand events ([f3a39941](../../commit/f3a39941))

## [1.3.0] - 2026-01-30

### Fixed

- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))

### Other

- Merge pull request #41 from TheBushidoCollective/han-1 ([0b677ba6](../../commit/0b677ba6))

## [1.3.0] - 2026-01-29

### Fixed

- resolve startup race conditions and improve LSP resilience ([4f2c642a](../../commit/4f2c642a))

## [1.3.0] - 2026-01-24

### Fixed

- fix failing tests due to module path and missing exports ([3ff76091](../../commit/3ff76091))

### Other

- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))

## [1.2.0] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
