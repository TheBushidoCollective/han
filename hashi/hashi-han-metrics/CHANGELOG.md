# Changelog

All notable changes to the hashi-han-metrics plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
