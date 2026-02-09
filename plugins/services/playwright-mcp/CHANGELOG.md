# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-02-06

### Changed

- add frontmatter metadata and memory config to agent definitions ([8104acfe](../../commit/8104acfe))

## [1.3.0] - 2026-01-30

## [1.3.0] - 2026-01-24

### Fixed

- fix failing tests due to module path and missing exports ([3ff76091](../../commit/3ff76091))

### Changed

- remove orchestrator, use direct MCP exposure with OAuth ([6e69b841](../../commit/6e69b841))
- remove .mcp.json from hashi plugins (proxied via core MCP) ([29caaad5](../../commit/29caaad5))

### Other

- Revert "refactor: remove .mcp.json from hashi plugins (proxied via core MCP)" ([ac7515ee](../../commit/ac7515ee))

## [1.2.0] - 2025-12-17

### Added

- Enhanced `test-generator` agent with critical output requirements for concise summaries
- Enhanced `ui-debugger` agent with critical output requirements for concise summaries
- Added `han-plugin.yml` configuration with orchestrator guidance
- Added `allowed-tools` to agent definitions for Playwright MCP tool access

### Changed

- Updated agent definitions to be explicit subagents that return summaries, not raw output
- Updated README with clear guidance on using agents instead of direct Playwright calls
- Updated plugin description to highlight agent-based usage pattern

### Important

The main orchestrator should NEVER call Playwright MCP tools directly. Always delegate
to `test-generator` or `ui-debugger` agents to prevent verbose output from filling
the context window.

## [1.1.3] - 2025-12-04
