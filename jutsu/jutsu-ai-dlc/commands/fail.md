---
description: (Internal) Return to the previous hat in the AI-DLC workflow (e.g., reviewer finds issues)
internal: true
---

# /fail - Return to Previous Hat

**Internal command** - Called by the AI during `/construct`, not directly by users.

Go back to the previous hat in the workflow. Typically used when:
- Reviewer finds issues → return to builder
- Builder hits fundamental blocker → return to planner
- Planner realizes requirements unclear → return to elaborator

## Process

### Step 1: Load Current State

```javascript
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
// Append to blockers or scratchpad
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

Run `/clear` to start fresh with the previous hat's context.
```

## Common Scenarios

| From | To | Why |
|------|-----|-----|
| reviewer | builder | Code review found issues to fix |
| builder | planner | Requirements need clarification |
| planner | elaborator | Scope needs to change |

## Guard

If already at the first hat (elaborator by default), output:
```
You are at the first hat (elaborator).

Cannot go back further. Continue elaboration or use `/reset` to start over.
```
