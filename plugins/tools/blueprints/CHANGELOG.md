# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.2.0] - 2026-02-18

### Added

- message timeline overhaul with Sentry, chronological results, subway lines, and chat alignment ([cc9af0cc](../../commit/cc9af0cc))

## [1.2.0] - 2026-02-12

### Changed

- drop MCP server from blueprints plugin, use native tools ([33c4b9b8](../../commit/33c4b9b8))
- mark 177 tools/validation/specialized/pattern skills as agent-internal ([cc83b672](../../commit/cc83b672))
- remove deprecated jutsu-/hashi-/do- terminology from plugins ([bc76f2b7](../../commit/bc76f2b7))

## [1.2.0] - 2026-02-11

### Changed

- drop MCP server from blueprints plugin, use native tools ([33c4b9b8](../../commit/33c4b9b8))
- mark 177 tools/validation/specialized/pattern skills as agent-internal ([cc83b672](../../commit/cc83b672))
- remove deprecated jutsu-/hashi-/do- terminology from plugins ([bc76f2b7](../../commit/bc76f2b7))

## [1.2.0] - 2026-01-30

## [1.2.0] - 2026-01-24

### Added

- add list_blueprints MCP tool ([7caf3e29](../../commit/7caf3e29))
- add git-storytelling commit validation hook and various improvements ([71c8777d](../../commit/71c8777d))

### Fixed

- correct command name in create-blueprint.md ([52e12146](../../commit/52e12146))
- correct command name in generate-blueprints.md ([3e52bd75](../../commit/3e52bd75))
- skip Claude Code review for fork PRs and fix broken link warnings ([d73ae673](../../commit/d73ae673))
- skip Claude Code review for fork PRs and fix broken link warnings ([46ea32c0](../../commit/46ea32c0))

### Changed

- remove orchestrator, use direct MCP exposure with OAuth ([6e69b841](../../commit/6e69b841))

### Other

- Merge pull request #26 from TheBushidoCollective/feature/browse ([5943715b](../../commit/5943715b))
- update blueprint commands to use MCP tools ([3734fd66](../../commit/3734fd66))
- resolve conflicts with main ([ad1a15d7](../../commit/ad1a15d7))

## [1.1.8] - 2026-01-24

### Fixed

- skip Claude Code review for fork PRs and fix broken link warnings ([d73ae673](../../commit/d73ae673))

## [1.1.7] - 2025-12-24

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Fixed

- restore memory configs in hashi plugins ([1a4c3a43](../../commit/1a4c3a43))
- address test failures from prompt hook removal ([dcf0e0c3](../../commit/dcf0e0c3))

### Changed

- remove all prompt hooks ([01227fef](../../commit/01227fef))

### Other

- Merge pull request #24 from TheBushidoCollective/refactor/remove-prompt-hooks ([4284b64e](../../commit/4284b64e))
- Merge pull request #23 from TheBushidoCollective/refactor/remove-prompt-hooks ([ce59ff80](../../commit/ce59ff80))

## [1.1.7] - 2025-12-23

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Fixed

- address test failures from prompt hook removal ([dcf0e0c3](../../commit/dcf0e0c3))

### Changed

- remove all prompt hooks ([01227fef](../../commit/01227fef))

### Other

- Merge pull request #23 from TheBushidoCollective/refactor/remove-prompt-hooks ([ce59ff80](../../commit/ce59ff80))

## [1.1.7] - 2025-12-23

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Changed

- remove all prompt hooks ([01227fef](../../commit/01227fef))

## [1.1.6] - 2025-12-16

### Added

- configurable binary path with smart native rebuild ([55dfec93](../../commit/55dfec93))

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [1.1.6] - 2025-12-15

### Other

- comprehensive memory system documentation and test improvements ([c57e03be](../../commit/c57e03be))

## [1.1.5] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- add agent detection to han explain ([245601e8](../../commit/245601e8))

### Fixed

- convert hook timeout from seconds to milliseconds ([985ecde3](../../commit/985ecde3))
- remove duplicate strings in hook commands ([63199a44](../../commit/63199a44))
- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Changed

- migrate all must-read-first echo commands to han hook reference ([fbae684c](../../commit/fbae684c))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.1.4] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- add agent detection to han explain ([245601e8](../../commit/245601e8))

### Fixed

- remove duplicate strings in hook commands ([63199a44](../../commit/63199a44))
- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Changed

- migrate all must-read-first echo commands to han hook reference ([fbae684c](../../commit/fbae684c))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.1.3] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- add agent detection to han explain ([245601e8](../../commit/245601e8))

### Fixed

- remove npx fallback from all hooks - rely on binary only ([b088a4a9](../../commit/b088a4a9))
- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Changed

- migrate all must-read-first echo commands to han hook reference ([fbae684c](../../commit/fbae684c))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.1.2] - 2025-12-08

### Added

- auto-install han binary and use direct han commands ([f0bca8c3](../../commit/f0bca8c3))
- add agent detection to han explain ([245601e8](../../commit/245601e8))

### Fixed

- add Claude bin directory to PATH in hook test execution ([c0bd7909](../../commit/c0bd7909))

### Changed

- migrate all must-read-first echo commands to han hook reference ([fbae684c](../../commit/fbae684c))

### Other

- fix han command ([fab172e8](../../commit/fab172e8))

## [1.1.1] - 2025-12-07

### Added

- add epistemic rigor enforcement and spinning wheels detection ([9ebce22b](../../commit/9ebce22b))
- update blog posts with correct dates and new intro post ([04cb8fc2](../../commit/04cb8fc2))

### Fixed

- convert all hook timeouts from milliseconds to seconds ([c3d303d2](../../commit/c3d303d2))

### Changed

- migrate all must-read-first echo commands to han hook reference ([fbae684c](../../commit/fbae684c))
- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))

## [1.1.0] - 2025-12-07

### Added

- add epistemic rigor enforcement and spinning wheels detection ([9ebce22b](../../commit/9ebce22b))
- update blog posts with correct dates and new intro post ([04cb8fc2](../../commit/04cb8fc2))

### Changed

- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))

## [1.0.1] - 2025-12-07

### Changed

- consolidate jutsu-blueprints into hashi-blueprints ([f4636959](../../commit/f4636959))

## [1.2.3] - 2025-12-04

### Added

- add Stop hook for documentation check ([c19ab9bc](../../commit/c19ab9bc))

### Fixed

- add required sections to command files ([6ede76de](../../commit/6ede76de))
- move hooks.json to correct location ([1a13d222](../../commit/1a13d222))
- remove non-functional Stop hook ([e460763f](../../commit/e460763f))
- use correct Stop hook format with JSON response ([339d01c8](../../commit/339d01c8))

### Changed

- rename specs to blueprints for documentation plugin ([b0178208](../../commit/b0178208))

### Other

- clarify blueprints must be at repo root ([52072d40](../../commit/52072d40))
- apply biome formatting to han-native and hooks.json ([b61dfabd](../../commit/b61dfabd))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.2.2] - 2025-12-04

### Added

- add Stop hook for documentation check ([c19ab9bc](../../commit/c19ab9bc))

### Fixed

- add required sections to command files ([6ede76de](../../commit/6ede76de))
- move hooks.json to correct location ([1a13d222](../../commit/1a13d222))
- remove non-functional Stop hook ([e460763f](../../commit/e460763f))
- use correct Stop hook format with JSON response ([339d01c8](../../commit/339d01c8))

### Changed

- rename specs to blueprints for documentation plugin ([b0178208](../../commit/b0178208))

### Other

- apply biome formatting to han-native and hooks.json ([b61dfabd](../../commit/b61dfabd))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.2.1] - 2025-12-04

### Added

- add Stop hook for documentation check ([c19ab9bc](../../commit/c19ab9bc))

### Fixed

- move hooks.json to correct location ([1a13d222](../../commit/1a13d222))
- remove non-functional Stop hook ([e460763f](../../commit/e460763f))
- use correct Stop hook format with JSON response ([339d01c8](../../commit/339d01c8))

### Changed

- rename specs to blueprints for documentation plugin ([b0178208](../../commit/b0178208))

### Other

- apply biome formatting to han-native and hooks.json ([b61dfabd](../../commit/b61dfabd))
- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.2.0] - 2025-12-04

### Added

- add Stop hook for documentation check ([c19ab9bc](../../commit/c19ab9bc))

### Fixed

- move hooks.json to correct location ([1a13d222](../../commit/1a13d222))
- remove non-functional Stop hook ([e460763f](../../commit/e460763f))
- use correct Stop hook format with JSON response ([339d01c8](../../commit/339d01c8))

### Changed

- rename specs to blueprints for documentation plugin ([b0178208](../../commit/b0178208))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.1.5] - 2025-12-04

### Fixed

- move hooks.json to correct location ([1a13d222](../../commit/1a13d222))
- remove non-functional Stop hook ([e460763f](../../commit/e460763f))
- use correct Stop hook format with JSON response ([339d01c8](../../commit/339d01c8))

### Changed

- rename specs to blueprints for documentation plugin ([b0178208](../../commit/b0178208))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.1.4] - 2025-12-04

### Fixed

- remove non-functional Stop hook ([e460763f](../../commit/e460763f))
- use correct Stop hook format with JSON response ([339d01c8](../../commit/339d01c8))

### Changed

- rename specs to blueprints for documentation plugin ([b0178208](../../commit/b0178208))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.1.3] - 2025-12-04

### Fixed

- use correct Stop hook format with JSON response ([339d01c8](../../commit/339d01c8))

### Changed

- rename specs to blueprints for documentation plugin ([b0178208](../../commit/b0178208))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.1.2] - 2025-12-04

### Changed

- rename specs to blueprints for documentation plugin ([b0178208](../../commit/b0178208))

### Other

- fix markdown linting issues in blueprints docs ([7b26ea3e](../../commit/7b26ea3e))

## [1.1.1] - 2025-12-04

### Changed

- rename specs to blueprints for documentation plugin ([b0178208](../../commit/b0178208))

## [1.1.0] - 2025-12-04

### Added

- add technical specification documentation plugin ([f8d23612](../../commit/f8d23612))
