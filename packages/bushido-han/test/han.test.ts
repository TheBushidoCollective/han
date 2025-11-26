import { deepStrictEqual, strictEqual } from "node:assert";
import {
	type ExecSyncOptionsWithStringEncoding,
	execSync,
} from "node:child_process";
import { mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parsePluginRecommendations } from "../lib/shared.js";

// Get __dirname equivalent in ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// Test runs from dist/test, so go up to dist, then to lib/main.js
const binPath = join(__dirname, "..", "lib", "main.js");

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

function test(name: string, fn: () => void): void {
	try {
		fn();
		console.log(`✓ ${name}`);
	} catch (error) {
		console.error(`✗ ${name}`);
		console.error((error as Error).message);
		process.exit(1);
	}
}

interface ExecError extends Error {
	status?: number;
	code?: number;
	stderr?: Buffer | string;
}

// Test: shows help when no command provided
test("shows help when no command provided", () => {
	try {
		execSync(`node ${binPath} --help`, { encoding: "utf8" });
		// Help command should exit with 0
	} catch (error) {
		const execError = error as ExecError;
		const stdout = execError.message || "";
		strictEqual(stdout.includes("Usage:") || stdout.includes("han"), true);
	}
});

// Test: shows error when hook run has no command argument or -- separator
test("shows error when hook run has no command argument", () => {
	try {
		execSync(`node ${binPath} hook run`, { encoding: "utf8" });
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

// Test: passes when no directories match filter
test("passes when no directories match filter", () => {
	const testDir = setup();
	try {
		const output = execSync(
			`node ${binPath} hook run --dirs-with nonexistent.txt -- echo test`,
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

// Test: runs command in matching directories
test("runs command in matching directories", () => {
	const testDir = setup();
	try {
		// Create test structure
		mkdirSync(join(testDir, "pkg1"));
		mkdirSync(join(testDir, "pkg2"));
		writeFileSync(join(testDir, "pkg1", "package.json"), "{}");
		writeFileSync(join(testDir, "pkg2", "package.json"), "{}");

		// Initialize git repo so directories are discovered
		execSync("git init", { cwd: testDir });
		execSync("git add .", { cwd: testDir });

		const output = execSync(
			`node ${binPath} hook run --dirs-with package.json -- echo success`,
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

// Test: fails with exit code 2 when command fails
test("fails with exit code 2 when command fails", () => {
	const testDir = setup();
	try {
		mkdirSync(join(testDir, "pkg1"));
		writeFileSync(join(testDir, "pkg1", "package.json"), "{}");

		// Initialize git repo
		execSync("git init", { cwd: testDir });
		execSync("git add .", { cwd: testDir });

		try {
			execSync(`node ${binPath} hook run --dirs-with package.json -- exit 1`, {
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

// Test: stops on first failure with --fail-fast
test("stops on first failure with --fail-fast", () => {
	const testDir = setup();
	try {
		mkdirSync(join(testDir, "pkg1"));
		mkdirSync(join(testDir, "pkg2"));
		writeFileSync(join(testDir, "pkg1", "package.json"), "{}");
		writeFileSync(join(testDir, "pkg2", "package.json"), "{}");

		// Initialize git repo
		execSync("git init", { cwd: testDir });
		execSync("git add .", { cwd: testDir });

		try {
			execSync(
				`node ${binPath} hook run --fail-fast --dirs-with package.json -- exit 1`,
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

// ============================================
// parsePluginRecommendations tests
// ============================================

// Test: parsePluginRecommendations returns unique plugins (no duplicates)
test("parsePluginRecommendations returns unique plugins", () => {
	const content = '["bushido", "buki-typescript", "bushido", "buki-react"]';
	const result = parsePluginRecommendations(content);

	// Verify no duplicates
	const uniqueResult = [...new Set(result)];
	deepStrictEqual(
		result.length,
		uniqueResult.length,
		`Expected no duplicates but found ${result.length - uniqueResult.length} duplicate(s)`,
	);
});

// Test: parsePluginRecommendations always includes bushido
test("parsePluginRecommendations always includes bushido", () => {
	const content = '["buki-typescript", "buki-react"]';
	const result = parsePluginRecommendations(content);

	strictEqual(
		result.includes("bushido"),
		true,
		"Expected bushido to always be included",
	);
});

// Test: parsePluginRecommendations handles JSON array format
test("parsePluginRecommendations handles JSON array format", () => {
	const content = 'Based on analysis: ["buki-typescript", "buki-biome"]';
	const result = parsePluginRecommendations(content);

	strictEqual(result.includes("buki-typescript"), true);
	strictEqual(result.includes("buki-biome"), true);
	strictEqual(result.includes("bushido"), true);
});

// Test: parsePluginRecommendations handles plain text plugin names
test("parsePluginRecommendations handles plain text plugin names", () => {
	const content =
		"I recommend installing buki-typescript for TypeScript and buki-react for React development.";
	const result = parsePluginRecommendations(content);

	strictEqual(result.includes("buki-typescript"), true);
	strictEqual(result.includes("buki-react"), true);
	strictEqual(result.includes("bushido"), true);
});

// Test: parsePluginRecommendations returns bushido when no plugins found
test("parsePluginRecommendations returns bushido when no plugins found", () => {
	const content = "No specific plugins needed for this project.";
	const result = parsePluginRecommendations(content);

	deepStrictEqual(result, ["bushido"]);
});

// Test: parsePluginRecommendations deduplicates from regex matches
test("parsePluginRecommendations deduplicates from regex matches", () => {
	// Content where bushido appears multiple times in plain text
	const content =
		"For this project, I recommend bushido and buki-typescript. The bushido plugin is essential.";
	const result = parsePluginRecommendations(content);

	// Count how many times bushido appears
	const bushidoCount = result.filter((p) => p === "bushido").length;
	strictEqual(
		bushidoCount,
		1,
		`Expected exactly 1 bushido but found ${bushidoCount}`,
	);
});

// Test: parsePluginRecommendations handles all plugin prefixes
test("parsePluginRecommendations handles all plugin prefixes", () => {
	const content =
		"Install buki-typescript for development, do-blockchain-development for web3, and sensei-gitlab for GitLab integration.";
	const result = parsePluginRecommendations(content);

	strictEqual(result.includes("buki-typescript"), true);
	strictEqual(result.includes("do-blockchain-development"), true);
	strictEqual(result.includes("sensei-gitlab"), true);
});

// Test: parsePluginRecommendations handles empty string
test("parsePluginRecommendations handles empty string", () => {
	const result = parsePluginRecommendations("");
	deepStrictEqual(result, ["bushido"]);
});

// Test: parsePluginRecommendations handles malformed JSON gracefully
test("parsePluginRecommendations handles malformed JSON gracefully", () => {
	const content = '["buki-typescript", buki-react]'; // missing quotes
	const result = parsePluginRecommendations(content);

	// Should fallback to regex matching
	strictEqual(result.includes("bushido"), true);
	// The regex should still find buki-typescript and buki-react
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

// Test: han plugin install adds plugin to settings
test("han plugin install adds plugin to settings", () => {
	const testDir = setup();
	try {
		const claudeDir = setupClaudeDir(testDir);
		const settingsPath = join(claudeDir, "settings.json");

		// Create initial settings file
		writeFileSync(settingsPath, JSON.stringify({}, null, 2));

		// Run plugin install
		execSync(`node ${binPath} plugin install buki-typescript`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: "pipe",
		});

		// Verify settings were updated
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

// Test: han plugin uninstall removes plugin from settings
test("han plugin uninstall removes plugin from settings", () => {
	const testDir = setup();
	try {
		const claudeDir = setupClaudeDir(testDir);
		const settingsPath = join(claudeDir, "settings.json");

		// Create settings with an installed plugin
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

		// Run plugin uninstall
		execSync(`node ${binPath} plugin uninstall buki-typescript`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: "pipe",
		});

		// Verify plugin was removed
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

// Test: han plugin install is idempotent (doesn't duplicate)
test("han plugin install is idempotent", () => {
	const testDir = setup();
	try {
		const claudeDir = setupClaudeDir(testDir);
		const settingsPath = join(claudeDir, "settings.json");

		// Create settings with already installed plugin
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

		// Run plugin install again
		const output = execSync(`node ${binPath} plugin install buki-typescript`, {
			cwd: testDir,
			encoding: "utf8",
			stdio: "pipe",
		});

		// Verify message about already installed (case-insensitive)
		strictEqual(
			output.toLowerCase().includes("already installed"),
			true,
			"Expected 'already installed' message",
		);

		// Verify settings weren't duplicated
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

// Test: han plugin uninstall handles non-existent plugin gracefully
test("han plugin uninstall handles non-existent plugin gracefully", () => {
	const testDir = setup();
	try {
		const claudeDir = setupClaudeDir(testDir);
		const settingsPath = join(claudeDir, "settings.json");

		// Create empty settings
		writeFileSync(settingsPath, JSON.stringify({}, null, 2));

		// Run plugin uninstall on non-existent plugin
		const output = execSync(
			`node ${binPath} plugin uninstall non-existent-plugin`,
			{
				cwd: testDir,
				encoding: "utf8",
				stdio: "pipe",
			},
		);

		// Verify message about not installed (case-insensitive)
		strictEqual(
			output.toLowerCase().includes("not installed"),
			true,
			"Expected 'not installed' message",
		);
	} finally {
		teardown();
	}
});

// Test: han hook test shows help
test("han hook test shows help", () => {
	try {
		const output = execSync(`node ${binPath} hook test --help`, {
			encoding: "utf8",
		});
		strictEqual(
			output.includes("Validate hook configurations"),
			true,
			"Expected help output to mention hook validation",
		);
	} catch (error) {
		throw new Error(`Expected help to show, got error: ${error}`);
	}
});

console.log("\nAll tests passed! ✓");
