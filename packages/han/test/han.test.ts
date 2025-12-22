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
import { parsePluginRecommendations } from "../lib/shared.ts";

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

// ============================================
// Basic CLI tests
// ============================================

describe("Basic CLI", () => {
	test("shows version", () => {
		const output = execSync(`${binCommand} --version`, { encoding: "utf8" });
		// Version output now starts with "han X.X.X" and includes binary info
		expect(/^han \d+\.\d+\.\d+/.test(output.trim())).toBe(true);
	});

	test("shows help when no command provided", () => {
		const output = execSync(`${binCommand} --help`, { encoding: "utf8" });
		expect(output).toContain("Usage:");
		expect(output).toContain("han");
	});

	test("shows plugin command help", () => {
		const output = execSync(`${binCommand} plugin --help`, {
			encoding: "utf8",
		});
		expect(output).toContain("install");
		expect(output).toContain("uninstall");
	});

	test("shows hook command help", () => {
		const output = execSync(`${binCommand} hook --help`, { encoding: "utf8" });
		expect(output).toContain("run");
		expect(output).toContain("test");
	});
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

	test("causes hook run to exit 0 silently", () => {
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
	});

	test("causes hook dispatch to exit 0 silently", () => {
		const output = execSync(`${binCommand} hook dispatch Stop`, {
			encoding: "utf8",
			env: { ...process.env, HAN_DISABLE_HOOKS: "1" },
		});

		expect(output.trim()).toBe("");
	});
});

// ============================================
// Hook verify tests
// ============================================

describe("Hook verify", () => {
	let testDir: string;
	let originalProjectDir: string | undefined;

	beforeEach(() => {
		testDir = setup();
		originalProjectDir = process.env.CLAUDE_PROJECT_DIR;
	});

	afterEach(() => {
		if (originalProjectDir === undefined) {
			delete process.env.CLAUDE_PROJECT_DIR;
		} else {
			process.env.CLAUDE_PROJECT_DIR = originalProjectDir;
		}
		teardown(testDir);
	});

	test("exits 0 when all hooks are cached", () => {
		const YAML = require("yaml");
		const projectDir = join(testDir, "project");
		mkdirSync(projectDir, { recursive: true });

		const claudeDir = join(projectDir, ".claude");
		mkdirSync(claudeDir, { recursive: true });

		const marketplaceDir = join(testDir, "marketplace");
		const pluginDir = join(marketplaceDir, "jutsu", "no-cache-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-plugin.yml"),
			YAML.stringify({
				hooks: {
					build: {
						command: "echo no-cache-test",
					},
				},
			}),
		);

		const hooksDir = join(pluginDir, "hooks");
		mkdirSync(hooksDir, { recursive: true });
		writeFileSync(
			join(hooksDir, "hooks.json"),
			JSON.stringify({
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run no-cache-plugin build",
								},
							],
						},
					],
				},
			}),
		);

		writeFileSync(
			join(claudeDir, "settings.json"),
			JSON.stringify({
				extraKnownMarketplaces: {
					"test-marketplace": {
						source: { source: "directory", path: marketplaceDir },
					},
				},
				enabledPlugins: {
					"no-cache-plugin@test-marketplace": true,
				},
			}),
		);

		process.env.CLAUDE_PROJECT_DIR = projectDir;

		const output = execSync(`${binCommand} hook verify Stop`, {
			cwd: projectDir,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				CLAUDE_PROJECT_DIR: projectDir,
			},
		} as ExecSyncOptionsWithStringEncoding);

		expect(
			output.includes("hooks are cached") ||
				output.includes("✅") ||
				output.includes("0"),
		).toBe(true);
	});

	test("exits non-zero when hooks are stale", () => {
		const YAML = require("yaml");
		const projectDir = join(testDir, "project");
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(join(projectDir, "package.json"), "{}");
		writeFileSync(join(projectDir, "app.ts"), "// TypeScript code");

		const claudeDir = join(projectDir, ".claude");
		mkdirSync(claudeDir, { recursive: true });

		const marketplaceDir = join(testDir, "marketplace");
		const pluginDir = join(marketplaceDir, "jutsu", "stale-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-plugin.yml"),
			YAML.stringify({
				hooks: {
					check: {
						dirs_with: ["package.json"],
						command: "echo verify-test",
						if_changed: ["**/*.ts"],
					},
				},
			}),
		);

		const hooksDir = join(pluginDir, "hooks");
		mkdirSync(hooksDir, { recursive: true });
		writeFileSync(
			join(hooksDir, "hooks.json"),
			JSON.stringify({
				hooks: {
					Stop: [
						{
							hooks: [
								{
									type: "command",
									command: "han hook run stale-plugin check --cached",
								},
							],
						},
					],
				},
			}),
		);

		writeFileSync(
			join(claudeDir, "settings.json"),
			JSON.stringify({
				extraKnownMarketplaces: {
					"test-marketplace": {
						source: { source: "directory", path: marketplaceDir },
					},
				},
				enabledPlugins: {
					"stale-plugin@test-marketplace": true,
				},
			}),
		);

		execSync("git init", { cwd: projectDir, stdio: "pipe" });
		execSync("git add .", { cwd: projectDir, stdio: "pipe" });

		process.env.CLAUDE_PROJECT_DIR = projectDir;

		execSync(`${binCommand} hook run stale-plugin check --cached`, {
			cwd: projectDir,
			encoding: "utf8",
			stdio: "pipe",
			env: {
				...process.env,
				CLAUDE_PROJECT_DIR: projectDir,
				CLAUDE_PLUGIN_ROOT: undefined,
			},
		});

		writeFileSync(join(projectDir, "app.ts"), "// Modified TypeScript code");

		expect(() => {
			execSync(`${binCommand} hook verify Stop`, {
				cwd: projectDir,
				encoding: "utf8",
				stdio: "pipe",
				env: {
					...process.env,
					CLAUDE_PROJECT_DIR: projectDir,
					CLAUDE_PLUGIN_ROOT: undefined,
				},
			});
		}).toThrow();
	});
});

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

	test("shows error when no plugin name or hook name", () => {
		expect(() => {
			execSync(`${binCommand} hook run`, { encoding: "utf8", stdio: "pipe" });
		}).toThrow();
	});

	test(
		"passes when no directories match filter",
		() => {
			const output = execSync(
				`${binCommand} hook run --dirs-with nonexistent.txt -- echo test`,
				{ cwd: testDir, encoding: "utf8" } as ExecSyncOptionsWithStringEncoding,
			);
			expect(output).toContain("No directories found with nonexistent.txt");
		},
		{ timeout: 30000 },
	);

	test("runs command in matching directories", () => {
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
	});

	test("fails with exit code 2 when command fails", () => {
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
	});

	test("stops on first failure with --fail-fast", () => {
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
	});

	test("respects --test-dir flag to filter directories", () => {
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

		expect(output).toContain("1 directory passed");
	});

	test("respects .gitignore in subdirectories", () => {
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
		expect(output).toMatch(/1 director(y|ies) passed validation/);
	});
});

// ============================================
// Validate command tests (alias for hook run)
// ============================================

describe("Validate command", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = setup();
	});

	afterEach(() => {
		teardown(testDir);
	});

	test("works as alias for hook run", () => {
		mkdirSync(join(testDir, "pkg1"));
		writeFileSync(join(testDir, "pkg1", "package.json"), "{}");

		execSync("git init", { cwd: testDir, stdio: "pipe" });
		execSync("git add .", { cwd: testDir, stdio: "pipe" });

		const output = execSync(
			`${binCommand} validate --dirs-with package.json -- echo success`,
			{
				cwd: testDir,
				encoding: "utf8",
				stdio: ["pipe", "pipe", "pipe"],
			} as ExecSyncOptionsWithStringEncoding,
		);

		expect(output).toContain("passed");
	});
});

// ============================================
// Hook test command tests
// ============================================

describe("Hook test command", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = setup();
	});

	afterEach(() => {
		teardown(testDir);
	});

	test("shows help", () => {
		const output = execSync(`${binCommand} hook test --help`, {
			encoding: "utf8",
		});
		expect(output).toContain("Validate hook configurations");
	});

	test("validates hooks in installed plugins", () => {
		const claudeDir = join(testDir, ".claude");
		mkdirSync(claudeDir, { recursive: true });

		writeFileSync(
			join(claudeDir, "settings.json"),
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
					enabledPlugins: {},
				},
				null,
				2,
			),
		);

		const output = execSync(`${binCommand} hook test`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				CLAUDE_CONFIG_DIR: testDir,
				CLAUDE_PROJECT_DIR: testDir,
			},
		});

		expect(
			output.includes("No plugins installed") || output.includes("No hooks"),
		).toBe(true);
	});
});

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

	test("install adds plugin to settings", () => {
		const claudeDir = setupClaudeDir(testDir);
		const settingsPath = join(claudeDir, "settings.json");

		writeFileSync(settingsPath, JSON.stringify({}, null, 2));

		execSync(`${binCommand} plugin install jutsu-typescript --scope project`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: "pipe",
		});

		const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

		expect(settings.extraKnownMarketplaces?.han).toBeDefined();
		expect(settings.enabledPlugins?.["jutsu-typescript@han"]).toBe(true);
	});

	test("uninstall removes plugin from settings", () => {
		const claudeDir = setupClaudeDir(testDir);
		const settingsPath = join(claudeDir, "settings.json");

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
						"jutsu-typescript@han": true,
					},
				},
				null,
				2,
			),
		);

		execSync(
			`${binCommand} plugin uninstall jutsu-typescript --scope project`,
			{
				cwd: testDir,
				encoding: "utf8",
				stdio: "pipe",
			},
		);

		const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

		expect(settings.enabledPlugins?.["jutsu-typescript@han"]).toBeUndefined();
	});

	test("install is idempotent", () => {
		const claudeDir = setupClaudeDir(testDir);
		const settingsPath = join(claudeDir, "settings.json");

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
						"jutsu-typescript@han": true,
					},
				},
				null,
				2,
			),
		);

		const output = execSync(
			`${binCommand} plugin install jutsu-typescript --scope project`,
			{
				cwd: testDir,
				encoding: "utf8",
				stdio: "pipe",
			},
		);

		expect(output.toLowerCase()).toContain("already installed");

		const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
		const pluginKeys = Object.keys(settings.enabledPlugins || {}).filter((k) =>
			k.includes("jutsu-typescript"),
		);
		expect(pluginKeys.length).toBe(1);
	});

	test("uninstall handles non-existent plugin gracefully", () => {
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
	});

	test("install multiple plugins at once", () => {
		const claudeDir = setupClaudeDir(testDir);
		const settingsPath = join(claudeDir, "settings.json");

		writeFileSync(settingsPath, JSON.stringify({}, null, 2));

		execSync(
			`${binCommand} plugin install jutsu-typescript jutsu-react --scope project`,
			{
				cwd: testDir,
				encoding: "utf8",
				stdio: "pipe",
			},
		);

		const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

		expect(settings.enabledPlugins?.["jutsu-typescript@han"]).toBe(true);
		expect(settings.enabledPlugins?.["jutsu-react@han"]).toBe(true);
	});
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

	test("runs in current directory when no --dirs-with specified", () => {
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
	});

	test("fails in current directory when command fails and no --dirs-with", () => {
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
	});
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

	test("shows error when plugin not found and CLAUDE_PLUGIN_ROOT not set", () => {
		expect(() => {
			execSync(`${binCommand} hook run test-plugin test`, {
				cwd: testDir,
				encoding: "utf8",
				stdio: "pipe",
				env: { ...process.env, CLAUDE_PLUGIN_ROOT: undefined },
			});
		}).toThrow();
	});

	test("auto-discovers plugin from settings when CLAUDE_PLUGIN_ROOT not set", () => {
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
	});

	test("shows discovered plugin root in verbose mode", () => {
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
	});

	test("loads han-plugin.yml and runs command", () => {
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
	});

	test("runs in current directory when dirsWith is empty", () => {
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
	});

	test("reports when hook not found in config", () => {
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

		const output = execSync(`${binCommand} hook run test-plugin nonexistent`, {
			cwd: projectDir,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				CLAUDE_PLUGIN_ROOT: pluginDir,
				CLAUDE_PROJECT_DIR: projectDir,
			},
		} as ExecSyncOptionsWithStringEncoding);

		expect(
			output.includes("No directories found") || output.includes("nonexistent"),
		).toBe(true);
	});

	test("with --fail-fast stops on first failure", () => {
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
	});

	test("--fail-fast clears stale failure signals from previous runs", () => {
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
	});
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

	test("shows help", () => {
		const output = execSync(`${binCommand} plugin list --help`, {
			encoding: "utf8",
		});
		expect(output).toContain("List installed plugins");
	});

	test("lists installed plugins", () => {
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
	});

	test("shows no plugins when none installed", () => {
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
	});
});

// ============================================
// Explain command tests
// ============================================

describe("Explain command", () => {
	let testDir: string;

	beforeEach(() => {
		testDir = setup();
	});

	afterEach(() => {
		teardown(testDir);
	});

	test("shows help", () => {
		const output = execSync(`${binCommand} explain --help`, {
			encoding: "utf8",
		});
		expect(output).toContain("Han configuration");
	});

	test("shows configuration when plugins installed", () => {
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

		const output = execSync(`${binCommand} explain`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				CLAUDE_CONFIG_DIR: testDir,
			},
		});

		expect(output.toLowerCase()).toContain("han configuration");
	});
});

// ============================================
// Summary command tests
// ============================================

describe("Summary command", () => {
	test("shows help", () => {
		const output = execSync(`${binCommand} summary --help`, {
			encoding: "utf8",
		});
		expect(output).toContain("summary");
	});
});

// ============================================
// Gaps command tests
// ============================================

describe("Gaps command", () => {
	test("shows help", () => {
		const output = execSync(`${binCommand} gaps --help`, {
			encoding: "utf8",
		});
		expect(output).toContain("gaps");
	});
});

// TODO: Complete migration of remaining tests (14 tests):
// - User override tests (han-config.yml) - ~6 tests
// - Cache invalidation tests - ~2 tests
// - MCP Server tests - ~6 tests
// - Claude Settings Merge Tests - ~1 test
// Pattern: Follow same structure using describe(), test(), expect(), beforeEach(), afterEach()
