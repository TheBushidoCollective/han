---
title: "Using Han with Google Antigravity"
description: "How to use Han's validation pipeline, skills, and disciplines with Google Antigravity IDE via MCP server."
---

Han works with [Google Antigravity](https://antigravity.google/) through an MCP server bridge that exposes Han's skills, disciplines, and validation hooks as tools the agent can call.

## How It Works

Antigravity doesn't have lifecycle hooks like Claude Code or OpenCode. Instead, Han integrates via MCP server, exposing capabilities as tools:

1. **MCP tools** → **Skills, disciplines, validation** (agent calls on demand)
2. **Native sync** → **`.agent/skills/` and `.agent/rules/`** (Antigravity discovers natively)
3. **Event logging** → **Browse UI** (sessions visible alongside Claude Code sessions)

```text
Agent finishes editing src/app.ts
  -> Agent calls han_validate({ mode: "file", files: ["src/app.ts"] })
  -> Bridge matches PostToolUse hooks (biome, eslint, tsc)
  -> Runs hooks in parallel, returns structured results
  -> Agent fixes validation errors
```

## Setup

### 1. Install Han and plugins

```bash
curl -fsSL https://han.guru/install.sh | bash
han plugin install --auto
```

### 2. Add the MCP server to Antigravity

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

### 3. Optional: Sync skills natively

Ask the agent to run `han_sync` to copy skills to `.agent/skills/` and generate `.agent/rules/han-guidelines.md`. This lets Antigravity discover Han's skills via its native semantic matching without MCP tool calls.

## Available Tools

The bridge exposes five MCP tools:

| Tool | Purpose | Usage |
|------|---------|-------|
| `han_skills` | Browse/load 400+ coding skills | `han_skills({ action: "list", filter: "react" })` |
| `han_discipline` | Activate agent personas (25 disciplines) | `han_discipline({ action: "activate", discipline: "frontend" })` |
| `han_validate` | Run validation hooks on demand | `han_validate({ mode: "file", files: ["src/app.ts"] })` |
| `han_sync` | Sync skills/rules to `.agent/` directory | `han_sync({})` |
| `han_context` | Get time, active discipline, stats | `han_context({})` |

## Validation

Since Antigravity doesn't have automatic tool lifecycle hooks, validation is on-demand. The agent calls `han_validate` after edits or before finishing.

### Per-File Validation (After Edits)

```text
han_validate({ mode: "file", files: ["src/app.ts"], tool: "Edit" })
```

Runs matching PostToolUse hooks:

| Plugin | What It Does |
|--------|-------------|
| `biome` | Lint and format JavaScript/TypeScript |
| `eslint` | JavaScript/TypeScript linting |
| `prettier` | Code formatting |
| `typescript` | Type checking |
| `clippy` | Rust linting |
| `pylint` | Python linting |

### Project-Wide Validation (Before Finishing)

```text
han_validate({ mode: "project" })
```

Runs all Stop hooks for comprehensive project validation:

- Full project linting
- Type checking across the codebase
- Test suite execution

## Skills (400+)

The `han_skills` tool gives the agent access to Han's full skill library without duplicating files:

```text
han_skills({ action: "list", filter: "typescript" })
-> Lists all TypeScript-related skills

han_skills({ action: "load", skill: "typescript-type-system" })
-> Loads full skill content into context
```

Alternatively, run `han_sync` to copy skills to `.agent/skills/` for native Antigravity discovery via semantic matching.

## Disciplines (25 Agent Personas)

Activate specialized agent expertise via `han_discipline`:

```text
han_discipline({ action: "list" })
-> Available: frontend, backend, sre, security, mobile, database...

han_discipline({ action: "activate", discipline: "frontend" })
-> Agent now operates with frontend specialist context
```

Available disciplines: frontend, backend, api, architecture, mobile, database, security, infrastructure, sre, performance, accessibility, quality, documentation, project-management, product, data-engineering, machine-learning, and more.

## Native Integration via Sync

Running `han_sync` copies Han's assets to Antigravity's native directories:

- **Skills** → `.agent/skills/han-*/SKILL.md` (native semantic discovery)
- **Rules** → `.agent/rules/han-guidelines.md` (auto-injected guidelines)

This means Antigravity discovers Han's skills via its built-in semantic matching system, without needing to call MCP tools. The rules file provides core guidelines (professional honesty, no time estimates, skill selection) that are injected into every agent context.

## Comparison with Claude Code and OpenCode

| Feature | Claude Code | OpenCode | Antigravity |
|---------|-------------|----------|-------------|
| Integration type | Native hooks | JS plugin API | MCP server |
| Validation trigger | Automatic (PostToolUse) | Automatic (tool.execute.after) | On-demand (han_validate) |
| Context injection | SessionStart hook | system.transform | .agent/rules/ + han_context |
| Skill access | han_skills tool | han_skills tool | han_skills + .agent/skills/ sync |
| Discipline support | do-* plugins | han_discipline tool | han_discipline tool |

## Remaining Gaps

These are platform limitations in Antigravity (as of Feb 2026):

- **Automatic validation**: No lifecycle hooks, so validation requires explicit `han_validate` calls. You can add a rule in `.agent/rules/` instructing the agent to validate after edits.
- **Permission denial**: Cannot block tool execution (no PreToolUse equivalent).
- **Subagent hooks**: No SubagentStart/SubagentStop equivalent.
- **MCP tool events**: Cannot intercept MCP tool calls for validation.
- **Session checkpoints**: Not available.

## How Plugins Stay Compatible

Han plugins don't need modification to work with Antigravity. The bridge reads the same `han-plugin.yml` files that Claude Code and OpenCode use:

```yaml
# This config works in Claude Code, OpenCode, AND Antigravity
hooks:
  lint-async:
    event: PostToolUse
    command: "npx -y @biomejs/biome check --write ${HAN_FILES}"
    tool_filter: [Edit, Write, NotebookEdit]
    file_filter: ["**/*.{js,jsx,ts,tsx}"]
    dirs_with: ["biome.json"]
```

Same hook definition. Same validation. Different runtime.

## Event Logging

The bridge writes JSONL events to `~/.han/antigravity/projects/`. Each event includes `provider: "antigravity"`. The Han coordinator indexes these and serves them through the Browse UI alongside Claude Code and OpenCode sessions.

## Next Steps

- [Install Han plugins](/docs/installation/plugins) for your project's languages and tools
- Read about [hook configuration](/docs/plugin-development/hooks) to understand what hooks do
- Check the [bridge source code](https://github.com/TheBushidoCollective/han/tree/main/plugins/bridges/antigravity) for implementation details
