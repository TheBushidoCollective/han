import { execSync, spawn } from "node:child_process";
import { mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
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
import { withSlot } from "./hook-lock.js";

/**
 * Check if debug mode is enabled via HAN_DEBUG environment variable
 */
function isDebugMode(): boolean {
	const debug = process.env.HAN_DEBUG;
	return debug === "1" || debug === "true";
}

/**
 * Get the han temp directory for output files
 */
function getHanTempDir(): string {
	const dir = join(tmpdir(), "han-hook-output");
	mkdirSync(dir, { recursive: true });
	return dir;
}

/**
 * Generate a unique filename for hook output
 */
function generateOutputFilename(hookName: string, directory: string): string {
	const timestamp = Date.now();
	const sanitizedDir = directory.replace(/[^a-zA-Z0-9]/g, "_").slice(-30);
	return `${hookName}_${sanitizedDir}_${timestamp}`;
}

/**
 * Write debug info to a file
 */
function writeDebugFile(
	basePath: string,
	info: Record<string, unknown>,
): string {
	const debugPath = `${basePath}.debug.txt`;
	const lines: string[] = [
		"=== Han Hook Debug Info ===",
		`Timestamp: ${new Date().toISOString()}`,
		"",
		"=== Environment ===",
		`NODE_VERSION: ${process.version}`,
		`PLATFORM: ${process.platform}`,
		`ARCH: ${process.arch}`,
		`CWD: ${process.cwd()}`,
		`CLAUDE_PROJECT_DIR: ${process.env.CLAUDE_PROJECT_DIR || "(not set)"}`,
		`CLAUDE_PLUGIN_ROOT: ${process.env.CLAUDE_PLUGIN_ROOT || "(not set)"}`,
		`CLAUDE_ENV_FILE: ${process.env.CLAUDE_ENV_FILE || "(not set)"}`,
		`PATH: ${process.env.PATH || "(not set)"}`,
		"",
		"=== Hook Info ===",
	];

	for (const [key, value] of Object.entries(info)) {
		lines.push(`${key}: ${JSON.stringify(value)}`);
	}

	writeFileSync(debugPath, lines.join("\n"), "utf-8");
	return debugPath;
}

/**
 * Write output to a file
 */
function writeOutputFile(basePath: string, output: string): string {
	const outputPath = `${basePath}.output.txt`;
	writeFileSync(outputPath, output, "utf-8");
	return outputPath;
}

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
	/** Path to the output file containing stdout/stderr (only on failure) */
	outputFile?: string;
	/** Path to the debug file (only when HAN_DEBUG=true) */
	debugFile?: string;
}

interface RunCommandOptions {
	dir: string;
	cmd: string;
	verbose?: boolean;
	idleTimeout?: number;
	/** Hook name for generating output filenames */
	hookName?: string;
}

// Run command in directory (async version with idle timeout support)
// When verbose=false, captures output to temp file on failure
// When verbose=true, shows full output
async function runCommand(
	options: RunCommandOptions,
): Promise<RunCommandResult> {
	const { dir, cmd, verbose, idleTimeout, hookName = "hook" } = options;
	const wrappedCmd = wrapCommandWithEnvFile(cmd);
	const debug = isDebugMode();
	const startTime = Date.now();

	return new Promise((resolvePromise) => {
		const child = spawn(wrappedCmd, {
			cwd: dir,
			shell: "/bin/bash",
			stdio: verbose ? "inherit" : ["ignore", "pipe", "pipe"],
		});

		let idleTimeoutHandle: NodeJS.Timeout | null = null;
		let idleTimedOut = false;
		const outputChunks: string[] = [];

		// Reset idle timeout on output
		const resetIdleTimeout = () => {
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

		// Capture output and track for idle timeout (only when not inheriting stdio)
		if (!verbose) {
			child.stdout?.on("data", (data) => {
				outputChunks.push(data.toString());
				resetIdleTimeout();
			});
			child.stderr?.on("data", (data) => {
				outputChunks.push(data.toString());
				resetIdleTimeout();
			});
		}

		const finalizeResult = (success: boolean) => {
			if (idleTimeoutHandle) {
				clearTimeout(idleTimeoutHandle);
			}

			const result: RunCommandResult = {
				success,
				idleTimedOut,
			};

			// Write output and debug files on failure (or always in debug mode)
			if (!success || debug) {
				const tempDir = getHanTempDir();
				const basePath = join(tempDir, generateOutputFilename(hookName, dir));

				// Write output file if we captured any output
				if (outputChunks.length > 0) {
					result.outputFile = writeOutputFile(basePath, outputChunks.join(""));
				}

				// Write debug file in debug mode
				if (debug) {
					const duration = Date.now() - startTime;
					result.debugFile = writeDebugFile(basePath, {
						hookName,
						command: cmd,
						wrappedCommand: wrappedCmd,
						directory: dir,
						idleTimeout: idleTimeout ?? null,
						idleTimedOut,
						exitSuccess: success,
						durationMs: duration,
						outputLength: outputChunks.join("").length,
					});
				}
			}

			resolvePromise(result);
		};

		child.on("close", (code) => {
			finalizeResult(code === 0 && !idleTimedOut);
		});

		child.on("error", () => {
			finalizeResult(false);
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

export async function validate(options: ValidateOptions): Promise<void> {
	const {
		failFast,
		dirsWith,
		testDir,
		command: commandToRun,
		verbose,
	} = options;

	// Wrap with resource lock
	await withSlot("legacy-validate", undefined, async () => {
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
	});
}

/**
 * Options for running a configured hook
 */
export interface RunConfiguredHookOptions {
	/**
	 * The plugin name (e.g., "jutsu-elixir")
	 * Used to validate CLAUDE_PLUGIN_ROOT and generate proper error messages
	 */
	pluginName: string;
	hookName: string;
	failFast: boolean;
	/**
	 * When true, check if files have changed before running hooks.
	 * If no changes detected, skip the hook and exit 0.
	 * After successful execution, update the cache manifest.
	 */
	cache?: boolean;
	/**
	 * When set, only run in this specific directory.
	 * Used for targeted re-runs after failures.
	 */
	only?: string;
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
 * Build the han hook run command for error messages
 */
function buildHookCommand(
	pluginName: string,
	hookName: string,
	options: { cached?: boolean; only?: string },
): string {
	let cmd = `npx -y @thebushidocollective/han hook run ${pluginName} ${hookName}`;
	if (options.cached) {
		cmd += " --cached";
	}
	if (options.only) {
		cmd += ` --only=${options.only}`;
	}
	return cmd;
}

/**
 * Run a hook using plugin config and user overrides.
 * This is the new format: `han hook run <plugin-name> <hook-name> [--fail-fast] [--cached] [--only=<dir>]`
 */
export async function runConfiguredHook(
	options: RunConfiguredHookOptions,
): Promise<void> {
	const { pluginName, hookName, failFast, cache, only, verbose } = options;

	const pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
	const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	if (!pluginRoot) {
		console.error(
			"Error: CLAUDE_PLUGIN_ROOT environment variable is not set.\n" +
				"This command must be run from within a Claude Code hook context.",
		);
		process.exit(1);
	}

	// Validate that CLAUDE_PLUGIN_ROOT matches the specified plugin name
	const pluginRootName = getPluginNameFromRoot(pluginRoot);
	if (pluginRootName !== pluginName) {
		console.error(
			`Error: Plugin name mismatch.\n` +
				`  Expected: ${pluginName}\n` +
				`  Got: ${pluginRootName} (from CLAUDE_PLUGIN_ROOT)\n\n` +
				`The hook command specifies plugin "${pluginName}" but CLAUDE_PLUGIN_ROOT points to "${pluginRootName}".`,
		);
		process.exit(1);
	}

	// Wrap with resource lock
	await withSlot(hookName, pluginName, async () => {
		const failures: Array<{
			dir: string;
			command: string;
			idleTimedOut?: boolean;
			outputFile?: string;
			debugFile?: string;
		}> = [];
		const successfulConfigs: ResolvedHookConfig[] = [];
		let totalFound = 0;
		let disabledCount = 0;
		let skippedCount = 0;

		// Get all configs
		let configs = getHookConfigs(pluginRoot, hookName, projectRoot);

		// If --only is specified, filter to just that directory
		if (only) {
			const onlyAbsolute = only.startsWith("/")
				? only
				: join(projectRoot, only);
			const normalizedOnly = onlyAbsolute.replace(/\/$/, ""); // Remove trailing slash

			configs = configs.filter((config) => {
				const normalizedDir = config.directory.replace(/\/$/, "");
				return normalizedDir === normalizedOnly;
			});

			if (configs.length === 0) {
				console.error(
					`Error: No hook configuration found for directory "${only}".\n` +
						`The --only flag requires a directory that matches one of the hook's target directories.`,
				);
				process.exit(1);
			}
		}

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

			const result = await runCommand({
				dir: config.directory,
				cmd: config.command,
				verbose,
				idleTimeout: config.idleTimeout,
				hookName,
			});

			if (!result.success) {
				failures.push({
					dir: relativePath,
					command: config.command,
					idleTimedOut: result.idleTimedOut,
					outputFile: result.outputFile,
					debugFile: result.debugFile,
				});

				if (failFast) {
					const reason = result.idleTimedOut
						? " (idle timeout - no output received)"
						: "";

					const outputRef = result.outputFile
						? `\n\nOutput saved to: ${result.outputFile}`
						: "";
					const debugRef = result.debugFile
						? `\nDebug info saved to: ${result.debugFile}`
						: "";

					// Build the targeted re-run command
					const rerunCmd = buildHookCommand(pluginName, hookName, {
						cached: cache,
						only: relativePath === "." ? undefined : relativePath,
					});

					console.error(
						`\n❌ Hook failed in \`${relativePath}\`${reason}.${outputRef}${debugRef}\n\n` +
							`To re-run after fixing:\n  ${rerunCmd}\n`,
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
				`\n❌ ${failures.length} director${failures.length === 1 ? "y" : "ies"} failed.\n`,
			);

			// Helper to format failure with targeted re-run command
			const formatFailure = (failure: (typeof failures)[0]) => {
				const rerunCmd = buildHookCommand(pluginName, hookName, {
					cached: cache,
					only: failure.dir === "." ? undefined : failure.dir,
				});
				let msg = `  • ${failure.dir === "." ? "(project root)" : failure.dir}`;
				msg += `\n    Re-run: ${rerunCmd}`;
				if (failure.outputFile) {
					msg += `\n    Output: ${failure.outputFile}`;
				}
				if (failure.debugFile) {
					msg += `\n    Debug: ${failure.debugFile}`;
				}
				return msg;
			};

			if (regularFailures.length > 0) {
				console.error("\nFailed:\n");
				for (const failure of regularFailures) {
					console.error(formatFailure(failure));
				}
			}

			if (idleTimeoutFailures.length > 0) {
				console.error(`\n⏰ Idle timeout failures (no output received):\n`);
				for (const failure of idleTimeoutFailures) {
					console.error(formatFailure(failure));
				}
				console.error(
					`\nThese commands hung without producing output. Check for blocking operations or infinite loops.`,
				);
			}

			console.error(`\nReview the output files above and fix all issues.\n`);
			process.exit(2);
		}

		console.log(
			`\n✅ All ${ranCount} director${ranCount === 1 ? "y" : "ies"} passed`,
		);
		process.exit(0);
	});
}
