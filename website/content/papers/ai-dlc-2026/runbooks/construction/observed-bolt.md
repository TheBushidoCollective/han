# Observed Bolt (OHOTL)

> **Construction Phase** | Human watches in real-time with ability to intervene

## System Prompt

```markdown

You are executing an Observed Bolt for AI-DLC 2026.

## Unit Specification

${UNIT_SPECIFICATION}

## Completion Criteria (Objective)

${OBJECTIVE_CRITERIA}

## Quality Notes (Subjective)

${SUBJECTIVE_QUALITY_NOTES}

## Relevant Principles

- **Synchronous awareness, asynchronous control**: Human watches but doesn't block
- **Subjective quality matters**: Some things can't be verified programmatically
- **Real-time feedback**: Human can redirect at any moment

## Operating Mode: OHOTL (Observed Human-on-the-Loop)

You work while human watches. Human can intervene anytime but doesn't have to.

```

```
🎯 Human Defines Criteria
         ↓
🤖 AI Works ←←←←←←←←←←←←←←←←←←←←←←←←←
         ↓                            ↑
👁️ Human Observes (real-time)        |
         ↓                            |
🛑 Intervention Needed? ──No──→ ✅ Criteria Met? ──No──→
         ↓ Yes                        ↓ Yes
🦸 Human Redirects ──────────────→   🧐 Human Reviews Output
```

## Process

### 1. Start Working

- Read specs and context
- Begin implementation
- Stream your progress (thinking aloud)

### 2. Pause Points (Optional Intervention)

Briefly pause at subjective decision points:

- "Going with blue tones for the error state — redirect me if that's wrong"
- "Using a modal for confirmation — say if you'd prefer inline"

Don't wait for response — continue unless redirected.

### 3. Handle Redirects

When human intervenes:

- Stop current work
- Acknowledge the feedback
- Adjust approach
- Continue working

### 4. Completion

When criteria met:

- Output READY_FOR_REVIEW
- Summarize what was built
- Note any subjective decisions made

## Intervention Triggers (Pause Briefly)

Mention these as you pass them, but don't block:

- Major layout decisions
- Color or typography choices outside design system
- Interaction patterns with multiple valid approaches
- Content phrasing where tone matters
- Anything that "feels" like a choice rather than a requirement

## Communication Style

Think aloud as you work:

> "Starting with the header component... using the standard nav pattern...
> making the logo clickable to home... adding the search bar on the right...
> going with the outlined style for the search icon since that matches the rest of the UI..."

This gives human visibility to intervene if needed.

## Quality Gates (Objective)

These must pass regardless of subjective feedback:

- All tests pass
- TypeScript compiles
- Linter clean
- Accessibility checks pass

## Subjective Checkpoints

After completing visual/UX work, briefly summarize:

> "Header complete. Used: standard nav layout, search on right, outlined icons.
> Looks good to me but happy to adjust. Continuing to footer..."

## Constraints

- Maximum scope: ${ALLOWED_PATHS}
- Keep streaming your work (don't go silent)
- Commit working increments
- If stuck for >5 minutes, explicitly ask for help

## Completion Signal

When done:

```
READY_FOR_REVIEW

Summary:
- Built [component/feature]
- Subjective decisions: [list choices made]
- Objective criteria: [all passing]

Ready for final subjective review.
```

```

---

## Entry Criteria

You have:

- **Unit specification** with completion criteria
- **Subjective quality notes** (design references, tone guides, examples)
- **Mode selection** indicating Observed (OHOTL)
- Human available to watch (but not necessarily interact)
- Real-time output streaming available

## When to Use Observed Mode

| Scenario | Why Observed |
|----------|--------------|
| UI/UX implementation | Subjective visual quality |
| Content/copy writing | Tone and brand judgment |
| Design system work | Aesthetic decisions |
| Junior engineer training | Learning opportunity |
| Exploratory refactoring | Human can redirect if off-track |
| Creative problem-solving | Multiple valid approaches |

## The Activity

### The Human Experience

Human watches AI work in real-time, like pair programming where AI drives.

```

AI: "Starting the product card component..."
AI: "Using the grid layout from the design system..."
AI: "Adding the image with 16:9 aspect ratio..."
Human: (watching, thinking "looks good")
AI: "For the price, going with green for sale items..."
Human: "Actually, use the brand orange for sales"
AI: "Got it, switching to brand orange for sale prices..."
AI: "Adding the add-to-cart button, using primary style..."
Human: (watching, satisfied)
AI: "Card complete, moving to the list view..."

```

### Key Characteristics

1. **Non-blocking**: AI doesn't wait for approval at each step
2. **Real-time visibility**: Human sees progress as it happens
3. **Interrupt-driven**: Human speaks up only when needed
4. **Educational**: Human learns patterns by watching

### Subjective vs Objective Criteria

```markdown

## Completion Criteria (Objective)

- [ ] Component renders without errors
- [ ] All props are typed
- [ ] Accessibility: WCAG 2.1 AA
- [ ] Tests pass

## Quality Notes (Subjective — human will judge)

- [ ] Visual hierarchy feels right
- [ ] Spacing matches design intent
- [ ] Interactions feel responsive
- [ ] Fits with existing UI patterns

```

## Exit Criteria

- All **objective criteria** verified programmatically
- Human has **reviewed subjective quality**
- Any redirects have been incorporated
- Code committed with descriptive messages

## Handoff Artifacts

| Artifact | Purpose |
|----------|---------|
| Committed code | Ready for integration |
| Decision log | Record of subjective choices |
| Human feedback | Incorporated redirects |

## Transition Triggers

### → Supervised Mode

- Human sees fundamental problems
- Work is going in completely wrong direction
- Need to stop and re-plan

### → Autonomous Mode

- Initial subjective decisions made
- Remaining work is mechanical
- Human satisfied with direction

## Common Failure Modes

### 1. Going Silent

**Symptom:** AI works without streaming progress.
**Impact:** Human can't intervene; loses the benefit of observation.
**Fix:** Reinforce "think aloud" requirement. Constant narration.

### 2. Waiting for Approval

**Symptom:** AI stops and waits at every decision.
**Impact:** Becomes Supervised mode; defeats the purpose.
**Fix:** Clarify that pauses are informational, not blocking.

### 3. Ignoring Redirects

**Symptom:** AI acknowledges feedback but continues original path.
**Impact:** Frustrated human, wasted work.
**Fix:** Redirects are mandatory. Stop, adjust, then continue.

### 4. Over-Narrating

**Symptom:** AI explains every keystroke.
**Impact:** Noise drowns out signal; human tunes out.
**Fix:** Narrate decisions and choices, not mechanical steps.

### 5. No Subjective Checkpoints

**Symptom:** AI completes large sections without summarizing.
**Impact:** Human intervention comes too late.
**Fix:** Summarize after each logical chunk for subjective review.
