# buki-tdd

Test-Driven Development (TDD) principles and red-green-refactor cycle enforcement.

## Overview

This plugin provides comprehensive Test-Driven Development guidance and automatic enforcement through hooks. It ensures that Claude follows the TDD cycle when writing new code, fixing bugs, or adding features.

## Features

- **TDD Skill**: Complete guidance on the red-green-refactor cycle
- **Automatic Enforcement**: Hooks that remind Claude to follow TDD on every user prompt
- **Best Practices**: Detailed examples and patterns for different technology stacks

## What is TDD?

Test-Driven Development is a software development approach where you:

1. **RED**: Write a failing test first
2. **GREEN**: Write minimal code to make it pass
3. **REFACTOR**: Improve the code while keeping tests green

## When to Use

Install this plugin when working on:
- Projects that require high code quality
- Teams practicing TDD
- Codebases with comprehensive test coverage
- Any project where you want to ensure tests are written before implementation

## Hooks

This plugin includes hooks that:
- Inject TDD reminders on every user prompt (`UserPromptSubmit`)
- Remind subagents to follow TDD when they complete (`SubagentStop`)

## Skills Included

- `test-driven-development`: Complete TDD guidance with red-green-refactor cycle

## Example Workflow

```bash
# User asks: "Add a function to calculate tax"

# 1. Claude writes failing test first
test "calculates tax on amount" do
  result = Calculator.calculate_tax(100)
  assert result == 8.0
end

# 2. Runs test - should FAIL
mix test

# 3. Implements minimal code
def calculate_tax(amount) do
  amount * 0.08
end

# 4. Runs test - should PASS
mix test

# 5. Refactors if needed
def calculate_tax(amount) do
  amount * @tax_rate
end
```

## Installation

```bash
npx han plugin install buki-tdd
```

## License

MIT
