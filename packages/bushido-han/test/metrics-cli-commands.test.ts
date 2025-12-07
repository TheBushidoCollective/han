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

function runCommand(command: string, input?: string): string {
	try {
		const output = execSync(`npx tsx ../lib/main.ts metrics ${command}`, {
			cwd: join(__dirname, ".."),
			env: process.env,
			encoding: "utf-8",
			input,
		});
		return output.trim();
	} catch (error) {
		const err = error as Error & { stdout?: string; stderr?: string };
		throw new Error(
			`Command failed: ${err.message}\nOutput: ${err.stdout || ""}\nError: ${err.stderr || ""}`,
		);
	}
}

// ========== Session Start Command ==========

await test("session-start creates new session", () => {
	setup();

	const output = runCommand("session-start");
	const result = JSON.parse(output);

	ok(result.session_id, "Should return session ID");
	ok(
		result.session_id.startsWith("session-"),
		"Session ID should have proper prefix",
	);
	strictEqual(result.resumed, false, "Should not be resumed");

	teardown();
});

await test("session-start with --session-id resumes session", () => {
	setup();

	// Create initial session
	const firstOutput = runCommand("session-start");
	const firstResult = JSON.parse(firstOutput);
	const sessionId = firstResult.session_id;

	// Close and recreate storage to simulate new CLI invocation
	teardown();
	setup();

	// Resume the session
	const resumeOutput = runCommand(`session-start --session-id ${sessionId}`);
	const resumeResult = JSON.parse(resumeOutput);

	strictEqual(
		resumeResult.session_id,
		sessionId,
		"Should return same session ID",
	);
	strictEqual(resumeResult.resumed, true, "Should be marked as resumed");

	teardown();
});

await test("session-start creates new session for non-existent session ID", () => {
	setup();

	const output = runCommand(
		"session-start --session-id nonexistent-session-123",
	);
	const result = JSON.parse(output);

	ok(result.session_id, "Should create new session");
	strictEqual(
		result.session_id,
		"nonexistent-session-123",
		"Should use provided session ID",
	);
	strictEqual(result.resumed, false, "Should not be marked as resumed");

	teardown();
});

// ========== Session Current Command ==========

await test("session-current returns active session", () => {
	setup();

	// Start a session
	const startOutput = runCommand("session-start");
	const startResult = JSON.parse(startOutput);

	// Get current session
	const currentOutput = runCommand("session-current");
	const currentResult = JSON.parse(currentOutput);

	strictEqual(
		currentResult.session_id,
		startResult.session_id,
		"Should return active session ID",
	);

	teardown();
});

await test("session-current returns null when no active session", () => {
	setup();

	const output = runCommand("session-current");
	const result = JSON.parse(output);

	strictEqual(
		result.session_id,
		null,
		"Should return null for no active session",
	);

	teardown();
});

// ========== Session End Command ==========

await test("session-end ends active session", () => {
	setup();

	// Start a session
	const startOutput = runCommand("session-start");
	const startResult = JSON.parse(startOutput);

	// End the session
	const endOutput = runCommand("session-end");
	const endResult = JSON.parse(endOutput);

	strictEqual(endResult.success, true, "Should successfully end session");
	strictEqual(
		endResult.session_id,
		startResult.session_id,
		"Should return ended session ID",
	);

	// Verify session is no longer active
	const currentOutput = runCommand("session-current");
	const currentResult = JSON.parse(currentOutput);
	strictEqual(
		currentResult.session_id,
		null,
		"Session should no longer be active",
	);

	teardown();
});

await test("session-end with --session-id ends specific session", () => {
	setup();

	// Start a session
	const startOutput = runCommand("session-start");
	const startResult = JSON.parse(startOutput);
	const sessionId = startResult.session_id;

	// End specific session
	const endOutput = runCommand(`session-end --session-id ${sessionId}`);
	const endResult = JSON.parse(endOutput);

	strictEqual(endResult.success, true, "Should successfully end session");
	strictEqual(
		endResult.session_id,
		sessionId,
		"Should return specified session ID",
	);

	teardown();
});

await test("session-end fails when no active session", () => {
	setup();

	try {
		runCommand("session-end");
		ok(false, "Should have thrown error");
	} catch (error) {
		ok(
			(error as Error).message.includes("No active session"),
			"Should report no active session",
		);
	}

	teardown();
});

// ========== Hook Execution Command ==========

await test("hook-exec records hook execution via stdin", () => {
	setup();
	const { session_id } = getStorage().startSession();

	const hookData = {
		sessionId: session_id,
		hookType: "Stop",
		hookName: "typescript-typecheck",
		hookSource: "jutsu-typescript",
		durationMs: 1200,
		exitCode: 0,
		passed: true,
		output: "All types valid",
	};

	const output = runCommand("hook-exec", JSON.stringify(hookData));
	const result = JSON.parse(output);

	strictEqual(
		result.success,
		true,
		"Should successfully record hook execution",
	);

	// Verify hook was recorded
	const hookStats = getStorage().getHookFailureStats("week");
	strictEqual(hookStats.length, 0, "Should not show in failure stats (passed)");

	teardown();
});

await test("hook-exec records hook failure via stdin", () => {
	setup();
	const { session_id } = getStorage().startSession();

	// Record multiple failures to get above 20% threshold
	for (let i = 0; i < 3; i++) {
		const hookData = {
			sessionId: session_id,
			hookType: "Stop",
			hookName: "biome-lint",
			hookSource: "jutsu-biome",
			durationMs: 500,
			exitCode: 1,
			passed: false,
			error: "Linting errors found",
		};

		runCommand("hook-exec", JSON.stringify(hookData));
	}

	// Verify hooks were recorded
	const hookStats = getStorage().getHookFailureStats("week");
	strictEqual(hookStats.length, 1, "Should have one failing hook");
	strictEqual(hookStats[0].name, "biome-lint", "Should be biome-lint hook");
	strictEqual(hookStats[0].failures, 3, "Should have 3 failures");

	teardown();
});

await test("hook-exec handles missing sessionId", () => {
	setup();

	const hookData = {
		hookType: "UserPromptSubmit",
		hookName: "professional-honesty",
		hookSource: "core",
		durationMs: 150,
		exitCode: 0,
		passed: true,
	};

	const output = runCommand("hook-exec", JSON.stringify(hookData));
	const result = JSON.parse(output);

	strictEqual(
		result.success,
		true,
		"Should successfully record even without session ID",
	);

	teardown();
});

await test("hook-exec validates JSON input", () => {
	setup();

	try {
		runCommand("hook-exec", "invalid json");
		ok(false, "Should have thrown error for invalid JSON");
	} catch (error) {
		ok(
			(error as Error).message.includes("failed") ||
				(error as Error).message.includes("Invalid"),
			"Should report invalid JSON",
		);
	}

	teardown();
});

// ========== Session Context Command ==========

await test("session-context generates context output", () => {
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

	const output = runCommand("session-context");

	ok(output.length > 0, "Should generate context output");
	ok(
		output.includes("Your Recent Performance") ||
			output.includes("Getting Started"),
		"Should have appropriate header",
	);

	teardown();
});

await test("session-context handles empty data", () => {
	setup();

	const output = runCommand("session-context");

	ok(output.includes("Getting Started"), "Should show getting started message");
	ok(output.includes("No tasks tracked yet"), "Should mention no tasks");

	teardown();
});

// ========== Detect Patterns Command ==========

await test("detect-patterns returns JSON format", () => {
	setup();
	getStorage().startSession();

	// Create consecutive failures
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

	const output = runCommand("detect-patterns --json");
	const patterns = JSON.parse(output);

	ok(Array.isArray(patterns), "Should return array of patterns");
	ok(patterns.length > 0, "Should detect patterns");
	ok(patterns[0].type, "Pattern should have type");
	ok(patterns[0].severity, "Pattern should have severity");
	ok(patterns[0].message, "Pattern should have message");
	ok(patterns[0].guidance, "Pattern should have guidance");

	teardown();
});

await test("detect-patterns filters by min-severity", () => {
	setup();
	const { session_id } = getStorage().startSession();

	// Create medium severity hook pattern (40% failure)
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

	// Should not appear when filtering for high severity
	const highOutput = runCommand("detect-patterns --min-severity high --json");
	const highPatterns = JSON.parse(highOutput);
	const hookPattern = highPatterns.find(
		(p: { type: string; severity: string }) => p.type === "hook_failures",
	);
	strictEqual(
		hookPattern,
		undefined,
		"Should not include medium severity when filtering for high",
	);

	// Should appear when filtering for medium severity
	const mediumOutput = runCommand(
		"detect-patterns --min-severity medium --json",
	);
	const mediumPatterns = JSON.parse(mediumOutput);
	const mediumHookPattern = mediumPatterns.find(
		(p: { type: string; severity: string }) => p.type === "hook_failures",
	);
	ok(
		mediumHookPattern,
		"Should include medium severity when filtering for medium",
	);

	teardown();
});

await test("detect-patterns returns empty array with no patterns", () => {
	setup();

	const output = runCommand("detect-patterns --json");
	const patterns = JSON.parse(output);

	strictEqual(patterns.length, 0, "Should return empty array with no patterns");

	teardown();
});

// ========== Command Error Handling ==========

await test("commands handle missing database gracefully", () => {
	setup();

	// Commands should create database if it doesn't exist
	const output = runCommand("session-current");
	const result = JSON.parse(output);

	strictEqual(
		result.session_id,
		null,
		"Should handle missing database by creating it",
	);

	teardown();
});

// ========== Summary ==========

console.log(`\n${"=".repeat(50)}`);
console.log(`Tests passed: ${testsPassed}`);
console.log(`Tests failed: ${testsFailed}`);
console.log("=".repeat(50));

process.exit(testsFailed > 0 ? 1 : 0);
