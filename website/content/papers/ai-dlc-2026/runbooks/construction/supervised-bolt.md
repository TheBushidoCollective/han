# Supervised Bolt (HITL)

> **Construction Phase** | Human-in-the-Loop execution for novel, high-risk, or judgment-heavy work

## System Prompt

```markdown

You are executing a Supervised Bolt for AI-DLC 2026.

## Unit Specification

${UNIT_SPECIFICATION}

## Completion Criteria

${COMPLETION_CRITERIA}

## Relevant Principles

- **Human validates each significant step**: Propose, wait for approval, then execute
- **Explain reasoning**: Make trade-offs explicit so human can make informed decisions
- **Admit uncertainty**: Say "I don't know" rather than guessing

## Operating Mode: HITL (Human-in-the-Loop)

You propose. Human validates. You execute. Human reviews. Repeat.

```

```
🤖 AI Proposes → 🕵️ Human Validates → 🤖 AI Executes → 🕵️ Human Reviews
      ↑                                                        ↓
      ←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←←
```

## Process

### 1. Context Gathering

- Read specs in `specs/units/${UNIT_NAME}.md`
- Read existing code in relevant paths
- Check `.agent/scratchpad.md` for prior context
- **STOP**: Present your understanding for validation

### 2. Planning

- Create implementation plan
- Identify decision points requiring human input
- List trade-offs and alternatives
- Save plan to `.agent/plans/${UNIT_NAME}.md`
- **STOP**: Wait for plan approval

### 3. Incremental Implementation

For each significant component:

- Propose the approach
- **STOP**: Wait for approval
- Implement
- Run verification (tests, types, lint)
- **STOP**: Present results for review

### 4. Validation

- Run full quality gate suite
- Present results
- **STOP**: Wait for final approval

## Critical Decisions Requiring Approval

Always stop and ask before:

- Architectural patterns or significant design choices
- External dependencies or service integrations
- Security-related implementations
- Performance trade-offs
- Data model decisions
- API contract changes

## Communication Style

When proposing, explain:

1. **What** you want to do
2. **Why** this approach (vs alternatives)
3. **Trade-offs** involved
4. **Risks** you see
5. **What you need** from the human

Example:

> "I propose using Redis for session caching because:
>
> - We already have Redis in the stack (no new dependency)
> - TTL support fits our session expiry model
>
> Alternative: In-memory caching would be simpler but won't survive restarts.
>
> Trade-off: Redis adds network latency (~1ms) vs in-memory.
>
> I recommend Redis. Do you approve?"

## Quality Gates

Run after each milestone:

- `npm test` — All tests pass
- `npm run typecheck` — TypeScript strict mode
- `npm run lint` — Linter clean
- Coverage check for new code

## File-Based State

Persist progress in files:

- `.agent/scratchpad.md` — Current context, decisions made
- `.agent/plans/${UNIT_NAME}.md` — Implementation plan
- `.agent/blockers.md` — Issues requiring human help

## Constraints

- Maximum scope: Only modify files in ${ALLOWED_PATHS}
- Commit working increments with clear messages
- Never proceed past a STOP point without explicit approval

```

---

## Entry Criteria

You have:

- **Unit specification** with completion criteria
- **Mode selection** indicating Supervised (HITL)
- Human available for synchronous interaction
- Development environment ready

## When to Use Supervised Mode

| Scenario | Why Supervised |
|----------|----------------|
| Novel domain | No established patterns to follow |
| Architectural decisions | Long-term consequences, hard to reverse |
| High-risk changes | Production data, security, compliance |
| Complex trade-offs | Multiple valid approaches, judgment needed |
| Foundational work | Will shape subsequent autonomous work |
| First implementation | Establishing patterns for future Units |

## The Activity

### Phase 1: Context & Understanding

```

Human: "Implement the authentication API"
    ↓
AI: [Reads specs, existing code, patterns]
    ↓
AI: "Here's my understanding of the task:
     - JWT-based auth with refresh tokens
     - Integration with existing user service
     - Rate limiting per IP

     Is this correct? Any constraints I'm missing?"
    ↓
Human: [Validates or corrects]

```

### Phase 2: Planning

```

AI: [Creates detailed implementation plan]
    ↓
AI: "Proposed plan:
     1. Define API routes and middleware structure
     2. Implement login endpoint with JWT generation
     3. Implement token refresh flow
     4. Add rate limiting middleware
     5. Write integration tests

     Decision points needing your input:
     - JWT expiry: 15min access, 7d refresh?
     - Rate limit: 100 req/min per IP?

     Does this plan look right?"
    ↓
Human: [Approves, modifies, or rejects]

```

### Phase 3: Incremental Implementation

```

AI: "Starting with login endpoint. I'll:
     - Create POST /auth/login route
     - Validate credentials against user service
     - Generate JWT pair on success

     Proceeding?"
    ↓
Human: "Yes"
    ↓
AI: [Implements]
    ↓
AI: "Done. Tests passing. Here's what I built:
     [Summary of changes]

     Ready to review, or should I continue to refresh endpoint?"
    ↓
Human: [Reviews, provides feedback]

```

### Phase 4: Completion

```

AI: "All completion criteria met:
     ✅ Login endpoint works
     ✅ Refresh flow works
     ✅ Rate limiting active
     ✅ Tests passing (92% coverage)
     ✅ TypeScript clean
     ✅ Security scan clean

     Ready for final review."
    ↓
Human: [Final approval or requests changes]

```

## Exit Criteria

- All **completion criteria** satisfied
- Human has **approved final output**
- Code committed with descriptive messages
- Documentation updated if behavior changed
- `.agent/scratchpad.md` updated with decisions made

## Handoff Artifacts

| Artifact | Purpose |
|----------|---------|
| Committed code | Ready for integration/deployment |
| Updated scratchpad | Context for future sessions |
| Decision log | Record of trade-offs made |

## Transition Triggers

### → Observed Mode

- Initial architectural decisions made
- Remaining work is iterative refinement
- Human wants to watch but not block

### → Autonomous Mode

- Patterns established, remaining work is mechanical
- Clear criteria for remaining tasks
- Human comfortable with unsupervised execution

## Common Failure Modes

### 1. AI Proceeds Without Approval

**Symptom:** AI implements significant changes without stopping.
**Impact:** Rework, misalignment, trust breakdown.
**Fix:** Reinforce STOP points in prompt. AI should err on side of asking.

### 2. Approval Fatigue

**Symptom:** Human rubber-stamps everything.
**Impact:** Defeats purpose of supervision; errors slip through.
**Fix:** Increase granularity of work between stops. Consider transitioning to Observed.

### 3. Scope Creep

**Symptom:** AI proposes improvements beyond the Unit spec.
**Impact:** Delayed delivery, unfocused work.
**Fix:** Stick to completion criteria. Log improvements for future Units.

### 4. Decision Paralysis

**Symptom:** Too many options presented; human can't choose.
**Impact:** Slow progress, frustrated human.
**Fix:** AI should recommend one option with rationale, present alternatives briefly.
