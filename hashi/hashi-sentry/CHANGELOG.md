# Changelog

All notable changes to the hashi-sentry plugin will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

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
