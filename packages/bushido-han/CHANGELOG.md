# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.33.0] - 2025-12-03

### Added


- require explicit plugin name in hook run command ([a314da5](../../commit/a314da5))
- capture hook output to temp files and add debug mode ([e5f6a41](../../commit/e5f6a41))
- add idle timeout for hooks and config schema validation ([c452a48](../../commit/c452a48))

### Fixed


- clear log lines when transitioning to plugin selector ([2e40ee6](../../commit/2e40ee6))
- resolve Ink UI navigation in hook test execution ([22e916b](../../commit/22e916b))
- resolve merge conflict in package.json ([3604b2d](../../commit/3604b2d))
- remove unused lastOutputTime variable ([8e800f9](../../commit/8e800f9))
- restore keyboard navigation after viewing hook output ([dc91922](../../commit/dc91922))
- use unmount/remount for viewing hook output to prevent freezes ([c858b09](../../commit/c858b09))
- paginate output in hook test detail view to prevent freeze ([e9feb16](../../commit/e9feb16))
- resolve relative CLAUDE_ENV_FILE paths and use login shell fallback ([904d6d7](../../commit/904d6d7))
- source CLAUDE_ENV_FILE before running hook commands ([4558340](../../commit/4558340))
- add error handling and throttling to hook test UI ([926011a](../../commit/926011a))

### Changed


- remove unused liveOutput prop from HookTestUI ([90441d6](../../commit/90441d6))

### Other


- update tests for new hook command format ([615d195](../../commit/615d195))
- update test for silent success on single command runs ([3cb90f3](../../commit/3cb90f3))

