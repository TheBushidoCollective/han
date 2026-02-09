# Han Bridge for Gemini CLI

Bridge extension that brings Han's full plugin ecosystem to [Gemini CLI](https://geminicli.com) — validation hooks, core guidelines, 400+ skills, and 25 agent disciplines.

## What This Does

Han plugins define validation hooks, specialized skills, and agent disciplines that run during Claude Code sessions. This bridge makes the entire ecosystem work in Gemini CLI:

1. **Hooks** — PreToolUse, PostToolUse, and Stop validation (biome, eslint, tsc, etc.) with parallel execution
2. **Guidelines** — Core principles (professional honesty, no excuses, skill selection) injected via GEMINI.md
3. **Datetime** — Current time injected on every agent turn via BeforeAgent
4. **Events** — Unified JSONL logging with `provider: "gemini-cli"` for Browse UI visibility

## Coverage Matrix

| Claude Code Hook | Gemini CLI Equivalent | Status |
|---|---|---|
| PostToolUse | `AfterTool` | Implemented |
| PreToolUse | `BeforeTool` | Implemented |
| Stop | `AfterAgent` | Implemented |
| SessionStart | `SessionStart` | Implemented |
| UserPromptSubmit | `BeforeAgent` | Implemented |
| PreCompact | `PreCompress` | Implemented |
| SubagentStart/Stop | — | Not available |
| Permission denial | `BeforeTool` decision:"deny" | Implemented |
| MCP tool events | — | Not available |

## Validation Flow

### AfterTool (Primary Validation Path)

When the agent edits a file:

```
Agent edits src/app.ts via write_file
  -> Gemini CLI fires AfterTool hook
  -> Bridge maps write_file -> Write (Claude Code name)
  -> Matches PostToolUse hooks (biome, eslint, tsc)
  -> Runs hooks in parallel
  -> Returns JSON with systemMessage containing validation errors
  -> Agent sees errors and fixes them
```

### AfterAgent (Stop Validation)

When the agent finishes a turn:

```
Agent signals completion
  -> Gemini CLI fires AfterAgent hook
  -> Bridge runs Stop hooks (full project lint, typecheck, tests)
  -> If failures: returns decision:"block" to force continuation
  -> Agent gets another turn to fix project-wide issues
```

### BeforeTool (Pre-Execution Gates)

Before a tool executes:

```
Agent about to run a tool
  -> Gemini CLI fires BeforeTool hook
  -> Bridge matches PreToolUse hooks
  -> If any hook rejects: returns decision:"deny"
  -> Tool execution is blocked
```

## Setup

### Prerequisites

Han plugins must be installed:

```bash
curl -fsSL https://han.guru/install.sh | bash
han plugin install --auto
```

[Bun](https://bun.sh) is required for running the bridge scripts.

### Install the Extension

Use the install script to set up the Gemini CLI extension:

```bash
# From the han repo
bash plugins/bridges/gemini-cli/install.sh

# Or clone and install
git clone --depth 1 https://github.com/TheBushidoCollective/han.git /tmp/han
bash /tmp/han/plugins/bridges/gemini-cli/install.sh /tmp/han/plugins/bridges/gemini-cli
rm -rf /tmp/han
```

The install script copies the extension to `~/.gemini/extensions/han/` and sets up the correct hooks configuration for Gemini CLI.

Verify installation:

```bash
gemini extensions list
# Should show "han" extension
```

**Note:** The source repository stores Gemini CLI hooks in `gemini-hooks.json` (not `hooks/hooks.json`) to avoid conflicts with Claude Code's plugin validation. The install script places them at the correct `hooks/hooks.json` path that Gemini CLI expects.

## Architecture

```
Gemini CLI Hook System
  |
  |-- SessionStart ──────────────> Plugin discovery + coordinator start
  |     hooks/hooks.json            -> systemMessage with capability summary
  |
  |-- BeforeAgent ───────────────> Datetime injection
  |     hooks/hooks.json            -> additionalContext with current time
  |
  |-- BeforeTool (matcher: *) ───> PreToolUse hooks
  |     hooks/hooks.json            -> decision:"deny" if validation fails
  |
  |-- AfterTool (matcher: write_file|edit_file|...) ──> PostToolUse hooks
  |     hooks/hooks.json            -> systemMessage with validation errors
  |
  |-- AfterAgent ────────────────> Stop hooks (full project validation)
  |     hooks/hooks.json            -> decision:"block" if failures
  |
  |-- GEMINI.md ─────────────────> Core guidelines context
  |     (loaded automatically)       (professional honesty, no excuses, etc.)
  |
  |-- JSONL event logger ────────> Browse UI visibility
        ~/.han/gemini-cli/projects/   (provider="gemini-cli")

Bridge Internals (src/):
  bridge.ts        Entry point (stdin JSON → handler → stdout JSON)
  discovery.ts     Read settings + marketplace + resolve plugin paths
  matcher.ts       Filter by tool name, file globs, dirsWith
  executor.ts      Spawn hook commands as parallel promises
  formatter.ts     Structure results as Gemini CLI JSON responses
  cache.ts         Content-hash caching (SHA-256)
  context.ts       Session context + datetime injection
  skills.ts        Skill discovery (counting)
  disciplines.ts   Discipline discovery (counting)
  events.ts        JSONL event logger (provider="gemini-cli")
  types.ts         Gemini CLI + Han type definitions
```

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

The difference is in who executes the hook:

- **Claude Code**: Reads `hooks.json`, calls han hook run via shell
- **OpenCode**: Bridge reads `han-plugin.yml`, runs command as JS promise
- **Gemini CLI**: Bridge reads `han-plugin.yml`, runs command as child process, returns JSON

Same hook definition. Same validation. Different runtime.

## Gemini CLI Hook Protocol

Gemini CLI hooks communicate via stdin/stdout JSON:

- **Input** (stdin): `{ "tool_name": "write_file", "tool_input": { "path": "src/app.ts", ... } }`
- **Output** (stdout): `{ "decision": "allow" }` or `{ "systemMessage": "Validation errors..." }`
- **Logging** (stderr): All debug output goes to stderr (stdout is reserved for JSON)

Exit codes:
- **0**: Success — Gemini CLI parses stdout JSON
- **2**: Critical block — Gemini CLI aborts the action
- **Other**: Warning — Gemini CLI continues unchanged

## Event Logging

The bridge writes Han-format JSONL events to `~/.han/gemini-cli/projects/`. Each event includes `provider: "gemini-cli"` to distinguish Gemini CLI sessions from Claude Code and OpenCode sessions.

On SessionStart, the bridge launches the Han coordinator in the background. The coordinator watches the events directory and indexes events into SQLite, making them visible in the Browse UI.

## Remaining Gaps

- **MCP tool events**: Gemini CLI doesn't fire AfterTool for MCP server tool calls. Validation only runs for built-in tools.
- **Subagent hooks**: No Gemini CLI equivalent for SubagentStart/SubagentStop.
- **Persistent state**: Each hook invocation is a separate process. Plugin discovery runs on every invocation (fast but not cached across invocations).

## Development

```bash
# From the han repo root
cd plugins/bridges/gemini-cli

# The bridge uses TypeScript directly (Bun handles it)
# No build step required
```

## License

Apache-2.0
