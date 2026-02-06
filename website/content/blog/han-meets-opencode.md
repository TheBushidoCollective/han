---
title: "Han Meets OpenCode: One Plugin Ecosystem, Any AI Coding Tool"
description: "Han's validation pipeline now works in OpenCode. Same plugins, same hooks, same quality gates - different runtime."
date: "2026-02-06"
author: "The Bushido Collective"
tags: ["han", "opencode", "bridge", "validation", "hooks", "compatibility"]
category: "Announcements"
---

Han was built for Claude Code. The hook system, the validation pipeline, the plugin ecosystem - all designed around Claude Code's event lifecycle.

But the principles behind Han aren't Claude Code-specific. Validating code after every edit. Running linters automatically. Catching type errors before they compound. These are universal needs. The AI-DLC methodology paper said it directly: "The principles transfer; the implementation details vary."

Today, those principles transfer to [OpenCode](https://opencode.ai).

## The Problem

If you use OpenCode, you've had two options for automated validation:

1. **Write your own hooks.** OpenCode has a plugin system. You can write JavaScript that runs after tool executions. But you're starting from scratch - no ecosystem, no community plugins, no shared infrastructure.

2. **Do without.** Skip validation entirely and hope the agent writes correct code.

Neither is great. The OpenCode plugin ecosystem is young. The community is building, but validated, production-ready validation plugins take time.

Meanwhile, Han has 21 validation plugins, covering biome, eslint, prettier, typescript, clippy, pylint, rubocop, shellcheck, and more. All with smart caching, file filtering, and dependency resolution. All battle-tested in production Claude Code workflows.

## The Bridge

The new `opencode-plugin-han` package bridges the gap. It's an OpenCode plugin that reads Han's plugin definitions and executes them natively inside OpenCode's runtime.

Setup is three lines:

```bash
curl -fsSL https://han.guru/install.sh | bash
han plugin install --auto
```

```json
{
  "plugin": ["opencode-plugin-han"]
}
```

Your Han plugins now work in OpenCode. No changes to plugin configs. No rewriting hooks. Same `han-plugin.yml` definitions, different execution engine.

## How It Actually Works

The bridge does something fundamentally different from Han's Claude Code integration. In Claude Code, hooks are shell commands that run as separate processes. Output goes to stdout, which Claude sees as conversation messages. It works, but it's fire-and-forget.

In OpenCode, the bridge runs hooks as **awaited promises** with structured result collection. Here's the flow for PostToolUse validation - the primary path:

```text
Agent edits src/app.ts via edit tool
  |
  v
OpenCode fires tool.execute.after
  |
  v
Bridge reads installed plugins' han-plugin.yml files
Finds PostToolUse hooks matching:
  - Tool: Edit (matches tool_filter: [Edit, Write, NotebookEdit])
  - File: src/app.ts (matches file_filter: ["**/*.{ts,tsx}"])
  - Dir: has biome.json (matches dirs_with: ["biome.json"])
  |
  v
Runs matching hooks in parallel:
  - biome lint-async: npx biome check src/app.ts
  - eslint lint-async: npx eslint src/app.ts
  - typescript typecheck: npx tsc --noEmit --isolatedModules src/app.ts
  |
  v
Collects results (exit code, stdout, stderr, duration)
  |
  v
Delivers feedback:
  1. Mutates tool output (agent sees errors inline)
  2. Sends notification via client.session.prompt()
```

The agent sees structured validation results:

```xml
<han-validation plugin="biome" hook="lint-async" status="failed">
src/app.ts:10:5 lint/correctness/noUnusedVariables
  This variable is unused.
</han-validation>
```

It knows what failed, which plugin caught it, and exactly what to fix.

## PostToolUse: The Real Validation Story

If you've read our other posts, you might expect the Stop hook to be the star. It's not. Not anymore.

Han's validation model has evolved. The primary validation path is now **PostToolUse** - per-file, in-the-loop validation that runs after every edit. Here's why:

**Stop hooks** run when the agent finishes. By that point, the agent might have made twenty edits with cascading errors. Each error compounds. Fix one, create two more.

**PostToolUse hooks** run after each edit. The agent gets immediate feedback: "this file has a lint error." It fixes the error before making the next edit. Errors don't compound. The agent stays on track.

This is the pattern across Han's validation plugins:

```yaml
hooks:
  # Stop: full project validation (secondary)
  lint:
    command: "npx biome check --write ${HAN_FILES}"
    if_changed: ["**/*.{ts,tsx}"]

  # PostToolUse: per-file validation (primary)
  lint-async:
    event: PostToolUse
    command: "npx biome check --write ${HAN_FILES}"
    tool_filter: [Edit, Write, NotebookEdit]
    file_filter: ["**/*.{ts,tsx}"]
```

The OpenCode bridge implements both paths. PostToolUse hooks fire on `tool.execute.after`. Stop hooks fire on `session.idle` and the `stop` handler. But the PostToolUse path is where the value is.

## What's Different About OpenCode

OpenCode's plugin system has capabilities that Claude Code doesn't:

**Tool output mutation.** When `tool.execute.after` fires, the bridge can modify the tool's output before the agent sees it. Lint errors get appended directly to the edit result. No separate message, no context switch - the agent reads its edit result and sees the errors inline.

**Programmatic session control.** The bridge can call `client.session.prompt()` to inject messages or re-prompt the agent. When Stop hooks fail, the bridge doesn't just report errors - it sends a new prompt that forces the agent to fix them.

**In-process execution.** Claude Code hooks spawn shell processes. The OpenCode bridge runs as TypeScript inside Bun, with direct access to the OpenCode SDK. No process overhead, no stdin/stdout serialization.

## What You Lose (For Now)

The bridge doesn't implement everything Han does in Claude Code:

- **Hook caching**: Han's content-hash caching skips hooks when files haven't changed. The bridge runs hooks on every match. This is a deliberate simplification - caching adds complexity and the per-file PostToolUse hooks are fast enough.

- **Checkpoint filtering**: Han tracks which files a specific session modified and only validates those. The bridge validates all matching files. Multi-session isolation isn't implemented yet.

- **MCP tool events**: OpenCode doesn't fire `tool.execute.after` for MCP tool calls ([opencode#2319](https://github.com/sst/opencode/issues/2319)). This is an OpenCode limitation, not a bridge limitation.

- **Subagent hooks**: OpenCode doesn't have SubagentStart/SubagentStop equivalents.

These are trade-offs, not blockers. The core value - automated validation on every edit - works today.

## Technique Over Tools

Han started as a Claude Code plugin system. It's becoming something more: a portable validation infrastructure for AI coding tools.

The same `han-plugin.yml` that defines a biome PostToolUse hook for Claude Code now works in OpenCode. No modification. No compatibility shims. The bridge reads the definition and executes the command.

This is what the AI-DLC methodology means by "technique over tools." The pattern - validate after every edit, run hooks as promises, structure results for the agent - is the same regardless of which AI tool runs the code. Claude Code does it via shell hooks. OpenCode does it via a TypeScript bridge. The validation happens either way.

If you're using OpenCode, try it. If you're building plugins for Han, know that your work now reaches two ecosystems instead of one.

---

*Setup: [Using Han with OpenCode](/docs/installation/opencode) | Source: [plugins/bridges/opencode](https://github.com/TheBushidoCollective/han/tree/main/plugins/bridges/opencode) | Issue: [#58](https://github.com/TheBushidoCollective/han/issues/58)*
