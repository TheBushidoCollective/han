# Mode Selection

> **Construction Phase** | Choosing the right operating mode for each Unit

## System Prompt

```markdown

You are helping select the appropriate Bolt mode for AI-DLC 2026 Construction.

## Unit to Evaluate

${UNIT_SPECIFICATION}

## Completion Criteria

${COMPLETION_CRITERIA}

## Relevant Principles

- **Three operating modes exist**: HITL (Supervised), OHOTL (Observed), AHOTL (Autonomous)
- **Mode selection is reversible**: You can switch modes mid-work if needed
- **Default to more supervision when uncertain**: It's easier to loosen than tighten

## Decision Framework

Evaluate each factor:

### 1. Criteria Clarity

- Clear, measurable criteria → Points to Autonomous
- Vague or subjective criteria → Points to Supervised or Observed

### 2. Verification Method

- Programmatic (tests, types, benchmarks) → Points to Autonomous
- Subjective judgment (UX, design, tone) → Points to Observed
- Complex trade-offs → Points to Supervised

### 3. Risk Level

- High risk, hard to reverse → Points to Supervised
- Medium risk, recoverable → Points to Observed
- Low risk, easily fixed → Points to Autonomous

### 4. Domain Familiarity

- Novel domain, first implementation → Points to Supervised
- Some precedent exists → Points to Observed
- Well-established patterns → Points to Autonomous

### 5. Quality Nature

- Objective correctness (works/doesn't work) → Points to Autonomous
- Subjective quality (looks good, feels right) → Points to Observed
- Architectural judgment (trade-offs) → Points to Supervised

## Output

Provide:

1. Recommended mode with confidence level
2. Rationale addressing each factor
3. Transition triggers (when to switch modes)
4. Specific concerns or risks for this Unit

```

---

## Entry Criteria

You have:

- **Unit specification** from Mob Elaboration
- **Completion Criteria** that are (ideally) programmatically verifiable
- Understanding of the domain and existing codebase

## The Decision Tree

```

New Unit arrives
       ↓
Does it have clear completion criteria?
       ↓
   NO → SUPERVISED (HITL)
       ↓
   YES → Can success be verified programmatically?
              ↓
          NO → Does it require subjective judgment?
                    ↓
                YES → OBSERVED (OHOTL)
                NO  → SUPERVISED (HITL)
              ↓
          YES → Is this high-risk?
                    ↓
                YES → SUPERVISED (HITL)
                NO  → Is this a novel domain?
                           ↓
                       YES → SUPERVISED (HITL)
                       NO  → Does subjective quality matter?
                                  ↓
                              YES → OBSERVED (OHOTL)
                              NO  → AUTONOMOUS (AHOTL)

```

## Mode Comparison

| Aspect | Supervised (HITL) | Observed (OHOTL) | Autonomous (AHOTL) |
|--------|-------------------|------------------|---------------------|
| **Human Attention** | Continuous, blocking | Continuous, non-blocking | Periodic, on-demand |
| **Approval Model** | Before each step | Any time (interrupt) | At completion |
| **AI Autonomy** | Minimal | Moderate | Full within boundaries |
| **Feedback Loop** | Synchronous | Real-time, optional | Asynchronous |
| **Best For** | Novel, high-risk, trade-offs | Creative, subjective, training | Mechanical, verifiable |

## Quick Reference

| Scenario | Mode | Rationale |
|----------|------|-----------|
| Implement new algorithm | Supervised | Novel, requires judgment on approach |
| Add CRUD endpoints | Autonomous | Well-understood pattern, clear criteria |
| Database schema migration | Supervised | High risk, data integrity |
| Expand test coverage | Autonomous | Clear criteria (coverage %), low risk |
| Design API contract | Supervised | Trade-off decisions, consumer impact |
| Refactor to new patterns | Autonomous | Clear target state, verifiable result |
| Production incident response | Supervised | High risk, context-dependent |
| UI component implementation | Observed | Subjective design quality |
| Content/copy writing | Observed | Tone and brand judgment |
| Junior engineer training | Observed | Learning opportunity |
| Design system work | Observed | Aesthetic decisions |
| Batch data migration | Autonomous | Mechanical, verifiable |
| Dependency updates | Autonomous | Tests verify compatibility |

## Transition Triggers

Work can transition between modes. Define these upfront:

### Autonomous → Supervised

- AI hits unexpected complexity
- AI documents blocker after N attempts
- Fundamental assumption proves wrong

### Autonomous → Observed

- Output needs subjective review
- Human wants to watch progress

### Observed → Supervised

- Human sees fundamental issues
- Work is going in wrong direction

### Observed → Autonomous

- Human satisfied with direction
- Remaining work is mechanical

### Supervised → Observed

- Initial decisions made
- Remaining work benefits from real-time feedback

### Supervised → Autonomous

- Architecture established
- Remaining work is mechanical implementation

## Exit Criteria

You have:

- **Selected mode** for the Unit
- **Documented rationale** for the selection
- **Defined transition triggers** for mode switches
- **Identified risks** specific to this mode/Unit combination

## Handoff

| To Mode | Handoff Artifact |
|---------|------------------|
| Supervised Bolt | Unit spec + criteria + "start supervised" |
| Observed Bolt | Unit spec + criteria + subjective quality notes |
| Autonomous Bolt | Unit spec + criteria + iteration limits |

## Common Failure Modes

### 1. Defaulting to Autonomous

**Symptom:** Everything runs autonomous; frequent blockers and rescues.
**Impact:** Human intervention overhead, frustrated teams.
**Fix:** Be honest about novelty and risk. When uncertain, start supervised.

### 2. Over-Supervising

**Symptom:** Supervised mode for well-understood tasks.
**Impact:** Slow delivery, human bottleneck.
**Fix:** Trust programmatic verification for established patterns.

### 3. Ignoring Subjective Quality

**Symptom:** Autonomous mode for UX/design work.
**Impact:** Output technically correct but wrong feel/tone.
**Fix:** Use Observed mode when human taste matters.

### 4. No Transition Plan

**Symptom:** Stuck in wrong mode, no defined exit.
**Impact:** Wasted effort, frustrated teams.
**Fix:** Always define transition triggers upfront.

## Related Runbooks

- [Supervised Bolt](/papers/ai-dlc-2026/runbooks/supervised-bolt) — HITL execution patterns
- [Observed Bolt](/papers/ai-dlc-2026/runbooks/observed-bolt) — OHOTL execution patterns
- [Autonomous Bolt](/papers/ai-dlc-2026/runbooks/autonomous-bolt) — AHOTL execution patterns
- [Writing Completion Criteria](/papers/ai-dlc-2026/runbooks/writing-completion-criteria) — Criteria clarity for mode selection
- [Building Trust](/papers/ai-dlc-2026/runbooks/building-trust) — Trust calibration for mode transitions
- [AI Limitations](/papers/ai-dlc-2026/runbooks/ai-limitations) — Working within AI capability boundaries
