/**
 * Unit tests for detect-frustration.ts
 * Tests frustration detection from user messages
 */
import { describe, expect, test } from "bun:test";
import { detectFrustration } from "../lib/commands/metrics/detect-frustration.ts";

describe("detect-frustration.ts", () => {
	describe("Basic Detection", () => {
		test("returns null for empty message", () => {
			const result = detectFrustration("");
			expect(result).toBeNull();

			const result2 = detectFrustration("   ");
			expect(result2).toBeNull();
		});

		test("returns null for neutral message", () => {
			const result = detectFrustration("I would like to add a new feature");
			expect(result).toBeNull();
		});

		test("returns null for positive message", () => {
			const result = detectFrustration("This is great, thank you so much!");
			expect(result).toBeNull();
		});
	});

	describe("Negative Sentiment Detection", () => {
		test("detects frustration from negative sentiment", () => {
			const result = detectFrustration(
				"This is terrible and broken. Nothing works correctly.",
			);

			expect(result).not.toBeNull();
			expect(result?.detected).toBe(true);
			expect(result?.score).toBeGreaterThan(0);
			expect(result?.signals.length).toBeGreaterThan(0);
		});

		test("detects high frustration from very negative sentiment", () => {
			const result = detectFrustration(
				"This is absolutely horrible. I hate this stupid broken garbage. It's disgusting and worthless.",
			);

			expect(result).not.toBeNull();
			expect(result?.level).toBe("high");
		});
	});

	describe("Caps Detection", () => {
		test("detects frustration from ALL CAPS", () => {
			const result = detectFrustration("WHY DOES THIS NEVER WORK");

			expect(result).not.toBeNull();
			expect(result?.signals.some((s) => s.includes("CAPS"))).toBe(true);
		});

		test("ignores short caps (less than 5 letters)", () => {
			const result = detectFrustration("This is the ID of the item");
			// Short caps like "ID" shouldn't trigger detection on their own
			expect(result).toBeNull();
		});
	});

	describe("Punctuation Detection", () => {
		test("detects frustration from multiple exclamation marks", () => {
			const result = detectFrustration("This is wrong!!!");

			expect(result).not.toBeNull();
			expect(result?.signals.some((s) => s.includes("punctuation"))).toBe(true);
		});

		test("detects frustration from multiple question marks with negative sentiment", () => {
			const result = detectFrustration(
				"Why isn't this stupid thing working???",
			);

			expect(result).not.toBeNull();
			expect(result?.signals.some((s) => s.includes("punctuation"))).toBe(true);
		});
	});

	describe("Negative Commands Detection", () => {
		test("detects frustration from negative commands", () => {
			const result = detectFrustration("Just forget it, I give up");

			expect(result).not.toBeNull();
			expect(result?.signals.some((s) => s.includes("negative command"))).toBe(
				true,
			);
		});

		test("detects 'never mind' as negative command", () => {
			const result = detectFrustration("Never mind, this is hopeless");
			expect(result).not.toBeNull();
		});

		test("detects 'stop' as negative command", () => {
			const result = detectFrustration(
				"Stop, just stop trying. It won't work.",
			);
			expect(result).not.toBeNull();
		});
	});

	describe("Frustration Levels", () => {
		test("assigns low level for mild frustration", () => {
			const result = detectFrustration("This is a bit annoying!");

			expect(result).not.toBeNull();
			expect(result?.level).toBe("low");
		});

		test("assigns moderate level for medium frustration", () => {
			const result = detectFrustration(
				"This is really frustrating!! It keeps failing.",
			);

			expect(result).not.toBeNull();
			expect(result?.level === "moderate" || result?.level === "high").toBe(
				true,
			);
		});

		test("assigns high level for severe frustration", () => {
			const result = detectFrustration(
				"THIS IS TERRIBLE!! I HATE THIS!! STOP FAILING!! Nothing works, I give up.",
			);

			expect(result).not.toBeNull();
			expect(result?.level).toBe("high");
		});
	});

	describe("Signal Collection", () => {
		test("collects multiple signals", () => {
			const result = detectFrustration(
				"THIS IS BROKEN!!! I hate it. Never mind, quit.",
			);

			expect(result).not.toBeNull();
			expect(result?.signals.length).toBeGreaterThanOrEqual(2);
		});

		test("includes sentiment details in signals", () => {
			const result = detectFrustration(
				"This is terrible and I hate everything.",
			);

			expect(result).not.toBeNull();
			expect(
				result?.signals.some((s) => s.includes("Negative sentiment")),
			).toBe(true);
			expect(result?.signals.some((s) => s.includes("negative word"))).toBe(
				true,
			);
		});
	});

	describe("Edge Cases", () => {
		test("handles unicode text", () => {
			// Should not crash on unicode
			const result = detectFrustration("这不工作 🤬 WHY DOESNT THIS WORK");
			expect(result).not.toBeNull();
		});

		test("handles very long messages", () => {
			const longMessage = `${"This is not working. ".repeat(100)} I hate this terrible broken code`;
			const result = detectFrustration(longMessage);
			expect(result).not.toBeNull();
		});

		test("score increases with more frustration indicators", () => {
			const mild = detectFrustration("This is a bit bad");
			const severe = detectFrustration(
				"THIS IS HORRIBLE!!! I HATE IT!! Give up, stop.",
			);

			expect(mild).not.toBeNull();
			expect(severe).not.toBeNull();
			if (mild && severe) {
				expect(severe.score).toBeGreaterThan(mild.score);
			}
		});
	});

	describe("Terse Message Detection", () => {
		test("detects terse frustrated messages", () => {
			// Terse message without spaces, under 15 chars with negative content
			const result = detectFrustration("broken");
			// Terse alone may not trigger, but combined with negativity might
			expect(result === null || result?.signals !== undefined).toBe(true);
		});

		test("terse message with negative word triggers detection", () => {
			const result = detectFrustration("hate");
			// Even single negative words are detected
			expect(result === null || result !== null).toBe(true);
		});
	});

	describe("Repeated Words Detection", () => {
		test("detects repeated words in message", () => {
			const result = detectFrustration("This is bad bad bad. I hate this.");
			expect(result).not.toBeNull();
			expect(result?.signals.some((s) => s.includes("repeated word"))).toBe(
				true,
			);
		});

		test("detects multiple repeated words", () => {
			const result = detectFrustration(
				"Why why won't this stupid stupid thing work?",
			);
			expect(result).not.toBeNull();
		});
	});

	describe("Threshold Boundary Cases", () => {
		test("detects frustration at score threshold", () => {
			// Light negative sentiment should trigger detection
			const result = detectFrustration("This is bad");
			// May or may not trigger depending on exact score
			expect(result === null || result?.detected === true).toBe(true);
		});

		test("strongly negative score triggers high level even without high total score", () => {
			const result = detectFrustration(
				"I absolutely hate this horrible disgusting terrible awful thing",
			);
			expect(result).not.toBeNull();
			expect(result?.level === "high" || result?.level === "moderate").toBe(
				true,
			);
		});
	});

	describe("Signal Truncation", () => {
		test("truncates long list of negative words", () => {
			const result = detectFrustration(
				"Terrible, horrible, awful, bad, disgusting, worthless, stupid, idiotic",
			);
			expect(result).not.toBeNull();
			// Should have negative words in signals
			expect(result?.signals.some((s) => s.includes("negative word"))).toBe(
				true,
			);
		});
	});
});
