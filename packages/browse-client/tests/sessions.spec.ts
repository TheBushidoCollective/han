import { expect, test } from "@playwright/test";
import { mockSessionsData } from "./fixtures/graphql-mocks";

/**
 * Sessions Page Tests
 *
 * Tests for the sessions list and filtering.
 */

test.describe("Sessions Page", () => {
	test.beforeEach(async ({ page }) => {
		await page.route("**/graphql", async (route) => {
			const request = route.request();
			const postData = request.postDataJSON();
			const query = postData?.query || "";

			if (query.includes("sessions(")) {
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

	test("should display page header", async ({ page }) => {
		await page.goto("/sessions");

		await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible();
	});

	test("should display session list", async ({ page }) => {
		await page.goto("/sessions");

		// Wait for sessions to load
		await expect(page.getByText("han")).toBeVisible();
		await expect(page.getByText("browse-client")).toBeVisible();
	});

	test("should display session summaries", async ({ page }) => {
		await page.goto("/sessions");

		await expect(page.getByText("Dashboard improvements")).toBeVisible();
		await expect(page.getByText("Relay setup")).toBeVisible();
	});

	test("should display message counts", async ({ page }) => {
		await page.goto("/sessions");

		await expect(page.getByText("42")).toBeVisible();
		await expect(page.getByText("28")).toBeVisible();
	});

	test("should have filter input", async ({ page }) => {
		await page.goto("/sessions");

		const filterInput = page.getByPlaceholder(/filter/i);
		await expect(filterInput).toBeVisible();
	});

	test("should filter sessions by project name", async ({ page }) => {
		await page.goto("/sessions");

		const filterInput = page.getByPlaceholder("Filter sessions...");
		await filterInput.fill("han");

		// han session should be visible as a button
		await expect(
			page.getByRole("button", { name: /han.*42 msgs/i }),
		).toBeVisible();
	});

	test("should navigate to session detail on click", async ({ page }) => {
		await page.goto("/sessions");

		// Wait for sessions to load
		await expect(page.getByText("han")).toBeVisible();

		// Click on a session button (SessionListItem is a button)
		await page.getByRole("button", { name: /han/i }).first().click();

		// Should navigate to session detail
		await expect(page).toHaveURL(/\/sessions\/abc123/);
	});

	test("should display empty state when no sessions", async ({ page }) => {
		await page.route("**/graphql", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify({
					data: {
						sessions: {
							edges: [],
							pageInfo: {
								hasNextPage: false,
								hasPreviousPage: false,
								startCursor: null,
								endCursor: null,
							},
							totalCount: 0,
						},
					},
				}),
			});
		});

		await page.goto("/sessions");

		await expect(page.getByText(/no sessions/i)).toBeVisible();
	});
});

test.describe("Sessions Loading", () => {
	test("should show loading state", async ({ page }) => {
		await page.route("**/graphql", async (route) => {
			await new Promise((resolve) => setTimeout(resolve, 1000));
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockSessionsData),
			});
		});

		await page.goto("/sessions");

		await expect(page.getByText(/loading/i)).toBeVisible();
		await expect(page.getByRole("heading", { name: "Sessions" })).toBeVisible({
			timeout: 5000,
		});
	});
});

test.describe("Session Detail Page", () => {
	const mockSessionDetail = {
		data: {
			session: {
				id: "session-1",
				sessionId: "abc123",
				date: "2024-01-15",
				startedAt: new Date().toISOString(),
				endedAt: null,
				projectName: "han",
				projectPath: "/Users/dev/han",
				worktreeName: null,
				summary: "Working on dashboard improvements",
				messageCount: 42,
				gitBranch: "main",
				version: "2.0.0",
				checkpoints: [],
				hookExecutions: [],
				hookStats: {
					totalHooks: 0,
					passedHooks: 0,
					failedHooks: 0,
					passRate: 0,
					totalDurationMs: 0,
					byHookType: [],
				},
				tasks: [],
				messages: {
					edges: [
						{
							node: {
								id: "msg-1",
								type: "USER",
								content: "Help me build a dashboard",
								timestamp: new Date().toISOString(),
								isToolOnly: false,
							},
							cursor: "cursor-1",
						},
						{
							node: {
								id: "msg-2",
								type: "ASSISTANT",
								content: "I can help you with that!",
								timestamp: new Date().toISOString(),
								isToolOnly: false,
							},
							cursor: "cursor-2",
						},
					],
					pageInfo: {
						hasNextPage: false,
						hasPreviousPage: false,
						startCursor: "cursor-1",
						endCursor: "cursor-2",
					},
					totalCount: 2,
				},
			},
		},
	};

	test.beforeEach(async ({ page }) => {
		await page.route("**/graphql", async (route) => {
			await route.fulfill({
				status: 200,
				contentType: "application/json",
				body: JSON.stringify(mockSessionDetail),
			});
		});
	});

	test("should display session header", async ({ page }) => {
		await page.goto("/sessions/abc123");

		await expect(page.getByText("han")).toBeVisible();
	});

	test("should display project path", async ({ page }) => {
		await page.goto("/sessions/abc123");

		// Project name is displayed as heading
		await expect(page.getByRole("heading", { name: "han" })).toBeVisible();
	});

	test("should display message count", async ({ page }) => {
		await page.goto("/sessions/abc123");

		await expect(page.getByText("42 msgs")).toBeVisible();
	});

	test("should display messages section", async ({ page }) => {
		await page.goto("/sessions/abc123");

		// Messages heading includes the count
		await expect(page.getByRole("heading", { name: /Messages/ })).toBeVisible();
	});

	test("should have back button", async ({ page }) => {
		await page.goto("/sessions/abc123");

		// Back button has specific text
		const backButton = page.getByRole("button", { name: /Back to Sessions/i });
		await expect(backButton).toBeVisible();
	});

	test("should navigate back on button click", async ({ page }) => {
		await page.goto("/sessions/abc123");

		// Click the back button
		await page.getByRole("button", { name: /Back to Sessions/i }).click();

		// Should navigate to sessions list
		await expect(page).toHaveURL("/sessions");
	});
});
