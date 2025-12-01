import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { createRequire } from "node:module";
import { dirname, join } from "node:path";
import {
	buildManifest,
	checkForChanges,
	findFilesWithGlob,
	saveCacheManifest,
} from "./hook-cache.js";
import {
	getHookConfigs,
	getPluginNameFromRoot,
	type ResolvedHookConfig,
} from "./hook-config.js";

const require = createRequire(import.meta.url);

/**
 * Load the native module from various locations:
 * 1. Same directory as the executable (for platform packages)
 * 2. Relative path from source (for development)
 * @throws Error if native module cannot be loaded
 */
function loadNativeModule(): typeof import("../../han-native") {
	const currentDir = dirname(new URL(import.meta.url).pathname);
	// Determine if we're in dist/lib or lib
	const isInDist = currentDir.includes("/dist/");
	const relativeToHanNative = isInDist ? "../../../han-native" : "../../han-native";

	const possiblePaths = [
		// For compiled binary: .node file next to executable
		join(dirname(process.execPath), "han-native.node"),
		// For development: relative path to han-native package
		join(currentDir, relativeToHanNative),
	];

	const errors: string[] = [];

	for (const modulePath of possiblePaths) {
		try {
			if (modulePath.endsWith(".node")) {
				// Direct .node file loading
				if (existsSync(modulePath)) {
					return require(modulePath) as typeof import("../../han-native");
				}
			} else {
				// Package directory loading
				return require(modulePath) as typeof import("../../han-native");
			}
		} catch (e) {
			errors.push(`${modulePath}: ${e instanceof Error ? e.message : String(e)}`);
		}
	}

	throw new Error(
		`Failed to load han-native module. Tried:\n${errors.join("\n")}\n\n` +
			"This is a required dependency. Please ensure han is installed correctly.",
	);
}

const nativeModule = loadNativeModule();

interface ValidateOptions {
	failFast: boolean;
	dirsWith: string | null;
	testDir?: string | null;
	command: string;
	stdinData?: string | null;
}

/**
 * Find directories containing marker files (respects nested .gitignore files)
 */
function findDirectoriesWithMarker(
	rootDir: string,
	markerPatterns: string[],
): string[] {
	return nativeModule.findDirectoriesWithMarkers(rootDir, markerPatterns);
}

// Run command in directory
function runCommand(
	dir: string,
	cmd: string,
	stdinData?: string | null,
): boolean {
	try {
		execSync(cmd, {
			cwd: dir,
			// If stdinData provided, pipe it; otherwise ignore stdin entirely
			stdio: stdinData
				? ["pipe", "inherit", "inherit"]
				: ["ignore", "inherit", "inherit"],
			input: stdinData || undefined,
			encoding: "utf8",
			shell: "/bin/sh",
			env: process.env,
		});
		return true;
	} catch (_e) {
		return false;
	}
}

// Run test command silently in directory (returns true if exit code 0)
function testDirCommand(dir: string, cmd: string): boolean {
	try {
		execSync(cmd, {
			cwd: dir,
			stdio: ["ignore", "ignore", "ignore"],
			encoding: "utf8",
			shell: "/bin/sh",
			env: process.env,
		});
		return true;
	} catch (_e) {
		return false;
	}
}

export function validate(options: ValidateOptions): void {
	const {
		failFast,
		dirsWith,
		testDir,
		command: commandToRun,
		stdinData,
	} = options;

	const rootDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	// No dirsWith specified - run in current directory only
	if (!dirsWith) {
		const success = runCommand(rootDir, commandToRun, stdinData);
		if (!success) {
			console.error(
				`\nFailed when trying to run \`${commandToRun}\` in root directory\n`,
			);
			console.error(
				"\n📋 Instructions: Review the error output above, fix the issues in your code, then run the hook again to verify.\n",
			);
			process.exit(2);
		}
		console.log("\n✅ All 1 directory passed validation");
		process.exit(0);
	}

	// Parse comma-delimited patterns
	const patterns = dirsWith.split(",").map((p) => p.trim());

	const failures: string[] = [];
	let processedCount = 0;

	// Find directories
	const directories = findDirectoriesWithMarker(rootDir, patterns);

	for (const dir of directories) {
		// Filter with test command if specified
		if (testDir && !testDirCommand(dir, testDir)) {
			continue;
		}

		processedCount++;
		const success = runCommand(dir, commandToRun, stdinData);

		if (!success) {
			const relativePath = dir.replace(`${rootDir}/`, "");
			failures.push(relativePath);

			console.error(
				`\nFailed when trying to run \`${commandToRun}\` in directory: \`${relativePath}\`\n`,
			);

			if (failFast) {
				console.error(
					"\n📋 Instructions: Review the error output above, fix the issues in your code, then run the hook again to verify.\n",
				);
				process.exit(2);
			}
		}
	}

	if (processedCount === 0) {
		console.log(`No directories found with ${dirsWith}`);
		process.exit(0);
	}

	if (failures.length > 0) {
		console.error(
			`\n❌ ${failures.length} director${failures.length === 1 ? "y" : "ies"} failed validation:\n`,
		);
		for (const dir of failures) {
			console.error(`  - ${dir}`);
		}
		console.error(
			"\n📋 Instructions: Review the error output above for each failure, fix the issues in your code, then run the hook again to verify all directories pass.\n",
		);
		process.exit(2);
	}

	console.log(
		`\n✅ All ${processedCount} director${processedCount === 1 ? "y" : "ies"} passed validation`,
	);
	process.exit(0);
}

/**
 * Options for running a configured hook
 */
export interface RunConfiguredHookOptions {
	hookName: string;
	failFast: boolean;
	stdinData?: string | null;
	/**
	 * When true, check if files have changed before running hooks.
	 * If no changes detected, skip the hook and exit 0.
	 * After successful execution, update the cache manifest.
	 */
	cache?: boolean;
}

/**
 * Generate a cache key for a directory-specific hook cache
 */
function getCacheKeyForDirectory(
	hookName: string,
	directory: string,
	projectRoot: string,
): string {
	const relativeDirPath =
		directory.replace(projectRoot, "").replace(/^\//, "").replace(/\//g, "_") ||
		"root";
	return `${hookName}_${relativeDirPath}`;
}

/**
 * Run a hook using plugin config and user overrides.
 * This is the new format: `han hook run <hookName> [--fail-fast] [--cache]`
 */
export function runConfiguredHook(options: RunConfiguredHookOptions): void {
	const { hookName, failFast, stdinData, cache } = options;

	const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
	const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	if (!pluginRoot) {
		console.error(
			"Error: CLAUDE_PLUGIN_ROOT environment variable is not set.\n" +
				"This command must be run from within a Claude Code hook context.",
		);
		process.exit(1);
	}

	const pluginName = getPluginNameFromRoot(pluginRoot);

	const failures: Array<{ dir: string; command: string }> = [];
	const successfulConfigs: ResolvedHookConfig[] = [];
	let totalFound = 0;
	let disabledCount = 0;
	let skippedCount = 0;

	// Get all configs
	const configs = getHookConfigs(pluginRoot, hookName, projectRoot);

	for (const config of configs) {
		totalFound++;

		// Skip disabled hooks
		if (!config.enabled) {
			disabledCount++;
			continue;
		}

		// If --cache is enabled, check for changes
		if (cache && config.ifChanged && config.ifChanged.length > 0) {
			const cacheKey = getCacheKeyForDirectory(
				hookName,
				config.directory,
				projectRoot,
			);
			const hasChanges = checkForChanges(
				pluginName,
				cacheKey,
				config.directory,
				config.ifChanged,
			);

			if (!hasChanges) {
				skippedCount++;
				continue;
			}
		}

		// Run the hook
		const relativePath = config.directory.replace(`${projectRoot}/`, "");
		console.log(`Running "${config.command}" in ${relativePath}...`);

		const success = runCommand(config.directory, config.command, stdinData);

		if (!success) {
			failures.push({ dir: relativePath, command: config.command });

			console.error(
				`\nFailed when trying to run \`${config.command}\` in directory: \`${relativePath}\`\n`,
			);

			if (failFast) {
				console.error(
					"\n📋 Instructions: Review the error output above, fix the issues in your code, then run the hook again to verify.\n",
				);
				process.exit(2);
			}
		} else {
			successfulConfigs.push(config);
		}
	}

	// Handle edge cases
	if (totalFound === 0) {
		console.log(
			`No directories found for hook "${hookName}" in plugin "${pluginName}"`,
		);
		process.exit(0);
	}

	if (disabledCount === totalFound) {
		console.log(
			`All directories have hook "${hookName}" disabled via han-config.yml`,
		);
		process.exit(0);
	}

	const ranCount = successfulConfigs.length + failures.length;

	if (skippedCount > 0) {
		console.log(
			`Skipped ${skippedCount} director${skippedCount === 1 ? "y" : "ies"} (no changes detected)`,
		);
	}

	if (ranCount === 0 && skippedCount > 0) {
		console.log("No changes detected in any directories. Nothing to run.");
		process.exit(0);
	}

	// Update cache manifest for successful executions
	if (cache && successfulConfigs.length > 0) {
		for (const config of successfulConfigs) {
			if (config.ifChanged && config.ifChanged.length > 0) {
				const cacheKey = getCacheKeyForDirectory(
					hookName,
					config.directory,
					projectRoot,
				);
				const files = findFilesWithGlob(config.directory, config.ifChanged);
				const manifest = buildManifest(files, config.directory);
				saveCacheManifest(pluginName, cacheKey, manifest);
			}
		}
	}

	if (failures.length > 0) {
		console.error(
			`\n❌ ${failures.length} director${failures.length === 1 ? "y" : "ies"} failed:\n`,
		);
		for (const failure of failures) {
			console.error(`  - ${failure.dir}`);
		}
		console.error(
			"\n📋 Instructions: Review the error output above for each failure, fix the issues in your code, then run the hook again to verify all directories pass.\n",
		);
		process.exit(2);
	}

	console.log(
		`\n✅ All ${ranCount} director${ranCount === 1 ? "y" : "ies"} passed`,
	);
	process.exit(0);
}
