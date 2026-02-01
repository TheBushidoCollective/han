---
description: Create tactical implementation plan for a feature or task
disable-model-invocation: false
---

# plan

## Name

han-core:plan - Create tactical implementation plan for a feature or task

## Synopsis

```
/plan [arguments]
```

## Description

Create tactical implementation plan for a feature or task

## Implementation

Create a detailed, actionable implementation plan for a specific feature, task, or piece of work.

## Process

Use the technical-planning skill from bushido to:

1. **Understand requirements**: What needs to be built?
2. **Analyze existing code**: What's already there?
3. **Identify components**: What pieces are needed?
4. **Define dependencies**: What order must things be done?
5. **Break into tasks**: Specific, implementable steps
6. **Estimate complexity**: Relative sizing (S/M/L)
7. **Document plan**: Clear, actionable document

## Planning Principles

**Good plans are:**

- **Specific**: Concrete steps, not vague ideas
- **Actionable**: Each task can be started immediately
- **Ordered**: Dependencies clear, sequence logical
- **Right-sized**: Tasks are hours/days, not weeks
- **Testable**: Success criteria for each task

**Bad plans are:**

- Vague ("Make it better")
- Missing dependencies ("Do A and B" when B depends on A)
- Too large (one task = weeks of work)
- Missing context (no reasoning for decisions)

## Plan Structure

```markdown
# Implementation Plan: [Feature Name]

## Goal
[What are we building and why?]

## Current State
[What exists today that's relevant?]

## Proposed Approach
[High-level strategy]

## Tasks

### 1. [Task name] (Complexity: S/M/L)
**What:** [Specific deliverable]
**Why:** [Reasoning]
**Dependencies:** [None or task numbers]
**Success criteria:** [How to know it's done]
**Files affected:** [Approximate list]

### 2. [Next task] (Complexity: S/M/L)
**What:** [Specific deliverable]
**Why:** [Reasoning]
**Dependencies:** Task 1
**Success criteria:** [How to know it's done]
**Files affected:** [Approximate list]

[Continue...]

## Testing Strategy
[How will we verify this works?]

## Risks & Considerations
[What could go wrong? What should we watch out for?]

## Out of Scope
[What we're explicitly NOT doing]
```

## Complexity Sizing

- **S (Small)**: 1-4 hours, straightforward
- **M (Medium)**: 4-8 hours, moderate complexity
- **L (Large)**: 1-2 days, complex or uncertain

**If > L:** Break it down further

## Examples

When the user says:

- "How should I implement user authentication?"
- "Plan out the shopping cart feature"
- "What's the approach for migrating to the new API?"
- "Break down this Jira ticket into tasks"
- "Create a plan for adding dark mode"

## Planning Checklist

Before finishing plan, verify:

- [ ] Goal is clear and specific
- [ ] Current state analyzed
- [ ] Approach is feasible
- [ ] Tasks are specific and actionable
- [ ] Dependencies are identified
- [ ] Success criteria defined for each task
- [ ] Testing strategy included
- [ ] Risks documented
- [ ] Out of scope explicitly stated

## Notes

- Use TodoWrite to track planning steps
- Reference existing code patterns
- Consider using /architect for larger system changes
- Apply simplicity-principles (don't over-engineer)
- Plans are living documents (update as you learn)
- Include reasoning for decisions (future you will thank you)
