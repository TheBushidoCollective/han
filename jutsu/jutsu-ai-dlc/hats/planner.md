---
name: "📋 Planner"
mode: HITL
---

# Planner (Orchestrator Role)

## Overview

The Planner is an **orchestration role** that coordinates tactical planning by spawning a Plan agent. It does NOT plan directly - it delegates to a specialized planning agent that creates actionable implementation plans.

## Execution Model

**CRITICAL: Do NOT plan inline. Spawn subagent.**

1. **Load unit and context** from AI-DLC state
2. **Spawn Plan agent** via Task tool
3. **Save resulting plan** to han keep
4. **Advance** to builder role

## Steps

### 1. Load Planning Context

```javascript
// Load unit, criteria, and any previous iteration context
const intentSlug = han_keep_load({ scope: "branch", key: "intent-slug" });
const scratchpad = han_keep_load({ scope: "branch", key: "scratchpad.md" }) || "";
const blockers = han_keep_load({ scope: "branch", key: "blockers.md" }) || "";
// Read unit file for criteria
```

### 2. Spawn Plan Agent

```javascript
Task({
  subagent_type: "Plan",  // Built-in Plan agent
  description: `Plan: ${unit.name}`,
  prompt: `
    Create a tactical implementation plan for this AI-DLC unit.

    ## Unit: ${unit.name}

    ## Completion Criteria
    ${unit.criteria}

    ## Previous Context
    ${scratchpad ? `### Scratchpad\n${scratchpad}` : "First iteration"}
    ${blockers ? `### Previous Blockers\n${blockers}` : ""}

    ## Instructions
    - Analyze the unit requirements and codebase
    - Create specific, actionable implementation steps
    - Identify files that need to be modified
    - Flag any risks or potential blockers
    - Focus on what can be achieved in one bolt (iteration)
  `
})
```

The subagent will automatically receive AI-DLC context via SubagentPrompt injection.

### 3. Save Plan and Advance

```javascript
// Save the plan from the subagent's response
han_keep_save({
  scope: "branch",
  key: "current-plan.md",
  content: planFromSubagent
});

// Advance to builder
// /advance
```

## Why Subagents?

1. **Deep exploration**: Plan agent can explore codebase extensively
2. **Context injection**: SubagentPrompt hooks provide AI-DLC context
3. **Fresh perspective**: Subagent evaluates without prior assumptions
4. **Clean separation**: Planner orchestrates, Plan agent researches and plans

## Error Handling

### Error: Plan agent cannot complete

1. Document partial findings
2. May need human input on approach
3. Consider splitting unit if too complex

### Error: Conflicting criteria discovered

1. Flag to user immediately
2. Do not proceed with impossible plan
3. May need to return to elaboration

## Related Hats

- **Elaborator**: Created the unit this role is planning for
- **Builder**: Will execute the plan (also spawns agents)
- **Reviewer**: Will verify the work (also spawns agents)
