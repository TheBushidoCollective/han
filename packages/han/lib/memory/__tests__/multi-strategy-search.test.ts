/**
 * Tests for Multi-Strategy Search
 *
 * Tests cover:
 * - RRF (Reciprocal Rank Fusion) algorithm
 * - Confidence calculation based on strategy coverage
 * - Timeout handling per strategy
 * - Deduplication across strategies
 */

import { describe, expect, mock, test } from "bun:test";
import {
	type SearchResultWithCitation,
	type StrategyResult,
	calculateConfidence,
	executeStrategy,
	fuseResults,
	multiStrategySearch,
} from "../multi-strategy-search.ts";

// Mock search result factory
function createResult(
	id: string,
	score: number,
	layer = "transcripts",
): SearchResultWithCitation {
	return {
		id,
		content: `Content for ${id}`,
		score,
		layer,
		metadata: {},
	};
}

// Mock strategy result factory
function createStrategyResult(
	strategy: "direct_fts" | "expanded_fts" | "semantic" | "summaries",
	results: SearchResultWithCitation[],
	success = true,
	error?: string,
): StrategyResult {
	return {
		strategy,
		results,
		duration: 100,
		success,
		error,
	};
}

describe("fuseResults", () => {
	test("should combine results from multiple strategies using RRF", () => {
		const strategyResults: StrategyResult[] = [
			createStrategyResult("direct_fts", [
				createResult("a", 0.9),
				createResult("b", 0.8),
				createResult("c", 0.7),
			]),
			createStrategyResult("expanded_fts", [
				createResult("b", 0.95), // b appears in both, should get boosted
				createResult("d", 0.85),
				createResult("a", 0.75),
			]),
		];

		const fused = fuseResults(strategyResults, 10);

		// 'b' should be first because it appears in both strategies
		expect(fused[0].id).toBe("b");
		// 'a' also appears in both, should be high
		expect(fused.findIndex((r) => r.id === "a")).toBeLessThan(3);
	});

	test("should boost results appearing in multiple strategies", () => {
		const strategyResults: StrategyResult[] = [
			createStrategyResult("direct_fts", [
				createResult("shared", 0.9),
				createResult("unique1", 0.85),
			]),
			createStrategyResult("semantic", [
				createResult("shared", 0.8),
				createResult("unique2", 0.95),
			]),
		];

		const fused = fuseResults(strategyResults, 10);

		// 'shared' should be ranked higher than 'unique2' despite unique2
		// having a higher individual score, because shared appears in both
		expect(fused[0].id).toBe("shared");
	});

	test("should respect limit parameter", () => {
		const strategyResults: StrategyResult[] = [
			createStrategyResult("direct_fts", [
				createResult("a", 0.9),
				createResult("b", 0.8),
				createResult("c", 0.7),
				createResult("d", 0.6),
				createResult("e", 0.5),
			]),
		];

		const fused = fuseResults(strategyResults, 3);
		expect(fused.length).toBe(3);
	});

	test("should skip failed strategies", () => {
		const strategyResults: StrategyResult[] = [
			createStrategyResult("direct_fts", [createResult("a", 0.9)]),
			createStrategyResult("semantic", [], false, "timeout"),
		];

		const fused = fuseResults(strategyResults, 10);
		expect(fused.length).toBe(1);
		expect(fused[0].id).toBe("a");
	});

	test("should deduplicate results by id", () => {
		const strategyResults: StrategyResult[] = [
			createStrategyResult("direct_fts", [createResult("dup", 0.9)]),
			createStrategyResult("expanded_fts", [createResult("dup", 0.8)]),
			createStrategyResult("semantic", [createResult("dup", 0.7)]),
		];

		const fused = fuseResults(strategyResults, 10);
		expect(fused.length).toBe(1);
		expect(fused[0].id).toBe("dup");
	});
});

describe("calculateConfidence", () => {
	test("should return 'high' when 3+ strategies succeed", () => {
		const strategyResults: StrategyResult[] = [
			createStrategyResult("direct_fts", [createResult("a", 0.9)]),
			createStrategyResult("expanded_fts", [createResult("b", 0.8)]),
			createStrategyResult("semantic", [createResult("c", 0.7)]),
		];

		const confidence = calculateConfidence(strategyResults, []);
		expect(confidence).toBe("high");
	});

	test("should return 'high' when 2 strategies with cross-validation", () => {
		const sharedResult = createResult("shared", 0.9);
		const strategyResults: StrategyResult[] = [
			createStrategyResult("direct_fts", [
				sharedResult,
				createResult("a", 0.8),
			]),
			createStrategyResult("semantic", [sharedResult, createResult("b", 0.7)]),
		];

		const confidence = calculateConfidence(strategyResults, [sharedResult]);
		expect(confidence).toBe("high");
	});

	test("should return 'medium' when 2 strategies succeed without cross-validation", () => {
		const strategyResults: StrategyResult[] = [
			createStrategyResult("direct_fts", [createResult("a", 0.9)]),
			createStrategyResult("semantic", [createResult("b", 0.8)]),
		];

		const confidence = calculateConfidence(strategyResults, []);
		expect(confidence).toBe("medium");
	});

	test("should return 'medium' when 1 strategy with many results", () => {
		const results = [
			createResult("a", 0.9),
			createResult("b", 0.8),
			createResult("c", 0.7),
			createResult("d", 0.6),
			createResult("e", 0.5),
		];
		const strategyResults: StrategyResult[] = [
			createStrategyResult("direct_fts", results),
		];

		const confidence = calculateConfidence(strategyResults, results);
		expect(confidence).toBe("medium");
	});

	test("should return 'low' when only 1 strategy with few results", () => {
		const results = [createResult("a", 0.9)];
		const strategyResults: StrategyResult[] = [
			createStrategyResult("direct_fts", results),
		];

		const confidence = calculateConfidence(strategyResults, results);
		expect(confidence).toBe("low");
	});

	test("should return 'low' when all strategies fail", () => {
		const strategyResults: StrategyResult[] = [
			createStrategyResult("direct_fts", [], false, "error"),
			createStrategyResult("semantic", [], false, "error"),
		];

		const confidence = calculateConfidence(strategyResults, []);
		expect(confidence).toBe("low");
	});
});

describe("executeStrategy", () => {
	test("should execute strategy and return results", async () => {
		const mockFts = mock(() => Promise.resolve([createResult("a", 0.9)]));
		const mockVector = mock(() => Promise.resolve([]));
		const mockSummaries = mock(() => Promise.resolve([]));

		const result = await executeStrategy(
			"direct_fts",
			"test query",
			"all",
			10,
			"minimal",
			5000,
			{
				searchMemoryFts: mockFts,
				searchMemoryVector: mockVector,
				searchSummariesNative: mockSummaries,
			},
		);

		expect(result.success).toBe(true);
		expect(result.results.length).toBe(1);
		expect(result.strategy).toBe("direct_fts");
		expect(mockFts).toHaveBeenCalledWith("test query", "all", 10, "none");
	});

	test("should use 'none' expansion for direct_fts strategy", async () => {
		const mockFts = mock(() => Promise.resolve([]));
		const result = await executeStrategy(
			"direct_fts",
			"test",
			"all",
			10,
			"full", // This should be ignored for direct_fts
			5000,
			{
				searchMemoryFts: mockFts,
				searchMemoryVector: mock(() => Promise.resolve([])),
				searchSummariesNative: mock(() => Promise.resolve([])),
			},
		);

		// direct_fts should use 'none' expansion regardless of the passed value
		expect(mockFts).toHaveBeenCalledWith("test", "all", 10, "none");
		expect(result.success).toBe(true);
	});

	test("should use passed expansion for expanded_fts strategy", async () => {
		const mockFts = mock(() => Promise.resolve([]));
		const result = await executeStrategy(
			"expanded_fts",
			"test",
			"all",
			10,
			"full",
			5000,
			{
				searchMemoryFts: mockFts,
				searchMemoryVector: mock(() => Promise.resolve([])),
				searchSummariesNative: mock(() => Promise.resolve([])),
			},
		);

		expect(mockFts).toHaveBeenCalledWith("test", "all", 10, "full");
		expect(result.success).toBe(true);
	});

	test("should timeout and return error on slow strategy", async () => {
		const mockFts = mock(
			(): Promise<SearchResultWithCitation[]> =>
				new Promise((resolve) => {
					setTimeout(() => resolve([createResult("a", 0.9)]), 200);
				}),
		);

		const result = await executeStrategy(
			"direct_fts",
			"test",
			"all",
			10,
			"minimal",
			50, // 50ms timeout, but search takes 200ms
			{
				searchMemoryFts: mockFts,
				searchMemoryVector: mock(
					(): Promise<SearchResultWithCitation[]> => Promise.resolve([]),
				),
				searchSummariesNative: mock(
					(): Promise<SearchResultWithCitation[]> => Promise.resolve([]),
				),
			},
		);

		expect(result.success).toBe(false);
		expect(result.error).toContain("timeout");
		expect(result.results.length).toBe(0);
	});

	test("should handle strategy errors gracefully", async () => {
		const mockFts = mock(() => Promise.reject(new Error("Database error")));

		const result = await executeStrategy(
			"direct_fts",
			"test",
			"all",
			10,
			"minimal",
			5000,
			{
				searchMemoryFts: mockFts,
				searchMemoryVector: mock(() => Promise.resolve([])),
				searchSummariesNative: mock(() => Promise.resolve([])),
			},
		);

		expect(result.success).toBe(false);
		expect(result.error).toBe("Database error");
		expect(result.results.length).toBe(0);
	});
});

describe("multiStrategySearch", () => {
	test("should run all strategies in parallel", async () => {
		const mockFts = mock(() => Promise.resolve([createResult("fts", 0.9)]));
		const mockVector = mock(() =>
			Promise.resolve([createResult("vector", 0.8)]),
		);
		const mockSummaries = mock(() =>
			Promise.resolve([createResult("summary", 0.7)]),
		);

		const result = await multiStrategySearch(
			{
				query: "test",
				layer: "all",
				limit: 10,
			},
			{
				searchMemoryFts: mockFts,
				searchMemoryVector: mockVector,
				searchSummariesNative: mockSummaries,
			},
		);

		expect(result.strategiesAttempted).toBe(4); // All 4 strategies
		expect(mockFts.mock.calls.length).toBe(2); // direct_fts and expanded_fts
		expect(mockVector.mock.calls.length).toBe(1);
		expect(mockSummaries.mock.calls.length).toBe(1);
	});

	test("should allow specifying specific strategies", async () => {
		const mockFts = mock(() => Promise.resolve([createResult("fts", 0.9)]));
		const mockVector = mock(() => Promise.resolve([]));
		const mockSummaries = mock(() => Promise.resolve([]));

		const result = await multiStrategySearch(
			{
				query: "test",
				layer: "all",
				strategies: ["direct_fts", "semantic"],
			},
			{
				searchMemoryFts: mockFts,
				searchMemoryVector: mockVector,
				searchSummariesNative: mockSummaries,
			},
		);

		expect(result.strategiesAttempted).toBe(2);
		expect(mockFts.mock.calls.length).toBe(1); // Only direct_fts, not expanded_fts
		expect(mockVector.mock.calls.length).toBe(1);
		expect(mockSummaries.mock.calls.length).toBe(0);
	});

	test("should report accurate search stats", async () => {
		// Two strategies return the same result (should be deduplicated)
		const mockFts = mock(() =>
			Promise.resolve([
				createResult("shared", 0.9),
				createResult("unique1", 0.8),
			]),
		);
		const mockVector = mock(() =>
			Promise.resolve([
				createResult("shared", 0.85),
				createResult("unique2", 0.75),
			]),
		);
		const mockSummaries = mock(() => Promise.resolve([]));

		const result = await multiStrategySearch(
			{
				query: "test",
				layer: "all",
				strategies: ["direct_fts", "semantic"],
			},
			{
				searchMemoryFts: mockFts,
				searchMemoryVector: mockVector,
				searchSummariesNative: mockSummaries,
			},
		);

		// 4 total results before fusion, 3 unique results after
		expect(result.searchStats.deduplicatedCount).toBe(1);
	});

	test("should track timed out strategies", async () => {
		const slowFts = mock(
			(): Promise<SearchResultWithCitation[]> =>
				new Promise((resolve) => {
					setTimeout(() => resolve([]), 200);
				}),
		);
		const fastVector = mock(
			(): Promise<SearchResultWithCitation[]> =>
				Promise.resolve([createResult("vector", 0.9)]),
		);
		const mockSummaries = mock(
			(): Promise<SearchResultWithCitation[]> => Promise.resolve([]),
		);

		const result = await multiStrategySearch(
			{
				query: "test",
				layer: "all",
				timeout: 50, // Short timeout
				strategies: ["direct_fts", "semantic"],
			},
			{
				searchMemoryFts: slowFts,
				searchMemoryVector: fastVector,
				searchSummariesNative: mockSummaries,
			},
		);

		expect(result.searchStats.strategiesTimedOut).toContain("direct_fts");
		expect(result.searchStats.strategiesTimedOut).not.toContain("semantic");
		expect(result.strategiesSucceeded).toBe(1);
	});

	test("should return appropriate confidence based on strategy coverage", async () => {
		// Only 1 strategy with few results = low confidence
		const mockFts = mock(() => Promise.resolve([createResult("a", 0.9)]));
		const mockVector = mock(() => Promise.resolve([]));
		const mockSummaries = mock(() => Promise.resolve([]));

		const result = await multiStrategySearch(
			{
				query: "test",
				layer: "all",
				strategies: ["direct_fts"],
			},
			{
				searchMemoryFts: mockFts,
				searchMemoryVector: mockVector,
				searchSummariesNative: mockSummaries,
			},
		);

		expect(result.confidence).toBe("low");
	});
});
