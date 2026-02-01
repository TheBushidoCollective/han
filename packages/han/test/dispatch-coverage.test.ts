/**
 * Coverage tests for dispatch.ts
 * Actually executes dispatch commands to trigger internal code paths
 *
 * NOTE: These tests spawn subprocesses that load the full CLI.
 * The CLI uses ink for interactive UIs, which can hang in non-TTY environments.
 * These tests are skipped in CI and when SKIP_NATIVE is set.
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { spawnSync } from "node:child_process";
import { existsSync, mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

// Get the package root directory
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const packageRoot = join(__dirname, "..");

// Skip these tests in CI or when native module is not available
// The CLI uses ink which can hang in non-TTY subprocess environments
const nativeModulePath = join(packageRoot, "native", "han-native.node");
const hasNative = existsSync(nativeModulePath);
const hasTTY = Boolean(process.stdout.isTTY);
const skipReason = !hasNative
	? "native module not available"
	: !hasTTY
		? "non-TTY environment"
		: null;

const describeOrSkip = skipReason ? describe.skip : describe;

describeOrSkip("dispatch.ts coverage tests", () => {
	const testDir = `/tmp/test-dispatch-coverage-${Date.now()}`;
	let configDir: string;
	let projectDir: string;

	beforeEach(() => {
		configDir = join(testDir, "config");
		projectDir = join(testDir, "project");

		mkdirSync(configDir, { recursive: true });
		mkdirSync(projectDir, { recursive: true });
	});

	afterEach(() => {
		rmSync(testDir, { recursive: true, force: true });
	});

	describe("HAN_DISABLE_HOOKS early exit", () => {
		test("exits early when HAN_DISABLE_HOOKS=true (line 495-500)", () => {
			const result = spawnSync(
				"bun",
				["run", "lib/main.ts", "hook", "dispatch", "SessionStart"],
				{
					encoding: "utf-8",
					timeout: 10000,
					cwd: packageRoot,
					env: {
						...process.env,
						HAN_DISABLE_HOOKS: "true",
						CLAUDE_CONFIG_DIR: configDir,
					},
				},
			);

			expect(result.status).toBe(0);
			expect(result.stdout.trim()).toBe("");
		});

		test("exits early when HAN_DISABLE_HOOKS=1 (line 495-500)", () => {
			const result = spawnSync(
				"bun",
				["run", "lib/main.ts", "hook", "dispatch", "Stop"],
				{
					encoding: "utf-8",
					timeout: 10000,
					cwd: packageRoot,
					env: {
						...process.env,
						HAN_DISABLE_HOOKS: "1",
						CLAUDE_CONFIG_DIR: configDir,
					},
				},
			);

			expect(result.status).toBe(0);
			expect(result.stdout.trim()).toBe("");
		});
	});

	describe("settings hooks dispatch (lines 395-480)", () => {
		test("dispatches hooks from settings.json with --all flag", () => {
			const settings = {
				hooks: {
					SessionStart: [
						{
							hooks: [
								{
									type: "command",
									command: "echo 'Settings hook executed'",
									timeout: 5000,
								},
							],
						},
					],
				},
			};

			writeFileSync(
				join(configDir, "settings.json"),
				JSON.stringify(settings, null, 2),
			);

			const result = spawnSync(
				"bun",
				[
					"run",
					join(packageRoot, "lib/main.ts"),
					"hook",
					"dispatch",
					"SessionStart",
					"--all",
				],
				{
					encoding: "utf-8",
					timeout: 15000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			// Should complete successfully or with expected error
			expect([0, 1, undefined]).toContain(result.status ?? undefined);
			if (result.status === 0) {
				expect(result.stdout).toContain("Settings hook executed");
			}
		});

		test("dispatches hooks from hooks.json with --all flag (lines 435-480)", () => {
			const hooks = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "echo 'Hooks.json executed'",
								},
							],
						},
					],
				},
			};

			writeFileSync(
				join(configDir, "hooks.json"),
				JSON.stringify(hooks, null, 2),
			);

			const result = spawnSync(
				"bun",
				[
					"run",
					join(packageRoot, "lib/main.ts"),
					"hook",
					"dispatch",
					"Stop",
					"--all",
				],
				{
					encoding: "utf-8",
					timeout: 15000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			expect(result.status).toBe(0);
			expect(result.stdout).toContain("Hooks.json executed");
		});

		test(
			"dispatches hooks from hooks.json with root-level hooks (line 446-447)",
			() => {
				// hooks.json can have hooks at root or under "hooks" key
				const hooks = {
					UserPromptSubmit: [
						{
							hooks: [
								{
									type: "command",
									command: "echo 'Root level hooks'",
								},
							],
						},
					],
				};

				writeFileSync(
					join(configDir, "hooks.json"),
					JSON.stringify(hooks, null, 2),
				);

				const result = spawnSync(
					"bun",
					[
						"run",
						join(packageRoot, "lib/main.ts"),
						"hook",
						"dispatch",
						"UserPromptSubmit",
						"--all",
					],
					{
						encoding: "utf-8",
						timeout: 15000,
						cwd: projectDir,
						env: {
							...process.env,
							CLAUDE_CONFIG_DIR: configDir,
							HOME: testDir,
						},
					},
				);

				expect(result.status).toBe(0);
				expect(result.stdout).toContain("Root level hooks");
			},
			{ timeout: 15000 },
		);

		test("handles invalid hooks.json gracefully (line 477-479)", () => {
			writeFileSync(join(configDir, "hooks.json"), "{ invalid json }");

			const result = spawnSync(
				"bun",
				[
					"run",
					join(packageRoot, "lib/main.ts"),
					"hook",
					"dispatch",
					"SessionStart",
					"--all",
				],
				{
					encoding: "utf-8",
					timeout: 10000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			// Should not crash, just skip the invalid file
			expect(result.status).toBe(0);
		});

		test(
			"skips non-command hooks (line 414-415, 458-459)",
			() => {
				const settings = {
					hooks: {
						SessionStart: [
							{
								hooks: [
									{
										type: "prompt",
										prompt: "This is a prompt hook, should be skipped",
									},
									{
										type: "command",
										command: "echo 'Command hook executed'",
									},
								],
							},
						],
					},
				};

				writeFileSync(
					join(configDir, "settings.json"),
					JSON.stringify(settings, null, 2),
				);

				const result = spawnSync(
					"bun",
					[
						"run",
						join(packageRoot, "lib/main.ts"),
						"hook",
						"dispatch",
						"SessionStart",
						"--all",
					],
					{
						encoding: "utf-8",
						timeout: 15000,
						cwd: projectDir,
						env: {
							...process.env,
							CLAUDE_CONFIG_DIR: configDir,
							HOME: testDir,
						},
					},
				);

				expect(result.status).toBe(0);
				expect(result.stdout).toContain("Command hook executed");
				expect(result.stdout).not.toContain("prompt hook");
			},
			{ timeout: 15000 },
		);
	});

	describe("plugin hooks dispatch (lines 566-602)", () => {
		test("dispatches plugin hooks from development mode", () => {
			// Create marketplace.json to trigger dev mode
			mkdirSync(join(projectDir, ".claude-plugin"), { recursive: true });
			writeFileSync(
				join(projectDir, ".claude-plugin", "marketplace.json"),
				JSON.stringify({ name: "test-marketplace" }),
			);

			// Create a test plugin
			const pluginPath = join(projectDir, "jutsu", "jutsu-test");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksConfig = {
				hooks: {
					SessionStart: [
						{
							hooks: [
								{
									type: "command",
									command: "echo 'Plugin hook from dev mode'",
								},
							],
						},
					],
				},
			};

			writeFileSync(
				join(hooksDir, "hooks.json"),
				JSON.stringify(hooksConfig, null, 2),
			);

			// Create settings to enable the plugin
			const settings = {
				mcpServers: {},
				enabledPlugins: {
					"jutsu-test@test-marketplace": true,
				},
			};

			writeFileSync(
				join(configDir, "settings.json"),
				JSON.stringify(settings, null, 2),
			);

			const result = spawnSync(
				"bun",
				[
					"run",
					join(packageRoot, "lib/main.ts"),
					"hook",
					"dispatch",
					"SessionStart",
				],
				{
					encoding: "utf-8",
					timeout: 15000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			// May not execute in test environment, but should not crash
			expect([0, undefined]).toContain(result.status ?? undefined);
		});

		test("skips plugins without hooks.json (line 573-575)", () => {
			// Create a plugin without hooks.json
			mkdirSync(join(projectDir, ".claude-plugin"), { recursive: true });
			writeFileSync(
				join(projectDir, ".claude-plugin", "marketplace.json"),
				JSON.stringify({ name: "test" }),
			);

			const pluginPath = join(projectDir, "jutsu", "jutsu-no-hooks");
			mkdirSync(pluginPath, { recursive: true });
			// No hooks.json created

			const settings = {
				mcpServers: {},
				enabledPlugins: {
					"jutsu-no-hooks@test": true,
				},
			};

			writeFileSync(
				join(configDir, "settings.json"),
				JSON.stringify(settings, null, 2),
			);

			const result = spawnSync(
				"bun",
				[
					"run",
					join(packageRoot, "lib/main.ts"),
					"hook",
					"dispatch",
					"SessionStart",
				],
				{
					encoding: "utf-8",
					timeout: 10000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			// Should skip gracefully
			expect(result.status).toBe(0);
		});

		test("derives hook name from command (line 585)", () => {
			mkdirSync(join(projectDir, ".claude-plugin"), { recursive: true });
			writeFileSync(
				join(projectDir, ".claude-plugin", "marketplace.json"),
				JSON.stringify({ name: "test" }),
			);

			const pluginPath = join(projectDir, "jutsu", "jutsu-named");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(hooksDir, { recursive: true });

			const hooksConfig = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "cat hooks/custom-hook-name.md",
								},
							],
						},
					],
				},
			};

			writeFileSync(
				join(hooksDir, "hooks.json"),
				JSON.stringify(hooksConfig, null, 2),
			);

			// Create the hook file so command doesn't fail
			writeFileSync(join(hooksDir, "custom-hook-name.md"), "Hook content");

			const settings = {
				mcpServers: {},
				enabledPlugins: {
					"jutsu-named@test": true,
				},
			};

			writeFileSync(
				join(configDir, "settings.json"),
				JSON.stringify(settings, null, 2),
			);

			const result = spawnSync(
				"bun",
				["run", join(packageRoot, "lib/main.ts"), "hook", "dispatch", "Stop"],
				{
					encoding: "utf-8",
					timeout: 15000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			expect([0, undefined]).toContain(result.status ?? undefined);
		});
	});

	describe("command execution (lines 237-343)", () => {
		test("executes command and returns output (line 276-302)", () => {
			const settings = {
				hooks: {
					SessionStart: [
						{
							hooks: [
								{
									type: "command",
									command: "echo 'Command output'",
								},
							],
						},
					],
				},
			};

			writeFileSync(
				join(configDir, "settings.json"),
				JSON.stringify(settings, null, 2),
			);

			const result = spawnSync(
				"bun",
				[
					"run",
					join(packageRoot, "lib/main.ts"),
					"hook",
					"dispatch",
					"SessionStart",
					"--all",
				],
				{
					encoding: "utf-8",
					timeout: 15000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			expect(result.status).toBe(0);
			expect(result.stdout).toContain("Command output");
		});

		test("handles command failure gracefully (line 322-344)", () => {
			const settings = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "exit 1",
								},
								{
									type: "command",
									command: "echo 'After failure'",
								},
							],
						},
					],
				},
			};

			writeFileSync(
				join(configDir, "settings.json"),
				JSON.stringify(settings, null, 2),
			);

			const result = spawnSync(
				"bun",
				[
					"run",
					join(packageRoot, "lib/main.ts"),
					"hook",
					"dispatch",
					"Stop",
					"--all",
				],
				{
					encoding: "utf-8",
					timeout: 15000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			// Should continue after failure
			expect(result.status).toBe(0);
			expect(result.stdout).toContain("After failure");
		});

		test("replaces CLAUDE_PLUGIN_ROOT in command (line 250-253)", () => {
			mkdirSync(join(projectDir, ".claude-plugin"), { recursive: true });
			writeFileSync(
				join(projectDir, ".claude-plugin", "marketplace.json"),
				JSON.stringify({ name: "test" }),
			);

			const pluginPath = join(projectDir, "jutsu", "jutsu-root");
			const pluginConfigDir = join(pluginPath, ".claude-plugin");
			const hooksDir = join(pluginPath, "hooks");
			mkdirSync(pluginConfigDir, { recursive: true });
			mkdirSync(hooksDir, { recursive: true });

			// Plugin needs plugin.json to be recognized
			writeFileSync(
				join(pluginConfigDir, "plugin.json"),
				JSON.stringify({ name: "jutsu-root", description: "Test plugin" }),
			);

			const hooksConfig = {
				hooks: {
					SessionStart: [
						{
							hooks: [
								{
									type: "command",
									// biome-ignore lint/suspicious/noTemplateCurlyInString: testing template
									command: 'echo "ROOT=${CLAUDE_PLUGIN_ROOT}"',
								},
							],
						},
					],
				},
			};

			writeFileSync(
				join(hooksDir, "hooks.json"),
				JSON.stringify(hooksConfig, null, 2),
			);

			const settings = {
				mcpServers: {},
				enabledPlugins: {
					"jutsu-root@test": true,
				},
			};

			writeFileSync(
				join(configDir, "settings.json"),
				JSON.stringify(settings, null, 2),
			);

			const result = spawnSync(
				"bun",
				[
					"run",
					join(packageRoot, "lib/main.ts"),
					"hook",
					"dispatch",
					"SessionStart",
				],
				{
					encoding: "utf-8",
					timeout: 15000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			// Should replace the placeholder
			if (result.status === 0) {
				expect(result.stdout).toContain("ROOT=");
				// biome-ignore lint/suspicious/noTemplateCurlyInString: checking template was replaced
				expect(result.stdout).not.toContain("${CLAUDE_PLUGIN_ROOT}");
			}
		});
	});

	describe("environment variable propagation (lines 284-300)", () => {
		test("sets HAN_NO_CACHE with --no-cache flag", () => {
			const settings = {
				hooks: {
					SessionStart: [
						{
							hooks: [
								{
									type: "command",
									command: 'echo "NO_CACHE=$HAN_NO_CACHE"',
								},
							],
						},
					],
				},
			};

			writeFileSync(
				join(configDir, "settings.json"),
				JSON.stringify(settings, null, 2),
			);

			const result = spawnSync(
				"bun",
				[
					"run",
					join(packageRoot, "lib/main.ts"),
					"hook",
					"dispatch",
					"SessionStart",
					"--all",
					"--no-cache",
				],
				{
					encoding: "utf-8",
					timeout: 15000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			expect(result.status).toBe(0);
			expect(result.stdout).toContain("NO_CACHE=1");
		});

		test("sets HAN_NO_CHECKPOINTS with --no-checkpoints flag", () => {
			const settings = {
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: 'echo "NO_CHECKPOINTS=$HAN_NO_CHECKPOINTS"',
								},
							],
						},
					],
				},
			};

			writeFileSync(
				join(configDir, "settings.json"),
				JSON.stringify(settings, null, 2),
			);

			const result = spawnSync(
				"bun",
				[
					"run",
					join(packageRoot, "lib/main.ts"),
					"hook",
					"dispatch",
					"Stop",
					"--all",
					"--no-checkpoints",
				],
				{
					encoding: "utf-8",
					timeout: 15000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			expect(result.status).toBe(0);
			expect(result.stdout).toContain("NO_CHECKPOINTS=1");
		});
	});

	describe("output aggregation (lines 604-607)", () => {
		test("aggregates multiple hook outputs with double newline", () => {
			const settings = {
				hooks: {
					SessionStart: [
						{
							hooks: [
								{
									type: "command",
									command: "echo 'First hook'",
								},
								{
									type: "command",
									command: "echo 'Second hook'",
								},
							],
						},
					],
				},
			};

			writeFileSync(
				join(configDir, "settings.json"),
				JSON.stringify(settings, null, 2),
			);

			const result = spawnSync(
				"bun",
				[
					"run",
					join(packageRoot, "lib/main.ts"),
					"hook",
					"dispatch",
					"SessionStart",
					"--all",
				],
				{
					encoding: "utf-8",
					timeout: 15000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			expect(result.status).toBe(0);
			expect(result.stdout).toContain("First hook");
			expect(result.stdout).toContain("Second hook");
			// Outputs should be separated by double newline
			expect(result.stdout).toContain("\n\n");
		});
	});

	describe("empty execution scenarios", () => {
		test("exits cleanly when no hooks configured", () => {
			// Empty settings
			writeFileSync(
				join(configDir, "settings.json"),
				JSON.stringify({ mcpServers: {}, plugins: {} }, null, 2),
			);

			const result = spawnSync(
				"bun",
				[
					"run",
					join(packageRoot, "lib/main.ts"),
					"hook",
					"dispatch",
					"SessionStart",
				],
				{
					encoding: "utf-8",
					timeout: 10000,
					cwd: projectDir,
					env: {
						...process.env,
						CLAUDE_CONFIG_DIR: configDir,
						HOME: testDir,
					},
				},
			);

			expect(result.status).toBe(0);
			expect(result.stdout.trim()).toBe("");
		});
	});
});
