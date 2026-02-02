---
description: (Internal) Return to the previous hat in the AI-DLC workflow (e.g., reviewer finds issues)
user-invocable: false
---

## Name

`ai-dlc:fail` - Return to the previous hat in the AI-DLC workflow.

## Synopsis

```
/fail
```

## Description

**Internal command** - Called by the AI during `/construct`, not directly by users.

Goes back to the previous hat in the workflow. Typically used when:
- Reviewer finds issues -> return to builder
- Builder hits fundamental blocker -> return to planner
- Planner realizes requirements unclear -> return to elaborator

If already at the first hat (elaborator by default), this command is blocked.

## Implementation

### Step 1: Load Current State

```javascript
// Intent-level state is stored on current branch (intent branch)
const state = JSON.parse(han_keep_load({ scope: "branch", key: "iteration.json" }));
```

### Step 2: Determine Previous Hat

```javascript
const workflow = state.workflow || ["elaborator", "planner", "builder", "reviewer"];
const currentIndex = workflow.indexOf(state.hat);
const prevIndex = currentIndex - 1;

if (prevIndex < 0) {
  // Already at first hat - cannot go back
  return "Cannot fail before the first hat (elaborator).";
}

const prevHat = workflow[prevIndex];
```

### Step 3: Document Why

Before updating state, save the reason for failing:

```javascript
// Append to blockers (unit-level state - saved to current branch)
const reason = "Reviewer found issues: [describe issues]";
han_keep_save({
  scope: "branch",
  key: "blockers.md",
  content: reason
});
```

### Step 4: Update State

```javascript
state.hat = prevHat;
// Intent-level state saved to current branch (intent branch)
han_keep_save({
  scope: "branch",
  key: "iteration.json",
  content: JSON.stringify(state)
});
```

### Step 5: Confirm

Output:
```
Returning to **{prevHat}** hat.

**Reason:** {reason}

Continuing construction with the previous hat...
```

## Guard

If already at the first hat (elaborator by default), output:
```
You are at the first hat (elaborator).

Cannot go back further. Continue elaboration or use `/reset` to start over.
```
