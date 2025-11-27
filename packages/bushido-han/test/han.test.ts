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
import { parsePluginRecommendations } from "../lib/shared.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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

test("shows error when hook run has no command argument", () => {
	try {
		execSync(`${binCommand} hook run`, { encoding: "utf8", stdio: "pipe" });
		throw new Error("Should have failed");
	} catch (error) {
		const execError = error as ExecError;
		strictEqual(execError.status, 1);
		const stderr = execError.stderr?.toString() || "";
		strictEqual(
			stderr.includes("-- separator") || stderr.includes("error"),
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
// Summary
// ============================================

console.log(`\n${"=".repeat(50)}`);
if (testsFailed === 0) {
	console.log(`All ${testsPassed} tests passed! ✓`);
} else {
	console.log(`${testsPassed} passed, ${testsFailed} failed`);
	process.exit(1);
}
