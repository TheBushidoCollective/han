# Han Bridge for OpenCode

Bridge plugin that enables Han's hook ecosystem to work with [OpenCode](https://opencode.ai) by translating OpenCode's event system into Claude Code hook invocations.

## What This Does

Han plugins define hooks (validation, context injection, orchestration) that run during Claude Code sessions. This bridge makes those same hooks work in OpenCode by:

1. Listening to OpenCode events (`session.created`, `tool.execute.after`, `stop`, etc.)
2. Mapping them to Claude Code hook events (`SessionStart`, `PostToolUse`, `Stop`, etc.)
3. Constructing Claude Code-compatible stdin payloads
4. Executing `han hook dispatch|orchestrate` with the translated context

## Event Mapping

| OpenCode Event | Claude Code Hook | Han Command |
|---|---|---|
| `session.created` | `SessionStart` | `han hook dispatch SessionStart` |
| `tool.execute.before` | `PreToolUse` | `han hook dispatch PreToolUse` |
| `tool.execute.after` | `PostToolUse` | `han hook dispatch PostToolUse` |
| `experimental.session.compacting` | `PreCompact` | `han hook dispatch PreCompact` |
| `stop` (dedicated hook) | `Stop` | `han hook orchestrate Stop` |
| `chat.message` (dedicated hook) | `UserPromptSubmit` | `han hook dispatch UserPromptSubmit` |

## Setup

### Prerequisites

1. **Han CLI** must be installed:

   ```bash
   curl -fsSL https://han.guru/install.sh | bash
   ```

2. **Han plugins** must be installed:

   ```bash
   han plugin install --auto
   ```

### Install the Bridge

**Option A: npm package** (recommended)

Add to your `opencode.json`:

```json
{
  "$schema": "https://opencode.ai/config.json",
  "plugin": ["opencode-plugin-han"]
}
```

**Option B: Local plugin**

Copy `src/index.ts` to `.opencode/plugins/han-bridge.ts` in your project.

## How It Works

### Stop Hook (Validation Pipeline)

The most important mapping. When OpenCode's agent signals it's done:

1. The bridge calls `han hook orchestrate Stop`
2. Han runs all registered Stop hooks (biome, eslint, typescript typecheck, etc.)
3. If any hook fails, the bridge returns `{ continue: true, assistantMessage: <errors> }`
4. OpenCode forces the agent to continue and fix the issues

This means Han's entire validation pipeline works in OpenCode.

### Session Start (Context Injection)

When an OpenCode session starts:

1. The bridge calls `han hook dispatch SessionStart`
2. Han runs session initialization hooks (coordinator setup, context injection)
3. Session context is established for subsequent hooks

### Tool Events

When OpenCode executes tools:

1. `tool.execute.before` triggers `PreToolUse` hooks (context injection for subagents)
2. `tool.execute.after` triggers `PostToolUse` hooks (async validation after edits)

## Known Limitations

- **PreToolUse blocking**: OpenCode's `tool.execute.before` event doesn't support blocking or modifying tool calls. PreToolUse hooks that deny or modify tool input won't have their full effect.
- **MCP tool events**: OpenCode doesn't fire `tool.execute.before`/`tool.execute.after` for MCP tool calls ([opencode#2319](https://github.com/sst/opencode/issues/2319)).
- **SubagentStart/SubagentStop**: No OpenCode equivalent exists for these Claude Code events.
- **Notification**: No OpenCode equivalent for the Notification hook event.

## Architecture

```
OpenCode Runtime
  |
  |-- session.created --> event handler
  |-- tool.execute.*  --> event handler
  |-- stop            --> stop handler
  |-- chat.message    --> chat.message handler
        |
        v
  Han Bridge Plugin (this)
    |-- event-map.ts    (OpenCode event -> Claude Code event name)
    |-- payload.ts      (construct Claude Code stdin JSON)
    |-- runner.ts       (spawn `han` CLI process)
        |
        v
  han hook dispatch|orchestrate <event>
    |-- reads installed plugins
    |-- executes matching hooks
    |-- returns results via stdout/exit code
```

## Development

```bash
# From the han repo root
cd plugins/bridges/opencode

# The plugin uses TypeScript directly (Bun handles it)
# No build step required for OpenCode
```

## License

Apache-2.0
