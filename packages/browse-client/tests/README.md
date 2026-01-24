# Browse Client Tests

This directory contains both BDD/Cucumber tests and traditional Playwright tests for the Han browse client.

## Structure

```
tests/
├── features/           # Gherkin feature files
│   ├── dashboard.feature
│   ├── session-detail.feature
│   └── pages.feature
├── steps/              # Step definitions for BDD tests
│   ├── dashboard.steps.ts
│   ├── session-detail.steps.ts
│   └── pages.steps.ts
├── legacy/             # Original Playwright tests (converted to BDD)
│   ├── pages.spec.ts
│   ├── dashboard.spec.ts
│   └── session-detail.spec.ts
├── navigation.spec.ts  # Traditional Playwright tests
├── sessions.spec.ts
└── accessibility.spec.ts
```

## BDD/Cucumber Tests

The BDD tests use [playwright-bdd](https://github.com/vitalets/playwright-bdd) which integrates Cucumber/Gherkin with Playwright.

### Running BDD Tests

```bash
# Generate test files from features and run tests
npm test

# Generate test files only
npm run bdd:generate

# Run with UI mode
npm run test:ui

# Run in headed mode (see browser)
npm run test:headed
```

### Writing New BDD Tests

1. Create a `.feature` file in `tests/features/`:

```gherkin
Feature: My Feature
  Scenario: My scenario
    Given some precondition
    When I perform an action
    Then I should see expected result
```

1. Create step definitions in `tests/steps/`:

```typescript
import { expect } from '@playwright/test';
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

Given('some precondition', async ({ page }) => {
  // Setup code
});

When('I perform an action', async ({ page }) => {
  // Action code
});

Then('I should see expected result', async ({ page }) => {
  // Assertion code
});
```

1. Run `npm run bdd:generate` to generate the test files
2. Run `npm test` to execute the tests

### Generated Files

playwright-bdd generates test files in `.features-gen/` directory. These files are auto-generated and should not be edited manually. They are git-ignored.

## Traditional Playwright Tests

Some tests remain as traditional Playwright tests (navigation, sessions, accessibility). These can be run alongside BDD tests.

## Test Server

Tests use `han browse` which starts both the GraphQL coordinator and Vite dev server on port 41956.

The server is automatically started before tests run and reused between test runs (unless in CI).
