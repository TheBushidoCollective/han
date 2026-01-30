---
description: Start AI-DLC mob elaboration to collaboratively define intent and completion criteria (user-facing command)
---

## Name

`jutsu-ai-dlc:elaborate` - Start mob elaboration to define intent and completion criteria.

## Synopsis

```
/elaborate
```

## Description

**User-facing command** - The user runs this once to start a new AI-DLC workflow.

This is the **elaboration phase** - collaborative inception where you and the user define what to build. You wear the **Elaborator hat** and your job is to:

1. **Understand the user's intent** - What do they want to accomplish?
2. **Ask clarifying questions** - Don't assume, explore
3. **Identify edge cases** - What could go wrong? What's out of scope?
4. **Define completion criteria** - How will we know when it's done?

**Important:**
- Do NOT implement anything - This is pure discovery
- Do NOT skip this phase - Good criteria enable autonomy later
- Collaborate - This is HITL (human-in-the-loop) by design
- User runs `/construct` next - That kicks off the autonomous loop

## Implementation

### Step 1: Select Workflow

Present the available workflows to the user:

| Workflow | Description | Hat Sequence |
|----------|-------------|--------------|
| **default** | Standard development workflow | elaborator → planner → builder → reviewer |
| **tdd** | Test-Driven Development | test-writer → implementer → refactorer |
| **adversarial** | Security-focused development | builder → red-team → blue-team → reviewer |
| **hypothesis** | Scientific debugging | observer → hypothesizer → experimenter → analyst |

Ask: "Which workflow fits this task? (default: **default**)"

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

Once you've collaborated on intent, criteria, and workflow, save them.

> **Note:** The examples below show MCP tool calls (`han_keep_save`). Use the Han MCP server tools
> or equivalent CLI commands: `han keep save --branch <key> "<content>"`

```bash
# CLI equivalent commands:
han keep save --branch intent.md "Your intent description"
han keep save --branch completion-criteria.md "- [ ] Criterion 1\n- [ ] Criterion 2"
han keep save --branch intent-slug "my-feature"
```

Then initialize the iteration state with the selected workflow:

```bash
# Initialize iteration state (JSON)
han keep save --branch iteration.json '{"iteration":1,"hat":"elaborator","workflowName":"default","workflow":["elaborator","planner","builder","reviewer"],"status":"active"}'
```

### Step 5b: Decompose into Units (Optional)

For complex intents, decompose the work into **units** - independent pieces of work that can be executed in parallel.

#### Unit File Format

Each unit is a file in `.ai-dlc/{intent-slug}/`:

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

### Step 6: Transition to Construction

When elaboration is complete:

1. Call `/advance` internally to set hat to next in workflow
2. Tell the user:

```
Intent and criteria defined! Workflow: {workflowName}

Run `/construct` to start the autonomous build loop.
```
