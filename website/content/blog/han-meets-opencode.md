---
title: "Han Meets OpenCode: One Plugin Ecosystem, Any AI Coding Tool"
description: "Han's validation pipeline, core guidelines, skills, and disciplines now work in OpenCode. Same plugins, same quality gates - different runtime."
date: "2026-02-06"
author: "The Bushido Collective"
tags: ["han", "opencode", "bridge", "validation", "hooks", "skills", "disciplines", "compatibility"]
category: "Announcements"
---

Han was built for Claude Code. The hook system, the validation pipeline, the plugin ecosystem - all designed around Claude Code's event lifecycle.

But the principles behind Han aren't Claude Code-specific. Validating code after every edit. Running linters automatically. Catching type errors before they compound. Injecting quality guidelines into the agent's system prompt. Making 400+ coding skills available on demand. These are universal needs. The AI-DLC methodology paper said it directly: "The principles transfer; the implementation details vary."

Today, those principles transfer to [OpenCode](https://opencode.ai).

## The Problem

If you use OpenCode, you've had two options for automated validation:

1. **Write your own hooks.** OpenCode has a plugin system. You can write JavaScript that runs after tool executions. But you're starting from scratch - no ecosystem, no community plugins, no shared infrastructure.

2. **Do without.** Skip validation entirely and hope the agent writes correct code.

Neither is great. The OpenCode plugin ecosystem is young. The community is building, but validated, production-ready validation plugins take time.

Meanwhile, Han has 21 validation plugins, covering biome, eslint, prettier, typescript, clippy, pylint, rubocop, shellcheck, and more. All with smart caching, file filtering, and dependency resolution. All battle-tested in production Claude Code workflows.

Plus 400+ coding skills, 25 specialized agent disciplines, and core quality guidelines that improve agent output regardless of the underlying model.

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

## What The Bridge Covers

The bridge maps 9 of Claude Code's integration points to OpenCode equivalents:

| Feature | Claude Code | OpenCode Bridge |
|---|---|---|
| **PostToolUse** | `hooks.json` | `tool.execute.after` |
| **PreToolUse** | `hooks.json` | `tool.execute.before` |
| **Stop** | `hooks.json` | `stop` + `session.idle` |
| **SessionStart** | Context hooks | `experimental.chat.system.transform` |
| **UserPromptSubmit** | Datetime injection | `chat.message` |
| **SubagentPrompt** | PreToolUse (Task) | `tool.execute.before` (Task/agent) |
| **Skills** | MCP tools | `tool` registration (`han_skills`) |
| **Disciplines** | MCP tools | `tool` registration (`han_discipline`) |
| **Event Logging** | JSONL + coordinator | JSONL + coordinator |

That's not a partial port. That's the core value proposition running natively.

## How It Actually Works

The bridge does something fundamentally different from Han's Claude Code integration. In Claude Code, hooks are shell commands that run as separate processes. Output goes to stdout, which Claude sees as conversation messages. It works, but it's fire-and-forget.

In OpenCode, the bridge runs hooks as **awaited promises** with structured result collection.

### Validation: PostToolUse

The primary validation path. When the agent edits a file:

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

### Pre-Execution: PreToolUse

Before a tool runs, `tool.execute.before` fires. The bridge uses this for:

- Running PreToolUse hooks (validation gates for git commands, etc.)
- Injecting active discipline context into subagent/task tool prompts

### Quality Guidelines: SessionStart

Every LLM call receives Han's core guidelines via `experimental.chat.system.transform`:

- **Professional honesty** — verify claims before accepting them
- **No time estimates** — use phase numbers and priority order
- **No excuses** — own every issue you encounter (Boy Scout Rule)
- **Date handling** — use injected datetime, never hardcode
- **Skill selection** — review available skills before starting work

These are the same guidelines that make Claude Code sessions with Han measurably better. Now they apply to any model running in OpenCode.

### Datetime: UserPromptSubmit

Current local time is injected on every user message via `chat.message`. The agent always knows what time it is, just like in Claude Code sessions.

## Skills and Disciplines

Beyond validation, the bridge exposes Han's full knowledge infrastructure:

**400+ skills** registered as the `han_skills` tool. The LLM can search for skills matching its current task and load their full content on demand:

```text
han_skills({ action: "list", filter: "react" })
→ Lists React-related skills across all plugins

han_skills({ action: "load", skill: "react-hooks-patterns" })
→ Full SKILL.md content loaded into context
```

**25 agent disciplines** registered as the `han_discipline` tool. When activated, a discipline's expertise is injected into every subsequent LLM call:

```text
han_discipline({ action: "activate", discipline: "frontend" })
→ System prompt now includes frontend expertise context
```

Disciplines cover: frontend, backend, api, architecture, mobile, database, security, infrastructure, SRE, performance, accessibility, quality, documentation, and more.

## PostToolUse: The Real Validation Story

If you've read our other posts, you might expect the Stop hook to be the star. It's not. Not anymore.

Han's validation model has evolved. The primary validation path is now **PostToolUse** - per-file, in-the-loop validation that runs after every edit. Here's why:

**Stop hooks** run when the agent finishes. By that point, the agent might have made twenty edits with cascading errors. Each error compounds. Fix one, create two more.

**PostToolUse hooks** run after each edit. The agent gets immediate feedback: "this file has a lint error." It fixes the error before making the next edit. Errors don't compound. The agent stays on track.

The OpenCode bridge implements both paths. PostToolUse hooks fire on `tool.execute.after`. Stop hooks fire on `session.idle` and the `stop` handler. But the PostToolUse path is where the value is.

## What's Different About OpenCode

OpenCode's plugin system has capabilities that Claude Code doesn't:

**Tool output mutation.** When `tool.execute.after` fires, the bridge can modify the tool's output before the agent sees it. Lint errors get appended directly to the edit result. No separate message, no context switch - the agent reads its edit result and sees the errors inline.

**Programmatic session control.** The bridge can call `client.session.prompt()` to inject messages or re-prompt the agent. When Stop hooks fail, the bridge doesn't just report errors - it sends a new prompt that forces the agent to fix them.

**In-process execution.** Claude Code hooks spawn shell processes. The OpenCode bridge runs as TypeScript inside Bun, with direct access to the OpenCode SDK. No process overhead, no stdin/stdout serialization.

## What You Lose (For Now)

Three genuine platform gaps remain:

- **MCP tool events**: OpenCode doesn't fire `tool.execute.after` for MCP tool calls ([opencode#2319](https://github.com/sst/opencode/issues/2319)). If you use MCP servers that write files, those edits won't trigger validation. This is an OpenCode limitation, not a bridge limitation.

- **Subagent hooks**: OpenCode doesn't have SubagentStart/SubagentStop equivalents. The bridge works around this by injecting discipline context into task/agent tool prompts via `tool.execute.before`, but it can't track subagent lifecycle.

- **Permission denial**: OpenCode's `tool.execute.before` cannot block tool execution. In Claude Code, PreToolUse hooks can deny a tool call. In OpenCode, they can only warn.

These are trade-offs, not blockers. The core value - automated validation on every edit, quality guidelines in every prompt, 400+ skills on demand - works today.

## Technique Over Tools

Han started as a Claude Code plugin system. It's becoming something more: a portable quality infrastructure for AI coding tools.

The same `han-plugin.yml` that defines a biome PostToolUse hook for Claude Code now works in OpenCode. The same core guidelines that prevent sloppy agent behavior in Claude Code now apply in OpenCode. The same 400+ skills and 25 disciplines that make Claude sessions productive now make OpenCode sessions productive.

No modification. No compatibility shims. The bridge reads the definitions and executes them.

This is what the AI-DLC methodology means by "technique over tools." The pattern - validate after every edit, inject quality guidelines, make expertise discoverable - is the same regardless of which AI tool runs the code. Claude Code does it via shell hooks. OpenCode does it via a TypeScript bridge. The quality happens either way.

If you're using OpenCode, try it. If you're building plugins for Han, know that your work now reaches two ecosystems instead of one.

---

*Setup: [Using Han with OpenCode](/docs/installation/opencode) | Source: [plugins/bridges/opencode](https://github.com/TheBushidoCollective/han/tree/main/plugins/bridges/opencode) | Issue: [#58](https://github.com/TheBushidoCollective/han/issues/58)*
