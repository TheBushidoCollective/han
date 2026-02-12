# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-02-09

### Added

- add Kiro CLI bridge plugin for Han hook ecosystem (#64) ([793d6da9](../../commit/793d6da9))

### Fixed

- resolve biome lint errors in bridge plugins and gitignore dist ([e80d2d3e](../../commit/e80d2d3e))

### Other

- apply biome formatting to bridge plugin sources ([f792a13e](../../commit/f792a13e))

## [0.1.0] - 2026-02-09

### Added

- add Kiro CLI bridge plugin for Han hook ecosystem (#64) ([793d6da9](../../commit/793d6da9))

### Fixed

- resolve biome lint errors in bridge plugins and gitignore dist ([e80d2d3e](../../commit/e80d2d3e))

## [0.1.0] - 2026-02-09

### Added

- add Kiro CLI bridge plugin for Han hook ecosystem (#64) ([793d6da9](../../commit/793d6da9))

- Initial release of the Kiro CLI bridge plugin
- CLI entry point (`kiro-plugin-han`) callable by Kiro agent hooks
- Hook event mapping: agentSpawn, userPromptSubmit, preToolUse, postToolUse, stop
- Kiro tool name mapping (fs_write -> Write, execute_bash -> Bash, etc.)
- PreToolUse blocking via exit code 2 (Kiro convention)
- PostToolUse per-file validation with parallel hook execution
- Stop hooks for full project validation
- SessionStart context injection (core guidelines)
- UserPromptSubmit datetime injection
- Content-hash caching for hook execution
- JSONL event logging with provider="kiro" for Browse UI visibility
- Example Kiro agent config (kiro-agent.json)
- Plugin/hook discovery from installed Han plugins
