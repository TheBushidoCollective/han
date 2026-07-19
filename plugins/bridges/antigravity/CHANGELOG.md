# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-19

### Added

- add Han bridge for Google Antigravity IDE via MCP ([fac22376](../../commit/fac22376))

### Fixed

- locate marketplace in installed Claude Code marketplaces ([60efae09](../../commit/60efae09))
- discover plugins from current settings formats ([06838bf5](../../commit/06838bf5))
- address code review findings on bridge PR ([15c70449](../../commit/15c70449))

### Other

- live-test results and current setup for all bridges ([62accccd](../../commit/62accccd))

## [Unreleased]

### Fixed

- locate the marketplace in installed Claude Code marketplaces (`~/.claude/plugins/marketplaces/`) so discovery works in any project, preferring the marketplace named `han`
- discover enabled plugins from the current `enabledPlugins` settings map in addition to the legacy `plugins` object
- resolve marketplace plugin sources relative to the marketplace root
- split `Event:Tool|Tool` matcher suffixes so PostToolUse hooks match

## [0.1.0] - 2026-07-19

### Added

- add Han bridge for Google Antigravity IDE via MCP ([fac22376](../../commit/fac22376))

### Fixed

- discover plugins from current settings formats ([06838bf5](../../commit/06838bf5))
- address code review findings on bridge PR ([15c70449](../../commit/15c70449))

## [0.1.0] - 2026-07-15

### Added

- add Han bridge for Google Antigravity IDE via MCP ([fac22376](../../commit/fac22376))

### Fixed

- address code review findings on bridge PR ([15c70449](../../commit/15c70449))
