---
name: hook-system
summary: Complete hook lifecycle from definition to execution with checkpoint filtering and cross-plugin dependencies
---

# Hook System

Complete hook lifecycle from definition to execution.

## Overview

The Han hook system integrates with Claude Code to execute hooks at specific lifecycle events. It supports two parallel mechanisms:

1. **Plugin hooks.json** - Claude Code event-based hooks (Stop, UserPromptSubmit, etc.)
2. **Plugin han-plugin.yml / han-config.json** - Directory-targeted validation hooks with caching

## Architecture

### Hook Types

**Claude Code Event Hooks:**

- `SessionStart` - When Claude Code session begins
- `SessionEnd` - When session ends
- `UserPromptSubmit` - When user submits a prompt
- `Stop` - When Claude completes a response
- `SubagentStart` - When a subagent starts
- `SubagentStop` - When a subagent completes
- `PreToolUse` / `PostToolUse` - Around tool execution
- `Notification` - For notifications
- `PreCompact` - Before context compaction

**Han Validation Hooks:**

- Defined in `han-plugin.yml` (preferred) or `han-config.json` (legacy)
- Target specific directories based on marker files
- Support caching for performance
- Support checkpoint filtering for session-scoped execution

### Components

```
hooks.json                 Claude Code integration
    ↓
hook/dispatch.ts           Aggregates plugin hooks + captures checkpoints
    ↓
han-plugin.yml             Plugin hook definitions (YAML, preferred)
han-config.json            Plugin hook definitions (JSON, legacy)
    ↓
hook/run.ts                Executes in directories
    ↓
validate.ts                Execution with caching + checkpoint filtering
    ↓
checkpoint.ts              Session/agent checkpoint management
```

## Checkpoint System

Checkpoints capture file state at session/agent start to scope hook execution to only files changed during the current session.

### Problem Solved

In large monorepos, hooks can run on ALL files changed since the last hook execution - including pre-existing issues unrelated to current work. Checkpoints solve this by filtering to only files changed during the current session.

### Checkpoint Flow

```
SessionStart:
  1. Collect all ifChanged patterns from enabled plugins
  2. Hash all matching files
  3. Save checkpoint to checkpoints/session-{id}.json

SubagentStart:
  1. Extract agent_id from stdin payload
  2. Hash all matching files  
  3. Save checkpoint to checkpoints/agent-{id}.json

Stop/SubagentStop (hook execution):
  1. Load session/agent checkpoint
  2. For each directory:
     - Check cache: changed since last hook run?
     - Check checkpoint: changed since session/agent start?
     - Run only if BOTH conditions are true
```

### Intersection Logic

Hooks run only when files have changed since BOTH:

1. Last successful hook run (cache manifest)
2. Session/agent checkpoint creation

This ensures pre-existing issues don't block new work.

### Configuration via han.yml

```yaml
# ~/.claude/han.yml, .claude/han.yml, or .claude/han.local.yml
hooks:
  enabled: true       # Master switch (default: true)
  checkpoints: true   # Enable checkpoints (default: true)
```

See [Checkpoint System](./checkpoint-system.md) for full details.

## Configuration Formats

### Plugin Hook Definition (han-plugin.yml - Preferred)

The YAML format uses snake_case keys:

```yaml
hooks:
  lint:
    command: "npx -y biome check --write"
    dirs_with:
      - "biome.json"
    if_changed:
      - "**/*.{js,ts}"
    idle_timeout: 5000
    description: "Lint with Biome"

  test:
    command: "bun test"
    dirs_with:
      - "bun.lock"
    dir_test: "test -f package.json"
    if_changed:
      - "**/*.ts"
    depends_on:
      - plugin: jutsu-biome
        hook: lint
        optional: true
```

**Properties:**

- `command` (required) - Shell command to execute
- `dirs_with` (optional) - Marker files for target directories
- `dir_test` (optional) - Command to filter directories (exit 0 = include)
- `if_changed` (optional) - Glob patterns for cache-based execution
- `idle_timeout` (optional) - Max idle time before timeout (ms)
- `description` (optional) - Human-readable description
- `depends_on` (optional) - Array of hook dependencies (see [Hook Dependencies](#hook-dependencies))

### Plugin Hook Definition (han-config.json - Legacy)

The JSON format uses camelCase keys:

```json
{
  "hooks": {
    "lint": {
      "command": "npx -y biome check --write",
      "dirsWith": ["biome.json"],
      "ifChanged": ["**/*.{js,ts}"],
      "idleTimeout": 5000,
      "dependsOn": [
        { "plugin": "other-plugin", "hook": "prepare", "optional": true }
      ]
    }
  }
}
```

### User Settings Precedence

Configuration is loaded from multiple files with increasing priority:

```
~/.claude/han.yml         # Global user defaults (lowest)
.claude/han.yml           # Project team settings
.claude/han.local.yml     # Personal project settings (gitignored)
./han.yml                 # Project root config
<dir>/han.yml             # Directory-specific (highest)
```

### User Override Format (han.yml)

Users can override plugin hook settings in han.yml files:

```yaml
hooks:
  enabled: true
  checkpoints: true

plugins:
  jutsu-biome:
    hooks:
      lint:
        enabled: true
        command: "npx biome check --write ."
        if_changed:
          - "**/*.{js,ts,tsx}"
        idle_timeout: 30000

  jutsu-playwright:
    hooks:
      test:
        enabled: false  # Disable for this project
```

### Legacy User Override (han-config.yml)

The legacy flat format is still supported:

```yaml
plugin-name:
  hook-name:
    enabled: true
    command: "custom command"
    if_changed:
      - "custom/**/*.ts"
    idle_timeout: 60000
```

## Hook Dependencies

Hooks can declare dependencies on other plugin hooks. When a hook with dependencies runs, it waits for (or triggers) its dependencies first.

### Schema

```yaml
# han-plugin.yml
hooks:
  test:
    command: "npx playwright test"
    dirs_with: ["playwright.config.ts"]
    depends_on:
      - plugin: jutsu-playwright-bdd
        hook: generate
        optional: true  # Don't fail if plugin not installed
```

**Properties:**

- `plugin` (required) - Name of the dependency plugin
- `hook` (required) - Hook name within that plugin
- `optional` (default: false) - If true, skip silently when plugin not installed

### Behavior

1. **Required dependency not installed**: Execution fails with error
2. **Optional dependency not installed**: Dependency skipped, hook proceeds
3. **Dependency already running**: Wait for it to complete (no duplicate execution)
4. **Dependency not running**: Spawn and wait for it to complete

### Coordination

Dependencies use the lock system (`lib/hooks/hook-lock.ts`) to coordinate:

```typescript
// Check if a hook is currently running
isHookRunning(manager: LockManager, pluginName: string, hookName: string): boolean

// Wait for a hook to complete (polls lock file)
waitForHook(manager: LockManager, pluginName: string, hookName: string, timeout?: number): Promise<boolean>
```

**Lock naming**: `<session-id>/<plugin-name>/<hook-name>/<directory-hash>`

### Skip Dependencies Flag

For recheck scenarios where a hook failed and is being retried, use `--skip-deps`:

```bash
han hook run jutsu-playwright test --skip-deps
```

This prevents re-running dependencies that already completed successfully.

### Constraints

- **Same hookType only**: Dependencies must be within the same Claude Code event (Stop→Stop, SessionStart→SessionStart, etc.)
- **No circular dependencies**: Self-referential or cyclic dependencies will error
- **Cross-directory**: Dependencies resolve across all matching directories

### Example: Playwright with BDD

```yaml
# jutsu-playwright-bdd/han-plugin.yml
hooks:
  generate:
    command: "npx bddgen"
    dirs_with: ["playwright.config.ts"]
    if_changed: ["**/*.feature", "**/steps/**/*.ts"]

# jutsu-playwright/han-plugin.yml
hooks:
  test:
    command: "npx playwright test"
    dirs_with: ["playwright.config.ts"]
    depends_on:
      - plugin: jutsu-playwright-bdd
        hook: generate
        optional: true
```

**Result:**
- If jutsu-playwright-bdd installed: runs `bddgen` first, then `playwright test`
- If not installed: just runs `playwright test`

## API / Interface

### hooks.json Format

```json
{
  "hooks": {
    "Stop": [
      {
        "hooks": [
          {
            "type": "command",
            "command": "han hook run plugin-name hook-name",
            "timeout": 120
          }
        ]
      }
    ]
  }
}
```

**Hook Entry Properties:**

- `type` - `"command"` (execute) or `"prompt"` (output text)
- `command` - Shell command (supports `${CLAUDE_PLUGIN_ROOT}`)
- `prompt` - Static text for prompt hooks
- `timeout` - Execution timeout in seconds (default: 30000)

### CLI Commands

#### `han hook run <plugin> <hook> [options]`

Execute a plugin hook in matching directories.

**Options:**

- `--fail-fast` - Stop on first failure
- `--cached` - Only run if files changed
- `--only <dir>` - Limit to specific directory
- `--verbose` - Show detailed output
- `--checkpoint-type <type>` - Checkpoint type (session or agent)
- `--checkpoint-id <id>` - Checkpoint ID for filtering
- `--skip-deps` - Skip dependency resolution (for retry scenarios)

#### `han hook dispatch <hookType>`

Dispatch Claude Code hooks across all enabled plugins.

#### `han hook verify <hookType>`

Verify that all hooks of a specific type have been run and are cached.

#### `han checkpoint list`

List active session and agent checkpoints.

#### `han checkpoint clean [--max-age <hours>]`

Remove stale checkpoints (default: older than 24 hours).

## Behavior

### Hook Dispatch Flow

```
1. Read stdin JSON payload (session_id, agent_id, hook_event_name)
2. If SessionStart/SubagentStart: capture checkpoint
3. Get merged plugins and marketplaces
4. For each enabled plugin:
   a. Load hooks.json
   b. Find matching hook type
   c. Execute command hooks with checkpoint context
   d. Collect prompt hooks
5. Output aggregated results to stdout
```

### Hook Execution Flow

```
1. Load plugin config (han-plugin.yml or han-config.json)
2. Discover target directories (dirs_with/dirsWith markers)
3. For each directory:
   a. Check cache (if --cached)
   b. Check checkpoint (if checkpoint context provided)
   c. Load user overrides (from han.yml precedence chain)
   d. Acquire execution slot
   e. Execute command with environment
   f. Monitor for idle timeout
   g. Update cache on success
4. Report results
```

### Caching

Cache location: `~/.claude/projects/{project-slug}/han/`

**Change Detection:**

1. Expand glob patterns against directory
2. Compute SHA256 hash for each file
3. Compare against cached manifest
4. Run hook only if changes detected

**Automatic Patterns:**

- Always includes `han-config.yml`, `han-config.json`, `han-plugin.yml`, `han.yml`
- Plugin files tracked separately

### Parallelism

- Slot-based concurrency (default: CPU count / 2)
- Lock files in `/tmp/han-hooks/{session}/`
- Cross-process failure signaling via sentinel files

### Environment Variables

**Provided to hooks:**

- `CLAUDE_PLUGIN_ROOT` - Plugin directory path
- `CLAUDE_PROJECT_DIR` - Current project root
- `HAN_SESSION_ID` - Session identifier
- `HAN_CHECKPOINT_TYPE` - Checkpoint type (session/agent)
- `HAN_CHECKPOINT_ID` - Checkpoint ID for filtering

**Configuration:**

- `HAN_DISABLE_HOOKS` - When set to "true" or "1", all hook commands exit 0 silently without executing
- `HAN_HOOK_PARALLELISM` - Max concurrent hooks
- `HAN_HOOK_LOCK_TIMEOUT` - Stale lock timeout
- `HAN_DEBUG` - Enable debug output

## Config Synchronization

During transition, both JSON and YAML formats are supported. The sync lint ensures they stay consistent:

```bash
# Check if configs are in sync
bun run lint:config-sync

# Convert JSON to YAML
bun run convert-config -- --all
```

## Files

- `lib/commands/hook/dispatch.ts` - Claude Code hook dispatch + checkpoint capture
- `lib/commands/hook/run.ts` - Hook execution command
- `lib/commands/hook/verify.ts` - Hook cache verification
- `lib/commands/checkpoint/index.ts` - Checkpoint CLI commands
- `lib/validate.ts` - Core execution logic with checkpoint filtering
- `lib/checkpoint.ts` - Checkpoint capture and comparison
- `lib/han-settings.ts` - han.yml settings loading with full precedence
- `lib/hook-config.ts` - Configuration loading (YAML and JSON)
- `lib/hook-cache.ts` - Cache management
- `lib/hooks/hook-lock.ts` - Parallelism control and dependency coordination
- `scripts/convert-plugin-config.ts` - JSON to YAML conversion
- `scripts/lint-plugin-config-sync.ts` - Sync verification
- `bushido/hooks/pre-push-check.sh` - Pre-push verification script

## Pre-Push Verification

The bushido plugin includes a PreToolUse hook that automatically verifies Stop hooks before git push:

**Flow**:

1. User runs `git push`
2. PreToolUse hook detects the command
3. Runs `han hook verify Stop` to check if hooks are cached
4. If hooks are stale:
   - Automatically runs `han hook dispatch Stop`
   - Waits for hooks to complete
   - Proceeds with push if successful
   - Blocks push if hooks fail
5. If hooks are cached, proceeds immediately

**Script**: `bushido/hooks/pre-push-check.sh`

This ensures code quality checks (tests, linting, etc.) always run before pushing to remote.

## Related Systems

- [Checkpoint System](./checkpoint-system.md) - Session/agent checkpoint management
- [Settings Management](./settings-management.md) - Plugin discovery
- [MCP Server](./mcp-server.md) - Exposes hooks as MCP tools
