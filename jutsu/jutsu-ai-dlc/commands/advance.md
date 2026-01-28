---
description: (Internal) Advance to the next hat in the AI-DLC workflow
---

# /advance - Move to Next Hat

**Internal command** - Called by the AI during `/construct`, not directly by users.

Advance to the next hat in the workflow sequence.

## Process

### Step 1: Load Current State

```javascript
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

## Workflow Sequence

Default workflow: `elaborator → planner → builder → reviewer`

| From | To | Purpose |
|------|-----|---------|
| elaborator | planner | Intent defined, now plan the work |
| planner | builder | Plan ready, now implement |
| builder | reviewer | Bolt complete, now review |
| reviewer | (done) | Use `/done` instead |

## Guard

If already at the last hat (reviewer by default), output:
```
You are at the final hat (reviewer).

- If issues found: use `/fail` to return to builder
- If approved and criteria met: use `/done` to complete
```
