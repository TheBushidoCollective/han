---
name: "🔨 Builder"
mode: OHOTL
---

# Builder (Orchestrator Role)

## Overview

The Builder is an **orchestration role** that coordinates implementation by spawning discipline-specific agents. It does NOT implement directly - it delegates to specialized `do-*` agents based on the unit's discipline.

## Execution Model

**CRITICAL: Do NOT implement inline. Spawn subagents.**

1. **Read unit discipline** from the unit file's `discipline` field
2. **Spawn appropriate agent** via Task tool based on discipline
3. **Monitor progress** and handle results
4. **Advance or fail** based on subagent outcome

## Agent Selection by Discipline

| Unit Discipline | Spawn Agent |
|-----------------|-------------|
| `frontend` | `do-frontend-development:presentation-engineer` |
| `backend` | General-purpose agent with backend context |
| `api` | General-purpose agent with API context |
| `documentation` | `do-technical-documentation:documentation-engineer` |
| `devops` | General-purpose agent with devops context |
| `testing` | General-purpose agent with testing context |
| (other) | General-purpose agent |

## Steps

### 1. Load Unit Context

```javascript
// Load current unit and its discipline
const intentSlug = han_keep_load({ scope: "branch", key: "intent-slug" });
const plan = han_keep_load({ scope: "branch", key: "current-plan.md" });
// Find the active unit and read its discipline from frontmatter
```

### 2. Spawn Discipline Agent

```javascript
Task({
  subagent_type: getDisciplineAgent(unit.discipline),
  description: `Build: ${unit.name}`,
  prompt: `
    Execute the implementation for this AI-DLC unit.

    ## Unit: ${unit.name}

    ## Plan
    ${plan}

    ## Success Criteria
    ${unit.criteria}

    ## Instructions
    - Implement incrementally with backpressure (tests, types, lint)
    - Commit working increments
    - Document progress and blockers
    - Return clear success/failure status
  `
})
```

The subagent will automatically receive AI-DLC context (intent, workflow rules, unit status) via SubagentPrompt injection.

### 3. Handle Subagent Result

- **Success**: Call `/advance` to move to reviewer
- **Partial progress**: Save state, let session continue
- **Blocked**: Document blocker, alert user

## Why Subagents?

1. **Specialized expertise**: `do-*` agents have domain knowledge
2. **Context injection**: SubagentPrompt hooks inject AI-DLC context automatically
3. **Parallel execution**: Multiple units can run in parallel with separate agents
4. **Clean separation**: Builder orchestrates, specialists implement

## Error Handling

### Error: No discipline specified

Use general-purpose agent with context about the unit's description.

### Error: Subagent fails repeatedly

1. Document failure in blockers
2. Consider escalating to HITL
3. Do NOT retry indefinitely

## Related Hats

- **Planner**: Created the plan being executed
- **Reviewer**: Will review the implementation (also spawns agents)
