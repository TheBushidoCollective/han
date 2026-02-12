# Playwright BDD

Validation and quality enforcement for Playwright BDD projects with Gherkin feature files and step definitions.

## Overview

This plugin provides skills and hooks for behavior-driven development (BDD) testing using [playwright-bdd](https://github.com/vitalets/playwright-bdd). It helps you write, maintain, and validate Gherkin feature files and step definitions that integrate with Playwright Test.

## Skills

This plugin provides the following skills:

- **Playwright BDD Configuration** - Configure `defineBddConfig()`, feature paths, step definitions, and Playwright integration
- **Playwright BDD Step Definitions** - Create step definitions with `Given`/`When`/`Then`, custom fixtures, and Page Object Model
- **Playwright BDD Gherkin Syntax** - Write feature files with scenarios, outlines, backgrounds, tags, and i18n support

## Usage

Skills can be invoked using the Skill tool:

```javascript
Skill("playwright-bdd:playwright-bdd-configuration")
Skill("playwright-bdd:playwright-bdd-step-definitions")
Skill("playwright-bdd:playwright-bdd-gherkin-syntax")
```

## Quality Hooks

This plugin includes hooks that automatically regenerate Playwright test files from feature files before completing work. The hooks run when:

- Feature files (`*.feature`) are modified
- Step definition files are changed
- Playwright configuration is updated

### How It Works

The hooks use `han hook run` to detect directories with `playwright.config.ts` or `playwright.config.js` and run `npx bddgen` to regenerate test files:

```bash
han hook run playwright-bdd generate
```

This ensures your generated test files stay synchronized with your feature files.

## Installation

```bash
han plugin install playwright-bdd
```

## Requirements

Your project must have `playwright-bdd` installed:

```bash
npm install -D playwright-bdd @playwright/test
```

## Quick Start

1. Create a feature file:

```gherkin
# features/login.feature
Feature: User Login

  Scenario: Successful login
    Given I am on the login page
    When I enter valid credentials
    Then I should see the dashboard
```

1. Create step definitions:

```typescript
// steps/login.steps.ts
import { createBdd } from 'playwright-bdd';

const { Given, When, Then } = createBdd();

Given('I am on the login page', async ({ page }) => {
  await page.goto('/login');
});

When('I enter valid credentials', async ({ page }) => {
  await page.getByLabel('Email').fill('user@test.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Login' }).click();
});

Then('I should see the dashboard', async ({ page }) => {
  await expect(page.getByRole('heading', { name: 'Dashboard' })).toBeVisible();
});
```

1. Configure Playwright:

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

const testDir = defineBddConfig({
  features: 'features/**/*.feature',
  steps: 'steps/**/*.ts',
});

export default defineConfig({
  testDir,
});
```

1. Generate and run tests:

```bash
npx bddgen
npx playwright test
```

## Project Structure

Recommended directory structure:

```
project/
├── playwright.config.ts
├── features/
│   ├── auth/
│   │   └── login.feature
│   └── products/
│       └── catalog.feature
├── steps/
│   ├── auth/
│   │   └── login.steps.ts
│   ├── products/
│   │   └── catalog.steps.ts
│   └── fixtures.ts
└── .features-gen/           # Generated (add to .gitignore)
```
