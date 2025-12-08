# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.1] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- add session metrics tracking to SessionStart hook ([abe7af4a](../../commit/abe7af4a))
- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))
- add epistemic rigor enforcement and spinning wheels detection ([9ebce22b](../../commit/9ebce22b))

### Fixed

- remove duplicate file display for command hooks with inline references ([272e9ca0](../../commit/272e9ca0))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))

han-core is the essential infrastructure for the Han plugin marketplace, created by consolidating:

- Infrastructure from `bushido` (delegation, skill transparency, quality enforcement)
- MCP servers from `hashi-han` (hook commands)
- MCP servers from `hashi-han-metrics` (task tracking)
- Context7 integration from `bushido`

### Features

**Infrastructure Hooks:**

- `ensure-subagent.md` - Delegation protocol for do-*/hashi-*/jutsu-* agents
- `ensure-skill-use.md` - Skill selection transparency
- `pre-push-check.sh` - Git push quality validation
- `no-time-estimates.md` - Time estimate enforcement
- `metrics-tracking.md` - Task tracking instructions

**MCP Servers:**

- `han` - Unified server providing hook command execution and task tracking/metrics (consolidated from hashi-han and hashi-han-metrics)
- `context7` - Up-to-date library documentation

**Skills (16 total):**

Universal programming principles including SOLID, simplicity principles, boy-scout-rule, professional-honesty, proof-of-work, and more.

**Commands (12 total):**

Workflow orchestration including /develop, /review, /plan, /architect, and more.

### Migration

**From bushido 1.x:**

```bash
han plugin install han-core
```

**From hashi-han:**

```bash
han plugin uninstall hashi-han
han plugin install han-core
```

**From hashi-han-metrics:**

```bash
han plugin uninstall hashi-han-metrics
han plugin install han-core
```

### Philosophy Separation

The Bushido philosophy (7 virtues) remains in the separate `bushido` plugin. Install both for the full experience:

```bash
han plugin install han-core bushido
```
