---
description: (Internal) Advance to the next hat in the AI-DLC workflow
internal: true
---

## Name

`jutsu-ai-dlc:advance` - Move to the next hat in the AI-DLC workflow sequence.

## Synopsis

```
/advance
```

## Description

**Internal command** - Called by the AI during `/construct`, not directly by users.

Advances to the next hat in the workflow sequence. For example, in the default workflow:
- elaborator → planner (intent defined, now plan the work)
- planner → builder (plan ready, now implement)
- builder → reviewer (bolt complete, now review)

If already at the last hat (reviewer by default), this command is blocked - use `/done` instead.

## Implementation

### Step 1: Load Current State

```javascript
// Intent-level state is stored on current branch (intent branch)
const state = JSON.parse(han_keep_load({ scope: "branch", key: "iteration.json" }));
```

### Step 2: Determine Next Hat

```javascript
const workflow = state.workflow || ["elaborator", "planner", "builder", "reviewer"];
const currentIndex = workflow.indexOf(state.hat);
const nextIndex = currentIndex + 1;

if (nextIndex >= workflow.length) {
  // Already at last hat - cannot advance, must use /done
  return "Cannot advance past the last hat. Use /done to complete the task.";
}

const nextHat = workflow[nextIndex];
```

### Step 3: Update State

```javascript
state.hat = nextHat;
state.needsAdvance = true;  // Signal SessionStart to increment iteration
// Intent-level state saved to current branch (intent branch)
han_keep_save({
  scope: "branch",
  key: "iteration.json",
  content: JSON.stringify(state)
});
```

### Step 4: Confirm

Output:
```
Advanced to **{nextHat}** hat.

Run `/clear` to start fresh with the new hat's context.
```

## Guard

If already at the last hat (reviewer by default), output:
```
You are at the final hat (reviewer).

- If issues found: use `/fail` to return to builder
- If approved and criteria met: use `/done` to complete
```
