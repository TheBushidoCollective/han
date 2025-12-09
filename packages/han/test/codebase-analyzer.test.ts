/**
 * Tests for codebase-analyzer.ts
 * Testing the formatStatsForPrompt pure function
 */
import { describe, expect, test } from "bun:test";

import {
	type CodebaseStats,
	formatStatsForPrompt,
} from "../lib/codebase-analyzer.ts";

describe("codebase-analyzer.ts", () => {
	describe("formatStatsForPrompt", () => {
		test("returns message for empty stats (no git repo)", () => {
			const stats: CodebaseStats = {
				totalFiles: 0,
				extensions: [],
				configFiles: [],
			};
			const result = formatStatsForPrompt(stats);
			expect(result).toContain("No codebase statistics available");
			expect(result).toContain("not a git repository");
		});

		test("formats total file count", () => {
			const stats: CodebaseStats = {
				totalFiles: 150,
				extensions: [{ extension: ".ts", count: 100 }],
				configFiles: [],
			};
			const result = formatStatsForPrompt(stats);
			expect(result).toContain("Total files: 150");
		});

		test("formats file extensions", () => {
			const stats: CodebaseStats = {
				totalFiles: 50,
				extensions: [
					{ extension: ".ts", count: 30 },
					{ extension: ".json", count: 15 },
					{ extension: ".md", count: 5 },
				],
				configFiles: [],
			};
			const result = formatStatsForPrompt(stats);
			expect(result).toContain("File extensions:");
			expect(result).toContain(".ts: 30");
			expect(result).toContain(".json: 15");
			expect(result).toContain(".md: 5");
		});

		test("limits extensions to top 20", () => {
			const extensions = Array.from({ length: 25 }, (_, i) => ({
				extension: `.ext${i}`,
				count: 25 - i,
			}));
			const stats: CodebaseStats = {
				totalFiles: 100,
				extensions,
				configFiles: [],
			};
			const result = formatStatsForPrompt(stats);
			expect(result).toContain(".ext0: 25");
			expect(result).toContain(".ext19: 6");
			expect(result).toContain("... and 5 more extensions");
			expect(result).not.toContain(".ext20:");
		});

		test("formats config files", () => {
			const stats: CodebaseStats = {
				totalFiles: 20,
				extensions: [{ extension: ".json", count: 10 }],
				configFiles: [
					{ fileName: "package.json", count: 3 },
					{ fileName: "tsconfig.json", count: 2 },
				],
			};
			const result = formatStatsForPrompt(stats);
			expect(result).toContain("Config files:");
			expect(result).toContain("package.json: 3");
			expect(result).toContain("tsconfig.json: 2");
		});

		test("handles stats with only extensions", () => {
			const stats: CodebaseStats = {
				totalFiles: 10,
				extensions: [{ extension: ".py", count: 10 }],
				configFiles: [],
			};
			const result = formatStatsForPrompt(stats);
			expect(result).toContain("Total files: 10");
			expect(result).toContain(".py: 10");
			expect(result).not.toContain("Config files:");
		});

		test("handles stats with only config files", () => {
			const stats: CodebaseStats = {
				totalFiles: 5,
				extensions: [],
				configFiles: [{ fileName: "config.json", count: 5 }],
			};
			const result = formatStatsForPrompt(stats);
			expect(result).toContain("Total files: 5");
			expect(result).toContain("config.json: 5");
			expect(result).not.toContain("File extensions:");
		});

		test("handles large file counts", () => {
			const stats: CodebaseStats = {
				totalFiles: 10000,
				extensions: [{ extension: ".ts", count: 5000 }],
				configFiles: [{ fileName: "package.json", count: 100 }],
			};
			const result = formatStatsForPrompt(stats);
			expect(result).toContain("Total files: 10000");
			expect(result).toContain(".ts: 5000");
			expect(result).toContain("package.json: 100");
		});

		test("formats no-extension files correctly", () => {
			const stats: CodebaseStats = {
				totalFiles: 10,
				extensions: [
					{ extension: "[no extension]", count: 5 },
					{ extension: ".sh", count: 5 },
				],
				configFiles: [],
			};
			const result = formatStatsForPrompt(stats);
			expect(result).toContain("[no extension]: 5");
			expect(result).toContain(".sh: 5");
		});
	});
});
