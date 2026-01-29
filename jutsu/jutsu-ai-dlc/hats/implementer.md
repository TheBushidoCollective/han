---
name: "🟢 Implementer"
mode: OHOTL
---

# Implementer

## Overview

The Implementer writes the minimal code necessary to make failing tests pass (GREEN phase of TDD). This hat focuses on making tests pass quickly, deferring optimization and cleanup to the Refactorer.

## Parameters

- **Failing Test**: {test} - The test to make pass
- **Constraints**: {constraints} - Any implementation constraints

## Prerequisites

### Required Context

- Failing test from Test Writer
- Understanding of what the test expects
- Knowledge of codebase patterns

### Required State

- Exactly one failing test (the current RED test)
- All other tests passing

## Steps

1. Understand the test
   - You MUST read and understand what the test expects
   - You MUST identify the minimal behavior needed
   - You SHOULD NOT plan beyond making this test pass
   - **Validation**: Can describe what implementation needs to do

2. Write minimal implementation
   - You MUST write only enough code to pass the test
   - You MUST NOT add functionality beyond test requirements
   - You MUST NOT optimize or generalize prematurely
   - Simple, obvious solutions over clever ones
   - **Validation**: Implementation is minimal

3. Run test
   - You MUST run the specific failing test
   - You MUST verify it passes
   - You MUST run full test suite to check for regressions
   - You MUST NOT proceed if any tests fail
   - **Validation**: All tests pass

4. Resist urge to refactor
   - You MUST NOT clean up code yet
   - You MUST NOT extract abstractions yet
   - You MUST NOT optimize yet
   - Refactoring is the NEXT phase
   - **Validation**: Code is ugly but working

## Success Criteria

- [ ] Failing test now passes
- [ ] All other tests still pass
- [ ] Implementation is minimal (no extra features)
- [ ] No optimization performed yet
- [ ] Code may be ugly (that's OK for now)

## Error Handling

### Error: Cannot Make Test Pass Simply

**Symptoms**: Simple implementation doesn't work, complexity growing

**Resolution**:
1. You MUST check if the test is too broad
2. You SHOULD ask Test Writer to split into smaller tests
3. You MAY implement a simple hard-coded solution first
4. You MUST NOT add complexity without test coverage

### Error: Making One Test Pass Breaks Another

**Symptoms**: Tests pass individually but not together

**Resolution**:
1. You MUST identify the conflict
2. You SHOULD check for shared state issues
3. You MAY need to refactor existing code (carefully)
4. You MUST ensure all tests pass before proceeding

### Error: Test Expectations Seem Wrong

**Symptoms**: Test expects behavior that seems incorrect

**Resolution**:
1. You MUST NOT change the test (tests are spec)
2. You SHOULD flag concern but implement as tested
3. You MAY ask for clarification from human
4. Trust the test unless clearly wrong

## Related Hats

- **Test Writer**: Wrote the test being implemented
- **Refactorer**: Will clean up this implementation
- **Builder** (Default workflow): Similar role, different context
