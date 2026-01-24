# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.3.0] - 2026-01-24

### Added

- use GitHub Copilot HTTP endpoint instead of Docker ([d507f491](../../commit/d507f491))

### Changed

- simplify memory provider auth via plugin inheritance ([ebed64a4](../../commit/ebed64a4))
- remove orchestrator, use direct MCP exposure with OAuth ([6e69b841](../../commit/6e69b841))
- remove .mcp.json from hashi plugins (proxied via core MCP) ([29caaad5](../../commit/29caaad5))

### Other

- optimize SessionStart hook from 37s to ~3s ([9ad15784](../../commit/9ad15784))
- Revert "refactor: remove .mcp.json from hashi plugins (proxied via core MCP)" ([ac7515ee](../../commit/ac7515ee))

## [1.1.6] - 2025-12-15

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [1.1.5] - 2025-12-04

### Other

- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))
