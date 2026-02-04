import { expect, test } from "@playwright/test";

test.describe("Session Detail", () => {
	test("session detail page shows content", async ({ page }) => {
		// First go to dashboard to get a session ID
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Find a session link
		const sessionLink = page.locator('a[href*="/sessions/"]').first();
		const sessionExists = await sessionLink.isVisible().catch(() => false);

		if (!sessionExists) {
			test.skip();
			return;
		}

		// Get the href and navigate
		const href = await sessionLink.getAttribute("href");
		if (!href) {
			test.skip();
			return;
		}

		await page.goto(href);
		await page.waitForLoadState("networkidle");

		// Verify we're on a session page
		await expect(page).toHaveURL(/\/sessions\//);

		// Check that the page doesn't show "Session not found"
		const bodyText = await page.locator("body").textContent();
		expect(bodyText).not.toContain("Session not found");

		// Check for message content (should have some messages)
		const content = page.locator('main, [role="main"], .content');
		await expect(content).toBeVisible({ timeout: 10000 });
	});

	test("session timestamps are valid", async ({ page }) => {
		await page.goto("/");
		await page.waitForLoadState("networkidle");

		// Find session links
		const sessionLinks = page.locator('a[href*="/sessions/"]');
		const count = await sessionLinks.count();

		if (count === 0) {
			test.skip();
			return;
		}

		// Navigate to first session
		await sessionLinks.first().click();
		await page.waitForLoadState("networkidle");

		// Get page text and verify no 1969/1970 dates (epoch bug)
		const pageText = await page.locator("body").textContent();

		// These are epoch dates that indicate null/undefined timestamps
		expect(pageText).not.toContain("12/31/1969");
		expect(pageText).not.toContain("1/1/1970");
	});
});
