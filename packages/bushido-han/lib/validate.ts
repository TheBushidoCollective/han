import { execSync } from "node:child_process";
import {
	checkForChanges,
	findDirectoriesWithMarkers,
	trackFiles,
} from "./hook-cache.js";
import {
	getConfigFilePaths,
	getHookConfigs,
	getPluginNameFromRoot,
	type ResolvedHookConfig,
} from "./hook-config.js";

interface ValidateOptions {
	failFast: boolean;
	dirsWith: string | null;
	testDir?: string | null;
	command: string;
	verbose?: boolean;
}

/**
 * Find directories containing marker files (respects nested .gitignore files)
 */
function findDirectoriesWithMarker(
	rootDir: string,
	markerPatterns: string[],
): string[] {
	return findDirectoriesWithMarkers(rootDir, markerPatterns);
}

// Run command in directory
// When verbose=false, suppresses output and we'll tell the agent how to reproduce
// When verbose=true, inherits stdio to show full output
function runCommand(dir: string, cmd: string, verbose?: boolean): boolean {
	try {
		if (verbose) {
			// Verbose mode: show full output
			execSync(cmd, {
				cwd: dir,
				stdio: "inherit",
				encoding: "utf8",
				shell: "/bin/sh",
				env: process.env,
			});
		} else {
			// Quiet mode: suppress output, we give the agent a concise instruction instead
			execSync(cmd, {
				cwd: dir,
				stdio: ["ignore", "pipe", "pipe"],
				encoding: "utf8",
				shell: "/bin/sh",
				env: process.env,
			});
		}
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
		verbose,
	} = options;

	const rootDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	// No dirsWith specified - run in current directory only
	if (!dirsWith) {
		const success = runCommand(rootDir, commandToRun, verbose);
		if (!success) {
			console.error(
				`\n❌ The command \`${commandToRun}\` failed.\n\n` +
					`Spawn a subagent to run the command, review the output, and fix all issues.\n`,
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
		const success = runCommand(dir, commandToRun, verbose);

		if (!success) {
			const relativePath =
				dir === rootDir ? "." : dir.replace(`${rootDir}/`, "");
			failures.push(relativePath);

			if (failFast) {
				const cmdStr =
					relativePath === "."
						? commandToRun
						: `cd ${relativePath} && ${commandToRun}`;
				console.error(
					`\n❌ The command \`${cmdStr}\` failed.\n\n` +
						`Spawn a subagent to run the command, review the output, and fix all issues.\n`,
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
			`\n❌ ${failures.length} director${failures.length === 1 ? "y" : "ies"} failed validation.\n\n` +
				`Spawn ${failures.length === 1 ? "a subagent" : "subagents in parallel"} to fix the following:\n`,
		);
		for (const dir of failures) {
			const cmdStr =
				dir === "." ? commandToRun : `cd ${dir} && ${commandToRun}`;
			console.error(`  • \`${cmdStr}\``);
		}
		console.error(
			`\nEach subagent should run the command, review the output, and fix all issues.\n`,
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
	/**
	 * When true, check if files have changed before running hooks.
	 * If no changes detected, skip the hook and exit 0.
	 * After successful execution, update the cache manifest.
	 */
	cache?: boolean;
	/**
	 * When true, show full command output instead of suppressing it.
	 * Also settable via HAN_HOOK_RUN_VERBOSE=1 environment variable.
	 */
	verbose?: boolean;
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
	const { hookName, failFast, cache, verbose } = options;

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

		// If --cache is enabled, check for changes (files AND config files)
		if (cache && config.ifChanged && config.ifChanged.length > 0) {
			const cacheKey = getCacheKeyForDirectory(
				hookName,
				config.directory,
				projectRoot,
			);
			const configFiles = getConfigFilePaths(pluginRoot, config.directory);
			const hasChanges = checkForChanges(
				pluginName,
				cacheKey,
				config.directory,
				config.ifChanged,
				configFiles,
			);

			if (!hasChanges) {
				skippedCount++;
				continue;
			}
		}

		// Run the hook
		const relativePath =
			config.directory === projectRoot
				? "."
				: config.directory.replace(`${projectRoot}/`, "");

		const success = runCommand(config.directory, config.command, verbose);

		if (!success) {
			failures.push({ dir: relativePath, command: config.command });

			if (failFast) {
				const cmdStr =
					relativePath === "."
						? config.command
						: `cd ${relativePath} && ${config.command}`;
				console.error(
					`\n❌ The command \`${cmdStr}\` failed.\n\n` +
						`Spawn a subagent to run the command, review the output, and fix all issues.\n`,
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
				const configFiles = getConfigFilePaths(pluginRoot, config.directory);
				trackFiles(
					pluginName,
					cacheKey,
					config.directory,
					config.ifChanged,
					configFiles,
				);
			}
		}
	}

	if (failures.length > 0) {
		console.error(
			`\n❌ ${failures.length} director${failures.length === 1 ? "y" : "ies"} failed.\n\n` +
				`Spawn ${failures.length === 1 ? "a subagent" : "subagents in parallel"} to fix the following:\n`,
		);
		for (const failure of failures) {
			const cmdStr =
				failure.dir === "."
					? failure.command
					: `cd ${failure.dir} && ${failure.command}`;
			console.error(`  • \`${cmdStr}\``);
		}
		console.error(
			`\nEach subagent should run the command, review the output, and fix all issues.\n`,
		);
		process.exit(2);
	}

	console.log(
		`\n✅ All ${ranCount} director${ranCount === 1 ? "y" : "ies"} passed`,
	);
	process.exit(0);
}
