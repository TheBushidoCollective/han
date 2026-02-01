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
// Intent-level state is stored on current branch (intent branch)
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
// Intent-level state from current branch (intent branch)
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

### Step 3b: Update Current Unit Status to Completed

If working on a unit-based task, mark the current unit as completed:

```bash
# Source the DAG library
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"

# Get the current unit file from state (intent-level from current branch / intent branch)
INTENT_SLUG=$(han keep load intent-slug --quiet)
INTENT_DIR=".ai-dlc/${INTENT_SLUG}"
CURRENT_UNIT=$(cat iteration.json | jq -r '.currentUnit // empty')

# If there's a current unit, mark it completed
if [ -n "$CURRENT_UNIT" ] && [ -f "$INTENT_DIR/${CURRENT_UNIT}.md" ]; then
  update_unit_status "$INTENT_DIR/${CURRENT_UNIT}.md" "completed"
  echo "Unit ${CURRENT_UNIT} marked as completed."
fi
```

**Note:** This happens in the intent worktree (`/tmp/ai-dlc-{intent-slug}/`), not the unit worktree. The orchestrator is responsible for tracking unit progress.

### Step 3c: Check for More Units (Unit-Based Workflows)

For unit-based tasks, check if all units are now complete or if there are more ready units:

```bash
# Source the DAG library
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"

# Check if DAG is complete (all units finished)
if is_dag_complete "$INTENT_DIR"; then
  echo "All units completed! Task is fully done."
  # Continue to Step 4 to mark the entire task complete
else
  # Find next ready units
  READY_UNITS=$(find_ready_units "$INTENT_DIR")

  if [ -n "$READY_UNITS" ]; then
    # More units are ready to work on
    echo "Unit completed. Ready units available: $READY_UNITS"

    # Reset hat to builder (or first hat after planner) for the next unit
    state.hat = workflow[2]  // Typically "builder"
    state.currentUnit = null  // Will be set by /construct
    // Intent-level state saved to current branch (intent branch)
    han_keep_save({
      scope: "branch",
      key: "iteration.json",
      content: JSON.stringify(state)
    })

    # Output status and continue construction
    echo "Moving to next unit. Run /construct to continue."
    return  # Do NOT proceed to Step 4 (full task completion)
  else
    # Units remain but are blocked
    BLOCKED_UNITS=$(find_blocked_units "$INTENT_DIR")
    echo "Warning: Remaining units are blocked:"
    echo "$BLOCKED_UNITS"
    # Continue to wait or alert user
    return
  fi
fi
```

**Note:** If there are more units, `/done` does NOT mark the task as complete. Instead, it resets the hat and signals the construct loop to pick up the next unit.

### Step 4: Mark Task Complete (Only When All Units Done)

```javascript
state.status = "complete";
// Intent-level state saved to current branch (intent branch)
han_keep_save({
  scope: "branch",
  key: "iteration.json",
  content: JSON.stringify(state)
});
```

### Step 4b: Generate Announcements

After marking the task complete, generate any configured announcements:

```bash
# Source the announcements library
source "${CLAUDE_PLUGIN_ROOT}/lib/announcements.sh"

# Check if announcements are configured
if has_announcements "$INTENT_DIR"; then
  echo "Generating announcements..."

  # Generate all configured announcement formats
  written_files=$(generate_announcements "$INTENT_DIR")

  if [ -n "$written_files" ]; then
    echo ""
    echo "## Announcements Generated"
    echo ""
    echo "The following announcement files were created in \`$INTENT_DIR/announcements/\`:"
    echo ""
    echo "$written_files" | while read -r file; do
      [ -n "$file" ] && echo "- \`$(basename "$file")\`"
    done
    echo ""
    echo "Review and edit these files before publishing."
  fi
else
  echo "No announcements configured for this intent."
fi
```

**Announcement formats available:**
- `changelog` - Conventional changelog entry (Keep a Changelog format)
- `release-notes` - User-facing summary of changes
- `social-posts` - Short-form posts for Twitter/LinkedIn
- `blog-draft` - Long-form announcement for company blog

Announcements are configured during elaboration (Phase 5.6) and stored in `intent.md` frontmatter:
```yaml
announcements: [changelog, release-notes]
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

### Announcements Generated
{List of generated announcement files, if any were configured}

### Next Steps

1. **Review announcements** - Check `.ai-dlc/{intent-slug}/announcements/` for generated content
2. **Merge changes** - Create a PR from `ai-dlc/{intent-slug}` to `main`
3. **Publish announcements** - Post social updates, update changelog, publish blog
4. **Clean up worktrees** - Run `git worktree remove /tmp/ai-dlc-{intent-slug}`
5. **Start new task** - Run `/reset` to clear state, then `/elaborate`

---

Worktree location: /tmp/ai-dlc-{intent-slug}/
```
