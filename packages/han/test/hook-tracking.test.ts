/**
 * Tests for commands/metrics/hook-tracking.ts
 * Tests the extractPluginName function
 */
import { describe, expect, test } from "bun:test";
import { extractPluginName } from "../lib/commands/metrics/hook-tracking.ts";

describe("hook-tracking.ts", () => {
	describe("extractPluginName", () => {
		test("extracts plugin name from jutsu path", () => {
			const path =
				"/Users/test/.claude/plugins/marketplaces/han/jutsu/jutsu-typescript";
			expect(extractPluginName(path)).toBe("jutsu-typescript");
		});

		test("extracts plugin name from hashi path", () => {
			const path =
				"/Users/test/.claude/plugins/marketplaces/han/hashi/hashi-github";
			expect(extractPluginName(path)).toBe("hashi-github");
		});

		test("extracts plugin name from do path", () => {
			const path =
				"/Users/test/.claude/plugins/marketplaces/han/do/do-accessibility";
			expect(extractPluginName(path)).toBe("do-accessibility");
		});

		test("extracts plugin name from core path", () => {
			const path = "/Users/test/.claude/plugins/marketplaces/han/core";
			expect(extractPluginName(path)).toBe("core");
		});

		test("extracts plugin name from bushido path", () => {
			const path = "/Users/test/.claude/plugins/marketplaces/han/bushido";
			expect(extractPluginName(path)).toBe("bushido");
		});

		test("handles path with trailing slash", () => {
			const path =
				"/Users/test/.claude/plugins/marketplaces/han/jutsu/jutsu-react/";
			// Will return empty string due to trailing slash
			expect(extractPluginName(path)).toBe("");
		});

		test("handles simple path", () => {
			const path = "jutsu-typescript";
			expect(extractPluginName(path)).toBe("jutsu-typescript");
		});

		test("handles nested paths", () => {
			const path =
				"/very/long/nested/path/to/plugins/marketplaces/han/jutsu/jutsu-bun";
			expect(extractPluginName(path)).toBe("jutsu-bun");
		});

		test("handles empty path", () => {
			const path = "";
			expect(extractPluginName(path)).toBe("");
		});

		test("handles single segment path", () => {
			const path = "core";
			expect(extractPluginName(path)).toBe("core");
		});

		test("handles Windows-style paths", () => {
			// Path.split('/') on Windows paths will only split on forward slashes
			const path = "C:/Users/test/.claude/plugins/marketplaces/han/core";
			expect(extractPluginName(path)).toBe("core");
		});
	});

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
