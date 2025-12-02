import { execSync, spawn } from "node:child_process";
import { resolve } from "node:path";
import {
	buildManifest,
	checkForChanges,
	findDirectoriesWithMarkers,
	findFilesWithGlob,
	saveCacheManifest,
} from "./hook-cache.js";
import {
	getHookConfigs,
	getPluginNameFromRoot,
	type ResolvedHookConfig,
} from "./hook-config.js";

/**
 * Get the absolute path to CLAUDE_ENV_FILE.
 * Resolves relative paths against CLAUDE_PROJECT_DIR or cwd.
 */
function getAbsoluteEnvFilePath(): string | null {
	const envFile = process.env.CLAUDE_ENV_FILE;
	if (!envFile) return null;

	// If already absolute, use as-is
	if (envFile.startsWith("/")) return envFile;

	// Resolve relative path against project dir or cwd
	const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();
	return resolve(projectDir, envFile);
}

/**
 * Wrap a command to set up the proper environment.
 * - If CLAUDE_ENV_FILE is set, source it first (mimics Claude Code's behavior)
 * - Otherwise, use a login shell to get the user's full PATH (mise, etc.)
 */
function wrapCommandWithEnvFile(cmd: string): string {
	const envFile = getAbsoluteEnvFilePath();
	if (envFile) {
		// Source the env file before running the command
		return `source "${envFile}" && ${cmd}`;
	}
	// No CLAUDE_ENV_FILE - use login shell to get user's environment
	// This ensures PATH includes version managers like mise, asdf, etc.
	return `/bin/bash -l -c ${JSON.stringify(cmd)}`;
}

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

// Run command in directory (sync version for legacy format)
// When verbose=false, suppresses output and we'll tell the agent how to reproduce
// When verbose=true, inherits stdio to show full output
function runCommandSync(dir: string, cmd: string, verbose?: boolean): boolean {
	const wrappedCmd = wrapCommandWithEnvFile(cmd);
	try {
		if (verbose) {
			// Verbose mode: show full output
			execSync(wrappedCmd, {
				cwd: dir,
				stdio: "inherit",
				encoding: "utf8",
				shell: "/bin/bash",
			});
		} else {
			// Quiet mode: suppress output, we give the agent a concise instruction instead
			execSync(wrappedCmd, {
				cwd: dir,
				stdio: ["ignore", "pipe", "pipe"],
				encoding: "utf8",
				shell: "/bin/bash",
			});
		}
		return true;
	} catch (_e) {
		return false;
	}
}

interface RunCommandResult {
	success: boolean;
	idleTimedOut?: boolean;
}

// Run command in directory (async version with idle timeout support)
// When verbose=false, suppresses output and we'll tell the agent how to reproduce
// When verbose=true, shows full output
async function runCommand(
	dir: string,
	cmd: string,
	verbose?: boolean,
	idleTimeout?: number,
): Promise<RunCommandResult> {
	const wrappedCmd = wrapCommandWithEnvFile(cmd);

	return new Promise((resolve) => {
		const child = spawn(wrappedCmd, {
			cwd: dir,
			shell: "/bin/bash",
			stdio: verbose ? "inherit" : ["ignore", "pipe", "pipe"],
		});

		let lastOutputTime = Date.now();
		let idleTimeoutHandle: NodeJS.Timeout | null = null;
		let idleTimedOut = false;

		// Reset idle timeout on output
		const resetIdleTimeout = () => {
			lastOutputTime = Date.now();
			if (idleTimeoutHandle) {
				clearTimeout(idleTimeoutHandle);
			}
			if (idleTimeout && idleTimeout > 0) {
				idleTimeoutHandle = setTimeout(() => {
					idleTimedOut = true;
					child.kill();
				}, idleTimeout);
			}
		};

		// Start initial idle timeout
		if (idleTimeout && idleTimeout > 0) {
			idleTimeoutHandle = setTimeout(() => {
				idleTimedOut = true;
				child.kill();
			}, idleTimeout);
		}

		// Track output for idle timeout (only when not inheriting stdio)
		if (!verbose) {
			child.stdout?.on("data", () => {
				resetIdleTimeout();
			});
			child.stderr?.on("data", () => {
				resetIdleTimeout();
			});
		}

		child.on("close", (code) => {
			if (idleTimeoutHandle) {
				clearTimeout(idleTimeoutHandle);
			}
			resolve({
				success: code === 0 && !idleTimedOut,
				idleTimedOut,
			});
		});

		child.on("error", () => {
			if (idleTimeoutHandle) {
				clearTimeout(idleTimeoutHandle);
			}
			resolve({
				success: false,
				idleTimedOut: false,
			});
		});
	});
}

// Run test command silently in directory (returns true if exit code 0)
function testDirCommand(dir: string, cmd: string): boolean {
	const wrappedCmd = wrapCommandWithEnvFile(cmd);
	try {
		execSync(wrappedCmd, {
			cwd: dir,
			stdio: ["ignore", "ignore", "ignore"],
			encoding: "utf8",
			shell: "/bin/bash",
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
		const success = runCommandSync(rootDir, commandToRun, verbose);
		if (!success) {
			console.error(
				`\n❌ The command \`${commandToRun}\` failed.\n\n` +
					`Spawn a subagent to run the command, review the output, and fix all issues.\n`,
			);
			process.exit(2);
		}
		// Silent success - no need for a message when running a single command
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
		const success = runCommandSync(dir, commandToRun, verbose);

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
export async function runConfiguredHook(
	options: RunConfiguredHookOptions,
): Promise<void> {
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

	const failures: Array<{
		dir: string;
		command: string;
		idleTimedOut?: boolean;
	}> = [];
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
		const relativePath =
			config.directory === projectRoot
				? "."
				: config.directory.replace(`${projectRoot}/`, "");

		const result = await runCommand(
			config.directory,
			config.command,
			verbose,
			config.idleTimeout,
		);

		if (!result.success) {
			failures.push({
				dir: relativePath,
				command: config.command,
				idleTimedOut: result.idleTimedOut,
			});

			if (failFast) {
				const cmdStr =
					relativePath === "."
						? config.command
						: `cd ${relativePath} && ${config.command}`;
				const reason = result.idleTimedOut
					? " (idle timeout - no output received)"
					: "";
				console.error(
					`\n❌ The command \`${cmdStr}\` failed${reason}.\n\n` +
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
				const files = findFilesWithGlob(config.directory, config.ifChanged);
				const manifest = buildManifest(files, config.directory);
				saveCacheManifest(pluginName, cacheKey, manifest);
			}
		}
	}

	if (failures.length > 0) {
		const idleTimeoutFailures = failures.filter((f) => f.idleTimedOut);
		const regularFailures = failures.filter((f) => !f.idleTimedOut);

		console.error(
			`\n❌ ${failures.length} director${failures.length === 1 ? "y" : "ies"} failed.\n\n` +
				`Spawn ${failures.length === 1 ? "a subagent" : "subagents in parallel"} to fix the following:\n`,
		);

		for (const failure of regularFailures) {
			const cmdStr =
				failure.dir === "."
					? failure.command
					: `cd ${failure.dir} && ${failure.command}`;
			console.error(`  • \`${cmdStr}\``);
		}

		if (idleTimeoutFailures.length > 0) {
			console.error(`\n⏰ Idle timeout failures (no output received):\n`);
			for (const failure of idleTimeoutFailures) {
				const cmdStr =
					failure.dir === "."
						? failure.command
						: `cd ${failure.dir} && ${failure.command}`;
				console.error(`  • \`${cmdStr}\``);
			}
			console.error(
				`\nThese commands hung without producing output. Check for blocking operations or infinite loops.\n`,
			);
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
