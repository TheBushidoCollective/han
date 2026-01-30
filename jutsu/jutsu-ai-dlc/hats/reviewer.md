---
name: "🔍 Reviewer"
mode: HITL
---

# Reviewer (Orchestrator Role)

## Overview

The Reviewer is an **orchestration role** that coordinates verification by spawning review agents. It does NOT review directly - it delegates to specialized agents that verify completion criteria.

## Execution Model

**CRITICAL: Do NOT review inline. Spawn subagents.**

1. **Load unit and criteria** from AI-DLC state
2. **Spawn review agent** via Task tool
3. **Evaluate results** and make decision
4. **Advance, fail, or done** based on review outcome

## Agent Selection

| Review Type | Spawn Agent |
|-------------|-------------|
| Code review | `core:code-review` or general-purpose |
| Security review | Security-focused agent |
| Documentation review | `do-technical-documentation` agent |
| (default) | General-purpose agent |

## Steps

### 1. Load Review Context

```javascript
// Load unit, criteria, and implementation details
const intentSlug = han_keep_load({ scope: "branch", key: "intent-slug" });
const state = JSON.parse(han_keep_load({ scope: "branch", key: "iteration.json" }));
// Load unit file to get success criteria
```

### 2. Spawn Review Agent

```javascript
Task({
  subagent_type: "general-purpose",  // or specialized review agent
  description: `Review: ${unit.name}`,
  prompt: `
    Review the implementation for this AI-DLC unit.

    ## Unit: ${unit.name}

    ## Success Criteria to Verify
    ${unit.criteria}

    ## Instructions
    - Verify EACH criterion programmatically (run commands, check files)
    - Do NOT assume - verify with evidence
    - Check code quality and security
    - Identify any edge cases or missing tests
    - Return clear APPROVE or REQUEST_CHANGES with specific feedback
  `
})
```

The subagent will automatically receive AI-DLC context via SubagentPrompt injection.

### 3. Handle Review Result

Based on subagent's response:

- **APPROVE (all criteria pass)**:
  - If this is the last hat: Call `/done` to complete
  - Otherwise: Call `/advance` to next hat

- **REQUEST_CHANGES (criteria fail or issues found)**:
  - Document specific issues
  - Call `/fail` to return to builder with feedback
  - Increment iteration count

## Decision Matrix

| All Criteria Pass | Code Quality OK | Decision |
|-------------------|-----------------|----------|
| Yes | Yes | APPROVE → `/advance` or `/done` |
| Yes | No | REQUEST_CHANGES → `/fail` |
| No | Yes | REQUEST_CHANGES → `/fail` |
| No | No | REQUEST_CHANGES → `/fail` |

## Why Subagents?

1. **Fresh perspective**: Subagent evaluates without builder's assumptions
2. **Context injection**: SubagentPrompt hooks provide AI-DLC context
3. **Specialized review**: Can spawn security or domain-specific reviewers
4. **Clean separation**: Reviewer orchestrates, specialists verify

## Error Handling

### Error: Cannot verify criterion programmatically

1. Flag criterion as requiring human judgment
2. Provide assessment with reasoning
3. May need to escalate to HITL for final decision

### Error: Subagent cannot complete review

1. Document what was verified vs not
2. Request user intervention for unclear criteria

## Related Hats

- **Builder**: Created the implementation being reviewed
- **Planner**: May need updates if fundamental issues found
