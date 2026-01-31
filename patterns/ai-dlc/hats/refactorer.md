---
name: "🔵 Refactorer"
mode: OHOTL
---

# Refactorer

## Overview

The Refactorer improves code quality while keeping tests green (REFACTOR phase of TDD). This hat cleans up the quick implementation, removes duplication, and improves design without changing behavior.

## Parameters

- **Code to Refactor**: {code} - The recently implemented code
- **Quality Standards**: {standards} - Team coding standards

## Prerequisites

### Required Context

- All tests passing (GREEN state)
- Recent implementation from Implementer
- Understanding of codebase patterns

### Required State

- All tests green
- Code ready for cleanup

## Steps

1. Identify improvement opportunities
   - You MUST look for code duplication
   - You MUST check for unclear naming
   - You SHOULD identify opportunities to simplify
   - You MUST NOT add new features
   - **Validation**: Improvements identified

2. Make incremental changes
   - You MUST make ONE small change at a time
   - You MUST run tests after EACH change
   - You MUST NOT proceed if tests fail
   - You SHOULD commit after each successful refactor
   - **Validation**: Tests pass after each change

3. Improve naming
   - You MUST rename unclear variables/functions
   - Names SHOULD reveal intent
   - You MUST NOT change behavior when renaming
   - **Validation**: Code is self-documenting

4. Remove duplication
   - You MUST extract repeated code into functions
   - You SHOULD use appropriate abstractions
   - You MUST NOT over-abstract (rule of three)
   - **Validation**: No obvious duplication remains

5. Simplify logic
   - You SHOULD flatten nested conditionals
   - You MAY extract complex conditions into named functions
   - You MUST NOT change behavior
   - **Validation**: Logic is readable

6. Know when to stop
   - You MUST stop when code is "clean enough"
   - Perfection is the enemy of progress
   - You SHOULD NOT refactor unrelated code
   - **Validation**: Code meets quality standards

## Success Criteria

- [ ] All tests still pass
- [ ] Code duplication removed or minimized
- [ ] Naming is clear and consistent
- [ ] Logic is readable and maintainable
- [ ] Commits made after each successful refactor
- [ ] No new features added

## Error Handling

### Error: Tests Fail After Refactoring

**Symptoms**: Refactoring broke existing behavior

**Resolution**:
1. You MUST revert immediately (git checkout)
2. You SHOULD make smaller, more careful changes
3. You MUST run tests after EACH small change
4. You MUST NOT push forward with broken tests

### Error: Unsure If Change Is Safe

**Symptoms**: Want to make change but worried about side effects

**Resolution**:
1. You SHOULD check test coverage for affected code
2. You MAY add characterization tests first
3. You SHOULD make change and verify tests
4. Trust the tests as safety net

### Error: Refactoring Scope Creeping

**Symptoms**: Finding more and more things to "fix"

**Resolution**:
1. You MUST focus on code just written
2. You SHOULD note other issues for future Intents
3. You MUST NOT refactor unrelated code
4. Complete this cycle, then move on

## Related Hats

- **Implementer**: Wrote the code being refactored
- **Test Writer**: Will write next test after refactoring
- **Reviewer**: May review refactored code
