import { describe, expect, test } from "bun:test";
import { spawn } from "node:child_process";
import { join } from "node:path";

// We'll test via the CLI interface since the function reads from stdin

describe("han hook record-file-change", () => {
	const hanPath = join(import.meta.dir, "..", "lib", "main.ts");

	// Helper to run the command with a payload piped to stdin
	function runRecordFileChange(
		payload: Record<string, unknown>,
	): Promise<{ code: number; stdout: string; stderr: string }> {
		return new Promise((resolve) => {
			const child = spawn("bun", [hanPath, "hook", "record-file-change"], {
				stdio: ["pipe", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";

			child.stdout.on("data", (data) => {
				stdout += data.toString();
			});

			child.stderr.on("data", (data) => {
				stderr += data.toString();
			});

			child.on("close", (code) => {
				resolve({ code: code ?? 0, stdout, stderr });
			});

			// Write payload to stdin
			child.stdin.write(JSON.stringify(payload));
			child.stdin.end();
		});
	}

	test(
		"should exit cleanly with no stdin",
		async () => {
			const result = await new Promise<{
				code: number;
				stdout: string;
				stderr: string;
			}>((resolve) => {
				const child = spawn("bun", [hanPath, "hook", "record-file-change"], {
					stdio: ["pipe", "pipe", "pipe"],
				});

				let stdout = "";
				let stderr = "";

				child.stdout.on("data", (data) => {
					stdout += data.toString();
				});

				child.stderr.on("data", (data) => {
					stderr += data.toString();
				});

				child.on("close", (code) => {
					resolve({ code: code ?? 0, stdout, stderr });
				});

				// Close stdin immediately with no data
				child.stdin.end();
			});

			// Should exit cleanly (no output, no error)
			expect(result.code).toBe(0);
		},
		{ timeout: 15000 },
	);

	test(
		"should exit cleanly with invalid JSON",
		async () => {
			const result = await new Promise<{
				code: number;
				stdout: string;
				stderr: string;
			}>((resolve) => {
				const child = spawn("bun", [hanPath, "hook", "record-file-change"], {
					stdio: ["pipe", "pipe", "pipe"],
				});

				let stdout = "";
				let stderr = "";

				child.stdout.on("data", (data) => {
					stdout += data.toString();
				});

				child.stderr.on("data", (data) => {
					stderr += data.toString();
				});

				child.on("close", (code) => {
					resolve({ code: code ?? 0, stdout, stderr });
				});

				// Write invalid JSON
				child.stdin.write("not valid json");
				child.stdin.end();
			});

			// Should exit cleanly (graceful handling of invalid JSON)
			expect(result.code).toBe(0);
		},
		{ timeout: 15000 },
	);

	test("should skip when missing session_id", async () => {
		const result = await runRecordFileChange({
			tool_name: "Edit",
			tool_input: { file_path: "/path/to/file.ts" },
		});

		expect(result.code).toBe(0);
	});

	test("should skip when missing tool_name", async () => {
		const result = await runRecordFileChange({
			session_id: "test-session",
			tool_input: { file_path: "/path/to/file.ts" },
		});

		expect(result.code).toBe(0);
	});

	test("should skip when missing file_path", async () => {
		const result = await runRecordFileChange({
			session_id: "test-session",
			tool_name: "Edit",
			tool_input: {},
		});

		expect(result.code).toBe(0);
	});

	test("should skip for non-file-modifying tools", async () => {
		const result = await runRecordFileChange({
			session_id: "test-session",
			tool_name: "Bash",
			tool_input: { command: "ls -la" },
		});

		expect(result.code).toBe(0);
	});

	test("should record Edit tool changes", async () => {
		// This will actually call the database, but we test that it doesn't crash
		const result = await runRecordFileChange({
			session_id: "test-session",
			tool_name: "Edit",
			tool_input: { file_path: "/path/to/file.ts" },
		});

		// Should complete without error
		expect(result.code).toBe(0);
	});

	test("should record Write tool changes", async () => {
		// This will actually call the database, but we test that it doesn't crash
		const result = await runRecordFileChange({
			session_id: "test-session",
			tool_name: "Write",
			tool_input: { file_path: "/path/to/new-file.ts" },
		});

		// Should complete without error
		expect(result.code).toBe(0);
	});
});

describe("Smart Dispatch integration", () => {
	const hanPath = join(import.meta.dir, "..", "lib", "main.ts");

	test("dispatch command should be accessible", async () => {
		const result = await new Promise<{
			code: number;
			stdout: string;
			stderr: string;
		}>((resolve) => {
			const child = spawn("bun", [hanPath, "hook", "dispatch", "--help"], {
				stdio: ["pipe", "pipe", "pipe"],
			});

			let stdout = "";
			let stderr = "";

			child.stdout.on("data", (data) => {
				stdout += data.toString();
			});

			child.stderr.on("data", (data) => {
				stderr += data.toString();
			});

			child.on("close", (code) => {
				resolve({ code: code ?? 0, stdout, stderr });
			});
		});

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("dispatch");
	});

	test("record-file-change command help should be accessible", async () => {
		const result = await new Promise<{
			code: number;
			stdout: string;
			stderr: string;
		}>((resolve) => {
			const child = spawn(
				"bun",
				[hanPath, "hook", "record-file-change", "--help"],
				{
					stdio: ["pipe", "pipe", "pipe"],
				},
			);

			let stdout = "";
			let stderr = "";

			child.stdout.on("data", (data) => {
				stdout += data.toString();
			});

			child.stderr.on("data", (data) => {
				stderr += data.toString();
			});

			child.on("close", (code) => {
				resolve({ code: code ?? 0, stdout, stderr });
			});
		});

		expect(result.code).toBe(0);
		expect(result.stdout).toContain("record-file-change");
		expect(result.stdout).toContain("PostToolUse");
	});
});
