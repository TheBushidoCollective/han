# Han Bridge for Google Antigravity

MCP server that brings Han's full plugin ecosystem to [Google Antigravity](https://antigravity.google/) IDE -- 400+ skills, 25 agent disciplines, and on-demand validation hooks.

## What This Does

Han plugins define validation hooks, specialized skills, and agent disciplines that run during Claude Code sessions. This bridge makes the entire ecosystem work in Antigravity via MCP:

1. **Skills** -- 400+ coding skills loadable on demand via `han_skills` tool
2. **Disciplines** -- 25 agent personas (frontend, backend, SRE, security, etc.)
3. **Validation** -- On-demand linting, type checking, and formatting via `han_validate`
4. **Sync** -- Copy skills and rules to `.agent/` for native Antigravity discovery
5. **Context** -- Current time and session state via `han_context`
6. **Events** -- Unified JSONL logging with `provider: "antigravity"` for Browse UI

## How It Works

Unlike the OpenCode bridge (which hooks into JS plugin events), Antigravity doesn't have lifecycle hooks. Instead, this bridge runs as an MCP server and exposes Han's capabilities as tools:

| Tool | Purpose | Replaces |
|------|---------|----------|
| `han_skills` | Browse/load 400+ skills | Native skill discovery |
| `han_discipline` | Activate agent personas | System prompt injection |
| `han_validate` | Run validation hooks | PostToolUse/Stop hooks |
| `han_sync` | Sync skills/rules to .agent/ | SessionStart setup |
| `han_context` | Get time + active discipline | UserPromptSubmit context |

## Validation Modes

### Per-File Validation (After Edits)

```
Agent: han_validate({ mode: "file", files: ["src/app.ts"], tool: "Edit" })
→ Runs matching PostToolUse hooks (biome, eslint, tsc)
→ Returns structured results with pass/fail per hook
```

### Project-Wide Validation (Before Finishing)

```
Agent: han_validate({ mode: "project" })
→ Runs all Stop hooks (full project lint, typecheck, tests)
→ Returns comprehensive validation summary
```

## Setup

### Prerequisites

Han plugins must be installed:

```bash
curl -fsSL https://han.guru/install.sh | bash
han plugin install --auto
```

### Add MCP Server

Add to `~/.gemini/antigravity/mcp_config.json`:

```json
{
  "mcpServers": {
    "han": {
      "command": "npx",
      "args": ["-y", "antigravity-han-mcp"]
    }
  }
}
```

### Optional: Sync Skills Natively

After setup, ask the agent to sync Han skills for native Antigravity discovery:

```
> Run han_sync to set up Han skills
```

This copies skills to `.agent/skills/` and creates `.agent/rules/han-guidelines.md`.

## Architecture

```
Google Antigravity IDE
  |
  |-- mcp_config.json ─────────────────────> Han MCP Server
  |     (stdio transport)                       |
  |                                             |
  |-- han_skills ──────────────────────────> Skill discovery
  |     (LLM-callable tool)                    (list/search/load 400+ skills)
  |                                             |
  |-- han_discipline ──────────────────────> Agent disciplines
  |     (LLM-callable tool)                    (activate/deactivate/list)
  |                                             |
  |-- han_validate ────────────────────────> Hook executor
  |     (LLM-callable tool)                    |
  |     mode="file"  ──> PostToolUse hooks     |
  |     mode="project" ──> Stop hooks          |
  |                                             |
  |-- han_sync ────────────────────────────> Filesystem sync
  |     (LLM-callable tool)                    |
  |     skills → .agent/skills/                |
  |     rules  → .agent/rules/                 |
  |                                             |
  |-- han_context ─────────────────────────> Session state
  |     (LLM-callable tool)                    (time, discipline, stats)
  |                                             |
  |-- .agent/rules/han-guidelines.md ──────> Core guidelines
  |     (native Antigravity rules)              (synced by han_sync)
  |                                             |
  |-- .agent/skills/han-*/SKILL.md ────────> Native skills
  |     (native Antigravity skills)             (synced by han_sync)
  |                                             |
  |-- JSONL logger ────────────────────────> Event logging
        (hook_run, hook_result)                 (Browse UI visibility)

Bridge Internals:
  index.ts         MCP server entry point (JSON-RPC over stdio)
  discovery.ts     Read settings + marketplace + resolve plugin paths
  skills.ts        Discover SKILL.md files from installed plugins
  disciplines.ts   Discover discipline plugins, context builder
  context.ts       Core guidelines + datetime for rules/context
  sync.ts          Copy skills/rules to .agent/ directory
  matcher.ts       Filter hooks by tool name, file globs, dirsWith
  executor.ts      Spawn hook commands as parallel promises
  formatter.ts     Structure results for MCP tool responses
  events.ts        JSONL event logger (provider="antigravity")
  cache.ts         Content-hash caching (SHA-256)
```

## Comparison with OpenCode Bridge

| Feature | OpenCode Bridge | Antigravity Bridge |
|---------|----------------|-------------------|
| Integration | JS plugin API (events) | MCP server (tools) |
| Validation trigger | Automatic (tool.execute.after) | On-demand (han_validate) |
| Context injection | experimental.chat.system.transform | .agent/rules/ + han_context |
| Skill discovery | han_skills tool | han_skills tool + .agent/skills/ sync |
| Stop validation | Automatic (session.idle/stop) | On-demand (han_validate mode=project) |
| Event logging | provider: "opencode" | provider: "antigravity" |

## Remaining Gaps

These are genuine platform limitations in Antigravity (as of Feb 2026):

- **Automatic validation**: No lifecycle hooks, so validation requires explicit han_validate calls
- **Permission denial**: Cannot block tool execution (no PreToolUse equivalent)
- **Subagent hooks**: No SubagentStart/SubagentStop equivalent
- **Session checkpoints**: Not available
- **MCP tool events**: Cannot intercept MCP tool calls for validation

## Skills

The bridge gives the agent access to Han's full skill library (400+ skills across 95+ plugins). Two modes:

- **MCP tool**: Agent calls `han_skills` to list/load skills on demand
- **Native sync**: `han_sync` copies skills to `.agent/skills/` for Antigravity's native semantic matching

## Disciplines

25 agent personas available via `han_discipline`:

- frontend, backend, api, architecture, mobile, database, security
- infrastructure, sre, performance, accessibility, quality, documentation
- and more

When activated, the discipline's context is returned with each `han_context` call.

## Event Logging

Events are logged to `~/.han/antigravity/projects/{slug}/{sessionId}-han.jsonl` with `provider: "antigravity"`. The Han coordinator indexes these files and serves them through the Browse UI alongside Claude Code and OpenCode sessions.

## Development

```bash
# From the han repo root
cd plugins/bridges/antigravity

# Run the MCP server directly
bun src/index.ts --project-dir /path/to/project

# The server reads JSON-RPC from stdin and writes to stdout
```

## License

Apache-2.0
