import { expect, test } from "@playwright/test";

test.describe("Dashboard", () => {
	test("shows sessions with timestamps", async ({ page }) => {
		await page.goto("/");

		// Wait for the dashboard to load
		await page.waitForSelector(
			'[data-testid="session-list"], .session-list, h1',
			{ timeout: 10000 },
		);

		// Check that the page title or heading exists
		const heading = page.locator("h1, h2").first();
		await expect(heading).toBeVisible({ timeout: 5000 });

		// Check for session list items (if any exist)
		const sessionItems = page.locator(
			'[data-testid="session-item"], .session-item, [class*="session"]',
		);
		const count = await sessionItems.count();

		// If sessions exist, verify they have content
		if (count > 0) {
			const firstSession = sessionItems.first();
			await expect(firstSession).toBeVisible();

			// Check that timestamp is not "12/31/1969" (epoch bug)
			const sessionText = await firstSession.textContent();
			expect(sessionText).not.toContain("12/31/1969");
			expect(sessionText).not.toContain("1969");
		}
	});

	test("navigates to session detail", async ({ page }) => {
		await page.goto("/");

		// Wait for sessions to load
		await page.waitForLoadState("networkidle");

		// Find a session link
		const sessionLink = page
			.locator('a[href*="/sessions/"], [data-testid="session-link"]')
			.first();

		// Skip if no sessions exist
		const sessionExists = await sessionLink.isVisible().catch(() => false);
		if (!sessionExists) {
			test.skip();
			return;
		}

		// Click on session
		await sessionLink.click();

		// Verify we navigated to session detail page
		await expect(page).toHaveURL(/\/sessions\/[a-f0-9-]+/i, { timeout: 5000 });
	});
});
