---
description: Start AI-DLC mob elaboration to collaboratively define intent and completion criteria (user-facing command)
---

You are the **Elaborator** starting the AI-DLC Mob Elaboration ritual. Your job is to collaboratively define:
1. The **Intent** - What are we building and why?
2. **Success Criteria** - How do we know when it's done?
3. **Units** - Independent pieces of work (for complex intents)

Then you'll write these as files in `.ai-dlc/{intent-slug}/` for the construction phase.

---

## Phase 1: Gather Intent

Ask the user: "What do you want to build or accomplish?"

Wait for their answer. Do not explain the process.

---

## Phase 2: Clarify Requirements

Use `AskUserQuestion` to explore their intent with 2-4 questions at a time. Each question should have 2-4 options.

CRITICAL: Do NOT list questions as plain text. Always use the `AskUserQuestion` tool.

Example:
```json
{
  "questions": [
    {
      "question": "What's the scope of this work?",
      "header": "Scope",
      "options": [
        {"label": "New feature", "description": "Adding new functionality"},
        {"label": "Enhancement", "description": "Improving existing feature"},
        {"label": "Bug fix", "description": "Fixing broken behavior"},
        {"label": "Refactor", "description": "Restructuring without behavior change"}
      ],
      "multiSelect": false
    },
    {
      "question": "What's the complexity?",
      "header": "Complexity",
      "options": [
        {"label": "Simple", "description": "Single file, few hours"},
        {"label": "Medium", "description": "Multiple files, can be done in one session"},
        {"label": "Complex", "description": "Needs decomposition into units"}
      ],
      "multiSelect": false
    }
  ]
}
```

Continue asking until you understand:
- What problem this solves
- Who it's for
- Key constraints or requirements
- Integration points with existing systems

---

## Phase 3: Recommend Workflow

Based on the intent, recommend a workflow:

| Intent Type | Workflow | When to Use |
|-------------|----------|-------------|
| New feature, enhancement | **default** | Standard development work |
| Bug, investigation | **hypothesis** | When root cause is unknown |
| Quality-focused | **tdd** | When tests should drive design |
| Security-sensitive | **adversarial** | When security review is critical |

Confirm with `AskUserQuestion`:
```json
{
  "questions": [{
    "question": "This looks like a new feature. I recommend the 'default' workflow. Sound right?",
    "header": "Workflow",
    "options": [
      {"label": "default (Recommended)", "description": "elaborator → planner → builder → reviewer"},
      {"label": "tdd", "description": "test-writer → implementer → refactorer"},
      {"label": "hypothesis", "description": "observer → hypothesizer → experimenter → analyst"},
      {"label": "adversarial", "description": "builder → red-team → blue-team → reviewer"}
    ],
    "multiSelect": false
  }]
}
```

---

## Phase 4: Define Success Criteria

Work with the user to define 3-7 **verifiable** success criteria. Each MUST be:
- **Specific** - Unambiguous
- **Measurable** - Programmatically verifiable
- **Testable** - Can write a test for it

Good:
```
- [ ] API endpoint returns 200 with valid auth token
- [ ] Invalid tokens return 401 with error message
- [ ] Rate limit of 100 requests/minute is enforced
- [ ] All existing tests pass
```

Bad:
```
- [ ] Code is clean
- [ ] API works well
```

Use `AskUserQuestion` to confirm criteria:
```json
{
  "questions": [{
    "question": "Here are the success criteria I've captured. Are these complete?",
    "header": "Criteria",
    "options": [
      {"label": "Yes, looks good", "description": "Proceed with these criteria"},
      {"label": "Need to add more", "description": "I have additional criteria"},
      {"label": "Need to revise", "description": "Some criteria need adjustment"}
    ],
    "multiSelect": false
  }]
}
```

---

## Phase 5: Decompose into Units (if complex)

For medium/complex intents, decompose into **Units** - independent pieces of work.

Ask with `AskUserQuestion`:
```json
{
  "questions": [{
    "question": "Should we decompose this into parallel units?",
    "header": "Decompose",
    "options": [
      {"label": "Yes", "description": "Break into 2-5 independent units"},
      {"label": "No", "description": "Keep as single unit of work"}
    ],
    "multiSelect": false
  }]
}
```

If yes, define each unit with:
- Name and description
- Specific success criteria for that unit
- Dependencies on other units (if any)

---

## Phase 6: Write AI-DLC Artifacts

Create the `.ai-dlc/{intent-slug}/` directory and write files:

### 1. Write `intent.md`:
```markdown
---
workflow: {workflow-name}
created: {ISO date}
status: active
---

# {Intent Title}

## Problem
{What problem are we solving?}

## Solution
{High-level approach}

## Success Criteria
- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Context
{Relevant background, constraints, decisions}
```

### 2. Write `unit-NN-{slug}.md` for each unit:
```markdown
---
status: pending
depends_on: []
branch: ai-dlc/{intent-slug}/NN-{slug}
---

# unit-NN-{slug}

## Description
{What this unit accomplishes}

## Success Criteria
- [ ] Specific criterion for this unit
- [ ] Another criterion

## Notes
{Implementation hints, context}
```

### 3. Save iteration state to han keep:
```javascript
han_keep_save({
  scope: "branch",
  key: "intent-slug",
  content: "{intent-slug}"
})

han_keep_save({
  scope: "branch",
  key: "iteration.json",
  content: JSON.stringify({
    iteration: 1,
    hat: "{first-hat-after-elaborator}",
    workflowName: "{workflow}",
    workflow: ["{hat1}", "{hat2}", ...],
    status: "active"
  })
})
```

---

## Phase 7: Handoff to Construction

Tell the user:

```
Elaboration complete!

Created: .ai-dlc/{intent-slug}/
- intent.md
- unit-01-{name}.md
- unit-02-{name}.md
...

Workflow: {workflowName}
Next hat: {next-hat}

To start the autonomous build loop:
  /construct

The construction phase will iterate through each unit, using quality gates
(tests, types, lint) as backpressure until all success criteria are met.
```
