# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.1.0] - 2026-07-19

### Added

- TUI plugin, validation status channel, npm publishing (#101) ([bf952b53](../../commit/bf952b53))

### Fixed

- live-test fixes for opencode and gemini-cli ([2fafd014](../../commit/2fafd014))
- locate marketplace in installed Claude Code marketplaces ([60efae09](../../commit/60efae09))
- drop dead stop hook, add PreCompact support ([15e6cc8a](../../commit/15e6cc8a))
- discover plugins and hooks from current settings formats (#99) ([76454f2e](../../commit/76454f2e))

### Other

- Merge pull request #103 from TheBushidoCollective/fix/bridge-marketplace-discovery ([4ae9e327](../../commit/4ae9e327))
- live-test results and current setup for all bridges ([62accccd](../../commit/62accccd))

## [Unreleased]

### Fixed

- locate the marketplace in installed Claude Code marketplaces (`~/.claude/plugins/marketplaces/`) so discovery works in any project, preferring the marketplace named `han`
- `chat.message` no longer crashes sessions: the datetime context is merged into the user's existing text part instead of pushing a bare part that current opencode rejects (`InvalidDurableEvent`)
- PostToolUse hooks match again: file paths are read from `input.args.filePath` (previously only output metadata/title, which never matched for write/edit)

## [0.1.0] - 2026-07-19

### Added

- TUI plugin, validation status channel, npm publishing (#101) ([bf952b53](../../commit/bf952b53))

### Fixed

- drop dead stop hook, add PreCompact support ([15e6cc8a](../../commit/15e6cc8a))
- discover plugins and hooks from current settings formats (#99) ([76454f2e](../../commit/76454f2e))

## [0.1.0] - 2026-07-19

### Fixed

- drop dead stop hook, add PreCompact support ([15e6cc8a](../../commit/15e6cc8a))
- discover plugins and hooks from current settings formats (#99) ([76454f2e](../../commit/76454f2e))

## [0.1.0] - 2026-07-19

### Fixed

- discover plugins and hooks from current settings formats (#99) ([76454f2e](../../commit/76454f2e))

## [0.1.0] - 2026-02-08

### Other

- Add OpenCode bridge plugin for Han hook ecosystem (#61) ([322d0324](../../commit/322d0324))
