# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [2.0.0] - 2026-08-19

### BREAKING CHANGES

- point plugin at hosted authenticated MCP server (#108) ([745686cf](../../commit/745686cf))

## [2.0.0] - 2026-08-12

### Changed

- **BREAKING**: transport moved from a local `uvx mcp-server-reddit` stdio process to the hosted server at `https://reddit-mcp-n5sjtdvmca-uc.a.run.app/mcp`
- **BREAKING**: authentication is now an OAuth handshake in the browser on first use, replacing anonymous reads of Reddit's public API

### Added

- account tools the unauthenticated server could never reach: `get_me`, `get_saved`, `search_saved`, `get_upvoted`, `get_downvoted`, `get_hidden`, `get_my_posts`, `get_my_comments`, `get_subscribed_subreddits`, `get_inbox`, `get_multireddits`
- public tools `search_reddit` and `get_user_profile`

### Removed

- the `uv`/Python prerequisite; the plugin now carries a URL and nothing else

## [1.1.0] - 2026-01-30

## [1.1.0] - 2026-01-24

### Changed

- remove orchestrator, use direct MCP exposure with OAuth ([6e69b841](../../commit/6e69b841))
