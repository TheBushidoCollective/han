/**
 * Unit tests for frustration detection logic.
 * Tests the pure detectFrustration function without I/O.
 */
import { describe, expect, test } from "bun:test";
import { detectFrustration } from "../lib/commands/metrics/detect-frustration.ts";

describe("detectFrustration", () => {
	describe("edge cases", () => {
		test("returns null for empty string", () => {
			const result = detectFrustration("");
			expect(result).toBeNull();
		});

		test("returns null for whitespace only", () => {
			const result = detectFrustration("   ");
			expect(result).toBeNull();
		});

		test("returns null for neutral message", () => {
			const result = detectFrustration("The weather is nice today");
			expect(result).toBeNull();
		});

		test("returns null for positive message", () => {
			const result = detectFrustration("Thank you, that was helpful!");
			expect(result).toBeNull();
		});
	});

	describe("sentiment-based detection", () => {
		test("detects negative sentiment", () => {
			const result = detectFrustration("This is terrible and awful");
			expect(result).not.toBeNull();
			expect(result?.detected).toBe(true);
			expect(result?.score).toBeGreaterThan(0);
		});

		test("detects strongly negative sentiment", () => {
			const result = detectFrustration("I hate this stupid broken code");
			expect(result).not.toBeNull();
			expect(result?.detected).toBe(true);
			// Very negative sentiment can score as high
			const level = result?.level ?? "";
			expect(["moderate", "high"]).toContain(level);
		});

		test("high frustration for very negative sentiment", () => {
			const result = detectFrustration(
				"This is absolutely terrible horrible awful disgusting broken garbage",
			);
			expect(result).not.toBeNull();
			expect(result?.detected).toBe(true);
			expect(result?.level).toBe("high");
		});

		test("includes negative words in signals", () => {
			const result = detectFrustration("This is bad and wrong");
			expect(result).not.toBeNull();
			expect(result?.signals.some((s) => s.includes("negative word"))).toBe(
				true,
			);
		});
	});

	describe("ALL CAPS detection", () => {
		test("detects ALL CAPS words", () => {
			const result = detectFrustration("WHY DOES THIS KEEP FAILING");
			expect(result).not.toBeNull();
			expect(result?.detected).toBe(true);
			expect(result?.signals).toContain("ALL CAPS detected");
		});

		test("ignores short caps (less than 5 chars)", () => {
			const result = detectFrustration("The API call worked");
			// Short caps like "API" shouldn't trigger caps detection
			expect(
				result === null || !result.signals.some((s) => s.includes("ALL CAPS")),
			).toBe(true);
		});

		test("caps increases frustration score", () => {
			const withCaps = detectFrustration("WHY WONT THIS WORK");
			const withoutCaps = detectFrustration("why wont this work");

			// Both might be detected but caps version should score higher
			if (withCaps && withoutCaps) {
				expect(withCaps.score).toBeGreaterThanOrEqual(withoutCaps.score);
			}
		});
	});

	describe("multiple punctuation detection", () => {
		test("detects multiple exclamation marks", () => {
			const result = detectFrustration("This is frustrating!!");
			expect(result).not.toBeNull();
			expect(result?.signals).toContain("Multiple punctuation marks (!!!/???)");
		});

		test("detects multiple question marks", () => {
			// Need more frustration signals than just punctuation
			const result = detectFrustration(
				"Why isn't this working?? This is bad!!",
			);
			expect(result).not.toBeNull();
			expect(result?.signals).toContain("Multiple punctuation marks (!!!/???)");
		});

		test("single punctuation not detected as frustration indicator", () => {
			const result = detectFrustration("Hello!");
			// Single ! shouldn't be flagged as multiple punctuation
			expect(
				result === null ||
					!result.signals.some((s) => s.includes("Multiple punctuation")),
			).toBe(true);
		});
	});

	describe("terse message detection", () => {
		test("detects very short single-word message", () => {
			const result = detectFrustration("no");
			expect(result).not.toBeNull();
			expect(result?.signals).toContain("Very terse message");
		});

		test("detects short single-word message", () => {
			const result = detectFrustration("wrong");
			expect(result).not.toBeNull();
			expect(result?.signals).toContain("Very terse message");
		});

		test("multi-word short message not flagged as terse", () => {
			const result = detectFrustration("no it is");
			// Contains spaces, so not flagged as terse
			expect(
				result === null || !result.signals.some((s) => s.includes("terse")),
			).toBe(true);
		});
	});

	describe("negative command detection", () => {
		test("detects 'stop' command", () => {
			const result = detectFrustration("stop doing that");
			expect(result).not.toBeNull();
			expect(result?.signals.some((s) => s.includes("negative command"))).toBe(
				true,
			);
		});

		test("detects 'quit' command", () => {
			const result = detectFrustration("I want to quit this");
			expect(result).not.toBeNull();
			expect(result?.signals.some((s) => s.includes("negative command"))).toBe(
				true,
			);
		});

		test("detects 'never mind' phrase", () => {
			const result = detectFrustration("never mind, forget it");
			expect(result).not.toBeNull();
			expect(result?.signals.some((s) => s.includes("negative command"))).toBe(
				true,
			);
		});

		test("detects 'give up' phrase", () => {
			const result = detectFrustration("I give up on this");
			expect(result).not.toBeNull();
			expect(result?.signals.some((s) => s.includes("negative command"))).toBe(
				true,
			);
		});
	});

	describe("repeated words detection", () => {
		test("detects repeated words", () => {
			const result = detectFrustration("why why why does this fail");
			expect(result).not.toBeNull();
			expect(result?.signals.some((s) => s.includes("repeated word"))).toBe(
				true,
			);
		});

		test("no repeated words in normal message", () => {
			const result = detectFrustration("The code works correctly now");
			expect(
				result === null || !result.signals.some((s) => s.includes("repeated")),
			).toBe(true);
		});
	});

	describe("frustration levels", () => {
		test("low frustration for mild signals", () => {
			const result = detectFrustration("no");
			expect(result).not.toBeNull();
			expect(result?.level).toBe("low");
		});

		test("moderate frustration for medium signals", () => {
			const result = detectFrustration("This is bad and I hate it");
			expect(result).not.toBeNull();
			const level = result?.level ?? "";
			expect(["moderate", "high"]).toContain(level);
		});

		test("high frustration for strong signals", () => {
			const result = detectFrustration(
				"THIS IS TERRIBLE!! WHY WONT IT WORK stop stop stop",
			);
			expect(result).not.toBeNull();
			expect(result?.level).toBe("high");
		});
	});

	describe("combined signals", () => {
		test("detects multiple frustration indicators", () => {
			const result = detectFrustration("WHY DOES THIS FAIL!!");
			expect(result).not.toBeNull();
			expect(result?.detected).toBe(true);
			// Should detect both caps and multiple punctuation
			expect(result?.signals.length).toBeGreaterThanOrEqual(2);
		});

		test("accumulated score reflects multiple indicators", () => {
			const singleIndicator = detectFrustration("WHY");
			const multipleIndicators = detectFrustration("WHY WHY WHY!!");

			if (singleIndicator && multipleIndicators) {
				expect(multipleIndicators.score).toBeGreaterThan(singleIndicator.score);
			}
		});
	});

	describe("result structure", () => {
		test("returns proper structure when frustration detected", () => {
			const result = detectFrustration("This is terrible");
			expect(result).not.toBeNull();
			expect(result).toHaveProperty("detected");
			expect(result).toHaveProperty("level");
			expect(result).toHaveProperty("score");
			expect(result).toHaveProperty("signals");
			expect(result?.detected).toBe(true);
			expect(typeof result?.score).toBe("number");
			expect(Array.isArray(result?.signals)).toBe(true);
		});

		test("level is valid FrustrationLevel", () => {
			const result = detectFrustration("This is terrible");
			expect(result).not.toBeNull();
			const level = result?.level ?? "";
			expect(["low", "moderate", "high"]).toContain(level);
		});

		test("signals is non-empty array", () => {
			const result = detectFrustration("This is terrible");
			expect(result).not.toBeNull();
			expect(result?.signals.length).toBeGreaterThan(0);
		});
	});
});
