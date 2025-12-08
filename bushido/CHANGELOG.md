# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.1.0] - 2025-12-07

### Added

- add epistemic rigor enforcement and spinning wheels detection ([9ebce22b](../../commit/9ebce22b))

### Changed

- rename han-core to core and update website ([190f876b](../../commit/190f876b))

### Other

- update MCP server documentation for core plugin ([0c084c8c](../../commit/0c084c8c))

## [2.0.1] - 2025-12-07

### Changed

- rename han-core to core and update website ([190f876b](../../commit/190f876b))

## [2.0.0] - 2025-12-07

### BREAKING CHANGES

- Refactored bushido to philosophy-only plugin
- All infrastructure, skills, commands, and MCP servers moved to new `han-core` plugin
- Plugin now contains ONLY the 7 Bushido virtues (agent-bushido.md hook)
- Added dependency on `han-core ^1.0.0`

### Removed

- All skills (moved to han-core): baseline-restorer, boy-scout-rule, code-reviewer, debugging, documentation, explainer, orthogonality-principle, performance-optimization, professional-honesty, proof-of-work, refactoring, simplicity-principles, solid-principles, structural-design-principles, technical-planning, architecture-design
- All commands (moved to han-core): architect, code-review, debug, develop, document, explain, fix, optimize, plan, refactor, review, test
- All hooks except agent-bushido.md (moved to han-core): ensure-subagent.md, ensure-skill-use.md, pre-push-check.sh, no-time-estimates.md
- MCP server configurations (moved to han-core)

### Migration Guide

To update from bushido 1.x:

```bash
# Install han-core (gets all the infrastructure back)
han plugin install han-core

# Update bushido (now philosophy-only)
han plugin install bushido

# Or install both together
han plugin install han-core bushido
```

## [1.2.1] - 2025-12-05

### Added

- add pre-push hook verification feature ([65bcac74](../../commit/65bcac74))

### Fixed

- markdownlint errors in ensure-subagent.md ([9ec0fc70](../../commit/9ec0fc70))

## [1.2.0] - 2025-12-05

### Added

- add pre-push hook verification feature ([65bcac74](../../commit/65bcac74))

## [1.1.18] - 2025-12-04

### Other

- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))

## [1.1.17] - 2025-12-03

### Fixed

- always delegate for exhaustive commands, never use Bash directly ([5da6124a](../../commit/5da6124a))
- add delegation requirement for user-requested actions ([11e1d063](../../commit/11e1d063))
- add delegation requirement for user-requested actions ([9d122ee8](../../commit/9d122ee8))
- improve hook output with cat and important tags ([f449cc55](../../commit/f449cc55))

### Changed

- simplify must-read-first tags to just file paths ([83f79b3d](../../commit/83f79b3d))
- use must-read-first tags with reasons in hooks ([f6616232](../../commit/f6616232))

### Other

- prefer specialized agents over built-in fallbacks ([b4afe6df](../../commit/b4afe6df))
- expand custom agent discovery with general example ([d8008b51](../../commit/d8008b51))
- add examples of custom/specialized subagents ([5c614130](../../commit/5c614130))
- add examples for Explore and Plan subagent types ([9fb9002e](../../commit/9fb9002e))

## [1.1.16] - 2025-12-03

### Fixed

- always delegate for exhaustive commands, never use Bash directly ([5da6124a](../../commit/5da6124a))
- add delegation requirement for user-requested actions ([11e1d063](../../commit/11e1d063))
- add delegation requirement for user-requested actions ([9d122ee8](../../commit/9d122ee8))
- improve hook output with cat and important tags ([f449cc55](../../commit/f449cc55))

### Changed

- use must-read-first tags with reasons in hooks ([f6616232](../../commit/f6616232))

### Other

- prefer specialized agents over built-in fallbacks ([b4afe6df](../../commit/b4afe6df))
- expand custom agent discovery with general example ([d8008b51](../../commit/d8008b51))
- add examples of custom/specialized subagents ([5c614130](../../commit/5c614130))
- add examples for Explore and Plan subagent types ([9fb9002e](../../commit/9fb9002e))

## [1.1.15] - 2025-12-03

### Fixed

- always delegate for exhaustive commands, never use Bash directly ([5da6124a](../../commit/5da6124a))
- add delegation requirement for user-requested actions ([11e1d063](../../commit/11e1d063))
- add delegation requirement for user-requested actions ([9d122ee8](../../commit/9d122ee8))
- improve hook output with cat and important tags ([f449cc55](../../commit/f449cc55))

### Other

- prefer specialized agents over built-in fallbacks ([b4afe6df](../../commit/b4afe6df))
- expand custom agent discovery with general example ([d8008b51](../../commit/d8008b51))
- add examples of custom/specialized subagents ([5c614130](../../commit/5c614130))
- add examples for Explore and Plan subagent types ([9fb9002e](../../commit/9fb9002e))

## [1.1.14] - 2025-12-03

### Fixed

- always delegate for exhaustive commands, never use Bash directly ([5da6124a](../../commit/5da6124a))
- add delegation requirement for user-requested actions ([11e1d063](../../commit/11e1d063))
- add delegation requirement for user-requested actions ([9d122ee8](../../commit/9d122ee8))
- improve hook output with cat and important tags ([f449cc55](../../commit/f449cc55))

### Other

- expand custom agent discovery with general example ([d8008b51](../../commit/d8008b51))
- add examples of custom/specialized subagents ([5c614130](../../commit/5c614130))
- add examples for Explore and Plan subagent types ([9fb9002e](../../commit/9fb9002e))

## [1.1.13] - 2025-12-03

### Fixed

- always delegate for exhaustive commands, never use Bash directly ([5da6124a](../../commit/5da6124a))
- add delegation requirement for user-requested actions ([11e1d063](../../commit/11e1d063))
- add delegation requirement for user-requested actions ([9d122ee8](../../commit/9d122ee8))
- improve hook output with cat and important tags ([f449cc55](../../commit/f449cc55))

### Other

- expand custom agent discovery with general example ([d8008b51](../../commit/d8008b51))
- add examples of custom/specialized subagents ([5c614130](../../commit/5c614130))
- add examples for Explore and Plan subagent types ([9fb9002e](../../commit/9fb9002e))

## [1.1.12] - 2025-12-03

### Fixed

- always delegate for exhaustive commands, never use Bash directly ([5da6124a](../../commit/5da6124a))
- add delegation requirement for user-requested actions ([11e1d063](../../commit/11e1d063))
- add delegation requirement for user-requested actions ([9d122ee8](../../commit/9d122ee8))
- improve hook output with cat and important tags ([f449cc55](../../commit/f449cc55))

### Other

- add examples of custom/specialized subagents ([5c614130](../../commit/5c614130))
- add examples for Explore and Plan subagent types ([9fb9002e](../../commit/9fb9002e))

## [1.1.11] - 2025-12-03

### Fixed

- always delegate for exhaustive commands, never use Bash directly ([5da6124a](../../commit/5da6124a))
- add delegation requirement for user-requested actions ([11e1d063](../../commit/11e1d063))
- add delegation requirement for user-requested actions ([9d122ee8](../../commit/9d122ee8))
- improve hook output with cat and important tags ([f449cc55](../../commit/f449cc55))

## [1.1.10] - 2025-12-03

### Fixed

- add delegation requirement for user-requested actions ([11e1d063](../../commit/11e1d063))
- add delegation requirement for user-requested actions ([9d122ee8](../../commit/9d122ee8))
- improve hook output with cat and important tags ([f449cc55](../../commit/f449cc55))

## [1.1.9] - 2025-12-03

### Fixed

- add delegation requirement for user-requested actions ([9d122ee8](../../commit/9d122ee8))
- improve hook output with cat and important tags ([f449cc55](../../commit/f449cc55))

## [1.1.8] - 2025-12-03

### Fixed

- improve hook output with cat and important tags ([f449cc55](../../commit/f449cc55))
