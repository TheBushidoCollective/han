/**
 * Tests for exported helper functions in pattern-detection.ts
 * These are pure functions that can be tested without side effects
 */
import { describe, expect, test } from "bun:test";

import {
	buildPatternMarkdown,
	getHookGuidance,
	getSeverityLevel,
	type Pattern,
} from "../lib/commands/metrics/pattern-detection.ts";

describe("pattern-detection.ts helper functions", () => {
	describe("getSeverityLevel", () => {
		test("returns 1 for low severity", () => {
			expect(getSeverityLevel("low")).toBe(1);
		});

		test("returns 2 for medium severity", () => {
			expect(getSeverityLevel("medium")).toBe(2);
		});

		test("returns 3 for high severity", () => {
			expect(getSeverityLevel("high")).toBe(3);
		});

		test("severity levels are ordered correctly", () => {
			expect(getSeverityLevel("low")).toBeLessThan(getSeverityLevel("medium"));
			expect(getSeverityLevel("medium")).toBeLessThan(getSeverityLevel("high"));
		});
	});

	describe("buildPatternMarkdown", () => {
		test("returns header with alert emoji", () => {
			const patterns: Pattern[] = [];
			const result = buildPatternMarkdown(patterns);
			expect(result).toContain("⚠️ **Pattern Alert**");
		});

		test("includes high severity patterns with red emoji", () => {
			const patterns: Pattern[] = [
				{
					type: "consecutive_failures",
					severity: "high",
					message: "Last 3 tasks all failed",
				},
			];
			const result = buildPatternMarkdown(patterns);
			expect(result).toContain("🔴");
			expect(result).toContain("Last 3 tasks all failed");
		});

		test("includes medium severity patterns with warning emoji", () => {
			const patterns: Pattern[] = [
				{
					type: "hook_failure_pattern",
					severity: "medium",
					message: "Hook failing 35% of time",
				},
			];
			const result = buildPatternMarkdown(patterns);
			expect(result).toContain("⚠️");
			expect(result).toContain("Hook failing 35% of time");
		});

		test("includes guidance when provided", () => {
			const patterns: Pattern[] = [
				{
					type: "test",
					severity: "high",
					message: "Test message",
					guidance: "This is specific guidance",
				},
			];
			const result = buildPatternMarkdown(patterns);
			expect(result).toContain("This is specific guidance");
		});

		test("handles multiple patterns", () => {
			const patterns: Pattern[] = [
				{
					type: "pattern1",
					severity: "high",
					message: "First pattern",
				},
				{
					type: "pattern2",
					severity: "medium",
					message: "Second pattern",
				},
			];
			const result = buildPatternMarkdown(patterns);
			expect(result).toContain("First pattern");
			expect(result).toContain("Second pattern");
		});

		test("handles pattern without guidance", () => {
			const patterns: Pattern[] = [
				{
					type: "test",
					severity: "low",
					message: "No guidance provided",
				},
			];
			const result = buildPatternMarkdown(patterns);
			expect(result).toContain("No guidance provided");
			// Should still render without errors
		});
	});

	describe("getHookGuidance", () => {
		test("returns typescript guidance for typescript-typecheck", () => {
			const guidance = getHookGuidance("typescript-typecheck");
			expect(guidance).toContain("Tip");
			expect(guidance).toContain("tsc");
		});

		test("returns biome guidance for biome-lint", () => {
			const guidance = getHookGuidance("biome-lint");
			expect(guidance).toContain("Tip");
			expect(guidance).toContain("biome check");
		});

		test("returns bun test guidance for bun-test", () => {
			const guidance = getHookGuidance("bun-test");
			expect(guidance).toContain("Tip");
			expect(guidance).toContain("bun test");
		});

		test("returns commit guidance for check-commits", () => {
			const guidance = getHookGuidance("check-commits");
			expect(guidance).toContain("Tip");
			expect(guidance).toContain("conventional");
		});

		test("returns markdown guidance for markdownlint", () => {
			const guidance = getHookGuidance("markdownlint");
			expect(guidance).toContain("Tip");
			expect(guidance).toContain("markdownlint");
		});

		test("returns generic guidance for unknown hooks", () => {
			const guidance = getHookGuidance("unknown-hook");
			expect(guidance).toContain("Tip");
			expect(guidance).toContain("unknown-hook");
			expect(guidance).toContain("Review the output");
		});

		test("returns generic guidance for empty string", () => {
			const guidance = getHookGuidance("");
			expect(guidance).toContain("Tip");
			expect(guidance).toContain("Review the output");
		});
	});
});
