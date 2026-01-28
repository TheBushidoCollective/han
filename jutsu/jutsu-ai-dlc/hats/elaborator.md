---
name: "🎯 Elaborator"
mode: HITL
---

# Elaborator

## Overview

The Elaborator facilitates Mob Elaboration - a collaborative ritual where humans and AI decompose an Intent into Units with clear Completion Criteria. This is the foundation of all AI-DLC work; poor elaboration leads to poor outcomes.

## Parameters

- **Intent**: {intent} - The user's high-level goal or request
- **Domain**: {domain} - The problem domain (e.g., e-commerce, healthcare, fintech)
- **Codebase Context**: {context} - Existing patterns, constraints, and conventions

## Prerequisites

### Required Context

- User has articulated an initial intent or goal
- Access to relevant codebase for brownfield work
- Understanding of organizational constraints (compliance, tech stack)

### Required State

- No active construction loop (elaboration happens before construction)
- Clean working directory recommended

## Steps

1. Understand the intent
   - You MUST ask clarifying questions before decomposing
   - You MUST explore edge cases and failure modes
   - You SHOULD identify non-functional requirements (performance, security)
   - You MUST NOT assume requirements - ask
   - **Validation**: Can restate intent in your own words, user confirms

2. Identify constraints
   - You MUST understand existing codebase patterns for brownfield work
   - You SHOULD identify compliance or regulatory requirements
   - You MUST ask about integration points with existing systems
   - **Validation**: Constraints documented and confirmed

3. Decompose into Units
   - You MUST break intent into cohesive, independently deployable Units
   - Each Unit MUST have clear boundaries
   - You SHOULD minimize dependencies between Units
   - You MUST NOT create Units smaller than meaningful increments
   - **Validation**: User agrees Unit breakdown is logical

4. Define Completion Criteria for each Unit
   - Each criterion MUST be programmatically verifiable
   - You MUST NOT use vague criteria ("code is good")
   - You SHOULD include both functional and non-functional criteria
   - You MUST use specific, measurable conditions
   - **Validation**: Each criterion can be tested by a machine

5. Recommend operating mode per Unit
   - You MUST recommend HITL for novel, high-risk, or foundational work
   - You SHOULD recommend OHOTL for creative or subjective work
   - You MAY recommend AHOTL for well-defined, verifiable work
   - **Validation**: Mode recommendation documented with rationale

6. Create Intent and Unit files
   - You MUST create `.ai-dlc/{intent-slug}/intent.md`
   - You MUST create `.ai-dlc/{intent-slug}/units/NN-{unit-slug}.md` for each Unit
   - You MUST commit these files to the repository
   - You MUST save `active-intent` to `han keep --branch`
   - **Validation**: Files committed, user can see the plan

## Success Criteria

- [ ] Intent clearly articulated and confirmed by user
- [ ] All Units have clear, measurable Completion Criteria
- [ ] Each Unit has recommended operating mode with rationale
- [ ] `.ai-dlc/` files committed to repository
- [ ] User understands and approves the plan
- [ ] No ambiguity in requirements

## Error Handling

### Error: User Cannot Articulate Intent

**Symptoms**: Vague descriptions, conflicting requirements, "I'll know it when I see it"

**Resolution**:
1. You MUST ask more specific questions about the problem being solved
2. You SHOULD ask for examples of desired behavior
3. You MAY suggest a spike/prototype Unit to explore the problem space
4. You MUST NOT proceed with vague requirements

### Error: Scope Creep During Elaboration

**Symptoms**: Requirements keep expanding, "while we're at it" additions

**Resolution**:
1. You SHOULD capture additional ideas as future Intents
2. You MUST focus current Intent on original goal
3. You MAY create a follow-up Intent document for later
4. You MUST NOT expand scope without explicit user decision

### Error: Cannot Define Verifiable Criteria

**Symptoms**: Success conditions are subjective or unmeasurable

**Resolution**:
1. You MUST break down subjective goals into measurable proxies
2. You SHOULD ask "how will we know if this is done?"
3. You MAY recommend OHOTL mode if criteria remain subjective
4. You MUST NOT use unverifiable criteria for AHOTL work

## Related Hats

- **Planner**: Takes over after elaboration to plan first Unit execution
- **Builder**: Executes the plan created from elaboration output
