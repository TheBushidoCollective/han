import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	type ExecSyncOptionsWithStringEncoding,
	execSync,
} from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePluginRecommendations } from "../lib/shared/index.ts";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine which binary to test
// In CI (GitHub Actions), test source since binary build requires native modules
// Locally, test binary if it exists, otherwise test source
const IS_CI = process.env.CI === "true";

// Detect if running from compiled JavaScript (dist/test/) vs TypeScript source (test/)
// __dirname will be dist/test/ when running compiled JS, test/ when running TS
const isRunningFromDist = __dirname.includes("/dist/");
const projectRoot = isRunningFromDist
	? join(__dirname, "..", "..") // dist/test/ -> project root
	: join(__dirname, ".."); // test/ -> project root
const binaryPath = join(projectRoot, "dist", "han");
const sourcePath = join(projectRoot, "lib", "main.ts");

const USE_SOURCE =
	process.env.HAN_TEST_SOURCE === "true" || IS_CI || !existsSync(binaryPath);
const binPath = USE_SOURCE ? sourcePath : binaryPath;
const binCommand = USE_SOURCE ? `bun ${binPath}` : binPath;

// Skip tests that require native module when SKIP_NATIVE is set
// han hook run uses getGitBranch() which requires the native module
const SKIP_NATIVE = process.env.SKIP_NATIVE === "true";
const testWithNative = SKIP_NATIVE ? test.skip : test;

console.log(`\nTesting: ${USE_SOURCE ? "Source (bun)" : "Binary (bun)"}`);
console.log(`Path: ${binPath}\n`);

function setup(): string {
	const random = Math.random().toString(36).substring(2, 9);
	const testDir = join(tmpdir(), `han-test-${Date.now()}-${random}`);
	mkdirSync(testDir, { recursive: true });
	return testDir;
}

function teardown(testDir: string): void {
	// Clean up only this test's temp directory
	if (testDir && existsSync(testDir)) {
		try {
			rmSync(testDir, { recursive: true, force: true });
		} catch {
			// Ignore cleanup errors
		}
	}
}

interface ExecError extends Error {
	status?: number;
	code?: number;
	stderr?: Buffer | string;
	stdout?: Buffer | string;
}

// Binary tests need longer timeout due to startup time and potential native extension rebuilds (~27s)
const BINARY_TIMEOUT = 45000;

// ============================================
// Basic CLI tests
// ============================================

describe("Basic CLI", () => {
	test(
		"shows version",
		() => {
			const output = execSync(`${binCommand} --version`, {
				encoding: "utf8",
				timeout: 30000,
			});
			// Version output now starts with "han X.X.X" and includes binary info
			expect(/^han \d+\.\d+\.\d+/.test(output.trim())).toBe(true);
		},
		{ timeout: BINARY_TIMEOUT },
	);

	test(
		"shows help when no command provided",
		() => {
			const output = execSync(`${binCommand} --help`, {
				encoding: "utf8",
				timeout: 30000,
			});
			expect(output).toContain("Usage:");
			expect(output).toContain("han");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	test(
		"shows plugin command help",
		() => {
			const output = execSync(`${binCommand} plugin --help`, {
				encoding: "utf8",
			});
			expect(output).toContain("install");
			expect(output).toContain("uninstall");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	test(
		"shows hook command help",
		() => {
			const output = execSync(`${binCommand} hook --help`, {
				encoding: "utf8",
			});
			expect(output).toContain("run");
			// Note: 'explain' only registers in TTY mode, use 'list' which is always available
			expect(output).toContain("list");
		},
		{ timeout: BINARY_TIMEOUT },
	);
});

// ============================================
// HAN_DISABLE_HOOKS tests
// ============================================

describe("HAN_DISABLE_HOOKS", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = setup();
	});

	afterEach(() => {
		teardown(testDir);
	});

	test(
		"causes hook run to exit 0 silently",
		() => {
			mkdirSync(join(testDir, "pkg1"));
			writeFileSync(join(testDir, "pkg1", "package.json"), "{}");

			const output = execSync(
				`${binCommand} hook run --dirs-with package.json -- echo should-not-run`,
				{
					cwd: testDir,
					encoding: "utf8",
					env: { ...process.env, HAN_DISABLE_HOOKS: "1" },
				} as ExecSyncOptionsWithStringEncoding,
			);

			expect(output.trim()).toBe("");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	test(
		"causes hook dispatch to exit 0 silently",
		() => {
			const output = execSync(`${binCommand} hook dispatch Stop`, {
				encoding: "utf8",
				env: { ...process.env, HAN_DISABLE_HOOKS: "1" },
			});

			expect(output.trim()).toBe("");
		},
		{ timeout: BINARY_TIMEOUT },
	);
});

// ============================================
// Hook verify tests
// ============================================

// Hook verify command was removed - tests for non-existent command removed

// ============================================
// Hook run tests
// ============================================

describe("Hook run", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = setup();
	});

	afterEach(() => {
		teardown(testDir);
	});

	testWithNative(
		"shows error when no plugin name or hook name",
		() => {
			expect(() => {
				execSync(`${binCommand} hook run`, { encoding: "utf8", stdio: "pipe" });
			}).toThrow();
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"passes when no directories match filter",
		() => {
			const output = execSync(
				`${binCommand} hook run --dirs-with nonexistent.txt -- echo test`,
				{ cwd: testDir, encoding: "utf8" } as ExecSyncOptionsWithStringEncoding,
			);
			expect(output).toContain("No directories found with nonexistent.txt");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"runs command in matching directories",
		() => {
			mkdirSync(join(testDir, "pkg1"));
			mkdirSync(join(testDir, "pkg2"));
			writeFileSync(join(testDir, "pkg1", "package.json"), "{}");
			writeFileSync(join(testDir, "pkg2", "package.json"), "{}");

			execSync("git init", { cwd: testDir, stdio: "pipe" });
			execSync("git add .", { cwd: testDir, stdio: "pipe" });

			const output = execSync(
				`${binCommand} hook run --dirs-with package.json -- echo success`,
				{
					cwd: testDir,
					encoding: "utf8",
					stdio: ["pipe", "pipe", "pipe"],
				} as ExecSyncOptionsWithStringEncoding,
			);

			expect(output).toContain("passed");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"fails with exit code 2 when command fails",
		() => {
			mkdirSync(join(testDir, "pkg1"));
			writeFileSync(join(testDir, "pkg1", "package.json"), "{}");

			execSync("git init", { cwd: testDir, stdio: "pipe" });
			execSync("git add .", { cwd: testDir, stdio: "pipe" });

			let exitCode: number | undefined;
			try {
				execSync(`${binCommand} hook run --dirs-with package.json -- exit 1`, {
					cwd: testDir,
					encoding: "utf8",
					stdio: "pipe",
				});
			} catch (error) {
				const execError = error as ExecError;
				exitCode = execError.status || execError.code;
			}

			expect(exitCode).toBe(2);
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"stops on first failure with --fail-fast",
		() => {
			mkdirSync(join(testDir, "pkg1"));
			mkdirSync(join(testDir, "pkg2"));
			writeFileSync(join(testDir, "pkg1", "package.json"), "{}");
			writeFileSync(join(testDir, "pkg2", "package.json"), "{}");

			execSync("git init", { cwd: testDir, stdio: "pipe" });
			execSync("git add .", { cwd: testDir, stdio: "pipe" });

			let exitCode: number | undefined;
			try {
				execSync(
					`${binCommand} hook run --fail-fast --dirs-with package.json -- exit 1`,
					{ cwd: testDir, encoding: "utf8", stdio: "pipe" },
				);
			} catch (error) {
				const execError = error as ExecError;
				exitCode = execError.status || execError.code;
			}

			expect(exitCode).toBe(2);
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"respects --test-dir flag to filter directories",
		() => {
			mkdirSync(join(testDir, "with-marker"));
			mkdirSync(join(testDir, "without-marker"));
			writeFileSync(join(testDir, "with-marker", "package.json"), "{}");
			writeFileSync(join(testDir, "without-marker", "package.json"), "{}");
			writeFileSync(join(testDir, "with-marker", "marker.txt"), "marker");

			execSync("git init", { cwd: testDir, stdio: "pipe" });
			execSync("git add .", { cwd: testDir, stdio: "pipe" });

			const output = execSync(
				`${binCommand} hook run --dirs-with package.json --test-dir "test -f marker.txt" -- echo found`,
				{
					cwd: testDir,
					encoding: "utf8",
					stdio: ["pipe", "pipe", "pipe"],
					env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
				} as ExecSyncOptionsWithStringEncoding,
			);

			expect(output).toContain("✅ All 1 directory passed validation");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"respects .gitignore in subdirectories",
		() => {
			mkdirSync(join(testDir, "project"));
			mkdirSync(join(testDir, "project", "deps"));
			mkdirSync(join(testDir, "project", "deps", "lib"));
			writeFileSync(join(testDir, "project", "package.json"), "{}");
			writeFileSync(
				join(testDir, "project", "deps", "lib", "package.json"),
				"{}",
			);
			writeFileSync(join(testDir, "project", ".gitignore"), "deps/");

			execSync("git init", { cwd: testDir, stdio: "pipe" });
			execSync("git add .", { cwd: testDir, stdio: "pipe" });

			const output = execSync(
				`${binCommand} hook run --dirs-with package.json -- echo found`,
				{
					cwd: testDir,
					encoding: "utf8",
					stdio: ["pipe", "pipe", "pipe"],
					env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
				} as ExecSyncOptionsWithStringEncoding,
			);

			// Should only find 1 directory (project/), not deps/lib/ (gitignored)
			expect(output).toContain("✅ All 1 directory passed validation");
		},
		{ timeout: BINARY_TIMEOUT },
	);
});

// ============================================
// Validate-legacy command tests (deprecated alias for hook run)
// ============================================

describe("Validate-legacy command", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = setup();
	});

	afterEach(() => {
		teardown(testDir);
	});

	testWithNative(
		"works as legacy alias for hook run",
		() => {
			mkdirSync(join(testDir, "pkg1"));
			writeFileSync(join(testDir, "pkg1", "package.json"), "{}");

			execSync("git init", { cwd: testDir, stdio: "pipe" });
			execSync("git add .", { cwd: testDir, stdio: "pipe" });

			const output = execSync(
				`${binCommand} validate-legacy --dirs-with package.json -- echo success`,
				{
					cwd: testDir,
					encoding: "utf8",
					stdio: ["pipe", "pipe", "pipe"],
				} as ExecSyncOptionsWithStringEncoding,
			);

			expect(output).toContain("passed");
		},
		{ timeout: BINARY_TIMEOUT },
	);
});

// Hook test command was removed - tests for non-existent command removed

// ============================================
// parsePluginRecommendations tests
// ============================================

describe("parsePluginRecommendations", () => {
	test("returns unique plugins (no duplicates)", () => {
		const content = '["bushido", "jutsu-typescript", "bushido", "jutsu-react"]';
		const result = parsePluginRecommendations(content);

		const uniqueResult = [...new Set(result)];
		expect(result.length).toBe(uniqueResult.length);
	});

	test("always includes bushido", () => {
		const content = '["jutsu-typescript", "jutsu-react"]';
		const result = parsePluginRecommendations(content);

		expect(result).toContain("bushido");
	});

	test("handles JSON array format", () => {
		const content = 'Based on analysis: ["jutsu-typescript", "jutsu-biome"]';
		const result = parsePluginRecommendations(content);

		expect(result).toContain("jutsu-typescript");
		expect(result).toContain("jutsu-biome");
		expect(result).toContain("bushido");
	});

	test("handles plain text plugin names", () => {
		const content =
			"I recommend installing jutsu-typescript for TypeScript and jutsu-react for React development.";
		const result = parsePluginRecommendations(content);

		expect(result).toContain("jutsu-typescript");
		expect(result).toContain("jutsu-react");
		expect(result).toContain("bushido");
	});

	test("returns bushido when no plugins found", () => {
		const content = "No specific plugins needed for this project.";
		const result = parsePluginRecommendations(content);

		expect(result).toEqual(["bushido"]);
	});

	test("deduplicates from regex matches", () => {
		const content =
			"For this project, I recommend bushido and jutsu-typescript. The bushido plugin is essential.";
		const result = parsePluginRecommendations(content);

		const bushidoCount = result.filter((p) => p === "bushido").length;
		expect(bushidoCount).toBe(1);
	});

	test("handles all plugin prefixes", () => {
		const content =
			"Install jutsu-typescript for development, do-blockchain-development for web3, and hashi-gitlab for GitLab integration.";
		const result = parsePluginRecommendations(content);

		expect(result).toContain("jutsu-typescript");
		expect(result).toContain("do-blockchain-development");
		expect(result).toContain("hashi-gitlab");
	});

	test("handles empty string", () => {
		const result = parsePluginRecommendations("");
		expect(result).toEqual(["bushido"]);
	});

	test("handles malformed JSON gracefully", () => {
		const content = '["jutsu-typescript", jutsu-react]';
		const result = parsePluginRecommendations(content);

		expect(result).toContain("bushido");
		expect(result).toContain("jutsu-typescript");
		expect(result).toContain("jutsu-react");
	});
});

// ============================================
// Plugin install/uninstall integration tests
// ============================================

describe("Plugin install/uninstall", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = setup();
	});

	afterEach(() => {
		teardown(testDir);
	});

	function setupClaudeDir(testDir: string): string {
		const claudeDir = join(testDir, ".claude");
		mkdirSync(claudeDir, { recursive: true });
		return claudeDir;
	}

	test(
		"install adds plugin to settings",
		() => {
			const claudeDir = setupClaudeDir(testDir);
			const settingsPath = join(claudeDir, "settings.json");

			writeFileSync(settingsPath, JSON.stringify({}, null, 2));

			execSync(
				`${binCommand} plugin install jutsu-typescript --scope project`,
				{
					cwd: testDir,
					encoding: "utf8",
					stdio: "pipe",
				},
			);

			const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

			expect(settings.extraKnownMarketplaces?.han).toBeDefined();
			// Migration converts jutsu-typescript to typescript
			expect(settings.enabledPlugins?.["typescript@han"]).toBe(true);
		},
		{ timeout: BINARY_TIMEOUT },
	);

	test(
		"uninstall removes plugin from settings",
		() => {
			const claudeDir = setupClaudeDir(testDir);
			const settingsPath = join(claudeDir, "settings.json");

			// Use new short name format (migrated format)
			writeFileSync(
				settingsPath,
				JSON.stringify(
					{
						extraKnownMarketplaces: {
							han: {
								source: {
									source: "github",
									repo: "thebushidocollective/hashi",
								},
							},
						},
						enabledPlugins: {
							"typescript@han": true,
						},
					},
					null,
					2,
				),
			);

			execSync(
				`${binCommand} plugin uninstall typescript --scope project`,
				{
					cwd: testDir,
					encoding: "utf8",
					stdio: "pipe",
				},
			);

			const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

			expect(settings.enabledPlugins?.["typescript@han"]).toBeUndefined();
		},
		{ timeout: BINARY_TIMEOUT },
	);

	test(
		"install is idempotent",
		() => {
			const claudeDir = setupClaudeDir(testDir);
			const settingsPath = join(claudeDir, "settings.json");

			// Use new short name format (migrated format)
			writeFileSync(
				settingsPath,
				JSON.stringify(
					{
						extraKnownMarketplaces: {
							han: {
								source: {
									source: "github",
									repo: "thebushidocollective/hashi",
								},
							},
						},
						enabledPlugins: {
							"typescript@han": true,
						},
					},
					null,
					2,
				),
			);

			execSync(`${binCommand} plugin install typescript --scope project`, {
				cwd: testDir,
				encoding: "utf8",
				stdio: "pipe",
			});

			// Verify idempotency: should end up with only one typescript entry
			// The key thing is that multiple installs don't create duplicate entries
			const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
			const pluginKeys = Object.keys(settings.enabledPlugins || {}).filter(
				(k) => k.includes("typescript"),
			);
			expect(pluginKeys.length).toBe(1);
			// After migration, the key should be the short name
			expect(settings.enabledPlugins["typescript@han"]).toBe(true);
		},
		{ timeout: BINARY_TIMEOUT },
	);

	test(
		"uninstall handles non-existent plugin gracefully",
		() => {
			const claudeDir = setupClaudeDir(testDir);
			const settingsPath = join(claudeDir, "settings.json");

			writeFileSync(settingsPath, JSON.stringify({}, null, 2));

			const output = execSync(
				`${binCommand} plugin uninstall non-existent-plugin --scope project`,
				{
					cwd: testDir,
					encoding: "utf8",
					stdio: "pipe",
				},
			);

			expect(output.toLowerCase()).toContain("not installed");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	test(
		"install multiple plugins at once",
		() => {
			const claudeDir = setupClaudeDir(testDir);
			const settingsPath = join(claudeDir, "settings.json");

			writeFileSync(settingsPath, JSON.stringify({}, null, 2));

			execSync(
				`${binCommand} plugin install typescript react --scope project`,
				{
					cwd: testDir,
					encoding: "utf8",
					stdio: "pipe",
				},
			);

			const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

			// Migration converts to short names
			expect(settings.enabledPlugins?.["typescript@han"]).toBe(true);
			expect(settings.enabledPlugins?.["react@han"]).toBe(true);
		},
		{ timeout: BINARY_TIMEOUT },
	);
});

// ============================================
// Hook run without --dirs-with (current directory)
// ============================================

describe("Hook run without --dirs-with", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = setup();
	});

	afterEach(() => {
		teardown(testDir);
	});

	test(
		"runs in current directory when no --dirs-with specified",
		() => {
			writeFileSync(join(testDir, "marker.txt"), "test");

			// Initialize git repo so hook execution works
			execSync("git init", { cwd: testDir, stdio: "pipe" });
			execSync("git add .", { cwd: testDir, stdio: "pipe" });

			expect(() => {
				execSync(`${binCommand} hook run -- cat marker.txt`, {
					cwd: testDir,
					encoding: "utf8",
					stdio: ["pipe", "pipe", "pipe"],
					env: { ...process.env, CLAUDE_PROJECT_DIR: testDir },
				} as ExecSyncOptionsWithStringEncoding);
			}).not.toThrow();
		},
		{ timeout: BINARY_TIMEOUT },
	);

	test(
		"fails in current directory when command fails and no --dirs-with",
		() => {
			let exitCode: number | undefined;
			try {
				execSync(`${binCommand} hook run -- exit 1`, {
					cwd: testDir,
					encoding: "utf8",
					stdio: "pipe",
				});
			} catch (error) {
				const execError = error as ExecError;
				exitCode = execError.status || execError.code;
			}

			expect(exitCode).toBe(2);
		},
		{ timeout: BINARY_TIMEOUT },
	);
});

// Continue in next message due to length...
// ============================================
// Hook config tests (han-plugin.yml)
// ============================================

describe("Hook config (han-plugin.yml)", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = setup();
	});

	afterEach(() => {
		teardown(testDir);
	});

	testWithNative(
		"shows error when plugin not found and CLAUDE_PLUGIN_ROOT not set",
		() => {
			expect(() => {
				execSync(`${binCommand} hook run test-plugin test`, {
					cwd: testDir,
					encoding: "utf8",
					stdio: "pipe",
					env: { ...process.env, CLAUDE_PLUGIN_ROOT: undefined },
				});
			}).toThrow();
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"auto-discovers plugin from settings when CLAUDE_PLUGIN_ROOT not set",
		() => {
			const YAML = require("yaml");
			const projectDir = join(testDir, "project");
			mkdirSync(projectDir, { recursive: true });
			writeFileSync(join(projectDir, "package.json"), "{}");

			const claudeDir = join(projectDir, ".claude");
			mkdirSync(claudeDir, { recursive: true });

			const marketplaceDir = join(testDir, "marketplace");
			const pluginDir = join(marketplaceDir, "jutsu", "jutsu-test");
			mkdirSync(pluginDir, { recursive: true });

			writeFileSync(
				join(pluginDir, "han-plugin.yml"),
				YAML.stringify({
					hooks: {
						test: {
							dirs_with: ["package.json"],
							command: "echo discovered-plugin-success",
						},
					},
				}),
			);

			writeFileSync(
				join(claudeDir, "settings.json"),
				JSON.stringify({
					extraKnownMarketplaces: {
						"test-marketplace": {
							source: {
								source: "directory",
								path: marketplaceDir,
							},
						},
					},
					enabledPlugins: {
						"jutsu-test@test-marketplace": true,
					},
				}),
			);

			execSync("git init", { cwd: projectDir, stdio: "pipe" });
			execSync("git add .", { cwd: projectDir, stdio: "pipe" });

			const output = execSync(`${binCommand} hook run jutsu-test test`, {
				cwd: projectDir,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
				env: {
					...process.env,
					CLAUDE_PLUGIN_ROOT: undefined,
					CLAUDE_PROJECT_DIR: projectDir,
				},
			} as ExecSyncOptionsWithStringEncoding);

			expect(output).toContain("passed");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"shows discovered plugin root in verbose mode",
		() => {
			const YAML = require("yaml");
			const projectDir = join(testDir, "project");
			mkdirSync(projectDir, { recursive: true });
			writeFileSync(join(projectDir, "package.json"), "{}");

			const claudeDir = join(projectDir, ".claude");
			mkdirSync(claudeDir, { recursive: true });

			const marketplaceDir = join(testDir, "marketplace");
			const pluginDir = join(marketplaceDir, "jutsu", "jutsu-verbose-test");
			mkdirSync(pluginDir, { recursive: true });

			writeFileSync(
				join(pluginDir, "han-plugin.yml"),
				YAML.stringify({
					hooks: {
						test: {
							dirs_with: ["package.json"],
							command: "echo verbose-test-success",
						},
					},
				}),
			);

			writeFileSync(
				join(claudeDir, "settings.json"),
				JSON.stringify({
					extraKnownMarketplaces: {
						"test-marketplace": {
							source: {
								source: "directory",
								path: marketplaceDir,
							},
						},
					},
					enabledPlugins: {
						"jutsu-verbose-test@test-marketplace": true,
					},
				}),
			);

			execSync("git init", { cwd: projectDir, stdio: "pipe" });
			execSync("git add .", { cwd: projectDir, stdio: "pipe" });

			const output = execSync(
				`${binCommand} hook run jutsu-verbose-test test --verbose`,
				{
					cwd: projectDir,
					encoding: "utf8",
					stdio: ["pipe", "pipe", "pipe"],
					env: {
						...process.env,
						CLAUDE_PLUGIN_ROOT: undefined,
						CLAUDE_PROJECT_DIR: projectDir,
					},
				} as ExecSyncOptionsWithStringEncoding,
			);

			expect(output).toContain("Discovered plugin root");
			expect(output).toContain("jutsu-verbose-test");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"loads han-plugin.yml and runs command",
		() => {
			const YAML = require("yaml");
			const pluginDir = join(testDir, "test-plugin");
			mkdirSync(pluginDir, { recursive: true });
			writeFileSync(
				join(pluginDir, "han-plugin.yml"),
				YAML.stringify({
					hooks: {
						test: {
							dirs_with: ["package.json"],
							command: "echo hook-success",
						},
					},
				}),
			);

			const projectDir = join(testDir, "project");
			mkdirSync(projectDir, { recursive: true });
			writeFileSync(join(projectDir, "package.json"), "{}");

			execSync("git init", { cwd: projectDir, stdio: "pipe" });
			execSync("git add .", { cwd: projectDir, stdio: "pipe" });

			const output = execSync(`${binCommand} hook run test-plugin test`, {
				cwd: projectDir,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
				env: {
					...process.env,
					CLAUDE_PLUGIN_ROOT: pluginDir,
					CLAUDE_PROJECT_DIR: projectDir,
				},
			} as ExecSyncOptionsWithStringEncoding);

			expect(output).toContain("passed");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"runs in current directory when dirsWith is empty",
		() => {
			const YAML = require("yaml");
			const pluginDir = join(testDir, "test-plugin");
			mkdirSync(pluginDir, { recursive: true });
			writeFileSync(
				join(pluginDir, "han-plugin.yml"),
				YAML.stringify({
					hooks: {
						lint: {
							command: "echo no-dirs-with-success",
						},
					},
				}),
			);

			const projectDir = join(testDir, "project");
			mkdirSync(projectDir, { recursive: true });

			const output = execSync(`${binCommand} hook run test-plugin lint`, {
				cwd: projectDir,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
				env: {
					...process.env,
					CLAUDE_PLUGIN_ROOT: pluginDir,
					CLAUDE_PROJECT_DIR: projectDir,
				},
			} as ExecSyncOptionsWithStringEncoding);

			expect(output).toContain("passed");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"reports when hook not found in config",
		() => {
			const YAML = require("yaml");
			const pluginDir = join(testDir, "test-plugin");
			mkdirSync(pluginDir, { recursive: true });
			writeFileSync(
				join(pluginDir, "han-plugin.yml"),
				YAML.stringify({
					hooks: {
						test: { command: "echo test" },
					},
				}),
			);

			const projectDir = join(testDir, "project");
			mkdirSync(projectDir, { recursive: true });

			const output = execSync(
				`${binCommand} hook run test-plugin nonexistent`,
				{
					cwd: projectDir,
					encoding: "utf8",
					stdio: ["pipe", "pipe", "pipe"],
					env: {
						...process.env,
						CLAUDE_PLUGIN_ROOT: pluginDir,
						CLAUDE_PROJECT_DIR: projectDir,
					},
				} as ExecSyncOptionsWithStringEncoding,
			);

			expect(
				output.includes("No directories found") ||
					output.includes("nonexistent"),
			).toBe(true);
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"with --fail-fast stops on first failure",
		() => {
			const YAML = require("yaml");
			const pluginDir = join(testDir, "test-plugin");
			mkdirSync(pluginDir, { recursive: true });
			writeFileSync(
				join(pluginDir, "han-plugin.yml"),
				YAML.stringify({
					hooks: {
						test: {
							dirs_with: ["marker.txt"],
							command: "exit 1",
						},
					},
				}),
			);

			const projectDir = join(testDir, "project");
			mkdirSync(join(projectDir, "pkg1"), { recursive: true });
			mkdirSync(join(projectDir, "pkg2"), { recursive: true });
			writeFileSync(join(projectDir, "pkg1", "marker.txt"), "");
			writeFileSync(join(projectDir, "pkg2", "marker.txt"), "");

			execSync("git init", { cwd: projectDir, stdio: "pipe" });
			execSync("git add .", { cwd: projectDir, stdio: "pipe" });

			expect(() => {
				execSync(`${binCommand} hook run test-plugin test --fail-fast`, {
					cwd: projectDir,
					encoding: "utf8",
					stdio: "pipe",
					env: {
						...process.env,
						CLAUDE_PLUGIN_ROOT: pluginDir,
						CLAUDE_PROJECT_DIR: projectDir,
					},
				});
			}).toThrow();
		},
		{ timeout: BINARY_TIMEOUT },
	);

	testWithNative(
		"--fail-fast clears stale failure signals from previous runs",
		() => {
			const YAML = require("yaml");
			const pluginDir = join(testDir, "test-plugin");
			mkdirSync(pluginDir, { recursive: true });
			writeFileSync(
				join(pluginDir, "han-plugin.yml"),
				YAML.stringify({
					hooks: {
						test: {
							dirs_with: ["marker.txt"],
							command: "echo success",
						},
					},
				}),
			);

			const projectDir = join(testDir, "project");
			mkdirSync(join(projectDir, "pkg1"), { recursive: true });
			writeFileSync(join(projectDir, "pkg1", "marker.txt"), "");

			execSync("git init", { cwd: projectDir, stdio: "pipe" });
			execSync("git add .", { cwd: projectDir, stdio: "pipe" });

			const sessionId = "test-stale-sentinel-cleanup";
			const sentinelDir = join(tmpdir(), "han-hooks", sessionId);
			mkdirSync(sentinelDir, { recursive: true });
			const sentinelPath = join(sentinelDir, "failure.sentinel");
			writeFileSync(
				sentinelPath,
				JSON.stringify({
					pluginName: "stale-plugin",
					hookName: "stale-hook",
					timestamp: Date.now() - 10000,
				}),
			);

			expect(existsSync(sentinelPath)).toBe(true);

			execSync(`${binCommand} hook run test-plugin test --fail-fast`, {
				cwd: projectDir,
				encoding: "utf8",
				stdio: "pipe",
				env: {
					...process.env,
					CLAUDE_PLUGIN_ROOT: pluginDir,
					CLAUDE_PROJECT_DIR: projectDir,
					HAN_SESSION_ID: sessionId,
				},
			});

			expect(existsSync(sentinelPath)).toBe(false);
		},
		{ timeout: BINARY_TIMEOUT },
	);
});

// ============================================
// Plugin list command tests
// ============================================

describe("Plugin list command", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = setup();
	});

	afterEach(() => {
		teardown(testDir);
	});

	test(
		"shows help",
		() => {
			const output = execSync(`${binCommand} plugin list --help`, {
				encoding: "utf8",
			});
			expect(output).toContain("List installed plugins");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	test(
		"lists installed plugins",
		() => {
			const claudeDir = join(testDir, ".claude");
			mkdirSync(claudeDir, { recursive: true });

			writeFileSync(
				join(claudeDir, "settings.json"),
				JSON.stringify({
					extraKnownMarketplaces: {
						han: {
							source: {
								source: "github",
								repo: "thebushidocollective/han",
							},
						},
					},
					enabledPlugins: {
						"bushido@han": true,
						"jutsu-typescript@han": true,
					},
				}),
			);

			const output = execSync(`${binCommand} plugin list`, {
				cwd: testDir,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
				env: {
					...process.env,
					CLAUDE_CONFIG_DIR: testDir,
				},
			});

			expect(output).toContain("bushido");
			expect(output).toContain("jutsu-typescript");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	test(
		"shows no plugins when none installed",
		() => {
			const claudeDir = join(testDir, ".claude");
			mkdirSync(claudeDir, { recursive: true });

			writeFileSync(join(claudeDir, "settings.json"), JSON.stringify({}));

			const output = execSync(`${binCommand} plugin list`, {
				cwd: testDir,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
				env: {
					...process.env,
					CLAUDE_CONFIG_DIR: testDir,
				},
			});

			expect(output).toContain("No plugins installed");
		},
		{ timeout: BINARY_TIMEOUT },
	);
});

// ============================================
// Hook explain command tests
// ============================================

// Note: Hook explain command only registers in TTY mode (uses interactive Ink component)
// These tests are skipped when not in TTY mode
describe.skip("Hook explain command", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = setup();
	});

	afterEach(() => {
		teardown(testDir);
	});

	test(
		"shows help",
		() => {
			const output = execSync(`${binCommand} hook explain --help`, {
				encoding: "utf8",
			});
			expect(output).toContain("configured hooks");
		},
		{ timeout: BINARY_TIMEOUT },
	);

	test(
		"shows configuration when plugins installed",
		() => {
			const claudeDir = join(testDir, ".claude");
			mkdirSync(claudeDir, { recursive: true });

			writeFileSync(
				join(claudeDir, "settings.json"),
				JSON.stringify({
					extraKnownMarketplaces: {
						han: {
							source: {
								source: "github",
								repo: "thebushidocollective/han",
							},
						},
					},
					enabledPlugins: {
						"bushido@han": true,
					},
				}),
			);

			const output = execSync(`${binCommand} hook explain`, {
				cwd: testDir,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
				env: {
					...process.env,
					CLAUDE_CONFIG_DIR: testDir,
				},
			});

			// Command runs without error (output varies based on plugin availability)
			expect(output).toBeDefined();
		},
		{ timeout: BINARY_TIMEOUT },
	);
});

// TODO: Complete migration of remaining tests (14 tests):
// - User override tests (han-config.yml) - ~6 tests
// - Cache invalidation tests - ~2 tests
// - MCP Server tests - ~6 tests
// - Claude Settings Merge Tests - ~1 test
// Pattern: Follow same structure using describe(), test(), expect(), beforeEach(), afterEach()
