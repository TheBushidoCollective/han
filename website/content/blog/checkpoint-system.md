# Stop Getting Blamed for Code You Never Touched

## How Han's Checkpoint System Fixes Hook Fatigue in Large Monorepos

If you've worked in a large monorepo with pre-existing linting errors, you know the frustration: you change one file, and suddenly your pre-commit hooks explode with hundreds of errors from code written months ago by someone else. Your session fails. You didn't break anything. You just had the misfortune of working in the same directory.

This is hook fatigue, and it's why developers disable hooks.

Han's new Checkpoint System solves this problem with a simple insight: hooks should only care about the files **you actually changed** during **your session**.

## The Problem: Pre-Existing Blame

Traditional hook systems track changes since the last hook execution. In a fresh Claude Code session in a monorepo, this creates a painful scenario:

1. You start a session to fix a bug in `components/Button.tsx`
2. You make your changes and finish
3. The SessionStop hook runs and checks all files changed since... when exactly?
4. It finds 47 linting errors across files you never opened
5. Your session fails. You're frustrated. The code you wrote is fine.

The hook system is technically correct - those files did change between hook runs - but it's blaming you for problems that existed before you started. In large codebases with accumulated technical debt, this isn't just annoying; it's paralyzing.

Developers respond predictably: they disable the hooks.

## The Solution: Checkpoint-Based Diffing

When a Claude Code session starts, Han captures a checkpoint - a SHA-256 hash snapshot of every file in your project at that exact moment. When hooks run at session end, they filter files using intersection logic:

**A file must have changed since BOTH:**

- The checkpoint (session start), AND
- The last hook execution

This intersection ensures hooks only analyze your actual work. Pre-existing issues are gracefully ignored, not because we're hiding problems, but because they're not your responsibility in this session.

### How It Works

```
Session Start (t0):
├─ Checkpoint created: session_abc123.json
├─ File hashes captured:
   ├─ components/Button.tsx: 8f7a9b...
   ├─ utils/format.ts: 3c2d1e...
   └─ config/routes.ts: 9a8b7c...

Your Work (t0 → t1):
├─ Modified: components/Button.tsx
├─ Untouched: utils/format.ts (has lint errors, but unchanged)

Session Stop (t1):
├─ Hook runs
├─ Compares against checkpoint AND last hook
├─ Filters to: components/Button.tsx only
└─ Pre-existing issues in utils/format.ts ignored
```

## Technical Implementation

Checkpoints are stored in `~/.claude/projects/{slug}/han/checkpoints/` with automatic lifecycle management:

**Session Checkpoints**

- Created on SessionStart: `session_{session_id}.json`
- Used for top-level Claude Code sessions
- Cleaned up after 24 hours

**Agent Checkpoints**

- Created for subagents: `agent_{agent_id}.json`
- Scopes hook validation to subagent work
- Prevents one agent's failures from blocking another

**Graceful Degradation**

- Missing checkpoint? Falls back to normal hook behavior
- Ensures hooks never silently skip validation
- No breaking changes to existing workflows

### File Hash Calculation

Each checkpoint stores SHA-256 hashes of file contents:

```json
{
  "timestamp": "2025-12-12T10:30:00.000Z",
  "sessionId": "abc123",
  "files": {
    "src/index.ts": "8f7a9b2c...",
    "src/utils.ts": "3c2d1e4f..."
  }
}
```

When hooks run, Han recalculates hashes and compares:

- Changed since checkpoint? Include it.
- Unchanged since checkpoint? Skip it, even if it has issues.

## Configuration

Checkpoints work automatically when hooks are enabled. To customize:

```yaml
# han.yml
hooks:
  enabled: true       # Master switch for all hooks
  checkpoints: true   # Enable checkpoint filtering (default)
```

**Why you might disable checkpoints:**

- You want hooks to validate ALL changed files regardless of session boundaries
- You're doing a deliberate "clean sweep" of the codebase
- You're testing hook behavior and need predictable results

For most teams, the default (enabled) is the right choice.

## What This Doesn't Do

Let's be clear about what checkpoints aren't:

**Not a fix for technical debt**

- Pre-existing issues still exist
- They'll surface when those files are actually modified
- Checkpoints scope responsibility, they don't erase problems

**Not a substitute for CI**

- Your CI should still validate the entire codebase
- Checkpoints optimize the developer feedback loop
- Use both for comprehensive quality

**Not retroactive**

- Only applies to sessions started after upgrading
- Old sessions without checkpoints fall back to normal behavior

## Real-World Impact

Consider a monorepo with:

- 2,500 TypeScript files
- 300 pre-existing lint errors across 80 files
- A developer fixing a bug in 1 file

**Without checkpoints:**

- Developer changes 1 file
- Hook runs on 81 files (theirs + 80 with pre-existing errors)
- Gets 300 errors
- Session fails
- Developer disables hooks or gives up

**With checkpoints:**

- Developer changes 1 file
- Hook runs on 1 file
- Gets feedback on their actual work
- Session succeeds or fails based on their changes
- Hooks stay enabled, trust is maintained

## Subagent Isolation

In complex workflows, you might spawn subagents (separate Claude instances for subtasks). Each gets its own checkpoint:

```
Main Session (session_abc):
├─ Checkpoint: session_abc.json
├─ Spawns Subagent 1 (agent_xyz):
│  ├─ Checkpoint: agent_xyz.json
│  └─ Works on feature-a/
└─ Spawns Subagent 2 (agent_def):
   ├─ Checkpoint: agent_def.json
   └─ Works on feature-b/
```

When Subagent 1 finishes, hooks only validate changes it made since its checkpoint. Subagent 2's work is out of scope. This prevents cascading failures where one agent's issues block another's completion.

## Migration Path

Upgrading to checkpoint-enabled Han requires no migration:

1. Update Han: `han upgrade` or `brew upgrade han`
2. Checkpoints are created automatically on next session start
3. Existing workflows continue unchanged
4. No configuration required unless you want to disable checkpoints

If you're already using hooks, the experience improves immediately. If you disabled hooks because of pre-existing blame, consider re-enabling them:

```yaml
# han.yml
hooks:
  enabled: true  # Give it another try
```

## The Philosophy

Hooks exist to maintain quality, not to punish developers. When hook systems blame you for someone else's mess, they fail their purpose. Developers lose trust, disable validation, and quality suffers.

Checkpoints restore that trust by scoping responsibility accurately. You own your changes. You get feedback on your work. Pre-existing issues are acknowledged but not weaponized against you.

This is how validation should work: helpful, targeted, and fair.

## Getting Started

Checkpoints are available in Han v1.62.0 and later:

```bash
# Install or upgrade Han
curl -fsSL https://han.guru/install.sh | bash

# Or via Homebrew
brew install thebushidocollective/tap/han
brew upgrade han

# Enable hooks in your project
cat > han.yml <<EOF
hooks:
  enabled: true
  checkpoints: true  # Default, but explicit is fine
EOF

# Install plugins with hooks (example)
han plugin install jutsu-typescript
```

On your next Claude Code session start, Han will create a checkpoint automatically. When the session ends, hooks will only validate your actual changes.

## What's Next

Checkpoints are the foundation for smarter scoping. Future improvements might include:

- **Checkpoint diffing**: Compare current state against specific checkpoints
- **Manual checkpoints**: Create named checkpoints for milestone validation
- **Checkpoint reports**: Visualize what changed between checkpoints
- **Selective validation**: Run specific hooks on checkpoint-filtered files

The goal remains the same: make validation helpful, not frustrating.

## Try It

If you've disabled hooks because of pre-existing blame, checkpoints change the equation. Your session, your changes, your feedback. Nothing more.

Give hooks another chance. They might surprise you.

---

**Resources:**

- [Han Documentation](https://han.guru/docs)
- [Checkpoint System Blueprint](https://github.com/thebushidocollective/han/blob/main/blueprints/checkpoint-system.md)
- [Install Han](https://han.guru/install)

**Questions?**

- [GitHub Discussions](https://github.com/thebushidocollective/han/discussions)
- [Report Issues](https://github.com/thebushidocollective/han/issues)
