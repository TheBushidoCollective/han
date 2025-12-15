/**
 * Tests for Team Memory MCP Tool
 *
 * NOTE: This test file carefully mocks only specific functions to avoid
 * leaking mocks to other test files. Do NOT use mock.module() for modules
 * that are also tested elsewhere (like research.ts).
 */
import { beforeEach, describe, expect, mock, test } from "bun:test";
import {
	formatTeamMemoryResult,
	queryTeamMemory,
} from "../lib/commands/mcp/team-memory.ts";
import type { SearchResult } from "../lib/memory/types.ts";

// Mock the memory module - only mock path helpers and vector store, NOT createResearchEngine
// This allows the real research engine to run with mocked data
const mockSearch = mock(() => Promise.resolve([] as SearchResult[]));

mock.module("../lib/memory/index.ts", () => {
	// Re-export the real createResearchEngine from research.ts
	const { createResearchEngine } = require("../lib/memory/research.ts");

	return {
		// Use the real research engine
		createResearchEngine,
		// Mock only path helpers and vector store
		getGitRemote: () => "git@github.com:test/repo.git",
		getProjectIndexPath: () => "/tmp/test-memory/.index",
		getVectorStore: (_dbPath: string) =>
			Promise.resolve({
				search: mockSearch,
				index: mock(() => Promise.resolve()),
				clear: mock(() => Promise.resolve()),
				isAvailable: mock(() => Promise.resolve(true)),
				embed: mock(() => Promise.resolve([])),
				embedBatch: mock(() => Promise.resolve([])),
				close: mock(() => Promise.resolve()),
			}),
	};
});

describe("Team Memory MCP Tool", () => {
	beforeEach(() => {
		mockSearch.mockClear();
	});

	describe("queryTeamMemory", () => {
		test("returns error for empty question", async () => {
			const result = await queryTeamMemory({ question: "" });

			expect(result.success).toBe(false);
			expect(result.answer).toContain("cannot be empty");
			expect(result.confidence).toBe("low");
		});

		test("returns error for whitespace-only question", async () => {
			const result = await queryTeamMemory({ question: "   " });

			expect(result.success).toBe(false);
			expect(result.answer).toContain("cannot be empty");
		});

		test("queries vector store with question", async () => {
			mockSearch.mockResolvedValueOnce([]);

			await queryTeamMemory({ question: "who knows about auth?" });

			// Search is called with tableName, query, limit
			expect(mockSearch).toHaveBeenCalledWith(
				"observations",
				"who knows about auth?",
				10,
			);
		});

		test("uses custom limit when provided", async () => {
			mockSearch.mockResolvedValueOnce([]);

			await queryTeamMemory({ question: "what changed?", limit: 20 });

			expect(mockSearch).toHaveBeenCalledWith(
				"observations",
				"what changed?",
				20,
			);
		});

		test("returns low confidence when no results", async () => {
			mockSearch.mockResolvedValueOnce([]);

			const result = await queryTeamMemory({
				question: "who knows about xyz?",
			});

			expect(result.success).toBe(true);
			expect(result.confidence).toBe("low");
		});

		test("formats citations from search results", async () => {
			mockSearch.mockResolvedValueOnce([
				{
					observation: {
						id: "test-1",
						source: "git:commit:abc123",
						author: "alice@example.com",
						timestamp: 1700000000000,
						summary: "Added authentication",
						detail: "Implemented JWT auth",
						files: ["src/auth.ts"],
						patterns: ["auth", "jwt"],
						type: "commit",
					},
					score: 0.85,
					excerpt: "JWT implementation",
				},
			]);

			const result = await queryTeamMemory({
				question: "who knows about auth?",
			});

			expect(result.success).toBe(true);
			expect(result.citations).toHaveLength(1);
			expect(result.citations[0].source).toBe("git:commit:abc123");
			expect(result.citations[0].author).toBe("alice@example.com");
		});
	});

	describe("formatTeamMemoryResult", () => {
		test("formats high confidence result with green indicator", () => {
			const result = {
				success: true,
				answer: "Alice implemented the auth system",
				confidence: "high" as const,
				citations: [
					{
						source: "git:commit:abc123",
						excerpt: "JWT implementation",
						author: "alice@example.com",
						timestamp: 1700000000000,
					},
				],
				caveats: [],
				searched_sources: ["query:who knows about auth?"],
			};

			const formatted = formatTeamMemoryResult(result);

			expect(formatted).toContain("🟢");
			expect(formatted).toContain("Confidence: high");
			expect(formatted).toContain("Alice implemented the auth system");
			expect(formatted).toContain("git:commit:abc123");
		});

		test("formats medium confidence result with yellow indicator", () => {
			const result = {
				success: true,
				answer: "Some evidence found",
				confidence: "medium" as const,
				citations: [],
				caveats: [],
				searched_sources: [],
			};

			const formatted = formatTeamMemoryResult(result);

			expect(formatted).toContain("🟡");
			expect(formatted).toContain("Confidence: medium");
		});

		test("formats low confidence result with red indicator", () => {
			const result = {
				success: true,
				answer: "Couldn't find much",
				confidence: "low" as const,
				citations: [],
				caveats: [],
				searched_sources: [],
			};

			const formatted = formatTeamMemoryResult(result);

			expect(formatted).toContain("🔴");
			expect(formatted).toContain("Confidence: low");
		});

		test("includes caveats when present", () => {
			const result = {
				success: true,
				answer: "The approach evolved",
				confidence: "high" as const,
				citations: [],
				caveats: ["Approach has evolved over 45 days"],
				searched_sources: [],
			};

			const formatted = formatTeamMemoryResult(result);

			expect(formatted).toContain("Notes");
			expect(formatted).toContain("Approach has evolved over 45 days");
		});

		test("truncates long excerpts", () => {
			const longExcerpt = "A".repeat(300);
			const result = {
				success: true,
				answer: "Answer",
				confidence: "high" as const,
				citations: [
					{
						source: "git:commit:abc123",
						excerpt: longExcerpt,
					},
				],
				caveats: [],
				searched_sources: [],
			};

			const formatted = formatTeamMemoryResult(result);

			expect(formatted).toContain("...");
			// Should be truncated to 200 chars
			expect(formatted.split(longExcerpt.slice(0, 200)).length).toBe(2);
		});
	});
});
