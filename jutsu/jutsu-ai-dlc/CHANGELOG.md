# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.2] - 2026-01-30

### Added

- add SubagentPrompt hook for context injection to subagents ([a16668ba](../../commit/a16668ba))
- add /resume command to recover from lost ephemeral state ([5b4bb303](../../commit/5b4bb303))
- add yaml-set command for frontmatter updates ([dd543889](../../commit/dd543889))
- add parallel bolt orchestration with git worktrees ([33cc61cf](../../commit/33cc61cf))
- auto-extract frontmatter from markdown ([abffd022](../../commit/abffd022))
- add han parse command for JSON/YAML parsing ([3eb51d27](../../commit/3eb51d27))
- add AI-DLC 2026 methodology plugin ([ed938138](../../commit/ed938138))

### Fixed

- inject concrete branch/worktree context to subagents ([c8fda6de](../../commit/c8fda6de))
- bolts MUST use dedicated unit branches ([fa3be1e1](../../commit/fa3be1e1))
- /construct spawns subagents, hats are behavioral context ([56551249](../../commit/56551249))
- add mandatory iteration management instructions to SessionStart ([28c77b12](../../commit/28c77b12))
- address shell injection and path traversal vulnerabilities ([e9d5a985](../../commit/e9d5a985))
- remove unused DAG_LIB_DIR variable ([0644f80b](../../commit/0644f80b))
- skip iteration advance on compact events ([7fbbc167](../../commit/7fbbc167))
- add shellcheck directive for dynamic source ([c4ec91a4](../../commit/c4ec91a4))
- use fully qualified names in command Name sections ([d5687c8e](../../commit/d5687c8e))
- add required sections to command files for claudelint ([bc3b10b1](../../commit/bc3b10b1))
- set needsAdvance flag in /advance command ([828185bf](../../commit/828185bf))
- move iteration increment to SessionStart hook ([5d6ad356](../../commit/5d6ad356))
- add instruction for no-file-change turns ([7d749d66](../../commit/7d749d66))
- use wildcard dependency for enforce-iteration hook ordering ([04a7f193](../../commit/04a7f193))
- complete remaining review items ([cd873817](../../commit/cd873817))
- address Claude review feedback ([8bd72302](../../commit/8bd72302))
- address CI warnings and review feedback ([c7c4bb80](../../commit/c7c4bb80))

### Changed

- hats are orchestrators that spawn subagents ([df79d5ca](../../commit/df79d5ca))
- elaborator is an agent, not a hat ([aa8623d2](../../commit/aa8623d2))
- group --check output by phase, rename hooks to convention ([67e678aa](../../commit/67e678aa))

### Other

- Revert "refactor(ai-dlc): hats are orchestrators that spawn subagents" ([ab63d884](../../commit/ab63d884))
- Merge branch 'main' of github.com:TheBushidoCollective/han ([48615d5f](../../commit/48615d5f))
- ai dlc fixes ([1546f13a](../../commit/1546f13a))
- add critical no-questions rule to construct command ([e4ce26a8](../../commit/e4ce26a8))

## [1.0.1] - 2026-01-30

### Added

- add yaml-set command for frontmatter updates ([dd543889](../../commit/dd543889))
- add parallel bolt orchestration with git worktrees ([33cc61cf](../../commit/33cc61cf))
- auto-extract frontmatter from markdown ([abffd022](../../commit/abffd022))
- add han parse command for JSON/YAML parsing ([3eb51d27](../../commit/3eb51d27))
- add AI-DLC 2026 methodology plugin ([ed938138](../../commit/ed938138))

### Fixed

- address shell injection and path traversal vulnerabilities ([e9d5a985](../../commit/e9d5a985))
- remove unused DAG_LIB_DIR variable ([0644f80b](../../commit/0644f80b))
- skip iteration advance on compact events ([7fbbc167](../../commit/7fbbc167))
- add shellcheck directive for dynamic source ([c4ec91a4](../../commit/c4ec91a4))
- use fully qualified names in command Name sections ([d5687c8e](../../commit/d5687c8e))
- add required sections to command files for claudelint ([bc3b10b1](../../commit/bc3b10b1))
- set needsAdvance flag in /advance command ([828185bf](../../commit/828185bf))
- move iteration increment to SessionStart hook ([5d6ad356](../../commit/5d6ad356))
- add instruction for no-file-change turns ([7d749d66](../../commit/7d749d66))
- use wildcard dependency for enforce-iteration hook ordering ([04a7f193](../../commit/04a7f193))
- complete remaining review items ([cd873817](../../commit/cd873817))
- address Claude review feedback ([8bd72302](../../commit/8bd72302))
- address CI warnings and review feedback ([c7c4bb80](../../commit/c7c4bb80))

### Changed

- group --check output by phase, rename hooks to convention ([67e678aa](../../commit/67e678aa))

### Other

- ai dlc fixes ([1546f13a](../../commit/1546f13a))
- add critical no-questions rule to construct command ([e4ce26a8](../../commit/e4ce26a8))

## [1.0.0] - 2026-01-30

### Added

- add yaml-set command for frontmatter updates ([dd543889](../../commit/dd543889))
- add parallel bolt orchestration with git worktrees ([33cc61cf](../../commit/33cc61cf))
- auto-extract frontmatter from markdown ([abffd022](../../commit/abffd022))
- add han parse command for JSON/YAML parsing ([3eb51d27](../../commit/3eb51d27))
- add AI-DLC 2026 methodology plugin ([ed938138](../../commit/ed938138))

### Fixed

- address shell injection and path traversal vulnerabilities ([e9d5a985](../../commit/e9d5a985))
- remove unused DAG_LIB_DIR variable ([0644f80b](../../commit/0644f80b))
- skip iteration advance on compact events ([7fbbc167](../../commit/7fbbc167))
- add shellcheck directive for dynamic source ([c4ec91a4](../../commit/c4ec91a4))
- use fully qualified names in command Name sections ([d5687c8e](../../commit/d5687c8e))
- add required sections to command files for claudelint ([bc3b10b1](../../commit/bc3b10b1))
- set needsAdvance flag in /advance command ([828185bf](../../commit/828185bf))
- move iteration increment to SessionStart hook ([5d6ad356](../../commit/5d6ad356))
- add instruction for no-file-change turns ([7d749d66](../../commit/7d749d66))
- use wildcard dependency for enforce-iteration hook ordering ([04a7f193](../../commit/04a7f193))
- complete remaining review items ([cd873817](../../commit/cd873817))
- address Claude review feedback ([8bd72302](../../commit/8bd72302))
- address CI warnings and review feedback ([c7c4bb80](../../commit/c7c4bb80))

### Changed

- group --check output by phase, rename hooks to convention ([67e678aa](../../commit/67e678aa))

### Other

- ai dlc fixes ([1546f13a](../../commit/1546f13a))
- add critical no-questions rule to construct command ([e4ce26a8](../../commit/e4ce26a8))

## [1.0.0] - 2026-01-30

### Added

- add yaml-set command for frontmatter updates ([dd543889](../../commit/dd543889))
- add parallel bolt orchestration with git worktrees ([33cc61cf](../../commit/33cc61cf))
- auto-extract frontmatter from markdown ([abffd022](../../commit/abffd022))
- add han parse command for JSON/YAML parsing ([3eb51d27](../../commit/3eb51d27))
- add AI-DLC 2026 methodology plugin ([ed938138](../../commit/ed938138))

### Fixed

- address shell injection and path traversal vulnerabilities ([e9d5a985](../../commit/e9d5a985))
- remove unused DAG_LIB_DIR variable ([0644f80b](../../commit/0644f80b))
- skip iteration advance on compact events ([7fbbc167](../../commit/7fbbc167))
- add shellcheck directive for dynamic source ([c4ec91a4](../../commit/c4ec91a4))
- use fully qualified names in command Name sections ([d5687c8e](../../commit/d5687c8e))
- add required sections to command files for claudelint ([bc3b10b1](../../commit/bc3b10b1))
- set needsAdvance flag in /advance command ([828185bf](../../commit/828185bf))
- move iteration increment to SessionStart hook ([5d6ad356](../../commit/5d6ad356))
- add instruction for no-file-change turns ([7d749d66](../../commit/7d749d66))
- use wildcard dependency for enforce-iteration hook ordering ([04a7f193](../../commit/04a7f193))
- complete remaining review items ([cd873817](../../commit/cd873817))
- address Claude review feedback ([8bd72302](../../commit/8bd72302))
- address CI warnings and review feedback ([c7c4bb80](../../commit/c7c4bb80))

### Changed

- group --check output by phase, rename hooks to convention ([67e678aa](../../commit/67e678aa))

### Other

- add critical no-questions rule to construct command ([e4ce26a8](../../commit/e4ce26a8))

### Added

- Initial release of AI-DLC 2026 methodology plugin
- User commands: `/elaborate`, `/construct`, `/reset`
- Internal commands: `/advance`, `/fail`, `/done`
- Hat-based workflow: elaborator → planner → builder → reviewer
- SessionStart hook for context injection
- Stop hook for iteration enforcement
- State persistence via `han keep` (branch scope)
- Skills:
  - `ai-dlc-fundamentals` - Core principles
  - `ai-dlc-completion-criteria` - Writing effective criteria
  - `ai-dlc-mode-selection` - HITL/OHOTL/AHOTL decision framework
  - `ai-dlc-backpressure` - Quality gates and enforcement
  - `ai-dlc-blockers` - Proper blocker documentation
- Support for custom workflows via `.ai-dlc/hats.yml`
