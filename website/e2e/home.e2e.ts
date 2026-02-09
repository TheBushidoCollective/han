import { expect, test } from "@playwright/test";

test.describe("Home Page", () => {
	test("should load the home page", async ({ page }) => {
		await page.goto("/");
		await expect(page).toHaveTitle(/Han/);
	});

	test("should display the main heading", async ({ page }) => {
		await page.goto("/");
		const heading = page.locator("h1");
		await expect(heading).toContainText("Ship-Ready Code");
	});

	test("should have navigation links", async ({ page }) => {
		await page.goto("/");
		const pluginsLink = page.getByRole("link", { name: /plugins/i });
		const githubLink = page.getByRole("link", { name: /github/i });
		await expect(pluginsLink.first()).toBeVisible();
		await expect(githubLink.first()).toBeVisible();
	});

	test("should navigate to plugins page", async ({ page }) => {
		await page.goto("/");
		await page
			.locator("header")
			.getByRole("link", { name: /plugins/i })
			.click();
		await expect(page).toHaveURL(/\/plugins/);
	});
});
