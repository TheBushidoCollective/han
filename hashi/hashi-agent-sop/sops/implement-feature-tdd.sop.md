# Implement Feature Using Test-Driven Development

## Overview

This SOP guides feature implementation using the Test-Driven Development (TDD) red-green-refactor cycle. Use this when adding new functionality that requires high confidence in correctness and maintainability. TDD ensures comprehensive test coverage, better design, and reduced regression risk.

## Parameters

- **Feature Description**: {feature_description} - Clear description of feature requirements
- **Test Framework**: {test_framework} - Testing framework to use (Jest, Vitest, pytest, RSpec, etc.)
- **Coverage Target**: {coverage_target} - Minimum test coverage percentage (default: 80)
- **Integration Level**: {integration_level} - Type of tests needed (unit, integration, e2e, all)

## Prerequisites

### Required Tools

- Test framework appropriate for the language ({test_framework})
- Code coverage tool (coverage.py, Istanbul, SimpleCov, etc.)
- Linter and formatter for the language
- Version control system (Git)

### Required Knowledge

- Understanding of test-driven development principles
- Familiarity with the test framework syntax
- Knowledge of the codebase architecture
- Understanding of the feature requirements

### Required Setup

- Development environment configured
- Test framework installed and configured
- Test runner functional
- Code coverage reporting enabled

## Steps

1. Understand and decompose requirements
   - You MUST fully understand {feature_description} before starting
   - Break feature into small, testable increments
   - Identify edge cases and error conditions
   - Define acceptance criteria for each increment
   - **Validation**: Can describe feature in specific test cases

2. Write failing test (RED phase)
   - You MUST write the test BEFORE implementation code
   - Test MUST describe the desired behavior clearly
   - Use descriptive test names that explain intent
   - You MUST run test to verify it fails with expected message
   - You SHOULD test one behavior at a time
   - You MUST NOT write implementation code yet
   - **Validation**: Test fails for the right reason (not due to syntax errors)

3. Implement minimal code (GREEN phase)
   - You MUST write only enough code to make the test pass
   - You MUST NOT add functionality beyond test requirements
   - You SHOULD NOT optimize prematurely
   - Favor simple, obvious solutions over clever ones
   - You MUST run test to verify it passes
   - You MAY add code comments for non-obvious logic
   - **Validation**: All tests pass, including the new test

4. Refactor (REFACTOR phase)
   - You MUST keep all tests passing during refactoring
   - You MUST run tests after each refactoring step
   - You SHOULD extract duplicated code into functions/methods
   - You SHOULD improve naming for clarity
   - You SHOULD simplify conditional logic where possible
   - You SHOULD NOT change test behavior (tests are specification)
   - You MAY optimize if performance issues are evident
   - **Validation**: All tests still pass after refactoring

5. Repeat cycle for next increment
   - You MUST complete full red-green-refactor cycle before next feature
   - You SHOULD commit after each complete cycle
   - Verify coverage meets or exceeds {coverage_target}
   - You MAY combine very small related test cases
   - Continue until feature is complete
   - **Validation**: Each increment has corresponding tests

6. Integration and verification
   - You MUST verify feature works in integration environment
   - You SHOULD add integration tests if {integration_level} requires it
   - You SHOULD verify feature meets original {feature_description}
   - Run full test suite to ensure no regressions
   - Check code coverage report meets {coverage_target}
   - **Validation**: Feature complete, all tests pass, coverage adequate

## Success Criteria

- [ ] All requirements from {feature_description} are implemented
- [ ] All tests pass without warnings or errors
- [ ] Test coverage is at least {coverage_target}%
- [ ] Code passes linter with zero errors
- [ ] No code duplication exists
- [ ] Feature works correctly in integration environment
- [ ] Documentation updated for public APIs
- [ ] Commits follow red-green-refactor pattern

## Error Handling

### Error: Test Passes Before Implementation

**Symptoms**: Test passes on first run without implementation code

**Cause**: Test doesn't actually test the new behavior, or implementation already exists

**Resolution**:

1. You MUST verify test is actually testing new behavior
2. Check if feature already exists in codebase
3. Rewrite test to be more specific about expected behavior
4. Ensure test assertions actually validate the requirement
5. You MUST NOT proceed until test fails appropriately

### Error: Cannot Make Test Pass With Simple Code

**Symptoms**: Simple implementation doesn't work, complexity growing rapidly

**Cause**: Test is too broad, testing multiple behaviors, or requirements unclear

**Resolution**:

1. You SHOULD break test into smaller, more focused tests
2. Verify each test checks only one behavior
3. Start with simpler case before handling complex scenarios
4. Review {feature_description} for clarity
5. Consider if design needs refactoring before adding feature

### Error: Tests Fail After Refactoring

**Symptoms**: Tests that passed now fail after code changes

**Cause**: Refactoring changed behavior or introduced bugs

**Resolution**:

1. You MUST revert the refactoring immediately
2. Make smaller, incremental refactoring steps
3. Run tests after EACH small change
4. Use IDE refactoring tools when available (safer)
5. You MUST NOT continue with broken tests

### Error: Low Test Coverage

**Symptoms**: Coverage report shows coverage below {coverage_target}

**Cause**: Missing tests for edge cases, error paths, or branches

**Resolution**:

1. Review coverage report to identify untested code paths
2. Write tests for uncovered branches and error cases
3. You MUST add tests for all edge cases
4. You SHOULD test both success and failure paths
5. Consider if uncovered code is actually needed

### Error: Tests Become Brittle or Fragile

**Symptoms**: Tests break frequently with minor code changes

**Cause**: Tests coupled to implementation details instead of behavior

**Resolution**:

1. You SHOULD test behavior, not implementation
2. Avoid testing private methods directly
3. Use test doubles (mocks/stubs) sparingly
4. Focus on testing public interface
5. Refactor tests to be more resilient

## Related SOPs

- **code-review-quality**: Use after implementation for peer review
- **refactor-for-maintainability**: Use if code needs restructuring before adding feature
- **debug-production-issue**: Reference for fixing bugs with TDD approach
- **api-design-review**: Use before TDD if feature involves public API changes
