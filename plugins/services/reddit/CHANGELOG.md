# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-08-09

### Added

- Authenticated Reddit access via `@thebushidocollective/mcp-server-reddit`:
  saved posts and comments, profile, vote history, subscriptions, and inbox
- `search_saved` for keyword search across the saved archive, which Reddit
  offers no server side equivalent for
- `search_reddit` and `get_user_profile` public tools

### Changed

- Replaced the `uvx mcp-server-reddit` server with a Node based server, so the
  plugin no longer requires `uv` or Python
- All eight previous tool names and parameters are preserved, so existing
  prompts and memory providers keep working
- Memory provider now prefers the user's saved archive over the public firehose

## [1.1.0] - 2026-01-30

## [1.1.0] - 2026-01-24

### Changed

- remove orchestrator, use direct MCP exposure with OAuth ([6e69b841](../../commit/6e69b841))
