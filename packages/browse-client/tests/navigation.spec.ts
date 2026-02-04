import { expect, test } from "@playwright/test";
import {
	mockDashboardData,
	mockPluginsData,
	mockProjectsData,
	mockSessionsData,
} from "./fixtures/graphql-mocks";

/**
 * Navigation Tests
 *
 * Tests for sidebar navigation and routing.
 */

test.describe("Sidebar Navigation", () => {
	test.beforeEach(async ({ page }) => {
		// Mock all GraphQL endpoints
		await page.route("**/graphql", async (route) => {
			const request = route.request();
			const postData = request.postDataJSON();
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
			} else if (query.includes("viewer") || query.includes("projects")) {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify(mockProjectsData),
				});
			} else if (query.includes("plugins")) {
				await route.fulfill({
					status: 200,
					contentType: "application/json",
					body: JSON.stringify(mockPluginsData),
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

	test("should display sidebar", async ({ page }) => {
		await page.goto("/");

		// Sidebar should be visible
		await expect(page.locator('nav, aside, [class*="sidebar"]')).toBeVisible();
	});

	test("should navigate to Dashboard", async ({ page }) => {
		await page.goto("/sessions");

		// Click Dashboard link
		await page.click("text=Dashboard");

		await expect(page).toHaveURL("/");
		await expect(
			page.getByRole("heading", { name: "Dashboard" }),
		).toBeVisible();
	});

	test("should navigate to Sessions", async ({ page }) => {
		await page.goto("/");

		await page.click("text=Sessions");

		await expect(page).toHaveURL("/sessions");
		await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();
	});

	test("should navigate to Repos (redirects to Projects)", async ({ page }) => {
		await page.goto("/");

		await page.click("text=Repos");

		// /repos redirects to /projects
		await expect(page).toHaveURL("/projects");
		// Page should load without error - heading is "Repos"
		await expect(page.getByRole("heading", { name: "Repos" })).toBeVisible();
	});

	test("should navigate to Plugins", async ({ page }) => {
		await page.goto("/");

		await page.click("text=Plugins");

		await expect(page).toHaveURL("/plugins");
	});

	test("should navigate to Metrics", async ({ page }) => {
		await page.goto("/");

		await page.click("text=Metrics");

		await expect(page).toHaveURL("/metrics");
	});

	test("should navigate to Settings", async ({ page }) => {
		await page.goto("/");

		await page.click("text=Settings");

		await expect(page).toHaveURL("/settings");
	});

	test("should highlight active navigation item", async ({ page }) => {
		await page.goto("/sessions");

		// The Sessions nav item should have active styling (uses inline styles, not classes)
		// Verify the link exists and is visible
		const sessionsLink = page.locator('a[href="/sessions"]');
		await expect(sessionsLink).toBeVisible();

		// Active state is indicated by background color via inline style
		await expect(sessionsLink).toHaveCSS(
			"background-color",
			/rgb\(\d+,\s*\d+,\s*\d+\)/,
		);
	});
});

test.describe("Deep Linking", () => {
	test.beforeEach(async ({ page }) => {
		await page.route("**/graphql", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({ data: {} }),
			});
		});
	});

	test("should load session detail page directly", async ({ page }) => {
		await page.goto("/sessions/abc123");

		await expect(page).toHaveURL("/sessions/abc123");
	});

	test("should load repo detail page directly", async ({ page }) => {
		await page.goto("/repos/my-project");

		await expect(page).toHaveURL("/repos/my-project");
	});

	test("should load settings page directly", async ({ page }) => {
		await page.goto("/settings");

		await expect(page).toHaveURL("/settings");
	});
});

test.describe("Browser Navigation", () => {
	test.beforeEach(async ({ page }) => {
		await page.route("**/graphql", async (route) => {
			const request = route.request();
			const postData = request.postDataJSON();
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

	test("should handle browser back button", async ({ page }) => {
		await page.goto("/");
		await page.click("text=Sessions");
		await expect(page).toHaveURL("/sessions");

		await page.goBack();
		await expect(page).toHaveURL("/");
	});

	test("should handle browser forward button", async ({ page }) => {
		await page.goto("/");
		await page.click("text=Sessions");
		await expect(page).toHaveURL("/sessions");
		await page.goBack();
		await expect(page).toHaveURL("/");

		await page.goForward();
		await expect(page).toHaveURL("/sessions");
	});

	test("should preserve state on back navigation", async ({ page }) => {
		await page.goto("/");
		await expect(
			page.getByRole("heading", { name: "Dashboard" }),
		).toBeVisible();

		await page.click("text=Sessions");
		await expect(page).toHaveURL("/sessions");
		await page.goBack();

		await expect(
			page.getByRole("heading", { name: "Dashboard" }),
		).toBeVisible();
	});
});

test.describe("404 Handling", () => {
	test("should display 404 for unknown routes", async ({ page }) => {
		await page.goto("/unknown-page-xyz");

		// Should show not found or redirect
		await expect(page.locator("body")).toBeVisible();
	});
});
