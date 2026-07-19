# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- `SessionEnd` hook: runs any SessionEnd Han hooks and flushes the event log
  on session exit (advisory; Gemini CLI does not wait)

### Fixed

- discover plugins and hooks from current settings formats: read the
  `enabledPlugins` boolean map (what `han plugin install` writes) in addition
  to the legacy `plugins` object map
- resolve marketplace plugin `source` paths relative to the marketplace root
  (parent of `.claude-plugin/`), matching Claude Code behavior
- split Claude Code tool-matcher event suffixes (`PostToolUse:Edit|Write`)
  into the base event plus tool filter so PostToolUse hooks match

### Changed

- AfterTool validation failures now return `decision:"deny"` with the errors
  as `reason`, which hides the tool result and shows the reason in its place
  (previously failures were surfaced via `systemMessage` alongside the tool
  result)

## [0.1.0] - 2026-03-02

### Added

- update CC feature support to 2.1.63, browse UI refactoring, and Rust GraphQL migration ([8caf0ffe](../../commit/8caf0ffe))
- backend rearchitecture — Rust crates replace han-native (#70) ([877601e0](../../commit/877601e0))

## [0.1.0] - 2026-02-17

### Added

- backend rearchitecture — Rust crates replace han-native (#70) ([877601e0](../../commit/877601e0))

## [0.1.0] - 2026-02-09

### Added

- add Gemini CLI bridge plugin for Han hook ecosystem (#66) ([b24c623e](../../commit/b24c623e))

### Fixed

- resolve biome lint errors in bridge plugins and gitignore dist ([e80d2d3e](../../commit/e80d2d3e))

### Other

- apply biome formatting to bridge plugin sources ([f792a13e](../../commit/f792a13e))

## [0.1.0] - 2026-02-09

### Added

- add Gemini CLI bridge plugin for Han hook ecosystem (#66) ([b24c623e](../../commit/b24c623e))

### Fixed

- resolve biome lint errors in bridge plugins and gitignore dist ([e80d2d3e](../../commit/e80d2d3e))

## [0.1.0] - 2026-02-08

### Added

- Initial Gemini CLI bridge plugin for Han hook ecosystem
