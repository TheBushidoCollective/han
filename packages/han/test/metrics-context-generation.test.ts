import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { JsonlMetricsStorage } from "../lib/metrics/jsonl-storage.ts";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

let storage: JsonlMetricsStorage | null = null;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	const testDir = join(tmpdir(), `han-metrics-test-${Date.now()}-${random}`);
	process.env.CLAUDE_CONFIG_DIR = testDir;
	storage = new JsonlMetricsStorage();
}

function getStorage(): JsonlMetricsStorage {
	if (!storage) {
		throw new Error("Storage not initialized - call setup() first");
	}
	return storage;
}

function teardown(): void {
	if (storage) {
		storage.close();
		storage = null;
	}
	if (process.env.CLAUDE_CONFIG_DIR) {
		try {
			rmSync(process.env.CLAUDE_CONFIG_DIR, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
		delete process.env.CLAUDE_CONFIG_DIR;
	}
}

function generateContext(): string {
	try {
		const mainPath = join(__dirname, "..", "lib", "main.ts");
		const output = execSync(`bun run ${mainPath} metrics session-context`, {
			cwd: join(__dirname, ".."),
			env: process.env,
			encoding: "utf-8",
		});
		return output.trim();
	} catch {
		return "";
	}
}

describe("Metrics Context Generation", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("Empty Data Handling", () => {
		test("generates getting started message with no data", () => {
			const context = generateContext();
			expect(context).toContain("Getting Started");
			expect(context).toContain("No tasks tracked yet");
			expect(context).toContain("start_task()");
		});
	});

	describe("Performance Scorecard", () => {
		test("generates performance scorecard with task data", () => {
			getStorage().startSession();

			for (let i = 0; i < 8; i++) {
				const task = getStorage().startTask({
					description: `Success task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.85,
				});
			}

			for (let i = 0; i < 2; i++) {
				const task = getStorage().startTask({
					description: `Failed task ${i + 1}`,
					type: "fix",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.9,
				});
			}

			const context = generateContext();

			expect(context).toContain("Your Recent Performance");
			expect(context).toContain("10 completed");
			expect(context).toContain("80%");
			expect(context).toContain("Calibration Score");
		});

		test("includes calibration emoji indicators", () => {
			getStorage().startSession();

			for (let i = 0; i < 5; i++) {
				const task = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.9,
				});
			}

			const context = generateContext();
			expect(context.includes("🎯") || context.includes("📈")).toBe(true);
		});
	});

	describe("Task Type Performance", () => {
		test("identifies best task type", () => {
			getStorage().startSession();

			for (let i = 0; i < 5; i++) {
				const task = getStorage().startTask({
					description: `Fix task ${i + 1}`,
					type: "fix",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.9,
				});
			}

			for (let i = 0; i < 2; i++) {
				const task = getStorage().startTask({
					description: `Impl task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.85,
				});
			}

			const failTask = getStorage().startTask({
				description: "Failed impl",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id: failTask.task_id,
				outcome: "failure",
				confidence: 0.8,
			});

			const context = generateContext();

			expect(context).toContain("Best at");
			expect(context).toContain("fix");
			expect(context).toContain("100%");
		});

		test("identifies weakest task type", () => {
			getStorage().startSession();

			for (let i = 0; i < 5; i++) {
				const task = getStorage().startTask({
					description: `Fix task ${i + 1}`,
					type: "fix",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.9,
				});
			}

			const refactorSuccess = getStorage().startTask({
				description: "Refactor success",
				type: "refactor",
			});
			getStorage().completeTask({
				task_id: refactorSuccess.task_id,
				outcome: "success",
				confidence: 0.8,
			});

			for (let i = 0; i < 2; i++) {
				const task = getStorage().startTask({
					description: `Refactor fail ${i + 1}`,
					type: "refactor",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.85,
				});
			}

			const context = generateContext();

			expect(context).toContain("Needs improvement");
			expect(context).toContain("refactor");
			expect(context).toContain("33%");
		});

		test("requires minimum 3 tasks for task type analysis", () => {
			getStorage().startSession();

			for (let i = 0; i < 2; i++) {
				const task = getStorage().startTask({
					description: `Fix task ${i + 1}`,
					type: "fix",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.9,
				});
			}

			for (let i = 0; i < 3; i++) {
				const task = getStorage().startTask({
					description: `Impl task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.85,
				});
			}

			const context = generateContext();

			expect(context.includes("Best at: `fix`")).toBe(false);
			expect(context).toContain("implementation");
		});
	});

	describe("Hook Failure Patterns", () => {
		test("includes hook failure section when hooks fail", () => {
			const { session_id } = getStorage().startSession();

			const task = getStorage().startTask({
				description: "Test task",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "success",
				confidence: 0.9,
			});

			for (let i = 0; i < 3; i++) {
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
					durationMs: 800,
					exitCode: 0,
					passed: true,
				});
			}

			const context = generateContext();

			expect(context).toContain("Common Hook Failures");
			expect(context).toContain("typescript-typecheck");
			expect(context).toContain("60%");
			expect(context).toContain("jutsu-typescript");
		});

		test("provides hook-specific guidance for known hooks", () => {
			const { session_id } = getStorage().startSession();

			const task = getStorage().startTask({
				description: "Test task",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "success",
				confidence: 0.9,
			});

			for (let i = 0; i < 4; i++) {
				getStorage().recordHookExecution({
					sessionId: session_id,
					hookType: "Stop",
					hookName: "typescript-typecheck",
					hookSource: "jutsu-typescript",
					durationMs: 1000,
					exitCode: 1,
					passed: false,
				});
			}

			getStorage().recordHookExecution({
				sessionId: session_id,
				hookType: "Stop",
				hookName: "typescript-typecheck",
				hookSource: "jutsu-typescript",
				durationMs: 800,
				exitCode: 0,
				passed: true,
			});

			const context = generateContext();

			expect(context).toContain("TypeScript Tip");
			expect(context).toContain("npx -y --package typescript tsc");
		});

		test("omits hook section when no failures", () => {
			const { session_id } = getStorage().startSession();

			const task = getStorage().startTask({
				description: "Test task",
				type: "implementation",
			});
			getStorage().completeTask({
				task_id: task.task_id,
				outcome: "success",
				confidence: 0.9,
			});

			for (let i = 0; i < 5; i++) {
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

			const context = generateContext();
			expect(context.includes("Common Hook Failures")).toBe(false);
		});
	});

	describe("Calibration Guidance", () => {
		test("provides overconfident calibration guidance", () => {
			getStorage().startSession();

			for (let i = 0; i < 5; i++) {
				const task = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "failure",
					confidence: 0.95,
				});
			}

			const context = generateContext();

			expect(context).toContain("Calibration Tips");
			expect(context).toContain("overconfident");
			expect(context.includes("conservative") || context.includes("0.7")).toBe(
				true,
			);
		});

		test("provides underconfident calibration guidance", () => {
			getStorage().startSession();

			for (let i = 0; i < 5; i++) {
				const task = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "fix",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.5,
				});
			}

			const context = generateContext();

			expect(context).toContain("Calibration Tips");
			expect(context).toContain("underconfident");
			expect(context.includes("Trust") || context.includes("0.8")).toBe(true);
		});

		test("omits calibration tips when score is good", () => {
			getStorage().startSession();

			for (let i = 0; i < 5; i++) {
				const task = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.85,
				});
			}

			const context = generateContext();
			expect(context.includes("Calibration Tips")).toBe(false);
		});
	});

	describe("Markdown Formatting", () => {
		test("generates valid markdown", () => {
			getStorage().startSession();

			for (let i = 0; i < 3; i++) {
				const task = getStorage().startTask({
					description: `Task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.85,
				});
			}

			const context = generateContext();

			expect(context).toContain("##");
			expect(context).toContain("**");
			expect(context).toContain("-");
		});

		test("uses backticks for code elements", () => {
			getStorage().startSession();

			for (let i = 0; i < 3; i++) {
				const task = getStorage().startTask({
					description: `Implementation task ${i + 1}`,
					type: "implementation",
				});
				getStorage().completeTask({
					task_id: task.task_id,
					outcome: "success",
					confidence: 0.9,
				});
			}

			const context = generateContext();
			expect(context).toContain("`implementation`");
		});
	});
});
