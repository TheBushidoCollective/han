/**
 * Integration tests for memory system
 * Tests the full flow: capture -> summarize -> store -> retrieve
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
	summarizeSession,
} from "../lib/memory/index.ts";

let testDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(
		tmpdir(),
		`han-memory-integration-test-${Date.now()}-${random}`,
	);
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

describe("Memory System Integration", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("full session flow: capture -> summarize -> retrieve", () => {
		const store = createMemoryStore();
		const sessionId = "integration-session";
		const now = Date.now();

		// Step 1: Capture observations (simulating PostToolUse hook)
		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "Read",
				input_summary: "Reading authentication code",
				output_summary: "File contents returned",
				files_read: ["src/auth/login.ts", "src/auth/jwt.ts"],
				files_modified: [],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 1000,
				tool: "Edit",
				input_summary: "Adding JWT validation",
				output_summary: "File updated successfully",
				files_read: [],
				files_modified: ["src/auth/jwt.ts"],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 2000,
				tool: "Write",
				input_summary: "Creating test file",
				output_summary: "Test file created",
				files_read: [],
				files_modified: ["test/auth/jwt.test.ts"],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 3000,
				tool: "Bash",
				input_summary: "Running tests",
				output_summary: "All tests passing (3 pass, 0 fail)",
				files_read: [],
				files_modified: [],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		// Step 2: Summarize session (simulating Stop hook)
		const summary = summarizeSession(sessionId, store, { autoStore: true });

		// Verify summary was created
		expect(summary).not.toBeNull();
		expect(summary?.session_id).toBe(sessionId);
		expect(summary?.work_items).toHaveLength(2); // JWT + test

		// Verify work items
		const jwtWork = summary?.work_items.find((item) =>
			item.files.includes("src/auth/jwt.ts"),
		);
		expect(jwtWork).toBeDefined();
		expect(jwtWork?.outcome).toBe("completed");
		expect(jwtWork?.description).toContain("auth");

		const testWork = summary?.work_items.find((item) =>
			item.files.includes("test/auth/jwt.test.ts"),
		);
		expect(testWork).toBeDefined();
		expect(testWork?.outcome).toBe("completed");

		// Step 3: Retrieve summary (simulating SessionStart context injection)
		const recent = store.getRecentSessions(5);
		expect(recent).toHaveLength(1);
		expect(recent[0].session_id).toBe(sessionId);
		expect(recent[0].summary).toContain("auth");
		expect(recent[0].work_items).toHaveLength(2);
	});

	test("multiple sessions are stored in chronological order", () => {
		const store = createMemoryStore();
		const now = Date.now();

		// Create 3 sessions
		for (let i = 0; i < 3; i++) {
			const sessionId = `session-${i}`;

			const obs: RawObservation = {
				id: generateId(),
				session_id: sessionId,
				timestamp: now + i * 1000,
				tool: "Edit",
				input_summary: `Work item ${i}`,
				output_summary: "File updated",
				files_read: [],
				files_modified: [`file${i}.ts`],
			};

			store.appendObservation(sessionId, obs);
			summarizeSession(sessionId, store, { autoStore: true });
		}

		// Retrieve recent sessions
		const recent = store.getRecentSessions(5);
		expect(recent).toHaveLength(3);

		// Should be in reverse chronological order (newest first)
		expect(recent[0].session_id).toBe("session-2");
		expect(recent[1].session_id).toBe("session-1");
		expect(recent[2].session_id).toBe("session-0");
	});

	test("handles session with only exploration (no modifications)", () => {
		const store = createMemoryStore();
		const sessionId = "exploration-session";
		const now = Date.now();

		// Only reads, no edits
		const observations: RawObservation[] = [
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now,
				tool: "Read",
				input_summary: "Reading codebase",
				output_summary: "File contents returned",
				files_read: ["src/main.ts"],
				files_modified: [],
			},
			{
				id: generateId(),
				session_id: sessionId,
				timestamp: now + 1000,
				tool: "Grep",
				input_summary: "Searching for patterns",
				output_summary: "Found 5 matches",
				files_read: [],
				files_modified: [],
			},
		];

		for (const obs of observations) {
			store.appendObservation(sessionId, obs);
		}

		const summary = summarizeSession(sessionId, store, { autoStore: true });

		expect(summary).not.toBeNull();
		expect(summary?.work_items).toHaveLength(0);
		expect(summary?.summary).toBe("Explored codebase");
	});
});
