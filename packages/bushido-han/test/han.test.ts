import { deepStrictEqual, strictEqual } from "node:assert";
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
import { checkForChanges, trackFiles } from "../lib/hook-cache.js";
import { parsePluginRecommendations } from "../lib/shared.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Determine which binary to test
// If HAN_TEST_BINARY env var is set, use the compiled binary
// Otherwise, use the Bun runtime
const USE_BINARY = process.env.HAN_TEST_BINARY === "true";
const binPath = USE_BINARY
	? join(__dirname, "..", "..", "dist", "han")
	: join(__dirname, "..", "lib", "main.js");
const binCommand = USE_BINARY ? binPath : `bun ${binPath}`;

console.log(`\nTesting: ${USE_BINARY ? "Binary (bun)" : "JavaScript (bun)"}`);
console.log(`Path: ${binPath}\n`);

// Verify binary exists
if (!existsSync(binPath)) {
	console.error(`Binary not found at ${binPath}`);
	if (USE_BINARY) {
		console.error("Run 'npm run build:binary' first to create the binary");
	}
	process.exit(1);
}

function setup(): string {
	const testDir = join(__dirname, "fixtures");
	rmSync(testDir, { recursive: true, force: true });
	mkdirSync(testDir, { recursive: true });
	return testDir;
}

function teardown(): void {
	const testDir = join(__dirname, "fixtures");
	rmSync(testDir, { recursive: true, force: true });
}

let testsPassed = 0;
let testsFailed = 0;

function test(name: string, fn: () => void): void {
	try {
		fn();
		console.log(`✓ ${name}`);
		testsPassed++;
	} catch (error) {
		console.error(`✗ ${name}`);
		console.error(`  ${(error as Error).message}`);
		testsFailed++;
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

test("shows version", () => {
	const output = execSync(`${binCommand} --version`, { encoding: "utf8" });
	strictEqual(
		/^\d+\.\d+\.\d+/.test(output.trim()),
		true,
		`Expected version format, got: ${output}`,
	);
});

test("shows help when no command provided", () => {
	const output = execSync(`${binCommand} --help`, { encoding: "utf8" });
	strictEqual(
		output.includes("Usage:"),
		true,
		"Expected Usage: in help output",
	);
	strictEqual(output.includes("han"), true, "Expected 'han' in help output");
});

test("shows plugin command help", () => {
	const output = execSync(`${binCommand} plugin --help`, { encoding: "utf8" });
	strictEqual(output.includes("install"), true);
	strictEqual(output.includes("uninstall"), true);
});

test("shows hook command help", () => {
	const output = execSync(`${binCommand} hook --help`, { encoding: "utf8" });
	strictEqual(output.includes("run"), true);
	strictEqual(output.includes("test"), true);
});

test("HAN_DISABLE_HOOKS=1 causes hook run to exit 0 silently", () => {
	const testDir = setup();
	try {
		// Create test structure
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

		// Should exit 0 with no output
		strictEqual(output.trim(), "", "Expected no output when hooks disabled");
	} finally {
		teardown();
	}
});

test("HAN_DISABLE_HOOKS=1 causes hook dispatch to exit 0 silently", () => {
	const output = execSync(`${binCommand} hook dispatch Stop`, {
		encoding: "utf8",
		env: { ...process.env, HAN_DISABLE_HOOKS: "1" },
	});

	// Should exit 0 with no output
	strictEqual(output.trim(), "", "Expected no output when hooks disabled");
});

// ============================================
// Hook verify tests
// ============================================

test("han hook verify exits 0 when all hooks are cached", () => {
	const testDir = setup();
	const originalProjectDir = process.env.CLAUDE_PROJECT_DIR;
	try {
		// Create project directory
		const projectDir = join(testDir, "project");
		mkdirSync(projectDir, { recursive: true });

		// Create .claude directory with settings
		const claudeDir = join(projectDir, ".claude");
		mkdirSync(claudeDir, { recursive: true });

		// Create marketplace with a plugin that has a Stop hook WITHOUT ifChanged
		// This means verify will find it but won't check cache (no ifChanged patterns)
		const marketplaceDir = join(testDir, "marketplace");
		const pluginDir = join(marketplaceDir, "jutsu", "no-cache-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					build: {
						command: "echo no-cache-test",
						// No ifChanged - so no cache checking
					},
				},
			}),
		);

		// Create hooks.json for Claude Code integration
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
									command:
										"npx -y @thebushidocollective/han hook run no-cache-plugin build",
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

		// Set CLAUDE_PROJECT_DIR
		process.env.CLAUDE_PROJECT_DIR = projectDir;

		// Verify that hook verify exits 0 (hooks without ifChanged are considered "cached")
		const output = execSync(`${binCommand} hook verify Stop`, {
			cwd: projectDir,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				CLAUDE_PROJECT_DIR: projectDir,
			},
		} as ExecSyncOptionsWithStringEncoding);

		strictEqual(
			output.includes("hooks are cached") ||
				output.includes("✅") ||
				output.includes("0"),
			true,
			"Expected success message indicating hooks are up to date",
		);
	} finally {
		if (originalProjectDir === undefined) {
			delete process.env.CLAUDE_PROJECT_DIR;
		} else {
			process.env.CLAUDE_PROJECT_DIR = originalProjectDir;
		}
		teardown();
	}
});

test("han hook verify exits non-zero when hooks are stale", () => {
	const testDir = setup();
	const originalProjectDir = process.env.CLAUDE_PROJECT_DIR;
	try {
		// Create project directory
		const projectDir = join(testDir, "project");
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(join(projectDir, "package.json"), "{}");
		writeFileSync(join(projectDir, "app.ts"), "// TypeScript code");

		// Create .claude directory with settings
		const claudeDir = join(projectDir, ".claude");
		mkdirSync(claudeDir, { recursive: true });

		// Create marketplace
		const marketplaceDir = join(testDir, "marketplace");
		const pluginDir = join(marketplaceDir, "jutsu", "stale-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					check: {
						dirsWith: ["package.json"],
						command: "echo verify-test",
						ifChanged: ["**/*.ts"],
					},
				},
			}),
		);

		// Create hooks.json for Claude Code integration
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
									command:
										"npx -y @thebushidocollective/han hook run stale-plugin check --cached",
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

		// Set CLAUDE_PROJECT_DIR
		process.env.CLAUDE_PROJECT_DIR = projectDir;

		// Run the hook to cache it
		execSync(`${binCommand} hook run stale-plugin check --cached`, {
			cwd: projectDir,
			encoding: "utf8",
			stdio: "pipe",
			env: {
				...process.env,
				CLAUDE_PROJECT_DIR: projectDir,
			},
		});

		// Modify tracked file to invalidate cache
		writeFileSync(join(projectDir, "app.ts"), "// Modified TypeScript code");

		// Verify that hook verify exits non-zero (hooks are stale)
		try {
			execSync(`${binCommand} hook verify Stop`, {
				cwd: projectDir,
				encoding: "utf8",
				stdio: "pipe",
				env: {
					...process.env,
					CLAUDE_PROJECT_DIR: projectDir,
				},
			});
			throw new Error("Should have failed with stale hooks");
		} catch (error) {
			const execError = error as ExecError;
			strictEqual(
				execError.status !== undefined && execError.status > 0,
				true,
				"Expected non-zero exit code for stale hooks",
			);
			const stderr = execError.stderr?.toString() || "";
			strictEqual(
				stderr.includes("stale") ||
					stderr.includes("changed") ||
					stderr.includes("run"),
				true,
				"Expected message about stale hooks",
			);
		}
	} finally {
		if (originalProjectDir === undefined) {
			delete process.env.CLAUDE_PROJECT_DIR;
		} else {
			process.env.CLAUDE_PROJECT_DIR = originalProjectDir;
		}
		teardown();
	}
});

// ============================================
// Hook run tests
// ============================================

test("shows error when hook run has no plugin name or hook name", () => {
	try {
		execSync(`${binCommand} hook run`, { encoding: "utf8", stdio: "pipe" });
		throw new Error("Should have failed");
	} catch (error) {
		const execError = error as ExecError;
		strictEqual(execError.status, 1);
		const stderr = execError.stderr?.toString() || "";
		strictEqual(
			stderr.includes("Plugin name and hook name are required") ||
				stderr.includes("-- separator") ||
				stderr.includes("error"),
			true,
		);
	}
});

test("passes when no directories match filter", () => {
	const testDir = setup();
	try {
		const output = execSync(
			`${binCommand} hook run --dirs-with nonexistent.txt -- echo test`,
			{ cwd: testDir, encoding: "utf8" } as ExecSyncOptionsWithStringEncoding,
		);
		strictEqual(
			output.includes("No directories found with nonexistent.txt"),
			true,
		);
	} finally {
		teardown();
	}
});

test("runs command in matching directories", () => {
	const testDir = setup();
	try {
		// Create test structure
		mkdirSync(join(testDir, "pkg1"));
		mkdirSync(join(testDir, "pkg2"));
		writeFileSync(join(testDir, "pkg1", "package.json"), "{}");
		writeFileSync(join(testDir, "pkg2", "package.json"), "{}");

		// Initialize git repo so directories are discovered
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

		// Command output is suppressed, only check for success message
		strictEqual(output.includes("passed validation"), true);
	} finally {
		teardown();
	}
});

test("fails with exit code 2 when command fails", () => {
	const testDir = setup();
	try {
		mkdirSync(join(testDir, "pkg1"));
		writeFileSync(join(testDir, "pkg1", "package.json"), "{}");

		execSync("git init", { cwd: testDir, stdio: "pipe" });
		execSync("git add .", { cwd: testDir, stdio: "pipe" });

		try {
			execSync(`${binCommand} hook run --dirs-with package.json -- exit 1`, {
				cwd: testDir,
				encoding: "utf8",
				stdio: "pipe",
			});
			throw new Error("Should have failed");
		} catch (error) {
			const execError = error as ExecError;
			const exitCode = execError.status || execError.code;
			strictEqual(exitCode, 2, `Expected exit code 2, got ${exitCode}`);
			const stderr = execError.stderr?.toString() || "";
			strictEqual(stderr.includes("failed") || stderr.includes("Spawn"), true);
		}
	} finally {
		teardown();
	}
});

test("stops on first failure with --fail-fast", () => {
	const testDir = setup();
	try {
		mkdirSync(join(testDir, "pkg1"));
		mkdirSync(join(testDir, "pkg2"));
		writeFileSync(join(testDir, "pkg1", "package.json"), "{}");
		writeFileSync(join(testDir, "pkg2", "package.json"), "{}");

		execSync("git init", { cwd: testDir, stdio: "pipe" });
		execSync("git add .", { cwd: testDir, stdio: "pipe" });

		try {
			execSync(
				`${binCommand} hook run --fail-fast --dirs-with package.json -- exit 1`,
				{ cwd: testDir, encoding: "utf8", stdio: "pipe" },
			);
			throw new Error("Should have failed");
		} catch (error) {
			const execError = error as ExecError;
			const exitCode = execError.status || execError.code;
			strictEqual(exitCode, 2, `Expected exit code 2, got ${exitCode}`);
			const stderr = execError.stderr?.toString() || "";
			strictEqual(stderr.includes("failed") || stderr.includes("Spawn"), true);
		}
	} finally {
		teardown();
	}
});

test("respects --test-dir flag to filter directories", () => {
	const testDir = setup();
	try {
		// Create two directories, only one should match the test
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
			} as ExecSyncOptionsWithStringEncoding,
		);

		// Should only run in with-marker directory
		strictEqual(output.includes("1 directory passed"), true);
	} finally {
		teardown();
	}
});

test("respects .gitignore in subdirectories", () => {
	const testDir = setup();
	try {
		// Create structure with nested .gitignore
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
			} as ExecSyncOptionsWithStringEncoding,
		);

		// Should only find 1 directory (project), not deps/lib
		strictEqual(output.includes("1 directory"), true);
	} finally {
		teardown();
	}
});

// ============================================
// Validate command tests (alias for hook run)
// ============================================

test("validate command works as alias for hook run", () => {
	const testDir = setup();
	try {
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

		// Command output is suppressed, only check for success message
		strictEqual(output.includes("passed validation"), true);
	} finally {
		teardown();
	}
});

// ============================================
// Hook test command tests
// ============================================

test("han hook test shows help", () => {
	const output = execSync(`${binCommand} hook test --help`, {
		encoding: "utf8",
	});
	strictEqual(
		output.includes("Validate hook configurations"),
		true,
		"Expected help output to mention hook validation",
	);
});

test("han hook test validates hooks in installed plugins", () => {
	const testDir = setup();
	try {
		const claudeDir = join(testDir, ".claude");
		mkdirSync(claudeDir, { recursive: true });

		// Create settings with Han marketplace
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

		// Should pass with no plugins installed
		// Set CLAUDE_CONFIG_DIR to isolate from user settings
		const output = execSync(`${binCommand} hook test`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				CLAUDE_CONFIG_DIR: testDir,
			},
		});

		strictEqual(
			output.includes("No plugins installed") || output.includes("No hooks"),
			true,
		);
	} finally {
		teardown();
	}
});

// ============================================
// parsePluginRecommendations tests
// ============================================

test("parsePluginRecommendations returns unique plugins (no duplicates)", () => {
	const content = '["bushido", "jutsu-typescript", "bushido", "jutsu-react"]';
	const result = parsePluginRecommendations(content);

	const uniqueResult = [...new Set(result)];
	deepStrictEqual(
		result.length,
		uniqueResult.length,
		`Expected no duplicates but found ${result.length - uniqueResult.length} duplicate(s)`,
	);
});

test("parsePluginRecommendations always includes bushido", () => {
	const content = '["jutsu-typescript", "jutsu-react"]';
	const result = parsePluginRecommendations(content);

	strictEqual(
		result.includes("bushido"),
		true,
		"Expected bushido to always be included",
	);
});

test("parsePluginRecommendations handles JSON array format", () => {
	const content = 'Based on analysis: ["jutsu-typescript", "jutsu-biome"]';
	const result = parsePluginRecommendations(content);

	strictEqual(result.includes("jutsu-typescript"), true);
	strictEqual(result.includes("jutsu-biome"), true);
	strictEqual(result.includes("bushido"), true);
});

test("parsePluginRecommendations handles plain text plugin names", () => {
	const content =
		"I recommend installing jutsu-typescript for TypeScript and jutsu-react for React development.";
	const result = parsePluginRecommendations(content);

	strictEqual(result.includes("jutsu-typescript"), true);
	strictEqual(result.includes("jutsu-react"), true);
	strictEqual(result.includes("bushido"), true);
});

test("parsePluginRecommendations returns bushido when no plugins found", () => {
	const content = "No specific plugins needed for this project.";
	const result = parsePluginRecommendations(content);

	deepStrictEqual(result, ["bushido"]);
});

test("parsePluginRecommendations deduplicates from regex matches", () => {
	const content =
		"For this project, I recommend bushido and jutsu-typescript. The bushido plugin is essential.";
	const result = parsePluginRecommendations(content);

	const bushidoCount = result.filter((p) => p === "bushido").length;
	strictEqual(
		bushidoCount,
		1,
		`Expected exactly 1 bushido but found ${bushidoCount}`,
	);
});

test("parsePluginRecommendations handles all plugin prefixes", () => {
	const content =
		"Install jutsu-typescript for development, do-blockchain-development for web3, and hashi-gitlab for GitLab integration.";
	const result = parsePluginRecommendations(content);

	strictEqual(result.includes("jutsu-typescript"), true);
	strictEqual(result.includes("do-blockchain-development"), true);
	strictEqual(result.includes("hashi-gitlab"), true);
});

test("parsePluginRecommendations handles empty string", () => {
	const result = parsePluginRecommendations("");
	deepStrictEqual(result, ["bushido"]);
});

test("parsePluginRecommendations handles malformed JSON gracefully", () => {
	const content = '["jutsu-typescript", jutsu-react]'; // missing quotes
	const result = parsePluginRecommendations(content);

	strictEqual(result.includes("bushido"), true);
	strictEqual(result.includes("jutsu-typescript"), true);
	strictEqual(result.includes("jutsu-react"), true);
});

// ============================================
// Plugin install/uninstall integration tests
// ============================================

function setupClaudeDir(testDir: string): string {
	const claudeDir = join(testDir, ".claude");
	mkdirSync(claudeDir, { recursive: true });
	return claudeDir;
}

test("han plugin install adds plugin to settings", () => {
	const testDir = setup();
	try {
		const claudeDir = setupClaudeDir(testDir);
		const settingsPath = join(claudeDir, "settings.json");

		writeFileSync(settingsPath, JSON.stringify({}, null, 2));

		execSync(`${binCommand} plugin install jutsu-typescript --scope project`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: "pipe",
		});

		const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

		strictEqual(
			settings.extraKnownMarketplaces?.han !== undefined,
			true,
			"Expected Han marketplace to be added",
		);
		strictEqual(
			settings.enabledPlugins?.["jutsu-typescript@han"],
			true,
			"Expected jutsu-typescript@han to be enabled",
		);
	} finally {
		teardown();
	}
});

test("han plugin uninstall removes plugin from settings", () => {
	const testDir = setup();
	try {
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

		strictEqual(
			settings.enabledPlugins?.["jutsu-typescript@han"],
			undefined,
			"Expected jutsu-typescript@han to be removed",
		);
	} finally {
		teardown();
	}
});

test("han plugin install is idempotent", () => {
	const testDir = setup();
	try {
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

		strictEqual(
			output.toLowerCase().includes("already installed"),
			true,
			"Expected 'already installed' message",
		);

		const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
		const pluginKeys = Object.keys(settings.enabledPlugins || {}).filter((k) =>
			k.includes("jutsu-typescript"),
		);
		strictEqual(
			pluginKeys.length,
			1,
			"Expected exactly one jutsu-typescript entry",
		);
	} finally {
		teardown();
	}
});

test("han plugin uninstall handles non-existent plugin gracefully", () => {
	const testDir = setup();
	try {
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

		strictEqual(
			output.toLowerCase().includes("not installed"),
			true,
			"Expected 'not installed' message",
		);
	} finally {
		teardown();
	}
});

test("han plugin install multiple plugins at once", () => {
	const testDir = setup();
	try {
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

		strictEqual(
			settings.enabledPlugins?.["jutsu-typescript@han"],
			true,
			"Expected jutsu-typescript@han to be enabled",
		);
		strictEqual(
			settings.enabledPlugins?.["jutsu-react@han"],
			true,
			"Expected jutsu-react@han to be enabled",
		);
	} finally {
		teardown();
	}
});

// ============================================
// Hook run without --dirs-with (current directory)
// ============================================

test("runs in current directory when no --dirs-with specified", () => {
	const testDir = setup();
	try {
		// Create a marker file to verify we're in the right directory
		writeFileSync(join(testDir, "marker.txt"), "test");

		// Should complete without throwing (exit code 0)
		// Single command runs now exit silently on success
		execSync(`${binCommand} hook run -- cat marker.txt`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		} as ExecSyncOptionsWithStringEncoding);

		// If we get here, the command succeeded
	} finally {
		teardown();
	}
});

test("fails in current directory when command fails and no --dirs-with", () => {
	const testDir = setup();
	try {
		try {
			execSync(`${binCommand} hook run -- exit 1`, {
				cwd: testDir,
				encoding: "utf8",
				stdio: "pipe",
			});
			throw new Error("Should have failed");
		} catch (error) {
			const execError = error as ExecError;
			const exitCode = execError.status || execError.code;
			strictEqual(exitCode, 2, `Expected exit code 2, got ${exitCode}`);
		}
	} finally {
		teardown();
	}
});

// ============================================
// Hook config tests (han-config.json)
// ============================================

test("new format shows error when plugin not found and CLAUDE_PLUGIN_ROOT not set", () => {
	const testDir = setup();
	try {
		try {
			execSync(`${binCommand} hook run test-plugin test`, {
				cwd: testDir,
				encoding: "utf8",
				stdio: "pipe",
				env: { ...process.env, CLAUDE_PLUGIN_ROOT: undefined },
			});
			throw new Error("Should have failed");
		} catch (error) {
			const execError = error as ExecError;
			strictEqual(execError.status, 1);
			const stderr = execError.stderr?.toString() || "";
			strictEqual(
				stderr.includes("Could not find plugin"),
				true,
				"Expected error about plugin not found",
			);
		}
	} finally {
		teardown();
	}
});

test("new format auto-discovers plugin from settings when CLAUDE_PLUGIN_ROOT not set", () => {
	const testDir = setup();
	try {
		// Create project directory
		const projectDir = join(testDir, "project");
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(join(projectDir, "package.json"), "{}");

		// Create .claude directory with settings
		const claudeDir = join(projectDir, ".claude");
		mkdirSync(claudeDir, { recursive: true });

		// Create a marketplace directory structure
		const marketplaceDir = join(testDir, "marketplace");
		const pluginDir = join(marketplaceDir, "jutsu", "jutsu-test");
		mkdirSync(pluginDir, { recursive: true });

		// Create plugin with han-config.json
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					test: {
						dirsWith: ["package.json"],
						command: "echo discovered-plugin-success",
					},
				},
			}),
		);

		// Create settings that point to the marketplace
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

		strictEqual(output.includes("passed"), true, "Expected success message");
	} finally {
		teardown();
	}
});

test("new format shows discovered plugin root in verbose mode", () => {
	const testDir = setup();
	try {
		// Create project directory
		const projectDir = join(testDir, "project");
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(join(projectDir, "package.json"), "{}");

		// Create .claude directory with settings
		const claudeDir = join(projectDir, ".claude");
		mkdirSync(claudeDir, { recursive: true });

		// Create a marketplace directory structure
		const marketplaceDir = join(testDir, "marketplace");
		const pluginDir = join(marketplaceDir, "jutsu", "jutsu-verbose-test");
		mkdirSync(pluginDir, { recursive: true });

		// Create plugin with han-config.json
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					test: {
						dirsWith: ["package.json"],
						command: "echo verbose-test-success",
					},
				},
			}),
		);

		// Create settings that point to the marketplace
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

		strictEqual(
			output.includes("Discovered plugin root"),
			true,
			"Expected verbose message about discovered plugin root",
		);
		strictEqual(
			output.includes("jutsu-verbose-test"),
			true,
			"Expected plugin path in verbose output",
		);
	} finally {
		teardown();
	}
});

test("new format loads han-config.json and runs command", () => {
	const testDir = setup();
	try {
		// Create plugin directory with han-config.json
		const pluginDir = join(testDir, "test-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					test: {
						dirsWith: ["package.json"],
						command: "echo hook-success",
					},
				},
			}),
		);

		// Create project with package.json
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

		// Command output is suppressed, only check for success message
		strictEqual(output.includes("passed"), true, "Expected success message");
	} finally {
		teardown();
	}
});

test("new format runs in current directory when dirsWith is empty", () => {
	const testDir = setup();
	try {
		// Create plugin directory with han-config.json (no dirsWith)
		const pluginDir = join(testDir, "test-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					lint: {
						command: "echo no-dirs-with-success",
					},
				},
			}),
		);

		// Create project
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

		// Command output is suppressed, only check for success message
		strictEqual(output.includes("passed"), true, "Expected success message");
	} finally {
		teardown();
	}
});

test("new format reports when hook not found in config", () => {
	const testDir = setup();
	try {
		// Create plugin directory with han-config.json
		const pluginDir = join(testDir, "test-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
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

		strictEqual(
			output.includes("No directories found") || output.includes("nonexistent"),
			true,
		);
	} finally {
		teardown();
	}
});

test("new format with --fail-fast stops on first failure", () => {
	const testDir = setup();
	try {
		// Create plugin directory
		const pluginDir = join(testDir, "test-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					test: {
						dirsWith: ["marker.txt"],
						command: "exit 1",
					},
				},
			}),
		);

		// Create project with multiple matching directories
		const projectDir = join(testDir, "project");
		mkdirSync(join(projectDir, "pkg1"), { recursive: true });
		mkdirSync(join(projectDir, "pkg2"), { recursive: true });
		writeFileSync(join(projectDir, "pkg1", "marker.txt"), "");
		writeFileSync(join(projectDir, "pkg2", "marker.txt"), "");

		execSync("git init", { cwd: projectDir, stdio: "pipe" });
		execSync("git add .", { cwd: projectDir, stdio: "pipe" });

		try {
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
			throw new Error("Should have failed");
		} catch (error) {
			const execError = error as ExecError;
			strictEqual(execError.status, 2, "Expected exit code 2");
		}
	} finally {
		teardown();
	}
});

test("--fail-fast clears stale failure signals from previous runs", () => {
	const testDir = setup();
	try {
		// Create plugin directory
		const pluginDir = join(testDir, "test-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					test: {
						dirsWith: ["marker.txt"],
						command: "echo success",
					},
				},
			}),
		);

		// Create project with one matching directory
		const projectDir = join(testDir, "project");
		mkdirSync(join(projectDir, "pkg1"), { recursive: true });
		writeFileSync(join(projectDir, "pkg1", "marker.txt"), "");

		execSync("git init", { cwd: projectDir, stdio: "pipe" });
		execSync("git add .", { cwd: projectDir, stdio: "pipe" });

		// Create a stale failure sentinel file to simulate a previous failed run
		const sessionId = "test-stale-sentinel-cleanup";
		const sentinelDir = join(tmpdir(), "han-hooks", sessionId);
		mkdirSync(sentinelDir, { recursive: true });
		const sentinelPath = join(sentinelDir, "failure.sentinel");
		writeFileSync(
			sentinelPath,
			JSON.stringify({
				pluginName: "stale-plugin",
				hookName: "stale-hook",
				timestamp: Date.now() - 10000, // 10 seconds ago
			}),
		);

		// Verify the sentinel file exists
		strictEqual(
			existsSync(sentinelPath),
			true,
			"Stale sentinel file should exist before test",
		);

		// Run a hook with --fail-fast - it should succeed despite the stale sentinel
		// because clearFailureSignal() should clean it up
		// If the hook doesn't clear the sentinel, it will exit with code 2
		execSync(`${binCommand} hook run test-plugin test --fail-fast`, {
			cwd: projectDir,
			encoding: "utf8",
			stdio: "pipe",
			env: {
				...process.env,
				CLAUDE_PLUGIN_ROOT: pluginDir,
				CLAUDE_PROJECT_DIR: projectDir,
				HAN_SESSION_ID: sessionId, // Use the same session ID
			},
		});

		// If we reach here, the hook ran successfully (didn't exit with code 2)
		// Verify the sentinel was cleared
		strictEqual(
			existsSync(sentinelPath),
			false,
			"Stale sentinel file should be cleared after successful run",
		);
	} finally {
		teardown();
	}
});

// ============================================
// User override tests (han-config.yml)
// ============================================

test("han-config.yml can override command", () => {
	const testDir = setup();
	try {
		// Create plugin directory
		const pluginDir = join(testDir, "test-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					test: {
						dirsWith: ["package.json"],
						command: "echo original-command",
					},
				},
			}),
		);

		// Create project with package.json and han-config.yml override
		const projectDir = join(testDir, "project");
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(join(projectDir, "package.json"), "{}");
		writeFileSync(
			join(projectDir, "han-config.yml"),
			"test-plugin:\n  test:\n    command: echo overridden-command\n",
		);

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

		// Command output is suppressed, check that it passed (proving the command ran)
		strictEqual(output.includes("passed"), true, "Expected success message");
	} finally {
		teardown();
	}
});

test("han-config.yml can disable hook", () => {
	const testDir = setup();
	try {
		// Create plugin directory
		const pluginDir = join(testDir, "test-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					test: {
						dirsWith: ["package.json"],
						command: "echo should-not-run",
					},
				},
			}),
		);

		// Create project with disabled hook
		const projectDir = join(testDir, "project");
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(join(projectDir, "package.json"), "{}");
		writeFileSync(
			join(projectDir, "han-config.yml"),
			"test-plugin:\n  test:\n    enabled: false\n",
		);

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

		strictEqual(
			output.includes("should-not-run"),
			false,
			"Should not run disabled hook",
		);
		strictEqual(output.includes("disabled"), true, "Expected disabled message");
	} finally {
		teardown();
	}
});

test("han-config.yml override only affects specific directory", () => {
	const testDir = setup();
	try {
		// Create plugin directory
		const pluginDir = join(testDir, "test-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					test: {
						dirsWith: ["package.json"],
						command: "echo default",
					},
				},
			}),
		);

		// Create project with two packages, only one with override
		const projectDir = join(testDir, "project");
		mkdirSync(join(projectDir, "pkg1"), { recursive: true });
		mkdirSync(join(projectDir, "pkg2"), { recursive: true });
		writeFileSync(join(projectDir, "pkg1", "package.json"), "{}");
		writeFileSync(join(projectDir, "pkg2", "package.json"), "{}");
		writeFileSync(
			join(projectDir, "pkg1", "han-config.yml"),
			"test-plugin:\n  test:\n    command: echo custom\n",
		);

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

		// Command output is suppressed, check that both directories passed
		strictEqual(
			output.includes("2 directories passed") || output.includes("passed"),
			true,
			"Expected success for both directories",
		);
	} finally {
		teardown();
	}
});

test("han-config.yml if_changed merges with plugin defaults", async () => {
	// Test that user if_changed patterns ADD to plugin defaults rather than replacing
	const { getHookConfigs } = await import("../lib/hook-config.js");

	const testDir = setup();
	try {
		// Create plugin directory with ifChanged patterns
		const pluginDir = join(testDir, "test-plugin");
		mkdirSync(pluginDir, { recursive: true });
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					lint: {
						command: "echo lint",
						dirsWith: ["package.json"],
						ifChanged: ["**/*.ts", "**/*.js"],
					},
				},
			}),
		);

		// Create project with han-config.yml that adds more patterns
		const projectDir = join(testDir, "project");
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(join(projectDir, "package.json"), "{}");
		writeFileSync(
			join(projectDir, "han-config.yml"),
			"test-plugin:\n  lint:\n    if_changed:\n      - '**/*.json'\n      - '**/*.md'\n",
		);

		execSync("git init", { cwd: projectDir, stdio: "pipe" });
		execSync("git add .", { cwd: projectDir, stdio: "pipe" });

		const configs = getHookConfigs(pluginDir, "lint", projectDir);

		strictEqual(configs.length, 1, "Expected 1 config");

		const patterns = configs[0].ifChanged ?? [];
		// Should have both plugin patterns AND user patterns (merged)
		strictEqual(
			patterns.includes("**/*.ts"),
			true,
			"Expected plugin pattern **/*.ts",
		);
		strictEqual(
			patterns.includes("**/*.js"),
			true,
			"Expected plugin pattern **/*.js",
		);
		strictEqual(
			patterns.includes("**/*.json"),
			true,
			"Expected user pattern **/*.json",
		);
		strictEqual(
			patterns.includes("**/*.md"),
			true,
			"Expected user pattern **/*.md",
		);
		strictEqual(patterns.length, 4, "Expected 4 merged patterns");
	} finally {
		teardown();
	}
});

// ============================================
// Cache invalidation tests
// ============================================

test("cache includes plugin files - plugin script change invalidates cache", () => {
	const testDir = setup();
	const originalProjectDir = process.env.CLAUDE_PROJECT_DIR;
	try {
		// Create a plugin directory with a script
		const pluginDir = join(testDir, "cache-test-plugin-files");
		const pluginClaudeDir = join(pluginDir, ".claude-plugin");
		const scriptsDir = join(pluginDir, "scripts");
		mkdirSync(pluginClaudeDir, { recursive: true });
		mkdirSync(scriptsDir, { recursive: true });

		writeFileSync(
			join(pluginClaudeDir, "plugin.json"),
			JSON.stringify({ name: "cache-test-plugin-files", version: "1.0.0" }),
		);
		writeFileSync(join(scriptsDir, "build.sh"), "#!/bin/bash\necho test");

		// Create a project directory with source files
		const projectDir = join(testDir, "project-plugin-files");
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(join(projectDir, "app.swift"), "// Swift code");

		// Set CLAUDE_PROJECT_DIR to isolate cache for this test
		process.env.CLAUDE_PROJECT_DIR = projectDir;

		// Track initial state
		trackFiles(
			"cache-test-plugin-files",
			"build-hook",
			projectDir,
			["**/*.swift"],
			pluginDir,
		);

		// No changes - should return false
		const noChanges = checkForChanges(
			"cache-test-plugin-files",
			"build-hook",
			projectDir,
			["**/*.swift"],
			pluginDir,
		);
		strictEqual(noChanges, false, "Expected no changes when nothing changed");

		// Modify plugin script
		writeFileSync(join(scriptsDir, "build.sh"), "#!/bin/bash\necho modified");

		// Should detect change
		const hasChanges = checkForChanges(
			"cache-test-plugin-files",
			"build-hook",
			projectDir,
			["**/*.swift"],
			pluginDir,
		);
		strictEqual(
			hasChanges,
			true,
			"Expected changes when plugin script changed",
		);
	} finally {
		// Restore original CLAUDE_PROJECT_DIR
		if (originalProjectDir === undefined) {
			delete process.env.CLAUDE_PROJECT_DIR;
		} else {
			process.env.CLAUDE_PROJECT_DIR = originalProjectDir;
		}
		teardown();
	}
});

test("cache includes han-config.yml - local config change invalidates cache", () => {
	const testDir = setup();
	const originalProjectDir = process.env.CLAUDE_PROJECT_DIR;
	try {
		// Create a plugin directory with visible files (hidden dirs like .claude-plugin are skipped by glob)
		const pluginDir = join(testDir, "cache-test-han-config");
		const pluginClaudeDir = join(pluginDir, ".claude-plugin");
		mkdirSync(pluginClaudeDir, { recursive: true });

		writeFileSync(
			join(pluginClaudeDir, "plugin.json"),
			JSON.stringify({ name: "cache-test-han-config", version: "1.0.0" }),
		);
		// Add a visible file so plugin tracking works (hidden dirs are skipped)
		writeFileSync(join(pluginDir, "README.md"), "# Test Plugin");

		// Create a project directory with source files
		const projectDir = join(testDir, "project-han-config");
		mkdirSync(projectDir, { recursive: true });
		writeFileSync(join(projectDir, "app.swift"), "// Swift code");

		// Set CLAUDE_PROJECT_DIR to isolate cache for this test
		process.env.CLAUDE_PROJECT_DIR = projectDir;

		// Track initial state
		trackFiles(
			"cache-test-han-config",
			"build-hook",
			projectDir,
			["**/*.swift"],
			pluginDir,
		);

		// No changes - should return false
		const noChanges = checkForChanges(
			"cache-test-han-config",
			"build-hook",
			projectDir,
			["**/*.swift"],
			pluginDir,
		);
		strictEqual(noChanges, false, "Expected no changes when nothing changed");

		// Add han-config.yml to project directory
		writeFileSync(
			join(projectDir, "han-config.yml"),
			"cache-test-han-config:\n  build-hook:\n    command: custom-command\n",
		);

		// Should detect change
		const hasChanges = checkForChanges(
			"cache-test-han-config",
			"build-hook",
			projectDir,
			["**/*.swift"],
			pluginDir,
		);
		strictEqual(hasChanges, true, "Expected changes when han-config.yml added");
	} finally {
		// Restore original CLAUDE_PROJECT_DIR
		if (originalProjectDir === undefined) {
			delete process.env.CLAUDE_PROJECT_DIR;
		} else {
			process.env.CLAUDE_PROJECT_DIR = originalProjectDir;
		}
		teardown();
	}
});

// ============================================
// MCP Server tests
// ============================================

function sendMcpRequest(
	request: Record<string, unknown>,
	testDir?: string,
	envVars?: Record<string, string>,
): string {
	const input = JSON.stringify(request);
	const options: ExecSyncOptionsWithStringEncoding = {
		encoding: "utf8",
		input,
		stdio: ["pipe", "pipe", "pipe"],
		env: {
			...process.env,
			...(testDir ? { CLAUDE_PROJECT_DIR: testDir } : {}),
			...(envVars || {}),
		},
	};
	if (testDir) {
		options.cwd = testDir;
	}
	return execSync(`${binCommand} mcp`, options);
}

test("mcp command responds to initialize", () => {
	const response = sendMcpRequest({
		jsonrpc: "2.0",
		id: 1,
		method: "initialize",
		params: {},
	});
	const parsed = JSON.parse(response);

	strictEqual(parsed.jsonrpc, "2.0");
	strictEqual(parsed.id, 1);
	strictEqual(parsed.result.protocolVersion, "2024-11-05");
	strictEqual(parsed.result.serverInfo.name, "han");
	strictEqual(parsed.result.capabilities.tools !== undefined, true);
});

test("mcp command responds to ping", () => {
	const response = sendMcpRequest({
		jsonrpc: "2.0",
		id: 2,
		method: "ping",
		params: {},
	});
	const parsed = JSON.parse(response);

	strictEqual(parsed.jsonrpc, "2.0");
	strictEqual(parsed.id, 2);
	strictEqual(parsed.error, undefined);
	deepStrictEqual(parsed.result, {});
});

test("mcp command responds to tools/list", () => {
	const response = sendMcpRequest({
		jsonrpc: "2.0",
		id: 3,
		method: "tools/list",
		params: {},
	});
	const parsed = JSON.parse(response);

	strictEqual(parsed.jsonrpc, "2.0");
	strictEqual(parsed.id, 3);
	strictEqual(Array.isArray(parsed.result.tools), true);
});

test("mcp discovers tools from installed plugins", () => {
	const testDir = setup();
	try {
		// Create .claude directory with settings
		const claudeDir = join(testDir, ".claude");
		mkdirSync(claudeDir, { recursive: true });

		// Create marketplace with plugin
		const marketplaceDir = join(testDir, "marketplace");
		const pluginDir = join(marketplaceDir, "jutsu", "jutsu-mcp-test");
		mkdirSync(pluginDir, { recursive: true });

		// Create plugin with han-config.json
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					test: {
						dirsWith: ["package.json"],
						command: "echo mcp-test-success",
					},
					lint: {
						command: "echo mcp-lint-success",
					},
				},
			}),
		);

		// Create settings that point to the marketplace
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
					"jutsu-mcp-test@test-marketplace": true,
				},
			}),
		);

		const response = sendMcpRequest(
			{
				jsonrpc: "2.0",
				id: 3,
				method: "tools/list",
				params: {},
			},
			testDir,
		);
		const parsed = JSON.parse(response);

		strictEqual(parsed.jsonrpc, "2.0");
		strictEqual(Array.isArray(parsed.result.tools), true);

		// Find our plugin's tools
		const tools = parsed.result.tools as Array<{
			name: string;
			description: string;
		}>;
		const testTool = tools.find((t) => t.name === "jutsu_mcp_test_test");
		const lintTool = tools.find((t) => t.name === "jutsu_mcp_test_lint");

		strictEqual(testTool !== undefined, true, "Expected test tool to be found");
		strictEqual(lintTool !== undefined, true, "Expected lint tool to be found");
		strictEqual(
			testTool?.description.includes("test"),
			true,
			"Expected test tool description",
		);
	} finally {
		teardown();
	}
});

test("mcp returns error for unknown method", () => {
	const response = sendMcpRequest({
		jsonrpc: "2.0",
		id: 4,
		method: "unknown/method",
		params: {},
	});
	const parsed = JSON.parse(response);

	strictEqual(parsed.jsonrpc, "2.0");
	strictEqual(parsed.id, 4);
	strictEqual(parsed.error !== undefined, true, "Expected error response");
	strictEqual(
		parsed.error.code,
		-32601,
		"Expected method not found error code",
	);
});

test("mcp returns error for unknown tool", () => {
	const response = sendMcpRequest({
		jsonrpc: "2.0",
		id: 5,
		method: "tools/call",
		params: {
			name: "nonexistent_tool",
			arguments: {},
		},
	});
	const parsed = JSON.parse(response);

	strictEqual(parsed.jsonrpc, "2.0");
	strictEqual(parsed.id, 5);
	strictEqual(parsed.error !== undefined, true, "Expected error response");
	strictEqual(parsed.error.code, -32602, "Expected invalid params error code");
});

test("mcp tools ignore failure signals by default", () => {
	const testDir = setup();
	try {
		// Create marketplace with plugin
		const marketplaceDir = join(testDir, "marketplace");
		const pluginDir = join(marketplaceDir, "jutsu", "jutsu-mcp-test");
		mkdirSync(pluginDir, { recursive: true });

		// Create plugin with a test hook
		writeFileSync(
			join(pluginDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					test: {
						dirsWith: ["marker.txt"],
						command: "echo mcp-test-success",
					},
				},
			}),
		);

		// Create .claude directory with settings IN testDir (same location as other MCP tests)
		const claudeDir = join(testDir, ".claude");
		mkdirSync(claudeDir, { recursive: true });
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
					"jutsu-mcp-test@test-marketplace": true,
				},
			}),
		);

		// Create marker file directly in testDir/pkg1
		mkdirSync(join(testDir, "pkg1"), { recursive: true });
		writeFileSync(join(testDir, "pkg1", "marker.txt"), "");

		execSync("git init", { cwd: testDir, stdio: "pipe" });
		execSync("git add .", { cwd: testDir, stdio: "pipe" });

		// Create a stale failure sentinel to simulate a previous hook failure
		const sessionId = "test-mcp-ignore-failure";
		const sentinelDir = join(tmpdir(), "han-hooks", sessionId);
		mkdirSync(sentinelDir, { recursive: true });
		const sentinelPath = join(sentinelDir, "failure.sentinel");
		writeFileSync(
			sentinelPath,
			JSON.stringify({
				pluginName: "some-plugin",
				hookName: "some-hook",
				timestamp: Date.now() - 5000,
			}),
		);

		// Verify sentinel exists
		strictEqual(
			existsSync(sentinelPath),
			true,
			"Failure sentinel should exist",
		);

		// Call the MCP tool - it should succeed despite the failure sentinel
		const response = sendMcpRequest(
			{
				jsonrpc: "2.0",
				id: 6,
				method: "tools/call",
				params: {
					name: "jutsu_mcp_test_test",
					arguments: {},
				},
			},
			testDir,
			{
				HAN_SESSION_ID: sessionId,
			},
		);

		const parsed = JSON.parse(response);

		// Verify successful execution
		strictEqual(parsed.jsonrpc, "2.0");
		strictEqual(parsed.id, 6);
		strictEqual(
			parsed.error,
			undefined,
			"MCP tool should not error due to failure signal",
		);
		strictEqual(
			parsed.result.isError,
			false,
			`MCP tool should execute successfully. Output: ${parsed.result?.content?.[0]?.text || "N/A"}`,
		);
		strictEqual(
			parsed.result.content[0].text.includes("passed") ||
				parsed.result.content[0].text.includes("✅"),
			true,
			`MCP tool output should indicate success. Got: ${parsed.result.content[0].text}`,
		);

		// Cleanup sentinel
		rmSync(sentinelPath, { force: true });
	} finally {
		teardown();
	}
});

// ============================================
// Claude Settings Merge Tests
// ============================================

test("settings merge includes user, project, and local settings", () => {
	const testDir = setup();
	try {
		// Create .claude directory with multiple settings files
		const claudeDir = join(testDir, ".claude");
		mkdirSync(claudeDir, { recursive: true });

		// Create marketplace with plugins
		const marketplaceDir = join(testDir, "marketplace");

		// Create plugin A (from user/project settings)
		const pluginADir = join(marketplaceDir, "jutsu", "jutsu-plugin-a");
		mkdirSync(pluginADir, { recursive: true });
		writeFileSync(
			join(pluginADir, "han-config.json"),
			JSON.stringify({
				hooks: {
					test: { command: "echo plugin-a-test" },
				},
			}),
		);

		// Create plugin B (to be disabled by project settings)
		const pluginBDir = join(marketplaceDir, "jutsu", "jutsu-plugin-b");
		mkdirSync(pluginBDir, { recursive: true });
		writeFileSync(
			join(pluginBDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					test: { command: "echo plugin-b-test" },
				},
			}),
		);

		// Create plugin C (from local settings only)
		const pluginCDir = join(marketplaceDir, "jutsu", "jutsu-plugin-c");
		mkdirSync(pluginCDir, { recursive: true });
		writeFileSync(
			join(pluginCDir, "han-config.json"),
			JSON.stringify({
				hooks: {
					lint: { command: "echo plugin-c-lint" },
				},
			}),
		);

		// Project settings - enable A and B
		writeFileSync(
			join(claudeDir, "settings.json"),
			JSON.stringify({
				enabledPlugins: {
					"jutsu-plugin-a@test-marketplace": true,
					"jutsu-plugin-b@test-marketplace": true,
				},
				extraKnownMarketplaces: {
					"test-marketplace": {
						source: { source: "directory", path: marketplaceDir },
					},
				},
			}),
		);

		// Local settings - disable B, enable C
		writeFileSync(
			join(claudeDir, "settings.local.json"),
			JSON.stringify({
				enabledPlugins: {
					"jutsu-plugin-b@test-marketplace": false, // Disable B
					"jutsu-plugin-c@test-marketplace": true, // Enable C
				},
			}),
		);

		// Test via MCP server
		const response = sendMcpRequest(
			{
				jsonrpc: "2.0",
				id: 100,
				method: "tools/list",
				params: {},
			},
			testDir,
		);

		const parsed = JSON.parse(response);
		strictEqual(parsed.error, undefined, "Should not have error");
		strictEqual(Array.isArray(parsed.result.tools), true);

		const toolNames = parsed.result.tools.map((t: { name: string }) => t.name);

		// Plugin A should be enabled (from project settings)
		strictEqual(
			toolNames.includes("jutsu_plugin_a_test"),
			true,
			"Plugin A should be enabled",
		);

		// Plugin B should be disabled (overridden by local settings)
		strictEqual(
			toolNames.includes("jutsu_plugin_b_test"),
			false,
			"Plugin B should be disabled by local settings",
		);

		// Plugin C should be enabled (from local settings)
		strictEqual(
			toolNames.includes("jutsu_plugin_c_lint"),
			true,
			"Plugin C should be enabled from local settings",
		);
	} finally {
		teardown();
	}
});

// ============================================
// Summary
// ============================================

console.log(`\n${"=".repeat(50)}`);
if (testsFailed === 0) {
	console.log(`All ${testsPassed} tests passed! ✓`);
} else {
	console.log(`${testsPassed} passed, ${testsFailed} failed`);
	process.exit(1);
}
