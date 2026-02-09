---
title: "Han Meets Kiro: Validation Hooks for AWS's Agentic CLI"
description: "Han's validation pipeline, core guidelines, and hook ecosystem now work in Kiro CLI. Same plugins, same quality gates - three runtimes."
date: "2026-02-08"
author: "The Bushido Collective"
tags: ["han", "kiro", "bridge", "validation", "hooks", "compatibility"]
category: "Announcements"
---

Two days after shipping the OpenCode bridge, Han now supports [Kiro CLI](https://kiro.dev/cli/) - AWS's agentic coding tool.

Same plugins. Same hooks. Third runtime.

## Why Kiro

Kiro is interesting for a specific reason: its hook system is closer to Claude Code's than OpenCode's.

Claude Code hooks are shell commands that receive JSON via stdin. Kiro hooks are shell commands that receive JSON via stdin. The event names differ (`agentSpawn` vs `SessionStart`, `fs_write` vs `Write`), but the execution model is the same.

This matters because it means Kiro gets a capability that OpenCode can't have: **PreToolUse blocking**.

## Exit Code 2

Kiro's hook system has a feature that OpenCode lacks. When a `preToolUse` hook exits with code 2, Kiro **blocks the tool call** and sends stderr to the LLM as the reason.

This is the same capability as Claude Code's `permissionDecision: "deny"` but expressed through exit codes instead of JSON. The Han bridge uses this to enforce validation gates:

```text
Agent about to run: execute_bash "rm -rf /"
  -> Kiro fires preToolUse hook
  -> Bridge runs Han PreToolUse hooks
  -> Hook exits with code 2, stderr: "Blocked: destructive command"
  -> Kiro blocks the tool call
  -> Agent sees the reason and adjusts
```

In the OpenCode bridge, PreToolUse hooks can only warn. In Kiro, they can block. This closes a gap we noted in the OpenCode announcement.

## Shell-Based, Not In-Process

The OpenCode bridge runs as a TypeScript plugin inside OpenCode's runtime. It hooks into events programmatically, mutates tool outputs directly, and calls `client.session.prompt()` for async notifications.

The Kiro bridge is different. It's a CLI tool that Kiro hooks call:

```json
{
  "hooks": {
    "postToolUse": [{
      "matcher": "fs_write",
      "command": "npx -y kiro-plugin-han post-tool-use"
    }]
  }
}
```

Each hook invocation:

1. Starts the bridge process
2. Reads JSON from stdin (Kiro's hook payload)
3. Maps Kiro tool names to Claude Code names (`fs_write` → `Write`)
4. Discovers and runs matching Han hooks
5. Outputs results to stdout
6. Exits with appropriate code

This is closer to how Han works in Claude Code itself. Shell commands, stdio, exit codes. The lingua franca of Unix.

## Tool Name Translation

Kiro uses its own internal tool names:

| Kiro | Claude Code | What It Does |
|------|------------|--------------|
| `fs_write` | `Write` / `Edit` | Edit files |
| `fs_read` | `Read` | Read files |
| `execute_bash` | `Bash` | Run commands |
| `glob` | `Glob` | Find files |
| `grep` | `Grep` | Search content |

The bridge maps these automatically. Han hooks define `tool_filter: [Edit, Write]` in Claude Code terms. The bridge translates `fs_write` to `Write` before matching.

## Coverage

The Kiro bridge maps 7 of Claude Code's integration points:

| Feature | Claude Code | Kiro Bridge |
|---|---|---|
| **PostToolUse** | `hooks.json` | `postToolUse` hook |
| **PreToolUse** | `hooks.json` | `preToolUse` hook (with blocking) |
| **Stop** | `hooks.json` | `stop` hook |
| **SessionStart** | Context hooks | `agentSpawn` hook |
| **UserPromptSubmit** | Datetime injection | `userPromptSubmit` hook |
| **Permission denial** | `permissionDecision: "deny"` | Exit code 2 |
| **Event Logging** | JSONL + coordinator | JSONL + coordinator |

The main gap compared to the OpenCode bridge: Skills and Disciplines aren't registered as tools (Kiro hooks are shell commands, not tool registration APIs). They're still discovered and their context is injected, but the LLM can't call `han_skills` or `han_discipline` interactively. That's planned for a future release via a Kiro MCP server.

## Three Runtimes, One Ecosystem

Han plugins now work across three AI coding tools:

1. **Claude Code** — Native integration via `hooks.json` and MCP
2. **OpenCode** — In-process JS bridge with tool output mutation
3. **Kiro CLI** — Shell-based CLI bridge with exit code blocking

The same `han-plugin.yml` that defines a biome PostToolUse hook works in all three. No modification. No compatibility shims. The bridge reads the definitions and executes them.

```yaml
# Works everywhere
hooks:
  lint-async:
    event: PostToolUse
    command: "npx -y @biomejs/biome check --write ${HAN_FILES}"
    tool_filter: [Edit, Write, NotebookEdit]
    file_filter: ["**/*.{js,jsx,ts,tsx}"]
    dirs_with: ["biome.json"]
```

## Getting Started

```bash
# Install Han
curl -fsSL https://han.guru/install.sh | bash
han plugin install --auto

# Add the Kiro agent
mkdir -p ~/.kiro/agents
curl -fsSL https://raw.githubusercontent.com/TheBushidoCollective/han/main/plugins/bridges/kiro/kiro-agent.json \
  -o ~/.kiro/agents/han.json

# Start coding
kiro-cli chat --agent han
```

---

*Setup: [Using Han with Kiro CLI](/docs/installation/kiro) | Source: [plugins/bridges/kiro](https://github.com/TheBushidoCollective/han/tree/main/plugins/bridges/kiro)*
