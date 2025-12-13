/**
 * Unit tests for Han Memory session summarization
 * Tests the Stop hook that creates session summaries from observations
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
	createMemoryStore,
	generateId,
	type RawObservation,
	setMemoryRoot,
} from "../lib/memory/index.ts";
import { summarizeSession } from "../lib/memory/summarize.ts";

let testDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-memory-summarize-test-${Date.now()}-${random}`);
	mkdirSync(testDir, { recursive: true });

	// Override memory root to use test directory
	setMemoryRoot(testDir);
}

function teardown(): void {
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

describe("Session Summarization", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("returns null when no observations exist", () => {
		const store = createMemoryStore();
		const sessionId = "empty-session";
		const summary = summarizeSession(sessionId, store);

		expect(summary).toBeNull();
	});

	test("creates summary with work items from file modifications", () => {
		const store = createMemoryStore();
		const sessionId = "work-items-session";
		const now = Date.now();

		// Create observations showing work on authentication
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
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 2000,
				tool: "Edit",
				input_summary: "Adding login tests",
				output_summary: "File updated",
				files_read: [],
				files_modified: ["test/auth/login.test.ts"],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		const summary = summarizeSession(sessionId, store);

		expect(summary).not.toBeNull();
		expect(summary?.session_id).toBe(sessionId);
		expect(summary?.started_at).toBe(now);
		expect(summary?.ended_at).toBeGreaterThanOrEqual(now + 2000);
		expect(summary?.work_items).toHaveLength(2);

		// Check work items extracted from file modifications
		const authItem = summary?.work_items.find((item) =>
			item.files.includes("src/auth/login.ts"),
		);
		expect(authItem).toBeDefined();
		expect(authItem?.outcome).toBe("completed");
		expect(authItem?.description).toContain("auth");

		const testItem = summary?.work_items.find((item) =>
			item.files.includes("test/auth/login.test.ts"),
		);
		expect(testItem).toBeDefined();
		expect(testItem?.outcome).toBe("completed");
	});

	test("identifies in-progress work from Read without Edit", () => {
		const store = createMemoryStore();
		const sessionId = "in-progress-session";
		const now = Date.now();

		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "Read",
				input_summary: "Reading src/payments/processor.ts",
				output_summary: "File contents returned",
				files_read: ["src/payments/processor.ts"],
				files_modified: [],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 1000,
				tool: "Grep",
				input_summary: "Searching for payment patterns",
				output_summary: "Found 5 matches",
				files_read: [],
				files_modified: [],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 2000,
				tool: "Read",
				input_summary: "Reading src/payments/types.ts",
				output_summary: "File contents returned",
				files_read: ["src/payments/types.ts"],
				files_modified: [],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		const summary = summarizeSession(sessionId, store);

		expect(summary).not.toBeNull();
		expect(summary?.in_progress).toHaveLength(1);
		expect(summary?.in_progress[0]).toContain("payments");
	});

	test("extracts decisions from tool usage patterns", () => {
		const store = createMemoryStore();
		const sessionId = "decisions-session";
		const now = Date.now();

		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "WebSearch",
				input_summary: "Searching for JWT vs Session comparison",
				output_summary: "Found authentication comparison articles",
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
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		const summary = summarizeSession(sessionId, store);

		expect(summary).not.toBeNull();
		expect(summary?.decisions).toHaveLength(1);
		expect(summary?.decisions[0].description).toContain("JWT");
		expect(summary?.decisions[0].rationale).toBeTruthy();
	});

	test("generates summary text from observations", () => {
		const store = createMemoryStore();
		const sessionId = "summary-text-session";
		const now = Date.now();

		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "Edit",
				input_summary: "Adding user registration form",
				output_summary: "File updated",
				files_read: [],
				files_modified: ["src/components/RegisterForm.tsx"],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 1000,
				tool: "Edit",
				input_summary: "Adding validation logic",
				output_summary: "File updated",
				files_read: [],
				files_modified: ["src/utils/validation.ts"],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		const summary = summarizeSession(sessionId, store);

		expect(summary).not.toBeNull();
		expect(summary?.summary).toBeTruthy();
		expect(summary?.summary.length).toBeGreaterThan(0);
		expect(summary?.summary).toContain("registration");
	});

	test("handles bash commands in observations", () => {
		const store = createMemoryStore();
		const sessionId = "bash-session";
		const now = Date.now();

		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "Bash",
				input_summary: "Running npm test",
				output_summary: "All tests passing",
				files_read: [],
				files_modified: [],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 1000,
				tool: "Bash",
				input_summary: "Running npm build",
				output_summary: "Build successful",
				files_read: [],
				files_modified: [],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		const summary = summarizeSession(sessionId, store);

		expect(summary).not.toBeNull();
		// Bash commands without file modifications shouldn't create work items
		expect(summary?.work_items).toHaveLength(0);
	});

	test("marks work as partial when errors occur", () => {
		const store = createMemoryStore();
		const sessionId = "partial-session";
		const now = Date.now();

		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "Edit",
				input_summary: "Fixing bug in payment processor",
				output_summary: "File updated",
				files_read: [],
				files_modified: ["src/payments/processor.ts"],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 1000,
				tool: "Bash",
				input_summary: "Running tests",
				output_summary: "Error: 2 tests failed",
				files_read: [],
				files_modified: [],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		const summary = summarizeSession(sessionId, store);

		expect(summary).not.toBeNull();
		expect(summary?.work_items).toHaveLength(1);
		// Should mark as partial since tests failed
		expect(summary?.work_items[0].outcome).toBe("partial");
	});

	test("marks work as blocked when explicit blockers present", () => {
		const store = createMemoryStore();
		const sessionId = "blocked-session";
		const now = Date.now();

		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "Read",
				input_summary: "Reading API documentation",
				output_summary: "File not found",
				files_read: [],
				files_modified: [],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 1000,
				tool: "Grep",
				input_summary: "Searching for API endpoints",
				output_summary: "No matches found",
				files_read: [],
				files_modified: [],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		const summary = summarizeSession(sessionId, store);

		expect(summary).not.toBeNull();
		// Should identify this as blocked/in-progress work
		expect(summary?.in_progress.length).toBeGreaterThan(0);
	});

	test("groups related file modifications into single work item", () => {
		const store = createMemoryStore();
		const sessionId = "grouped-session";
		const now = Date.now();

		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "Edit",
				input_summary: "Updating component",
				output_summary: "File updated",
				files_read: [],
				files_modified: ["src/components/LoginForm.tsx"],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 500,
				tool: "Edit",
				input_summary: "Updating styles",
				output_summary: "File updated",
				files_read: [],
				files_modified: ["src/components/LoginForm.module.css"],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 1000,
				tool: "Edit",
				input_summary: "Adding tests",
				output_summary: "File updated",
				files_read: [],
				files_modified: ["test/LoginForm.test.tsx"],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		const summary = summarizeSession(sessionId, store);

		expect(summary).not.toBeNull();
		// Should group LoginForm-related files into one work item
		const loginItem = summary?.work_items.find((item) =>
			item.files.some((f) => f.includes("LoginForm")),
		);
		expect(loginItem).toBeDefined();
		expect(loginItem?.files.length).toBeGreaterThan(1);
	});

	test("sets project name to unknown when not in git repo", () => {
		const store = createMemoryStore();
		const sessionId = "no-git-session";
		const now = Date.now();

		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "Edit",
				input_summary: "Editing file",
				output_summary: "File updated",
				files_read: [],
				files_modified: ["test.ts"],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		const summary = summarizeSession(sessionId, store);

		expect(summary).not.toBeNull();
		expect(summary?.project).toBeTruthy();
	});

	test("stores summary after generation", () => {
		const store = createMemoryStore();
		const sessionId = "store-summary-session";
		const now = Date.now();

		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "Edit",
				input_summary: "Editing file",
				output_summary: "File updated",
				files_read: [],
				files_modified: ["src/main.ts"],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		const summary = summarizeSession(sessionId, store, { autoStore: true });

		expect(summary).not.toBeNull();

		// Verify it was stored
		const retrieved = store.getRecentSessions(1);
		expect(retrieved).toHaveLength(1);
		expect(retrieved[0].session_id).toBe(sessionId);
	});
});
