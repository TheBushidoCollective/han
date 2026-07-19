# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-19

### Added

- add SessionEnd, deny-based AfterTool feedback ([97d942c4](../../commit/97d942c4))

### Fixed

- live-test fixes for opencode and gemini-cli ([2fafd014](../../commit/2fafd014))
- locate marketplace in installed Claude Code marketplaces ([60efae09](../../commit/60efae09))

### Other

- live-test results and current setup for all bridges ([62accccd](../../commit/62accccd))

## [Unreleased]

### Fixed

- wrap `gemini-hooks.json` in a top-level `hooks` object; Gemini CLI 0.51 rejected the bare event map ("'hooks' property must be an object") and the extension loaded with zero hooks
- locate the marketplace in installed Claude Code marketplaces (`~/.claude/plugins/marketplaces/`) so discovery works in any project

## [0.1.0] - 2026-07-19

### Added

- add SessionEnd, deny-based AfterTool feedback ([97d942c4](../../commit/97d942c4))

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
