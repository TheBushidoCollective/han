# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.2] - 2025-12-07

### Added

- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))

### Fixed

- correct plugin name from han-core to core ([b8684777](../../commit/b8684777))
- replace better-sqlite3 with bun:sqlite for binary compatibility ([9d1b2125](../../commit/9d1b2125))

### Changed

- rename han-core to core and update website ([190f876b](../../commit/190f876b))

### Other

- update MCP server documentation for core plugin ([0c084c8c](../../commit/0c084c8c))
- apply biome formatting to plugin.json and import ordering ([963a99f6](../../commit/963a99f6))

## [1.2.1] - 2025-12-07

### Added

- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))

### Fixed

- replace better-sqlite3 with bun:sqlite for binary compatibility ([9d1b2125](../../commit/9d1b2125))

### Changed

- rename han-core to core and update website ([190f876b](../../commit/190f876b))

### Other

- apply biome formatting to plugin.json and import ordering ([963a99f6](../../commit/963a99f6))
- format plugin.json arrays ([3ee85700](../../commit/3ee85700))

## [1.1.1] - 2025-12-06

### Added

- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))
- add hashi-figma, hashi-sentry, hashi-han-metrics plugins and complete SDLC coverage ([d9ad1f65](../../commit/d9ad1f65))

### Fixed

- replace better-sqlite3 with bun:sqlite for binary compatibility ([9d1b2125](../../commit/9d1b2125))
- add required sections to command documentation ([a1771965](../../commit/a1771965))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- format plugin.json arrays ([3ee85700](../../commit/3ee85700))
- update README for CLI integration ([34407550](../../commit/34407550))

## [1.1.0] - 2025-12-06

### Added

- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))
- add hashi-figma, hashi-sentry, hashi-han-metrics plugins and complete SDLC coverage ([d9ad1f65](../../commit/d9ad1f65))

### Fixed

- add required sections to command documentation ([a1771965](../../commit/a1771965))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- format plugin.json arrays ([3ee85700](../../commit/3ee85700))
- update README for CLI integration ([34407550](../../commit/34407550))

## [1.0.3] - 2025-12-06

### Added

- add hashi-figma, hashi-sentry, hashi-han-metrics plugins and complete SDLC coverage ([d9ad1f65](../../commit/d9ad1f65))

### Fixed

- add required sections to command documentation ([a1771965](../../commit/a1771965))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- update README for CLI integration ([34407550](../../commit/34407550))

## [1.0.2] - 2025-12-06

### Added

- add hashi-figma, hashi-sentry, hashi-han-metrics plugins and complete SDLC coverage ([d9ad1f65](../../commit/d9ad1f65))

### Fixed

- add required sections to command documentation ([a1771965](../../commit/a1771965))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

## [1.0.1] - 2025-12-05

### Added

- add hashi-figma, hashi-sentry, hashi-han-metrics plugins and complete SDLC coverage ([d9ad1f65](../../commit/d9ad1f65))

## [1.0.0] - 2025-12-05

### Added

- Initial release of hashi-han-metrics plugin
- MCP server for agent task tracking and metrics collection
- Five core tools for task lifecycle management:
  - `start_task`: Begin tracking a new task
  - `update_task`: Log progress updates
  - `complete_task`: Mark task complete with outcome assessment
  - `fail_task`: Record task failure with details
  - `query_metrics`: Query performance metrics and analytics
- SQLite storage at `~/.claude/metrics/metrics.db`
- Task tracking with metadata:
  - Task type (implementation/fix/refactor/research)
  - Complexity estimation (simple/moderate/complex)
  - Duration tracking
  - Confidence levels for calibration
  - Files modified and tests added
  - Failure reasons and attempted solutions
- Metrics calculation:
  - Success rates by type and period
  - Average confidence and duration
  - Calibration scoring (confidence vs actual outcome)
  - Task breakdown by type and outcome
- Complete TypeScript implementation with types
- STDIO transport for MCP communication
- Privacy-preserving local-only storage
- Comprehensive documentation and examples
- Database schema with indexes for efficient queries
