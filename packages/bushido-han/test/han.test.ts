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
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
	detectInstallMethod,
	getCurrentVersion,
	getLatestVersion,
} from "../lib/commands/update.js";
import { parsePluginRecommendations } from "../lib/shared.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Skip auto-update check during tests
process.env.HAN_SKIP_UPDATE_CHECK = "1";

// Determine which binary to test
// If HAN_TEST_BINARY env var is set, use the compiled binary
// Otherwise, use the Node.js version
const USE_BINARY = process.env.HAN_TEST_BINARY === "true";
const binPath = USE_BINARY
	? join(__dirname, "..", "..", "dist", "han")
	: join(__dirname, "..", "lib", "main.js");
const binCommand = USE_BINARY ? binPath : `node ${binPath}`;

console.log(`\nTesting: ${USE_BINARY ? "Binary (bun)" : "JavaScript (node)"}`);
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

// ============================================
// Hook run tests
// ============================================

test("shows error when hook run has no hook name or command", () => {
	try {
		execSync(`${binCommand} hook run`, { encoding: "utf8", stdio: "pipe" });
		throw new Error("Should have failed");
	} catch (error) {
		const execError = error as ExecError;
		strictEqual(execError.status, 1);
		const stderr = execError.stderr?.toString() || "";
		strictEqual(
			stderr.includes("Hook name is required") ||
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

		strictEqual(output.includes("success"), true);
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
			strictEqual(
				stderr.includes("failed validation") || stderr.includes("Failed when"),
				true,
			);
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
			strictEqual(stderr.includes("Failed when trying to run"), true);
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

		strictEqual(output.includes("success"), true);
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
								repo: "thebushidocollective/sensei",
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
		const output = execSync(`${binCommand} hook test`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
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
	const content = '["bushido", "buki-typescript", "bushido", "buki-react"]';
	const result = parsePluginRecommendations(content);

	const uniqueResult = [...new Set(result)];
	deepStrictEqual(
		result.length,
		uniqueResult.length,
		`Expected no duplicates but found ${result.length - uniqueResult.length} duplicate(s)`,
	);
});

test("parsePluginRecommendations always includes bushido", () => {
	const content = '["buki-typescript", "buki-react"]';
	const result = parsePluginRecommendations(content);

	strictEqual(
		result.includes("bushido"),
		true,
		"Expected bushido to always be included",
	);
});

test("parsePluginRecommendations handles JSON array format", () => {
	const content = 'Based on analysis: ["buki-typescript", "buki-biome"]';
	const result = parsePluginRecommendations(content);

	strictEqual(result.includes("buki-typescript"), true);
	strictEqual(result.includes("buki-biome"), true);
	strictEqual(result.includes("bushido"), true);
});

test("parsePluginRecommendations handles plain text plugin names", () => {
	const content =
		"I recommend installing buki-typescript for TypeScript and buki-react for React development.";
	const result = parsePluginRecommendations(content);

	strictEqual(result.includes("buki-typescript"), true);
	strictEqual(result.includes("buki-react"), true);
	strictEqual(result.includes("bushido"), true);
});

test("parsePluginRecommendations returns bushido when no plugins found", () => {
	const content = "No specific plugins needed for this project.";
	const result = parsePluginRecommendations(content);

	deepStrictEqual(result, ["bushido"]);
});

test("parsePluginRecommendations deduplicates from regex matches", () => {
	const content =
		"For this project, I recommend bushido and buki-typescript. The bushido plugin is essential.";
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
		"Install buki-typescript for development, do-blockchain-development for web3, and sensei-gitlab for GitLab integration.";
	const result = parsePluginRecommendations(content);

	strictEqual(result.includes("buki-typescript"), true);
	strictEqual(result.includes("do-blockchain-development"), true);
	strictEqual(result.includes("sensei-gitlab"), true);
});

test("parsePluginRecommendations handles empty string", () => {
	const result = parsePluginRecommendations("");
	deepStrictEqual(result, ["bushido"]);
});

test("parsePluginRecommendations handles malformed JSON gracefully", () => {
	const content = '["buki-typescript", buki-react]'; // missing quotes
	const result = parsePluginRecommendations(content);

	strictEqual(result.includes("bushido"), true);
	strictEqual(result.includes("buki-typescript"), true);
	strictEqual(result.includes("buki-react"), true);
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

		execSync(`${binCommand} plugin install buki-typescript`, {
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
			settings.enabledPlugins?.["buki-typescript@han"],
			true,
			"Expected buki-typescript@han to be enabled",
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
								repo: "thebushidocollective/sensei",
							},
						},
					},
					enabledPlugins: {
						"buki-typescript@han": true,
					},
				},
				null,
				2,
			),
		);

		execSync(`${binCommand} plugin uninstall buki-typescript`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: "pipe",
		});

		const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

		strictEqual(
			settings.enabledPlugins?.["buki-typescript@han"],
			undefined,
			"Expected buki-typescript@han to be removed",
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
								repo: "thebushidocollective/sensei",
							},
						},
					},
					enabledPlugins: {
						"buki-typescript@han": true,
					},
				},
				null,
				2,
			),
		);

		const output = execSync(`${binCommand} plugin install buki-typescript`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: "pipe",
		});

		strictEqual(
			output.toLowerCase().includes("already installed"),
			true,
			"Expected 'already installed' message",
		);

		const settings = JSON.parse(readFileSync(settingsPath, "utf8"));
		const pluginKeys = Object.keys(settings.enabledPlugins || {}).filter((k) =>
			k.includes("buki-typescript"),
		);
		strictEqual(
			pluginKeys.length,
			1,
			"Expected exactly one buki-typescript entry",
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
			`${binCommand} plugin uninstall non-existent-plugin`,
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

		execSync(`${binCommand} plugin install buki-typescript buki-react`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: "pipe",
		});

		const settings = JSON.parse(readFileSync(settingsPath, "utf8"));

		strictEqual(
			settings.enabledPlugins?.["buki-typescript@han"],
			true,
			"Expected buki-typescript@han to be enabled",
		);
		strictEqual(
			settings.enabledPlugins?.["buki-react@han"],
			true,
			"Expected buki-react@han to be enabled",
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

		const output = execSync(`${binCommand} hook run -- cat marker.txt`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
		} as ExecSyncOptionsWithStringEncoding);

		strictEqual(
			output.includes("test"),
			true,
			"Expected marker content in output",
		);
		strictEqual(output.includes("passed"), true, "Expected success message");
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

test("new format requires CLAUDE_PLUGIN_ROOT", () => {
	const testDir = setup();
	try {
		try {
			execSync(`${binCommand} hook run test`, {
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
				stderr.includes("CLAUDE_PLUGIN_ROOT"),
				true,
				"Expected error about CLAUDE_PLUGIN_ROOT",
			);
		}
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

		const output = execSync(`${binCommand} hook run test`, {
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
			output.includes("hook-success"),
			true,
			"Expected hook command output",
		);
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

		const output = execSync(`${binCommand} hook run lint`, {
			cwd: projectDir,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				CLAUDE_PLUGIN_ROOT: pluginDir,
				CLAUDE_PROJECT_DIR: projectDir,
			},
		} as ExecSyncOptionsWithStringEncoding);

		strictEqual(output.includes("no-dirs-with-success"), true);
		strictEqual(output.includes("passed"), true);
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

		const output = execSync(`${binCommand} hook run nonexistent`, {
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
			execSync(`${binCommand} hook run test --fail-fast`, {
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

		const output = execSync(`${binCommand} hook run test`, {
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
			output.includes("overridden-command"),
			true,
			"Expected overridden command",
		);
		strictEqual(
			output.includes("original-command"),
			false,
			"Should not see original command",
		);
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

		const output = execSync(`${binCommand} hook run test`, {
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

		const output = execSync(`${binCommand} hook run test`, {
			cwd: projectDir,
			encoding: "utf8",
			stdio: ["pipe", "pipe", "pipe"],
			env: {
				...process.env,
				CLAUDE_PLUGIN_ROOT: pluginDir,
				CLAUDE_PROJECT_DIR: projectDir,
			},
		} as ExecSyncOptionsWithStringEncoding);

		// Should see both default and custom
		strictEqual(
			output.includes("default"),
			true,
			"Expected default in non-overridden dir",
		);
		strictEqual(
			output.includes("custom"),
			true,
			"Expected custom in overridden dir",
		);
	} finally {
		teardown();
	}
});

test("han-config.yml if_changed merges with plugin defaults", async () => {
	// Test that user if_changed patterns ADD to plugin defaults rather than replacing
	const { resolveHookConfigs } = await import("../lib/hook-config.js");

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

		const configs = await resolveHookConfigs(pluginDir, "lint", projectDir);

		strictEqual(configs.length, 1, "Expected 1 config");

		const patterns = configs[0].ifChanged ?? [];
		// Should have both plugin patterns AND user patterns (merged)
		strictEqual(patterns.includes("**/*.ts"), true, "Expected plugin pattern **/*.ts");
		strictEqual(patterns.includes("**/*.js"), true, "Expected plugin pattern **/*.js");
		strictEqual(patterns.includes("**/*.json"), true, "Expected user pattern **/*.json");
		strictEqual(patterns.includes("**/*.md"), true, "Expected user pattern **/*.md");
		strictEqual(patterns.length, 4, "Expected 4 merged patterns");
	} finally {
		teardown();
	}
});

// ============================================
// Update command tests
// ============================================

test("han update --check shows current and latest version", () => {
	const output = execSync(`${binCommand} update --check`, {
		encoding: "utf8",
		stdio: ["pipe", "pipe", "pipe"],
		env: { ...process.env, HAN_SKIP_UPDATE_CHECK: "1" },
	});

	strictEqual(
		output.includes("Current version:"),
		true,
		"Expected current version in output",
	);
	strictEqual(
		output.includes("Latest version:"),
		true,
		"Expected latest version in output",
	);
});

test("han update shows help with --help", () => {
	const output = execSync(`${binCommand} update --help`, {
		encoding: "utf8",
		env: { ...process.env, HAN_SKIP_UPDATE_CHECK: "1" },
	});

	strictEqual(output.includes("Update han"), true);
	strictEqual(output.includes("--check"), true);
});

test("auto-update skips for --version flag", () => {
	// This should return quickly without hanging
	const start = Date.now();
	const output = execSync(`${binCommand} --version`, {
		encoding: "utf8",
		timeout: 5000,
	});
	const elapsed = Date.now() - start;

	strictEqual(
		/^\d+\.\d+\.\d+/.test(output.trim()),
		true,
		"Expected version output",
	);
	// Should be fast (< 2 seconds) because update check is skipped
	strictEqual(elapsed < 2000, true, `Expected fast response, got ${elapsed}ms`);
});

test("auto-update skips for --help flag", () => {
	const start = Date.now();
	const output = execSync(`${binCommand} --help`, {
		encoding: "utf8",
		timeout: 5000,
	});
	const elapsed = Date.now() - start;

	strictEqual(output.includes("Usage:"), true);
	strictEqual(elapsed < 2000, true, `Expected fast response, got ${elapsed}ms`);
});

test("auto-update skips when HAN_SKIP_UPDATE_CHECK=1", () => {
	const start = Date.now();
	execSync(`${binCommand} plugin --help`, {
		encoding: "utf8",
		timeout: 5000,
		env: { ...process.env, HAN_SKIP_UPDATE_CHECK: "1" },
	});
	const elapsed = Date.now() - start;

	// Should be very fast when update check is skipped
	strictEqual(elapsed < 2000, true, `Expected fast response, got ${elapsed}ms`);
});

test("auto-update skips for update command itself", () => {
	// update --check should not trigger auto-update (would be recursive)
	const output = execSync(`${binCommand} update --check`, {
		encoding: "utf8",
		timeout: 10000,
		stdio: ["pipe", "pipe", "pipe"],
	});

	// Should complete without "Updating han:" message in output
	strictEqual(
		output.includes("Current version:"),
		true,
		"Expected version check output",
	);
});

// ============================================
// Update module unit tests
// ============================================

test("getCurrentVersion returns valid semver", () => {
	const version = getCurrentVersion();
	strictEqual(
		/^\d+\.\d+\.\d+/.test(version) || version === "unknown",
		true,
		`Expected semver or unknown, got: ${version}`,
	);
});

test("getCurrentVersion returns same as CLI --version", () => {
	const cliVersion = execSync(`${binCommand} --version`, {
		encoding: "utf8",
		env: { ...process.env, HAN_SKIP_UPDATE_CHECK: "1" },
	}).trim();
	const fnVersion = getCurrentVersion();

	strictEqual(
		cliVersion,
		fnVersion,
		`CLI version (${cliVersion}) should match function version (${fnVersion})`,
	);
});

test("getLatestVersion returns valid semver or unknown", async () => {
	const version = await getLatestVersion();
	strictEqual(
		/^\d+\.\d+\.\d+/.test(version) || version === "unknown",
		true,
		`Expected semver or unknown, got: ${version}`,
	);
});

test("detectInstallMethod returns valid install method", () => {
	const method = detectInstallMethod();
	const validMethods = ["homebrew", "npm", "standalone", "unknown"];
	strictEqual(
		validMethods.includes(method),
		true,
		`Expected valid install method, got: ${method}`,
	);
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
