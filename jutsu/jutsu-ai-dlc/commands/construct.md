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
