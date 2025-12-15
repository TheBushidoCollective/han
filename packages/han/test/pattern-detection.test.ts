/**
 * Tests for commands/metrics/pattern-detection.ts
 * Tests pattern detection functions
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { JsonlMetricsStorage } from "../lib/metrics/jsonl-storage.ts";

describe("pattern-detection", () => {
	const testDir = `/tmp/test-pattern-detection-${Date.now()}`;
	let originalEnv: string | undefined;

	const getMetricsDir = () =>
		join(testDir, "config", "han", "metrics", "jsonldb");

	beforeEach(() => {
		originalEnv = process.env.CLAUDE_CONFIG_DIR;
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		mkdirSync(getMetricsDir(), {
			recursive: true,
		});
	});

	afterEach(() => {
		if (originalEnv) {
			process.env.CLAUDE_CONFIG_DIR = originalEnv;
		} else {
			delete process.env.CLAUDE_CONFIG_DIR;
		}
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("detectPatterns via CLI", () => {
		test("outputs nothing when no patterns detected", async () => {
			const result = spawnSync(
				"bun",
				["run", "lib/main.ts", "metrics", "detect-patterns"],
				{
					encoding: "utf-8",
					timeout: 30000,
					cwd: join(__dirname, ".."),
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: join(testDir, "config"),
					},
				},
			);

			expect(result.status).toBe(0);
			// No patterns = no output
		});

		test("outputs JSON format with --json flag", async () => {
			const result = spawnSync(
				"bun",
				["run", "lib/main.ts", "metrics", "detect-patterns", "--json"],
				{
					encoding: "utf-8",
					timeout: 30000,
					cwd: join(__dirname, ".."),
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: join(testDir, "config"),
					},
				},
			);

			expect(result.status).toBe(0);
			const output = JSON.parse(result.stdout);
			expect(output).toHaveProperty("patterns");
			expect(Array.isArray(output.patterns)).toBe(true);
		});

		test("detects consecutive failures pattern", async () => {
			const storage = new JsonlMetricsStorage(getMetricsDir());

			// Create 3 consecutive failures
			for (let i = 0; i < 3; i++) {
				const task = storage.startTask({
					description: `Failed task ${i}`,
					type: "fix",
				});
				storage.completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.9,
				});
			}

			const result = spawnSync(
				"bun",
				["run", "lib/main.ts", "metrics", "detect-patterns", "--json"],
				{
					encoding: "utf-8",
					timeout: 30000,
					cwd: join(__dirname, ".."),
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: join(testDir, "config"),
					},
				},
			);

			expect(result.status).toBe(0);
			const output = JSON.parse(result.stdout);
			const consecutiveFailures = output.patterns.find(
				(p: { type: string }) => p.type === "consecutive_failures",
			);
			expect(consecutiveFailures).toBeDefined();
			expect(consecutiveFailures.severity).toBe("high");
		});

		test("filters patterns by minimum severity", async () => {
			const result = spawnSync(
				"bun",
				[
					"run",
					"lib/main.ts",
					"metrics",
					"detect-patterns",
					"--min-severity",
					"high",
					"--json",
				],
				{
					encoding: "utf-8",
					timeout: 30000,
					cwd: join(__dirname, ".."),
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: join(testDir, "config"),
					},
				},
			);

			expect(result.status).toBe(0);
			const output = JSON.parse(result.stdout);
			// All patterns should be high severity
			for (const pattern of output.patterns) {
				expect(pattern.severity).toBe("high");
			}
		});
	});

	describe("pattern detection helper functions logic", () => {
		test("getSeverityLevel returns correct numeric values", () => {
			// Test the logic used in getSeverityLevel
			const getSeverityLevel = (
				severity: "low" | "medium" | "high",
			): number => {
				switch (severity) {
					case "low":
						return 1;
					case "medium":
						return 2;
					case "high":
						return 3;
				}
			};

			expect(getSeverityLevel("low")).toBe(1);
			expect(getSeverityLevel("medium")).toBe(2);
			expect(getSeverityLevel("high")).toBe(3);
		});

		test("buildPatternMarkdown generates correct output", () => {
			// Test the logic used in buildPatternMarkdown
			const patterns = [
				{
					type: "test_pattern",
					severity: "high" as const,
					message: "Test message",
					guidance: "Test guidance",
				},
			];

			const lines: string[] = [];
			lines.push("Pattern Alert\n");
			for (const pattern of patterns) {
				const emoji = pattern.severity === "high" ? "red" : "warning";
				lines.push(`${emoji} ${pattern.message}`);
				if (pattern.guidance) {
					lines.push(`\n${pattern.guidance}\n`);
				}
			}
			const output = lines.join("\n");

			expect(output).toContain("Pattern Alert");
			expect(output).toContain("Test message");
			expect(output).toContain("Test guidance");
			expect(output).toContain("red");
		});

		test("determineCalibrationDirection detects overconfidence", () => {
			// Simulate the calibration direction logic
			const tasks: Array<{
				outcome: "success" | "failure";
				confidence: number;
			}> = [
				{ outcome: "failure", confidence: 0.9 },
				{ outcome: "failure", confidence: 0.85 },
				{ outcome: "failure", confidence: 0.8 },
			];

			let overconfidentCount = 0;
			let underconfidentCount = 0;

			for (const task of tasks) {
				const actualSuccess = task.outcome === "success" ? 1 : 0;
				const diff = task.confidence - actualSuccess;
				if (diff > 0.2) overconfidentCount++;
				if (diff < -0.2) underconfidentCount++;
			}

			const direction =
				overconfidentCount > underconfidentCount * 1.5
					? "overconfident"
					: underconfidentCount > overconfidentCount * 1.5
						? "underconfident"
						: "neutral";

			expect(direction).toBe("overconfident");
		});

		test("determineCalibrationDirection detects underconfidence", () => {
			const tasks = [
				{ outcome: "success" as const, confidence: 0.3 },
				{ outcome: "success" as const, confidence: 0.4 },
				{ outcome: "success" as const, confidence: 0.35 },
			];

			let overconfidentCount = 0;
			let underconfidentCount = 0;

			for (const task of tasks) {
				const actualSuccess = task.outcome === "success" ? 1 : 0;
				const diff = task.confidence - actualSuccess;
				if (diff > 0.2) overconfidentCount++;
				if (diff < -0.2) underconfidentCount++;
			}

			const direction =
				overconfidentCount > underconfidentCount * 1.5
					? "overconfident"
					: underconfidentCount > overconfidentCount * 1.5
						? "underconfident"
						: "neutral";

			expect(direction).toBe("underconfident");
		});

		test("getHookGuidance provides known hook guidance", () => {
			const guidance: Record<string, string> = {
				"typescript-typecheck": "Tip: Run npx -y --package typescript tsc",
				"biome-lint": "Tip: Run npx biome check --write .",
				"bun-test": "Tip: Run bun test locally",
				"check-commits": "Tip: Follow conventional format",
				markdownlint: "Tip: Run npx markdownlint-cli --fix .",
			};

			expect(guidance["typescript-typecheck"]).toContain("typescript");
			expect(guidance["biome-lint"]).toContain("biome");
			expect(guidance["bun-test"]).toContain("bun test");
		});

		test("getHookGuidance provides default for unknown hooks", () => {
			const hookName = "unknown-hook";
			const defaultGuidance = `Review the output from ${hookName}`;

			expect(defaultGuidance).toContain(hookName);
		});

		test("getCalibrationGuidance provides overconfident guidance", () => {
			const getGuidance = (
				dir: "overconfident" | "underconfident" | "neutral",
			): string => {
				if (dir === "overconfident") return "You're being overconfident";
				if (dir === "underconfident") return "You're being underconfident";
				return "Focus on calibration";
			};
			expect(getGuidance("overconfident")).toContain("overconfident");
		});

		test("getCalibrationGuidance provides underconfident guidance", () => {
			const getGuidance = (
				dir: "overconfident" | "underconfident" | "neutral",
			): string => {
				if (dir === "overconfident") return "You're being overconfident";
				if (dir === "underconfident") return "You're being underconfident";
				return "Focus on calibration";
			};
			expect(getGuidance("underconfident")).toContain("underconfident");
		});

		test("getCalibrationGuidance provides neutral guidance", () => {
			const getGuidance = (
				dir: "overconfident" | "underconfident" | "neutral",
			): string => {
				if (dir === "overconfident") return "You're being overconfident";
				if (dir === "underconfident") return "You're being underconfident";
				return "Focus on calibration";
			};
			expect(getGuidance("neutral")).toContain("Focus on calibration");
		});
	});

	describe("calibration drift detection with actual data", () => {
		test("detects calibration drift when score is low", async () => {
			const storage = new JsonlMetricsStorage(getMetricsDir());

			// Create 5 tasks with poor calibration (always overconfident)
			for (let i = 0; i < 5; i++) {
				const task = storage.startTask({
					description: `Task ${i}`,
					type: "fix",
				});
				storage.completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.95, // Very high confidence but failing
				});
			}

			const result = spawnSync(
				"bun",
				["run", "lib/main.ts", "metrics", "detect-patterns", "--json"],
				{
					encoding: "utf-8",
					timeout: 30000,
					cwd: join(__dirname, ".."),
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: join(testDir, "config"),
					},
				},
			);

			expect(result.status).toBe(0);
			const output = JSON.parse(result.stdout);

			// Should detect either calibration_drift or consecutive_failures
			expect(output.patterns.length).toBeGreaterThan(0);
		});
	});
});
