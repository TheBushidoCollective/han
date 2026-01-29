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

Also save the intent slug for DAG lookup (used by the SessionStart hook to display unit status):

```javascript
// Save intent slug - this should match the directory name under .ai-dlc/
// Example: for ".ai-dlc/add-oauth/", the intent-slug is "add-oauth"
han_keep_save({ scope: "branch", key: "intent-slug", content: "{intent-slug}" })
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

### Step 5b: Decompose into Units (Optional)

For complex intents, decompose the work into **units** - independent pieces of work that can be executed in parallel by autonomous bolts.

**Important:** The `{intent-slug}` directory name MUST match the value saved to `intent-slug` in Step 5 above. This enables the SessionStart hook to find and display unit status.

#### Unit Structure

Each unit is a file in `.ai-dlc/{intent-slug}/`:

```
.ai-dlc/
  add-oauth/
    intent.md           # Overall intent description
    unit-01-setup.md    # First unit (no deps)
    unit-02-provider.md # Second unit (depends on 01)
    unit-03-session.md  # Third unit (depends on 01)
    unit-04-auth.md     # Fourth unit (depends on 02 and 03)
```

#### Unit File Format

```markdown
---
status: pending
depends_on: [unit-01-setup, unit-03-session]
branch: ai-dlc/add-oauth/04-auth-integration
---
# unit-04-auth-integration

## Description
Integrate all authentication components.

## Completion Criteria
- [ ] Login button triggers OAuth flow
- [ ] Session persists across refreshes
```

#### Unit Status Values

| Status | Description |
|--------|-------------|
| `pending` | Not started, may be waiting for dependencies |
| `in_progress` | Being worked on by a bolt |
| `completed` | Successfully finished |
| `blocked` | Explicitly blocked (manual intervention needed) |

#### Unit Naming Convention

- Format: `unit-NN-slug.md` where NN is a zero-padded number
- Numbers indicate suggested execution order (1 before 2)
- Slugs should be descriptive and lowercase with hyphens

#### Branch Naming Convention

Each unit should specify its branch:
```
ai-dlc/{intent-slug}/{unit-number}-{unit-slug}
```

Example: `ai-dlc/add-oauth/04-auth-integration`

#### DAG Dependencies

The `depends_on` field declares which units must complete before this one can start:
- Use the full unit name without `.md` extension
- An empty array `[]` means no dependencies
- Units with satisfied dependencies are "ready" for execution

#### Example Decomposition

For "Add Google OAuth login":

| Unit | Dependencies | Description |
|------|--------------|-------------|
| unit-01-setup | [] | Install OAuth library, add env vars |
| unit-02-provider | [unit-01-setup] | Implement Google OAuth provider |
| unit-03-session | [unit-01-setup] | Implement session management |
| unit-04-auth | [unit-02-provider, unit-03-session] | Wire up login flow |
| unit-05-tests | [unit-04-auth] | Add integration tests |

This forms a DAG where units 02 and 03 can run in parallel after 01 completes.

#### When to Use Units

Use units when:
- Work can be parallelized across multiple bolts
- Intent is complex with clear sub-tasks
- Dependencies between sub-tasks are explicit
- You want to track progress at granular level

Skip units when:
- Intent is simple and sequential
- Work cannot be meaningfully parallelized
- Single bolt can handle entire intent

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
