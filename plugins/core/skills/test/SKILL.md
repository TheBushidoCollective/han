---
name: test
description: Write tests for code using test-driven development principles
disable-model-invocation: false
---

# test

## Name

han-core:test - Write tests for code using test-driven development principles

## Synopsis

```
/test [arguments]
```

## Description

Write tests for code using test-driven development principles

## Implementation

Write tests for the specified code or feature using test-driven development (TDD) methodology.

## Process

Use the test-driven-development skill from bushido to:

1. **Understand the requirement**: Clarify what needs to be tested
2. **Write failing test first**: Create a test that fails because the feature doesn't exist yet
3. **Run the test**: Verify it fails for the right reason
4. **Implement minimal code**: Write just enough code to make the test pass
5. **Run test again**: Verify it now passes
6. **Refactor**: Improve code quality while keeping tests green
7. **Repeat**: Continue for each requirement

## Key Principles

- **Red → Green → Refactor**: The core TDD cycle
- **Test behavior, not implementation**: Focus on what the code does, not how
- **One test per requirement**: Keep tests focused and clear
- **Verify test fails first**: Ensures the test is actually testing something

## Examples

When the user says:

- "Write tests for the authentication module"
- "Add tests for the calculateTotal function"
- "I need test coverage for the user registration flow"
- "Test the edge cases for date parsing"

## Notes

- Use TaskCreate to track progress through TDD cycles
- Run full test suite before considering work complete
- Tests should be clear enough to serve as documentation
- Follow existing test patterns in the codebase
