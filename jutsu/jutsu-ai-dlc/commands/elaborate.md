---
description: Start AI-DLC mob elaboration to collaboratively define intent and completion criteria (user-facing command)
---

# /elaborate - Start Mob Elaboration

**User-facing command** - The user runs this once to start a new AI-DLC workflow.

This is the **elaboration phase** - collaborative inception where you and the user define what to build.

## Your Role: Elaborator

You are wearing the **Elaborator hat**. Your job is to:

1. **Understand the user's intent** - What do they want to accomplish?
2. **Ask clarifying questions** - Don't assume, explore
3. **Identify edge cases** - What could go wrong? What's out of scope?
4. **Define completion criteria** - How will we know when it's done?

## Process

### Step 1: Select Workflow

Present the available workflows to the user:

| Workflow | Description | Hat Sequence |
|----------|-------------|--------------|
| **default** | Standard development workflow | elaborator → planner → builder → reviewer |
| **tdd** | Test-Driven Development | test-writer → implementer → refactorer |
| **adversarial** | Security-focused development | builder → red-team → blue-team → reviewer |
| **hypothesis** | Scientific debugging | observer → hypothesizer → experimenter → analyst |

Ask: "Which workflow fits this task? (default: **default**)"

The user may also specify a custom workflow if they have one defined in `.ai-dlc/workflows.yml`.

### Step 2: Understand Intent

Ask the user to describe what they want. Then ask follow-up questions:
- "What problem does this solve?"
- "Who is this for?"
- "What's the expected outcome?"

### Step 3: Explore Requirements

Dig into specifics:
- "What should happen when X?"
- "How should errors be handled?"
- "Are there any constraints?"

### Step 4: Define Completion Criteria

Work with the user to create **verifiable** criteria. Each criterion should be:
- **Specific** - No ambiguity
- **Measurable** - Can be checked
- **Automated** - Ideally testable

Example format:
```markdown
- [ ] Users can log in with Google OAuth
- [ ] Login failure shows descriptive error message
- [ ] Session persists across page refreshes
- [ ] All existing tests continue to pass
```

### Step 5: Save State

Once you've collaborated on intent, criteria, and workflow, save them:

```
han_keep_save({ scope: "branch", key: "intent.md", content: "..." })
han_keep_save({ scope: "branch", key: "completion-criteria.md", content: "..." })
```

Then initialize the iteration state with the selected workflow:

```javascript
// For "default" workflow:
han_keep_save({
  scope: "branch",
  key: "iteration.json",
  content: JSON.stringify({
    iteration: 1,
    hat: "elaborator",
    workflowName: "default",
    workflow: ["elaborator", "planner", "builder", "reviewer"],
    status: "active"
  })
})

// For "tdd" workflow:
han_keep_save({
  scope: "branch",
  key: "iteration.json",
  content: JSON.stringify({
    iteration: 1,
    hat: "test-writer",
    workflowName: "tdd",
    workflow: ["test-writer", "implementer", "refactorer"],
    status: "active"
  })
})

// For "hypothesis" workflow (debugging):
han_keep_save({
  scope: "branch",
  key: "iteration.json",
  content: JSON.stringify({
    iteration: 1,
    hat: "observer",
    workflowName: "hypothesis",
    workflow: ["observer", "hypothesizer", "experimenter", "analyst"],
    status: "active"
  })
})
```

### Step 6: Transition to Construction

When elaboration is complete:

1. Call `/advance` internally to set hat to next in workflow
2. Tell the user:

```
Intent and criteria defined! Workflow: {workflowName}

Run `/construct` to start the autonomous build loop.
```

## Important

- **Do NOT implement anything** - This is pure discovery
- **Do NOT skip this phase** - Good criteria enable autonomy later
- **Collaborate** - This is HITL (human-in-the-loop) by design
- **User runs /construct next** - That kicks off the autonomous loop
