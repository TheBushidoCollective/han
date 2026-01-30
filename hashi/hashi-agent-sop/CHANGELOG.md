# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.5.0] - 2026-01-30

## [1.5.0] - 2026-01-24

### Changed

- remove orchestrator, use direct MCP exposure with OAuth ([6e69b841](../../commit/6e69b841))
- remove .mcp.json from hashi plugins (proxied via core MCP) ([29caaad5](../../commit/29caaad5))

### Other

- Revert "refactor: remove .mcp.json from hashi plugins (proxied via core MCP)" ([ac7515ee](../../commit/ac7515ee))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [1.4.3] - 2025-12-24

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Fixed

- restore memory configs in hashi plugins ([1a4c3a43](../../commit/1a4c3a43))
- address test failures from prompt hook removal ([dcf0e0c3](../../commit/dcf0e0c3))

### Other

- Merge pull request #24 from TheBushidoCollective/refactor/remove-prompt-hooks ([4284b64e](../../commit/4284b64e))

## [1.4.3] - 2025-12-23

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Fixed

- address test failures from prompt hook removal ([dcf0e0c3](../../commit/dcf0e0c3))

## [1.4.3] - 2025-12-16

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [1.4.3] - 2025-12-15

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [1.4.2] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))

### Fixed

- add -y flag to remaining npx typescript commands ([03543a73](../../commit/03543a73))

## [1.4.1] - 2025-12-07

### Changed

- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))

## [1.4.0] - 2025-12-05

### Added

- add 5 built-in SOPs for common workflows ([b95748f8](../../commit/b95748f8))
- add AGENT_SOP_PATHS environment variable to MCP config ([2df2e522](../../commit/2df2e522))
- combine jutsu-sop into hashi-agent-sop ([f96695fd](../../commit/f96695fd))
- add hashi-agent-sop plugin for Agent SOP MCP server ([f823e783](../../commit/f823e783))

### Fixed

- correctly implement AGENT_SOP_PATHS using --sop-paths arg ([1bb4bd0e](../../commit/1bb4bd0e))

### Other

- clarify AGENT_SOP_PATHS is automatic ([5ec655c7](../../commit/5ec655c7))
- add AGENT_SOP_PATHS environment variable configuration ([74764778](../../commit/74764778))

## [1.3.3] - 2025-12-05

### Added

- add AGENT_SOP_PATHS environment variable to MCP config ([2df2e522](../../commit/2df2e522))
- combine jutsu-sop into hashi-agent-sop ([f96695fd](../../commit/f96695fd))
- add hashi-agent-sop plugin for Agent SOP MCP server ([f823e783](../../commit/f823e783))

### Fixed

- correctly implement AGENT_SOP_PATHS using --sop-paths arg ([1bb4bd0e](../../commit/1bb4bd0e))

### Other

- clarify AGENT_SOP_PATHS is automatic ([5ec655c7](../../commit/5ec655c7))
- add AGENT_SOP_PATHS environment variable configuration ([74764778](../../commit/74764778))

## [1.3.2] - 2025-12-05

### Added

- add AGENT_SOP_PATHS environment variable to MCP config ([2df2e522](../../commit/2df2e522))
- combine jutsu-sop into hashi-agent-sop ([f96695fd](../../commit/f96695fd))
- add hashi-agent-sop plugin for Agent SOP MCP server ([f823e783](../../commit/f823e783))

### Other

- clarify AGENT_SOP_PATHS is automatic ([5ec655c7](../../commit/5ec655c7))
- add AGENT_SOP_PATHS environment variable configuration ([74764778](../../commit/74764778))

## [1.3.1] - 2025-12-05

### Added

- combine jutsu-sop into hashi-agent-sop ([f96695fd](../../commit/f96695fd))
- add hashi-agent-sop plugin for Agent SOP MCP server ([f823e783](../../commit/f823e783))

### Other

- add AGENT_SOP_PATHS environment variable configuration ([74764778](../../commit/74764778))

## [1.3.0] - 2025-12-05

### Added

- combine jutsu-sop into hashi-agent-sop ([f96695fd](../../commit/f96695fd))
- add hashi-agent-sop plugin for Agent SOP MCP server ([f823e783](../../commit/f823e783))

## [1.1.0] - 2025-12-05

### Added

- add hashi-agent-sop plugin for Agent SOP MCP server ([f823e783](../../commit/f823e783))
