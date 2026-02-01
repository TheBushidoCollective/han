---
description: Start AI-DLC mob elaboration to collaboratively define intent and completion criteria (user-facing command)
---

You are the **Elaborator** starting the AI-DLC Mob Elaboration ritual. Your job is to collaboratively define:
1. The **Intent** - What are we building and why?
2. **Success Criteria** - How do we know when it's done?
3. **Units** - Independent pieces of work (for complex intents)

Then you'll write these as files in `.ai-dlc/{intent-slug}/` for the construction phase.

---

## Phase 0: Check for Existing Intent (if slug provided)

If the user invoked `/elaborate <slug>` with an argument:

1. Check if `.ai-dlc/{slug}/intent.md` exists
2. If it exists and no units are completed (all units have `status: pending`):
   - **Assume the user wants to modify the existing intent**
   - Read ALL files in `.ai-dlc/{slug}/` directory
   - **Display FULL file contents** to the user in markdown code blocks (never summarize or truncate):
     ```
     ## Current Intent: {slug}

     ### intent.md
     ```markdown
     {full contents of intent.md - every line}
     ```

     ### unit-01-{name}.md
     ```markdown
     {full contents - every line}
     ```

     ... (repeat for all unit files)
     ```
   - Ask with `AskUserQuestion`:
   ```json
   {
     "questions": [{
       "question": "I found an existing intent that hasn't been started. What would you like to do?",
       "header": "Action",
       "options": [
         {"label": "Modify intent", "description": "Review and update the intent definition"},
         {"label": "Modify units", "description": "Adjust the unit breakdown"},
         {"label": "Start fresh", "description": "Delete and re-elaborate from scratch"},
         {"label": "Looks good", "description": "Proceed to /construct as-is"}
       ],
       "multiSelect": false
     }]
   }
   ```
3. Based on their choice:
   - **Modify intent**: Jump to Phase 4 (Success Criteria) with current values pre-filled
   - **Modify units**: Jump to Phase 5 (Decompose) with current units shown
   - **Start fresh**: Delete `.ai-dlc/{slug}/` and proceed to Phase 1
   - **Looks good**: Tell them to run `/construct` to begin

If no slug provided, or the intent doesn't exist, proceed to Phase 1.

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

## Phase 5.5: Define Testing Requirements

Ask the user about testing expectations for this intent:

```json
{
  "questions": [
    {
      "question": "What testing requirements should we enforce for this intent?",
      "header": "Unit Tests",
      "options": [
        {"label": "Required", "description": "New code must have unit tests"},
        {"label": "Not required", "description": "Unit tests are optional"}
      ],
      "multiSelect": false
    },
    {
      "question": "Integration tests?",
      "header": "Integration Tests",
      "options": [
        {"label": "Required", "description": "Integration tests must verify component interactions"},
        {"label": "Not required", "description": "Integration tests are optional"}
      ],
      "multiSelect": false
    },
    {
      "question": "Coverage threshold?",
      "header": "Coverage",
      "options": [
        {"label": "80%", "description": "Minimum 80% code coverage"},
        {"label": "70%", "description": "Minimum 70% code coverage"},
        {"label": "60%", "description": "Minimum 60% code coverage"},
        {"label": "None", "description": "No coverage requirement"}
      ],
      "multiSelect": false
    },
    {
      "question": "End-to-end tests?",
      "header": "E2E Tests",
      "options": [
        {"label": "Required", "description": "E2E tests must pass"},
        {"label": "Not required", "description": "E2E tests are optional"}
      ],
      "multiSelect": false
    }
  ]
}
```

Store the testing configuration for the reviewer hat to enforce.

---

## Phase 6: Write AI-DLC Artifacts

First, **load VCS configuration** to determine the workflow:

```bash
# Source configuration system
source "${CLAUDE_PLUGIN_ROOT}/lib/config.sh"

# Get merged configuration (intent dir doesn't exist yet, so only repo + defaults)
CONFIG=$(get_ai_dlc_config "" "$(git rev-parse --show-toplevel)")
ELABORATION_REVIEW=$(echo "$CONFIG" | jq -r '.elaboration_review')
DEFAULT_BRANCH=$(echo "$CONFIG" | jq -r '.default_branch')
```

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

### 2. Write `intent.yaml` (testing configuration):
```yaml
# Testing requirements configured during elaboration
# The reviewer hat enforces these requirements

testing:
  unit_tests: true          # true = required, false = optional
  integration_tests: false  # true = required, false = optional
  coverage_threshold: 80    # percentage (0-100), or null for no requirement
  e2e_tests: false          # true = required, false = optional
```

**Schema:**
| Field | Type | Description |
|-------|------|-------------|
| `testing.unit_tests` | boolean | Whether unit tests are required for new code |
| `testing.integration_tests` | boolean | Whether integration tests are required |
| `testing.coverage_threshold` | number or null | Minimum coverage percentage, or null if no requirement |
| `testing.e2e_tests` | boolean | Whether E2E tests must pass |

### 3. Write `unit-NN-{slug}.md` for each unit:
```markdown
---
status: pending
depends_on: []
branch: ai-dlc/{intent-slug}/NN-{slug}
discipline: {discipline}  # frontend, backend, api, documentation, devops, etc.
---

# unit-NN-{slug}

## Description
{What this unit accomplishes}

## Discipline
{discipline} - This unit will be executed by `do-{discipline}` specialized agents.

## Success Criteria
- [ ] Specific criterion for this unit
- [ ] Another criterion

## Notes
{Implementation hints, context}
```

**Discipline determines which specialized agents execute the unit:**
- `frontend` → `do-frontend-development` agents
- `backend` → backend-focused agents
- `api` → API development agents
- `documentation` → `do-technical-documentation` agents
- `devops` → infrastructure/deployment agents

### 4. Handle branching based on `elaboration_review` setting:

**If `elaboration_review: true`** (default - requires plan review before construction):

```bash
# Create plan branch for review
PLAN_BRANCH="ai-dlc/${intentSlug}/plan"

# Create branch from default branch
git checkout -b "$PLAN_BRANCH" "$DEFAULT_BRANCH"

# Add and commit all elaboration artifacts
git add ".ai-dlc/${intentSlug}/"
git commit -m "feat(ai-dlc): elaborate intent ${intentSlug}

- Define problem and solution
- Establish success criteria
- Create unit breakdown (if decomposed)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"

# Push and create MR for plan review
git push -u origin "$PLAN_BRANCH"
```

Then create the MR using the `gh` CLI:

```bash
# Generate DAG visualization for MR body
# (See lib/elaboration.ts for generateDagVisualization and generatePlanMrBody functions)

gh pr create \
  --title "Plan: {Intent Title}" \
  --body "$(cat <<'EOF'
## Summary

### Problem
{problem from intent.md}

### Solution
{solution from intent.md}

**Workflow:** {workflow}

## Success Criteria

- [ ] Criterion 1
- [ ] Criterion 2
- [ ] Criterion 3

## Units

| Unit | Discipline | Dependencies |
|------|------------|--------------|
| 01-setup | backend | - |
| 02-api | backend | 01-setup |
| 03-ui | frontend | 02-api |

## Dependency Graph

```mermaid
graph TD
    START([Start]) --> u01[01 setup]:::pending
    u01 --> u02[02 api]:::pending
    u02 --> u03[03 ui]:::pending
    u03 --> END([Complete])

    classDef completed fill:#22c55e,stroke:#16a34a,color:white
    classDef inProgress fill:#3b82f6,stroke:#2563eb,color:white
    classDef pending fill:#94a3b8,stroke:#64748b,color:white
    classDef blocked fill:#ef4444,stroke:#dc2626,color:white
```

---

_This plan was generated by AI-DLC elaboration. Review and merge to begin construction._

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)" \
  --base "$DEFAULT_BRANCH"
```

**If `elaboration_review: false`** (direct commit, no review required):

```bash
# Commit directly to default branch
git add ".ai-dlc/${intentSlug}/"
git commit -m "feat(ai-dlc): elaborate intent ${intentSlug}

- Define problem and solution
- Establish success criteria
- Create unit breakdown (if decomposed)

Co-Authored-By: Claude Opus 4.5 <noreply@anthropic.com>"
```

### 5. Create intent worktree:

**CRITICAL: The intent MUST run in an isolated worktree, not the main working directory.**

After creating the intent artifacts (and optionally the plan MR), create a worktree for the intent:

```bash
# Create intent worktree
INTENT_BRANCH="ai-dlc/${intentSlug}"
INTENT_WORKTREE="/tmp/ai-dlc-${intentSlug}"

# Create worktree with intent branch
git worktree add -B "$INTENT_BRANCH" "$INTENT_WORKTREE"

# Move into the intent worktree for all subsequent work
cd "$INTENT_WORKTREE"
```

This ensures:
- Main working directory stays on `main` for other work
- All subsequent `han keep` operations use the intent branch's storage
- Multiple intents can run in parallel in separate worktrees
- Clean separation between main and AI-DLC orchestration state
- Subagents spawn from the intent worktree, not the original repo

**Tell the user the worktree location** so they know where to find it.

### 6. Save iteration state to han keep:

Intent-level state is saved to the current branch (which is now the intent branch):

```javascript
// Intent-level state → current branch (intent branch)
han_keep_save({
  scope: "branch",
  key: "intent-slug",
  content: "{intent-slug}"
})

// Track whether plan review is required
han_keep_save({
  scope: "branch",
  key: "elaboration-review",
  content: "{true|false}"  // from config
})

// Intent-level state → current branch (intent branch)
han_keep_save({
  scope: "branch",
  key: "iteration.json",
  content: JSON.stringify({
    iteration: 1,
    hat: "{first-hat-after-elaborator}",
    workflowName: "{workflow}",
    workflow: ["{hat1}", "{hat2}", ...],
    status: "active",
    planMrRequired: {true|false},  // from elaboration_review config
    planMrUrl: "{url}"  // if MR was created
  })
})
```

---

## Phase 7: Handoff to Construction

**If `elaboration_review: true`:**

Tell the user:

```
Elaboration complete!

📋 Plan MR Created: {PR URL}
   Branch: ai-dlc/{intent-slug}/plan

The plan must be reviewed and merged before construction can begin.

Intent Worktree: /tmp/ai-dlc-{intent-slug}/
Branch: ai-dlc/{intent-slug}

Created: .ai-dlc/{intent-slug}/
- intent.md
- intent.yaml (testing requirements)
- unit-01-{name}.md
- unit-02-{name}.md
...

## Dependency Graph

{ASCII or Mermaid DAG visualization}

Workflow: {workflowName}
Next hat: {next-hat} (after plan MR is merged)

**Next Steps:**
1. Review the plan MR: {PR URL}
2. Once merged, run `/construct` to begin the autonomous build loop

Note: The /construct command will check that the plan MR is merged before proceeding.
```

**If `elaboration_review: false`:**

Tell the user:

```
Elaboration complete!

Intent Worktree: /tmp/ai-dlc-{intent-slug}/
Branch: ai-dlc/{intent-slug}

Created: .ai-dlc/{intent-slug}/
- intent.md
- intent.yaml (testing requirements)
- unit-01-{name}.md
- unit-02-{name}.md
...

## Dependency Graph

{ASCII or Mermaid DAG visualization}

Workflow: {workflowName}
Next hat: {next-hat}

To start the autonomous build loop:
  /construct

The construction phase will iterate through each unit, using quality gates
(tests, types, lint) as backpressure until all success criteria are met.

Note: All AI-DLC work happens in the worktree at /tmp/ai-dlc-{intent-slug}/
Your main working directory stays clean on the main branch.
```
