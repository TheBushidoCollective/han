/**
 * Tests for executePluginTool function in lib/commands/mcp/tools.ts
 *
 * This closes the testing gap - executePluginTool is the core function that
 * runs hooks via MCP but had no tests.
 */
import {
	afterEach,
	beforeEach,
	describe,
	expect,
	mock,
	spyOn,
	test,
} from "bun:test";

// We need to mock the validate module before importing executePluginTool
let mockRunConfiguredHook: ReturnType<typeof mock>;
let mockRecordMcpToolCall: ReturnType<typeof mock>;

// Mock the modules
mock.module("../lib/validate.ts", () => ({
	runConfiguredHook: (...args: unknown[]) => mockRunConfiguredHook(...args),
}));

mock.module("../lib/telemetry/index.ts", () => ({
	recordMcpToolCall: (...args: unknown[]) => mockRecordMcpToolCall(...args),
}));

// Now import the function we're testing
import {
	executePluginTool,
	type PluginTool,
} from "../lib/commands/mcp/tools.ts";

describe("executePluginTool", () => {
	// Create a sample tool for testing
	const sampleTool: PluginTool = {
		name: "jutsu_bun_test",
		description: "Run Bun tests",
		pluginName: "jutsu-bun",
		hookName: "test",
		pluginRoot: "/path/to/jutsu-bun",
	};

	// Save original console functions
	let originalConsoleLog: typeof console.log;
	let originalConsoleError: typeof console.error;
	let originalEnv: string | undefined;
	let stderrOutput: string[];

	beforeEach(() => {
		// Reset mocks
		mockRunConfiguredHook = mock(() => Promise.resolve());
		mockRecordMcpToolCall = mock(() => {});

		// Save console functions
		originalConsoleLog = console.log;
		originalConsoleError = console.error;

		// Save environment
		originalEnv = process.env.CLAUDE_PLUGIN_ROOT;

		// Capture stderr output
		stderrOutput = [];
		spyOn(process.stderr, "write").mockImplementation(
			(chunk: string | Uint8Array) => {
				if (typeof chunk === "string") {
					stderrOutput.push(chunk);
				}
				return true;
			},
		);
	});

	afterEach(() => {
		// Restore console functions
		console.log = originalConsoleLog;
		console.error = originalConsoleError;

		// Restore environment
		if (originalEnv !== undefined) {
			process.env.CLAUDE_PLUGIN_ROOT = originalEnv;
		} else {
			delete process.env.CLAUDE_PLUGIN_ROOT;
		}
	});

	describe("successful execution", () => {
		test("returns success when hook completes without error", async () => {
			mockRunConfiguredHook = mock(() => Promise.resolve());

			const result = await executePluginTool(sampleTool, {});

			expect(result.success).toBe(true);
			expect(result.output).toBe("Success");
		});

		test("captures console.log output", async () => {
			mockRunConfiguredHook = mock(async () => {
				console.log("Test output line 1");
				console.log("Test output line 2");
			});

			const result = await executePluginTool(sampleTool, {});

			expect(result.success).toBe(true);
			expect(result.output).toContain("Test output line 1");
			expect(result.output).toContain("Test output line 2");
		});

		test("captures console.error output", async () => {
			mockRunConfiguredHook = mock(async () => {
				console.error("Error message");
			});

			const result = await executePluginTool(sampleTool, {});

			expect(result.success).toBe(true);
			expect(result.output).toContain("Error message");
		});

		test("sets CLAUDE_PLUGIN_ROOT environment variable", async () => {
			let capturedPluginRoot: string | undefined;
			mockRunConfiguredHook = mock(async () => {
				capturedPluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
			});

			await executePluginTool(sampleTool, {});

			expect(capturedPluginRoot).toBe(sampleTool.pluginRoot);
		});

		test("streams output to stderr for progress visibility", async () => {
			mockRunConfiguredHook = mock(async () => {
				console.log("Progress update");
			});

			await executePluginTool(sampleTool, {});

			const stderrJoined = stderrOutput.join("");
			expect(stderrJoined).toContain("[jutsu-bun/test]");
			expect(stderrJoined).toContain("Progress update");
		});
	});

	describe("failure handling", () => {
		test("returns failure when hook exits with non-zero code", async () => {
			mockRunConfiguredHook = mock(async () => {
				// Simulate process.exit(1) by throwing the special error
				throw new Error("__EXIT_1__");
			});

			const result = await executePluginTool(sampleTool, {});

			expect(result.success).toBe(false);
		});

		test("returns failure when hook throws an error", async () => {
			mockRunConfiguredHook = mock(async () => {
				throw new Error("Unexpected error");
			});

			const result = await executePluginTool(sampleTool, {});

			expect(result.success).toBe(false);
			expect(result.output).toContain("Unexpected error");
		});

		test("captures error message in output", async () => {
			mockRunConfiguredHook = mock(async () => {
				throw new Error("Specific test error");
			});

			const result = await executePluginTool(sampleTool, {});

			expect(result.output).toContain("Specific test error");
		});

		test("returns 'Failed' for empty output on failure", async () => {
			// Mock that exits with code 1 but produces no output
			mockRunConfiguredHook = mock(async () => {
				throw new Error("__EXIT_1__");
			});

			const result = await executePluginTool(sampleTool, {});

			expect(result.success).toBe(false);
			expect(result.output).toBe("Failed");
		});
	});

	describe("exit code handling", () => {
		test("handles exit code 0 as success", async () => {
			mockRunConfiguredHook = mock(async () => {
				throw new Error("__EXIT_0__");
			});

			const result = await executePluginTool(sampleTool, {});

			expect(result.success).toBe(true);
		});

		test("handles exit code 1 as failure", async () => {
			mockRunConfiguredHook = mock(async () => {
				throw new Error("__EXIT_1__");
			});

			const result = await executePluginTool(sampleTool, {});

			expect(result.success).toBe(false);
		});

		test("handles various non-zero exit codes as failure", async () => {
			for (const exitCode of [2, 127, 255]) {
				mockRunConfiguredHook = mock(async () => {
					throw new Error(`__EXIT_${exitCode}__`);
				});

				const result = await executePluginTool(sampleTool, {});

				expect(result.success).toBe(false);
			}
		});
	});

	describe("options handling", () => {
		test("passes verbose option to runConfiguredHook", async () => {
			let capturedOptions: Record<string, unknown> | undefined;
			mockRunConfiguredHook = mock(async (opts: Record<string, unknown>) => {
				capturedOptions = opts;
			});

			await executePluginTool(sampleTool, { verbose: true });

			expect(capturedOptions?.verbose).toBe(true);
		});

		test("passes failFast option to runConfiguredHook", async () => {
			let capturedOptions: Record<string, unknown> | undefined;
			mockRunConfiguredHook = mock(async (opts: Record<string, unknown>) => {
				capturedOptions = opts;
			});

			await executePluginTool(sampleTool, { failFast: false });

			expect(capturedOptions?.failFast).toBe(false);
		});

		test("passes cache option to runConfiguredHook", async () => {
			let capturedOptions: Record<string, unknown> | undefined;
			mockRunConfiguredHook = mock(async (opts: Record<string, unknown>) => {
				capturedOptions = opts;
			});

			await executePluginTool(sampleTool, { cache: true });

			expect(capturedOptions?.cache).toBe(true);
		});

		test("disables cache when directory is specified", async () => {
			let capturedOptions: Record<string, unknown> | undefined;
			mockRunConfiguredHook = mock(async (opts: Record<string, unknown>) => {
				capturedOptions = opts;
			});

			await executePluginTool(sampleTool, {
				directory: "src",
				cache: true, // Even if cache is true, it should be false when directory is set
			});

			expect(capturedOptions?.cache).toBe(false);
			expect(capturedOptions?.only).toBe("src");
		});

		test("passes directory as 'only' option", async () => {
			let capturedOptions: Record<string, unknown> | undefined;
			mockRunConfiguredHook = mock(async (opts: Record<string, unknown>) => {
				capturedOptions = opts;
			});

			await executePluginTool(sampleTool, { directory: "packages/core" });

			expect(capturedOptions?.only).toBe("packages/core");
		});

		test("passes pluginName and hookName to runConfiguredHook", async () => {
			let capturedOptions: Record<string, unknown> | undefined;
			mockRunConfiguredHook = mock(async (opts: Record<string, unknown>) => {
				capturedOptions = opts;
			});

			await executePluginTool(sampleTool, {});

			expect(capturedOptions?.pluginName).toBe("jutsu-bun");
			expect(capturedOptions?.hookName).toBe("test");
		});
	});

	describe("telemetry recording", () => {
		test("records telemetry on success", async () => {
			mockRunConfiguredHook = mock(() => Promise.resolve());

			await executePluginTool(sampleTool, {});

			expect(mockRecordMcpToolCall).toHaveBeenCalled();
			const calls = mockRecordMcpToolCall.mock.calls;
			expect(calls.length).toBe(1);
			expect(calls[0][0]).toBe("jutsu_bun_test");
			expect(calls[0][1]).toBe(true); // success
			expect(typeof calls[0][2]).toBe("number"); // duration
		});

		test("records telemetry on failure", async () => {
			mockRunConfiguredHook = mock(async () => {
				throw new Error("__EXIT_1__");
			});

			await executePluginTool(sampleTool, {});

			expect(mockRecordMcpToolCall).toHaveBeenCalled();
			const calls = mockRecordMcpToolCall.mock.calls;
			expect(calls[0][1]).toBe(false); // failure
		});

		test("records positive duration", async () => {
			mockRunConfiguredHook = mock(async () => {
				// Small delay to ensure measurable duration
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			await executePluginTool(sampleTool, {});

			const calls = mockRecordMcpToolCall.mock.calls;
			const duration = calls[0][2] as number;
			expect(duration).toBeGreaterThanOrEqual(0);
		});
	});

	describe("console restoration", () => {
		test("restores console.log after execution", async () => {
			const originalLog = console.log;
			mockRunConfiguredHook = mock(() => Promise.resolve());

			await executePluginTool(sampleTool, {});

			// Console should be restored
			expect(console.log).toBe(originalLog);
		});

		test("restores console.error after execution", async () => {
			const originalError = console.error;
			mockRunConfiguredHook = mock(() => Promise.resolve());

			await executePluginTool(sampleTool, {});

			// Console should be restored
			expect(console.error).toBe(originalError);
		});

		test("restores console even on error", async () => {
			const originalLog = console.log;
			mockRunConfiguredHook = mock(async () => {
				throw new Error("Test error");
			});

			await executePluginTool(sampleTool, {});

			expect(console.log).toBe(originalLog);
		});
	});

	describe("timeout handling", () => {
		test("timeout result has idleTimedOut flag", async () => {
			// Save original timeout env
			const originalTimeout = process.env.HAN_MCP_TIMEOUT;

			// Set a very short timeout (50ms)
			process.env.HAN_MCP_TIMEOUT = "50";

			mockRunConfiguredHook = mock(async () => {
				// Simulate a long-running operation
				await new Promise((resolve) => setTimeout(resolve, 200));
			});

			const result = await executePluginTool(sampleTool, {});

			// Restore timeout env
			if (originalTimeout !== undefined) {
				process.env.HAN_MCP_TIMEOUT = originalTimeout;
			} else {
				delete process.env.HAN_MCP_TIMEOUT;
			}

			expect(result.success).toBe(false);
			expect(result.idleTimedOut).toBe(true);
			expect(result.output).toContain("Timeout");
		});

		test("respects HAN_MCP_TIMEOUT environment variable", async () => {
			const originalTimeout = process.env.HAN_MCP_TIMEOUT;

			// Set timeout to 100ms
			process.env.HAN_MCP_TIMEOUT = "100";

			mockRunConfiguredHook = mock(async () => {
				// This should complete before timeout
				await new Promise((resolve) => setTimeout(resolve, 10));
			});

			const result = await executePluginTool(sampleTool, {});

			// Restore
			if (originalTimeout !== undefined) {
				process.env.HAN_MCP_TIMEOUT = originalTimeout;
			} else {
				delete process.env.HAN_MCP_TIMEOUT;
			}

			expect(result.success).toBe(true);
			expect(result.idleTimedOut).toBe(false);
		});
	});

	describe("different plugin types", () => {
		test("handles jutsu plugins", async () => {
			const jutsuTool: PluginTool = {
				name: "jutsu_typescript_typecheck",
				description: "Type-check TypeScript",
				pluginName: "jutsu-typescript",
				hookName: "typecheck",
				pluginRoot: "/path/to/jutsu-typescript",
			};

			mockRunConfiguredHook = mock(() => Promise.resolve());

			const result = await executePluginTool(jutsuTool, {});

			expect(result.success).toBe(true);
		});

		test("handles do plugins", async () => {
			const doTool: PluginTool = {
				name: "do_claude_plugin_development_validate",
				description: "Validate plugin",
				pluginName: "do-claude-plugin-development",
				hookName: "validate",
				pluginRoot: "/path/to/do-plugin",
			};

			mockRunConfiguredHook = mock(() => Promise.resolve());

			const result = await executePluginTool(doTool, {});

			expect(result.success).toBe(true);
		});

		test("handles hashi plugins", async () => {
			const hashiTool: PluginTool = {
				name: "hashi_github_sync",
				description: "Sync with GitHub",
				pluginName: "hashi-github",
				hookName: "sync",
				pluginRoot: "/path/to/hashi-github",
			};

			mockRunConfiguredHook = mock(() => Promise.resolve());

			const result = await executePluginTool(hashiTool, {});

			expect(result.success).toBe(true);
		});
	});

	describe("edge cases", () => {
		test("handles empty tool name", async () => {
			const emptyNameTool: PluginTool = {
				name: "",
				description: "Test",
				pluginName: "test",
				hookName: "hook",
				pluginRoot: "/path",
			};

			mockRunConfiguredHook = mock(() => Promise.resolve());

			const result = await executePluginTool(emptyNameTool, {});

			expect(result.success).toBe(true);
		});

		test("handles multiple log calls", async () => {
			mockRunConfiguredHook = mock(async () => {
				for (let i = 0; i < 10; i++) {
					console.log(`Line ${i}`);
				}
			});

			const result = await executePluginTool(sampleTool, {});

			expect(result.success).toBe(true);
			for (let i = 0; i < 10; i++) {
				expect(result.output).toContain(`Line ${i}`);
			}
		});

		test("handles mixed log and error calls", async () => {
			mockRunConfiguredHook = mock(async () => {
				console.log("Info message");
				console.error("Warning message");
				console.log("More info");
			});

			const result = await executePluginTool(sampleTool, {});

			expect(result.output).toContain("Info message");
			expect(result.output).toContain("Warning message");
			expect(result.output).toContain("More info");
		});

		test("handles log with multiple arguments", async () => {
			mockRunConfiguredHook = mock(async () => {
				console.log("Multiple", "arguments", "here");
			});

			const result = await executePluginTool(sampleTool, {});

			expect(result.output).toContain("Multiple arguments here");
		});
	});
});
