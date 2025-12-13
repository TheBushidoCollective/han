/**
 * Unit tests for memory session-end CLI command
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { endSessionWithSummary } from "../lib/commands/memory/session-end.ts";
import {
	createMemoryStore,
	generateId,
	type RawObservation,
	setMemoryRoot,
} from "../lib/memory/index.ts";

let testDir: string;
let originalConsoleLog: typeof console.log;
let logOutput: string[] = [];

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(
		tmpdir(),
		`han-memory-session-end-test-${Date.now()}-${random}`,
	);
	mkdirSync(testDir, { recursive: true });

	// Override memory root to use test directory
	setMemoryRoot(testDir);

	// Capture console.log output
	originalConsoleLog = console.log;
	logOutput = [];
	console.log = (...args: unknown[]) => {
		logOutput.push(args.map((a) => String(a)).join(" "));
	};
}

function teardown(): void {
	// Restore console.log
	console.log = originalConsoleLog;

	// Reset memory root
	setMemoryRoot(null);

	if (testDir && existsSync(testDir)) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

describe("Memory Session End Command", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("handles empty session gracefully", async () => {
		const sessionId = "empty-session";

		await endSessionWithSummary(sessionId);

		// Should output success with null summary
		expect(logOutput).toHaveLength(1);
		const output = JSON.parse(logOutput[0]);
		expect(output.success).toBe(true);
		expect(output.session_id).toBe(sessionId);
		expect(output.summary).toBeNull();
	});

	test("creates and stores summary for session with observations", async () => {
		const store = createMemoryStore();
		const sessionId = "test-session";
		const now = Date.now();

		// Add some observations
		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "Read",
				input_summary: "Reading src/auth/login.ts",
				output_summary: "File contents returned",
				files_read: ["src/auth/login.ts"],
				files_modified: [],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 1000,
				tool: "Edit",
				input_summary: "Adding JWT validation",
				output_summary: "File updated",
				files_read: [],
				files_modified: ["src/auth/login.ts"],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		await endSessionWithSummary(sessionId);

		// Should output success with summary stats
		expect(logOutput).toHaveLength(1);
		const output = JSON.parse(logOutput[0]);
		expect(output.success).toBe(true);
		expect(output.session_id).toBe(sessionId);
		expect(output.summary).toBeDefined();
		expect(output.summary.work_items).toBeGreaterThan(0);

		// Verify summary was stored
		const recent = store.getRecentSessions(1);
		expect(recent).toHaveLength(1);
		expect(recent[0].session_id).toBe(sessionId);
	});

	test("handles missing session ID gracefully", async () => {
		await endSessionWithSummary(undefined);

		// Should output error about missing session ID
		expect(logOutput).toHaveLength(1);
		const output = JSON.parse(logOutput[0]);
		expect(output.success).toBe(false);
		expect(output.error).toContain("No session ID");
	});

	test("reports summary statistics correctly", async () => {
		const store = createMemoryStore();
		const sessionId = "stats-session";
		const now = Date.now();

		// Add observations with work items, in-progress, and decisions
		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "WebSearch",
				input_summary: "Searching for JWT best practices",
				output_summary: "Found authentication articles",
				files_read: [],
				files_modified: [],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 1000,
				tool: "Write",
				input_summary: "Creating src/auth/jwt.ts",
				output_summary: "File created with JWT implementation",
				files_read: [],
				files_modified: ["src/auth/jwt.ts"],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 2000,
				tool: "Read",
				input_summary: "Reading src/payments/processor.ts",
				output_summary: "File contents returned",
				files_read: ["src/payments/processor.ts"],
				files_modified: [],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		await endSessionWithSummary(sessionId);

		const output = JSON.parse(logOutput[0]);
		expect(output.success).toBe(true);
		expect(output.summary.work_items).toBe(1); // JWT implementation
		expect(output.summary.in_progress).toBe(1); // Payments investigation
		expect(output.summary.decisions).toBe(1); // JWT decision
	});
});
