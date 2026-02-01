---
title: "Why Han Plugins? The Difference Is Night and Day"
description: "Standard Claude Code plugins work. Han plugins work intelligently. Here's why that distinction matters for your AI-assisted development workflow."
date: "2026-01-30"
author: "The Bushido Collective"
tags: ["han", "plugins", "claude-code", "developer-experience"]
category: "Announcements"
---

Claude Code has a plugin system. It works. You can add skills, commands, MCP servers, and hooks.

So why Han?

Because there's a difference between "works" and "works well." Standard plugins are fire-and-forget. Han plugins are intelligent infrastructure. Here's what that means in practice.

## The Resource Problem

Standard Claude Code hooks run on every Stop event. Every. Single. Time.

```yaml
# Standard plugin hook
hooks:
  Stop:
    - command: "eslint ."      # All files. Every time.
    - command: "tsc --noEmit"  # Full typecheck. Every time.
    - command: "jest"          # All tests. Every time.
```

Change one line? Wait two minutes while your entire codebase gets linted, typechecked, and tested.

Han hooks understand context:

```yaml
# Han plugin hook
hooks:
  lint:
    command: "eslint ${HAN_FILES}"
    if_changed: ["**/*.ts"]
    dirs_with: ["eslint.config.js"]
```

**`${HAN_FILES}`** passes only changed files. **`if_changed`** skips the hook entirely if no TypeScript changed. **`dirs_with`** skips if there's no ESLint config in the directory.

Same change, same codebase. Seven seconds instead of two minutes.

And if you run it again with no new changes? Zero seconds. Han caches results and skips hooks when file hashes haven't changed.

## Hook Dependencies That Actually Work

Standard hooks run in definition order. If your formatter and linter both fire, you might lint unformatted code. If your tests depend on a build step, you hope they're defined in the right order.

Han has explicit dependency resolution:

```yaml
hooks:
  format:
    command: "biome format --write ${HAN_FILES}"

  lint:
    command: "biome check ${HAN_FILES}"
    depends_on:
      - plugin: biome
        hook: format  # Always runs AFTER formatting

  test:
    command: "bun test --findRelatedTests ${HAN_FILES}"
    depends_on:
      - plugin: "*"
        hook: "*"  # Runs after ALL other hooks
```

Phase-based ordering means formatters run before linters, linters before typecheckers, typecheckers before tests. Automatically.

Optional dependencies mean your hook won't fail if a plugin isn't installed:

```yaml
depends_on:
  - plugin: prettier
    hook: format
    optional: true  # Skip gracefully if Prettier not installed
```

## Subagent Context Injection

This one is Han-only. There's no equivalent in standard Claude Code.

When Claude spawns a subagent via the Task tool, that subagent starts fresh. It doesn't know your project rules, your current workflow state, or what it's supposed to do when it finishes. You have to repeat everything in the prompt.

Han intercepts Task tool calls and automatically injects context:

```xml
<subagent-context>
## AI-DLC Subagent Context

**Iteration:** 2 | **Role:** builder | **Workflow:** default

### Intent
Build the authentication system...

### Current Plan
1. Create JWT middleware
2. Add login endpoint
3. Write integration tests

### Workflow Rules
- **Worktree:** /tmp/ai-dlc-auth-system/
- **Branch:** ai-dlc/auth/02-jwt-middleware
- Before stopping: commit changes, save scratchpad
</subagent-context>
```

Every subagent automatically knows:

- What it's building and why
- What branch to work on
- What to do before stopping
- How to communicate status

This is how Han's autonomous construction loop works. Subagents don't lose context between spawns because context is injected at the infrastructure level.

## Validation Without Exhaustion

Standard plugins treat validation as an afterthought. Run everything, hope it's fast enough.

Han treats validation as a first-class concern:

**Checkpoint filtering**: Only validate files changed since the last checkpoint, not the entire session history.

**Smart caching**: Store validation results keyed by file content hash. Same file, same result, zero compute.

**Fail-fast by default**: First hook failure stops the cascade. Don't waste time running tests if linting failed.

**Parallel execution**: Independent hooks run concurrently. Dependent hooks wait their turn.

The result: continuous validation that doesn't make Claude unusable. You get quality gates without the wait.

## Plugins That Coordinate

Standard plugins are islands. Each one does its thing, unaware of the others.

Han plugins are an ecosystem:

**Semantic categories** tell Claude what each plugin does:

- **Language/Validation plugins**: Skills and validation for languages/tools
- **Discipline plugins**: Specialized agents for domains
- **Integration plugins**: MCP integrations to external services

**Cross-plugin dependencies** let hooks reference each other by name, not hoping they're in the right order.

**Shared memory** means learnings from one session inform the next. Plugins can query what's been learned, what's been tried, what works.

## The Ecosystem Is Now Open

Today, we're opening Han to third-party plugins.

Build your own validation plugin for your internal linter. Create a discipline agent for your compliance workflow. Ship an integration plugin to connect your internal APIs.

You get all of Han's intelligent infrastructure:

- Resource-efficient hooks with `if_changed` and caching
- Dependency resolution and phase ordering
- Subagent context injection
- Cross-plugin coordination
- Shared memory

Your plugins work alongside the marketplace plugins. Same orchestration. Same efficiency. Same quality gates.

---

*Ready to build? Check the [Plugin Development Guide](/docs/plugin-development) or run `han create plugin` to scaffold your first plugin.*
