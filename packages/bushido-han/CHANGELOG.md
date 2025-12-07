# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.52.1] - 2025-12-07

### Added

- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- move file reference command to han hook reference ([ffd08928](../../commit/ffd08928))
- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))
- rename han-core to core and update website ([190f876b](../../commit/190f876b))

## [1.52.0] - 2025-12-07

### Added

- add 'han prompt must-read' command for semantic hook injection ([8d749a3e](../../commit/8d749a3e))

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))
- rename han-core to core and update website ([190f876b](../../commit/190f876b))

## [1.51.3] - 2025-12-07

### Added

- add new CLI commands and jutsu-claude-agent-sdk plugin ([977acadc](../../commit/977acadc))

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))
- test source code in CI instead of building binary ([00f09311](../../commit/00f09311))
- update tests to default to binary-only distribution ([f9a99152](../../commit/f9a99152))
- resolve linting and typecheck issues ([72af6050](../../commit/72af6050))

### Changed

- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))
- rename han-core to core and update website ([190f876b](../../commit/190f876b))
- remove TypeScript build step from binary-only distribution ([30fccf9b](../../commit/30fccf9b))

### Other

- add binary distribution architecture comment to main.ts ([89655dc5](../../commit/89655dc5))
- migrate test suite to bun test (partial - 42/56 tests) ([07ce2c16](../../commit/07ce2c16))

## [1.51.2] - 2025-12-07

### Added

- add new CLI commands and jutsu-claude-agent-sdk plugin ([977acadc](../../commit/977acadc))
- add user frustration detection and tracking ([b02e0866](../../commit/b02e0866))
- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))

### Fixed

- test source code in CI instead of building binary ([00f09311](../../commit/00f09311))
- update tests to default to binary-only distribution ([f9a99152](../../commit/f9a99152))
- resolve linting and typecheck issues ([72af6050](../../commit/72af6050))
- replace better-sqlite3 with bun:sqlite for binary compatibility ([9d1b2125](../../commit/9d1b2125))
- show helpful error for binary builds instead of crashing ([33bcfc77](../../commit/33bcfc77))
- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))

### Changed

- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))
- rename han-core to core and update website ([190f876b](../../commit/190f876b))
- remove TypeScript build step from binary-only distribution ([30fccf9b](../../commit/30fccf9b))

### Other

- add binary distribution architecture comment to main.ts ([89655dc5](../../commit/89655dc5))
- migrate test suite to bun test (partial - 42/56 tests) ([07ce2c16](../../commit/07ce2c16))
- switch test suite from Node.js to Bun for bun:sqlite compatibility ([9f6ee999](../../commit/9f6ee999))
- apply biome formatting to plugin.json and import ordering ([963a99f6](../../commit/963a99f6))
- document npx wrapper + platform binary distribution ([dbfaa7ba](../../commit/dbfaa7ba))
- document npx wrapper + platform binary distribution ([6e478daa](../../commit/6e478daa))
- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))

## [1.51.1] - 2025-12-07

### Added

- add new CLI commands and jutsu-claude-agent-sdk plugin ([977acadc](../../commit/977acadc))
- add user frustration detection and tracking ([b02e0866](../../commit/b02e0866))
- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))
- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- test source code in CI instead of building binary ([00f09311](../../commit/00f09311))
- update tests to default to binary-only distribution ([f9a99152](../../commit/f9a99152))
- resolve linting and typecheck issues ([72af6050](../../commit/72af6050))
- replace better-sqlite3 with bun:sqlite for binary compatibility ([9d1b2125](../../commit/9d1b2125))
- show helpful error for binary builds instead of crashing ([33bcfc77](../../commit/33bcfc77))
- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))

### Changed

- rename han-core to core and update website ([190f876b](../../commit/190f876b))
- remove TypeScript build step from binary-only distribution ([30fccf9b](../../commit/30fccf9b))

### Other

- add binary distribution architecture comment to main.ts ([89655dc5](../../commit/89655dc5))
- migrate test suite to bun test (partial - 42/56 tests) ([07ce2c16](../../commit/07ce2c16))
- switch test suite from Node.js to Bun for bun:sqlite compatibility ([9f6ee999](../../commit/9f6ee999))
- apply biome formatting to plugin.json and import ordering ([963a99f6](../../commit/963a99f6))
- document npx wrapper + platform binary distribution ([dbfaa7ba](../../commit/dbfaa7ba))
- document npx wrapper + platform binary distribution ([6e478daa](../../commit/6e478daa))
- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))

## [1.51.0] - 2025-12-06

### Added

- add new CLI commands and jutsu-claude-agent-sdk plugin ([977acadc](../../commit/977acadc))
- add user frustration detection and tracking ([b02e0866](../../commit/b02e0866))
- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))
- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- test source code in CI instead of building binary ([00f09311](../../commit/00f09311))
- update tests to default to binary-only distribution ([f9a99152](../../commit/f9a99152))
- resolve linting and typecheck issues ([72af6050](../../commit/72af6050))
- replace better-sqlite3 with bun:sqlite for binary compatibility ([9d1b2125](../../commit/9d1b2125))
- show helpful error for binary builds instead of crashing ([33bcfc77](../../commit/33bcfc77))
- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))

### Changed

- remove TypeScript build step from binary-only distribution ([30fccf9b](../../commit/30fccf9b))
- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- add binary distribution architecture comment to main.ts ([89655dc5](../../commit/89655dc5))
- migrate test suite to bun test (partial - 42/56 tests) ([07ce2c16](../../commit/07ce2c16))
- switch test suite from Node.js to Bun for bun:sqlite compatibility ([9f6ee999](../../commit/9f6ee999))
- apply biome formatting to plugin.json and import ordering ([963a99f6](../../commit/963a99f6))
- document npx wrapper + platform binary distribution ([dbfaa7ba](../../commit/dbfaa7ba))
- document npx wrapper + platform binary distribution ([6e478daa](../../commit/6e478daa))
- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))
- update README for CLI integration ([34407550](../../commit/34407550))

## [1.50.1] - 2025-12-06

### Added

- add user frustration detection and tracking ([b02e0866](../../commit/b02e0866))
- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))
- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- test source code in CI instead of building binary ([00f09311](../../commit/00f09311))
- update tests to default to binary-only distribution ([f9a99152](../../commit/f9a99152))
- resolve linting and typecheck issues ([72af6050](../../commit/72af6050))
- replace better-sqlite3 with bun:sqlite for binary compatibility ([9d1b2125](../../commit/9d1b2125))
- show helpful error for binary builds instead of crashing ([33bcfc77](../../commit/33bcfc77))
- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))

### Changed

- remove TypeScript build step from binary-only distribution ([30fccf9b](../../commit/30fccf9b))
- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- add binary distribution architecture comment to main.ts ([89655dc5](../../commit/89655dc5))
- migrate test suite to bun test (partial - 42/56 tests) ([07ce2c16](../../commit/07ce2c16))
- switch test suite from Node.js to Bun for bun:sqlite compatibility ([9f6ee999](../../commit/9f6ee999))
- apply biome formatting to plugin.json and import ordering ([963a99f6](../../commit/963a99f6))
- document npx wrapper + platform binary distribution ([dbfaa7ba](../../commit/dbfaa7ba))
- document npx wrapper + platform binary distribution ([6e478daa](../../commit/6e478daa))
- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))
- update README for CLI integration ([34407550](../../commit/34407550))

## [1.50.0] - 2025-12-06

### Added

- add user frustration detection and tracking ([7e09f6d5](../../commit/7e09f6d5))
- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- show helpful error for binary builds instead of crashing ([33bcfc77](../../commit/33bcfc77))
- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))
- update README for CLI integration ([34407550](../../commit/34407550))

## [1.49.5] - 2025-12-06

### Added

- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- show helpful error for binary builds instead of crashing ([33bcfc77](../../commit/33bcfc77))
- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))
- update README for CLI integration ([34407550](../../commit/34407550))

## [1.49.4] - 2025-12-06

### Added

- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))
- disable distributed fail-fast for MCP tools ([79d93e94](../../commit/79d93e94))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- format display-plain.ts with Biome ([d4f60d2a](../../commit/d4f60d2a))
- update README for CLI integration ([34407550](../../commit/34407550))

## [1.49.3] - 2025-12-06

### Added

- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- add plain text fallback for metrics in compiled binaries ([c08faacd](../../commit/c08faacd))
- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))
- disable distributed fail-fast for MCP tools ([79d93e94](../../commit/79d93e94))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- update README for CLI integration ([34407550](../../commit/34407550))

## [1.49.2] - 2025-12-06

### Added

- add han metrics command with terminal visualization ([d915d332](../../commit/d915d332))

### Fixed

- lazy-load MetricsStorage to prevent native module loading at import ([9022e06d](../../commit/9022e06d))
- remove unused imports from metrics command ([aeef736b](../../commit/aeef736b))
- disable distributed fail-fast for MCP tools ([79d93e94](../../commit/79d93e94))

### Changed

- integrate metrics server into main CLI ([2bd8af6c](../../commit/2bd8af6c))

### Other

- update README for CLI integration ([34407550](../../commit/34407550))

## [1.49.1] - 2025-12-05

### Added

- add pre-push hook verification feature ([65bcac74](../../commit/65bcac74))
- add hook verify command for validation testing ([e9f4ffe8](../../commit/e9f4ffe8))
- add HAN_DISABLE_HOOKS environment variable for global hook disable ([ae87177e](../../commit/ae87177e))
- add real-time streaming to hook test output viewer ([c00fbda8](../../commit/c00fbda8))
- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))

### Fixed

- disable distributed fail-fast for MCP tools ([79d93e94](../../commit/79d93e94))
- use merged settings for hook run command ([0f535f33](../../commit/0f535f33))
- handle Ctrl+C gracefully in hook test --execute ([c6834331](../../commit/c6834331))
- remove unused imports from hook-test.ts ([d585d855](../../commit/d585d855))
- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))

### Changed

- stream hook output within Ink UI instead of unmounting ([47b71d96](../../commit/47b71d96))

### Other

- simplify hook verify cache test ([c24adb83](../../commit/c24adb83))
- add tests for hook verify command ([7bce40dc](../../commit/7bce40dc))
- apply biome formatting to hook test files ([a03e95fd](../../commit/a03e95fd))
- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.49.0] - 2025-12-05

### Added

- add pre-push hook verification feature ([65bcac74](../../commit/65bcac74))
- add hook verify command for validation testing ([e9f4ffe8](../../commit/e9f4ffe8))
- add HAN_DISABLE_HOOKS environment variable for global hook disable ([ae87177e](../../commit/ae87177e))
- add real-time streaming to hook test output viewer ([c00fbda8](../../commit/c00fbda8))
- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))

### Fixed

- use merged settings for hook run command ([0f535f33](../../commit/0f535f33))
- handle Ctrl+C gracefully in hook test --execute ([c6834331](../../commit/c6834331))
- remove unused imports from hook-test.ts ([d585d855](../../commit/d585d855))
- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))

### Changed

- stream hook output within Ink UI instead of unmounting ([47b71d96](../../commit/47b71d96))

### Other

- simplify hook verify cache test ([c24adb83](../../commit/c24adb83))
- add tests for hook verify command ([7bce40dc](../../commit/7bce40dc))
- apply biome formatting to hook test files ([a03e95fd](../../commit/a03e95fd))
- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.6] - 2025-12-05

### Added

- add HAN_DISABLE_HOOKS environment variable for global hook disable ([ae87177e](../../commit/ae87177e))
- add real-time streaming to hook test output viewer ([c00fbda8](../../commit/c00fbda8))
- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))

### Fixed

- use merged settings for hook run command ([0f535f33](../../commit/0f535f33))
- handle Ctrl+C gracefully in hook test --execute ([c6834331](../../commit/c6834331))
- remove unused imports from hook-test.ts ([d585d855](../../commit/d585d855))
- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))

### Changed

- stream hook output within Ink UI instead of unmounting ([47b71d96](../../commit/47b71d96))

### Other

- apply biome formatting to hook test files ([a03e95fd](../../commit/a03e95fd))
- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.5] - 2025-12-05

### Added

- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))

### Fixed

- remove unused imports from hook-test.ts ([d585d855](../../commit/d585d855))
- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))

### Changed

- stream hook output within Ink UI instead of unmounting ([47b71d96](../../commit/47b71d96))

### Other

- apply biome formatting to hook test files ([a03e95fd](../../commit/a03e95fd))
- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.4] - 2025-12-05

### Added

- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))

### Fixed

- remove unused imports from hook-test.ts ([d585d855](../../commit/d585d855))
- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))

### Changed

- stream hook output within Ink UI instead of unmounting ([47b71d96](../../commit/47b71d96))

### Other

- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.3] - 2025-12-05

### Added

- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))

### Fixed

- remove unused imports from hook-test.ts ([d585d855](../../commit/d585d855))
- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))

### Other

- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.2] - 2025-12-05

### Added

- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))

### Fixed

- make hook test command merge user, project, and local settings ([417de80d](../../commit/417de80d))
- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))

### Other

- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.1] - 2025-12-04

### Added

- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))

### Fixed

- fix biome lint errors in marketplace-cache tests ([0095af3b](../../commit/0095af3b))
- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))

### Other

- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))

## [1.48.0] - 2025-12-04

### Added

- add marketplace caching with 24-hour auto-refresh ([9248e898](../../commit/9248e898))
- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))

### Fixed

- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))

### Other

- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))
- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))

## [1.47.4] - 2025-12-04

### Added

- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))
- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))

### Fixed

- MCP tools should not default to fail-fast mode ([1bdaec54](../../commit/1bdaec54))
- clear stale failure signals on hook run start ([063c447b](../../commit/063c447b))
- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))

### Other

- add test for MCP tool isolation from failure signals ([7331b431](../../commit/7331b431))
- add test for stale failure signal cleanup ([eaf2b3b9](../../commit/eaf2b3b9))
- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))

## [1.47.3] - 2025-12-04

### Added

- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))
- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))

### Fixed

- use plugin names instead of array indices as React keys ([feae87c6](../../commit/feae87c6))
- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))
- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))

## [1.47.2] - 2025-12-04

### Added

- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))
- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))

### Fixed

- remove invalid han-config.yml causing hook failures ([eb51a761](../../commit/eb51a761))
- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))
- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))

## [1.47.1] - 2025-12-04

### Added

- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))
- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))

### Fixed

- use index-based keys for plugin selector lists ([e8952fab](../../commit/e8952fab))
- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))
- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))

## [1.47.0] - 2025-12-04

### Added

- auto-install bushido plugin with any plugin installation ([5e4749dc](../../commit/5e4749dc))
- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))
- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))

### Fixed

- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))
- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))

## [1.46.0] - 2025-12-04

### Added

- add cache option to MCP tool execution ([79c3c366](../../commit/79c3c366))
- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))

### Fixed

- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))
- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.45.2] - 2025-12-04

### Added

- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))
- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))

### Fixed

- respect CLAUDE_CONFIG_DIR in shared.ts ([34da18e0](../../commit/34da18e0))
- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.45.1] - 2025-12-04

### Added

- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))
- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))

### Fixed

- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- add CLI Reference documentation for han commands ([670e8fac](../../commit/670e8fac))
- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.45.0] - 2025-12-04

### Added

- add colorful Ink UI for hook explain command ([abfcbc8c](../../commit/abfcbc8c))
- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))
- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))

### Fixed

- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))
- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.44.2] - 2025-12-04

### Added

- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))
- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))

### Fixed

- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))
- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- rename Buki→Jutsu and Sensei→Hashi across documentation ([faabb59e](../../commit/faabb59e))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.44.1] - 2025-12-04

### Added

- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))
- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))

### Fixed

- remove merge conflict markers from CHANGELOG.md and package.json ([31684e89](../../commit/31684e89))
- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))
- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.44.0] - 2025-12-04

### Added

- add --all option to hook explain and dispatch commands ([b7b1650f](../../commit/b7b1650f))
- add hook explain command for debugging ([4c0a2082](../../commit/4c0a2082))
- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))
- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))

### Fixed

- resolve merge conflicts in CHANGELOG.md ([2b75bcd8](../../commit/2b75bcd8))
- address biome linter warnings in explain.ts ([f391e0c5](../../commit/f391e0c5))
- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))
- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.42.3] - 2025-12-04

### Added

- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))
- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))

### Fixed

- dispatch only executes command hooks, not prompt hooks ([390c3aef](../../commit/390c3aef))
- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.42.2] - 2025-12-04

### Added

- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))
- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))

### Fixed

- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))
- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))

## [1.42.1] - 2025-12-04

### Added

- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))
- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))

### Fixed

- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))
- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))

### Changed

- create shared settings merge helper ([ed7c7d1a](../../commit/ed7c7d1a))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))

## [1.42.0] - 2025-12-04

### Added

- enhance tool descriptions and add ping support ([332d8bef](../../commit/332d8bef))
- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))
- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))

### Fixed

- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))
- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))

## [1.41.2] - 2025-12-04

### Added

- add MCP server for running hook commands via natural language ([21c56034](../../commit/21c56034))
- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))

### Fixed

- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))
- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))

## [1.41.1] - 2025-12-04

### Added

- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))

### Fixed

- add retry logic for CDN propagation delays ([49bf5976](../../commit/49bf5976))
- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))

## [1.41.0] - 2025-12-04

### Added

- add user scope for plugin installation (default) ([5a1e9002](../../commit/5a1e9002))
- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))

### Fixed

- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))
- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))

## [1.40.0] - 2025-12-04

### Added

- instruct agent to proceed without asking questions on failure ([4bf08ff1](../../commit/4bf08ff1))
- add cross-process failure signaling for parallel hooks ([7d7d37dc](../../commit/7d7d37dc))
- track plugin files and han-config.yml in cache ([dee7aeea](../../commit/dee7aeea))
- auto-discover plugin root from settings ([0b2d5f96](../../commit/0b2d5f96))
- show command and directory in verbose mode ([82da8d8d](../../commit/82da8d8d))
- use session_id from Claude hook stdin payload ([27147f91](../../commit/27147f91))

### Fixed

- reset stdin state after viewing hook output ([08900c77](../../commit/08900c77))
- pass CLAUDE_PLUGIN_ROOT env var to hook commands ([aee6f346](../../commit/aee6f346))
- restore Ink navigation after viewing hook output ([4593046c](../../commit/4593046c))

### Changed

- acquire/release lock per directory for better interleaving ([c235c8de](../../commit/c235c8de))

### Other

- add tests for failure signaling functions ([419f50ed](../../commit/419f50ed))
- add tests for plugin auto-discovery feature ([5aac67ed](../../commit/5aac67ed))
- add comprehensive tests for hook-lock feature ([d9fd3c1e](../../commit/d9fd3c1e))

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
