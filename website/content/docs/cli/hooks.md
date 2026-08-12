---
title: "Hook Commands"
description: "Commands for running and managing hooks."
---

Commands for running validation hooks and managing hook execution.

## `han hook run`

Run a validation hook from an installed plugin.

### Usage

```bash
# New format: Run a plugin's hook
han hook run <plugin-name> <hook-name>

# With options
han hook run <plugin-name> <hook-name> --verbose

# Disable caching
han hook run <plugin-name> <hook-name> --no-cache

# Legacy format: Run custom command across directories
han hook run --dirs-with <file> -- <command>
```

### Options

| Option | Description |
|--------|-------------|
| `--no-cache` | Disable caching (caching is ON by default in v2.0.0+) |
| `--only <directory>` | Only run in the specified directory, for targeted re-runs after a failure |
| `--verbose` | Show full command output in real-time |
| `--skip-deps` | Skip dependency checks, for recheck and retry scenarios |
| `--session-id <id>` | Claude session ID used for event logging and cache tracking |
| `--async` | Enable per-file `${HAN_FILES}` substitution (PostToolUse) or session-file substitution (Stop) |

`--checkpoint-type <type>` and `--checkpoint-id <id>` are still parsed and validated, but the hook runner ignores them. They are inert remnants of the removed checkpoint feature.

**Legacy options:**

| Option | Description |
|--------|-------------|
| `--dirs-with <file>` | Only run in directories containing the specified file |
| `--test-dir <command>` | Only include directories where this command exits 0 |

**Breaking Change (v2.0.0):** Caching is enabled by default. Use `--no-cache` to disable it.

### Caching Behavior

Caching is enabled by default (since v2.0.0). A hook run:

1. Builds a manifest of the files matching the hook's `if_changed` patterns
2. Skips the hook when nothing the current session touched appears in that manifest
3. Otherwise compares each file's hash against the hash recorded at its last validation, and runs when any differ or a validated file was deleted
4. Assumes changes and runs on any error, so a cache fault never silently skips validation

Pass `--no-cache` (or set `HAN_NO_CACHE=1`) to force a run.

### Examples

```bash
# Run Bun tests (caching enabled by default)
han hook run bun test

# Run without caching
han hook run bun test --no-cache

# Run TypeScript type checking verbosely
han hook run typescript typecheck --verbose

# Run Biome lint in one directory only
han hook run biome lint --only packages/core

# Legacy: Run npm test in directories with package.json
han hook run --dirs-with package.json -- npm test
```

### Plugin Hook Configuration

Hooks are defined in plugin `han-plugin.yml` files:

```yaml
hooks:
  test:
    command: bun test --only-failures
    dirs_with: [bun.lock, bun.lockb]
    description: Run Bun tests
    if_changed: ["**/*.ts", "**/*.test.ts"]
```

When you run `han hook run bun test`, Han:

1. Finds directories containing `bun.lock` or `bun.lockb`
2. Checks whether files matching `**/*.ts` or `**/*.test.ts` have changed (caching is enabled by default)
3. Runs `bun test --only-failures` in each directory
4. Records the result and updates the file-validation cache

## `han hook list`

List available hooks from installed plugins.

### Usage

```bash
# List all available hooks
han hook list

# Filter by plugin
han hook list --plugin bun

# Filter by event type
han hook list --event Stop

# Show detailed information
han hook list --verbose
```

### Options

| Option | Description |
|--------|-------------|
| `-e, --event <event>` | Filter by event type (for example `Stop`, `PreToolUse`) |
| `-p, --plugin <name>` | Filter hooks by plugin name (substring match) |
| `-v, --verbose` | Show additional details including source paths |
| `--json` | Output as JSON for scripting |

### Output

```
Available Hooks:

  bun:
    test - Run Bun tests
    build - Build the Bun project

  typescript:
    typecheck - Type-check TypeScript code for type errors

  biome:
    lint - Lint Biome code for issues and style violations
```

### Examples

```bash
# List all hooks
han hook list

# List only Bun hooks
han hook list --plugin bun

# Get JSON output for scripting
han hook list --json | jq '.[] | select(.plugin == "bun")'
```

## `han hook explain`

Show comprehensive information about configured hooks. By default it covers every hook Claude Code would fire, both Han plugin hooks and hooks defined in settings files.

The optional positional argument is an **event type**, not a plugin or hook name.

### Usage

```bash
# All hooks, Han plugins plus Claude Code settings
han hook explain

# Only Stop hooks, from all sources
han hook explain Stop

# Only hooks contributed by Han plugins
han hook explain --han-only

# Combine both
han hook explain Stop --han-only
```

### Options

| Option | Description |
|--------|-------------|
| `--han-only` | Show only Han plugin hooks, excluding settings hooks |

## `han hook test`

Run hooks with simulated Claude Code input and show their actual output. This executes the hooks, which is the point: it reproduces a hook failure exactly as Claude Code would trigger it.

As with `explain`, the optional positional argument is an event type.

### Usage

```bash
# Test every hook
han hook test

# Test only SessionStart hooks
han hook test SessionStart

# Show the stdin payload sent to hooks
han hook test Stop --payload

# Only hooks whose command contains "han"
han hook test --command han
```

### Options

| Option | Description |
|--------|-------------|
| `--payload` | Show the stdin JSON payload sent to hooks |
| `--command <substring>` | Filter to hooks whose command contains this string |

## `han hook dispatch`

Run every Han plugin hook registered for one event. This is what Claude Code invokes from a generated `hooks.json`.

### Usage

```bash
han hook dispatch Stop
han hook dispatch PostToolUse --all
```

### Options

| Option | Description |
|--------|-------------|
| `-a, --all` | Include hooks defined in Claude Code settings, not just Han plugin hooks |
| `--no-cache` | Disable caching for the dispatched hooks |

`--no-checkpoints` exports `HAN_NO_CHECKPOINTS=1` to child hooks, which turns off session-scoped `${HAN_FILES}` filtering so hooks check the whole tree. See [session-scoped validation](/docs/features/checkpoints#turning-session-filtering-off).

## Other `han hook` subcommands

| Command | Purpose |
|---------|---------|
| `han hook context` | Print consolidated session context for `SessionStart` injection |
| `han hook auto-detect` | Auto-install plugins from file changes, for `PostToolUse` |
| `han hook auto-detect-prompt` | Auto-install plugins from URLs and patterns in a prompt, for `UserPromptSubmit` |
| `han hook wrap-subagent-context` | `PreToolUse` helper that injects context into Agent and Skill tool prompts |

## Environment Variables

Hook execution respects these environment variables:

| Variable | Description |
|----------|-------------|
| `HAN_DISABLE_HOOKS` | Set to `1` or `true` to disable all hooks |
| `HAN_FORCE_HOOKS` | Set to `1` or `true` to run hooks even where they would otherwise be suppressed |
| `HAN_HOOK_RUN_VERBOSE` | Set to `1` or `true` to enable verbose output globally |
| `HAN_NO_CACHE` | Set to `1` or `true` to disable caching for this run |
| `HAN_SESSION_ID` | Session ID used for event logging, cache tracking, and lock scoping |
| `HAN_DEBUG` | Set to `1` or `true` for debug diagnostics on stderr |
| `HAN_HOOK_ABSOLUTE_TIMEOUT` | Hard ceiling on a single hook, in seconds (default: 300) |
| `HAN_HOOK_PARALLELISM` | Parallel hook slots (default: half the CPU count, minimum 1) |
| `HAN_HOOK_ACQUIRE_TIMEOUT` | How long to wait for a free slot, in milliseconds (default: 3600000) |
| `HAN_HOOK_LOCK_TIMEOUT` | When a held lock is treated as stale, in milliseconds (default: 900000) |
| `HAN_HOOK_NO_LOCK` | Set to `1` to disable hook resource locking entirely |

### Example

```bash
# Disable all hooks temporarily
export HAN_DISABLE_HOOKS=1
han hook run bun test  # Exits immediately without running

# Enable verbose output globally
export HAN_HOOK_RUN_VERBOSE=1
han hook run bun test  # Always shows full output
```

## Integration with Claude Code

Hooks run automatically at lifecycle events when configured in plugin `hooks.json`:

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "han hook run bun test" }
        ]
      }
    ],
    "SubagentStop": [
      {
        "hooks": [
          { "type": "command", "command": "han hook run typescript typecheck" }
        ]
      }
    ]
  }
}
```

### Hook Lifecycle

Han accepts all 31 Claude Code hook events. The events below are the ones you will most often wire up from the CLI; see the [full hook event reference](/docs/plugin-development/hooks#hook-lifecycle) for the complete list, current as of Claude Code 2.1.228.

| Hook | When It Fires | Purpose |
|------|---------------|---------|
| `SessionStart` | Claude Code session begins | Initialize session state |
| `SubagentStart` | Subagent is spawned | Inject context into the subagent |
| `UserPromptSubmit` | User submits a prompt | Pre-process user input |
| `PreToolUse` | Before each tool call | Validate tool usage |
| `PermissionRequest` | Permission dialog appears | Audit or auto-approve permissions |
| `PostToolUse` | After each tool call | Post-process tool results |
| `PostToolUseFailure` | Tool execution fails | Error tracking, recovery |
| `Stop` | Agent about to respond | Validate all session changes |
| `SubagentStop` | Subagent completes | Validate subagent changes |
| `Notification` | Notification event | Custom notification handling |
| `PreCompact` | Before context compaction | Save state before compaction |
| `SessionEnd` | Session ends | Cleanup session state |
| `ConfigChange` | Configuration modified (2.1.49+) | Audit trails, config monitoring |
| `TeammateIdle` | Teammate goes idle (2.1.33+) | Team coordination |
| `TaskCompleted` | Task completed (2.1.33+) | Task tracking, workflows |
| `DirectoryAdded` | Directory added mid-session (2.1.219+) | React to a newly registered working root |
| `WorktreeCreate` | Worktree created (2.1.50+) | Agent isolation tracking, custom VCS |
| `WorktreeRemove` | Worktree removed (2.1.50+) | Cleanup automation |

### New Hook Events

#### PermissionRequest (~2.1.50+)

Fired when a permission dialog appears. Supports matcher on tool name. The input includes a `permission_suggestions` array. The hook can respond with `behavior` (`allow`/`deny`), `updatedInput`, `updatedPermissions`, `message`, or `interrupt`:

```json
{
  "hook_event_name": "PermissionRequest",
  "session_id": "abc123",
  "cwd": "/project/path",
  "tool_name": "Bash",
  "permission_suggestions": [...]
}
```

Useful for automated permission policies, security auditing, and CI/CD environments.

#### PostToolUseFailure (~2.1.50+)

Fired when a tool execution fails. The input includes `error` string and `is_interrupt` boolean. The hook can return `additionalContext` to help Claude recover:

```json
{
  "hook_event_name": "PostToolUseFailure",
  "session_id": "abc123",
  "cwd": "/project/path",
  "tool_name": "Bash",
  "error": "Command exited with code 1",
  "is_interrupt": false
}
```

Useful for error tracking, automatic recovery suggestions, and operational monitoring.

#### PreCompact (~2.1.50+)

Fired before context compaction. Supports matcher for `manual` vs `auto` compaction:

```json
{
  "hook_event_name": "PreCompact",
  "session_id": "abc123",
  "cwd": "/project/path"
}
```

Useful for saving state, injecting critical context to preserve, or logging compaction events.

#### ConfigChange (2.1.49+)

Fired when Claude Code configuration is modified. The stdin payload includes the changed configuration keys:

```json
{
  "hook_event_name": "ConfigChange",
  "session_id": "abc123",
  "cwd": "/project/path"
}
```

Useful for audit trails, configuration drift detection, and enforcing settings policies across teams.

#### TeammateIdle (2.1.33+)

Fired when a teammate agent goes idle between turns in multi-agent sessions:

```json
{
  "hook_event_name": "TeammateIdle",
  "session_id": "abc123",
  "cwd": "/project/path"
}
```

Enables team coordination, load balancing, and monitoring agent activity.

#### TaskCompleted (2.1.33+)

Fired when a task is marked as completed via `TaskUpdate`:

```json
{
  "hook_event_name": "TaskCompleted",
  "session_id": "abc123",
  "cwd": "/project/path"
}
```

Useful for task tracking dashboards, triggering follow-up workflows, and team notifications.

#### WorktreeCreate (2.1.50+)

Fired when a worktree is being created via `--worktree` flag or `isolation: "worktree"` in an agent definition. When a WorktreeCreate hook is configured, it **replaces the default git worktree behavior**, enabling support for non-git VCS systems (SVN, Perforce, Mercurial, etc.).

The hook receives a `name` slug and **must print the absolute path** to the created worktree directory on stdout. A non-zero exit code blocks worktree creation.

```json
{
  "hook_event_name": "WorktreeCreate",
  "session_id": "abc123",
  "cwd": "/project/path",
  "name": "feature-auth"
}
```

Only `type: "command"` hooks are supported. No matcher support.

#### WorktreeRemove (2.1.50+)

Fired when a worktree is being removed (session exit or subagent completion). The hook receives the `worktree_path` that was created. WorktreeRemove hooks **cannot block** removal; failures are logged in debug mode only.

```json
{
  "hook_event_name": "WorktreeRemove",
  "session_id": "abc123",
  "cwd": "/project/path",
  "worktree_path": "/project/.claude/worktrees/feature-auth"
}
```

Only `type: "command"` hooks are supported. No matcher support.

### Stop/SubagentStop: `last_assistant_message` (2.1.47+)

The `Stop` and `SubagentStop` hook inputs now include a `last_assistant_message` field containing the final assistant message text. This allows hooks to inspect what the agent is about to respond with:

```json
{
  "hook_event_name": "Stop",
  "session_id": "abc123",
  "cwd": "/project/path",
  "last_assistant_message": "I've completed the refactoring of the auth module..."
}
```

This is useful for content-aware validation, sentiment analysis, or logging the agent's final output.

### How Hooks Narrow What They Check

Hooks do not re-check the whole tree on every run:

- **Caching** skips a hook when nothing the current session touched matches its `if_changed` patterns, then compares file hashes against the last recorded validation
- **Session filtering** hands a hook only the session's own modified files, for any command that uses `${HAN_FILES}`

Earlier versions did this with explicit session and agent checkpoints captured at `SessionStart` and `SubagentStart`. That mechanism has been removed. The `--checkpoint-type`, `--checkpoint-id`, and `--no-checkpoints` flags survive as no-ops.

## Learn More

- [Plugin Commands](/docs/cli/plugins) - Managing plugin installation
- [Configuration](/docs/configuration) - Configuring hook behavior
- [MCP Integrations](/docs/integrations) - How hooks integrate with MCP
