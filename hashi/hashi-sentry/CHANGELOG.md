# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-30

## [1.1.0] - 2026-01-24

### Changed

- remove orchestrator, use direct MCP exposure with OAuth ([6e69b841](../../commit/6e69b841))

### Other

- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [1.0.2] - 2025-12-24

### Fixed

- restore memory configs in hashi plugins ([1a4c3a43](../../commit/1a4c3a43))
- address test failures from prompt hook removal ([dcf0e0c3](../../commit/dcf0e0c3))

### Other

- Merge pull request #24 from TheBushidoCollective/refactor/remove-prompt-hooks ([4284b64e](../../commit/4284b64e))

## [1.0.2] - 2025-12-23

### Fixed

- address test failures from prompt hook removal ([dcf0e0c3](../../commit/dcf0e0c3))

## [1.0.2] - 2025-12-15

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [1.0.1] - 2025-12-05

### Added

- add hashi-figma, hashi-sentry, hashi-han-metrics plugins and complete SDLC coverage ([d9ad1f65](../../commit/d9ad1f65))

## [1.0.0] - 2025-12-05

### Added

- Initial release of hashi-sentry plugin
- Integration with Sentry MCP Server via OAuth
- Support for 16+ Sentry tools across error tracking, performance monitoring, and incident response
- Five slash commands for common observability workflows:
  - `/investigate-errors`: Investigate recent errors and exceptions
  - `/analyze-performance`: Analyze performance metrics and slow transactions
  - `/check-releases`: Check release health and deployment quality
  - `/query-events`: Run custom queries with advanced filtering
  - `/incident-response`: Coordinate incident response workflow
- Comprehensive README with usage examples and troubleshooting
- OAuth authentication support via hosted Sentry MCP server
- Integration with Sentry's Seer AI for automated root cause analysis
