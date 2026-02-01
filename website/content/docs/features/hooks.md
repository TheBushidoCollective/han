---
title: "Hook System"
description: "Understanding Han's hook lifecycle for automated quality validation at every stage of your Claude Code workflow."
---

Han's hook system automatically validates your code at key moments during Claude Code sessions. No manual commands, no forgotten checks - quality gates that run themselves.

## Why Hooks?

Traditional validation requires discipline: remember to lint, remember to test, remember to type-check. Claude doesn't forget, but without hooks, validation becomes an afterthought.

Hooks make validation **automatic**. Write code, finish your conversation, and hooks validate everything before you move on.

## The Hook Lifecycle

Han hooks into Claude Code's execution at specific points:

| Hook | When It Fires | Purpose |
|------|---------------|---------|
| `SessionStart` | Session begins | Initialize state, capture checkpoints |
| `SubagentStart` | Subagent spawns | Capture agent checkpoint |
| `UserPromptSubmit` | Before processing input | Pre-process, inject context |
| `PreToolUse` | Before tool execution | Validate tool calls |
| `PostToolUse` | After tool execution | Process results |
| `Stop` | Before response | **Main validation point** |
| `SubagentStop` | Subagent completes | Validate agent's work |
| `SessionEnd` | Session ends | Cleanup |

Most validation happens at `Stop` and `SubagentStop` - the natural checkpoints after work is done.

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

### Checkpoint Integration

- **SessionStart**: Creates session checkpoint
- **SubagentStart**: Creates agent checkpoint
- **Stop**: Validates against session checkpoint
- **SubagentStop**: Validates against agent checkpoint

This ensures hooks only check files that changed since the relevant checkpoint.

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

Han supports two types of hooks:

### Command Hooks

Execute shell commands:

```json
{
  "type": "command",
  "command": "han hook run biome lint",
  "timeout": 120
}
```

## Smart Behaviors

Han hooks are intelligent by default (as of v2.0.0):

### Caching

Skip hooks when files haven't changed:

- Compares file hashes to previous run
- Only re-validates modified files
- Dramatically speeds up repeated runs

### Fail-Fast

Stop on first failure:

- Don't waste time running all hooks
- Get feedback immediately
- Continue with `--no-fail-fast` when needed

### Checkpoint Filtering

Only validate your work:

- Session hooks filter to session changes
- Agent hooks filter to agent changes
- Pre-existing issues are out of scope

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

When transcript filtering is active:

- `${HAN_FILES}` is replaced with the session's modified files that match `if_changed` patterns
- If no files match, `${HAN_FILES}` is replaced with `.` (fallback to full directory)
- Commands without `${HAN_FILES}` run unchanged (backward compatible)
- When `cache=false` or transcript filter is disabled, `${HAN_FILES}` is replaced with `.` to run on all files

This prevents the scenario where Session A's lint error causes Session B's hook to also fail.

All four smart behaviors are enabled by default. Disable with `--no-cache`, `--no-fail-fast`, `--no-checkpoints`, or configure `transcript_filter: false`.

## Configuration

### Global Settings

In `han.yml`:

```yaml
hooks:
  enabled: true       # Master switch
  cache: true         # Smart caching (default: true)
  fail_fast: true     # Stop on first failure (default: true)
  checkpoints: true   # Session-scoped filtering (default: true)
```

### Per-Plugin Settings

```yaml
plugins:
  biome:
    hooks:
      lint:
        enabled: true
        command: npx biome check --write .
        cache: true
        if_changed:
          - "**/*.ts"
          - "**/*.tsx"
```

### Conditional Execution

Only run in directories with specific files:

```yaml
plugins:
  typescript:
    hooks:
      typecheck:
        dirs_with:
          - tsconfig.json
```

Only run when specific patterns changed:

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

1. **Built-in defaults**: All features enabled
2. **`han.yml`**: Your configuration
3. **CLI flags**: `--no-cache`, `--no-fail-fast`
4. **Environment variables**: `HAN_NO_CACHE=1`

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
han hook info biome lint
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

- Learn about [checkpoints](/docs/features/checkpoints) for session-scoped validation
- Explore [configuration](/docs/configuration) for fine-tuning
- See [CLI commands](/docs/cli/hooks) for manual execution
