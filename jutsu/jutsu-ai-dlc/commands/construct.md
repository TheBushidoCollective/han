---
description: Continue the AI-DLC construction loop - autonomous build/review cycles until completion
---

## Name

`jutsu-ai-dlc:construct` - Run the autonomous AI-DLC construction loop.

## Synopsis

```
/construct
```

## Description

**User-facing command** - Continue the AI-DLC autonomous construction loop.

This command resumes work from the current hat and runs until:
- Task is complete (`/done` called internally)
- User intervention needed (blockers, questions)
- Session ends (Stop hook prompts for `/clear`)

**User Flow:**
```
User: /elaborate           # Once - define intent, criteria, and workflow
User: /construct           # Kicks off autonomous loop
...AI works autonomously...
Stop hook: "Run /clear"
User: /clear
User: /construct           # Continue the loop
...repeat until done...
```

**Important:**
- Run after `/clear` - This is how you continue the loop
- Autonomous operation - AI manages hat transitions internally
- User intervention - You can skip `/construct` to intervene manually
- State preserved - Progress saved in han keep between sessions

**CRITICAL: No Questions During Construction**

During the construction loop, you MUST NOT:
- Use AskUserQuestion tool
- Ask clarifying questions
- Request user decisions
- Pause for user feedback

This breaks han's hook logic. The construction loop must be fully autonomous.

If you encounter ambiguity:
1. Make a reasonable decision based on available context
2. Document the assumption in your work
3. Let the reviewer hat catch issues on the next pass

If truly blocked (cannot proceed without user input):
1. Document the blocker clearly
2. Stop the loop naturally (don't call /advance)
3. The Stop hook will prompt the user to `/clear` and intervene

## Implementation

### Step 1: Load State

```javascript
const state = JSON.parse(han_keep_load({ scope: "branch", key: "iteration.json" }));
const intentSlug = han_keep_load({ scope: "branch", key: "intent-slug" }) || null;
```

If no state exists:
```
No AI-DLC state found.

If you have existing intent artifacts in .ai-dlc/, run /resume to continue.
Otherwise, run /elaborate to start a new task.
```

If status is "complete":
```
Task already complete! Run /reset to start a new task.
```

### Step 2: Ensure Unit Branch

**CRITICAL: All work MUST happen on the unit's dedicated branch.**

Branch naming: `ai-dlc/{intent-slug}/{unit-number}-{unit-slug}`

```bash
# Determine current unit from state or find next ready unit
UNIT_FILE=$(find_ready_unit "$INTENT_DIR")
UNIT_NAME=$(basename "$UNIT_FILE" .md)  # e.g., unit-01-core-backend
UNIT_BRANCH="ai-dlc/${intentSlug}/${UNIT_NAME#unit-}"  # e.g., ai-dlc/han-team-platform/01-core-backend

# Check if on correct branch
CURRENT_BRANCH=$(git branch --show-current)

if [ "$CURRENT_BRANCH" != "$UNIT_BRANCH" ]; then
  # Create branch if it doesn't exist, then switch
  git checkout -B "$UNIT_BRANCH"
fi
```

**Why branches matter:**
- Isolates work per unit (clean PRs)
- Enables parallel execution via worktrees
- Preserves main branch stability
- Allows easy rollback if unit fails

### Step 3: Spawn Subagent for Current Role

**CRITICAL: Do NOT execute hat work inline. Always spawn a subagent.**

Based on `state.hat`, spawn the appropriate subagent via Task tool:

| Role | Agent Type | Description |
|------|------------|-------------|
| `planner` | `Plan` | Creates tactical implementation plan |
| `builder` | Based on unit `discipline` | Implements the plan |
| `reviewer` | `general-purpose` | Verifies completion criteria |

**Builder agent selection by unit discipline:**
- `frontend` → `do-frontend-development:presentation-engineer`
- `backend` → `general-purpose` with backend context
- `documentation` → `do-technical-documentation:documentation-engineer`
- (other) → `general-purpose`

**Example spawn:**
```javascript
Task({
  subagent_type: getAgentForRole(state.hat, unit.discipline),
  description: `${state.hat}: ${unit.name}`,
  prompt: `
    Execute the ${state.hat} role for this AI-DLC unit.

    ## Unit: ${unit.name}
    ## Completion Criteria
    ${unit.criteria}

    Work according to your role. Return clear status when done.
  `
})
```

The subagent automatically receives AI-DLC context (hat instructions, intent, workflow rules, unit status) via SubagentPrompt injection.

### Step 4: Handle Subagent Result

Based on the subagent's response:
- **Success/Complete**: Call `/advance` to move to next role
- **Issues found** (reviewer): Call `/fail` to return to builder
- **Blocked**: Document and stop loop for user intervention
- **All criteria met** (from reviewer): Call `/done`

#### Workflow-Specific Examples

**Default Workflow** (elaborator → planner → builder → reviewer):
- elaborator: Define intent and criteria
- planner: Create iteration plan
- builder: Implement to spec
- reviewer: Verify against criteria

**TDD Workflow** (test-writer → implementer → refactorer):
- test-writer: Write failing tests first
- implementer: Make tests pass
- refactorer: Improve code quality

**Hypothesis Workflow** (observer → hypothesizer → experimenter → analyst):
- observer: Gather data about the bug
- hypothesizer: Form theories
- experimenter: Test hypotheses
- analyst: Evaluate and fix

### Step 4b: Parallel Unit Orchestration

When the intent has been decomposed into units (`.ai-dlc/{intent-slug}/unit-*.md` files exist), the construction loop changes to unit-based execution.

#### Finding Ready Units

A unit is **ready** when:
- Status is `pending`
- All units in `depends_on` have status `completed`

#### Serial vs Parallel Execution

**Serial (single ready unit):**
1. Switch to unit branch (Step 2)
2. Execute in current session

**Parallel (multiple ready units):** Create worktrees with dedicated branches:

```bash
# For each ready unit, create a worktree with its branch
for UNIT in $READY_UNITS; do
  UNIT_BRANCH="ai-dlc/${intentSlug}/${UNIT#unit-}"
  WORKTREE_PATH="/tmp/ai-dlc-worktree-${UNIT}"

  # Create worktree (also creates branch if needed)
  git worktree add -B "$UNIT_BRANCH" "$WORKTREE_PATH"
done
```

Then spawn parallel subagents:

```javascript
// Spawn subagent per ready unit
for (const unit of readyUnits) {
  Task({
    run_in_background: true,
    description: `Execute AI-DLC unit: ${unit.name}`,
    prompt: `
      Execute AI-DLC unit in isolated worktree.

      Working directory: /tmp/ai-dlc-worktree-${unit.name}
      Branch: ai-dlc/${intentSlug}/${unit.slug}

      IMPORTANT: cd to the worktree directory first!
      All git operations happen on the unit's branch.
    `
  })
}
```

When units complete, merge branches back to main or create PRs.

### Step 5: Internal Commands

The AI calls these internally (user does not call directly):

- **`/advance`** - Move to next hat in workflow
- **`/fail`** - Return to previous hat (issues found)
- **`/done`** - Mark task complete (only from last hat)

### Step 6: Loop Behavior

The construction loop continues within a session until:
1. **Blocked** - Need user input or hit a blocker
2. **Session limit** - Stop hook fires, prompts for `/clear`
3. **Complete** - All criteria met, `/done` called
4. **All units blocked** - No forward progress possible, alert user

After `/clear`, user runs `/construct` again to continue.

## Example Session

```
[Session 1]
User: /elaborate
...collaborative discussion (elaborator agent)...
AI: Intent and criteria saved. Units created:
    - unit-01-api-endpoints (discipline: backend)
    - unit-02-dashboard-ui (discipline: frontend)
AI: /advance → planner role

AI: Switching to branch: ai-dlc/my-feature/01-api-endpoints
AI: Spawning Plan agent...
[Plan subagent runs, receives AI-DLC context]
AI: Plan saved. /advance → builder role

AI: Spawning backend agent for unit-01...
[Builder subagent runs on ai-dlc/my-feature/01-api-endpoints branch]
...builds...
Stop hook: "Run /clear to continue"

[Session 2]
User: /clear
User: /construct
AI: Loading state... builder role, unit-01-api-endpoints
AI: Ensuring branch: ai-dlc/my-feature/01-api-endpoints ✓
AI: Spawning backend agent...
[Builder subagent continues work, commits to unit branch]
AI: Builder complete. /advance → reviewer role

AI: Spawning review agent...
[Reviewer subagent runs, receives AI-DLC context + reviewer hat]
AI: Issue found - missing test. /fail → builder role
AI: Spawning backend agent...
[Builder subagent fixes issue on unit branch]
Stop hook: "Run /clear to continue"

[Session 3]
User: /clear
User: /construct
AI: Loading state... builder role, unit-01-api-endpoints
AI: Ensuring branch: ai-dlc/my-feature/01-api-endpoints ✓
AI: Spawning backend agent...
[Builder subagent adds test, commits]
AI: Builder complete. /advance → reviewer role

AI: Spawning review agent...
[Reviewer subagent verifies all criteria]
AI: All criteria satisfied! Unit-01 complete.
AI: Merging ai-dlc/my-feature/01-api-endpoints → main
AI: Moving to next unit: unit-02-dashboard-ui
AI: Switching to branch: ai-dlc/my-feature/02-dashboard-ui
...continues with next unit...
```
