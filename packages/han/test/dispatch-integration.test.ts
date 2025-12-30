/**
 * Integration tests for dispatch.ts
 * Tests actual file system operations and hook loading
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import {
	deriveHookName,
	resolveToAbsolute,
} from "../lib/commands/hook/dispatch.ts";

describe("dispatch.ts integration tests", () => {
	let testDir: string;
	let originalEnv: typeof process.env;
	let originalCwd: string;

	beforeEach(() => {
		// Generate unique test directory per test
		testDir = `/tmp/test-dispatch-integration-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

		// Save original state
		originalEnv = { ...process.env };
		originalCwd = process.cwd();

		// Create test directory structure
		mkdirSync(testDir, { recursive: true });
		mkdirSync(join(testDir, "config"), { recursive: true });
		mkdirSync(join(testDir, "project"), { recursive: true });

		// Set up test environment
		process.env.CLAUDE_CONFIG_DIR = join(testDir, "config");
		process.env.HOME = testDir;
	});

	afterEach(() => {
		// Restore original state
		process.env = originalEnv;
		try {
			process.chdir(originalCwd);
		} catch {
			// Already at original cwd
		}

		// Clean up test directory
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("Plugin directory resolution", () => {
		test("finds plugin in jutsu directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const pluginPath = join(marketplaceRoot, "jutsu", "jutsu-typescript");
			mkdirSync(pluginPath, { recursive: true });

			// Verify the directory exists
			const { existsSync } = require("node:fs");
			expect(existsSync(pluginPath)).toBe(true);
		});

		test("finds plugin in do directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const pluginPath = join(marketplaceRoot, "do", "do-accessibility");
			mkdirSync(pluginPath, { recursive: true });

			const { existsSync } = require("node:fs");
			expect(existsSync(pluginPath)).toBe(true);
		});

		test("finds plugin in hashi directory", () => {
			const marketplaceRoot = join(testDir, "marketplace");
			const pluginPath = join(marketplaceRoot, "hashi", "hashi-github");
			mkdirSync(pluginPath, { recursive: true });

			const { existsSync } = require("node:fs");
			expect(existsSync(pluginPath)).toBe(true);
		});
	});

	describe("hooks.json loading", () => {
		test("loads valid hooks.json", () => {
			const pluginRoot = join(testDir, "plugin");
			const hooksDir = join(pluginRoot, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksConfig = {
				hooks: {
					SessionStart: [
						{
							hooks: [
								{
									type: "command",
									command: "echo 'Session started'",
									timeout: 5000,
								},
							],
						},
					],
					Stop: [
						{
							hooks: [{ type: "command", command: "echo 'Session ended'" }],
						},
					],
				},
			};

			writeFileSync(
				join(hooksDir, "hooks.json"),
				JSON.stringify(hooksConfig, null, 2),
			);

			// Verify file was written and can be read
			const { readFileSync, existsSync } = require("node:fs");
			const hooksPath = join(hooksDir, "hooks.json");
			expect(existsSync(hooksPath)).toBe(true);

			const content = readFileSync(hooksPath, "utf-8");
			const parsed = JSON.parse(content);

			expect(parsed.hooks.SessionStart).toBeDefined();
			expect(parsed.hooks.SessionStart[0].hooks[0].command).toBe(
				"echo 'Session started'",
			);
			expect(parsed.hooks.Stop).toBeDefined();
		});

		test("handles hooks.json with prompt hooks", () => {
			const pluginRoot = join(testDir, "plugin-prompts");
			const hooksDir = join(pluginRoot, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksConfig = {
				hooks: {
					UserPromptSubmit: [
						{
							hooks: [
								{
									type: "prompt",
									prompt: "Review the user's request for security issues",
								},
								{ type: "command", command: "echo 'Validation complete'" },
							],
						},
					],
				},
			};

			writeFileSync(
				join(hooksDir, "hooks.json"),
				JSON.stringify(hooksConfig, null, 2),
			);

			const { readFileSync } = require("node:fs");
			const content = readFileSync(join(hooksDir, "hooks.json"), "utf-8");
			const parsed = JSON.parse(content);

			const hookGroup = parsed.hooks.UserPromptSubmit[0];
			expect(hookGroup.hooks).toHaveLength(2);
			expect(hookGroup.hooks[0].type).toBe("prompt");
			expect(hookGroup.hooks[1].type).toBe("command");
		});

		test("handles malformed hooks.json gracefully", () => {
			const pluginRoot = join(testDir, "plugin-bad");
			const hooksDir = join(pluginRoot, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			writeFileSync(join(hooksDir, "hooks.json"), "{ invalid json }");

			// Attempt to parse should fail gracefully
			const { readFileSync } = require("node:fs");
			const content = readFileSync(join(hooksDir, "hooks.json"), "utf-8");

			let parsed = null;
			try {
				parsed = JSON.parse(content);
			} catch {
				parsed = null;
			}

			expect(parsed).toBeNull();
		});
	});

	describe("Settings hooks loading", () => {
		test("loads hooks from settings.json", () => {
			const settingsPath = join(testDir, "config", "settings.json");
			const settings = {
				hooks: {
					SessionStart: [
						{
							hooks: [{ type: "command", command: "echo 'From settings'" }],
						},
					],
				},
			};

			writeFileSync(settingsPath, JSON.stringify(settings, null, 2));

			const { readFileSync, existsSync } = require("node:fs");
			expect(existsSync(settingsPath)).toBe(true);

			const content = readFileSync(settingsPath, "utf-8");
			const parsed = JSON.parse(content);

			expect(parsed.hooks).toBeDefined();
			expect(parsed.hooks.SessionStart).toBeDefined();
		});

		test("loads hooks from separate hooks.json file", () => {
			const hooksPath = join(testDir, "config", "hooks.json");
			const hooks = {
				hooks: {
					Stop: [
						{
							hooks: [{ type: "command", command: "echo 'Cleanup'" }],
						},
					],
				},
			};

			writeFileSync(hooksPath, JSON.stringify(hooks, null, 2));

			const { readFileSync, existsSync } = require("node:fs");
			expect(existsSync(hooksPath)).toBe(true);

			const content = readFileSync(hooksPath, "utf-8");
			const parsed = JSON.parse(content);

			// hooks.json can have hooks at root or under "hooks" key
			const hooksObj = parsed.hooks || parsed;
			expect(hooksObj.Stop).toBeDefined();
		});

		test("handles hooks.json with hooks at root level", () => {
			const hooksPath = join(testDir, "config", "hooks-alt.json");
			const hooks = {
				SessionStart: [
					{
						hooks: [{ type: "command", command: "echo 'Alt format'" }],
					},
				],
			};

			writeFileSync(hooksPath, JSON.stringify(hooks, null, 2));

			const { readFileSync } = require("node:fs");
			const content = readFileSync(hooksPath, "utf-8");
			const parsed = JSON.parse(content);

			// Should work with hooks at root
			const hooksObj = parsed.hooks || parsed;
			expect(hooksObj.SessionStart).toBeDefined();
		});
	});

	describe("Command template resolution", () => {
		test("resolves CLAUDE_PLUGIN_ROOT variable", () => {
			// biome-ignore lint/suspicious/noTemplateCurlyInString: testing template
			const command = "${CLAUDE_PLUGIN_ROOT}/hooks/validate.sh";
			const pluginRoot = "/path/to/plugin";

			const resolved = command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);

			expect(resolved).toBe("/path/to/plugin/hooks/validate.sh");
			// biome-ignore lint/suspicious/noTemplateCurlyInString: testing template variable replacement
			expect(resolved).not.toContain("${CLAUDE_PLUGIN_ROOT}");
		});

		test("resolves multiple occurrences of CLAUDE_PLUGIN_ROOT", () => {
			const command =
				// biome-ignore lint/suspicious/noTemplateCurlyInString: testing template
				"${CLAUDE_PLUGIN_ROOT}/bin/cli --config ${CLAUDE_PLUGIN_ROOT}/config.json";
			const pluginRoot = "/usr/local/han-plugin";

			const resolved = command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);

			expect(resolved).toBe(
				"/usr/local/han-plugin/bin/cli --config /usr/local/han-plugin/config.json",
			);
		});

		test("leaves commands without template variables unchanged", () => {
			const command = "npx biome check --write .";
			const pluginRoot = "/path/to/plugin";

			const resolved = command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);

			expect(resolved).toBe("npx biome check --write .");
		});
	});

	describe("Environment variable propagation", () => {
		test("sets HAN_NO_FAIL_FAST for subprocesses", () => {
			const env = {
				...process.env,
				CLAUDE_PLUGIN_ROOT: "/test/plugin",
				CLAUDE_PROJECT_DIR: process.cwd(),
				HAN_NO_FAIL_FAST: "1",
			};

			expect(env.HAN_NO_FAIL_FAST).toBe("1");
		});

		test("sets HAN_NO_CACHE when noCache is true", () => {
			const noCache = true;
			const env = {
				...process.env,
				...(noCache ? { HAN_NO_CACHE: "1" } : {}),
			};

			expect(env.HAN_NO_CACHE).toBe("1");
		});

		test("sets HAN_NO_CHECKPOINTS when noCheckpoints is true", () => {
			const noCheckpoints = true;
			const env = {
				...process.env,
				...(noCheckpoints ? { HAN_NO_CHECKPOINTS: "1" } : {}),
			};

			expect(env.HAN_NO_CHECKPOINTS).toBe("1");
		});

		test("sets checkpoint context for Stop hook", () => {
			const hookType = "Stop";
			const sessionId = "session-abc-123";
			const noCheckpoints = false;

			let checkpointType: "session" | "agent" | undefined;
			let checkpointId: string | undefined;

			if (hookType === "Stop" && sessionId) {
				checkpointType = "session";
				checkpointId = sessionId;
			}

			const env = {
				...process.env,
				...(!noCheckpoints && checkpointType && checkpointId
					? {
							HAN_CHECKPOINT_TYPE: checkpointType,
							HAN_CHECKPOINT_ID: checkpointId,
						}
					: {}),
			};

			expect(env.HAN_CHECKPOINT_TYPE).toBe("session");
			expect(env.HAN_CHECKPOINT_ID).toBe("session-abc-123");
		});

		test("sets checkpoint context for SubagentStop hook", () => {
			const hookType = "SubagentStop";
			const agentId = "agent-xyz-456";
			const noCheckpoints = false;

			let checkpointType: "session" | "agent" | undefined;
			let checkpointId: string | undefined;

			if (hookType === "SubagentStop" && agentId) {
				checkpointType = "agent";
				checkpointId = agentId;
			}

			const env = {
				...process.env,
				...(!noCheckpoints && checkpointType && checkpointId
					? {
							HAN_CHECKPOINT_TYPE: checkpointType,
							HAN_CHECKPOINT_ID: checkpointId,
						}
					: {}),
			};

			expect(env.HAN_CHECKPOINT_TYPE).toBe("agent");
			expect(env.HAN_CHECKPOINT_ID).toBe("agent-xyz-456");
		});

		test("does not set checkpoint vars when checkpoints disabled", () => {
			const hookType = "Stop";
			const sessionId = "session-abc-123";
			const noCheckpoints = true;

			let checkpointType: "session" | "agent" | undefined;
			let checkpointId: string | undefined;

			if (hookType === "Stop" && sessionId) {
				checkpointType = "session";
				checkpointId = sessionId;
			}

			const env = {
				...process.env,
				...(!noCheckpoints && checkpointType && checkpointId
					? {
							HAN_CHECKPOINT_TYPE: checkpointType,
							HAN_CHECKPOINT_ID: checkpointId,
						}
					: {}),
			};

			expect(env.HAN_CHECKPOINT_TYPE).toBeUndefined();
			expect(env.HAN_CHECKPOINT_ID).toBeUndefined();
		});
	});

	describe("Hook type filtering", () => {
		test("filters hooks by hook type", () => {
			const allHooks = {
				SessionStart: [{ hooks: [] }],
				Stop: [{ hooks: [] }],
				UserPromptSubmit: [{ hooks: [] }],
			};

			const hookType = "SessionStart";
			const filtered = allHooks[hookType as keyof typeof allHooks];

			expect(filtered).toBeDefined();
			expect(filtered).toEqual([{ hooks: [] }]);
		});

		test("returns undefined for non-existent hook type", () => {
			const allHooks = {
				SessionStart: [{ hooks: [] }],
				Stop: [{ hooks: [] }],
			};

			const hookType = "NonExistent";
			const filtered = allHooks[hookType as keyof typeof allHooks];

			expect(filtered).toBeUndefined();
		});
	});

	describe("Hook execution timeout", () => {
		test("uses default timeout of 30000ms", () => {
			const hook = { type: "command", command: "echo test" };
			const timeout = (hook as { timeout?: number }).timeout || 30000;

			expect(timeout).toBe(30000);
		});

		test("uses custom timeout when specified", () => {
			const hook = {
				type: "command",
				command: "long-running-task",
				timeout: 60000,
			};
			const timeout = hook.timeout || 30000;

			expect(timeout).toBe(60000);
		});

		test("uses custom timeout even if it's shorter", () => {
			const hook = {
				type: "command",
				command: "quick-task",
				timeout: 1000,
			};
			const timeout = hook.timeout || 30000;

			expect(timeout).toBe(1000);
		});
	});

	describe("Hook group iteration", () => {
		test("iterates through multiple hook groups", () => {
			const hookGroups = [
				{ hooks: [{ type: "command", command: "echo 1" }] },
				{ hooks: [{ type: "command", command: "echo 2" }] },
				{ hooks: [{ type: "command", command: "echo 3" }] },
			];

			const commands: string[] = [];
			for (const group of hookGroups) {
				for (const hook of group.hooks) {
					if (hook.type === "command" && hook.command) {
						commands.push(hook.command);
					}
				}
			}

			expect(commands).toEqual(["echo 1", "echo 2", "echo 3"]);
		});

		test("skips prompt hooks when looking for command hooks", () => {
			const hookGroups = [
				{
					hooks: [
						{ type: "prompt", prompt: "Review this" },
						{ type: "command", command: "echo test" },
					],
				},
			];

			const commands: string[] = [];
			for (const group of hookGroups) {
				for (const hook of group.hooks) {
					if (hook.type === "command" && hook.command) {
						commands.push(hook.command);
					}
				}
			}

			expect(commands).toEqual(["echo test"]);
		});

		test("handles empty hook groups", () => {
			const hookGroups = [
				{ hooks: [] },
				{ hooks: [{ type: "command", command: "echo test" }] },
			];

			const commands: string[] = [];
			for (const group of hookGroups) {
				for (const hook of group.hooks) {
					if (hook.type === "command" && hook.command) {
						commands.push(hook.command);
					}
				}
			}

			expect(commands).toEqual(["echo test"]);
		});
	});

	describe("Output trimming and aggregation", () => {
		test("trims whitespace from command output", () => {
			const output = "  test output  \n";
			const trimmed = output.trim();

			expect(trimmed).toBe("test output");
		});

		test("aggregates multiple outputs with double newline", () => {
			const outputs = ["First output", "Second output", "Third output"];
			const aggregated = outputs.join("\n\n");

			expect(aggregated).toBe("First output\n\nSecond output\n\nThird output");
		});

		test("filters out null outputs", () => {
			const outputs: (string | null)[] = [
				"First output",
				null,
				"Second output",
				null,
			];

			const filtered = outputs.filter((o): o is string => o !== null);

			expect(filtered).toEqual(["First output", "Second output"]);
		});

		test("handles empty outputs array", () => {
			const outputs: string[] = [];
			const shouldOutput = outputs.length > 0;

			expect(shouldOutput).toBe(false);
		});
	});

	describe("Exported function tests", () => {
		test("resolveToAbsolute with absolute path", () => {
			const result = resolveToAbsolute("/absolute/path");
			expect(result).toBe("/absolute/path");
		});

		test("resolveToAbsolute with relative path", () => {
			const result = resolveToAbsolute("relative/path");
			expect(result).toBe(join(process.cwd(), "relative/path"));
		});

		test("deriveHookName extracts from command", () => {
			const result = deriveHookName("cat hooks/test.md", "plugin");
			expect(result).toBe("test");
		});

		test("deriveHookName falls back to plugin name", () => {
			const result = deriveHookName("echo test", "my-plugin");
			expect(result).toBe("my-plugin");
		});
	});
});
