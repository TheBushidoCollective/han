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
| `Stop` | Before response completes | Main validation point |
| `SubagentStop` | Subagent completes | Validate agent work |
| `SessionStart` | Session begins | Initialization |
| `PreToolUse` | Before tool execution | Input validation |
| `PostToolUse` | After tool execution | Result processing |

By default, validation and tool plugin hooks run at `Stop` and `SubagentStop`. Claude Code executes plugin hooks directly - you just define what to run.

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
| `CLAUDE_PROJECT_ROOT` | Project root directory |
| `CLAUDE_PLUGIN_ROOT` | Plugin installation directory |
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
