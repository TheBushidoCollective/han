---
description: Clear all AI-DLC state and start fresh (user-facing command)
---

## Name

`/reset` - Clear AI-DLC state and start fresh.

## Synopsis

```
/reset
```

## Description

**User-facing command** - Run this to abandon current task or start fresh.

Clears all AI-DLC state for the current branch. Use this to:
- Start fresh on a new task
- Clean up after completing a task
- Abandon a task that's no longer needed

This only clears AI-DLC state. It does not:
- Undo code changes
- Delete branches
- Revert commits

The work you did is preserved in git. Only the AI-DLC workflow state is cleared.

## Implementation

### Step 1: Confirm (Optional)

If the task is not complete, warn:

```javascript
const state = JSON.parse(han_keep_load({ scope: "branch", key: "iteration.json" }) || "{}");

if (state.status !== "complete") {
  console.log("Warning: Task is not complete. Current hat:", state.hat);
  console.log("Are you sure you want to clear all state?");
}
```

### Step 2: Delete All AI-DLC Keys

```javascript
// Clear all AI-DLC state keys
han_keep_delete({ scope: "branch", key: "iteration.json" });
han_keep_delete({ scope: "branch", key: "intent.md" });
han_keep_delete({ scope: "branch", key: "completion-criteria.md" });
han_keep_delete({ scope: "branch", key: "current-plan.md" });
han_keep_delete({ scope: "branch", key: "scratchpad.md" });
han_keep_delete({ scope: "branch", key: "blockers.md" });
```

Or use the CLI:
```bash
han keep clear --branch
```

### Step 3: Confirm

Output:
```
AI-DLC state cleared.

All iteration data, intent, criteria, and notes have been removed.

To start a new task, run `/elaborate`.
```

## What Gets Cleared

| Key | Purpose |
|-----|---------|
| `iteration.json` | Hat, iteration count, workflow, status |
| `intent.md` | What we're building |
| `completion-criteria.md` | How we know it's done |
| `current-plan.md` | Plan for current iteration |
| `scratchpad.md` | Learnings and notes |
| `blockers.md` | Documented blockers |
