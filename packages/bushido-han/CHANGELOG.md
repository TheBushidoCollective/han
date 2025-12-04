# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.39.6] - 2025-12-04

### Added

- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))
- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))

### Fixed

- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))
- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))
- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))
- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.5] - 2025-12-03

### Added

- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))
- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))
- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))
- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.4] - 2025-12-03

### Added

- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))
- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))
- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))
- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.3] - 2025-12-03

### Added

- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))
- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.2] - 2025-12-03

### Added

- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))
- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.1] - 2025-12-03

### Added

- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.39.0] - 2025-12-03

### Added

- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.38.0] - 2025-12-03

### Added

- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.37.1] - 2025-12-03

### Added

- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))
- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))
- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.37.0] - 2025-12-03

### Added

- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))
- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))
- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.36.7] - 2025-12-03

### Added

- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))
- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))
- remove double blank lines from CHANGELOGs ([dbe3a96f](../../commit/dbe3a96f))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.36.6] - 2025-12-03

### Added

- add resource management for hook execution ([b16796f2](../../commit/b16796f2))

### Fixed

- check cache before acquiring lock slot ([17e6a2c6](../../commit/17e6a2c6))
- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))
- remove double blank lines from CHANGELOGs ([dbe3a96f](../../commit/dbe3a96f))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

## [1.36.5] - 2025-12-03

### Added

- inject dispatch hooks on plugin install ([1d3119b9](../../commit/1d3119b9))

### Fixed

- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))
- remove double blank lines from CHANGELOGs ([dbe3a96f](../../commit/dbe3a96f))
- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([480d6c7d](../../commit/480d6c7d))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))

## [1.36.4] - 2025-12-03

### Added

- inject dispatch hooks on plugin install ([1d3119b9](../../commit/1d3119b9))
- add hook dispatch command for Claude Code bug workaround ([96cf0d24](../../commit/96cf0d24))
- add npx cache self-repair and remove JS fallback ([37ae33f9](../../commit/37ae33f9))

### Fixed

- remove double blank lines from CHANGELOGs ([6e6f236a](../../commit/6e6f236a))
- remove double blank lines from CHANGELOGs ([dbe3a96f](../../commit/dbe3a96f))
- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([480d6c7d](../../commit/480d6c7d))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- use local plugin store for hook dispatch ([c80f1c99](../../commit/c80f1c99))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))
- clear log lines when transitioning to plugin selector ([2e40ee6c](../../commit/2e40ee6c))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([d56a0ad3](../../commit/d56a0ad3))

## [1.36.3] - 2025-12-03

### Added

- inject dispatch hooks on plugin install ([1d3119b9](../../commit/1d3119b9))
- add hook dispatch command for Claude Code bug workaround ([96cf0d24](../../commit/96cf0d24))
- add npx cache self-repair and remove JS fallback ([37ae33f9](../../commit/37ae33f9))
- require explicit plugin name in hook run command ([a314da59](../../commit/a314da59))

### Fixed

- remove double blank lines from CHANGELOGs ([dbe3a96f](../../commit/dbe3a96f))
- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([480d6c7d](../../commit/480d6c7d))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- use local plugin store for hook dispatch ([c80f1c99](../../commit/c80f1c99))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))
- clear log lines when transitioning to plugin selector ([2e40ee6c](../../commit/2e40ee6c))
- resolve Ink UI navigation in hook test execution ([22e916b6](../../commit/22e916b6))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([d56a0ad3](../../commit/d56a0ad3))
- update tests for new hook command format ([615d195b](../../commit/615d195b))

## [1.36.2] - 2025-12-03

### Added

- inject dispatch hooks on plugin install ([1d3119b9](../../commit/1d3119b9))
- add hook dispatch command for Claude Code bug workaround ([96cf0d24](../../commit/96cf0d24))
- add npx cache self-repair and remove JS fallback ([37ae33f9](../../commit/37ae33f9))
- require explicit plugin name in hook run command ([a314da59](../../commit/a314da59))

### Fixed

- remove double blank lines from CHANGELOGs ([97cb0320](../../commit/97cb0320))
- remove double blank lines from CHANGELOGs ([480d6c7d](../../commit/480d6c7d))
- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- use local plugin store for hook dispatch ([c80f1c99](../../commit/c80f1c99))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))
- clear log lines when transitioning to plugin selector ([2e40ee6c](../../commit/2e40ee6c))
- resolve Ink UI navigation in hook test execution ([22e916b6](../../commit/22e916b6))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([d56a0ad3](../../commit/d56a0ad3))
- update tests for new hook command format ([615d195b](../../commit/615d195b))

## [1.36.1] - 2025-12-03

### Added

- inject dispatch hooks on plugin install ([1d3119b9](../../commit/1d3119b9))
- add hook dispatch command for Claude Code bug workaround ([96cf0d24](../../commit/96cf0d24))
- add npx cache self-repair and remove JS fallback ([37ae33f9](../../commit/37ae33f9))
- require explicit plugin name in hook run command ([a314da59](../../commit/a314da59))

### Fixed

- remove double blank lines from CHANGELOGs ([35141f73](../../commit/35141f73))
- remove double blank lines from CHANGELOGs ([d3773c3e](../../commit/d3773c3e))
- use local plugin store for hook dispatch ([c80f1c99](../../commit/c80f1c99))
- remove double blank lines from existing CHANGELOGs ([b829c36c](../../commit/b829c36c))
- remove double blank lines from CHANGELOG files ([58eb3336](../../commit/58eb3336))
- fix markdown formatting in CHANGELOG files ([21ca9a75](../../commit/21ca9a75))
- remove trailing blank lines from CHANGELOG files ([999bbf73](../../commit/999bbf73))
- clear log lines when transitioning to plugin selector ([2e40ee6c](../../commit/2e40ee6c))
- resolve Ink UI navigation in hook test execution ([22e916b6](../../commit/22e916b6))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([d56a0ad3](../../commit/d56a0ad3))
- update tests for new hook command format ([615d195b](../../commit/615d195b))

## [1.36.0] - 2025-12-03

### Added

- inject dispatch hooks on plugin install ([1d3119b](../../commit/1d3119b))
- add hook dispatch command for Claude Code bug workaround ([96cf0d2](../../commit/96cf0d2))
- add npx cache self-repair and remove JS fallback ([37ae33f](../../commit/37ae33f))
- require explicit plugin name in hook run command ([a314da5](../../commit/a314da5))
- capture hook output to temp files and add debug mode ([e5f6a41](../../commit/e5f6a41))

### Fixed

- remove double blank lines from CHANGELOGs ([d3773c3](../../commit/d3773c3))
- use local plugin store for hook dispatch ([c80f1c9](../../commit/c80f1c9))
- remove double blank lines from existing CHANGELOGs ([b829c36](../../commit/b829c36))
- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))
- clear log lines when transitioning to plugin selector ([2e40ee6](../../commit/2e40ee6))
- resolve Ink UI navigation in hook test execution ([22e916b](../../commit/22e916b))
- resolve merge conflict in package.json ([3604b2d](../../commit/3604b2d))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([d56a0ad](../../commit/d56a0ad))
- update tests for new hook command format ([615d195](../../commit/615d195))

## [1.35.1] - 2025-12-03

### Added

- add hook dispatch command for Claude Code bug workaround ([96cf0d2](../../commit/96cf0d2))
- add npx cache self-repair and remove JS fallback ([37ae33f](../../commit/37ae33f))
- require explicit plugin name in hook run command ([a314da5](../../commit/a314da5))
- capture hook output to temp files and add debug mode ([e5f6a41](../../commit/e5f6a41))
- add idle timeout for hooks and config schema validation ([c452a48](../../commit/c452a48))

### Fixed

- use local plugin store for hook dispatch ([c80f1c9](../../commit/c80f1c9))
- remove double blank lines from existing CHANGELOGs ([b829c36](../../commit/b829c36))
- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))
- clear log lines when transitioning to plugin selector ([2e40ee6](../../commit/2e40ee6))
- resolve Ink UI navigation in hook test execution ([22e916b](../../commit/22e916b))
- resolve merge conflict in package.json ([3604b2d](../../commit/3604b2d))
- remove unused lastOutputTime variable ([8e800f9](../../commit/8e800f9))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([d56a0ad](../../commit/d56a0ad))
- update tests for new hook command format ([615d195](../../commit/615d195))

## [1.35.0] - 2025-12-03

### Added

- add hook dispatch command for Claude Code bug workaround ([96cf0d2](../../commit/96cf0d2))
- add npx cache self-repair and remove JS fallback ([37ae33f](../../commit/37ae33f))
- require explicit plugin name in hook run command ([a314da5](../../commit/a314da5))
- capture hook output to temp files and add debug mode ([e5f6a41](../../commit/e5f6a41))
- add idle timeout for hooks and config schema validation ([c452a48](../../commit/c452a48))

### Fixed

- remove double blank lines from existing CHANGELOGs ([b829c36](../../commit/b829c36))
- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))
- clear log lines when transitioning to plugin selector ([2e40ee6](../../commit/2e40ee6))
- resolve Ink UI navigation in hook test execution ([22e916b](../../commit/22e916b))
- resolve merge conflict in package.json ([3604b2d](../../commit/3604b2d))
- remove unused lastOutputTime variable ([8e800f9](../../commit/8e800f9))
- restore keyboard navigation after viewing hook output ([dc91922](../../commit/dc91922))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([d56a0ad](../../commit/d56a0ad))
- update tests for new hook command format ([615d195](../../commit/615d195))

## [1.34.3] - 2025-12-03

### Added

- add npx cache self-repair and remove JS fallback ([37ae33f](../../commit/37ae33f))
- require explicit plugin name in hook run command ([a314da5](../../commit/a314da5))
- capture hook output to temp files and add debug mode ([e5f6a41](../../commit/e5f6a41))
- add idle timeout for hooks and config schema validation ([c452a48](../../commit/c452a48))

### Fixed

- remove double blank lines from existing CHANGELOGs ([b829c36](../../commit/b829c36))
- remove double blank lines from CHANGELOG files ([58eb333](../../commit/58eb333))
- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))
- clear log lines when transitioning to plugin selector ([2e40ee6](../../commit/2e40ee6))
- resolve Ink UI navigation in hook test execution ([22e916b](../../commit/22e916b))
- resolve merge conflict in package.json ([3604b2d](../../commit/3604b2d))
- remove unused lastOutputTime variable ([8e800f9](../../commit/8e800f9))
- restore keyboard navigation after viewing hook output ([dc91922](../../commit/dc91922))

### Changed

- remove unused liveOutput prop from HookTestUI ([90441d6](../../commit/90441d6))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([d56a0ad](../../commit/d56a0ad))
- update tests for new hook command format ([615d195](../../commit/615d195))

## [1.34.2] - 2025-12-03

### Added

- add npx cache self-repair and remove JS fallback ([37ae33f](../../commit/37ae33f))
- require explicit plugin name in hook run command ([a314da5](../../commit/a314da5))
- capture hook output to temp files and add debug mode ([e5f6a41](../../commit/e5f6a41))
- add idle timeout for hooks and config schema validation ([c452a48](../../commit/c452a48))

### Fixed

- fix markdown formatting in CHANGELOG files ([21ca9a7](../../commit/21ca9a7))
- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))
- clear log lines when transitioning to plugin selector ([2e40ee6](../../commit/2e40ee6))
- resolve Ink UI navigation in hook test execution ([22e916b](../../commit/22e916b))
- resolve merge conflict in package.json ([3604b2d](../../commit/3604b2d))
- remove unused lastOutputTime variable ([8e800f9](../../commit/8e800f9))
- restore keyboard navigation after viewing hook output ([dc91922](../../commit/dc91922))
- use unmount/remount for viewing hook output to prevent freezes ([c858b09](../../commit/c858b09))
- paginate output in hook test detail view to prevent freeze ([e9feb16](../../commit/e9feb16))

### Changed

- remove unused liveOutput prop from HookTestUI ([90441d6](../../commit/90441d6))

### Other

- Merge branch 'main' of github.com:TheBushidoCollective/han ([d56a0ad](../../commit/d56a0ad))
- update tests for new hook command format ([615d195](../../commit/615d195))

## [1.34.1] - 2025-12-03

### Added

- add npx cache self-repair and remove JS fallback ([37ae33f](../../commit/37ae33f))
- require explicit plugin name in hook run command ([a314da5](../../commit/a314da5))
- capture hook output to temp files and add debug mode ([e5f6a41](../../commit/e5f6a41))
- add idle timeout for hooks and config schema validation ([c452a48](../../commit/c452a48))

### Fixed

- remove trailing blank lines from CHANGELOG files ([999bbf7](../../commit/999bbf7))
- clear log lines when transitioning to plugin selector ([2e40ee6](../../commit/2e40ee6))
- resolve Ink UI navigation in hook test execution ([22e916b](../../commit/22e916b))
- resolve merge conflict in package.json ([3604b2d](../../commit/3604b2d))
- remove unused lastOutputTime variable ([8e800f9](../../commit/8e800f9))
- restore keyboard navigation after viewing hook output ([dc91922](../../commit/dc91922))
- use unmount/remount for viewing hook output to prevent freezes ([c858b09](../../commit/c858b09))
- paginate output in hook test detail view to prevent freeze ([e9feb16](../../commit/e9feb16))
- resolve relative CLAUDE_ENV_FILE paths and use login shell fallback ([904d6d7](../../commit/904d6d7))

### Changed

- remove unused liveOutput prop from HookTestUI ([90441d6](../../commit/90441d6))

### Other

- update tests for new hook command format ([615d195](../../commit/615d195))
- update test for silent success on single command runs ([3cb90f3](../../commit/3cb90f3))

## [1.34.0] - 2025-12-03

### Added

- add npx cache self-repair and remove JS fallback ([37ae33f](../../commit/37ae33f))
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

### Changed

- remove unused liveOutput prop from HookTestUI ([90441d6](../../commit/90441d6))

### Other

- update tests for new hook command format ([615d195](../../commit/615d195))
- update test for silent success on single command runs ([3cb90f3](../../commit/3cb90f3))

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
