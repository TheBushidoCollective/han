---
title: "Hook System"
description: "Understanding Han's hook lifecycle for automated quality validation at every stage of your Claude Code workflow."
---

Han's hook system automatically validates your code at key moments during Claude Code sessions. No manual commands, no forgotten checks - quality gates that run themselves.

## Why Hooks?

Traditional validation requires discipline: remember to lint, remember to test, remember to type-check. Claude doesn't forget, but without hooks, validation becomes an afterthought.

Hooks make validation **automatic**. Write code, finish your conversation, and hooks validate everything before you move on.

## The Hook Lifecycle

Claude Code fires 31 hook events over a session's life, and Han's `han-plugin.yml` accepts every one of them. The table below is the curated shortlist you will actually reach for when writing a validation plugin. For the complete 31-event reference, current as of Claude Code 2.1.228, see [plugin hook events](/docs/plugin-development/hooks#hook-lifecycle).

| Hook | When It Fires | Purpose |
|------|---------------|---------|
| `SessionStart` | Session begins | Initialize state |
| `SubagentStart` | Subagent spawns | Inject context into subagents |
| `UserPromptSubmit` | Before processing input | Pre-process, inject context |
| `PreToolUse` | Before tool execution | Validate tool calls |
| `PermissionRequest` | Permission dialog appears | Audit/auto-approve permissions |
| `PostToolUse` | After tool execution | Process results |
| `PostToolUseFailure` | Tool execution fails | Error tracking, recovery |
| `Stop` | Before response | **Main validation point** |
| `SubagentStop` | Subagent completes | Validate agent's work |
| `PreCompact` | Before context compaction | Save state before compaction |
| `SessionEnd` | Session ends | Cleanup |
| `Notification` | Notification event | Custom notification handling |
| `ConfigChange` | Configuration modified | Audit trails, monitoring |
| `TeammateIdle` | Teammate agent goes idle | Team coordination |
| `TaskCompleted` | Task marked completed | Task tracking, workflows |
| `WorktreeCreate` | Git worktree created | Agent isolation tracking |
| `WorktreeRemove` | Git worktree removed | Cleanup tracking |

Most validation happens at `Stop` and `SubagentStop` - the natural points after work is done. The events above are a curated subset, not the full set.

### New Hook Events (Claude Code 2.1.33+)

Several hook events have been added for tool failure tracking, permission auditing, team workflows, and operational monitoring:

- **`PermissionRequest`** (~2.1.50+): Fires when a permission dialog appears. Supports matcher on tool name. Input includes `permission_suggestions` array. Can respond with `behavior` field (`allow`/`deny`), `updatedInput`, `updatedPermissions`, `message`, or `interrupt`.

- **`PostToolUseFailure`** (~2.1.50+): Fires when a tool execution fails. Input includes `error` string and `is_interrupt` boolean. Can provide `additionalContext` back to Claude for recovery guidance.

- **`PreCompact`** (~2.1.50+): Fires before context compaction. Supports matcher for `manual` vs `auto` compaction. Useful for saving state or injecting context before the window is compressed.

- **`ConfigChange`** (2.1.49+): Fires when Claude Code configuration is modified. Supports matcher on config source. Useful for audit trails, configuration drift detection, and enforcing settings policies.

- **`TeammateIdle`** (2.1.33+): Fires when a teammate agent goes idle between turns. Enables team coordination, load balancing, and monitoring agent activity in multi-agent sessions.

- **`TaskCompleted`** (2.1.33+): Fires when a task is marked as completed via `TaskUpdate`. Useful for task tracking dashboards, triggering follow-up workflows, and team notifications.

- **`WorktreeCreate`** (2.1.50+): Fires when a worktree is being created. Receives `name` slug in the payload. When configured, replaces default git worktree behavior: the hook must print the created worktree path to stdout. Enables custom VCS support and tracking of parallel workstreams.

- **`WorktreeRemove`** (2.1.50+): Fires when a worktree is being removed. Receives `worktree_path` in the payload. Cannot block removal. Useful for cleanup automation and resource tracking.

### Stop/SubagentStop: `last_assistant_message` Field

Since Claude Code 2.1.47, the `Stop` and `SubagentStop` hook inputs include a `last_assistant_message` field containing the final assistant message text. This allows hooks to inspect what the agent is about to respond with and take action based on the content.

```json
{
  "hook_event_name": "Stop",
  "session_id": "abc123",
  "last_assistant_message": "I've completed the refactoring of the auth module..."
}
```

## How Hooks Run

### Session Flow

```text
SessionStart
  │
  ├─ [Your work happens]
  │
  ├─ SubagentStart (if agent spawned)
  │   ├─ [Subagent work]
  │   └─ SubagentStop (validates subagent changes)
  │
  └─ Stop (validates session changes)
```

### How Validation Is Scoped

- **Caching**: a hook is skipped when nothing the current session touched matches its `if_changed` patterns, and re-runs once a matching file's hash differs from the one recorded at its last validation
- **Session filtering**: a hook whose command contains `${HAN_FILES}` is handed only the files the current session modified

Between them, hooks avoid re-checking untouched code and avoid tripping over another session's edits. Han previously did this with explicit session and agent checkpoints; that mechanism has been removed.

## What Hooks Do

Han plugins define hooks for specific validations:

### Technique Plugins

| Plugin | Hook | Validates |
|--------|------|-----------|
| `biome` | `lint` | JavaScript/TypeScript linting |
| `typescript` | `typecheck` | Type errors |
| `bun` | `test` | Test failures |
| `markdown` | `lint` | Markdown formatting |

### Example Hook Configuration

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "han hook run biome lint" },
          { "type": "command", "command": "han hook run typescript typecheck" }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          { "type": "command", "command": "han hook run biome lint" }
        ]
      }
    ]
  }
}
```

## Hook Types

Claude Code supports four hook types as of 2.1.63:

### Command Hooks

Execute shell commands:

```json
{
  "type": "command",
  "command": "han hook run biome lint",
  "timeout": 120
}
```

### HTTP Hooks (2.1.63+)

POST JSON to a URL and receive JSON back, instead of running a shell command:

```json
{
  "type": "http",
  "url": "http://localhost:8080/hooks/stop",
  "timeout": 30,
  "headers": {
    "Authorization": "Bearer $MY_TOKEN"
  },
  "allowedEnvVars": ["MY_TOKEN"]
}
```

HTTP hooks send the event's JSON input as the POST body (`Content-Type: application/json`). Response handling:

- **2xx with empty body**: success (like exit code 0)
- **2xx with plain text**: success, text added as context
- **2xx with JSON body**: parsed using the same schema as command hooks
- **Non-2xx / connection failure**: non-blocking error, execution continues

To block a tool call or deny a permission, return a 2xx response with JSON body containing the appropriate `hookSpecificOutput`.

### Prompt Hooks

Return text directly to the agent without executing a command:

```json
{
  "type": "prompt",
  "prompt": "Remember to follow coding standards."
}
```

### Agent Hooks

Spawn an agent to handle the hook event:

```json
{
  "type": "agent",
  "prompt": "Review the tool output for security issues. $ARGUMENTS"
}
```

## Smart Behaviors

Han hooks are intelligent by default (as of v2.0.0):

### Caching

Skip hooks when files haven't changed:

- Compares file hashes to previous run
- Only re-validates modified files
- Dramatically speeds up repeated runs

### Session Filtering

Only validate your work:

- A hook whose command contains `${HAN_FILES}` runs only against the files the current session modified
- Pre-existing issues elsewhere in the repo stay out of scope
- This is automatic. A command opts in by using `${HAN_FILES}` and opts out by not using it

To turn session filtering off, set `hooks.checkpoints: false` in `han.yml`, pass `--no-checkpoints` to `han hook dispatch`, or export `HAN_NO_CHECKPOINTS=1`. Any of the three makes `${HAN_FILES}` expand to `.`, so hooks check the whole tree.

### Transcript Filtering

**NEW in v2.3.0**: Session-scoped hooks that prevent cross-session conflicts.

When multiple Claude Code sessions work in the same directory:

- Each session tracks which files IT modified via its transcript
- Stop hooks only run on files THIS session actually touched
- Other sessions' changes are ignored, preventing edit conflicts

```text
Session A: modifies src/auth.ts
Session B: modifies src/utils.ts

Session A's Stop hook: validates src/auth.ts only
Session B's Stop hook: validates src/utils.ts only
```

This eliminates the common problem where two sessions try to fix the same linting error simultaneously.

#### File-Targeted Commands with `${HAN_FILES}`

For commands that support file arguments, use the `${HAN_FILES}` template to run only on session-modified files:

```yaml
plugins:
  biome:
    hooks:
      lint:
        command: npx biome check --write ${HAN_FILES}
        if_changed:
          - "**/*.ts"
          - "**/*.tsx"
```

When a command uses `${HAN_FILES}`:

- It is replaced with the session-modified files under the hook's directory that also match `if_changed`
- If there is no session ID, the session modified nothing, or the lookup throws, it is replaced with `.` (fall back to the whole directory)
- If the session did modify files but none of them match this directory and `if_changed`, the hook is skipped for that directory rather than run against `.`
- Commands without `${HAN_FILES}` run unchanged (backward compatible)

This prevents the scenario where Session A's lint error causes Session B's hook to also fail.

Caching is the one smart behaviour with a working off switch: pass `--no-cache` to `han hook run`, set `HAN_NO_CACHE=1`, or set `hooks.cache: false` in `han.yml`.

## Configuration

### Global Settings

In `han.yml`:

```yaml
hooks:
  enabled: true       # Master switch
  cache: true         # Smart caching (default: true)
```

`hooks.enabled`, `hooks.cache`, and `hooks.checkpoints` are the keys the hook runner reads.

### Per-Plugin Settings

```yaml
plugins:
  biome:
    hooks:
      lint:
        enabled: true
        command: npx biome check --write .
        if_changed:
          - "**/*.ts"
          - "**/*.tsx"
```

A per-plugin hook override is read as `enabled`, `command`, `if_changed`, `idle_timeout`, and `before_all`. `han.yml` is parsed without schema validation, so any other key is silently ignored rather than reported.

### Conditional Execution

`dirs_with` and `dir_test` are plugin-author keys: they belong in the plugin's own `han-plugin.yml`, not in your `han.yml` overrides. Only run in directories with specific files:

```yaml
# han-plugin.yml
hooks:
  typecheck:
    command: npx tsc --noEmit
    dirs_with:
      - tsconfig.json
```

From `han.yml`, narrow an existing hook by adding change patterns:

```yaml
plugins:
  bun:
    hooks:
      test:
        if_changed:
          - "**/*.ts"
          - "**/*.test.ts"
```

## Hook Priority

Settings cascade with later overriding earlier:

1. **Built-in defaults**: hooks and caching enabled
2. **`han.yml`**: your configuration, merged user then project then local then root
3. **CLI flags**: `--no-cache` on `han hook run`
4. **Environment variables**: `HAN_NO_CACHE=1`, `HAN_DISABLE_HOOKS=1`

## Running Hooks Manually

While hooks run automatically, you can trigger them manually:

```bash
# Run a specific plugin hook
han hook run biome lint

# Run with options
han hook run typescript typecheck --verbose

# Disable caching for this run
han hook run bun test --no-cache
```

See [CLI Hook Commands](/docs/cli/hooks) for full reference.

## Creating Custom Hooks

Any command can be a hook. Create project-specific validation:

```yaml
# han.yml
plugins:
  my-project:
    hooks:
      validate-schema:
        command: ./scripts/validate-schema.sh
        if_changed:
          - "**/*.graphql"
```

Hook into the lifecycle:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "han hook run my-project validate-schema" }
        ]
      }
    ]
  }
}
```

## Debugging Hooks

### Verbose Output

See what's happening:

```bash
han hook run biome lint --verbose
```

### Check Hook Status

View hook configuration:

```bash
# Every configured hook, Han plugins plus Claude Code settings
han hook explain

# Narrow to a single event
han hook explain Stop

# Just the hooks discovered from installed plugins
han hook list
```

### Force Re-run

Bypass cache:

```bash
han hook run biome lint --no-cache
```

## Best Practices

### Keep Hooks Fast

- Use caching to skip unchanged files
- Run expensive checks (tests) less frequently
- Use `if_changed` to limit scope

### Layer Your Validation

```text
SubagentStop: Quick checks (lint, typecheck)
Stop: Full validation (lint, typecheck, tests)
```

### Trust the System

Let hooks run automatically. Don't disable them because they found issues - fix the issues.

## Next Steps

- Read the full [hook event reference](/docs/plugin-development/hooks#hook-lifecycle) for all 31 events
- Explore [configuration](/docs/configuration) for fine-tuning
- See [CLI commands](/docs/cli/hooks) for manual execution
