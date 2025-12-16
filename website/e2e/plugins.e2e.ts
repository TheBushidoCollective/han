import { expect, test } from "@playwright/test";

test.describe("Plugins Page", () => {
	test("should load the plugins page", async ({ page }) => {
		await page.goto("/plugins");
		await expect(page.locator("h1")).toContainText(/Plugin Marketplace/i);
	});

	test("should display category links", async ({ page }) => {
		await page.goto("/plugins");
		await expect(
			page.getByRole("link", { name: /core/i }).first(),
		).toBeVisible();
		await expect(
			page.getByRole("link", { name: /jutsu/i }).first(),
		).toBeVisible();
	});

	test("should navigate to core category", async ({ page }) => {
		await page.goto("/plugins");
		await page.getByRole("link", { name: /core/i }).first().click();
		await expect(page).toHaveURL(/\/plugins\/core/);
	});
});

test.describe("Category Page", () => {
	test("should load core category page", async ({ page }) => {
		await page.goto("/plugins/core");
		await expect(page.locator("h1")).toContainText("Core");
	});

	test("should display plugins in category", async ({ page }) => {
		await page.goto("/plugins/jutsu");
		const pluginCards = page.locator('a[href^="/plugins/jutsu/"]');
		const count = await pluginCards.count();
		expect(count).toBeGreaterThan(0);
	});
});

test.describe("Plugin Detail Page", () => {
	test("should load a plugin detail page", async ({ page }) => {
		await page.goto("/plugins/core/core");
		await expect(page.locator("h1").first()).toBeVisible();
	});

	test("should display installation section", async ({ page }) => {
		await page.goto("/plugins/core/core");
		await expect(
			page.getByRole("heading", { name: "Installation" }).first(),
		).toBeVisible();
	});

	test("should show skills section if available", async ({ page }) => {
		await page.goto("/plugins/core/core");
		const skills = page.getByRole("heading", { name: "Skills" });
		if ((await skills.count()) > 0) {
			await expect(skills.first()).toBeVisible();
		}
	});

	test("should navigate to skill detail page", async ({ page }) => {
		await page.goto("/plugins/core/core");
		const skillLinks = page.locator('a[href*="/skills/"]');
		const count = await skillLinks.count();

		if (count > 0) {
			const href = await skillLinks.first().getAttribute("href");
			await skillLinks.first().click();
			await page.waitForLoadState("networkidle");
			// Only check if href was an actual navigation link
			if (href?.startsWith("/skills/")) {
				await expect(page.url()).toContain("/skills/");
			}
		}
	});
});
