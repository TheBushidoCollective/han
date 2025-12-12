---
name: checkpoint-system
summary: Session and agent checkpoints for scoped hook execution
---

# Checkpoint System

Session and agent checkpoints for scoped hook execution in large monorepos.

## Overview

The checkpoint system solves a critical problem in large monorepos: hooks running on ALL files changed since the last hook execution, including pre-existing issues unrelated to the current session's work.

**Solution:** Capture file state at session/agent start. Hooks only run on files that changed BOTH since the last hook run AND during the current session/agent (intersection logic).

## Architecture

### Checkpoint Flow

```
SessionStart:
  1. Load enabled plugins and their ifChanged patterns
  2. Hash all matching files
  3. Save checkpoint to ~/.claude/projects/{slug}/han/checkpoints/session-{id}.json

SubagentStart:
  1. Extract agent_id from stdin payload
  2. Hash all matching files
  3. Save checkpoint to ~/.claude/projects/{slug}/han/checkpoints/agent-{id}.json

Stop (hook execution):
  1. Load session checkpoint (fallback to no filtering if missing)
  2. For each file in ifChanged patterns:
     - If file changed since checkpoint AND since last hook run → run hook
     - Otherwise → skip
  3. Update cache manifest (existing behavior)

SubagentStop (hook execution):
  1. Load agent checkpoint for this agent_id
  2. Same filtering logic as Stop
  3. Agent checkpoints scoped to just that agent's work
```

### File Structure

```
~/.claude/projects/{slug}/han/
├── checkpoints/
│   ├── session-{session_id}.json
│   └── agent-{agent_id}.json
├── {plugin}_{hook}.json  (existing cache)
```

### Checkpoint File Format

```json
{
  "created_at": "2025-12-11T10:30:00.000Z",
  "patterns": ["**/*.ts", "**/*.tsx"],
  "files": {
    "src/foo.ts": "sha256hash",
    "src/bar.ts": "sha256hash"
  }
}
```

## Configuration

### han.yml Settings

Locations (merged in order, later overrides earlier):

1. `~/.claude/han.yml` (user global)
2. `.claude/han.yml` (project, committed)
3. `.claude/han.local.yml` (project, gitignored)

```yaml
hooks:
  enabled: true       # Master switch (default: true)
  checkpoints: true   # Enable session checkpoints (default: true)
```

## API

### Core Module (`lib/checkpoint.ts`)

```typescript
// Get checkpoint directory path
getCheckpointDir(): string

// Get path for specific checkpoint
getCheckpointPath(type: 'session' | 'agent', id: string): string

// Gather all ifChanged patterns from enabled plugins
collectIfChangedPatterns(): string[]

// Capture current file state as checkpoint
captureCheckpoint(type: 'session' | 'agent', id: string): Promise<void>

// Load checkpoint from disk
loadCheckpoint(type: 'session' | 'agent', id: string): Checkpoint | null

// Check if files changed since checkpoint
hasChangedSinceCheckpoint(
  checkpoint: Checkpoint,
  directory: string,
  patterns: string[]
): boolean

// Clean old checkpoints
cleanupOldCheckpoints(maxAgeMs?: number): number
```

### Settings Module (`lib/han-settings.ts`)

```typescript
// Check if checkpoints are enabled
isCheckpointsEnabled(): boolean

// Check if hooks master switch is enabled
isHooksEnabled(): boolean

// Get merged config from all scopes
getMergedHanConfig(): HanConfig
```

## CLI Commands

```bash
# List active checkpoints
han checkpoint list

# Clean stale checkpoints (default: older than 24h)
han checkpoint clean
han checkpoint clean --max-age 48
```

## MCP Tools

- `checkpoint_list` - List checkpoints for current project
- `checkpoint_clean` - Clean stale checkpoints

## Behavior

### Intersection Logic

For a hook to run on a directory, files must satisfy BOTH conditions:

1. **Changed since last hook run** (existing cache behavior)
2. **Changed since session/agent start** (new checkpoint filter)

```typescript
const changedSinceLastRun = checkForChanges(pluginName, hookName, dir, patterns);
const changedSinceCheckpoint = checkpoint
  ? hasChangedSinceCheckpoint(checkpoint, dir, patterns)
  : true; // No checkpoint = run all (graceful degradation)

const shouldRun = changedSinceLastRun && changedSinceCheckpoint;
```

### Graceful Degradation

- Missing checkpoint → falls back to existing behavior (no filtering)
- Invalid checkpoint → logged warning, falls back to existing behavior
- Checkpoints disabled → existing behavior

### Automatic Cleanup

Old checkpoints (default: >24h) are automatically cleaned to prevent disk bloat.

## Files

- `lib/checkpoint.ts` - Core checkpoint logic
- `lib/han-settings.ts` - han.yml loading and merging
- `lib/validate.ts` - Hook execution with checkpoint filtering
- `lib/commands/hook/dispatch.ts` - Checkpoint capture at SessionStart/SubagentStart
- `lib/commands/checkpoint/index.ts` - CLI commands
- `schemas/han.schema.json` - han.yml JSON schema

## Related Systems

- [Hook System](./hook-system.md) - Uses checkpoints for scoped execution
- [Native Module](./native-module.md) - Provides fast file hashing for checkpoints
