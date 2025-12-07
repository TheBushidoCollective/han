import { ok } from "node:assert";
import { execSync } from "node:child_process";
import { rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { MetricsStorage } from "../lib/metrics/storage.js";

let testsPassed = 0;
let testsFailed = 0;
let storage: MetricsStorage | null = null;
let _testDbPath: string;

async function test(
	name: string,
	fn: () => void | Promise<void>,
): Promise<void> {
	try {
		await fn();
		console.log(`✓ ${name}`);
		testsPassed++;
	} catch (error) {
		console.error(`✗ ${name}`);
		console.error(`  ${(error as Error).message}`);
		testsFailed++;
	}
}

function setup(): void {
	// Create test database in temp directory
	const testDir = join(tmpdir(), `han-metrics-test-${Date.now()}`);
	process.env.CLAUDE_CONFIG_DIR = testDir;
	_testDbPath = join(testDir, "metrics", "metrics.db");

	storage = new MetricsStorage();
}

function getStorage(): MetricsStorage {
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

	// Clean up test database
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
		const output = execSync("npx tsx ../lib/main.ts metrics session-context", {
			cwd: join(__dirname, ".."),
			env: process.env,
			encoding: "utf-8",
		});
		return output.trim();
	} catch (error) {
		console.error("Context generation failed:", error);
		return "";
	}
}

// ========== Empty Data Handling ==========

await test("generates getting started message with no data", () => {
	setup();

	const context = generateContext();

	ok(context.includes("Getting Started"), "Should have getting started header");
	ok(
		context.includes("No tasks tracked yet"),
		"Should mention no tasks tracked",
	);
	ok(context.includes("start_task()"), "Should mention how to start tracking");

	teardown();
});

// ========== Performance Scorecard ==========

await test("generates performance scorecard with task data", () => {
	setup();
	getStorage().startSession();

	// Create 8 successful tasks and 2 failed tasks (80% success rate)
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

	ok(
		context.includes("Your Recent Performance"),
		"Should have performance header",
	);
	ok(context.includes("10 completed"), "Should show task count");
	ok(context.includes("80%"), "Should show success rate");
	ok(context.includes("Calibration Score"), "Should include calibration score");

	teardown();
});

await test("includes calibration emoji indicators", () => {
	setup();
	getStorage().startSession();

	// Create tasks with perfect calibration (85% score)
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

	ok(
		context.includes("🎯") || context.includes("📈"),
		"Should include positive calibration emoji for good score",
	);

	teardown();
});

// ========== Task Type Performance ==========

await test("identifies best task type", () => {
	setup();
	getStorage().startSession();

	// Create 5 successful fix tasks
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

	// Create 3 implementation tasks with 1 failure
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

	ok(context.includes("Best at"), "Should identify best task type");
	ok(context.includes("fix"), "Should identify 'fix' as best type");
	ok(context.includes("100%"), "Should show 100% success for fix tasks");

	teardown();
});

await test("identifies weakest task type", () => {
	setup();
	getStorage().startSession();

	// Create 5 successful fix tasks
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

	// Create 3 refactor tasks with 2 failures (33% success)
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

	ok(
		context.includes("Needs improvement"),
		"Should identify weakest task type",
	);
	ok(context.includes("refactor"), "Should identify 'refactor' as weakest");
	ok(context.includes("33%"), "Should show 33% success for refactor tasks");

	teardown();
});

await test("requires minimum 3 tasks for task type analysis", () => {
	setup();
	getStorage().startSession();

	// Create only 2 fix tasks (not enough for analysis)
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

	// Create 3 implementation tasks
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

	// Should only show implementation (has 3+ tasks), not fix (only 2)
	ok(
		!context.includes("Best at: `fix`"),
		"Should not analyze task types with <3 tasks",
	);
	ok(context.includes("implementation"), "Should analyze types with 3+ tasks");

	teardown();
});

// ========== Hook Failure Patterns ==========

await test("includes hook failure section when hooks fail", () => {
	setup();
	const { session_id } = getStorage().startSession();

	// Create some tasks to avoid empty state
	const task = getStorage().startTask({
		description: "Test task",
		type: "implementation",
	});
	getStorage().completeTask({
		task_id: task.task_id,
		outcome: "success",
		confidence: 0.9,
	});

	// Record hook failures (>20% failure rate to show up)
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

	ok(
		context.includes("Common Hook Failures"),
		"Should have hook failures section",
	);
	ok(
		context.includes("typescript-typecheck"),
		"Should mention failing hook name",
	);
	ok(context.includes("60%"), "Should show failure rate");
	ok(context.includes("jutsu-typescript"), "Should show hook source/plugin");

	teardown();
});

await test("provides hook-specific guidance for known hooks", () => {
	setup();
	const { session_id } = getStorage().startSession();

	// Create a task to avoid empty state
	const task = getStorage().startTask({
		description: "Test task",
		type: "implementation",
	});
	getStorage().completeTask({
		task_id: task.task_id,
		outcome: "success",
		confidence: 0.9,
	});

	// Record typescript-typecheck failures
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

	ok(
		context.includes("TypeScript Tip"),
		"Should include TypeScript-specific guidance",
	);
	ok(
		context.includes("npx tsc --noEmit"),
		"Should include specific command guidance",
	);

	teardown();
});

await test("omits hook section when no failures", () => {
	setup();
	const { session_id } = getStorage().startSession();

	// Create task
	const task = getStorage().startTask({
		description: "Test task",
		type: "implementation",
	});
	getStorage().completeTask({
		task_id: task.task_id,
		outcome: "success",
		confidence: 0.9,
	});

	// Record only successful hooks
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

	ok(
		!context.includes("Common Hook Failures"),
		"Should not include hook section when all hooks pass",
	);

	teardown();
});

// ========== Calibration Guidance ==========

await test("provides overconfident calibration guidance", () => {
	setup();
	getStorage().startSession();

	// Create tasks showing overconfidence (high confidence + failures)
	for (let i = 0; i < 5; i++) {
		const task = getStorage().startTask({
			description: `Task ${i + 1}`,
			type: "implementation",
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "failure",
			confidence: 0.95, // Very high confidence but failing
		});
	}

	const context = generateContext();

	ok(
		context.includes("Calibration Tips"),
		"Should include calibration tips section",
	);
	ok(
		context.includes("overconfident"),
		"Should identify overconfidence pattern",
	);
	ok(
		context.includes("conservative") || context.includes("0.7"),
		"Should recommend being more conservative",
	);

	teardown();
});

await test("provides underconfident calibration guidance", () => {
	setup();
	getStorage().startSession();

	// Create tasks showing underconfidence (low confidence + successes)
	for (let i = 0; i < 5; i++) {
		const task = getStorage().startTask({
			description: `Task ${i + 1}`,
			type: "fix",
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "success",
			confidence: 0.5, // Low confidence but succeeding
		});
	}

	const context = generateContext();

	ok(
		context.includes("Calibration Tips"),
		"Should include calibration tips section",
	);
	ok(
		context.includes("underconfident"),
		"Should identify underconfidence pattern",
	);
	ok(
		context.includes("Trust") || context.includes("0.8"),
		"Should encourage more confidence",
	);

	teardown();
});

await test("omits calibration tips when score is good", () => {
	setup();
	getStorage().startSession();

	// Create tasks with good calibration
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

	ok(
		!context.includes("Calibration Tips"),
		"Should not include tips when calibration is good (>=60%)",
	);

	teardown();
});

// ========== Markdown Formatting ==========

await test("generates valid markdown", () => {
	setup();
	getStorage().startSession();

	// Create some tasks
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

	// Check for markdown elements
	ok(context.includes("##"), "Should have level 2 headers");
	ok(context.includes("**"), "Should have bold text");
	ok(context.includes("-"), "Should have list items");

	teardown();
});

await test("uses backticks for code elements", () => {
	setup();
	getStorage().startSession();

	// Create tasks with different types
	const task1 = getStorage().startTask({
		description: "Task 1",
		type: "implementation",
	});
	getStorage().completeTask({
		task_id: task1.task_id,
		outcome: "success",
		confidence: 0.9,
	});

	const task2 = getStorage().startTask({ description: "Task 2", type: "fix" });
	getStorage().completeTask({
		task_id: task2.task_id,
		outcome: "success",
		confidence: 0.85,
	});

	const task3 = getStorage().startTask({
		description: "Task 3",
		type: "refactor",
	});
	getStorage().completeTask({
		task_id: task3.task_id,
		outcome: "success",
		confidence: 0.8,
	});

	const context = generateContext();

	ok(
		context.includes("`implementation`") ||
			context.includes("`fix`") ||
			context.includes("`refactor`"),
		"Should use backticks for task types",
	);

	teardown();
});

// ========== Summary ==========

console.log(`\n${"=".repeat(50)}`);
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log("=".repeat(50));

process.exit(testsFailed > 0 ? 1 : 0);
