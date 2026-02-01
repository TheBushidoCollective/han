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

**When at the last hat (reviewer)**, `/advance` handles completion automatically:
- If all units complete → Mark intent as complete
- If more units ready → Loop back to builder for next unit
- If blocked (no ready units) → Alert user, human intervention required

## Implementation

### Step 1: Load Current State

```javascript
// Intent-level state is stored on current branch (intent branch)
const state = JSON.parse(han_keep_load({ scope: "branch", key: "iteration.json" }));
```

### Step 2: Determine Next Hat (or Handle Completion)

```javascript
const workflow = state.workflow || ["elaborator", "planner", "builder", "reviewer"];
const currentIndex = workflow.indexOf(state.hat);
const nextIndex = currentIndex + 1;

if (nextIndex >= workflow.length) {
  // At last hat - check DAG status to determine next action
  // See Step 2b below
}

const nextHat = workflow[nextIndex];
```

### Step 2b: Last Hat Logic (Completion/Loop/Block)

When at the last hat (typically reviewer), check the DAG to determine next action:

```bash
# Source the DAG library
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"

# Get intent directory
INTENT_SLUG=$(han keep load intent-slug --quiet)
INTENT_DIR=".ai-dlc/${INTENT_SLUG}"

# Mark current unit as completed
CURRENT_UNIT=$(echo "$ITERATION_JSON" | han parse json currentUnit -r --default "")
if [ -n "$CURRENT_UNIT" ] && [ -f "$INTENT_DIR/${CURRENT_UNIT}.md" ]; then
  update_unit_status "$INTENT_DIR/${CURRENT_UNIT}.md" "completed"
fi

# Get DAG summary
DAG_SUMMARY=$(get_dag_summary "$INTENT_DIR")
ALL_COMPLETE=$(echo "$DAG_SUMMARY" | han parse json allComplete -r)
READY_COUNT=$(echo "$DAG_SUMMARY" | han parse json readyCount -r)
```

```javascript
if (dagSummary.allComplete) {
  // ALL UNITS COMPLETE - Mark intent as done
  state.status = "complete";
  han_keep_save({ scope: "branch", key: "iteration.json", content: JSON.stringify(state) });

  // Output completion summary (see Step 5)
  return completionSummary;
}

if (dagSummary.readyCount > 0) {
  // MORE UNITS READY - Loop back to builder
  state.hat = workflow[2] || "builder";  // Reset to builder (index 2 in default workflow)
  state.currentUnit = null;  // Will be set by /construct when it picks next unit
  han_keep_save({ scope: "branch", key: "iteration.json", content: JSON.stringify(state) });

  return `Unit completed. ${dagSummary.readyCount} more unit(s) ready. Continuing construction...`;
}

// BLOCKED - No ready units, human must intervene
return `All remaining units are blocked. Human intervention required.

Blocked units:
${dagSummary.blockedUnits.join('\n')}

Review blockers and unblock units to continue.`;
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

### Step 4: Confirm (Normal Advancement)

Output:
```
Advanced to **{nextHat}** hat. Continuing construction...
```

### Step 5: Completion Summary (When All Units Done)

When `/advance` completes the intent (all units done), output:

```
## Intent Complete!

**Total iterations:** {iteration count}
**Workflow:** {workflowName} ({workflowHats})

### What Was Built
{Summary from intent}

### Units Completed
{List of completed units}

### Criteria Satisfied
{List of completion criteria}

### Next Steps

1. **Review changes** - Check the work on branch `ai-dlc/{intent-slug}`
2. **Create PR** - `gh pr create --base main --head ai-dlc/{intent-slug}`
3. **Clean up worktrees** - `git worktree remove /tmp/ai-dlc-{intent-slug}`
4. **Start new task** - Run `/reset` to clear state, then `/elaborate`
```
