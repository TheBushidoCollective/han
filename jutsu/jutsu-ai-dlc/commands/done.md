---
description: (Internal) Complete the AI-DLC task (only valid from the last hat)
internal: true
---

## Name

`jutsu-ai-dlc:done` - Mark the AI-DLC task as complete.

## Synopsis

```
/done
```

## Description

**Internal command** - Called by the AI during `/construct`, not directly by users.

Marks the AI-DLC task as complete. This command is **guarded** - it can only be called from the last hat in the workflow (typically reviewer).

- Only the last hat (reviewer) can complete
- All completion criteria must be verified
- This ends the AI-DLC loop for this task

## Implementation

### Step 1: Load Current State

```javascript
const state = JSON.parse(han_keep_load({ scope: "branch", key: "iteration.json" }));
const workflow = state.workflow || ["elaborator", "planner", "builder", "reviewer"];
const currentIndex = workflow.indexOf(state.hat);
const lastIndex = workflow.length - 1;
```

### Step 2: Verify Last Hat

```javascript
if (currentIndex !== lastIndex) {
  const lastHat = workflow[lastIndex];
  return `Cannot complete from ${state.hat} hat. Only the ${lastHat} can mark the task as done.\n\nUse /advance to progress to the next hat.`;
}
```

### Step 3: Verify Criteria Met

Load and check completion criteria:

```javascript
const criteria = han_keep_load({ scope: "branch", key: "completion-criteria.md" });
```

Display criteria and confirm each is satisfied:
```
## Completion Criteria Check

- [x] Users can log in with Google OAuth
- [x] Login failure shows descriptive error message
- [x] Session persists across page refreshes
- [x] All existing tests continue to pass

All criteria satisfied!
```

If any criteria are NOT met, output:
```
Cannot complete - the following criteria are not satisfied:

- [ ] {unsatisfied criterion}

Use /fail to return to builder and address these items.
```

### Step 4: Mark Complete

```javascript
state.status = "complete";
han_keep_save({
  scope: "branch",
  key: "iteration.json",
  content: JSON.stringify(state)
});
```

### Step 5: Summary

Output a completion summary:

```javascript
const workflowName = state.workflowName || "default";
const workflowHats = state.workflow.join(" → ");
```

```
## AI-DLC Task Complete!

**Total iterations:** {iteration count}
**Workflow:** {workflowName} ({workflowHats})

### What Was Built
{Summary from intent}

### Criteria Satisfied
{List of completion criteria}

---

Run `/reset` to clear AI-DLC state and start a new task.
```
