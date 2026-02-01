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

### Step 0: Ensure Intent Worktree

**CRITICAL: The orchestrator MUST run in the intent worktree, not the main working directory.**

Before loading state, find and switch to the intent worktree:

```bash
# First, check if we have an intent slug saved (try to find it)
# Look for .ai-dlc/*/intent.md files to detect intent
INTENT_SLUG=""
for intent_file in .ai-dlc/*/intent.md; do
  [ -f "$intent_file" ] || continue
  dir=$(dirname "$intent_file")
  slug=$(basename "$dir")
  status=$(han parse yaml status -r --default active < "$intent_file" 2>/dev/null || echo "active")
  [ "$status" = "active" ] && INTENT_SLUG="$slug" && break
done

# If we found an intent, ensure we're in its worktree
if [ -n "$INTENT_SLUG" ]; then
  INTENT_BRANCH="ai-dlc/${INTENT_SLUG}"
  INTENT_WORKTREE="/tmp/ai-dlc-${INTENT_SLUG}"

  # Create worktree if it doesn't exist
  if [ ! -d "$INTENT_WORKTREE" ]; then
    git worktree add -B "$INTENT_BRANCH" "$INTENT_WORKTREE"
  fi

  # Switch to the intent worktree
  cd "$INTENT_WORKTREE"
fi
```

**Important:** The orchestrator runs in `/tmp/ai-dlc-{intent-slug}/`, NOT the original repo directory. This keeps main clean and enables parallel intents.

### Step 0.5: Check for Plan MR Approval (if elaboration_review is enabled)

**Before construction can begin, verify the plan MR is merged (if review was required):**

```bash
# Source configuration system
source "${CLAUDE_PLUGIN_ROOT}/lib/config.sh"

# Get configuration
INTENT_DIR=".ai-dlc/${INTENT_SLUG}"
CONFIG=$(get_ai_dlc_config "$INTENT_DIR" "$(git rev-parse --show-toplevel)")
ELABORATION_REVIEW=$(echo "$CONFIG" | jq -r '.elaboration_review')

if [ "$ELABORATION_REVIEW" = "true" ]; then
  # Check if plan MR exists and is merged
  PLAN_BRANCH="ai-dlc/${INTENT_SLUG}/plan"

  # Check for open PR on plan branch
  OPEN_PRS=$(gh pr list --head "$PLAN_BRANCH" --state open --json number 2>/dev/null || echo "[]")

  if [ "$(echo "$OPEN_PRS" | jq 'length')" -gt 0 ]; then
    # There's an open PR - not ready for construction
    PR_URL=$(gh pr list --head "$PLAN_BRANCH" --state open --json url --jq '.[0].url' 2>/dev/null)
    echo ""
    echo "⏸️  Plan Review Required"
    echo ""
    echo "The plan MR must be reviewed and merged before construction can begin."
    echo ""
    echo "Plan MR: $PR_URL"
    echo ""
    echo "Once the plan is approved and merged, run /construct again."
    exit 0
  fi

  # Check if there's a merged PR (plan was approved)
  MERGED_PRS=$(gh pr list --head "$PLAN_BRANCH" --state merged --json number 2>/dev/null || echo "[]")

  if [ "$(echo "$MERGED_PRS" | jq 'length')" -eq 0 ]; then
    # No merged PR - check if plan branch exists
    if git rev-parse --verify "origin/$PLAN_BRANCH" >/dev/null 2>&1; then
      # Branch exists but no PR - warn user
      echo ""
      echo "⚠️  Plan Branch Exists Without MR"
      echo ""
      echo "Branch: $PLAN_BRANCH"
      echo ""
      echo "The plan branch exists but no MR was created. Either:"
      echo "1. Create a plan MR: gh pr create --head $PLAN_BRANCH"
      echo "2. Or disable elaboration_review in .ai-dlc/settings.yml"
      echo ""
      exit 0
    fi
    # No branch, no PR - elaboration hasn't been done yet or review is not required
  fi

  # Plan MR is merged - construction can proceed
  echo "✓ Plan MR merged - proceeding with construction"
fi
```

**The check ensures:**
- If `elaboration_review: true` and an open plan MR exists → Block construction until merged
- If `elaboration_review: true` and plan MR is merged → Proceed with construction
- If `elaboration_review: false` → Skip the check entirely
- If no plan branch/MR exists → Allow construction (legacy behavior or first run)

### Step 1: Load State

```javascript
// Intent-level state is stored on the current branch (intent branch)
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

### Step 2: Create Unit Worktree

**CRITICAL: All work MUST happen in an isolated worktree.**

This prevents conflicts with the parent session and enables true isolation.

```bash
# Source the strategies library for proper branch naming
source "${CLAUDE_PLUGIN_ROOT}/lib/strategies.sh"
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"

# Get the configured change strategy
CONFIG=$(get_ai_dlc_config "$INTENT_DIR")
STRATEGY=$(echo "$CONFIG" | jq -r '.change_strategy')

# Determine current unit from state or find next ready unit
UNIT_FILE=$(find_ready_unit "$INTENT_DIR")
UNIT_NAME=$(basename "$UNIT_FILE" .md)  # e.g., unit-01-core-backend
UNIT_SLUG="${UNIT_NAME#unit-}"  # e.g., 01-core-backend

# Get branch name based on strategy
# - trunk/unit: ai-dlc/{intent}/{unit}
# - bolt: ai-dlc/{intent}/{unit}/{bolt}
# - intent: ai-dlc/{intent}
UNIT_BRANCH=$(get_branch_name "$STRATEGY" "$intentSlug" "$UNIT_SLUG")
WORKTREE_PATH="/tmp/ai-dlc-${intentSlug}-${UNIT_SLUG}"

# Create worktree if it doesn't exist
if [ ! -d "$WORKTREE_PATH" ]; then
  git worktree add -B "$UNIT_BRANCH" "$WORKTREE_PATH"
fi
```

**Branch naming by strategy:**
| Strategy | Branch Pattern | Example |
|----------|---------------|---------|
| trunk | `ai-dlc/{intent}/{unit}` | `ai-dlc/auth-feature/01-backend` |
| unit | `ai-dlc/{intent}/{unit}` | `ai-dlc/auth-feature/01-backend` |
| bolt | `ai-dlc/{intent}/{unit}/{bolt}` | `ai-dlc/auth-feature/01-backend/add-tests` |
| intent | `ai-dlc/{intent}` | `ai-dlc/auth-feature` |

### Step 2b: Update Unit Status and Track Current Unit

**CRITICAL: Mark the unit as `in_progress` BEFORE spawning the subagent.**

This ensures the DAG accurately reflects that work has started on this unit.

```bash
# Source the DAG library (CLAUDE_PLUGIN_ROOT is the jutsu-ai-dlc plugin directory)
source "${CLAUDE_PLUGIN_ROOT}/lib/dag.sh"

# Update unit status to in_progress in the intent worktree
# UNIT_FILE points to the file in .ai-dlc/{intent-slug}/
update_unit_status "$UNIT_FILE" "in_progress"
```

**Track current unit in iteration state** so `/done` knows which unit to mark completed:

```javascript
state.currentUnit = UNIT_NAME;  // e.g., "unit-01-core-backend"
// Intent-level state saved to current branch (intent branch)
han_keep_save({
  scope: "branch",
  key: "iteration.json",
  content: JSON.stringify(state)
});
```

**Note:** The `update_unit_status` function validates that:
- The file exists and is within `.ai-dlc/`
- The file is a unit file (`unit-*.md`)
- The status is valid (`pending`, `in_progress`, `completed`, `blocked`)

**Why worktrees are mandatory:**
- Isolates work completely from parent session
- Parent can't accidentally revert subagent's changes
- Each unit has its own working directory
- Clean git history per unit
- Enables true parallel execution

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

    ## CRITICAL: Work in Worktree
    **Worktree path:** ${WORKTREE_PATH}
    **Branch:** ${UNIT_BRANCH}

    You MUST:
    1. cd ${WORKTREE_PATH}
    2. Verify you're on branch ${UNIT_BRANCH}
    3. Do ALL work in that directory
    4. Commit changes to that branch

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
# Source strategies for proper branch naming
source "${CLAUDE_PLUGIN_ROOT}/lib/strategies.sh"

# Get configured strategy
CONFIG=$(get_ai_dlc_config "$INTENT_DIR")
STRATEGY=$(echo "$CONFIG" | jq -r '.change_strategy')

# For each ready unit, create a worktree with its branch
for UNIT in $READY_UNITS; do
  UNIT_SLUG="${UNIT#unit-}"
  UNIT_BRANCH=$(get_branch_name "$STRATEGY" "$intentSlug" "$UNIT_SLUG")
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

## State Scoping

**CRITICAL: Subagents run on unit branches but intent state lives on the intent branch.**

### Intent-Level State (stored on intent branch)

These are managed by the orchestrator and stored on the intent branch (`ai-dlc/{intent-slug}`):

| Key | Description |
|-----|-------------|
| `iteration.json` | Workflow state, current hat, iteration count |
| `intent.md` | Intent description |
| `completion-criteria.md` | Success criteria |
| `current-plan.md` | Planner's output |
| `intent-slug` | Slug identifier |

```javascript
// Orchestrator reads/writes to current branch (intent branch)
han_keep_load({ scope: "branch", key: "iteration.json" })
han_keep_save({ scope: "branch", key: "iteration.json", content: "..." })
```

### Unit-Level State (use current branch - omit `branch_name`)

These are specific to each unit's worktree branch:

| Key | Description |
|-----|-------------|
| `scratchpad.md` | Working notes for this unit |
| `next-prompt.md` | Continuation prompt for this unit |
| `blockers.md` | Blockers specific to this unit |

```javascript
// Subagent reads/writes to its own branch (current branch)
han_keep_load({ scope: "branch", key: "scratchpad.md" })
han_keep_save({ scope: "branch", key: "scratchpad.md", content: "..." })
```

**Why this matters:** When a subagent runs in a worktree on branch `ai-dlc/{intent}/{unit}`, it saves its own working notes to its unit branch. The orchestrator runs on the intent branch and manages intent-level state there.

## Worktree Architecture

The AI-DLC workflow uses worktrees for complete isolation. Branch naming varies by strategy:

**Unit Strategy (default):**
```
/path/to/repo (main branch)         <-- User's main working directory, stays clean
  │
  └── git worktrees:
        │
        ├── /tmp/ai-dlc-{intent}/              <-- Intent worktree (orchestrator)
        │     branch: ai-dlc/{intent-slug}
        │
        ├── /tmp/ai-dlc-{intent}-01-unit/      <-- Unit worktree (subagent)
        │     branch: ai-dlc/{intent-slug}/01-unit
        │
        └── /tmp/ai-dlc-{intent}-02-unit/      <-- Unit worktree (subagent)
              branch: ai-dlc/{intent-slug}/02-unit
```

**Intent Strategy (single branch):**
```
/path/to/repo (main branch)
  │
  └── git worktrees:
        │
        └── /tmp/ai-dlc-{intent}/              <-- All work happens here
              branch: ai-dlc/{intent-slug}      (single branch for all units)
```

**Trunk Strategy (ephemeral branches, auto-merge):**
Same as unit strategy, but branches are automatically merged to main and deleted after each unit passes validation.

**Bolt Strategy (finest granularity):**
```
/path/to/repo (main branch)
  │
  └── git worktrees:
        │
        ├── /tmp/ai-dlc-{intent}-01-unit-add-tests/
        │     branch: ai-dlc/{intent-slug}/01-unit/add-tests
        │
        └── /tmp/ai-dlc-{intent}-01-unit-impl/
              branch: ai-dlc/{intent-slug}/01-unit/implementation
```

1. **Main repo**: User's working directory stays on `main`, unaffected by AI-DLC work.

2. **Intent worktree** (`/tmp/ai-dlc-{intent}/`): Where the orchestrator runs. Intent-level state (iteration.json, intent.md, etc.) is stored here via han keep.

3. **Unit worktrees** (`/tmp/ai-dlc-{intent}-{unit}/`): Where subagents work in isolated worktrees. Unit-level state (scratchpad, blockers) is stored here.

The orchestrator MUST be in the intent worktree before spawning subagents. This ensures:
- Main working directory stays clean on `main`
- Intent state is properly scoped to the intent
- Multiple intents can run in parallel in separate worktrees
- Clean separation between orchestration state and unit work
