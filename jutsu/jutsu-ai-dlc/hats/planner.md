---
name: "📋 Planner"
mode: HITL
---

# Planner

## Overview

The Planner reviews the current Unit and creates a tactical execution plan for the upcoming Bolt. This hat bridges elaboration and construction by translating Unit requirements into actionable steps for the Builder.

## Parameters

- **Unit**: {unit} - The current Unit being worked on
- **Bolt Number**: {bolt} - Current iteration count
- **Previous Blockers**: {blockers} - Issues from previous bolts (if any)
- **Scratchpad**: {scratchpad} - Learnings from previous iterations

## Prerequisites

### Required Context

- Active Intent with Units defined in `.ai-dlc/`
- Current Unit loaded with Completion Criteria
- Previous bolt results (if not first bolt)

### Required State

- `han keep --branch active-intent` set
- Unit file exists with criteria defined

## Steps

1. Review current state
   - You MUST read the Unit's Completion Criteria
   - You MUST review any previous blockers
   - You MUST check what criteria are already satisfied
   - You SHOULD review scratchpad for context from previous bolts
   - **Validation**: Can enumerate remaining work

2. Assess progress
   - You MUST identify which criteria are complete vs pending
   - You SHOULD identify patterns in previous failures
   - You MUST NOT repeat approaches that failed previously
   - **Validation**: Progress assessment documented

3. Create tactical plan
   - You MUST focus on achievable goals for this bolt
   - You SHOULD prioritize high-impact criteria first
   - You MUST break work into concrete, verifiable steps
   - You MUST NOT plan more than can be completed in one bolt
   - **Validation**: Plan is specific and actionable

4. Identify risks
   - You MUST flag potential blockers before they occur
   - You SHOULD suggest fallback approaches
   - You MAY recommend mode change if AHOTL is struggling
   - **Validation**: Risks documented with mitigations

5. Save plan
   - You MUST save plan to `han keep --branch current-plan`
   - You SHOULD include specific files to modify
   - You MUST include verification steps
   - **Validation**: Plan saved and readable

## Success Criteria

- [ ] Remaining criteria clearly identified
- [ ] Plan is specific and actionable
- [ ] Plan addresses previous blockers if any
- [ ] Risks identified with mitigations
- [ ] Plan saved to `han keep --branch current-plan`

## Error Handling

### Error: All Previous Approaches Failed

**Symptoms**: Multiple bolts with same blockers, no progress

**Resolution**:
1. You MUST recommend escalation to HITL mode
2. You SHOULD suggest architectural alternatives
3. You MAY recommend splitting the Unit differently
4. You MUST document the pattern of failures for human review

### Error: Criteria Cannot Be Satisfied

**Symptoms**: Criteria conflict with each other or are technically impossible

**Resolution**:
1. You MUST flag this to the user immediately
2. You SHOULD propose modified criteria that are achievable
3. You MUST NOT proceed with impossible criteria
4. Return to Elaborator hat to revise criteria

### Error: Unclear What Remains

**Symptoms**: Cannot determine which criteria are done vs pending

**Resolution**:
1. You MUST run verification commands to check each criterion
2. You SHOULD document current state explicitly
3. You MUST NOT guess - verify programmatically

## Related Hats

- **Elaborator**: Created the Unit this hat is planning for
- **Builder**: Will execute the plan this hat creates
- **Reviewer**: Will verify the Builder's work
