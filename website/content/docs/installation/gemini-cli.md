---
title: "Using Han with Gemini CLI"
description: "How to use Han's validation pipeline and plugin ecosystem with Gemini CLI using the bridge extension."
---

Han works with [Gemini CLI](https://geminicli.com) through a bridge extension that translates Gemini CLI's hook events into Han hook invocations. Your existing Han plugins - validation, context injection, skills, disciplines - work in Gemini CLI without modification.

## How It Works

Gemini CLI uses an extension system with JSON-based hooks. The Han bridge extension registers hooks for each lifecycle event and runs Han's validation pipeline:

1. **AfterTool hooks** → **PostToolUse validation** (biome, eslint, tsc per-file checks)
2. **AfterAgent hooks** → **Stop validation** (full project lint, typecheck, tests)
3. **BeforeTool hooks** → **PreToolUse gates** (pre-execution validation)
4. **GEMINI.md** → **Core guidelines** (professional honesty, no excuses, skill selection)
5. **BeforeAgent hooks** → **Datetime injection** (current time on every agent turn)

```text
Agent edits src/app.ts via write_file
  -> Gemini CLI fires AfterTool hook
  -> Bridge maps write_file -> Write
  -> Matches PostToolUse hooks (biome, eslint, tsc)
  -> Runs hooks in parallel, collects results
  -> Returns JSON with validation errors
  -> Agent sees errors and fixes them
```

## Setup

### 1. Install Han and plugins

```bash
curl -fsSL https://han.guru/install.sh | bash
han plugin install --auto
```

### 2. Install Bun (required)

The bridge scripts require [Bun](https://bun.sh) as the TypeScript runtime:

```bash
curl -fsSL https://bun.sh/install | bash
```

### 3. Install the Gemini CLI extension

Use the install script to set up the extension:

```bash
# If han is installed, find the plugin path
bash "$(han plugin path gemini-cli)/install.sh"
```

Or install directly from the Han repository:

```bash
git clone --depth 1 https://github.com/TheBushidoCollective/han.git /tmp/han
bash /tmp/han/plugins/bridges/gemini-cli/install.sh /tmp/han/plugins/bridges/gemini-cli
rm -rf /tmp/han
```

The install script copies the extension to `~/.gemini/extensions/han/` and configures the Gemini CLI hooks.

Verify the extension is installed:

```bash
gemini extensions list
```

That's it. Your Han plugins now work in Gemini CLI.

## Coverage Matrix

The bridge maps Claude Code's hook events to Gemini CLI's extension hooks:

| Claude Code Hook | Gemini CLI Equivalent | Status | Notes |
|---|---|---|---|
| **PostToolUse** | `AfterTool` | Implemented | Primary validation — per-file linting/formatting |
| **PreToolUse** | `BeforeTool` | Implemented | Pre-execution gates, can deny tool execution |
| **Stop** | `AfterAgent` | Implemented | Full project validation, blocks agent on failure |
| **SessionStart** | `SessionStart` | Implemented | Plugin discovery, coordinator start, capability summary |
| **UserPromptSubmit** | `BeforeAgent` | Implemented | Current datetime injected as additional context |
| **PreCompact** | `PreCompress` | Implemented | Event log flush before context compression |
| **Skills** | GEMINI.md context | Partial | Skills discovered and counted; use Gemini CLI's native skill system |
| **Disciplines** | GEMINI.md context | Partial | Disciplines discovered and counted |
| **Event Logging** | JSONL + coordinator | Implemented | Browse UI visibility for Gemini CLI sessions |
| SubagentStart/Stop | — | Not available | No Gemini CLI equivalent |
| MCP tool events | — | Not available | AfterTool doesn't fire for MCP tool calls |

## What Works

### AfterTool Validation (Primary)

The most important feature. When the agent edits a file, Han's per-file validation hooks fire:

| Plugin | What It Does |
|--------|-------------|
| `biome` | Lint and format JavaScript/TypeScript |
| `eslint` | JavaScript/TypeScript linting |
| `prettier` | Code formatting |
| `typescript` | Type checking |
| `clippy` | Rust linting |
| `pylint` | Python linting |

Results are returned as a `systemMessage` in the hook's JSON response, which Gemini CLI surfaces to the agent.

### BeforeTool Hooks (Pre-Execution Gates)

Run before a tool executes. Can return `decision: "deny"` to block dangerous operations. Enables:

- Pre-commit/pre-push validation gates
- Security checks on file operations
- Tool-specific restrictions

### AfterAgent Validation (Stop)

When the agent finishes a turn, broader project-level hooks run:

- Full project linting
- Type checking across the codebase
- Test suite execution

If issues are found, the bridge returns `decision: "block"` which forces Gemini CLI to give the agent another turn to fix the issues.

### SessionStart Context (Guidelines)

Core guidelines are provided via `GEMINI.md` (loaded automatically by Gemini CLI) and supplemented with dynamic session info via the SessionStart hook:

- **Professional honesty** — Verify claims before accepting them
- **No time estimates** — Use phase numbers and priority order instead
- **No excuses** — Own every issue (Boy Scout Rule)
- **Date handling** — Use injected datetime, never hardcode

### BeforeAgent Context (Datetime)

Current local datetime is injected on every agent turn via BeforeAgent's `additionalContext`, mirroring Claude Code's UserPromptSubmit hook.

## Gemini CLI Hook Protocol

The bridge communicates with Gemini CLI using the standard hook protocol:

- **Input** (stdin): JSON with `tool_name`, `tool_input`, `llm_request`, etc.
- **Output** (stdout): JSON with `decision`, `reason`, `systemMessage`, `hookSpecificOutput`
- **Logging** (stderr): All debug output goes to stderr

Exit codes:

- **0**: Success — Gemini CLI parses stdout JSON
- **2**: Critical block — Gemini CLI aborts the action
- **Other**: Warning — Gemini CLI continues unchanged

## How Plugins Stay Compatible

Han plugins don't need modification to work with Gemini CLI. The bridge reads the same `han-plugin.yml` files that Claude Code uses:

```yaml
# This config works in Claude Code, OpenCode, AND Gemini CLI
hooks:
  lint-async:
    event: PostToolUse
    command: "npx -y @biomejs/biome check --write ${HAN_FILES}"
    tool_filter: [Edit, Write, NotebookEdit]
    file_filter: ["**/*.{js,jsx,ts,tsx}"]
    dirs_with: ["biome.json"]
```

The bridge translates Gemini CLI tool names (snake_case) to Claude Code tool names (PascalCase):

| Gemini CLI Tool | Claude Code Equivalent |
|-----------------|----------------------|
| `write_file` | `Write` |
| `replace` | `Edit` |
| `run_shell_command` | `Bash` |
| `read_file` | `Read` |
| `list_directory` | `Glob` |
| `glob` | `Glob` |
| `search_file_content` | `Grep` |

## Architecture

```text
Gemini CLI Extension System
  |
  |-- SessionStart hook
  |     -> bun bridge.ts SessionStart
  |     -> Plugin discovery + coordinator start
  |     -> stdout: { "systemMessage": "Han bridge active..." }
  |
  |-- BeforeAgent hook
  |     -> bun bridge.ts BeforeAgent
  |     -> stdout: { "hookSpecificOutput": { "additionalContext": "Current time..." } }
  |
  |-- BeforeTool hook (matcher: *)
  |     -> bun bridge.ts BeforeTool
  |     -> PreToolUse hooks
  |     -> stdout: { "decision": "allow" } or { "decision": "deny", "reason": "..." }
  |
  |-- AfterTool hook (matcher: write_file|replace)
  |     -> bun bridge.ts AfterTool
  |     -> PostToolUse hooks (biome, eslint, tsc)
  |     -> stdout: { "systemMessage": "Validation errors..." } or {}
  |
  |-- AfterAgent hook
  |     -> bun bridge.ts AfterAgent
  |     -> Stop hooks (full project validation)
  |     -> stdout: { "decision": "block", "reason": "..." } or {}
  |
  |-- GEMINI.md ──────────> Core guidelines (loaded automatically)
  |
  |-- JSONL logger ───────> Browse UI visibility
        ~/.han/gemini-cli/projects/{slug}/
```

## Event Logging

The bridge writes Han-format JSONL events to `~/.han/gemini-cli/projects/`. Each event includes `provider: "gemini-cli"` to distinguish Gemini CLI sessions from Claude Code and OpenCode sessions.

On SessionStart, the bridge launches the Han coordinator in the background. The coordinator indexes events into SQLite and serves them through the Browse UI alongside Claude Code and OpenCode sessions.

## Remaining Gaps

These are genuine platform limitations that cannot be bridged:

- **MCP tool events**: Gemini CLI doesn't fire AfterTool for MCP server tool calls. Validation only runs for built-in tools.
- **Subagent hooks**: No Gemini CLI equivalent for SubagentStart/SubagentStop.
- **Persistent state**: Each hook invocation is a separate process. Plugin discovery runs on every invocation (fast, but not cached across invocations within a session).

## Next Steps

- [Install Han plugins](/docs/installation/plugins) for your project's languages and tools
- Read about [hook configuration](/docs/plugin-development/hooks) to understand what hooks do
- Check the [bridge source code](https://github.com/TheBushidoCollective/han/tree/main/plugins/bridges/gemini-cli) for implementation details
