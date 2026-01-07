# Han Browse Client - BDD Tests

Comprehensive Playwright BDD tests for the Han browse-client using Gherkin/Cucumber syntax.

## Test Structure

All feature files follow a DRY (Don't Repeat Yourself) pattern using generic, reusable step definitions.

### Directory Layout

```
tests/features/
├── steps.ts                           # Generic step definitions
├── *.feature                          # Feature files (Gherkin)
├── dashboard.feature                  # Dashboard basic tests
├── dashboard-comprehensive.feature    # Dashboard detailed tests
├── session-detail.feature            # Session detail page
├── session-messages.feature          # Session messages
├── session-ordering.feature          # Session list ordering
├── projects.feature                  # Projects and repos
├── memory.feature                    # Memory search and navigation
├── rules.feature                     # Rules browsing
├── plugins.feature                   # Plugin management
├── settings.feature                  # Settings page
├── metrics.feature                   # Metrics and statistics
├── cache.feature                     # Cache page
├── navigation.feature                # Navigation between pages
├── error-states.feature              # Error handling
├── live-updates.feature              # Real-time updates
└── pages.feature                     # Basic page loads
```

## Running Tests

```bash
# Generate test files from feature files
npx bddgen

# Run all tests
npx playwright test

# Run specific feature
npx playwright test --grep "Dashboard"

# Run with UI
npx playwright test --ui

# Run only tests that don't require data
npx playwright test --grep-invert "@requires"
```

## Test Tags

Tests use tags to indicate requirements:

- `@requires-sessions` - Requires existing session data
- `@requires-data` - Requires general data (projects, plugins, etc.)

## Step Definition Patterns

All step definitions are in `steps.ts` and follow these patterns:

### Navigation Steps

```gherkin
Given I am on the "/path" page
When I navigate to "/path"
```

### Click Steps

```gherkin
When I click on "selector"
When I click on "selector" if it exists
When I click on link "text"
When I click on button "text"
When I click on button "text" if it exists
```

### Input Steps

```gherkin
When I fill in "selector" with "value"
When I type "value" into "selector"
When I type "value" into "selector" if it exists
```

### Visibility Steps

```gherkin
Then I should see "text"
Then I should see "text" if it exists
Then the element "selector" should be visible
Then the element "selector" should be visible if it exists
Then I should not see "text"
```

### URL Steps

```gherkin
Then the url should contain "fragment"
Then the url should be "exact-url"
Then the url should match "regex-pattern"
Then the url should contain "fragment" or I am on the homepage
```

### Content Steps

```gherkin
Then the page should contain "text"
Then the page should contain "text" if it exists
Then the page should not contain "text"
```

### Wait Steps

```gherkin
When the page loads
When I wait for element "selector"
Given I wait for {int} seconds
```

## Writing New Tests

### Guidelines

1. **Use existing step definitions** - Check `steps.ts` first
2. **Add new generic steps** - Only when absolutely necessary
3. **Parameterize steps** - Use `{string}` and `{int}` placeholders
4. **Handle missing data gracefully** - Use "if it exists" patterns
5. **Tag appropriately** - Add `@requires-*` tags when needed

### Example Feature

```gherkin
Feature: New Feature
  As a user
  I want to do something
  So that I can achieve a goal

  Scenario: Basic scenario
    Given I am on the "/page" page
    When the page loads
    Then the element "main" should be visible

  @requires-data
  Scenario: Scenario requiring data
    Given I am on the "/page" page
    When the page loads
    And I click on "button" if it exists
    Then the url should contain "/result" or I am on the homepage
```

## Adding New Step Definitions

If you absolutely need a new step definition:

1. Keep it generic and reusable
2. Use descriptive parameter names
3. Add proper error handling
4. Document with comments
5. Group with similar steps

```typescript
// Example new step definition
Then(
  'the element {string} should have attribute {string}',
  async ({ page }, selector: string, attribute: string) => {
    await expect(page.locator(selector).first()).toHaveAttribute(attribute);
  }
);
```

## Test Coverage

These tests cover:

- ✅ Dashboard (global and project-specific)
- ✅ Session detail pages
- ✅ Session messages
- ✅ Session ordering
- ✅ Projects and repos
- ✅ Memory search and rules
- ✅ Plugin management
- ✅ Settings
- ✅ Metrics
- ✅ Cache pages
- ✅ Navigation
- ✅ Error states
- ✅ Live updates
- ✅ Timestamp validation
- ✅ Empty states
- ✅ Loading states

## Configuration

Tests are configured in `playwright.config.ts`:

- Base URL: `http://localhost:41956`
- Web server: `han browse` (auto-started)
- Timeout: 45 seconds
- Workers: 3 (1 in CI)
- Retries: 2 in CI

## Troubleshooting

### Tests failing due to missing data

Add `@requires-data` or `@requires-sessions` tags and use "if it exists" patterns.

### Timeout errors

Increase timeout in specific scenarios or check if the page is loading slowly.

### Flaky tests

Use proper wait conditions (`When the page loads`) and avoid hardcoded waits.

### Element not found

Use "if it exists" patterns for optional elements or verify the selector is correct.

## Best Practices

1. **Always wait for page loads** - Use `When the page loads` after navigation
2. **Use semantic selectors** - Prefer role-based selectors over CSS
3. **Test behavior, not implementation** - Focus on user-visible outcomes
4. **Keep scenarios independent** - Each scenario should stand alone
5. **Use descriptive scenario names** - Make the intent clear
6. **Tag scenarios appropriately** - Help others run relevant subsets
7. **Handle data absence gracefully** - Use conditional steps for optional elements
