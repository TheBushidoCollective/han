---
title: "Checkpoint System"
description: "How Han's checkpoint system brings focused, incremental validation by only checking code you actually modified."
---

Han's checkpoint system applies the Boy Scout Rule to code validation: leave the code better than you found it, but don't demand perfection on day one.

## The Problem

Without checkpoints, validation hooks run against your entire codebase. Install a linting plugin on a legacy project with 500 pre-existing issues, and you're immediately overwhelmed with problems you didn't create.

This leads to:

- Developers disabling hooks in frustration
- Validation abandoned entirely
- Net result: worse quality, not better

## The Solution: Session-Scoped Validation

Checkpoints capture file states when your session starts. When hooks run, they only validate files you actually modified during that session.

```text
Session Start (t0):
├─ Checkpoint created
├─ File hashes captured for all project files

Your Work (t0 → t1):
├─ Modified: components/Button.tsx
├─ Untouched: utils/format.ts (has lint errors)

Session Stop (t1):
├─ Hook runs
├─ Filters to: components/Button.tsx only
└─ Pre-existing issues in utils/format.ts: not your problem today
```

## How Checkpoints Work

### Session Checkpoints

Created automatically at `SessionStart`:

- Captures SHA-256 hashes of all tracked files
- Stored in `~/.claude/projects/{slug}/han/checkpoints/session_{id}.json`
- Used by `Stop` hooks to filter validation scope
- Cleaned up after 24 hours

### Agent Checkpoints

For complex workflows with subagents:

- Created at `SubagentStart` for each spawned agent
- Stored as `agent_{agent_id}.json`
- Each agent's work is validated independently
- Prevents cross-contamination between parallel work

```text
Main Session (session_abc):
├─ Checkpoint: session_abc.json
├─ Spawns Subagent 1 (agent_xyz):
│  ├─ Checkpoint: agent_xyz.json
│  └─ Works on feature-a/
└─ Spawns Subagent 2 (agent_def):
   ├─ Checkpoint: agent_def.json
   └─ Works on feature-b/
```

When Subagent 1 finishes, `SubagentStop` hooks only validate its changes. Subagent 2's work is isolated.

## Transcript Filtering (v2.3.0)

Checkpoints solve isolation for subagents within a session. But what about **multiple sessions** in the same working tree?

### The Multi-Session Problem

```text
Session A: Modifies src/auth.ts, introduces lint error
Session B: Modifies src/utils.ts, runs Stop hook

Without transcript filtering:
└─ Session B's hook sees auth.ts changed (vs B's checkpoint)
└─ Session B tries to fix auth.ts
└─ Session A also tries to fix auth.ts
└─ Edit conflict!
```

### The Solution: Transcript-Based Scoping

Each session maintains a transcript of file operations. Stop hooks use this to filter:

```text
Session A: src/auth.ts in transcript → validate auth.ts only
Session B: src/utils.ts in transcript → validate utils.ts only
```

No conflicts. Each session handles only its own changes.

### How It Works

1. Claude Code records all Write/Edit operations in session transcripts
2. At `Stop`, Han extracts modified files from the transcript
3. Files are intersected with the hook's `if_changed` patterns
4. Hook runs only on files THIS session actually modified

### File-Targeted Commands

For commands that support file arguments, use `${HAN_FILES}` to pass only session-modified files:

```yaml
plugins:
  jutsu-biome:
    hooks:
      lint:
        command: npx biome check --write ${HAN_FILES}
```

This ensures Session B doesn't see (or fail on) Session A's lint errors.

When `cache=false` or transcript filtering is disabled, `${HAN_FILES}` is replaced with `.` to run on all files. Use `han hook run --cache=false` to force full validation.

### Configuration

Transcript filtering is enabled by default when checkpoints are enabled:

```yaml
hooks:
  checkpoints: true        # Enables checkpoints (default: true)
  transcript_filter: true  # Enables transcript filtering (default: true)
```

The `transcript_filter` option requires `checkpoints: true`. Disabling checkpoints automatically disables transcript filtering.

### Fallback Behavior

If a transcript can't be found or parsed, the hook runs normally (full checkpoint-based filtering). This ensures hooks never silently skip validation.

## Configuration

Checkpoints are enabled by default. All settings default to `true` as of v2.0.0.

### Disable Checkpoints

For intentional full-codebase validation:

```yaml
# han.yml
hooks:
  checkpoints: false  # Validate all changed files, not just your session's
```

Or via environment variable:

```bash
HAN_NO_CHECKPOINTS=1 han hook run jutsu-biome lint
```

Or via CLI flag:

```bash
han hook run jutsu-biome lint --no-checkpoints
```

### When to Disable

- **Tech debt sprints**: When deliberately addressing accumulated issues
- **CI pipelines**: Merge gates should validate the full codebase
- **Initial cleanup**: First-time adoption with planned fix-all session

Most day-to-day development should keep checkpoints enabled.

## CLI Commands

Manage checkpoints directly with the CLI:

### Capture a Checkpoint

```bash
# Automatic (reads stdin from hook payload)
han checkpoint capture

# Manual with explicit options
han checkpoint capture --type session --id my-session-123
han checkpoint capture --type agent --id agent-xyz
```

### List Active Checkpoints

```bash
han checkpoint list
```

Output:

```text
Active Checkpoints
==================

Session Checkpoints:
  - abc123 (captured 2 hours ago)
  - def456 (captured 1 day ago)

Agent Checkpoints:
  - agent-xyz (captured 5 minutes ago)

Total: 3 checkpoints
```

### Clean Stale Checkpoints

```bash
# Remove checkpoints older than 24 hours (default)
han checkpoint clean

# Custom age threshold
han checkpoint clean --max-age 48
```

## Integration with Hooks

Hooks automatically use checkpoints when available:

```json
{
  "hooks": {
    "SessionStart": [
      {
        "hooks": [
          { "type": "command", "command": "han checkpoint capture" }
        ]
      }
    ],
    "Stop": [
      {
        "hooks": [
          { "type": "command", "command": "han hook run jutsu-biome lint" }
        ]
      }
    ]
  }
}
```

The `Stop` hook automatically filters to files changed since the session checkpoint.

## The Boy Scout Philosophy

The checkpoint system embodies incremental improvement:

1. Touch a file → that file gets validated
2. Fix issues in code you're already changing
3. Over time, frequently-touched code gets cleaner
4. Rarely-touched code stays as-is until relevant

This is sustainable. Demanding perfection on day one isn't.

## What Checkpoints Don't Do

**Hide problems**: Pre-existing issues still exist. They surface when you touch those files.

**Replace CI**: Your CI should validate the full codebase. Checkpoints optimize the developer feedback loop.

**Persist across sessions**: Each session starts fresh. Old checkpoints are cleaned up automatically.

## Technical Details

### Checkpoint Storage

```text
~/.claude/projects/{project-slug}/han/checkpoints/
├── session_abc123.json
├── session_def456.json
└── agent_xyz789.json
```

### Checkpoint Format

```json
{
  "type": "session",
  "id": "session_abc123",
  "timestamp": "2025-12-13T08:00:00Z",
  "files": {
    "src/index.ts": "sha256:abc...",
    "src/utils.ts": "sha256:def..."
  }
}
```

### Graceful Degradation

- Missing checkpoint? Normal hook behavior (validates all changed files)
- Corrupted checkpoint? Falls back gracefully
- Never silently skips validation

### Debugging

Checkpoint capture fails silently by default to avoid blocking hooks. To see error messages:

```bash
HAN_VERBOSE=1 han checkpoint capture --type session --id test-123
```

The `HAN_VERBOSE=1` environment variable enables detailed error output for troubleshooting.

## Next Steps

- Learn about [smart caching](/docs/configuration/caching) for faster hook execution
- Explore [hook configuration](/docs/configuration) for fine-tuning
- Read about [SubagentStart/Stop hooks](/docs/cli/hooks) for agent lifecycle
