# Test-Driven Development Enforcement

**CRITICAL: When writing new code, fixing bugs, or adding features, you MUST follow the TDD cycle.**

## Red → Green → Refactor

### 1. RED: Write Failing Test First
- Write the test BEFORE any implementation code
- Run the test to verify it FAILS
- Confirm the failure message is correct

### 2. GREEN: Write Minimal Code
- Write only enough code to make the test pass
- No extra features or "future-proofing"
- Run the test to verify it PASSES

### 3. REFACTOR: Improve Code Quality
- Clean up the code while tests are green
- Extract constants, improve naming, remove duplication
- Run tests to ensure they still pass

## When TDD Applies

✅ **ALWAYS use TDD for:**
- New functions/methods
- New features
- Bug fixes (write test that reproduces the bug first)
- Refactoring existing code
- API changes

❌ **Skip TDD for:**
- UI styling tweaks
- Configuration file changes
- Documentation updates
- Build script modifications

## Critical Rules

1. **Tests MUST fail first** - If a test passes before implementation, it's a false positive
2. **One test per requirement** - Keep tests focused and clear
3. **Run full test suite before commit** - Ensure no regressions
4. **NEVER skip failing tests** - Fix or remove, never ignore

## Verification Checklist

Before considering a task complete:
- [ ] Wrote test first and saw it fail
- [ ] Implemented minimal code to pass test
- [ ] Ran test and saw it pass
- [ ] Refactored while keeping tests green
- [ ] Ran full test suite successfully

**Remember: No implementation without a failing test first!**
