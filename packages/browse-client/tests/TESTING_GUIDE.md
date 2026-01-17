# Han Browse Client - Testing Guide

Complete guide for running, writing, and maintaining BDD tests for the Han browse-client.

## Quick Start

```bash
# Navigate to browse-client
cd packages/browse-client

# Generate test files from feature files
npx bddgen

# Run all tests
npx playwright test

# Run with UI (recommended for debugging)
npx playwright test --ui
```

## Table of Contents

- [Running Tests](#running-tests)
- [Understanding Test Output](#understanding-test-output)
- [Writing New Tests](#writing-new-tests)
- [Debugging Failed Tests](#debugging-failed-tests)
- [Common Issues](#common-issues)
- [Advanced Usage](#advanced-usage)

## Running Tests

### All Tests

```bash
npx playwright test
```

### Specific Feature

```bash
# By feature name
npx playwright test --grep "Session Messages"
npx playwright test --grep "Dashboard"
npx playwright test --grep "Plugins"

# By file
npx playwright test session-messages
```

### By Tag

```bash
# Only tests that require sessions
npx playwright test --grep "@requires-sessions"

# Only tests that require data
npx playwright test --grep "@requires-data"

# Tests that DON'T require data (good for empty state testing)
npx playwright test --grep-invert "@requires"
```

### Interactive Mode

```bash
# Opens UI to run and debug tests
npx playwright test --ui

# Run in headed mode (see browser)
npx playwright test --headed

# Debug mode (step through)
npx playwright test --debug
```

### Single Test

```bash
# Run a specific test by name
npx playwright test -g "Session detail page shows messages"
```

### With Reporter

```bash
# Generate HTML report
npx playwright test --reporter=html

# View the report
npx playwright show-report
```

## Understanding Test Output

### Successful Test

```
✓  Session detail page shows messages (5.2s)
```

### Failed Test

```
✗  Session detail page shows messages (timeout)
  Expected element ".messages-section" to be visible
  Timeout 10000ms exceeded
```

### Skipped Test

```
○  Session shows message count [requires-sessions]
```

## Writing New Tests

### Step 1: Create Feature File

Create a new `.feature` file in `tests/features/`:

```gherkin
Feature: My New Feature
  As a user
  I want to test something
  So that I can verify it works

  Scenario: Basic test
    Given I am on the "/page" page
    When the page loads
    Then the element "main" should be visible
```

### Step 2: Use Existing Steps

**Always check `steps.ts` first!** Most patterns already exist.

Common patterns:

```gherkin
# Navigation
Given I am on the "/path" page
When I navigate to "/path"

# Clicking
When I click on "selector"
When I click on button "text"
When I click on "selector" if it exists

# Assertions
Then I should see "text"
Then the element "selector" should be visible
Then the page should contain "text"
Then the url should contain "fragment"

# Waiting
When the page loads
When I wait for element "selector"

# Input
When I type "value" into "selector"
When I fill in "selector" with "value"
```

### Step 3: Generate Test Files

```bash
npx bddgen
```

This creates `.spec.js` files in `.features-gen/`.

### Step 4: Run Tests

```bash
npx playwright test my-new-feature
```

## Debugging Failed Tests

### 1. Run with UI

```bash
npx playwright test --ui
```

- See live browser
- Step through actions
- Inspect elements
- View network requests

### 2. Run with Debug

```bash
npx playwright test --debug
```

- Opens Playwright Inspector
- Pause execution
- Step through code
- Evaluate expressions

### 3. Check Screenshots

Failed tests automatically save screenshots to `test-results/`.

### 4. View Trace

```bash
# Enable trace on failure (already configured)
npx playwright test

# View trace
npx playwright show-trace test-results/.../trace.zip
```

### 5. Add Logging

Temporarily add to feature:

```gherkin
When I wait for 2 seconds
```

Or check the step implementation in `steps.ts`.

## Common Issues

### Issue: Tests timeout

**Symptoms**: Tests fail with "Timeout exceeded"

**Solutions**:

1. Use `When the page loads` after navigation
2. Increase timeout in `playwright.config.ts`
3. Check if `han browse` is running
4. Verify network connectivity

### Issue: Element not found

**Symptoms**: "Element not visible" or "Selector not found"

**Solutions**:

1. Use "if it exists" pattern for optional elements:

   ```gherkin
   Then the element ".optional" should be visible if it exists
   ```

2. Verify selector is correct (use browser dev tools)
3. Wait for page load before checking element
4. Check if element is conditionally rendered

### Issue: Tests fail in CI but pass locally

**Symptoms**: Green locally, red in CI

**Solutions**:

1. Check for race conditions (use proper waits)
2. Verify CI has seed data
3. Check timing differences (CI is slower)
4. Review CI logs for specific errors

### Issue: Flaky tests

**Symptoms**: Tests pass/fail inconsistently

**Solutions**:

1. Avoid hardcoded timeouts (use `page.waitFor*`)
2. Wait for network idle: `When the page loads`
3. Use stable selectors (data-testid, roles)
4. Check for parallel test conflicts

### Issue: No test data

**Symptoms**: Tests skip or show empty states

**Solutions**:

1. Tag tests appropriately:

   ```gherkin
   @requires-sessions
   Scenario: View sessions
   ```

2. Use conditional assertions:

   ```gherkin
   Then the page should contain "No sessions" if it exists
   ```

3. Create seed data scripts
4. Run against a populated database

## Advanced Usage

### Running Subset of Tests

```bash
# All dashboard tests
npx playwright test dashboard

# All tests NOT requiring data
npx playwright test --grep-invert "@requires"

# Specific scenario
npx playwright test -g "Session detail page shows messages"

# Multiple features
npx playwright test session memory plugins
```

### Parallel Execution

```bash
# Run with 4 workers
npx playwright test --workers=4

# Run serially (1 worker)
npx playwright test --workers=1
```

### Retry Failed Tests

```bash
# Retry failed tests up to 2 times
npx playwright test --retries=2
```

### Generate Code

Use Playwright codegen to generate step definitions:

```bash
npx playwright codegen http://localhost:41956
```

### Custom Reporter

```bash
# JSON reporter
npx playwright test --reporter=json

# Multiple reporters
npx playwright test --reporter=html --reporter=json
```

### Environment Variables

```bash
# Custom base URL
PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test

# Headed mode
HEADED=1 npx playwright test
```

## Test Data Management

### Option 1: Seed Database

Create a seed script:

```bash
cd packages/han
bun run seed-test-data
```

### Option 2: Use Fixtures

Create test fixtures in `tests/fixtures/`:

```typescript
// fixtures/sessions.ts
export const testSession = {
  id: 'test-session-1',
  projectName: 'Test Project',
  messageCount: 5,
  // ...
};
```

### Option 3: Mock GraphQL

Mock responses in step definitions:

```typescript
await page.route('**/graphql', (route) => {
  route.fulfill({
    status: 200,
    body: JSON.stringify({ data: mockData }),
  });
});
```

## Performance Tips

### Faster Test Runs

1. **Run in parallel**: Use `--workers=4`
2. **Skip unnecessary tests**: Use tags and `--grep`
3. **Reuse browser context**: Playwright handles this
4. **Use test sharding** (CI):

   ```bash
   npx playwright test --shard=1/4
   ```

### Faster Development

1. **Use UI mode**: `npx playwright test --ui`
2. **Run single test**: `npx playwright test -g "test name"`
3. **Watch mode**: Use `--watch` (if available)
4. **Skip slow tests**: Tag and exclude them

## CI/CD Integration

### GitHub Actions Example

```yaml
- name: Install dependencies
  run: cd packages/browse-client && npm ci

- name: Generate BDD tests
  run: cd packages/browse-client && npx bddgen

- name: Run Playwright tests
  run: cd packages/browse-client && npx playwright test

- name: Upload report
  if: always()
  uses: actions/upload-artifact@v3
  with:
    name: playwright-report
    path: packages/browse-client/playwright-report/
```

## Best Practices

### DO ✅

- ✅ Wait for page loads: `When the page loads`
- ✅ Use semantic selectors: `role="button"`, `.session-list-item`
- ✅ Tag data requirements: `@requires-sessions`
- ✅ Handle empty states: "if it exists" patterns
- ✅ Test user behavior, not implementation
- ✅ Keep scenarios independent
- ✅ Use descriptive scenario names
- ✅ Reuse existing step definitions

### DON'T ❌

- ❌ Use hardcoded timeouts: `page.waitForTimeout(5000)`
- ❌ Test internal state: Redux store, component state
- ❌ Make tests depend on each other
- ❌ Use brittle selectors: `nth-child`, dynamic IDs
- ❌ Duplicate step definitions
- ❌ Skip "page loads" wait after navigation
- ❌ Assume data exists without tagging
- ❌ Write implementation-specific tests

## Maintenance

### Updating Step Definitions

When UI changes, update `steps.ts`:

1. Identify failing step
2. Update selector/logic
3. Re-run `npx bddgen`
4. Verify all tests using that step

### Adding New Step Definitions

Only add when absolutely necessary:

1. Check if existing step can be parameterized
2. Make new step generic and reusable
3. Document with comments
4. Group with similar steps
5. Update this guide

### Refactoring Tests

When refactoring:

1. Run full suite before changes
2. Make incremental changes
3. Run tests after each change
4. Update documentation
5. Check for affected scenarios

## Troubleshooting Checklist

When tests fail:

- [ ] Is `han browse` running on port 41956?
- [ ] Did you run `npx bddgen` after updating `.feature` files?
- [ ] Are you using the latest step definitions?
- [ ] Does the test have proper data requirements tagged?
- [ ] Are you waiting for page loads?
- [ ] Is the selector correct?
- [ ] Does the element exist in the current state?
- [ ] Are there any race conditions?
- [ ] Is the test isolated from others?

## Resources

### Documentation

- [Playwright Docs](https://playwright.dev)
- [Playwright BDD Plugin](https://github.com/vitalets/playwright-bdd)
- [Gherkin Reference](https://cucumber.io/docs/gherkin/)
- [Han Documentation](https://han.guru)

### Internal Files

- `tests/features/README.md` - Feature file documentation
- `tests/TEST_SUMMARY.md` - Test suite overview
- `tests/features/steps.ts` - All step definitions
- `playwright.config.ts` - Test configuration

### Getting Help

1. Check this guide
2. Review `tests/features/README.md`
3. Look at existing feature files for examples
4. Check `steps.ts` for available steps
5. Run tests with `--ui` to debug
6. Check test output and screenshots

## Contributing

When adding tests:

1. Follow existing patterns
2. Use DRY principles (don't repeat steps)
3. Tag appropriately
4. Handle empty states
5. Update documentation
6. Run full suite before committing

## Conclusion

This testing guide covers everything you need to run, write, and debug BDD tests for the Han browse-client. The test suite is designed to be maintainable, reliable, and easy to extend.

For questions or issues, refer to the resources section or check existing test files for examples.

Happy testing! 🎭
