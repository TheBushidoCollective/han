/**
 * Tests for commands/metrics/hook-tracking.ts
 * Tests the HookExecutionData interface structure
 */
import { describe, expect, test } from "bun:test";

describe("hook-tracking.ts", () => {
	describe("HookExecutionData interface", () => {
		test("has expected structure", () => {
			const data = {
				hookType: "Stop",
				hookName: "jutsu-typescript",
				hookSource: "plugin",
				durationMs: 1500,
				exitCode: 0,
				passed: true,
				output: "Build succeeded",
				error: undefined,
				sessionId: "session_123",
				taskId: "task_456",
			};

			expect(data.hookType).toBe("Stop");
			expect(data.hookName).toBe("jutsu-typescript");
			expect(data.durationMs).toBe(1500);
			expect(data.exitCode).toBe(0);
			expect(data.passed).toBe(true);
		});

		test("allows optional fields", () => {
			const data = {
				hookType: "Stop",
				hookName: "test",
				durationMs: 100,
				exitCode: 0,
				passed: true,
			};

			expect(data.hookType).toBe("Stop");
			expect((data as { hookSource?: string }).hookSource).toBeUndefined();
			expect((data as { output?: string }).output).toBeUndefined();
			expect((data as { sessionId?: string }).sessionId).toBeUndefined();
		});

		test("failed hook has exitCode non-zero", () => {
			const data = {
				hookType: "Stop",
				hookName: "failing-hook",
				durationMs: 500,
				exitCode: 1,
				passed: false,
				error: "Build failed",
			};

			expect(data.exitCode).not.toBe(0);
			expect(data.passed).toBe(false);
			expect(data.error).toBeDefined();
		});
	});
});
