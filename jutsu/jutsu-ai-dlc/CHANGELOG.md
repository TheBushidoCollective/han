# Changelog

All notable changes to jutsu-ai-dlc will be documented in this file.

## [1.0.0] - 2026-01-28

### Added

- Initial release of AI-DLC 2026 methodology plugin
- User commands: `/elaborate`, `/construct`, `/reset`
- Internal commands: `/advance`, `/fail`, `/done`
- Hat-based workflow: elaborator → planner → builder → reviewer
- SessionStart hook for context injection
- Stop hook for iteration enforcement
- State persistence via `han keep` (branch scope)
- Skills:
  - `ai-dlc-fundamentals` - Core principles
  - `ai-dlc-completion-criteria` - Writing effective criteria
  - `ai-dlc-mode-selection` - HITL/OHOTL/AHOTL decision framework
  - `ai-dlc-backpressure` - Quality gates and enforcement
  - `ai-dlc-blockers` - Proper blocker documentation
- Support for custom workflows via `.ai-dlc/hats.yml`
