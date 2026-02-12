# Han Bridge for Kiro CLI

Bridge plugin that brings Han's full plugin ecosystem to [Kiro CLI](https://kiro.dev/cli/) — validation hooks, core guidelines, skills, and disciplines.

## What This Does

Han plugins define validation hooks, specialized skills, and agent disciplines that run during Claude Code sessions. This bridge makes the entire ecosystem work in Kiro CLI:

1. **Hooks** — PreToolUse, PostToolUse, and Stop validation (biome, eslint, tsc, etc.) with parallel execution
2. **Guidelines** — Core principles (professional honesty, no excuses, skill selection) injected on agent spawn
3. **Datetime** — Current time injected on every user prompt
4. **PreToolUse blocking** — Exit code 2 blocks tool execution per Kiro convention
5. **Events** — Unified JSONL logging with `provider: "kiro"` for Browse UI visibility

## Coverage Matrix

| Claude Code Hook | Kiro CLI Equivalent | Status |
|---|---|---|
| PostToolUse | `postToolUse` hook | Implemented |
| PreToolUse | `preToolUse` hook | Implemented |
| Stop | `stop` hook | Implemented |
| SessionStart | `agentSpawn` hook | Implemented |
| UserPromptSubmit | `userPromptSubmit` hook | Implemented |
| Event Logging | JSONL + coordinator | Implemented |
| SubagentStart/Stop | — | Not available |
| MCP tool events | `@mcp/tool` matchers | Partial (Kiro supports MCP matchers) |
| Permission denial | Exit code 2 | Implemented (Kiro native) |

## Key Difference from OpenCode Bridge

The OpenCode bridge is an **in-process JS plugin** that hooks into OpenCode's runtime. The Kiro bridge is a **CLI tool** that Kiro hooks call as shell commands.

This is because Kiro's hook system is shell-based (like Claude Code), not plugin-based (like OpenCode). Each Kiro hook calls `npx kiro-plugin-han <event>`, which:

1. Reads JSON from stdin (Kiro's hook payload)
2. Maps Kiro tool names to Claude Code tool names
3. Discovers and executes matching Han hooks
4. Outputs results to stdout/stderr with appropriate exit codes

## Validation Flow

### PreToolUse (Pre-Execution Gate)

Runs before a tool executes via Kiro's `preToolUse` hook:

```
Agent about to run a tool
  -> Kiro calls: npx kiro-plugin-han pre-tool-use
  -> Bridge reads stdin JSON { tool_name: "fs_write", ... }
  -> Maps fs_write -> Write (Claude Code name)
  -> Matches PreToolUse hooks by tool name
  -> Runs matching hooks in parallel
  -> Exit 0: Allow | Exit 2: Block (stderr sent to LLM)
```

### PostToolUse (Primary Path - In-the-Loop)

The most important hook type. When the agent edits a file:

```
Agent edits src/app.ts via fs_write
  -> Kiro calls: npx kiro-plugin-han post-tool-use
  -> Bridge reads stdin { tool_name: "fs_write", tool_input: { file_path: "src/app.ts" } }
  -> Maps fs_write -> Write, finds PostToolUse hooks
  -> Matches by tool name + file pattern + dirs_with
  -> Runs all matching hooks in parallel
  -> Outputs validation results to stdout
  -> Agent sees errors and fixes them
```

### Stop (Secondary - Full Project)

When the agent finishes:

```
Agent signals completion
  -> Kiro calls: npx kiro-plugin-han stop
  -> Bridge runs Stop hooks (full project lint, typecheck, tests)
  -> If failures: outputs to stdout, exits 1
  -> Agent continues to fix project-wide issues
```

## Context Injection

### agentSpawn (SessionStart Equivalent)

Core guidelines are injected when the agent starts via `agentSpawn` hook:

- Professional honesty (verify claims before accepting them)
- No time estimates (use phase numbers)
- No excuses policy (Boy Scout Rule)
- Date handling best practices
- Mandatory skill selection

### userPromptSubmit (Datetime)

Current local datetime is injected on every user prompt, so the LLM always knows the current time.

## Setup

### Prerequisites

Han plugins must be installed:

```bash
curl -fsSL https://han.guru/install.sh | bash
han plugin install --auto
```

### Install the Bridge

**Option A: Kiro agent config** (recommended)

Copy the agent config to your Kiro settings:

```bash
# Global (all projects)
mkdir -p ~/.kiro/agents
cp kiro-agent.json ~/.kiro/agents/han.json

# Or project-specific
mkdir -p .kiro/agents
cp kiro-agent.json .kiro/agents/han.json
```

Then start Kiro with the Han agent:

```bash
kiro-cli chat --agent han
```

**Option B: Add hooks to existing agent**

Merge the hooks from `kiro-agent.json` into your existing agent configuration.

## Tool Name Mapping

Kiro uses internal tool names that differ from Claude Code:

| Kiro Tool | Claude Code Tool | Notes |
|-----------|-----------------|-------|
| `fs_read` | `Read` | File reading |
| `fs_write` | `Write` | File writing/editing |
| `execute_bash` | `Bash` | Shell commands |
| `glob` | `Glob` | File pattern matching |
| `grep` | `Grep` | Content search |
| `notebook_edit` | `NotebookEdit` | Jupyter notebooks |
| `@mcp/tool` | MCP tool | MCP server tools |

## Exit Code Convention

Kiro uses exit codes for hook communication:

| Exit Code | Meaning | Used By |
|-----------|---------|---------|
| 0 | Success / Allow | All hooks |
| 1 | Failure (continue with warnings) | stop, postToolUse |
| 2 | **Block tool execution** | preToolUse only |

Exit code 2 is Kiro's native blocking mechanism. When a PreToolUse hook exits with code 2, Kiro blocks the tool call and sends stderr to the LLM as the reason.

## Architecture

```
Kiro CLI Hook System
  |
  |-- agentSpawn ────────────────> npx kiro-plugin-han agent-spawn
  |     (agent starts)               -> Core guidelines to stdout
  |                                   -> Skill/discipline count
  |                                   -> Start coordinator daemon
  |
  |-- userPromptSubmit ──────────> npx kiro-plugin-han user-prompt-submit
  |     (user sends prompt)           -> Current datetime to stdout
  |
  |-- preToolUse ────────────────> npx kiro-plugin-han pre-tool-use
  |     (before tool runs)            -> stdin: { tool_name, tool_input }
  |     matcher: "*"                  -> Map tool name, run PreToolUse hooks
  |                                   -> Exit 0 (allow) or Exit 2 (block)
  |
  |-- postToolUse ───────────────> npx kiro-plugin-han post-tool-use
  |     (after fs_write)              -> stdin: { tool_name, tool_input, tool_response }
  |     matcher: "fs_write"           -> Map tool name, extract file paths
  |                                   -> Run PostToolUse hooks in parallel
  |                                   -> Validation results to stdout
  |
  |-- stop ──────────────────────> npx kiro-plugin-han stop
  |     (agent finishes)              -> Run Stop hooks (full project)
  |                                   -> Validation results to stdout
  |                                   -> Exit 1 if failures
  |
  |-- JSONL logger ──────────────> Event logging
        (hook_run, hook_result)       -> ~/.han/kiro/projects/{slug}/
                                      -> Browse UI visibility

Bridge Internals:
  index.ts         CLI entry point (reads stdin, dispatches events)
  types.ts         Kiro-specific types and tool name mapping
  discovery.ts     Read settings + marketplace + resolve plugin paths
  matcher.ts       Filter by tool name, file globs, dirsWith
  executor.ts      Spawn hook commands as parallel promises
  formatter.ts     Structure results for stdout/stderr output
  events.ts        JSONL event logger (provider="kiro")
  cache.ts         Content-hash caching (SHA-256)
  context.ts       Core guidelines + datetime injection
  skills.ts        Discover SKILL.md files from installed plugins
  disciplines.ts   Discover discipline plugins
```

## Result Format

Hook results are delivered as structured XML that the agent can parse:

```xml
<han-post-tool-validation>
The following validation hooks reported issues after your last edit.
Please fix these issues before continuing:

<han-validation plugin="biome" hook="lint-async" status="failed">
src/app.ts:10:5 lint/correctness/noUnusedVariables
  This variable is unused.
</han-validation>
</han-post-tool-validation>
```

## Caching

The bridge implements content-hash caching identical to Han's approach. After a hook runs successfully on a file, the file's SHA-256 hash is recorded. On subsequent edits, if the file content hasn't changed, the hook is skipped.

## Event Logging

The bridge writes Han-format JSONL events to `~/.han/kiro/projects/`. Each event includes `provider: "kiro"` to distinguish Kiro sessions from Claude Code and OpenCode sessions.

On first invocation (agentSpawn), the bridge starts the Han coordinator in the background. The coordinator indexes events for Browse UI visibility.

Events logged:

- **hook_run / hook_result** — Hook execution lifecycle
- **hook_file_change** — File edits detected via tool events

Environment variables set:

- `HAN_PROVIDER=kiro` — Identifies the provider for child processes
- `HAN_SESSION_ID=<uuid>` — Session ID for event correlation

## Remaining Gaps

- **Subagent hooks**: Kiro custom agents don't have SubagentStart/SubagentStop equivalents
- **Skills/Disciplines tools**: Kiro hooks are shell-based; custom tool registration requires a Kiro agent config with MCP servers (planned)
- **Checkpoints**: Session-scoped checkpoint filtering is not yet implemented

## Development

```bash
# From the han repo root
cd plugins/bridges/kiro

# Run directly with bun
echo '{"hook_event_name":"stop","cwd":"/tmp"}' | bun src/index.ts stop

# Test agentSpawn context output
echo '{}' | bun src/index.ts agent-spawn
```

## License

Apache-2.0
