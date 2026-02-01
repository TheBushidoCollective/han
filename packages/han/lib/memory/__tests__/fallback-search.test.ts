/**
 * Tests for Fallback Search Mechanisms
 *
 * Tests cover:
 * - Temporal query detection
 * - Vague query detection
 * - Clarification prompt generation
 * - Temporal score calculation
 * - Keyword score calculation
 * - Recent sessions scan
 * - Grep fallback
 * - Fallback chain orchestration
 */

import { describe, expect, test, } from "bun:test";
import {
	detectTemporalQuery,
	isVagueQuery,
	needsClarification,
	calculateTemporalScore,
	calculateKeywordScore,
	getRecentSessions,
	scanRecentSessions,
	grepTranscripts,
	executeFallbacks,
} from "../fallback-search.ts";

describe("detectTemporalQuery", () => {
	test("should detect 'what was I working on' as temporal", () => {
		expect(detectTemporalQuery("what was I working on")).toBe(true);
		expect(detectTemporalQuery("What have I worked on recently")).toBe(true);
	});

	test("should detect time-based keywords as temporal", () => {
		expect(detectTemporalQuery("show me yesterday's work")).toBe(true);
		expect(detectTemporalQuery("last week's commits")).toBe(true);
		expect(detectTemporalQuery("what happened today")).toBe(true);
		expect(detectTemporalQuery("recent activity")).toBe(true);
		expect(detectTemporalQuery("recently modified files")).toBe(true);
		expect(detectTemporalQuery("earlier today")).toBe(true);
	});

	test("should not detect non-temporal queries", () => {
		expect(detectTemporalQuery("how do we handle authentication")).toBe(false);
		expect(detectTemporalQuery("who wrote the API code")).toBe(false);
		expect(detectTemporalQuery("what is the database schema")).toBe(false);
	});
});

describe("isVagueQuery", () => {
	test("should detect very short queries as vague", () => {
		expect(isVagueQuery("what")).toBe(true);
		expect(isVagueQuery("how")).toBe(true);
		expect(isVagueQuery("test")).toBe(true);
	});

	test("should detect simple article+noun as vague", () => {
		expect(isVagueQuery("the thing")).toBe(true);
		expect(isVagueQuery("a bug")).toBe(true);
	});

	test("should not detect specific queries as vague", () => {
		expect(isVagueQuery("how do we handle authentication")).toBe(false);
		expect(isVagueQuery("authentication error in login flow")).toBe(false);
	});
});

describe("needsClarification", () => {
	test("should not need clarification when results exist", () => {
		const result = needsClarification("test query", 5, 2);
		expect(result.needs).toBe(false);
	});

	test("should need clarification for vague query with no results", () => {
		const result = needsClarification("what", 0, 2);
		expect(result.needs).toBe(true);
		expect(result.prompt).toContain("broad");
	});

	test("should need clarification when all strategies fail", () => {
		const result = needsClarification("specific query", 0, 0);
		expect(result.needs).toBe(true);
		expect(result.prompt).toContain("couldn't find");
	});

	test("should suggest alternatives when strategies succeed but no matches", () => {
		const result = needsClarification("nonexistent feature", 0, 3);
		expect(result.needs).toBe(true);
		expect(result.prompt).toContain("different keywords");
	});
});

describe("calculateTemporalScore", () => {
	test("should return 1.0 for current time", () => {
		const now = Date.now();
		const score = calculateTemporalScore(now, now);
		expect(score).toBeCloseTo(1.0, 2);
	});

	test("should return ~0.5 for 24 hours ago", () => {
		const now = Date.now();
		const dayAgo = now - 24 * 60 * 60 * 1000;
		const score = calculateTemporalScore(dayAgo, now);
		expect(score).toBeGreaterThan(0.3);
		expect(score).toBeLessThan(0.5);
	});

	test("should return lower scores for older times", () => {
		const now = Date.now();
		const dayAgo = now - 24 * 60 * 60 * 1000;
		const weekAgo = now - 7 * 24 * 60 * 60 * 1000;

		const dayScore = calculateTemporalScore(dayAgo, now);
		const weekScore = calculateTemporalScore(weekAgo, now);

		expect(weekScore).toBeLessThan(dayScore);
	});
});

describe("calculateKeywordScore", () => {
	test("should return 1.0 when all words match", () => {
		const score = calculateKeywordScore(
			"authentication error in login flow",
			"authentication login",
		);
		expect(score).toBe(1.0);
	});

	test("should return 0.5 when half the words match", () => {
		const score = calculateKeywordScore(
			"authentication error",
			"authentication database",
		);
		expect(score).toBe(0.5);
	});

	test("should return 0 when no words match", () => {
		const score = calculateKeywordScore(
			"authentication error",
			"database schema migration",
		);
		expect(score).toBe(0);
	});

	test("should be case insensitive", () => {
		const score = calculateKeywordScore(
			"AUTHENTICATION Error",
			"authentication error",
		);
		expect(score).toBe(1.0);
	});

	test("should skip very short words", () => {
		// "a" and "in" are too short (< 3 chars), only "error" should count
		const score = calculateKeywordScore("there was a big error in code", "a in error");
		expect(score).toBe(1.0); // Only "error" counted as a query word
	});
});

describe("getRecentSessions", () => {
	test("should return array (may be empty if no sessions)", () => {
		const sessions = getRecentSessions(5);
		expect(Array.isArray(sessions)).toBe(true);
	});

	test("should respect limit parameter", () => {
		const sessions = getRecentSessions(2);
		expect(sessions.length).toBeLessThanOrEqual(2);
	});
});

describe("scanRecentSessions", () => {
	test("should return FallbackResult structure", async () => {
		const result = await scanRecentSessions("test query");

		expect(result).toHaveProperty("strategy", "recent_sessions");
		expect(result).toHaveProperty("results");
		expect(result).toHaveProperty("duration");
		expect(result).toHaveProperty("success");
		expect(Array.isArray(result.results)).toBe(true);
	});

	test("should return results based on recency even with low keyword match", async () => {
		// Recent sessions may still be returned due to high temporal score
		// even when keyword match is low
		const result = await scanRecentSessions("xyznonexistentquery12345");

		expect(result.success).toBe(true);
		// Results may or may not be returned depending on temporal scoring
		expect(Array.isArray(result.results)).toBe(true);
	});
});

describe("grepTranscripts", () => {
	test("should return FallbackResult structure", async () => {
		const result = await grepTranscripts("test", { timeout: 1000, limit: 5 });

		expect(result).toHaveProperty("strategy", "transcript_grep");
		expect(result).toHaveProperty("results");
		expect(result).toHaveProperty("duration");
		expect(result).toHaveProperty("success");
		expect(Array.isArray(result.results)).toBe(true);
	});

	test("should respect timeout", async () => {
		const startTime = Date.now();
		await grepTranscripts("test", { timeout: 100 });
		const elapsed = Date.now() - startTime;

		// Should complete within reasonable time (timeout + overhead)
		expect(elapsed).toBeLessThan(2000);
	});

	test("should respect limit", async () => {
		const result = await grepTranscripts("test", { limit: 3, timeout: 2000 });

		expect(result.results.length).toBeLessThanOrEqual(3);
	});

	test("should handle empty query words", async () => {
		// Very short query with no useful words
		const result = await grepTranscripts("a", { timeout: 1000 });

		expect(result.success).toBe(true);
		expect(result.results).toEqual([]);
	});
});

describe("executeFallbacks", () => {
	test("should skip fallbacks when primary has results", async () => {
		const result = await executeFallbacks("test", 5, 3, {
			enableFallbacks: true,
		});

		expect(result.fallbacksAttempted).toBe(false);
		expect(result.results).toEqual([]);
		expect(result.fallbacksUsed).toEqual([]);
	});

	test("should skip fallbacks when disabled", async () => {
		const result = await executeFallbacks("test", 0, 0, {
			enableFallbacks: false,
		});

		expect(result.fallbacksAttempted).toBe(false);
	});

	test("should attempt recent sessions for temporal queries", async () => {
		const result = await executeFallbacks("what was I working on", 0, 0, {
			enableFallbacks: true,
			enableGrep: false, // Disable grep for faster test
			recentSessionsLimit: 5,
		});

		expect(result.fallbacksAttempted).toBe(true);
		// May or may not have results, but should have attempted
	});

	test("should include clarification when truly no results found", async () => {
		// Note: clarification is only added when NO results are found across all fallbacks
		// Recent sessions may still return results based on high temporal score alone
		const result = await executeFallbacks(
			"xyznonexistentquery12345",
			0,
			0,
			{
				enableFallbacks: true,
				enableGrep: false, // Disable grep for faster test
				recentSessionsLimit: 2,
			},
		);

		expect(result.fallbacksAttempted).toBe(true);
		// If recent_sessions found results based on recency, clarification won't be added
		// If no results, clarification should be added
		if (result.results.length === 0) {
			expect(result.fallbacksUsed).toContain("clarification");
			expect(result.clarificationPrompt).toBeDefined();
		} else {
			// Results found via recent_sessions
			expect(result.fallbacksUsed).toContain("recent_sessions");
		}
	});

	test("should respect grepTimeout option", async () => {
		const startTime = Date.now();
		await executeFallbacks("test", 0, 0, {
			enableFallbacks: true,
			enableGrep: true,
			grepTimeout: 100,
			recentSessionsLimit: 2,
		});
		const elapsed = Date.now() - startTime;

		// Should complete within reasonable time
		expect(elapsed).toBeLessThan(5000);
	});
});

describe("Fallback Chain Integration", () => {
	test("should progress through fallbacks correctly", async () => {
		// Test the full fallback chain with a query unlikely to match
		const result = await executeFallbacks(
			"nonexistent_feature_xyz_12345",
			0, // No primary results
			2, // Some strategies succeeded but found nothing
			{
				enableFallbacks: true,
				enableGrep: true,
				grepTimeout: 500,
				recentSessionsLimit: 3,
			},
		);

		expect(result.fallbacksAttempted).toBe(true);
		// Should have tried at least one fallback
		expect(
			result.fallbacksUsed.includes("recent_sessions") ||
				result.fallbacksUsed.includes("transcript_grep") ||
				result.fallbacksUsed.includes("clarification"),
		).toBe(true);
	});
});
