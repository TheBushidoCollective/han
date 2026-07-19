---
title: "Hook Configuration"
description: "Complete reference for configuring validation hooks in han-plugin.yml, including commands, conditions, and caching."
---

Hooks are the heart of validation and tool plugins, enabling automatic validation at key points during Claude Code sessions. This guide covers everything you need to know about configuring hooks.

## Hook Configuration File

Hooks are defined in `han-plugin.yml` at your plugin's root:

```yaml
# my-plugin/han-plugin.yml
hooks:
  hook-name:
    command: "your-validation-command"
    dirs_with:
      - "config-file.json"
    if_changed:
      - "**/*.{js,ts}"
```

## Basic Hook Structure

Each hook has a unique name and configuration:

```yaml
hooks:
  lint:
    command: "npx eslint ${HAN_FILES}"
    dirs_with:
      - ".eslintrc.js"
      - ".eslintrc.json"
      - "eslint.config.js"
    if_changed:
      - "**/*.{js,jsx,ts,tsx}"
```

## Configuration Options

### command (required)

The shell command to execute. Use `${HAN_FILES}` for session-scoped file targeting:

```yaml
hooks:
  lint:
    # Without HAN_FILES - runs on all files
    command: "npx eslint ."

  lint-targeted:
    # With HAN_FILES - runs only on session-modified files
    command: "npx eslint ${HAN_FILES}"
```

**How `${HAN_FILES}` works:**

1. Han tracks which files the current session modified
2. Files are filtered against `if_changed` patterns
3. Matching files are passed to the command
4. If no files match, `${HAN_FILES}` becomes `.` (full directory)

### dirs_with (optional)

Only run the hook in directories containing these files:

```yaml
hooks:
  typecheck:
    command: "npx tsc --noEmit"
    dirs_with:
      - "tsconfig.json"
```

**Multiple conditions** (any match triggers):

```yaml
hooks:
  lint:
    command: "npx biome check ."
    dirs_with:
      - "biome.json"
      - "biome.jsonc"
```

This is useful for:

- Tools that require configuration files
- Monorepos where tools only apply to certain packages
- Optional validations that should only run when configured

### if_changed (optional)

Only run when files matching these patterns changed:

```yaml
hooks:
  test:
    command: "npm test"
    if_changed:
      - "**/*.ts"
      - "**/*.test.ts"
      - "**/__tests__/**"
```

**Pattern syntax** follows glob conventions:

- `*` - Match any characters except `/`
- `**` - Match any characters including `/`
- `?` - Match single character
- `{a,b}` - Match either `a` or `b`
- `[abc]` - Match any character in set

### timeout (optional)

Maximum execution time in seconds (default: 120):

```yaml
hooks:
  test:
    command: "npm test"
    timeout: 300  # 5 minutes for slow tests
```

### enabled (optional)

Disable a hook without removing it:

```yaml
hooks:
  experimental:
    command: "my-experimental-check"
    enabled: false  # Won't run
```

## Hook Lifecycle

Hooks run at specific points during Claude Code sessions:

| Event | When | Best For |
|-------|------|----------|
| `SessionStart` | Session begins | Initialization |
| `Setup` | `--init` / `--maintenance` runs | One-time CI/script preparation |
| `UserPromptSubmit` | Before processing input | Pre-process, inject context |
| `UserPromptExpansion` | Slash command expands into a prompt | Guard or augment skill invocations |
| `PreToolUse` | Before tool execution | Input validation |
| `PermissionRequest` | Permission dialog appears (~2.1.50+) | Audit/auto-approve permissions |
| `PermissionDenied` | Auto-mode classifier denies a tool call (2.1.89+) | Let the model retry with `{retry: true}` |
| `PostToolUse` | After tool execution | Result processing |
| `PostToolUseFailure` | Tool execution fails (~2.1.50+) | Error tracking, recovery |
| `PostToolBatch` | A parallel batch of tool calls resolves | Batch-level feedback before the next model call |
| `Stop` | Before response completes | Main validation point |
| `StopFailure` | Turn ends on API error (2.1.78+) | Notification/logging only |
| `SubagentStart` | Subagent spawned | Inject context into subagents |
| `SubagentStop` | Subagent completes | Validate agent work |
| `TaskCreated` | Task created via `TaskCreate` (2.1.84+) | Gate task creation |
| `TaskCompleted` | Task completed (2.1.33+) | Task tracking, workflows |
| `TeammateIdle` | Teammate goes idle (2.1.33+) | Team coordination |
| `Notification` | Notification event | Custom notification handling |
| `MessageDisplay` | Assistant text is displayed (2.1.152+) | Transform displayed text |
| `InstructionsLoaded` | CLAUDE.md/rules file loads (2.1.69+) | Observability |
| `ConfigChange` | Configuration modified (2.1.49+) | Audit trails, config monitoring |
| `CwdChanged` | Working directory changes (2.1.83+) | Reactive env management (direnv-style) |
| `FileChanged` | Watched file changes on disk (2.1.83+) | Reactive reloads |
| `PreCompact` | Before context compaction (~2.1.50+, blocking since 2.1.105) | Save state before compaction |
| `PostCompact` | After context compaction (2.1.76+) | Post-compaction cleanup |
| `Elicitation` | MCP server requests user input (2.1.76+) | Auto-answer MCP elicitations |
| `ElicitationResult` | User responds to an MCP elicitation (2.1.76+) | Override elicitation responses |
| `WorktreeCreate` | Worktree created (2.1.50+) | Agent isolation tracking, custom VCS |
| `WorktreeRemove` | Worktree removed (2.1.50+) | Cleanup automation |
| `SessionEnd` | Session ends | Cleanup |

By default, validation and tool plugin hooks run at `Stop` and `SubagentStop`. Claude Code executes plugin hooks directly - you just define what to run. Han's `han-plugin.yml` accepts every event above as of Claude Code 2.1.215.

### New Hook Events (Claude Code 2.1.33+)

Several hook events have been added for permission auditing, error tracking, team workflows, and operational monitoring:

#### PermissionRequest (~2.1.50+)

Fired when a permission dialog appears. Supports matcher on tool name. Input includes `permission_suggestions` array. Can respond with `behavior` (`allow`/`deny`), `updatedInput`, `updatedPermissions`, `message`, or `interrupt`:

```json
{
  "hook_event_name": "PermissionRequest",
  "session_id": "abc123",
  "cwd": "/project/path",
  "tool_name": "Bash",
  "permission_suggestions": [...]
}
```

#### PostToolUseFailure (~2.1.50+)

Fired when a tool execution fails. Input includes `error` string and `is_interrupt` boolean. Can return `additionalContext` to help Claude recover:

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

#### PreCompact (~2.1.50+)

Fired before context compaction. Supports matcher for `manual` vs `auto` compaction:

```json
{
  "hook_event_name": "PreCompact",
  "session_id": "abc123",
  "cwd": "/project/path"
}
```

#### ConfigChange (2.1.49+)

Fired when Claude Code configuration is modified. Useful for audit trails, configuration drift detection, and enforcing settings policies:

```json
{
  "hook_event_name": "ConfigChange",
  "session_id": "abc123",
  "cwd": "/project/path"
}
```

#### TeammateIdle (2.1.33+)

Fired when a teammate agent goes idle between turns in multi-agent sessions. Enables team coordination, load balancing, and monitoring agent activity:

```json
{
  "hook_event_name": "TeammateIdle",
  "session_id": "abc123",
  "cwd": "/project/path"
}
```

#### TaskCompleted (2.1.33+)

Fired when a task is marked as completed via `TaskUpdate`. Useful for task tracking dashboards, triggering follow-up workflows, and team notifications:

```json
{
  "hook_event_name": "TaskCompleted",
  "session_id": "abc123",
  "cwd": "/project/path"
}
```

#### WorktreeCreate (2.1.50+)

Fired when a worktree is being created via `--worktree` flag or `isolation: "worktree"` in an agent definition. When configured, **replaces default git worktree behavior** — enabling non-git VCS support (SVN, Perforce, Mercurial).

The hook receives a `name` slug and **must print the absolute path** to the created worktree directory on stdout. Non-zero exit blocks creation. Only `type: "command"` hooks supported; no matchers.

```json
{
  "hook_event_name": "WorktreeCreate",
  "session_id": "abc123",
  "cwd": "/project/path",
  "name": "feature-auth"
}
```

#### WorktreeRemove (2.1.50+)

Fired when a worktree is being removed. Receives the `worktree_path` that was originally created. **Cannot block** removal — failures are logged in debug mode only. Only `type: "command"` hooks supported; no matchers.

```json
{
  "hook_event_name": "WorktreeRemove",
  "session_id": "abc123",
  "cwd": "/project/path",
  "worktree_path": "/project/.claude/worktrees/feature-auth"
}
```

### Hook Handler Types and Advanced Fields (Claude Code 2.1.x)

Generated `hooks/hooks.json` files are always `type: "command"` hooks, but a plugin can also ship a hand-authored `hooks/hooks.json` (like the core plugin does) that uses the full Claude Code hook schema:

- **Handler types**: `command` (shell), `http` (POST the event JSON to a URL), `mcp_tool` (call a tool on a connected MCP server, 2.1.118+), `prompt` (single-turn LLM yes/no evaluation), and `agent` (experimental agentic verifier with tools).
- **Exec form**: set `args: [...]` to spawn `command` directly without a shell (2.1.139+). Safer for paths with spaces; required if you reference `${user_config.*}` values (2.1.207+).
- **`if` conditions**: permission-rule syntax filtering at the handler level, e.g. `"if": "Bash(git *)"` (2.1.85+).
- **`async: true` / `asyncRewake: true`**: run in background; `asyncRewake` wakes Claude with the hook's stderr when it exits 2. Note that decision fields have no effect from async hooks.
- **Matchers**: `|` separates exact tool names; `,` also works (2.1.191+); anything else is treated as a JavaScript regex. Hyphenated names match exactly (2.1.195+).

Prompt and agent hooks must return `{"ok": true|false, "reason": "..."}`; `ok: false` becomes a `decision: "block"` for the event.

### Stop/SubagentStop: `last_assistant_message` (2.1.47+)

The `Stop` and `SubagentStop` hook inputs include a `last_assistant_message` field containing the final assistant message text. This allows hooks to inspect what the agent is about to respond with and take action based on the content:

```json
{
  "hook_event_name": "Stop",
  "session_id": "abc123",
  "cwd": "/project/path",
  "last_assistant_message": "I've completed the refactoring of the auth module..."
}
```

This is useful for content-aware validation, sentiment analysis, or logging the agent's final output.

## Smart Behaviors

Han hooks include intelligent features enabled by default:

### Caching

Hooks skip when:

- No files changed since last run
- File hashes match previous execution
- Command and configuration unchanged

This dramatically speeds up repeated validations.

### Checkpoint Filtering

Hooks only validate your work:

- Session hooks filter to session changes
- Subagent hooks filter to subagent changes
- Pre-existing issues are ignored

### Fail-Fast

By default, hooks stop on first failure:

- Get feedback immediately
- Don't waste time on subsequent hooks
- Fix issues one at a time

## Complete Examples

### Linter Hook

```yaml
hooks:
  lint:
    command: "npx eslint ${HAN_FILES} --fix"
    dirs_with:
      - ".eslintrc.js"
      - ".eslintrc.json"
      - "eslint.config.js"
    if_changed:
      - "**/*.{js,jsx,ts,tsx}"
```

### Type Checker Hook

```yaml
hooks:
  typecheck:
    command: "npx tsc --noEmit"
    dirs_with:
      - "tsconfig.json"
    if_changed:
      - "**/*.{ts,tsx,mts,cts}"
      - "tsconfig*.json"
```

### Test Runner Hook

```yaml
hooks:
  test:
    command: "npm test"
    timeout: 300
    if_changed:
      - "**/*.ts"
      - "**/*.test.ts"
      - "**/__tests__/**"
```

### Formatter Hook

```yaml
hooks:
  format:
    command: "npx prettier --write ${HAN_FILES}"
    dirs_with:
      - ".prettierrc"
      - ".prettierrc.json"
      - "prettier.config.js"
    if_changed:
      - "**/*.{js,jsx,ts,tsx,json,md}"
```

### Build Hook

```yaml
hooks:
  build:
    command: "npm run build"
    timeout: 180
    dirs_with:
      - "package.json"
    if_changed:
      - "src/**/*.{ts,tsx}"
      - "package.json"
```

## Multiple Hooks

A plugin can define multiple hooks:

```yaml
hooks:
  lint:
    command: "npx biome check --write ${HAN_FILES}"
    dirs_with:
      - "biome.json"
    if_changed:
      - "**/*.{js,jsx,ts,tsx}"

  typecheck:
    command: "npx tsc --noEmit"
    dirs_with:
      - "tsconfig.json"
    if_changed:
      - "**/*.{ts,tsx}"

  test:
    command: "npm test"
    timeout: 300
    if_changed:
      - "**/*.ts"
      - "**/*.test.ts"
```

## Environment Variables

Hooks have access to these environment variables:

| Variable | Description |
|----------|-------------|
| `CLAUDE_SESSION_ID` | Current session ID |
| `CLAUDE_PROJECT_DIR` | Project root directory |
| `CLAUDE_PLUGIN_ROOT` | Plugin installation directory (changes on update) |
| `CLAUDE_PLUGIN_DATA` | Persistent plugin data directory (survives updates, 2.1.78+) |
| `HAN_SESSION_ID` | Session ID (alias) |

Use plugin root for relative paths:

```yaml
hooks:
  validate:
    command: "bash ${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh"
```

## Hook Scripts

For complex validation logic, use shell scripts:

**`han-plugin.yml`:**

```yaml
hooks:
  validate:
    command: "bash ${CLAUDE_PLUGIN_ROOT}/scripts/validate.sh"
    dirs_with:
      - "my-config.json"
```

**`scripts/validate.sh`:**

```bash
#!/usr/bin/env bash
set -e

# Complex validation logic here
echo "Running validation..."

# Check for specific conditions
if [ -f "my-config.json" ]; then
  npx my-validator check .
fi

# Exit 0 on success, non-zero on failure
exit 0
```

## Best Practices

1. **Use `${HAN_FILES}` when possible** - Enables session-scoped validation and better caching

2. **Always specify `dirs_with`** - Prevents hooks from running in unrelated directories

3. **Be specific with `if_changed`** - Only trigger on relevant file types

4. **Set appropriate timeouts** - Don't let slow commands block the workflow

5. **Make commands idempotent** - Running twice should produce the same result

6. **Handle errors gracefully** - Exit with non-zero status on failure, provide clear error messages

7. **Prefer npx/bunx** - Ensures tools are available without global installation:

   ```yaml
   hooks:
     lint:
       # Good - works without global install
       command: "npx eslint ."

       # Avoid - requires global installation
       # command: "eslint ."
   ```

## Debugging Hooks

Test hooks manually:

```bash
# Run a specific hook
han hook run my-plugin lint

# Run with verbose output
han hook run my-plugin lint --verbose

# Run without caching
han hook run my-plugin lint --no-cache
```

## Next Steps

- [Skills and Commands](/docs/plugin-development/skills) - Creating skills and commands
- [Testing Plugins](/docs/plugin-development/testing) - Local testing workflow
- [Distribution](/docs/plugin-development/distribution) - Sharing your plugins
