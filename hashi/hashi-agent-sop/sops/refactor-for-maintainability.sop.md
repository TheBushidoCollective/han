# Refactor Code for Maintainability

## Overview

This SOP guides systematic code refactoring to improve structure, readability, and maintainability without changing external behavior. Use this when code quality has degraded, complexity is high, or technical debt needs addressing. Structured refactoring reduces risk while improving code quality.

## Parameters

- **Target Code**: {target_code} - Path to file, module, or component to refactor
- **Refactoring Goal**: {goal} - Specific improvement target (reduce complexity, eliminate duplication, improve naming, extract components)
- **Scope**: {scope} - Refactoring scope (single function, module, package, all)
- **Risk Tolerance**: {risk_tolerance} - How aggressive to be (conservative, moderate, aggressive)

## Prerequisites

### Required Tools

- Comprehensive test suite for {target_code}
- Code coverage tool
- Linter and static analysis tools
- Version control system (Git)
- IDE with refactoring support (recommended)

### Required Knowledge

- Understanding of the codebase and {target_code} functionality
- Familiarity with refactoring patterns
- Knowledge of SOLID principles and design patterns
- Understanding of the test suite

### Required Setup

- All tests passing before refactoring starts
- Test coverage measured and adequate (≥70%)
- Clean working directory (all changes committed)
- Feature branch created for refactoring work

## Steps

1. Verify test coverage and baseline
   - You MUST verify all existing tests pass
   - You MUST check test coverage for {target_code} is adequate
   - You SHOULD aim for ≥80% coverage before refactoring
   - Run static analysis to establish baseline metrics
   - Document current complexity metrics (cyclomatic complexity, LOC, etc.)
   - You MUST NOT proceed if tests are failing
   - **Validation**: All tests pass, coverage measured and documented

2. Identify specific refactoring targets
   - Analyze {target_code} for code smells
   - You MUST prioritize refactoring based on {goal}
   - Look for long methods/functions (>30 lines)
   - Identify duplicated code blocks
   - Find high complexity functions (cyclomatic complexity >10)
   - You SHOULD note unclear variable/function names
   - Identify tight coupling and low cohesion
   - **Validation**: Refactoring targets documented with specific issues

3. Plan refactoring sequence
   - You MUST break refactoring into small, incremental steps
   - Order steps from safest to riskiest
   - You SHOULD start with simple renames before structural changes
   - Plan to commit after each successful step
   - Consider {risk_tolerance} when planning scope
   - Identify any prerequisite refactorings
   - **Validation**: Step-by-step refactoring plan created

4. Execute refactoring incrementally
   - You MUST refactor one small thing at a time
   - Use IDE automated refactoring tools when available
   - You MUST run tests after EACH change
   - You MUST revert if tests fail
   - You SHOULD NOT change behavior (tests should not need updates)
   - You SHOULD commit after each successful refactoring step
   - Apply specific refactoring patterns:
     - Extract Method/Function for long procedures
     - Rename for clarity
     - Extract Variable for complex expressions
     - Inline for unnecessary indirection
     - Replace Magic Numbers with named constants
     - Extract Class/Module for cohesion
   - **Validation**: Tests pass after each incremental change

5. Eliminate code duplication
   - You MUST identify duplicated code blocks (>3 lines)
   - You SHOULD extract common code into functions/methods
   - Apply DRY (Don't Repeat Yourself) principle
   - You MUST ensure extracted code has single responsibility
   - You SHOULD NOT over-abstract (wait for third duplication)
   - Verify extracted code is tested
   - **Validation**: Code duplication eliminated, tests still pass

6. Improve naming and clarity
   - You SHOULD use intention-revealing names
   - Replace abbreviations with full words (except common ones)
   - Use domain-specific terminology consistently
   - You SHOULD make names searchable (avoid single letters except loops)
   - Ensure function names describe what they do
   - Variable names should describe what they contain
   - **Validation**: Code is more self-documenting

7. Reduce complexity
   - You MUST simplify functions with cyclomatic complexity >10
   - Extract complex conditionals into well-named functions
   - You SHOULD replace nested conditionals with guard clauses
   - Consider replacing conditional logic with polymorphism
   - Break long methods into smaller, focused functions
   - Apply Single Responsibility Principle
   - **Validation**: Complexity metrics improved, tests pass

8. Verify refactoring results
   - You MUST run full test suite
   - You MUST verify all tests still pass
   - Run code coverage and confirm it maintained or improved
   - Run static analysis and verify metrics improved
   - You SHOULD perform manual testing of affected functionality
   - Compare before/after complexity metrics
   - **Validation**: All tests pass, metrics improved, no behavior changes

9. Update documentation
   - You SHOULD update inline comments if needed
   - You SHOULD update API documentation for renamed public interfaces
   - Document significant architectural improvements
   - You MAY update README if refactoring affects usage
   - **Validation**: Documentation reflects code structure

10. Code review and merge
    - You SHOULD request code review focusing on refactoring
    - Explain refactoring goals and approach
    - You MUST verify CI/CD pipeline passes
    - Merge refactoring commits to main branch
    - **Validation**: Refactoring reviewed and merged

## Success Criteria

- [ ] All tests pass without modifications
- [ ] Code coverage maintained or improved
- [ ] Complexity metrics improved (cyclomatic complexity reduced)
- [ ] Code duplication eliminated or significantly reduced
- [ ] Variable and function names are clear and intention-revealing
- [ ] {goal} is achieved
- [ ] No behavioral changes introduced
- [ ] Static analysis shows improvement
- [ ] Code is more readable and maintainable
- [ ] Refactoring commits are incremental and clear

## Error Handling

### Error: Tests Fail After Refactoring

**Symptoms**: Tests that passed before refactoring now fail

**Cause**: Refactoring changed behavior or introduced bugs

**Resolution**:

1. You MUST revert the last refactoring step immediately
2. Review what changed and why tests fail
3. Make smaller incremental changes
4. Run tests more frequently
5. You MUST NOT continue with failing tests

### Error: Test Coverage Decreased

**Symptoms**: Coverage report shows lower coverage after refactoring

**Cause**: Extracted code is not covered by tests, or tests were accidentally removed

**Resolution**:

1. You MUST identify which code paths lost coverage
2. Add tests for newly extracted functions/methods
3. Verify no test files were accidentally deleted
4. You MUST restore coverage to original level or higher
5. Consider if refactoring exposed untested code paths

### Error: Performance Degradation

**Symptoms**: Refactored code is slower than original

**Cause**: Excessive function calls, inefficient extraction, or removed optimizations

**Resolution**:

1. You SHOULD profile to identify specific bottleneck
2. Consider inlining critical paths if necessary
3. Balance maintainability with performance needs
4. You MAY keep optimization for hot paths
5. Document performance trade-offs if optimization needed

### Error: Unclear What to Refactor

**Symptoms**: Code quality is poor but no clear refactoring target

**Cause**: Multiple interrelated issues, high coupling, or unclear architecture

**Resolution**:

1. You SHOULD run static analysis tools for objective metrics
2. Start with simplest issues first (naming, magic numbers)
3. Address one code smell at a time
4. You MAY need architectural refactoring (larger scope)
5. Consider breaking into multiple refactoring sessions

### Error: Refactoring Scope Too Large

**Symptoms**: Refactoring taking too long, many changes in flight, high risk

**Cause**: Attempting too much at once, poor planning, or underestimated complexity

**Resolution**:

1. You MUST commit current working state
2. Break remaining work into smaller phases
3. Consider {risk_tolerance} and reduce scope
4. You SHOULD merge completed refactoring before continuing
5. Reassess {goal} and adjust if needed

## Related SOPs

- **implement-feature-tdd**: Use to add tests before refactoring if coverage is low
- **code-review-quality**: Use to review refactored code for quality
- **debug-production-issue**: Reference if refactoring is motivated by production issues
- **api-design-review**: Use if refactoring involves public API changes
