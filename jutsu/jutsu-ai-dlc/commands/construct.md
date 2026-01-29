---
description: Continue the AI-DLC construction loop - autonomous build/review cycles until completion
---

# /construct - Run the Construction Loop

Continue the AI-DLC autonomous construction loop. This command resumes work from the current hat and runs until:
- Task is complete (`/done` called internally)
- User intervention needed (blockers, questions)
- Session ends (Stop hook prompts for `/clear`)

## User Flow

```
User: /elaborate           # Once - define intent, criteria, and workflow
User: /construct           # Kicks off autonomous loop
...AI works autonomously...
Stop hook: "Run /clear"
User: /clear
User: /construct           # Continue the loop
...repeat until done...
```

## Process

### Step 1: Load State

```javascript
const state = JSON.parse(han_keep_load({ scope: "branch", key: "iteration.json" }));
const intentSlug = han_keep_load({ scope: "branch", key: "intent-slug" }) || null;
```

If no state exists:
```
No AI-DLC state found. Run /elaborate first to define intent and completion criteria.
```

If status is "complete":
```
Task already complete! Run /reset to start a new task.
```

### Step 2: Read Hat Instructions

Based on `state.hat`, load the hat's instructions from:
1. User override: `.ai-dlc/hats/{hat}.md`
2. Plugin built-in: `hats/{hat}.md`

The hat file contains the role's responsibilities, guidelines, and transition conditions.

### Step 3: Execute Current Hat

Work according to the hat's instructions. Each hat has:
- **Focus** - What to concentrate on
- **Responsibilities** - What to accomplish
- **Guidelines** - How to approach the work
- **Transitions** - When to `/advance`, `/fail`, or `/done`

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

### Step 3b: Parallel Unit Orchestration (When Units Exist)

When the intent has been decomposed into units (`.ai-dlc/{intent-slug}/unit-*.md` files exist), the construction loop changes to unit-based execution.

#### Checking for Units

```javascript
const intentSlug = han_keep_load({ scope: "branch", key: "intent-slug" });
const intentDir = `.ai-dlc/${intentSlug}`;
// Check if unit files exist - if so, use unit-based orchestration
```

#### Finding Ready Units

Use the DAG functions (sourced from `lib/dag.sh`) or implement equivalent logic:

1. A unit is **ready** when:
   - Status is `pending`
   - All units in `depends_on` have status `completed`

2. A unit is **blocked** when:
   - Status is `pending`
   - At least one unit in `depends_on` is not `completed`

#### Serial vs Parallel Execution

**Serial (single ready unit):** Execute directly in current session:
1. Mark unit as `in_progress`
2. Read unit file for description and completion criteria
3. Execute according to current hat instructions
4. When criteria met, mark unit as `completed`
5. Check for newly ready units

**Parallel (multiple ready units):** Spawn subagents in worktrees:

```markdown
When 2+ units are ready for parallel execution:

1. **Create worktrees** for each ready unit:
   ```bash
   han worktree add /tmp/worktree-${UNIT_NAME} ${UNIT_BRANCH} --create-branch
   ```

2. **Spawn subagents** using Task tool:
   ```javascript
   Task({
     description: `Execute AI-DLC unit: ${UNIT_NAME}`,
     prompt: `Execute AI-DLC unit in isolated worktree.

     ## Context
     Working directory: /tmp/worktree-${UNIT_NAME}
     Intent branch for shared state: ${INTENT_BRANCH}

     ## Unit Specification
     ${UNIT_CONTENT}

     ## Completion Criteria
     ${UNIT_CRITERIA}

     ## Instructions
     1. Work in the worktree directory
     2. Save progress to shared state:
        han keep save --branch=${INTENT_BRANCH} scratchpad-${UNIT_NAME}.md "progress notes"
     3. When complete, update unit status:
        - Edit the unit file to set status: completed
        - Commit your changes to the unit branch
     4. Do NOT merge to main - coordinator handles that
     `
   })
   ```

3. **Monitor subagents** and converge:
   - Wait for background tasks to complete
   - When a subagent finishes, remove its worktree:
     ```bash
     han worktree remove /tmp/worktree-${UNIT_NAME}
     ```
   - Re-evaluate DAG for newly ready units
   - Continue until all units complete or blocked

4. **Handle failures:**
   - If subagent fails, mark unit status as `blocked`
   - Add blocker description to unit file
   - Alert user about blocked units
```

#### Subagent State Management

Subagents share state via explicit branch name:

```javascript
// Coordinator saves shared context
han_keep_save({
  scope: "branch",
  branch_name: "ai-dlc/my-intent",  // Explicit intent branch
  key: "context.json",
  content: JSON.stringify(sharedContext)
})

// Subagent loads shared context (from different worktree)
const context = han_keep_load({
  scope: "branch",
  branch_name: "ai-dlc/my-intent",  // Same explicit branch
  key: "context.json"
})

// Subagent saves unit-specific progress
han_keep_save({
  scope: "branch",
  branch_name: "ai-dlc/my-intent",
  key: `scratchpad-${unitName}.md`,
  content: progressNotes
})
```

#### Example Flow

```
Coordinator Session:
  1. Load DAG: unit-01 (completed), unit-02 (pending), unit-03 (pending), unit-04 (blocked by 02,03)
  2. Ready units: unit-02, unit-03
  3. Create worktrees:
     - /tmp/worktree-unit-02 for branch ai-dlc/intent/02-provider
     - /tmp/worktree-unit-03 for branch ai-dlc/intent/03-session
  4. Spawn subagents for unit-02 and unit-03 (parallel)
  5. Wait for completion...

Subagent for unit-02:
  - Works in /tmp/worktree-unit-02
  - Implements OAuth provider
  - Saves progress: han keep save --branch=ai-dlc/intent scratchpad-unit-02.md "..."
  - Updates unit-02.md status to completed
  - Commits changes

Subagent for unit-03:
  - Works in /tmp/worktree-unit-03
  - Implements session management
  - Saves progress: han keep save --branch=ai-dlc/intent scratchpad-unit-03.md "..."
  - Updates unit-03.md status to completed
  - Commits changes

Back to Coordinator:
  6. Both subagents complete
  7. Remove worktrees
  8. Re-evaluate DAG: unit-04 now ready (deps 02,03 completed)
  9. Execute unit-04 (serial, single unit)
  10. All units complete -> /done
```

#### Convergence Conditions

The unit-based construction loop continues until:
- **All units completed** -> Call `/done`
- **All remaining units blocked** -> Alert user, provide blocked unit details
- **Session limit reached** -> Stop hook fires, user runs `/clear` then `/construct`

### Step 4: Internal Commands

The AI calls these internally (user does not call directly):

- **`/advance`** - Move to next hat in workflow
- **`/fail`** - Return to previous hat (issues found)
- **`/done`** - Mark task complete (only from last hat)

### Step 5: Loop Behavior

The construction loop continues within a session until:
1. **Blocked** - Need user input or hit a blocker
2. **Session limit** - Stop hook fires, prompts for `/clear`
3. **Complete** - All criteria met (or all units completed), `/done` called
4. **All units blocked** - No forward progress possible, alert user

After `/clear`, user runs `/construct` again to continue.

## Example Session (Default Workflow)

```
[Session 1]
User: /elaborate
...collaborative discussion...
AI: Intent and criteria saved. /advance
AI: Now in planner phase. Creating plan...
AI: Plan saved. /advance
AI: Now in builder phase. Starting implementation...
...builds...
Stop hook: "Run /clear to continue"

[Session 2]
User: /clear
User: /construct
AI: Continuing builder phase...
...builds more...
AI: Bolt complete. /advance
AI: Now in reviewer phase. Checking criteria...
AI: Issue found - missing test. /fail
AI: Back to builder. Fixing...
Stop hook: "Run /clear to continue"

[Session 3]
User: /clear
User: /construct
AI: Continuing builder phase...
AI: Test added. /advance
AI: Now in reviewer phase. Checking criteria...
AI: All criteria satisfied! /done
AI: Task complete!
```

## Example Session (TDD Workflow)

```
[Session 1]
User: /elaborate
AI: Selected TDD workflow (test-writer → implementer → refactorer)
...define what to test...
AI: Intent saved. /advance
AI: Now in test-writer phase. Writing failing tests...
...writes tests...
AI: Tests written (all red). /advance
AI: Now in implementer phase. Making tests green...
...implements...
Stop hook: "Run /clear to continue"

[Session 2]
User: /clear
User: /construct
AI: Continuing implementer phase...
AI: All tests passing! /advance
AI: Now in refactorer phase. Improving code...
AI: Refactoring complete. All tests still green. /done
AI: Task complete!
```

## Important

- **Run after /clear** - This is how you continue the loop
- **Autonomous operation** - AI manages hat transitions internally
- **User intervention** - You can skip `/construct` to intervene manually
- **State preserved** - Progress saved in han keep between sessions
- **Workflow-aware** - Follows the workflow selected during elaboration
