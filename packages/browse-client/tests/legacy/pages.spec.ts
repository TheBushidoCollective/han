import { expect, test } from "@playwright/test";

test.describe("Pages Integration", () => {
	test("plugins page loads with real data", async ({ page }) => {
		await page.goto("/plugins");

		// Wait for main content area to appear
		const main = page.locator("main.main-content");
		await expect(main).toBeVisible({ timeout: 15000 });

		// Check for "Plugins" in the page text
		await expect(page.locator("text=Plugins")).toBeVisible({ timeout: 10000 });
	});

	test("settings page loads with real data", async ({ page }) => {
		await page.goto("/settings");

		// Wait for main content area to appear
		const main = page.locator("main.main-content");
		await expect(main).toBeVisible({ timeout: 15000 });

		// Check for settings-related content
		await expect(page.locator("text=Settings").first()).toBeVisible({
			timeout: 10000,
		});
	});

	test("projects page loads with real data", async ({ page }) => {
		await page.goto("/projects");

		// Wait for main content area to appear
		const main = page.locator("main.main-content");
		await expect(main).toBeVisible({ timeout: 15000 });

		// Check for "Projects" in the page
		await expect(page.locator("text=Projects").first()).toBeVisible({
			timeout: 10000,
		});
	});

	test("repos page loads with real data", async ({ page }) => {
		await page.goto("/repos");

		// Wait for main content area to appear
		const main = page.locator("main.main-content");
		await expect(main).toBeVisible({ timeout: 15000 });

		// Check for repos content (repos or repositories)
		await expect(
			page.locator("text=/repos|repositories/i").first(),
		).toBeVisible({ timeout: 10000 });
	});

	test("metrics page loads with real data", async ({ page }) => {
		await page.goto("/metrics");

		// Wait for main content area to appear
		const main = page.locator("main.main-content");
		await expect(main).toBeVisible({ timeout: 15000 });

		// Check for metrics content
		await expect(page.locator("text=Metrics").first()).toBeVisible({
			timeout: 10000,
		});
	});
});
