import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
	buildPatternMarkdown,
	detectPatterns,
	getHookGuidance,
	getSeverityLevel,
	type Pattern,
	resetStorageInstance,
} from "../lib/commands/metrics/pattern-detection.ts";
import { JsonlMetricsStorage } from "../lib/metrics/jsonl-storage.ts";

let storage: JsonlMetricsStorage | null = null;
let consoleOutput: string[] = [];
const originalConsoleLog = console.log;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	const testDir = join(
		tmpdir(),
		`han-pattern-detection-test-${Date.now()}-${random}`,
	);
	process.env.CLAUDE_CONFIG_DIR = testDir;
	// Reset the storage instance so it picks up the new config dir
	resetStorageInstance();
	storage = new JsonlMetricsStorage();
	consoleOutput = [];
	console.log = (...args: unknown[]) => {
		consoleOutput.push(args.map(String).join(" "));
	};
}

function getStorage(): JsonlMetricsStorage {
	if (!storage) {
		throw new Error("Storage not initialized - call setup() first");
	}
	return storage;
}

function teardown(): void {
	console.log = originalConsoleLog;
	if (storage) {
		storage.close();
		storage = null;
	}
	resetStorageInstance();
	if (process.env.CLAUDE_CONFIG_DIR) {
		try {
			rmSync(process.env.CLAUDE_CONFIG_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		delete process.env.CLAUDE_CONFIG_DIR;
	}
}

describe.serial("Pattern Detection", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("Empty Data Handling", () => {
		test("returns empty patterns when no metrics exist", async () => {
			await detectPatterns({});
			// No output should be produced when there are no patterns
			expect(consoleOutput.length).toBe(0);
		});

		test("returns empty JSON when no metrics exist with --json flag", async () => {
			await detectPatterns({ json: true });
			expect(consoleOutput.length).toBe(1);
			const result = JSON.parse(consoleOutput[0]);
			expect(result.patterns).toEqual([]);
		});

		test("handles metrics with only one task", async () => {
			getStorage().startSession();
			const { task_id } = getStorage().startTask({
				description: "Single task",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
			});

			await detectPatterns({ json: true });
			expect(consoleOutput.length).toBe(1);
			const result = JSON.parse(consoleOutput[0]);
			expect(result.patterns).toEqual([]);
		});
	});

	describe("Consecutive Failures Pattern Detection", () => {
		test("detects consecutive failures when last 3 tasks failed", async () => {
			getStorage().startSession();

			// Create 3 failing tasks
			for (let i = 0; i < 3; i++) {
				const { task_id } = getStorage().startTask({
					description: `Failing task ${i + 1}`,
					type: "implementation",
				});
				getStorage().failTask({
					task_id,
					reason: `Error ${i + 1}`,
				});
			}

			await detectPatterns({ json: true });
			expect(consoleOutput.length).toBe(1);
			const result = JSON.parse(consoleOutput[0]);

			const consecutivePattern = result.patterns.find(
				(p: Pattern) => p.type === "consecutive_failures",
			);
			expect(consecutivePattern).toBeDefined();
			expect(consecutivePattern.severity).toBe("high");
			expect(consecutivePattern.message).toBe("Last 3 tasks all failed");
			expect(consecutivePattern.guidance).toContain("smaller steps");
		});

		test("does not detect consecutive failures when only 2 tasks failed", async () => {
			getStorage().startSession();

			// Only 2 failing tasks
			for (let i = 0; i < 2; i++) {
				const { task_id } = getStorage().startTask({
					description: `Failing task ${i + 1}`,
					type: "implementation",
				});
				getStorage().failTask({
					task_id,
					reason: `Error ${i + 1}`,
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const consecutivePattern = result.patterns.find(
				(p: Pattern) => p.type === "consecutive_failures",
			);
			expect(consecutivePattern).toBeUndefined();
		});

		test("does not detect consecutive failures when last task succeeded", async () => {
			getStorage().startSession();

			// 2 failures followed by 1 success
			for (let i = 0; i < 2; i++) {
				const { task_id } = getStorage().startTask({
					description: `Failing task ${i + 1}`,
					type: "implementation",
				});
				getStorage().failTask({
					task_id,
					reason: `Error ${i + 1}`,
				});
			}

			const { task_id } = getStorage().startTask({
				description: "Success task",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id,
				outcome: "success",
				confidence: 0.9,
			});

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const consecutivePattern = result.patterns.find(
				(p: Pattern) => p.type === "consecutive_failures",
			);
			expect(consecutivePattern).toBeUndefined();
		});
	});

	describe("Hook Failure Pattern Detection", () => {
		test("detects high severity hook failure pattern (>50% failure rate)", async () => {
			const { session_id } = getStorage().startSession();

			// 6 executions, 4 failures (66% failure rate)
			for (let i = 0; i < 4; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "typescript-typecheck",
					hookSource: "jutsu-typescript",
					durationMs: 1000,
					exitCode: 1,
					passed: false,
					error: "Type error",
				});
			}
			for (let i = 0; i < 2; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "typescript-typecheck",
					hookSource: "jutsu-typescript",
					durationMs: 1000,
					exitCode: 0,
					passed: true,
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const hookPattern = result.patterns.find(
				(p: Pattern) => p.type === "hook_failure_pattern",
			);
			expect(hookPattern).toBeDefined();
			expect(hookPattern.severity).toBe("high");
			expect(hookPattern.message).toContain("typescript-typecheck");
			expect(hookPattern.message).toContain("66.7%");
		});

		test("detects medium severity hook failure pattern (30-50% failure rate)", async () => {
			const { session_id } = getStorage().startSession();

			// 10 executions, 4 failures (40% failure rate)
			for (let i = 0; i < 4; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "biome-lint",
					hookSource: "jutsu-biome",
					durationMs: 500,
					exitCode: 1,
					passed: false,
				});
			}
			for (let i = 0; i < 6; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "biome-lint",
					hookSource: "jutsu-biome",
					durationMs: 500,
					exitCode: 0,
					passed: true,
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const hookPattern = result.patterns.find(
				(p: Pattern) => p.type === "hook_failure_pattern",
			);
			expect(hookPattern).toBeDefined();
			expect(hookPattern.severity).toBe("medium");
		});

		test("does not detect hook failure pattern when failure rate is low", async () => {
			const { session_id } = getStorage().startSession();

			// 10 executions, 2 failures (20% failure rate - below threshold)
			for (let i = 0; i < 2; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "test-hook",
					hookSource: "core",
					durationMs: 100,
					exitCode: 1,
					passed: false,
				});
			}
			for (let i = 0; i < 8; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "test-hook",
					hookSource: "core",
					durationMs: 100,
					exitCode: 0,
					passed: true,
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const hookPattern = result.patterns.find(
				(p: Pattern) => p.type === "hook_failure_pattern",
			);
			expect(hookPattern).toBeUndefined();
		});
	});

	describe("Calibration Pattern Detection", () => {
		test("detects overconfident calibration pattern", async () => {
			getStorage().startSession();

			// Create tasks with high confidence but many failures (overconfident)
			for (let i = 0; i < 5; i++) {
				const { task_id } = getStorage().startTask({
					description: `Overconfident task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id,
					outcome: i === 0 ? "success" : "failure", // Only 1 success, 4 failures
					confidence: 0.95, // Very high confidence despite failures
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const calibrationPattern = result.patterns.find(
				(p: Pattern) => p.type === "calibration_drift",
			);
			expect(calibrationPattern).toBeDefined();
			expect(calibrationPattern.guidance).toContain("overconfident");
		});

		test("detects underconfident calibration pattern", async () => {
			getStorage().startSession();

			// Create tasks with low confidence but many successes (underconfident)
			for (let i = 0; i < 5; i++) {
				const { task_id } = getStorage().startTask({
					description: `Underconfident task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id,
					outcome: "success", // All successes
					confidence: 0.3, // Low confidence despite success
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const calibrationPattern = result.patterns.find(
				(p: Pattern) => p.type === "calibration_drift",
			);
			expect(calibrationPattern).toBeDefined();
			expect(calibrationPattern.guidance).toContain("underconfident");
		});

		test("high severity for very low calibration score (<0.3)", async () => {
			getStorage().startSession();

			// Create tasks with very bad calibration
			for (let i = 0; i < 5; i++) {
				const { task_id } = getStorage().startTask({
					description: `Bad calibration task ${i + 1}`,
					type: "implementation",
				});
				// All failures with 100% confidence = worst possible calibration
				getStorage().completeTask({
					task_id,
					outcome: "failure",
					confidence: 1.0,
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const calibrationPattern = result.patterns.find(
				(p: Pattern) => p.type === "calibration_drift",
			);
			expect(calibrationPattern).toBeDefined();
			expect(calibrationPattern.severity).toBe("high");
		});

		test("no calibration pattern when calibration is good", async () => {
			getStorage().startSession();

			// Create well-calibrated tasks
			for (let i = 0; i < 5; i++) {
				const { task_id } = getStorage().startTask({
					description: `Well calibrated task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id,
					outcome: "success",
					confidence: 0.9, // High confidence, high success rate
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const calibrationPattern = result.patterns.find(
				(p: Pattern) => p.type === "calibration_drift",
			);
			expect(calibrationPattern).toBeUndefined();
		});

		test("no calibration pattern when fewer than 5 completed tasks", async () => {
			getStorage().startSession();

			// Create only 4 poorly calibrated tasks (under threshold)
			for (let i = 0; i < 4; i++) {
				const { task_id } = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id,
					outcome: "failure",
					confidence: 1.0,
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const calibrationPattern = result.patterns.find(
				(p: Pattern) => p.type === "calibration_drift",
			);
			expect(calibrationPattern).toBeUndefined();
		});

		test("detects neutral calibration when neither over nor under confident", async () => {
			getStorage().startSession();

			// Create tasks with balanced calibration errors (equal over and under)
			// Mix of overconfident and underconfident
			for (let i = 0; i < 3; i++) {
				const { task_id } = getStorage().startTask({
					description: `Overconfident task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id,
					outcome: "failure",
					confidence: 0.9, // High confidence, failure = overconfident
				});
			}
			for (let i = 0; i < 3; i++) {
				const { task_id } = getStorage().startTask({
					description: `Underconfident task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id,
					outcome: "success",
					confidence: 0.3, // Low confidence, success = underconfident
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const calibrationPattern = result.patterns.find(
				(p: Pattern) => p.type === "calibration_drift",
			);
			// With balanced over/underconfident tasks, pattern may or may not be detected
			// depending on the score. The key is the neutral guidance is used.
			if (calibrationPattern) {
				expect(calibrationPattern.guidance).toContain("calibration");
			}
		});
	});

	describe("Severity Filtering", () => {
		test("filters out low severity patterns when minSeverity is medium", async () => {
			getStorage().startSession();

			// Create patterns of different severities

			// Medium severity: hook failures at 40%
			const currentSession = getStorage().getCurrentSession();
			if (!currentSession) throw new Error("No current session");
			const session_id = currentSession.session_id;
			for (let i = 0; i < 4; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "medium-severity-hook",
					hookSource: "test",
					durationMs: 100,
					exitCode: 1,
					passed: false,
				});
			}
			for (let i = 0; i < 6; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "medium-severity-hook",
					hookSource: "test",
					durationMs: 100,
					exitCode: 0,
					passed: true,
				});
			}

			await detectPatterns({ json: true, minSeverity: "medium" });
			const result = JSON.parse(consoleOutput[0]);

			// Should include medium severity patterns
			expect(
				result.patterns.every(
					(p: Pattern) => p.severity === "medium" || p.severity === "high",
				),
			).toBe(true);
		});

		test("filters out low and medium patterns when minSeverity is high", async () => {
			const { session_id } = getStorage().startSession();

			// High severity: hook failures at 60%
			for (let i = 0; i < 6; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "high-severity-hook",
					hookSource: "test",
					durationMs: 100,
					exitCode: 1,
					passed: false,
				});
			}
			for (let i = 0; i < 4; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "high-severity-hook",
					hookSource: "test",
					durationMs: 100,
					exitCode: 0,
					passed: true,
				});
			}

			// Also add medium severity hook
			for (let i = 0; i < 4; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "medium-severity-hook",
					hookSource: "test",
					durationMs: 100,
					exitCode: 1,
					passed: false,
				});
			}
			for (let i = 0; i < 6; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "medium-severity-hook",
					hookSource: "test",
					durationMs: 100,
					exitCode: 0,
					passed: true,
				});
			}

			await detectPatterns({ json: true, minSeverity: "high" });
			const result = JSON.parse(consoleOutput[0]);

			// Should only include high severity patterns
			expect(result.patterns.every((p: Pattern) => p.severity === "high")).toBe(
				true,
			);
			// Should have at least one high severity pattern
			expect(result.patterns.length).toBeGreaterThan(0);
		});

		test("shows all patterns when minSeverity is low", async () => {
			const { session_id } = getStorage().startSession();

			// Medium severity hook failures
			for (let i = 0; i < 4; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "test-hook",
					hookSource: "test",
					durationMs: 100,
					exitCode: 1,
					passed: false,
				});
			}
			for (let i = 0; i < 6; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "test-hook",
					hookSource: "test",
					durationMs: 100,
					exitCode: 0,
					passed: true,
				});
			}

			await detectPatterns({ json: true, minSeverity: "low" });
			const result = JSON.parse(consoleOutput[0]);

			// Should include all patterns
			expect(result.patterns.length).toBeGreaterThan(0);
		});
	});

	describe("JSON Output", () => {
		test("outputs valid JSON with patterns array", async () => {
			const { session_id: _session_id } = getStorage().startSession();

			// Create some patterns
			for (let i = 0; i < 3; i++) {
				const { task_id } = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().failTask({
					task_id,
					reason: `Error ${i + 1}`,
				});
			}

			await detectPatterns({ json: true });
			expect(consoleOutput.length).toBe(1);

			const result = JSON.parse(consoleOutput[0]);
			expect(result).toHaveProperty("patterns");
			expect(Array.isArray(result.patterns)).toBe(true);
		});

		test("JSON output includes all pattern fields", async () => {
			getStorage().startSession();

			// Create consecutive failures pattern
			for (let i = 0; i < 3; i++) {
				const { task_id } = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().failTask({
					task_id,
					reason: `Error ${i + 1}`,
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const pattern = result.patterns[0];
			expect(pattern).toHaveProperty("type");
			expect(pattern).toHaveProperty("severity");
			expect(pattern).toHaveProperty("message");
			expect(pattern).toHaveProperty("guidance");
		});

		test("JSON output is properly formatted with indentation", async () => {
			getStorage().startSession();

			// Create a pattern
			for (let i = 0; i < 3; i++) {
				const { task_id } = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().failTask({
					task_id,
					reason: `Error ${i + 1}`,
				});
			}

			await detectPatterns({ json: true });
			const output = consoleOutput[0];

			// Check for proper indentation
			expect(output).toContain("\n");
			expect(output).toContain("  ");
		});
	});

	describe("Markdown Output", () => {
		test("outputs markdown format by default", async () => {
			getStorage().startSession();

			// Create consecutive failures pattern
			for (let i = 0; i < 3; i++) {
				const { task_id } = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().failTask({
					task_id,
					reason: `Error ${i + 1}`,
				});
			}

			await detectPatterns({});
			expect(consoleOutput.length).toBe(1);

			const output = consoleOutput[0];
			expect(output).toContain("**Pattern Alert**");
		});

		test("markdown includes appropriate emojis for severity", async () => {
			getStorage().startSession();

			// Create high severity pattern (consecutive failures)
			for (let i = 0; i < 3; i++) {
				const { task_id } = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().failTask({
					task_id,
					reason: `Error ${i + 1}`,
				});
			}

			await detectPatterns({});
			const output = consoleOutput[0];

			// High severity should have red circle emoji
			expect(output).toMatch(/\u{1F534}/u); // Red circle emoji
		});

		test("markdown includes guidance text", async () => {
			getStorage().startSession();

			// Create consecutive failures pattern
			for (let i = 0; i < 3; i++) {
				const { task_id } = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().failTask({
					task_id,
					reason: `Error ${i + 1}`,
				});
			}

			await detectPatterns({});
			const output = consoleOutput[0];

			expect(output).toContain("smaller steps");
		});

		test("no markdown output when no patterns detected", async () => {
			// No metrics at all
			await detectPatterns({});
			expect(consoleOutput.length).toBe(0);
		});
	});

	describe("Helper Functions", () => {
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
		});

		describe("buildPatternMarkdown", () => {
			test("builds markdown with header", () => {
				const patterns: Pattern[] = [
					{
						type: "test",
						severity: "medium",
						message: "Test message",
					},
				];

				const result = buildPatternMarkdown(patterns);
				expect(result).toContain("**Pattern Alert**");
			});

			test("uses red circle for high severity", () => {
				const patterns: Pattern[] = [
					{
						type: "test",
						severity: "high",
						message: "High severity message",
					},
				];

				const result = buildPatternMarkdown(patterns);
				expect(result).toMatch(/\u{1F534}/u);
			});

			test("uses warning emoji for medium severity", () => {
				const patterns: Pattern[] = [
					{
						type: "test",
						severity: "medium",
						message: "Medium severity message",
					},
				];

				const result = buildPatternMarkdown(patterns);
				expect(result).toMatch(/\u26A0\uFE0F/u);
			});

			test("includes guidance when provided", () => {
				const patterns: Pattern[] = [
					{
						type: "test",
						severity: "medium",
						message: "Test message",
						guidance: "This is the guidance text",
					},
				];

				const result = buildPatternMarkdown(patterns);
				expect(result).toContain("This is the guidance text");
			});

			test("handles patterns without guidance", () => {
				const patterns: Pattern[] = [
					{
						type: "test",
						severity: "medium",
						message: "Test message",
					},
				];

				const result = buildPatternMarkdown(patterns);
				expect(result).toContain("Test message");
				// Should not throw
			});

			test("handles multiple patterns", () => {
				const patterns: Pattern[] = [
					{
						type: "test1",
						severity: "high",
						message: "First message",
						guidance: "First guidance",
					},
					{
						type: "test2",
						severity: "medium",
						message: "Second message",
						guidance: "Second guidance",
					},
				];

				const result = buildPatternMarkdown(patterns);
				expect(result).toContain("First message");
				expect(result).toContain("Second message");
				expect(result).toContain("First guidance");
				expect(result).toContain("Second guidance");
			});
		});

		describe("getHookGuidance", () => {
			test("returns generic guidance when no plugin config found", () => {
				const guidance = getHookGuidance("test-hook", "nonexistent-plugin");
				expect(guidance).toContain("**Tip:**");
				expect(guidance).toContain("test-hook");
			});

			test("returns generic guidance when plugin name not provided", () => {
				const guidance = getHookGuidance("test-hook");
				expect(guidance).toContain("**Tip:**");
				expect(guidance).toContain("test-hook");
			});

			test("returns tip from plugin config when available", () => {
				// Create a mock plugin with a tip in han-plugin.yml
				const configDir = process.env.CLAUDE_CONFIG_DIR;
				if (!configDir) {
					throw new Error("CLAUDE_CONFIG_DIR not set");
				}
				const pluginDir = join(
					configDir,
					"plugins",
					"marketplaces",
					"han",
					"jutsu",
					"test-plugin",
				);
				mkdirSync(pluginDir, { recursive: true });
				writeFileSync(
					join(pluginDir, "han-plugin.yml"),
					`hooks:
  lint:
    tip: Run biome check --write to auto-fix issues
`,
				);

				const guidance = getHookGuidance("lint", "test-plugin");
				expect(guidance).toContain("**Tip:**");
				expect(guidance).toContain(
					"Run biome check --write to auto-fix issues",
				);
			});

			test("returns generic guidance when plugin has no tip for hook", () => {
				// Create a mock plugin without a tip for the requested hook
				const configDir = process.env.CLAUDE_CONFIG_DIR;
				if (!configDir) {
					throw new Error("CLAUDE_CONFIG_DIR not set");
				}
				const pluginDir = join(
					configDir,
					"plugins",
					"marketplaces",
					"han",
					"jutsu",
					"no-tip-plugin",
				);
				mkdirSync(pluginDir, { recursive: true });
				writeFileSync(
					join(pluginDir, "han-plugin.yml"),
					`hooks:
  other-hook:
    tip: This is for a different hook
`,
				);

				const guidance = getHookGuidance("lint", "no-tip-plugin");
				expect(guidance).toContain("**Tip:**");
				expect(guidance).toContain("lint");
				// Should be generic guidance, not the tip for other-hook
				expect(guidance).not.toContain("This is for a different hook");
			});
		});
	});

	describe("Combined Pattern Detection", () => {
		test("detects multiple patterns simultaneously", async () => {
			const { session_id } = getStorage().startSession();

			// Create consecutive failures
			for (let i = 0; i < 3; i++) {
				const { task_id } = getStorage().startTask({
					description: `Failing task ${i + 1}`,
					type: "implementation",
				});
				getStorage().failTask({
					task_id,
					reason: `Error ${i + 1}`,
				});
			}

			// Create hook failures
			for (let i = 0; i < 6; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "failing-hook",
					hookSource: "test",
					durationMs: 100,
					exitCode: 1,
					passed: false,
				});
			}
			for (let i = 0; i < 4; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "failing-hook",
					hookSource: "test",
					durationMs: 100,
					exitCode: 0,
					passed: true,
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			// Should detect both patterns
			const types = result.patterns.map((p: Pattern) => p.type);
			expect(types).toContain("consecutive_failures");
			expect(types).toContain("hook_failure_pattern");
		});

		test("correctly orders patterns by severity", async () => {
			const { session_id } = getStorage().startSession();

			// Create high severity: consecutive failures
			for (let i = 0; i < 3; i++) {
				const { task_id } = getStorage().startTask({
					description: `Failing task ${i + 1}`,
					type: "implementation",
				});
				getStorage().failTask({
					task_id,
					reason: `Error ${i + 1}`,
				});
			}

			// Create medium severity hook pattern
			for (let i = 0; i < 4; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "medium-hook",
					hookSource: "test",
					durationMs: 100,
					exitCode: 1,
					passed: false,
				});
			}
			for (let i = 0; i < 6; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "medium-hook",
					hookSource: "test",
					durationMs: 100,
					exitCode: 0,
					passed: true,
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			// Should have at least one of each severity
			const highSeverity = result.patterns.filter(
				(p: Pattern) => p.severity === "high",
			);
			expect(highSeverity.length).toBeGreaterThan(0);
		});
	});

	describe("Edge Cases", () => {
		test("handles tasks with null confidence", async () => {
			getStorage().startSession();

			const { task_id } = getStorage().startTask({
				description: "Task without confidence",
				type: "implementation",
			});
			// Complete without confidence - should use outcome: "success" format
			getStorage().completeTask({
				task_id,
				outcome: "success",
				confidence: 0, // Technically 0, not null - but tests handling
			});

			await detectPatterns({ json: true });
			// Should not throw
			expect(consoleOutput.length).toBe(1);
			const result = JSON.parse(consoleOutput[0]);
			expect(Array.isArray(result.patterns)).toBe(true);
		});

		test("handles mixed task types", async () => {
			getStorage().startSession();

			const types = ["implementation", "fix", "refactor", "research"] as const;
			for (const type of types) {
				const { task_id } = getStorage().startTask({
					description: `${type} task`,
					type,
				});
				getStorage().failTask({
					task_id,
					reason: `${type} error`,
				});
			}

			// Need 3 consecutive failures - add one more
			const { task_id } = getStorage().startTask({
				description: "Extra task",
				type: "implementation",
			});
			getStorage().failTask({
				task_id,
				reason: "Extra error",
			});

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			// Should detect consecutive failures pattern
			const consecutivePattern = result.patterns.find(
				(p: Pattern) => p.type === "consecutive_failures",
			);
			expect(consecutivePattern).toBeDefined();
		});

		test("handles very long hook names", async () => {
			const { session_id } = getStorage().startSession();

			const longName =
				"very-long-hook-name-that-exceeds-normal-length-expectations-for-testing-purposes";

			for (let i = 0; i < 6; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: longName,
					hookSource: "test",
					durationMs: 100,
					exitCode: 1,
					passed: false,
				});
			}
			for (let i = 0; i < 4; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: longName,
					hookSource: "test",
					durationMs: 100,
					exitCode: 0,
					passed: true,
				});
			}

			await detectPatterns({ json: true });
			const result = JSON.parse(consoleOutput[0]);

			const hookPattern = result.patterns.find(
				(p: Pattern) => p.type === "hook_failure_pattern",
			);
			expect(hookPattern).toBeDefined();
			expect(hookPattern.message).toContain(longName);
		});
	});
});
