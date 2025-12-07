import { ok, strictEqual } from "node:assert";
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

function detectPatterns(minSeverity?: "low" | "medium" | "high"): Array<{
	type: string;
	severity: string;
	message: string;
	guidance: string;
}> {
	const cmd = minSeverity
		? `npx tsx ../lib/main.ts metrics detect-patterns --min-severity ${minSeverity} --json`
		: "npx tsx ../lib/main.ts metrics detect-patterns --json";

	try {
		const output = execSync(cmd, {
			cwd: join(__dirname, ".."),
			env: process.env,
			encoding: "utf-8",
		});
		return JSON.parse(output);
	} catch (error) {
		console.error("Pattern detection failed:", error);
		return [];
	}
}

// ========== Consecutive Failure Detection ==========

await test("detects consecutive failures (high severity)", () => {
	setup();
	getStorage().startSession();

	// Create 3 consecutive failures
	for (let i = 0; i < 3; i++) {
		const task = getStorage().startTask({
			description: `Task ${i + 1}`,
			type: "implementation",
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "failure",
			confidence: 0.8,
		});
	}

	const patterns = detectPatterns();

	ok(patterns.length > 0, "Should detect at least one pattern");
	const consecutiveFailure = patterns.find(
		(p) => p.type === "consecutive_failures",
	);
	ok(consecutiveFailure, "Should detect consecutive failures pattern");
	strictEqual(consecutiveFailure?.severity, "high", "Should be high severity");
	ok(
		consecutiveFailure?.message.includes("Last 3 tasks"),
		"Should mention 3 tasks",
	);

	teardown();
});

await test("does not detect consecutive failures with success", () => {
	setup();
	getStorage().startSession();

	// Create 2 failures and 1 success
	const task1 = getStorage().startTask({ description: "Task 1", type: "fix" });
	getStorage().completeTask({
		task_id: task1.task_id,
		outcome: "failure",
		confidence: 0.7,
	});

	const task2 = getStorage().startTask({ description: "Task 2", type: "fix" });
	getStorage().completeTask({
		task_id: task2.task_id,
		outcome: "success",
		confidence: 0.9,
	});

	const task3 = getStorage().startTask({ description: "Task 3", type: "fix" });
	getStorage().completeTask({
		task_id: task3.task_id,
		outcome: "failure",
		confidence: 0.6,
	});

	const patterns = detectPatterns();

	const consecutiveFailure = patterns.find(
		(p) => p.type === "consecutive_failures",
	);
	strictEqual(
		consecutiveFailure,
		undefined,
		"Should not detect pattern with success in between",
	);

	teardown();
});

// ========== Hook Failure Pattern Detection ==========

await test("detects high hook failure rate (>50%)", () => {
	setup();
	const { session_id } = getStorage().startSession();

	// Create 6 failures and 2 successes (75% failure rate)
	for (let i = 0; i < 6; i++) {
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

	const patterns = detectPatterns();

	const hookPattern = patterns.find((p) => p.type === "hook_failures");
	ok(hookPattern, "Should detect hook failure pattern");
	strictEqual(
		hookPattern?.severity,
		"high",
		"Should be high severity for >50%",
	);
	ok(
		hookPattern?.message.includes("typescript-typecheck"),
		"Should mention hook name",
	);
	ok(hookPattern?.message.includes("75%"), "Should mention failure rate");

	teardown();
});

await test("detects medium hook failure rate (30-50%)", () => {
	setup();
	const { session_id } = getStorage().startSession();

	// Create 4 failures and 6 successes (40% failure rate)
	for (let i = 0; i < 4; i++) {
		getStorage().recordHookExecution({
			sessionId: session_id,
			hookType: "Stop",
			hookName: "biome-lint",
			hookSource: "jutsu-biome",
			durationMs: 500,
			exitCode: 1,
			passed: false,
			error: "Linting error",
		});
	}

	for (let i = 0; i < 6; i++) {
		getStorage().recordHookExecution({
			sessionId: session_id,
			hookType: "Stop",
			hookName: "biome-lint",
			hookSource: "jutsu-biome",
			durationMs: 450,
			exitCode: 0,
			passed: true,
		});
	}

	const patterns = detectPatterns();

	const hookPattern = patterns.find((p) => p.type === "hook_failures");
	ok(hookPattern, "Should detect hook failure pattern");
	strictEqual(
		hookPattern?.severity,
		"medium",
		"Should be medium severity for 30-50%",
	);
	ok(hookPattern?.message.includes("40%"), "Should mention failure rate");

	teardown();
});

await test("filters patterns by minimum severity", () => {
	setup();
	const { session_id } = getStorage().startSession();

	// Create medium severity hook pattern (40% failure rate)
	for (let i = 0; i < 4; i++) {
		getStorage().recordHookExecution({
			sessionId: session_id,
			hookType: "Stop",
			hookName: "test-hook",
			hookSource: "core",
			durationMs: 500,
			exitCode: 1,
			passed: false,
		});
	}

	for (let i = 0; i < 6; i++) {
		getStorage().recordHookExecution({
			sessionId: session_id,
			hookType: "Stop",
			hookName: "test-hook",
			hookSource: "core",
			durationMs: 450,
			exitCode: 0,
			passed: true,
		});
	}

	// Filter for high severity only
	const highPatterns = detectPatterns("high");
	const hookPattern = highPatterns.find((p) => p.type === "hook_failures");
	strictEqual(
		hookPattern,
		undefined,
		"Should not include medium severity when filtering for high",
	);

	// Filter for medium severity
	const mediumPatterns = detectPatterns("medium");
	const mediumHookPattern = mediumPatterns.find(
		(p) => p.type === "hook_failures",
	);
	ok(
		mediumHookPattern,
		"Should include medium severity when filtering for medium",
	);

	teardown();
});

// ========== Calibration Drift Detection ==========

await test("detects high calibration drift (<30%)", () => {
	setup();
	getStorage().startSession();

	// Create tasks with poor calibration (high confidence + failures)
	for (let i = 0; i < 5; i++) {
		const task = getStorage().startTask({
			description: `Task ${i + 1}`,
			type: "implementation",
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "failure",
			confidence: 0.9, // High confidence but failing
		});
	}

	const patterns = detectPatterns();

	const calibrationPattern = patterns.find(
		(p) => p.type === "calibration_drift",
	);
	ok(calibrationPattern, "Should detect calibration drift");
	strictEqual(
		calibrationPattern?.severity,
		"high",
		"Should be high severity for <30%",
	);
	ok(
		calibrationPattern?.guidance.includes("overconfident") ||
			calibrationPattern?.guidance.includes("calibration"),
		"Should provide calibration guidance",
	);

	teardown();
});

await test("detects medium calibration drift (30-50%)", () => {
	setup();
	getStorage().startSession();

	// Create tasks with moderate calibration issues
	// 3 high-confidence failures (poor calibration)
	for (let i = 0; i < 3; i++) {
		const task = getStorage().startTask({
			description: `Task ${i + 1}`,
			type: "fix",
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "failure",
			confidence: 0.85,
		});
	}

	// 2 high-confidence successes (good calibration)
	for (let i = 0; i < 2; i++) {
		const task = getStorage().startTask({
			description: `Task ${i + 4}`,
			type: "fix",
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "success",
			confidence: 0.9,
		});
	}

	const patterns = detectPatterns();

	const calibrationPattern = patterns.find(
		(p) => p.type === "calibration_drift",
	);
	ok(calibrationPattern, "Should detect calibration drift");
	strictEqual(
		calibrationPattern?.severity,
		"medium",
		"Should be medium severity for 30-50%",
	);

	teardown();
});

await test("does not detect calibration drift with good calibration", () => {
	setup();
	getStorage().startSession();

	// Create tasks with good calibration
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

	const patterns = detectPatterns();

	const calibrationPattern = patterns.find(
		(p) => p.type === "calibration_drift",
	);
	strictEqual(
		calibrationPattern,
		undefined,
		"Should not detect drift with good calibration",
	);

	teardown();
});

// ========== Guidance Content Tests ==========

await test("provides specific guidance for consecutive failures", () => {
	setup();
	getStorage().startSession();

	for (let i = 0; i < 3; i++) {
		const task = getStorage().startTask({
			description: `Task ${i + 1}`,
			type: "implementation",
		});
		getStorage().completeTask({
			task_id: task.task_id,
			outcome: "failure",
			confidence: 0.7,
		});
	}

	const patterns = detectPatterns();
	const pattern = patterns.find((p) => p.type === "consecutive_failures");

	ok(pattern?.guidance.length > 0, "Should provide guidance");
	ok(
		pattern?.guidance.includes("Review") ||
			pattern?.guidance.includes("Consider") ||
			pattern?.guidance.includes("breaking"),
		"Should provide actionable guidance",
	);

	teardown();
});

await test("provides specific guidance for hook failures", () => {
	setup();
	const { session_id } = getStorage().startSession();

	for (let i = 0; i < 6; i++) {
		getStorage().recordHookExecution({
			sessionId: session_id,
			hookType: "Stop",
			hookName: "bun-test",
			hookSource: "jutsu-bun",
			durationMs: 2000,
			exitCode: 1,
			passed: false,
		});
	}

	for (let i = 0; i < 2; i++) {
		getStorage().recordHookExecution({
			sessionId: session_id,
			hookType: "Stop",
			hookName: "bun-test",
			hookSource: "jutsu-bun",
			durationMs: 1800,
			exitCode: 0,
			passed: true,
		});
	}

	const patterns = detectPatterns();
	const pattern = patterns.find((p) => p.type === "hook_failures");

	ok(pattern?.guidance.length > 0, "Should provide guidance");
	ok(
		pattern?.guidance.includes("Run") || pattern?.guidance.includes("test"),
		"Should provide hook-specific guidance",
	);

	teardown();
});

// ========== Empty Data Handling ==========

await test("handles no data gracefully", () => {
	setup();

	const patterns = detectPatterns();

	strictEqual(patterns.length, 0, "Should return empty array with no data");

	teardown();
});

await test("handles insufficient data gracefully", () => {
	setup();
	getStorage().startSession();

	// Create only 1 task (not enough for consecutive failures)
	const task = getStorage().startTask({
		description: "Single task",
		type: "implementation",
	});
	getStorage().completeTask({
		task_id: task.task_id,
		outcome: "failure",
		confidence: 0.8,
	});

	const patterns = detectPatterns();

	const consecutivePattern = patterns.find(
		(p) => p.type === "consecutive_failures",
	);
	strictEqual(
		consecutivePattern,
		undefined,
		"Should not detect patterns with insufficient data",
	);

	teardown();
});

// ========== Summary ==========

console.log(`\n${"=".repeat(50)}`);
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log("=".repeat(50));

process.exit(testsFailed > 0 ? 1 : 0);
