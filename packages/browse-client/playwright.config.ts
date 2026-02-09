import { defineConfig, devices } from "@playwright/test";
import { defineBddConfig } from "playwright-bdd";

/**
 * Playwright Configuration for browse-client
 *
 * Tests the Han browse client UI with a real backend.
 * Uses `han browse` to start both the coordinator and Vite dev server.
 * Supports both traditional Playwright tests and BDD/Cucumber tests.
 */

// Configure BDD test generation
const testDir = defineBddConfig({
	paths: ["tests/features/*.feature"],
	require: ["tests/features/*.ts"],
});

export default defineConfig({
	// Run both BDD tests and traditional tests
	testDir,
	testMatch: [
		"**/*.spec.ts", // Traditional tests
		"**/*.feature.spec.js", // BDD generated tests
	],
	testIgnore: "legacy/**", // Ignore converted tests
	fullyParallel: true,
	forbidOnly: !!process.env.CI,
	// Retry flaky tests - 2 retries helps with timing issues
	retries: 2,
	// Use 1 worker for stability - parallel workers cause browser context corruption on timeouts
	workers: 1,
	reporter: "html",
	// Increase timeout for slower page loads
	timeout: 60000,
	use: {
		baseURL: "http://localhost:41956",
		trace: "on-first-retry",
		screenshot: "only-on-failure",
		// Action timeout must be >= waitForFunction timeouts (45s for page loads)
		actionTimeout: 60000,
	},

	projects: [
		{
			name: "chromium",
			use: { ...devices["Desktop Chrome"] },
		},
	],

	webServer: {
		// First ensure coordinator is running, then start browse server
		// The coordinator provides the GraphQL backend on port 41957
		// HAN_NO_DEV_WATCHERS=1 disables relay-compiler and file watchers to prevent
		// premature shutdown during tests
		// --local flag runs local HTTP server instead of opening remote dashboard
		command:
			"cd ../han && bun lib/main.ts coordinator ensure && HAN_NO_DEV_WATCHERS=1 bun lib/main.ts browse --local",
		url: "http://localhost:41956",
		reuseExistingServer: !process.env.CI,
		timeout: 120 * 1000,
		stdout: "pipe",
		stderr: "pipe",
		// Ensure proper cleanup on test end
		gracefulExit: "signal",
	},
});
