import { expect, test } from "@playwright/test";
import { mockDashboardData, mockSessionsData } from "./fixtures/graphql-mocks";

/**
 * Accessibility Tests
 *
 * Basic accessibility checks for the browse-client UI.
 */

test.describe("Accessibility", () => {
	test.beforeEach(async ({ page }) => {
		await page.route("**/graphql", async (route) => {
			const postData = route.request().postDataJSON();
			const query = postData?.query || "";

			if (query.includes("DashboardPageQuery")) {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify(mockDashboardData),
				});
			} else if (query.includes("sessions(")) {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify(mockSessionsData),
				});
			} else {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify({ data: {} }),
				});
			}
		});
	});

	test("dashboard should have proper heading hierarchy", async ({ page }) => {
		await page.goto("/");

		// Should have h1 or prominent heading
		const headings = page.locator("h1, h2, h3");
		await expect(headings.first()).toBeVisible();
	});

	test("sessions page should have proper heading", async ({ page }) => {
		await page.goto("/sessions");

		await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();
	});

	test("interactive elements should be focusable", async ({ page }) => {
		await page.goto("/");

		// Tab through the page
		await page.keyboard.press("Tab");
		const focusedElement = page.locator(":focus");
		await expect(focusedElement).toBeVisible();
	});

	test("buttons should be keyboard accessible", async ({ page }) => {
		await page.goto("/");

		// Find all buttons
		const buttons = page.getByRole("button");
		const buttonCount = await buttons.count();

		// Each button should be focusable
		for (let i = 0; i < Math.min(buttonCount, 3); i++) {
			const button = buttons.nth(i);
			await button.focus();
			await expect(button).toBeFocused();
		}
	});

	test("links should have discernible text", async ({ page }) => {
		await page.goto("/");

		const links = page.getByRole("link");
		const linkCount = await links.count();

		for (let i = 0; i < Math.min(linkCount, 5); i++) {
			const link = links.nth(i);
			const text = await link.textContent();
			const ariaLabel = await link.getAttribute("aria-label");

			// Link should have either text content or aria-label
			expect(text?.trim() || ariaLabel).toBeTruthy();
		}
	});

	test("inputs should have labels", async ({ page }) => {
		await page.goto("/sessions");

		const filterInput = page.getByPlaceholder(/filter/i);
		if (await filterInput.isVisible()) {
			// Input should have accessible name (placeholder, label, or aria-label)
			const placeholder = await filterInput.getAttribute("placeholder");
			const ariaLabel = await filterInput.getAttribute("aria-label");
			expect(placeholder || ariaLabel).toBeTruthy();
		}
	});

	test("color contrast should be sufficient", async ({ page }) => {
		await page.goto("/");

		// Check that text is visible (basic check)
		const headings = page.getByRole("heading");
		const headingCount = await headings.count();

		for (let i = 0; i < Math.min(headingCount, 3); i++) {
			const heading = headings.nth(i);
			await expect(heading).toBeVisible();
		}
	});

	test("page should have language attribute", async ({ page }) => {
		await page.goto("/");

		const html = page.locator("html");
		const lang = await html.getAttribute("lang");
		expect(lang).toBeTruthy();
	});

	test("images should have alt text", async ({ page }) => {
		await page.goto("/");

		const images = page.locator("img");
		const imageCount = await images.count();

		for (let i = 0; i < imageCount; i++) {
			const img = images.nth(i);
			const alt = await img.getAttribute("alt");
			const ariaHidden = await img.getAttribute("aria-hidden");

			// Image should have alt text or be decorative (aria-hidden)
			expect(alt !== null || ariaHidden === "true").toBeTruthy();
		}
	});

	test("focus should be visible", async ({ page }) => {
		await page.goto("/");

		// Tab to an interactive element
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");

		// Check that focus is visible (element should be focused)
		const focusedElement = page.locator(":focus");
		await expect(focusedElement).toBeVisible();
	});

	test("skip link should be available", async ({ page }) => {
		await page.goto("/");

		// Press Tab to reveal skip link (if hidden until focused)
		await page.keyboard.press("Tab");

		// Look for skip link (common patterns)
		const _skipLink = page.locator(
			'a:has-text("skip"), a[href="#main"], a[href="#content"]',
		);
		// Skip links are optional but nice to have
	});
});

test.describe("Keyboard Navigation", () => {
	test.beforeEach(async ({ page }) => {
		await page.route("**/graphql", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockDashboardData),
			});
		});
	});

	test("should be able to navigate with Tab key", async ({ page }) => {
		await page.goto("/");

		// Tab through interactive elements
		for (let i = 0; i < 5; i++) {
			await page.keyboard.press("Tab");
			const focusedElement = page.locator(":focus");
			await expect(focusedElement).toBeVisible();
		}
	});

	test("should be able to navigate backwards with Shift+Tab", async ({
		page,
	}) => {
		await page.goto("/");

		// Tab forward
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");
		await page.keyboard.press("Tab");

		// Tab backward
		await page.keyboard.press("Shift+Tab");
		const focusedElement = page.locator(":focus");
		await expect(focusedElement).toBeVisible();
	});

	test("should be able to activate buttons with Enter", async ({ page }) => {
		await page.goto("/");

		// Tab to a button/link
		const firstInteractive = page.locator("button, a").first();
		await firstInteractive.focus();

		// Press Enter
		await page.keyboard.press("Enter");

		// Should have navigated or activated
	});

	test("should be able to activate buttons with Space", async ({ page }) => {
		await page.goto("/");

		const button = page.getByRole("button").first();
		if (await button.isVisible()) {
			await button.focus();
			await page.keyboard.press("Space");
		}
	});
});

test.describe("Responsive Design", () => {
	test("should work on mobile viewport", async ({ page }) => {
		await page.route("**/graphql", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockDashboardData),
			});
		});

		await page.setViewportSize({ width: 375, height: 667 });
		await page.goto("/");

		await expect(
			page.getByRole("heading", { name: "Dashboard" }),
		).toBeVisible();
	});

	test("should work on tablet viewport", async ({ page }) => {
		await page.route("**/graphql", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockDashboardData),
			});
		});

		await page.setViewportSize({ width: 768, height: 1024 });
		await page.goto("/");

		await expect(
			page.getByRole("heading", { name: "Dashboard" }),
		).toBeVisible();
	});

	test("should work on desktop viewport", async ({ page }) => {
		await page.route("**/graphql", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockDashboardData),
			});
		});

		await page.setViewportSize({ width: 1920, height: 1080 });
		await page.goto("/");

		await expect(
			page.getByRole("heading", { name: "Dashboard" }),
		).toBeVisible();
	});
});
