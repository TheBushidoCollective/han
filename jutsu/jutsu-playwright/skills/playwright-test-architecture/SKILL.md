---
name: playwright-test-architecture
description: Use when setting up Playwright test projects and organizing test suites with proper configuration and project structure.
allowed-tools:
  - Bash
  - Read
  - Write
  - Edit
---

# Playwright Test Architecture

Master test organization, configuration, and project structure for scalable
and maintainable Playwright test suites. This skill covers best practices
for organizing tests, configuring projects, and optimizing test execution.

## Installation and Setup

```bash
# Install Playwright with browsers
npm init playwright@latest

# Install specific browsers
npx playwright install chromium firefox webkit

# Install dependencies only
npm install -D @playwright/test

# Update Playwright
npm install -D @playwright/test@latest
npx playwright install

# Show installed version
npx playwright --version
```

## Project Configuration

### Basic Configuration

**playwright.config.ts:**

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  // Test directory
  testDir: './tests',

  // Test timeout (30 seconds default)
  timeout: 30000,

  // Expect timeout for assertions
  expect: {
    timeout: 5000,
  },

  // Run tests in files in parallel
  fullyParallel: true,

  // Fail the build on CI if you accidentally left test.only
  forbidOnly: !!process.env.CI,

  // Retry on CI only
  retries: process.env.CI ? 2 : 0,

  // Reporter configuration
  reporter: 'html',

  // Shared settings for all projects
  use: {
    // Base URL for navigation
    baseURL: 'http://localhost:3000',

    // Collect trace on first retry
    trace: 'on-first-retry',

    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Video on retry
    video: 'retain-on-failure',
  },

  // Configure projects for major browsers
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
  ],

  // Run local dev server before starting tests
  webServer: {
    command: 'npm run start',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
});
```

### Advanced Configuration

```typescript
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests',
  testMatch: '**/*.spec.ts',
  testIgnore: '**/fixtures/**',

  // Global test timeout
  timeout: 30000,

  // Global setup/teardown
  globalSetup: require.resolve('./global-setup'),
  globalTeardown: require.resolve('./global-teardown'),

  // Expect configuration
  expect: {
    timeout: 5000,
    toHaveScreenshot: {
      maxDiffPixels: 100,
    },
    toMatchSnapshot: {
      threshold: 0.2,
    },
  },

  // Test execution
  fullyParallel: true,
  workers: process.env.CI ? 2 : undefined,
  retries: process.env.CI ? 2 : 0,
  forbidOnly: !!process.env.CI,
  maxFailures: process.env.CI ? 10 : undefined,

  // Output configuration
  outputDir: 'test-results',
  preserveOutput: 'failures-only',

  // Reporter configuration
  reporter: [
    ['html', { outputFolder: 'playwright-report' }],
    ['json', { outputFile: 'test-results/results.json' }],
    ['junit', { outputFile: 'test-results/junit.xml' }],
    ['list'],
  ],

  // Shared use options
  use: {
    baseURL: process.env.BASE_URL || 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: 'retain-on-failure',

    // Browser options
    headless: !!process.env.CI,
    viewport: { width: 1280, height: 720 },
    ignoreHTTPSErrors: true,
    bypassCSP: false,

    // Timeouts
    actionTimeout: 10000,
    navigationTimeout: 30000,

    // Context options
    locale: 'en-US',
    timezoneId: 'America/New_York',
    permissions: ['geolocation'],
    geolocation: { latitude: 40.7128, longitude: -74.0060 },
    colorScheme: 'dark',

    // Recording options
    contextOptions: {
      recordVideo: {
        dir: 'videos',
        size: { width: 1280, height: 720 },
      },
    },
  },

  // Multiple projects for different scenarios
  projects: [
    // Setup project - runs first
    {
      name: 'setup',
      testMatch: /global\.setup\.ts/,
    },

    // Desktop browsers
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
      dependencies: ['setup'],
    },
    {
      name: 'firefox',
      use: { ...devices['Desktop Firefox'] },
      dependencies: ['setup'],
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
      dependencies: ['setup'],
    },

    // Mobile browsers
    {
      name: 'Mobile Chrome',
      use: { ...devices['Pixel 5'] },
      dependencies: ['setup'],
    },
    {
      name: 'Mobile Safari',
      use: { ...devices['iPhone 13'] },
      dependencies: ['setup'],
    },

    // Branded browsers
    {
      name: 'Microsoft Edge',
      use: {
        ...devices['Desktop Edge'],
        channel: 'msedge',
      },
      dependencies: ['setup'],
    },
    {
      name: 'Google Chrome',
      use: {
        ...devices['Desktop Chrome'],
        channel: 'chrome',
      },
      dependencies: ['setup'],
    },

    // Custom viewport
    {
      name: 'tablet',
      use: {
        viewport: { width: 768, height: 1024 },
      },
      dependencies: ['setup'],
    },
  ],

  // Web server configuration
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    stdout: 'ignore',
    stderr: 'pipe',
  },
});
```

## Test Organization Patterns

### By Feature

```text
tests/
├── auth/
│   ├── login.spec.ts
│   ├── logout.spec.ts
│   ├── registration.spec.ts
│   └── password-reset.spec.ts
├── checkout/
│   ├── cart.spec.ts
│   ├── payment.spec.ts
│   └── confirmation.spec.ts
└── profile/
    ├── settings.spec.ts
    └── preferences.spec.ts
```

### By Page

```text
tests/
├── pages/
│   ├── home.spec.ts
│   ├── product-list.spec.ts
│   ├── product-detail.spec.ts
│   └── checkout.spec.ts
└── workflows/
    ├── purchase-flow.spec.ts
    └── user-journey.spec.ts
```

### By User Journey

```text
tests/
├── critical-paths/
│   ├── new-user-signup.spec.ts
│   ├── existing-user-login.spec.ts
│   └── purchase-completion.spec.ts
├── secondary-flows/
│   ├── profile-management.spec.ts
│   └── search-and-filter.spec.ts
└── edge-cases/
    ├── error-handling.spec.ts
    └── boundary-conditions.spec.ts
```

### Hybrid Approach (Recommended)

```text
tests/
├── e2e/                    # End-to-end user journeys
│   ├── checkout-flow.spec.ts
│   └── user-onboarding.spec.ts
├── features/               # Feature-specific tests
│   ├── auth/
│   │   ├── login.spec.ts
│   │   └── registration.spec.ts
│   ├── products/
│   │   ├── search.spec.ts
│   │   └── filters.spec.ts
│   └── profile/
│       └── settings.spec.ts
├── integration/            # API and integration tests
│   ├── api-auth.spec.ts
│   └── api-products.spec.ts
└── visual/                 # Visual regression tests
    ├── homepage.spec.ts
    └── product-page.spec.ts
```

## Test File Structure

### Basic Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Login Feature', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login');
  });

  test('should login with valid credentials', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('password123');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(page).toHaveURL('/dashboard');
    await expect(page.getByText('Welcome back')).toBeVisible();
  });

  test('should show error with invalid credentials', async ({ page }) => {
    await page.getByLabel('Email').fill('user@example.com');
    await page.getByLabel('Password').fill('wrongpassword');
    await page.getByRole('button', { name: 'Login' }).click();

    await expect(
      page.getByText('Invalid email or password')
    ).toBeVisible();
    await expect(page).toHaveURL('/login');
  });
});
```

### Advanced Test Structure

```typescript
import { test, expect } from '@playwright/test';

test.describe('Shopping Cart', () => {
  test.beforeAll(async () => {
    // One-time setup
  });

  test.beforeEach(async ({ page }) => {
    await page.goto('/products');
  });

  test.afterEach(async ({ page }, testInfo) => {
    if (testInfo.status !== testInfo.expectedStatus) {
      // Capture additional debug info on failure
      const screenshot = await page.screenshot();
      await testInfo.attach('screenshot', {
        body: screenshot,
        contentType: 'image/png',
      });
    }
  });

  test.afterAll(async () => {
    // One-time teardown
  });

  test.describe('Adding Items', () => {
    test('should add single item', async ({ page }) => {
      // Test implementation
    });

    test('should add multiple items', async ({ page }) => {
      // Test implementation
    });
  });

  test.describe('Removing Items', () => {
    test.beforeEach(async ({ page }) => {
      // Add items before removal tests
    });

    test('should remove single item', async ({ page }) => {
      // Test implementation
    });

    test('should clear all items', async ({ page }) => {
      // Test implementation
    });
  });
});
```

## Parallel Execution and Sharding

### Parallel Execution

```typescript
// Run all tests in parallel (default)
test.describe.configure({ mode: 'parallel' });

// Run tests serially
test.describe.configure({ mode: 'serial' });

// Example with serial tests
test.describe('Database Tests', () => {
  test.describe.configure({ mode: 'serial' });

  test('should create record', async ({ page }) => {
    // First test
  });

  test('should update record', async ({ page }) => {
    // Depends on first test
  });

  test('should delete record', async ({ page }) => {
    // Depends on previous tests
  });
});
```

### Test Sharding

```bash
# Split tests across 4 shards
npx playwright test --shard=1/4
npx playwright test --shard=2/4
npx playwright test --shard=3/4
npx playwright test --shard=4/4

# CI configuration example (GitHub Actions)
strategy:
  matrix:
    shardIndex: [1, 2, 3, 4]
    shardTotal: [4]
steps:
  - run: npx playwright test --shard=${{ matrix.shardIndex }}/
          ${{ matrix.shardTotal }}
```

### Worker Configuration

```typescript
export default defineConfig({
  // Use all available CPUs
  workers: undefined,

  // Use specific number of workers
  workers: 4,

  // Use percentage of CPUs
  workers: '50%',

  // CI-specific workers
  workers: process.env.CI ? 2 : undefined,
});
```

## Retry Strategies

### Configuration-Based Retries

```typescript
export default defineConfig({
  // Retry failed tests
  retries: 2,

  // Conditional retries
  retries: process.env.CI ? 2 : 0,

  // Per-project retries
  projects: [
    {
      name: 'chromium',
      retries: 1,
    },
    {
      name: 'webkit',
      retries: 3, // Safari might be flakier
    },
  ],
});
```

### Test-Level Retries

```typescript
// Override retries for specific test
test('flaky test', async ({ page }) => {
  test.fixme(); // Skip this test
});

test('critical test', async ({ page }) => {
  test.slow(); // Triple timeout
});

test.describe(() => {
  test.describe.configure({ retries: 3 });

  test('needs extra retries', async ({ page }) => {
    // Test implementation
  });
});
```

## Reporter Configuration

### Built-in Reporters

```typescript
export default defineConfig({
  reporter: [
    // List reporter (default)
    ['list'],

    // Line reporter (one line per test)
    ['line'],

    // Dot reporter (minimal output)
    ['dot'],

    // HTML reporter
    ['html', {
      outputFolder: 'playwright-report',
      open: 'never', // 'always', 'never', 'on-failure'
    }],

    // JSON reporter
    ['json', {
      outputFile: 'test-results/results.json',
    }],

    // JUnit reporter
    ['junit', {
      outputFile: 'test-results/junit.xml',
    }],

    // GitHub Actions annotations
    ['github'],
  ],
});
```

### Custom Reporter

```typescript
// custom-reporter.ts
import { Reporter, TestCase, TestResult } from '@playwright/test/reporter';

class CustomReporter implements Reporter {
  onBegin(config, suite) {
    console.log(`Starting test run with ${suite.allTests().length} tests`);
  }

  onTestBegin(test: TestCase) {
    console.log(`Starting test: ${test.title}`);
  }

  onTestEnd(test: TestCase, result: TestResult) {
    console.log(`Finished test: ${test.title} - ${result.status}`);
  }

  onEnd(result) {
    console.log(`Finished test run: ${result.status}`);
  }
}

export default CustomReporter;
```

```typescript
// playwright.config.ts
export default defineConfig({
  reporter: [
    ['./custom-reporter.ts'],
    ['html'],
  ],
});
```

## Environment-Specific Configuration

### Multi-Environment Setup

```typescript
// playwright.config.ts
import { defineConfig } from '@playwright/test';

const env = process.env.ENV || 'local';

const baseURLs = {
  local: 'http://localhost:3000',
  staging: 'https://staging.example.com',
  production: 'https://example.com',
};

export default defineConfig({
  use: {
    baseURL: baseURLs[env],
  },
});
```

### Environment Files

```typescript
// config/environments.ts
export const environments = {
  local: {
    baseURL: 'http://localhost:3000',
    apiURL: 'http://localhost:8000',
    timeout: 30000,
  },
  staging: {
    baseURL: 'https://staging.example.com',
    apiURL: 'https://api-staging.example.com',
    timeout: 60000,
  },
  production: {
    baseURL: 'https://example.com',
    apiURL: 'https://api.example.com',
    timeout: 90000,
  },
};
```

```typescript
// playwright.config.ts
import { environments } from './config/environments';

const env = process.env.ENV || 'local';
const config = environments[env];

export default defineConfig({
  use: {
    baseURL: config.baseURL,
    actionTimeout: config.timeout,
  },
});
```

## Trace and Video Recording

### Trace Configuration

```typescript
export default defineConfig({
  use: {
    // Capture trace on first retry
    trace: 'on-first-retry',

    // Always capture trace
    trace: 'on',

    // Capture trace on failure
    trace: 'retain-on-failure',

    // Never capture trace
    trace: 'off',

    // Trace with screenshots
    trace: {
      mode: 'on',
      screenshots: true,
      snapshots: true,
    },
  },
});
```

### Video Recording

```typescript
export default defineConfig({
  use: {
    // Record video on first retry
    video: 'on-first-retry',

    // Record video on failure
    video: 'retain-on-failure',

    // Always record video
    video: 'on',

    // Never record video
    video: 'off',

    // Video with size
    video: {
      mode: 'on',
      size: { width: 1280, height: 720 },
    },
  },
});
```

### Screenshot Configuration

```typescript
export default defineConfig({
  use: {
    // Screenshot on failure
    screenshot: 'only-on-failure',

    // Always screenshot
    screenshot: 'on',

    // Never screenshot
    screenshot: 'off',
  },
});
```

## Global Setup and Teardown

### Global Setup

```typescript
// global-setup.ts
import { chromium, FullConfig } from '@playwright/test';

async function globalSetup(config: FullConfig) {
  const browser = await chromium.launch();
  const page = await browser.newPage();

  // Perform authentication
  await page.goto('https://example.com/login');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('admin123');
  await page.getByRole('button', { name: 'Login' }).click();

  // Save authentication state
  await page.context().storageState({
    path: 'auth.json',
  });

  await browser.close();
}

export default globalSetup;
```

### Global Teardown

```typescript
// global-teardown.ts
import { FullConfig } from '@playwright/test';
import fs from 'fs';

async function globalTeardown(config: FullConfig) {
  // Clean up authentication state
  if (fs.existsSync('auth.json')) {
    fs.unlinkSync('auth.json');
  }

  // Clean up test data
  console.log('Cleaning up test data...');
}

export default globalTeardown;
```

## Test Grouping and Tagging

### Using Tags

```typescript
// Tag individual tests
test('@smoke @critical should login', async ({ page }) => {
  // Test implementation
});

// Tag test suites
test.describe('@regression', () => {
  test('test 1', async ({ page }) => {
    // Test implementation
  });

  test('test 2', async ({ page }) => {
    // Test implementation
  });
});
```

```bash
# Run tests with specific tag
npx playwright test --grep @smoke

# Run tests without specific tag
npx playwright test --grep-invert @slow

# Combine tags
npx playwright test --grep "@smoke|@critical"
```

## When to Use This Skill

- Setting up new Playwright test projects from scratch
- Configuring CI/CD pipelines for test execution
- Organizing large test suites for maintainability
- Optimizing test execution time with parallelization
- Implementing retry strategies for flaky tests
- Configuring multi-environment test execution
- Setting up test reporting for different audiences
- Establishing test architecture patterns for teams
- Debugging test failures with traces and videos
- Scaling test suites across multiple projects

## Resources

- Playwright Documentation: <https://playwright.dev>
- Playwright API Reference: <https://playwright.dev/docs/api/class-playwright>
- Playwright GitHub: <https://github.com/microsoft/playwright>
