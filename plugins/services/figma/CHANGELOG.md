# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.1.0] - 2026-01-30

## [1.1.0] - 2026-01-24

### Changed

- remove orchestrator, use direct MCP exposure with OAuth ([6e69b841](../../commit/6e69b841))

### Other

- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [1.0.4] - 2025-12-24

### Fixed

- restore memory configs in hashi plugins ([1a4c3a43](../../commit/1a4c3a43))
- address test failures from prompt hook removal ([dcf0e0c3](../../commit/dcf0e0c3))

### Other

- Merge pull request #24 from TheBushidoCollective/refactor/remove-prompt-hooks ([4284b64e](../../commit/4284b64e))

## [1.0.4] - 2025-12-23

### Fixed

- address test failures from prompt hook removal ([dcf0e0c3](../../commit/dcf0e0c3))

## [1.0.4] - 2025-12-15

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [1.0.3] - 2025-12-05

### Added

- add hashi-figma, hashi-sentry, hashi-han-metrics plugins and complete SDLC coverage ([d9ad1f65](../../commit/d9ad1f65))

### Fixed

- restore Name sections in command documentation ([25085463](../../commit/25085463))
- add required sections to command documentation ([a1771965](../../commit/a1771965))

## [1.0.2] - 2025-12-05

### Added

- add hashi-figma, hashi-sentry, hashi-han-metrics plugins and complete SDLC coverage ([d9ad1f65](../../commit/d9ad1f65))

### Fixed

- add required sections to command documentation ([a1771965](../../commit/a1771965))

## [1.0.1] - 2025-12-05

### Added

- add hashi-figma, hashi-sentry, hashi-han-metrics plugins and complete SDLC coverage ([d9ad1f65](../../commit/d9ad1f65))

- Initial release
- Figma desktop MCP server integration via HTTP transport
- Zero-configuration setup using Figma desktop app authentication
- Support for frame-to-code generation workflows
- Design token and variable extraction
- Component library access
- FigJam diagram integration
- Code Connect support for design system consistency
- Comprehensive README with setup and usage examples
- Four slash commands for common Figma workflows:
  - `/figma:generate-component` - Generate code from Figma component
  - `/figma:extract-tokens` - Extract design tokens from current file
  - `/figma:sync-design-system` - Sync design system components
  - `/figma:analyze-frame` - Analyze frame structure and properties
