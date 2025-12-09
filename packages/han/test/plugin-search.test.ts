/**
 * Tests for plugin-search.ts
 */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";

// Mock marketplace-cache to avoid network calls
// This avoids mocking shared.ts which pollutes other tests
const mockPlugins = [
	{
		name: "jutsu-typescript",
		description: "TypeScript type checking and linting",
		category: "jutsu",
		keywords: ["typescript", "types", "tsc"],
	},
	{
		name: "jutsu-react",
		description: "React component development patterns",
		category: "jutsu",
		keywords: ["react", "jsx", "components"],
	},
	{
		name: "hashi-github",
		description: "GitHub MCP integration for issues and PRs",
		category: "hashi",
		keywords: ["github", "git", "issues", "pr"],
	},
	{
		name: "do-accessibility",
		description: "Accessibility testing and compliance",
		category: "do",
		keywords: ["a11y", "accessibility", "wcag"],
	},
];

mock.module("../lib/marketplace-cache.ts", () => ({
	getMarketplacePlugins: mock(() =>
		Promise.resolve({
			plugins: mockPlugins,
			fromCache: true,
		}),
	),
}));

// Import after mock is set up
import { searchPlugins } from "../lib/plugin-search.ts";

describe("plugin-search.ts", () => {
	let consoleLogSpy: ReturnType<typeof spyOn>;
	let consoleErrorSpy: ReturnType<typeof spyOn>;
	let logs: string[] = [];
	let errors: string[] = [];

	beforeEach(() => {
		logs = [];
		errors = [];
		consoleLogSpy = spyOn(console, "log").mockImplementation((...args) => {
			logs.push(args.join(" "));
		});
		consoleErrorSpy = spyOn(console, "error").mockImplementation((...args) => {
			errors.push(args.join(" "));
		});
	});

	afterEach(() => {
		consoleLogSpy.mockRestore();
		consoleErrorSpy.mockRestore();
	});

	describe("searchPlugins", () => {
		test("lists all plugins when no query provided", async () => {
			await searchPlugins();

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("Searching Han marketplace");
			expect(allLogs).toContain("Found 4 plugin(s)");
		});

		test("filters plugins by name", async () => {
			await searchPlugins("typescript");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain('Found 1 plugin(s) matching "typescript"');
		});

		test("filters plugins by description", async () => {
			await searchPlugins("component");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain('Found 1 plugin(s) matching "component"');
		});

		test("filters plugins by keyword", async () => {
			await searchPlugins("a11y");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain('Found 1 plugin(s) matching "a11y"');
		});

		test("filters plugins by category", async () => {
			await searchPlugins("hashi");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain('Found 1 plugin(s) matching "hashi"');
		});

		test("shows no results message for non-matching query", async () => {
			await searchPlugins("nonexistent");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain('No plugins found matching "nonexistent"');
		});

		test("search is case-insensitive", async () => {
			await searchPlugins("TYPESCRIPT");

			const allLogs = logs.join("\n");
			expect(allLogs).toContain('Found 1 plugin(s) matching "TYPESCRIPT"');
		});

		test("shows install hint after results", async () => {
			await searchPlugins();

			const allLogs = logs.join("\n");
			expect(allLogs).toContain("han plugin install <plugin-name>");
			expect(allLogs).toContain("jutsu-typescript");
		});
	});
});
