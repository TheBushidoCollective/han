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

### Step 2: Spawn Subagent for Current Role

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

### Step 3: Handle Subagent Result

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

### Step 3b: Parallel Unit Orchestration

When the intent has been decomposed into units (`.ai-dlc/{intent-slug}/unit-*.md` files exist), the construction loop changes to unit-based execution.

#### Finding Ready Units

A unit is **ready** when:
- Status is `pending`
- All units in `depends_on` have status `completed`

#### Serial vs Parallel Execution

**Serial (single ready unit):** Execute directly in current session.

**Parallel (multiple ready units):** Spawn subagents in worktrees:

```javascript
Task({
  description: `Execute AI-DLC unit: ${UNIT_NAME}`,
  prompt: `Execute AI-DLC unit in isolated worktree.
    Working directory: /tmp/worktree-${UNIT_NAME}
    Intent branch for shared state: ${INTENT_BRANCH}
    ...`
})
```

### Step 4: Internal Commands

The AI calls these internally (user does not call directly):

- **`/advance`** - Move to next hat in workflow
- **`/fail`** - Return to previous hat (issues found)
- **`/done`** - Mark task complete (only from last hat)

### Step 5: Loop Behavior

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
AI: Intent and criteria saved. /advance
AI: Now in planner role. Spawning Plan agent...
[Plan subagent runs, receives AI-DLC context]
AI: Plan saved. /advance
AI: Now in builder role. Spawning frontend agent...
[Builder subagent runs, receives AI-DLC context + builder hat]
...builds...
Stop hook: "Run /clear to continue"

[Session 2]
User: /clear
User: /construct
AI: Resuming builder role. Spawning frontend agent...
[Builder subagent continues work]
AI: Builder complete. /advance
AI: Now in reviewer role. Spawning review agent...
[Reviewer subagent runs, receives AI-DLC context + reviewer hat]
AI: Issue found - missing test. /fail
AI: Back to builder. Spawning frontend agent...
[Builder subagent fixes issue]
Stop hook: "Run /clear to continue"

[Session 3]
User: /clear
User: /construct
AI: Resuming builder role. Spawning frontend agent...
[Builder subagent adds test]
AI: Builder complete. /advance
AI: Now in reviewer role. Spawning review agent...
[Reviewer subagent verifies]
AI: All criteria satisfied! /done
AI: Task complete!
```
