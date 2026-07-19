# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-19

### Added

- rewrite bridge for Codex CLI lifecycle hooks ([0db61833](../../commit/0db61833))

## [Unreleased]

### Changed

- rewrite the bridge for Codex's real hook system (Claude-Code-style lifecycle hooks behind `[features] hooks = true`), replacing the previous implementation that was modeled on a nonexistent OpenCode-style JS plugin API. The bridge is now a stdio JSON CLI (`npx -y codex-plugin-han <event>`) covering all 10 Codex events: session-start, user-prompt-submit, pre-tool-use, permission-request, post-tool-use, pre-compact, post-compact, subagent-start, subagent-stop, stop
- PreToolUse failures now deny via `hookSpecificOutput.permissionDecision`, PostToolUse failures feed back via `decision: "block"`, and Stop/SubagentStop failures continue the turn via `decision: "block"`
- map Codex tool names for Han matching: `apply_patch` -> Edit, `Bash` -> Bash, `spawn_agent` -> Agent, `mcp__*` passthrough; file paths extracted from apply_patch headers

### Fixed

- discovery: read `enabledPlugins` boolean map in addition to the legacy `plugins` map in settings files
- discovery: resolve marketplace plugin `source` paths relative to the marketplace root (parent of `.claude-plugin/`)
- discovery: split Claude Code tool-matcher suffixes in event strings (`PostToolUse:Edit|Write`) into base event + tool filter
- README/plugin metadata: correct install command (`han plugin install codex@han`) and document the real integration (`~/.codex/config.toml` + `~/.codex/hooks.json`)

## [0.1.0] - 2026-03-02

### Added

- update CC feature support to 2.1.63, browse UI refactoring, and Rust GraphQL migration ([8caf0ffe](../../commit/8caf0ffe))
- backend rearchitecture — Rust crates replace han-native (#70) ([877601e0](../../commit/877601e0))

## [0.1.0] - 2026-02-17

### Added

- backend rearchitecture — Rust crates replace han-native (#70) ([877601e0](../../commit/877601e0))

## [0.1.0] - 2026-02-09

### Added

- add Codex CLI bridge plugin for Han hook ecosystem (#65) ([f29edef3](../../commit/f29edef3))

### Fixed

- resolve biome lint errors in bridge plugins and gitignore dist ([e80d2d3e](../../commit/e80d2d3e))

### Other

- apply biome formatting to bridge plugin sources ([f792a13e](../../commit/f792a13e))

## [0.1.0] - 2026-02-09

### Added

- add Codex CLI bridge plugin for Han hook ecosystem (#65) ([f29edef3](../../commit/f29edef3))

### Fixed

- resolve biome lint errors in bridge plugins and gitignore dist ([e80d2d3e](../../commit/e80d2d3e))

## [0.1.0] - 2026-02-09

### Added

- add Codex CLI bridge plugin for Han hook ecosystem (#65) ([f29edef3](../../commit/f29edef3))

## [0.1.0] - 2026-02-08

### Added

- Initial Codex CLI bridge plugin for Han hook ecosystem
