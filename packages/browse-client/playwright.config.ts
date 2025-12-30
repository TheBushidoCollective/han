import { defineConfig, devices } from '@playwright/test';
import { defineBddConfig } from 'playwright-bdd';

/**
 * Playwright Configuration for browse-client
 *
 * Tests the Han browse client UI with a real backend.
 * Uses `han browse` to start both the coordinator and Vite dev server.
 * Supports both traditional Playwright tests and BDD/Cucumber tests.
 */

// Configure BDD test generation
const testDir = defineBddConfig({
  paths: ['tests/features/*.feature'],
  require: ['tests/features/*.ts'],
});

export default defineConfig({
  // Run both BDD tests and traditional tests
  testDir,
  testMatch: [
    '**/*.spec.ts', // Traditional tests
    '**/*.feature.spec.js', // BDD generated tests
  ],
  testIgnore: 'legacy/**', // Ignore converted tests
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  // Limit workers to prevent race conditions with shared server
  workers: process.env.CI ? 1 : 3,
  reporter: 'html',
  // Increase timeout for slower page loads
  timeout: 45000,
  use: {
    baseURL: 'http://localhost:41956',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    // Add action timeout
    actionTimeout: 10000,
  },

  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
  ],

  webServer: {
    // Use han browse which starts both coordinator and Vite dev server
    command: 'cd ../han && bun lib/main.ts browse --no-open',
    url: 'http://localhost:41956',
    reuseExistingServer: !process.env.CI,
    timeout: 120 * 1000,
    stdout: 'pipe',
    stderr: 'pipe',
  },
});
