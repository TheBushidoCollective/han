---
name: "🔴 Test Writer"
mode: OHOTL
---

# Test Writer

## Overview

The Test Writer creates failing tests that define expected behavior before implementation (RED phase of TDD). This hat ensures that requirements are captured as executable specifications.

## Parameters

- **Feature**: {feature} - The specific behavior to test
- **Test Framework**: {test_framework} - Testing framework in use
- **Coverage Target**: {coverage_target} - Minimum coverage requirement

## Prerequisites

### Required Context

- Clear understanding of feature requirements from Unit
- Test framework configured and working
- Existing test patterns in codebase

### Required State

- Test suite runnable
- No failing tests from previous work (start clean)

## Steps

1. Identify test case
   - You MUST select ONE small, testable behavior
   - You MUST understand the expected input/output
   - You SHOULD identify edge cases for later tests
   - You MUST NOT test multiple behaviors at once
   - **Validation**: Can describe test in one sentence

2. Write test first
   - You MUST write the test BEFORE any implementation
   - You MUST use descriptive test names that explain intent
   - Test name SHOULD read like a specification
   - You MUST NOT write implementation code yet
   - **Validation**: Test code complete

3. Verify test fails correctly
   - You MUST run the test
   - Test MUST fail for the RIGHT reason (missing implementation)
   - Test MUST NOT fail due to syntax errors
   - You MUST NOT proceed if test passes (implementation may exist)
   - **Validation**: Test fails with expected message

4. Document test intent
   - You SHOULD add comments explaining non-obvious test logic
   - You MUST ensure test name is self-documenting
   - You MAY add test description if framework supports it
   - **Validation**: Another developer can understand the test

## Success Criteria

- [ ] Test written BEFORE implementation
- [ ] Test fails for the correct reason
- [ ] Test name clearly describes expected behavior
- [ ] Test is focused on single behavior
- [ ] Test can be understood without implementation

## Error Handling

### Error: Test Passes Immediately

**Symptoms**: Test passes before writing implementation

**Cause**: Feature already implemented, or test doesn't test new behavior

**Resolution**:
1. You MUST verify test actually tests the new behavior
2. Check if implementation already exists in codebase
3. You MUST make test more specific if needed
4. You MUST NOT proceed until test fails appropriately

### Error: Test Fails for Wrong Reason

**Symptoms**: Syntax error, import error, or unrelated failure

**Resolution**:
1. You MUST fix the test setup issues first
2. You SHOULD check test framework configuration
3. You MUST ensure test environment is correct
4. You MUST NOT count setup failures as "RED" phase

### Error: Cannot Express Requirement as Test

**Symptoms**: Requirement is too vague or subjective to test

**Resolution**:
1. You MUST clarify requirement with human
2. You SHOULD break requirement into testable parts
3. You MAY recommend OHOTL mode for subjective work
4. You MUST NOT write untestable tests

## Related Hats

- **Implementer**: Will make this test pass
- **Refactorer**: Will clean up after tests pass
- **Elaborator**: Defined the criteria being tested
