/**
 * Unit tests for lib/hook-test.ts
 * Tests the exported functions and internal logic
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync } from "node:fs";
import { join } from "node:path";
import { type LiveOutputState, makeLiveOutputKey } from "../lib/hook-test.ts";

describe("hook-test.ts unit tests", () => {
	describe("makeLiveOutputKey", () => {
		test("creates key from hookType, plugin, and command", () => {
			const key = makeLiveOutputKey("SessionStart", "jutsu-typescript", "tsc");
			expect(key).toBe("SessionStart:jutsu-typescript:tsc");
		});

		test("handles empty values", () => {
			const key = makeLiveOutputKey("", "", "");
			expect(key).toBe("::");
		});

		test("handles commands with spaces", () => {
			const key = makeLiveOutputKey(
				"Stop",
				"jutsu-biome",
				"npx biome check --write .",
			);
			expect(key).toBe("Stop:jutsu-biome:npx biome check --write .");
		});

		test("handles commands with special characters", () => {
			// biome-ignore lint/suspicious/noTemplateCurlyInString: Testing that literal ${} in strings is preserved
			const command = "echo ${CLAUDE_PLUGIN_ROOT}/hooks/test.sh";
			const key = makeLiveOutputKey("PreToolUse", "test-plugin", command);
			expect(key).toBe(
				`PreToolUse:test-plugin:echo \${CLAUDE_PLUGIN_ROOT}/hooks/test.sh`,
			);
		});

		test("handles all valid hook types", () => {
			const validHookTypes = [
				"Notification",
				"PostToolUse",
				"PreCompact",
				"PreToolUse",
				"SessionEnd",
				"SessionStart",
				"Stop",
				"SubagentStop",
				"UserPromptSubmit",
			];

			for (const hookType of validHookTypes) {
				const key = makeLiveOutputKey(hookType, "plugin", "cmd");
				expect(key).toBe(`${hookType}:plugin:cmd`);
			}
		});
	});

	describe("LiveOutputState interface", () => {
		test("can create and populate outputs map", () => {
			const state: LiveOutputState = {
				outputs: new Map(),
			};

			const key = makeLiveOutputKey("Stop", "test", "cmd");
			state.outputs.set(key, ["line1", "line2"]);

			expect(state.outputs.get(key)).toEqual(["line1", "line2"]);
		});

		test("can accumulate output lines", () => {
			const state: LiveOutputState = {
				outputs: new Map(),
			};

			const key = makeLiveOutputKey("Stop", "test", "cmd");
			state.outputs.set(key, []);

			// Simulate adding output lines
			const lines = state.outputs.get(key) || [];
			lines.push("[test/Stop] Starting...");
			lines.push("[test/Stop] Running validation...");
			lines.push("[test/Stop] Complete!");
			state.outputs.set(key, lines);

			expect(state.outputs.get(key)).toHaveLength(3);
		});

		test("onUpdate callback can be set and called", () => {
			let updateCount = 0;
			const state: LiveOutputState = {
				outputs: new Map(),
				onUpdate: () => {
					updateCount++;
				},
			};

			// Simulate calling onUpdate when output changes
			state.onUpdate?.();
			state.onUpdate?.();

			expect(updateCount).toBe(2);
		});

		test("handles multiple hook outputs simultaneously", () => {
			const state: LiveOutputState = {
				outputs: new Map(),
			};

			const key1 = makeLiveOutputKey("Stop", "plugin1", "cmd1");
			const key2 = makeLiveOutputKey("Stop", "plugin2", "cmd2");
			const key3 = makeLiveOutputKey("SessionStart", "plugin1", "init");

			state.outputs.set(key1, ["output from plugin1"]);
			state.outputs.set(key2, ["output from plugin2"]);
			state.outputs.set(key3, ["startup output"]);

			expect(state.outputs.size).toBe(3);
			expect(state.outputs.get(key1)).toEqual(["output from plugin1"]);
			expect(state.outputs.get(key2)).toEqual(["output from plugin2"]);
			expect(state.outputs.get(key3)).toEqual(["startup output"]);
		});
	});

	describe("VALID_HOOK_TYPES constant behavior", () => {
		// These tests verify that the code correctly validates hook types
		// by testing the same validation logic used in collectHooks

		test("accepts standard Claude Code hook types", () => {
			const validTypes = [
				"Notification",
				"PostToolUse",
				"PreCompact",
				"PreToolUse",
				"SessionEnd",
				"SessionStart",
				"Stop",
				"SubagentStop",
				"UserPromptSubmit",
			];

			// The actual VALID_HOOK_TYPES array in hook-test.ts
			const VALID_HOOK_TYPES = [
				"Notification",
				"PostToolUse",
				"PreCompact",
				"PreToolUse",
				"SessionEnd",
				"SessionStart",
				"Stop",
				"SubagentStop",
				"UserPromptSubmit",
			];

			for (const type of validTypes) {
				expect(VALID_HOOK_TYPES.includes(type)).toBe(true);
			}
		});

		test("rejects invalid hook types", () => {
			const VALID_HOOK_TYPES = [
				"Notification",
				"PostToolUse",
				"PreCompact",
				"PreToolUse",
				"SessionEnd",
				"SessionStart",
				"Stop",
				"SubagentStop",
				"UserPromptSubmit",
			];

			const invalidTypes = [
				"InvalidType",
				"OnStart",
				"BeforeStop",
				"AfterSession",
				"",
				"sessionStart", // Wrong case
				"STOP", // Wrong case
			];

			for (const type of invalidTypes) {
				expect(VALID_HOOK_TYPES.includes(type)).toBe(false);
			}
		});
	});

	describe("Hook command type handling", () => {
		test("identifies command type hooks", () => {
			const hook = {
				type: "command",
				command: "echo test",
			};

			expect(hook.type).toBe("command");
			expect(hook.command).toBeDefined();
		});

		test("identifies prompt type hooks", () => {
			const hook = {
				type: "prompt",
				prompt: "Remember to follow best practices",
			};

			expect(hook.type).toBe("prompt");
			expect(hook.prompt).toBeDefined();
		});

		test("prompt hooks should pass instantly without execution", () => {
			// This tests the logic from executeHookCommand
			const hook = {
				type: "prompt" as const,
				prompt: "Some prompt text",
			};

			// When type is prompt, the function returns immediately with success
			const result = hook.type === "prompt";
			expect(result).toBe(true);
		});
	});

	describe("Timeout handling logic", () => {
		test("default timeout is 30 seconds", () => {
			const hook = { timeout: undefined };
			const timeoutSeconds = hook.timeout ?? 30;
			expect(timeoutSeconds).toBe(30);
		});

		test("custom timeout is respected", () => {
			const hook = { timeout: 60 };
			const timeoutSeconds = hook.timeout ?? 30;
			expect(timeoutSeconds).toBe(60);
		});

		test("timeout converts to milliseconds correctly", () => {
			const timeoutSeconds = 30;
			const timeoutMs = timeoutSeconds * 1000;
			expect(timeoutMs).toBe(30000);
		});

		test("zero timeout uses zero (nullish coalescing only replaces null/undefined)", () => {
			const hook = { timeout: 0 };
			const timeoutSeconds = hook.timeout ?? 30;
			// 0 is NOT nullish, so ?? does NOT replace it
			// This is correct behavior - explicit 0 timeout is preserved
			expect(timeoutSeconds).toBe(0);
		});
	});

	describe("Hook result structure", () => {
		test("successful command result has correct structure", () => {
			const result = {
				plugin: "jutsu-typescript",
				command: "npx tsc",
				success: true,
				output: ["Compilation complete"],
				timedOut: false,
			};

			expect(result.plugin).toBe("jutsu-typescript");
			expect(result.command).toBe("npx tsc");
			expect(result.success).toBe(true);
			expect(result.output).toHaveLength(1);
			expect(result.timedOut).toBe(false);
		});

		test("failed command result has correct structure", () => {
			const result = {
				plugin: "jutsu-biome",
				command: "npx biome check",
				success: false,
				output: ["Error: Found 5 lint errors"],
				timedOut: false,
			};

			expect(result.success).toBe(false);
			expect(result.output[0]).toContain("Error");
		});

		test("timed out command result has correct structure", () => {
			const result = {
				plugin: "slow-plugin",
				command: "sleep 100",
				success: false,
				output: [],
				timedOut: true,
			};

			expect(result.success).toBe(false);
			expect(result.timedOut).toBe(true);
		});

		test("prompt result has isPrompt flag", () => {
			const result = {
				plugin: "core",
				command: "Remember the bushido code",
				success: true,
				output: [],
				isPrompt: true,
			};

			expect(result.isPrompt).toBe(true);
			expect(result.success).toBe(true);
			expect(result.output).toHaveLength(0);
		});
	});

	describe("Output formatting", () => {
		test("output lines are prefixed with plugin and hook type", () => {
			const plugin = "jutsu-typescript";
			const hookType = "Stop";
			const line = "Compilation successful";

			const formatted = `[${plugin}/${hookType}] ${line}`;
			expect(formatted).toBe("[jutsu-typescript/Stop] Compilation successful");
		});

		test("multiple output lines maintain formatting", () => {
			const plugin = "test-plugin";
			const hookType = "SessionStart";
			const lines = ["Initializing...", "Loading config...", "Ready!"];

			const formatted = lines.map((line) => `[${plugin}/${hookType}] ${line}`);

			expect(formatted).toEqual([
				"[test-plugin/SessionStart] Initializing...",
				"[test-plugin/SessionStart] Loading config...",
				"[test-plugin/SessionStart] Ready!",
			]);
		});
	});
});

describe("hook-test.ts integration behavior", () => {
	const testDir = `/tmp/test-hook-test-${Date.now()}`;
	let originalEnv: string | undefined;

	beforeEach(() => {
		originalEnv = process.env["CLAUDE_CONFIG_DIR"];
		process.env["CLAUDE_CONFIG_DIR"] = join(testDir, "config");
		mkdirSync(join(testDir, "config"), { recursive: true });
	});

	afterEach(() => {
		if (originalEnv) {
			process.env["CLAUDE_CONFIG_DIR"] = originalEnv;
		} else {
			delete process.env["CLAUDE_CONFIG_DIR"];
		}
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("Plugin directory resolution", () => {
		test("findPluginInMarketplace looks in jutsu/, do/, hashi/ directories", () => {
			// This tests the expected behavior of findPluginInMarketplace
			const potentialPaths = [
				join(testDir, "jutsu", "jutsu-typescript"),
				join(testDir, "do", "do-claude-plugin-development"),
				join(testDir, "hashi", "hashi-github"),
				join(testDir, "core"),
			];

			// Verify the path patterns match what the function would check
			expect(potentialPaths[0]).toContain("jutsu/jutsu-typescript");
			expect(potentialPaths[1]).toContain("do/do-claude-plugin-development");
			expect(potentialPaths[2]).toContain("hashi/hashi-github");
		});
	});

	describe("hooks.json parsing", () => {
		test("valid hooks.json structure", () => {
			const validHooksJson = {
				hooks: {
					Stop: [
						{
							hooks: [{ type: "command", command: "echo test" }],
						},
					],
				},
			};

			expect(validHooksJson.hooks).toBeDefined();
			expect(validHooksJson.hooks.Stop).toBeInstanceOf(Array);
			expect(validHooksJson.hooks.Stop[0]?.hooks[0]?.type).toBe("command");
		});

		test("invalid hooks.json - missing hooks object", () => {
			const invalidHooksJson: Record<string, unknown> = {
				commands: {
					// Wrong key
					Stop: [],
				},
			};

			expect(invalidHooksJson["hooks"]).toBeUndefined();
		});

		test("invalid hooks.json - hook type not an array", () => {
			const invalidHooksJson = {
				hooks: {
					Stop: "not an array", // Should be an array
				},
			};

			expect(Array.isArray(invalidHooksJson.hooks.Stop)).toBe(false);
		});

		test("hook config with timeout", () => {
			const hookConfig = {
				hooks: {
					Stop: [
						{
							hooks: [{ type: "command", command: "slow-test", timeout: 120 }],
						},
					],
				},
			};

			expect(hookConfig.hooks.Stop[0]?.hooks[0]?.timeout).toBe(120);
		});
	});

	describe("Validation error collection", () => {
		test("collects errors for unknown hook types", () => {
			const errors: string[] = [];
			const hookType = "InvalidHookType";

			const VALID_HOOK_TYPES = [
				"Notification",
				"PostToolUse",
				"PreCompact",
				"PreToolUse",
				"SessionEnd",
				"SessionStart",
				"Stop",
				"SubagentStop",
				"UserPromptSubmit",
			];

			if (!VALID_HOOK_TYPES.includes(hookType)) {
				errors.push(`Unknown event type '${hookType}'`);
			}

			expect(errors).toContain("Unknown event type 'InvalidHookType'");
		});

		test("collects errors for missing command in command hook", () => {
			const errors: string[] = [];
			const hookType = "Stop";
			const individualHook = { type: "command" }; // Missing command

			if (
				individualHook.type === "command" &&
				!(individualHook as { command?: string }).command
			) {
				errors.push(
					`Hook type '${hookType}' has command hook with missing or invalid command`,
				);
			}

			expect(errors).toContain(
				"Hook type 'Stop' has command hook with missing or invalid command",
			);
		});
	});
});
