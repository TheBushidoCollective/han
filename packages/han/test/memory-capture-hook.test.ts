/**
 * Tests for PostToolUse memory capture hook
 * Verifies that tool observations are captured correctly during sessions
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { existsSync, mkdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { captureToolUse } from "../lib/memory/capture.ts";
import { createMemoryStore, setMemoryRoot } from "../lib/memory/index.ts";

let testDir: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	testDir = join(tmpdir(), `han-memory-capture-test-${Date.now()}-${random}`);
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

describe("PostToolUse Memory Capture", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	test("captures Read tool usage", async () => {
		const sessionId = "test-session-read";
		const toolEvent = {
			session_id: sessionId,
			tool_name: "Read",
			tool_input: {
				file_path: "/path/to/file.ts",
			},
			tool_result: {
				content:
					"export function hello() {\n  console.log('Hello');\n}\n".repeat(100),
			},
		};

		await captureToolUse(toolEvent);

		const store = createMemoryStore();
		const observations = store.getSessionObservations(sessionId);

		expect(observations).toHaveLength(1);
		expect(observations[0].tool).toBe("Read");
		expect(observations[0].session_id).toBe(sessionId);
		expect(observations[0].files_read).toContain("/path/to/file.ts");
		expect(observations[0].files_modified).toHaveLength(0);
		expect(observations[0].input_summary).toContain("/path/to/file.ts");
		expect(observations[0].output_summary.length).toBeLessThan(1000); // Should be truncated
	});

	test("captures Edit tool usage", async () => {
		const sessionId = "test-session-edit";
		const toolEvent = {
			session_id: sessionId,
			tool_name: "Edit",
			tool_input: {
				file_path: "/path/to/file.ts",
				old_string: "const x = 1;",
				new_string: "const x = 2;",
			},
			tool_result: {
				success: true,
				message: "File updated successfully",
			},
		};

		await captureToolUse(toolEvent);

		const store = createMemoryStore();
		const observations = store.getSessionObservations(sessionId);

		expect(observations).toHaveLength(1);
		expect(observations[0].tool).toBe("Edit");
		expect(observations[0].files_read).toHaveLength(0);
		expect(observations[0].files_modified).toContain("/path/to/file.ts");
		expect(observations[0].input_summary).toContain("/path/to/file.ts");
	});

	test("captures Write tool usage", async () => {
		const sessionId = "test-session-write";
		const toolEvent = {
			session_id: sessionId,
			tool_name: "Write",
			tool_input: {
				file_path: "/path/to/new-file.ts",
				content: "export const value = 42;",
			},
			tool_result: {
				success: true,
			},
		};

		await captureToolUse(toolEvent);

		const store = createMemoryStore();
		const observations = store.getSessionObservations(sessionId);

		expect(observations).toHaveLength(1);
		expect(observations[0].tool).toBe("Write");
		expect(observations[0].files_modified).toContain("/path/to/new-file.ts");
		expect(observations[0].input_summary).toContain("/path/to/new-file.ts");
	});

	test("captures Bash tool usage", async () => {
		const sessionId = "test-session-bash";
		const toolEvent = {
			session_id: sessionId,
			tool_name: "Bash",
			tool_input: {
				command: "npm test",
			},
			tool_result: {
				stdout: "All tests passed\n".repeat(50),
				stderr: "",
				exit_code: 0,
			},
		};

		await captureToolUse(toolEvent);

		const store = createMemoryStore();
		const observations = store.getSessionObservations(sessionId);

		expect(observations).toHaveLength(1);
		expect(observations[0].tool).toBe("Bash");
		expect(observations[0].input_summary).toContain("npm test");
		expect(observations[0].output_summary).toContain("passed");
		expect(observations[0].output_summary.length).toBeLessThan(1000);
	});

	test("captures Grep tool usage", async () => {
		const sessionId = "test-session-grep";
		const toolEvent = {
			session_id: sessionId,
			tool_name: "Grep",
			tool_input: {
				pattern: "TODO",
				output_mode: "files_with_matches",
			},
			tool_result: {
				files: ["/path/to/file1.ts", "/path/to/file2.ts"],
			},
		};

		await captureToolUse(toolEvent);

		const store = createMemoryStore();
		const observations = store.getSessionObservations(sessionId);

		expect(observations).toHaveLength(1);
		expect(observations[0].tool).toBe("Grep");
		expect(observations[0].input_summary).toContain("TODO");
		expect(observations[0].output_summary).toContain("file1.ts");
	});

	test("captures multiple tool uses in a session", async () => {
		const sessionId = "test-session-multiple";

		// Read a file
		await captureToolUse({
			session_id: sessionId,
			tool_name: "Read",
			tool_input: { file_path: "/src/main.ts" },
			tool_result: { content: "const x = 1;" },
		});

		// Edit it
		await captureToolUse({
			session_id: sessionId,
			tool_name: "Edit",
			tool_input: {
				file_path: "/src/main.ts",
				old_string: "const x = 1;",
				new_string: "const x = 2;",
			},
			tool_result: { success: true },
		});

		// Run tests
		await captureToolUse({
			session_id: sessionId,
			tool_name: "Bash",
			tool_input: { command: "npm test" },
			tool_result: { stdout: "All tests passed", exit_code: 0 },
		});

		const store = createMemoryStore();
		const observations = store.getSessionObservations(sessionId);

		expect(observations).toHaveLength(3);
		expect(observations[0].tool).toBe("Read");
		expect(observations[1].tool).toBe("Edit");
		expect(observations[2].tool).toBe("Bash");
	});

	test("generates unique observation IDs", async () => {
		const sessionId = "test-session-ids";

		for (let i = 0; i < 5; i++) {
			await captureToolUse({
				session_id: sessionId,
				tool_name: "Read",
				tool_input: { file_path: `/file${i}.ts` },
				tool_result: { content: "content" },
			});
		}

		const store = createMemoryStore();
		const observations = store.getSessionObservations(sessionId);
		const ids = observations.map((obs) => obs.id);

		// All IDs should be unique
		expect(new Set(ids).size).toBe(5);
	});

	test("truncates long summaries to reasonable length", async () => {
		const sessionId = "test-session-truncate";
		const longContent = "A".repeat(10000);

		await captureToolUse({
			session_id: sessionId,
			tool_name: "Read",
			tool_input: { file_path: "/long-file.ts" },
			tool_result: { content: longContent },
		});

		const store = createMemoryStore();
		const observations = store.getSessionObservations(sessionId);

		// Output summary should be truncated
		expect(observations[0].output_summary.length).toBeLessThan(1000);
		expect(observations[0].output_summary).toContain("...");
	});

	test("handles tools with no file operations", async () => {
		const sessionId = "test-session-no-files";

		await captureToolUse({
			session_id: sessionId,
			tool_name: "WebSearch",
			tool_input: { query: "Claude Code documentation" },
			tool_result: { results: ["Result 1", "Result 2"] },
		});

		const store = createMemoryStore();
		const observations = store.getSessionObservations(sessionId);

		expect(observations).toHaveLength(1);
		expect(observations[0].files_read).toHaveLength(0);
		expect(observations[0].files_modified).toHaveLength(0);
		expect(observations[0].input_summary).toContain(
			"Claude Code documentation",
		);
	});

	test("handles missing session_id gracefully", async () => {
		const toolEvent = {
			session_id: "",
			tool_name: "Read",
			tool_input: { file_path: "/file.ts" },
			tool_result: { content: "content" },
		};

		// Should not throw
		await captureToolUse(toolEvent);

		// Should not have created any observations
		const store = createMemoryStore();
		const observations = store.getSessionObservations("");
		expect(observations).toHaveLength(0);
	});

	test("includes timestamp in observations", async () => {
		const sessionId = "test-session-timestamp";
		const before = Date.now();

		await captureToolUse({
			session_id: sessionId,
			tool_name: "Read",
			tool_input: { file_path: "/file.ts" },
			tool_result: { content: "content" },
		});

		const after = Date.now();
		const store = createMemoryStore();
		const observations = store.getSessionObservations(sessionId);

		expect(observations[0].timestamp).toBeGreaterThanOrEqual(before);
		expect(observations[0].timestamp).toBeLessThanOrEqual(after);
	});
});
