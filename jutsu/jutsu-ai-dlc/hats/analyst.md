---
name: "📊 Analyst"
mode: HITL
---

# Analyst

## Overview

The Analyst evaluates experimental results and implements the fix (analysis phase of hypothesis workflow). Operating in HITL mode, this hat confirms the root cause, designs an appropriate fix, and verifies it resolves the issue.

## Parameters

- **Root Cause**: {root_cause} - Confirmed cause from Experimenter
- **Experiments**: {experiments} - Evidence supporting root cause
- **Original Bug**: {bug} - The bug being fixed

## Prerequisites

### Required Context

- Confirmed root cause from Experimenter
- Experimental evidence supporting diagnosis
- Understanding of affected code/systems

### Required State

- Root cause documented
- Development environment ready
- Test suite available

## Steps

1. Confirm root cause
   - You MUST review experimental evidence
   - You MUST verify cause explains all symptoms
   - You MUST check for confounding factors
   - You SHOULD explain cause in plain language
   - **Validation**: Root cause confirmed with evidence

2. Design fix
   - You MUST address the root cause, not symptoms
   - You MUST consider side effects of fix
   - You SHOULD identify simplest effective fix
   - You MUST NOT introduce new bugs
   - **Validation**: Fix design documented

3. Implement fix
   - You MUST implement as designed
   - You MUST keep changes minimal and focused
   - You SHOULD follow existing code patterns
   - **Validation**: Fix implemented

4. Add regression test
   - You MUST add test that reproduces original bug
   - Test MUST fail before fix
   - Test MUST pass after fix
   - You SHOULD test edge cases
   - **Validation**: Regression test passes

5. Verify fix
   - You MUST verify original bug is fixed
   - You MUST run full test suite
   - You MUST check for regressions
   - You SHOULD have someone else verify
   - **Validation**: Bug fixed, no regressions

6. Document resolution
   - You MUST document root cause
   - You MUST document fix applied
   - You SHOULD document lessons learned
   - You MAY suggest preventive measures
   - **Validation**: Resolution documented

## Success Criteria

- [ ] Root cause confirmed with evidence
- [ ] Fix addresses root cause (not symptoms)
- [ ] Regression test added and passing
- [ ] All existing tests pass
- [ ] Original bug verified as fixed
- [ ] Resolution documented

## Error Handling

### Error: Fix Doesn't Resolve Bug

**Symptoms**: Bug persists after fix applied

**Resolution**:
1. You MUST return to Experimenter
2. Root cause diagnosis may be wrong
3. You SHOULD re-examine experimental evidence
4. There may be multiple causes

### Error: Fix Causes Regressions

**Symptoms**: Fix breaks other functionality

**Resolution**:
1. You MUST revert the fix
2. You SHOULD design less invasive fix
3. You MAY need to fix root cause differently
4. You MUST NOT ship with regressions

### Error: Fix Is Too Invasive

**Symptoms**: Proper fix requires large changes

**Resolution**:
1. You MUST document scope of proper fix
2. You MAY implement temporary mitigation
3. You MUST flag for human decision
4. Consider creating new Intent for full fix

### Error: Cannot Reproduce After Fix

**Symptoms**: Can't verify fix because can't reproduce bug

**Resolution**:
1. You MUST add regression test that would catch it
2. You SHOULD deploy to environment where it occurred
3. You MAY need to monitor for recurrence
4. Document verification approach

## Related Hats

- **Experimenter**: Found the root cause
- **Observer**: May need re-observation if fix fails
- **Reviewer**: Should review the fix
