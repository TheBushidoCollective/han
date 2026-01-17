# BDD Tests with Cucumber/Gherkin

This directory contains BDD (Behavior-Driven Development) tests written in Gherkin syntax using `playwright-bdd`.

## Structure

```
features/
├── README.md                    # This file
├── *.feature                    # Gherkin feature files
└── step-definitions/            # Step implementations
    ├── fixtures.ts              # Test fixtures and BDD setup
    ├── navigation.steps.ts      # Navigation step definitions
    └── content.steps.ts         # Content verification step definitions
```

## Running Tests

```bash
# Run all BDD tests
npm run test:bdd

# Run with headed browser (see browser UI)
npm run test:bdd:headed

# Run with debug mode (step through tests)
npm run test:bdd:debug

# Run original e2e tests
npm run test:e2e

# Run both BDD and e2e tests
npm run test:all
```

## How It Works

1. Feature files (`*.feature`) define test scenarios in Gherkin syntax
2. Step definitions (`step-definitions/*.steps.ts`) implement the steps
3. Running `bddgen --config=playwright.bdd.config.ts` generates Playwright test files in `.features-gen/`
4. Playwright runs the generated tests using `playwright.bdd.config.ts`

Note: BDD tests use a separate config file (`playwright.bdd.config.ts`) while regular e2e tests use `playwright.config.ts`. This allows both test types to coexist.

## Writing New Tests

### 1. Create a Feature File

Create a new `.feature` file in this directory:

```gherkin
Feature: My New Feature
  As a user
  I want to do something
  So that I can achieve a goal

  Scenario: My first scenario
    Given I am on the homepage
    When I click on something
    Then something should happen
```

### 2. Implement Step Definitions

If you use new steps, add them to the appropriate file in `step-definitions/`:

```typescript
import { expect } from "@playwright/test";
import { Given, When, Then } from "./fixtures";

Given("I am on some page", async ({ page }) => {
  await page.goto("/some-page");
});

When("I do something", async ({ page }) => {
  await page.click("button");
});

Then("something should happen", async ({ page }) => {
  await expect(page.locator("h1")).toBeVisible();
});
```

### 3. Generate and Run Tests

```bash
npm run test:bdd
```

## Available Features

- **homepage.feature** - Homepage functionality
- **documentation.feature** - Documentation pages
- **plugins.feature** - Plugin browsing and detail pages
- **navigation.feature** - Cross-section navigation

## Tips

- Use Background sections for common setup steps
- Use Scenario Outlines for data-driven tests
- Keep step definitions reusable across features
- Run `bddgen` after modifying feature files to regenerate tests
