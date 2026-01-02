import { execSync, spawn } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	isCacheEnabled,
	isCheckpointsEnabled,
	isFailFastEnabled,
	isTranscriptFilterEnabled,
} from "../config/index.ts";
import {
	buildCommandWithFiles,
	checkFailureSignal,
	checkForChangesAsync,
	clearFailureSignal,
	commandUsesSessionFiles,
	createLockManager,
	findDirectoriesWithMarkers,
	getHookConfigs,
	getSessionFilteredFiles,
	getTranscriptModifiedFiles,
	hasChangedSinceCheckpointAsync,
	hasSessionModifiedPatternFiles,
	type ResolvedHookConfig,
	signalFailure,
	type TranscriptModifiedFiles,
	trackFilesAsync,
	withSlot,
} from "../hooks/index.ts";
import { getPluginNameFromRoot } from "../shared/index.ts";

/**
 * Check if debug mode is enabled via HAN_DEBUG environment variable
 */
export function isDebugMode(): boolean {
	const debug = process.env.HAN_DEBUG;
	return debug === "1" || debug === "true";
}

/**
 * Get the han temp directory for output files
 */
export function getHanTempDir(): string {
	const dir = join(tmpdir(), "han-hook-output");
	mkdirSync(dir, { recursive: true });
	return dir;
}

/**
 * Generate a unique filename for hook output
 */
export function generateOutputFilename(
	hookName: string,
	directory: string,
): string {
	const timestamp = Date.now();
	const sanitizedDir = directory.replace(/[^a-zA-Z0-9]/g, "_").slice(-30);
	return `${hookName}_${sanitizedDir}_${timestamp}`;
}

/**
 * Write debug info to a file
 */
export function writeDebugFile(
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
export function writeOutputFile(basePath: string, output: string): string {
	const outputPath = `${basePath}.output.txt`;
	writeFileSync(outputPath, output, "utf-8");
	return outputPath;
}

/**
 * Get the absolute path to CLAUDE_ENV_FILE.
 * Resolves relative paths against CLAUDE_PROJECT_DIR or cwd.
 */
export function getAbsoluteEnvFilePath(): string | null {
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
export function wrapCommandWithEnvFile(cmd: string): string {
	const envFile = getAbsoluteEnvFilePath();
	if (envFile) {
		// Source the env file before running the command
		return `source "${envFile}" && ${cmd}`;
	}
	// No CLAUDE_ENV_FILE - just run the command directly
	// The shell: "/bin/bash" in execSync will provide a proper environment
	return cmd;
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
	/** Captured stdout/stderr output */
	output?: string;
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
	/** Plugin root directory for CLAUDE_PLUGIN_ROOT env var */
	pluginRoot?: string;
	/** Absolute timeout in seconds (safeguard against hangs) */
	absoluteTimeout?: number;
}

/**
 * Get the default absolute timeout for commands in seconds.
 * This is a safeguard against hanging processes.
 * Default: 5 minutes (300 seconds)
 */
function getDefaultAbsoluteTimeout(): number {
	const envValue = process.env.HAN_HOOK_ABSOLUTE_TIMEOUT;
	if (envValue) {
		const parsed = Number.parseInt(envValue, 10);
		if (!Number.isNaN(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return 300; // 5 minutes default
}

// Run command in directory (async version with idle timeout support)
// When verbose=false, captures output to temp file on failure
// When verbose=true, shows full output
async function runCommand(
	options: RunCommandOptions,
): Promise<RunCommandResult> {
	const {
		dir,
		cmd,
		verbose,
		idleTimeout,
		hookName = "hook",
		pluginRoot,
		absoluteTimeout = getDefaultAbsoluteTimeout(),
	} = options;
	const wrappedCmd = wrapCommandWithEnvFile(cmd);
	const debug = isDebugMode();
	const startTime = Date.now();

	return new Promise((resolvePromise) => {
		let resolved = false;
		let absoluteTimeoutHandle: NodeJS.Timeout | null = null;
		let absoluteTimedOut = false;

		const child = spawn(wrappedCmd, {
			cwd: dir,
			shell: "/bin/bash",
			stdio: verbose ? "inherit" : ["ignore", "pipe", "pipe"],
			env: {
				...process.env,
				...(pluginRoot ? { CLAUDE_PLUGIN_ROOT: pluginRoot } : {}),
			},
		});

		let idleTimeoutHandle: NodeJS.Timeout | null = null;
		let idleTimedOut = false;
		const outputChunks: string[] = [];

		// Convert seconds to milliseconds for setTimeout
		const idleTimeoutMs = idleTimeout ? idleTimeout * 1000 : undefined;
		const absoluteTimeoutMs = absoluteTimeout * 1000;

		// Reset idle timeout on output
		const resetIdleTimeout = () => {
			if (idleTimeoutHandle) {
				clearTimeout(idleTimeoutHandle);
			}
			if (idleTimeoutMs && idleTimeoutMs > 0) {
				idleTimeoutHandle = setTimeout(() => {
					idleTimedOut = true;
					child.kill();
				}, idleTimeoutMs);
			}
		};

		// Start initial idle timeout
		if (idleTimeoutMs && idleTimeoutMs > 0) {
			idleTimeoutHandle = setTimeout(() => {
				idleTimedOut = true;
				child.kill();
			}, idleTimeoutMs);
		}

		// Start absolute timeout as safeguard (always active)
		absoluteTimeoutHandle = setTimeout(() => {
			if (!resolved) {
				absoluteTimedOut = true;
				outputChunks.push(
					`\n⏱️ Absolute timeout: Command exceeded ${absoluteTimeout}s limit and was terminated.\n`,
				);
				try {
					child.kill("SIGKILL"); // Force kill
				} catch {
					// Ignore kill errors
				}
			}
		}, absoluteTimeoutMs);

		// Capture output to file only (no streaming to avoid polluting context)
		if (!verbose) {
			child.stdout?.on("data", (data) => {
				const text = data.toString();
				outputChunks.push(text);
				resetIdleTimeout();
			});
			child.stderr?.on("data", (data) => {
				const text = data.toString();
				outputChunks.push(text);
				resetIdleTimeout();
			});
		}

		const finalizeResult = (success: boolean) => {
			if (resolved) return; // Prevent double resolution
			resolved = true;

			if (idleTimeoutHandle) {
				clearTimeout(idleTimeoutHandle);
			}
			if (absoluteTimeoutHandle) {
				clearTimeout(absoluteTimeoutHandle);
			}

			const combinedOutput = outputChunks.join("");
			const result: RunCommandResult = {
				success,
				idleTimedOut: idleTimedOut || absoluteTimedOut,
				output: combinedOutput || undefined,
			};

			// Write output and debug files on failure (or always in debug mode)
			if (!success || debug) {
				const tempDir = getHanTempDir();
				const basePath = join(tempDir, generateOutputFilename(hookName, dir));

				// Write output file if we captured any output
				if (combinedOutput) {
					result.outputFile = writeOutputFile(basePath, combinedOutput);
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
						absoluteTimeout,
						idleTimedOut,
						absoluteTimedOut,
						exitSuccess: success,
						durationMs: duration,
						outputLength: combinedOutput.length,
					});
				}
			}

			resolvePromise(result);
		};

		child.on("close", (code) => {
			finalizeResult(code === 0 && !idleTimedOut && !absoluteTimedOut);
		});

		child.on("error", (err) => {
			outputChunks.push(`\nSpawn error: ${err.message}\n`);
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

	const rootDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	// No dirsWith specified - run in current directory only
	if (!dirsWith) {
		// In verbose mode, show what we're running
		if (verbose) {
			console.log(`\n[han] Running in .:`);
			console.log(`  $ ${commandToRun}\n`);
		}

		// Acquire slot, run command, release slot
		const success = await withSlot("legacy-validate", undefined, async () => {
			return runCommandSync(rootDir, commandToRun, verbose);
		});
		if (!success) {
			console.error(
				`\n❌ The command \`${commandToRun}\` failed.\n\n` +
					`Spawn a subagent to run the command, review the output, and fix all issues.\n` +
					`Do NOT ask the user any questions - proceed directly with fixing the issues.\n`,
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

		const relativePath = dir === rootDir ? "." : dir.replace(`${rootDir}/`, "");

		// In verbose mode, show what we're running
		if (verbose) {
			console.log(`\n[han] Running in ${relativePath}:`);
			console.log(`  $ ${commandToRun}\n`);
		}

		// Acquire slot, run command, release slot (per directory)
		const success = await withSlot("legacy-validate", undefined, async () => {
			return runCommandSync(dir, commandToRun, verbose);
		});

		if (!success) {
			// Show individual failure
			console.error(`  ✗ ${relativePath} failed`);
			failures.push(relativePath);

			if (failFast) {
				console.error(`\n⚠ Stopped due to fail fast\n`);
				const cmdStr =
					relativePath === "."
						? commandToRun
						: `cd ${relativePath} && ${commandToRun}`;
				console.error(
					`The command \`${cmdStr}\` failed.\n\n` +
						`Spawn a subagent to run the command, review the output, and fix all issues.\n` +
						`Do NOT ask the user any questions - proceed directly with fixing the issues.\n`,
				);
				process.exit(2);
			}
		} else {
			// Show individual success
			console.log(`  ✓ ${relativePath} passed`);
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
			`\nEach subagent should run the command, review the output, and fix all issues.\n` +
				`Do NOT ask the user any questions - proceed directly with fixing the issues.\n`,
		);
		process.exit(2);
	}

	console.log(
		`\n✅ ${processedCount} director${processedCount === 1 ? "y" : "ies"} passed`,
	);
	process.exit(0);
}

// ============================================
// Plugin Discovery (for running outside hook context)
// ============================================

/**
 * Find plugin in a marketplace root directory
 */
function findPluginInMarketplace(
	marketplaceRoot: string,
	pluginName: string,
): string | null {
	const potentialPaths = [
		join(marketplaceRoot, "jutsu", pluginName),
		join(marketplaceRoot, "do", pluginName),
		join(marketplaceRoot, "hashi", pluginName),
		join(marketplaceRoot, pluginName),
	];

	for (const path of potentialPaths) {
		if (existsSync(path)) {
			return path;
		}
	}

	return null;
}

/**
 * Resolve a path to absolute, relative to cwd
 */
function resolvePathToAbsolute(path: string): string {
	if (path.startsWith("/")) {
		return path;
	}
	return join(process.cwd(), path);
}

/**
 * Discover plugin root from settings when CLAUDE_PLUGIN_ROOT is not set.
 * Returns the plugin root path or null if not found.
 */
function discoverPluginRoot(pluginName: string): string | null {
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

	// Check if this plugin is enabled
	const marketplace = plugins.get(pluginName);
	if (!marketplace) {
		return null;
	}

	const marketplaceConfig = marketplaces.get(marketplace);

	// If marketplace config specifies a directory source, use that path
	if (marketplaceConfig?.source?.source === "directory") {
		const directoryPath = marketplaceConfig.source.path;
		if (directoryPath) {
			const absolutePath = resolvePathToAbsolute(directoryPath);
			const found = findPluginInMarketplace(absolutePath, pluginName);
			if (found) {
				return found;
			}
		}
	}

	// Check if we're in the marketplace repo itself (for development)
	const cwd = process.cwd();
	if (existsSync(join(cwd, ".claude-plugin", "marketplace.json"))) {
		const found = findPluginInMarketplace(cwd, pluginName);
		if (found) {
			return found;
		}
	}

	// Fall back to the default shared config path
	const configDir = getClaudeConfigDir();
	if (!configDir) {
		return null;
	}

	const marketplaceRoot = join(
		configDir,
		"plugins",
		"marketplaces",
		marketplace,
	);

	if (!existsSync(marketplaceRoot)) {
		return null;
	}

	return findPluginInMarketplace(marketplaceRoot, pluginName);
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
	/**
	 * Stop on first failure. Defaults to han.yml hooks.fail_fast (true if not set).
	 * Can be overridden by HAN_NO_FAIL_FAST=1 environment variable.
	 */
	failFast?: boolean;
	/**
	 * Enable caching - skip hooks if no files changed since last successful run.
	 * Defaults to han.yml hooks.cache (true if not set).
	 * Can be overridden by HAN_NO_CACHE=1 environment variable.
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
	/**
	 * Checkpoint type to filter against (session or agent)
	 * When set, only runs hook if files changed since both:
	 * 1. Last hook run (cache check)
	 * 2. Checkpoint creation (checkpoint check)
	 */
	checkpointType?: "session" | "agent";
	/**
	 * Checkpoint ID to filter against
	 * Required when checkpointType is set
	 */
	checkpointId?: string;
	/**
	 * Skip slot management (for MCP tools that run independently with timeouts)
	 */
	skipSlot?: boolean;
	/**
	 * Session ID for tracking hook executions in session messages
	 */
	sessionId?: string;
}

/**
 * Generate a cache key for a directory-specific hook cache
 */
export function getCacheKeyForDirectory(
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
 * Build the han hook run command for error messages (legacy - prefer MCP)
 */
export function buildHookCommand(
	pluginName: string,
	hookName: string,
	options: { cached?: boolean; only?: string },
): string {
	let cmd = `han hook run ${pluginName} ${hookName}`;
	if (options.cached) {
		cmd += " --cached";
	}
	if (options.only) {
		cmd += ` --only=${options.only}`;
	}
	return cmd;
}

/**
 * Build MCP tool re-run instruction for error messages
 * When targeting a specific directory, cache is disabled automatically
 */
export function buildMcpToolInstruction(
	pluginName: string,
	hookName: string,
	options: { only?: string },
): string {
	const toolName = `${pluginName}_${hookName}`.replace(/-/g, "_");
	const args: string[] = [];

	if (options.only) {
		args.push(`directory: "${options.only}"`);
	}

	if (args.length > 0) {
		return `${toolName}(${args.join(", ")})`;
	}
	return `${toolName}()`;
}

/**
 * Run a hook using plugin config and user overrides.
 * This is the new format: `han hook run <plugin-name> <hook-name> [--fail-fast] [--cached] [--only=<dir>]`
 */
export async function runConfiguredHook(
	options: RunConfiguredHookOptions,
): Promise<void> {
	const {
		pluginName,
		hookName,
		only,
		verbose,
		checkpointType,
		checkpointId,
		skipSlot,
	} = options;

	// Settings resolution priority (highest to lowest):
	// 1. Environment variable (HAN_NO_X=1 forces false)
	// 2. CLI option (options.X if explicitly passed)
	// 3. han.yml config (via helper functions)
	//
	// Note: We can't distinguish "CLI passed --fail-fast" from "default true"
	// so we rely on --no-X patterns and env vars for explicit overrides.

	// Resolve fail-fast setting
	// Priority: HAN_NO_FAIL_FAST env > options.failFast > han.yml default
	const failFast =
		process.env.HAN_NO_FAIL_FAST === "1" ||
		process.env.HAN_NO_FAIL_FAST === "true"
			? false
			: (options.failFast ?? isFailFastEnabled());

	// Resolve cache setting
	// Priority: HAN_NO_CACHE env > options.cache > han.yml default
	const cache =
		process.env.HAN_NO_CACHE === "1" || process.env.HAN_NO_CACHE === "true"
			? false
			: (options.cache ?? isCacheEnabled());

	// Resolve checkpoints setting
	// Priority: HAN_NO_CHECKPOINTS env > checkpointType presence > han.yml default
	// Note: If checkpointType is not provided, checkpoints are effectively disabled
	const checkpointsEnabled =
		process.env.HAN_NO_CHECKPOINTS === "1" ||
		process.env.HAN_NO_CHECKPOINTS === "true"
			? false
			: isCheckpointsEnabled();

	let pluginRoot = process.env.CLAUDE_PLUGIN_ROOT;
	const projectRoot = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	// If CLAUDE_PLUGIN_ROOT is not set, try to discover it from settings
	if (!pluginRoot) {
		const discoveredRoot = discoverPluginRoot(pluginName);
		if (discoveredRoot) {
			pluginRoot = discoveredRoot;
			if (verbose) {
				console.log(`[han] Discovered plugin root: ${pluginRoot}`);
			}
		} else {
			console.error(
				`Error: Could not find plugin "${pluginName}".\n\n` +
					"The plugin must be enabled in your .claude/settings.json or .claude/settings.local.json.\n" +
					"If running outside of a Claude Code hook context, ensure the plugin is installed.",
			);
			process.exit(1);
		}
	} else {
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
	}

	// Get all configs
	let configs = getHookConfigs(pluginRoot, hookName, projectRoot);

	// If --only is specified, filter to just that directory
	if (only) {
		const onlyAbsolute = only.startsWith("/") ? only : join(projectRoot, only);
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

	// Phase 1: Check cache and categorize configs BEFORE acquiring lock
	// This avoids holding a slot while just checking hashes
	const configsToRun: ResolvedHookConfig[] = [];
	let totalFound = 0;
	let disabledCount = 0;
	let skippedCount = 0;
	let checkpointSkippedCount = 0;
	let transcriptSkippedCount = 0;

	for (const config of configs) {
		totalFound++;

		// Skip disabled hooks
		if (!config.enabled) {
			disabledCount++;
			continue;
		}

		// If --cache is enabled, check for changes (no lock needed for this)
		if (cache && config.ifChanged && config.ifChanged.length > 0) {
			const cacheKey = getCacheKeyForDirectory(
				hookName,
				config.directory,
				projectRoot,
			);
			const hasChanges = await checkForChangesAsync(
				pluginName,
				cacheKey,
				config.directory,
				config.ifChanged,
				pluginRoot,
			);

			if (!hasChanges) {
				skippedCount++;
				continue;
			}

			// NEW: Also check checkpoint if available (uses DB-backed storage)
			if (hasChanges && checkpointType && checkpointId && checkpointsEnabled) {
				const changedSinceCheckpoint = await hasChangedSinceCheckpointAsync(
					checkpointId,
					config.ifChanged,
					config.directory,
				);
				if (!changedSinceCheckpoint) {
					// File changed since last hook run, but NOT since checkpoint
					// Skip this hook
					if (verbose) {
						const relativePath =
							config.directory === projectRoot
								? "."
								: config.directory.replace(`${projectRoot}/`, "");
						console.log(
							`[${pluginName}/${hookName}] Skipping ${relativePath}: Changed since last run, but not since ${checkpointType} checkpoint`,
						);
					}
					checkpointSkippedCount++;
					continue;
				}
				// If hasChangedSinceCheckpointAsync returns true (or fails), run hook
			}

			// NEW: Check transcript-modified files filter
			// Only applies when cache is enabled (if cache=false, skip all filtering)
			let transcriptModifiedFiles: TranscriptModifiedFiles | undefined;
			if (checkpointType && checkpointId && isTranscriptFilterEnabled()) {
				transcriptModifiedFiles = getTranscriptModifiedFiles(
					checkpointType,
					checkpointId,
					projectRoot,
				);

				// Only apply filter if transcript was successfully found and has modifications
				if (
					transcriptModifiedFiles.success &&
					transcriptModifiedFiles.allModified.length > 0
				) {
					const sessionModifiedPatternFiles = hasSessionModifiedPatternFiles(
						transcriptModifiedFiles,
						config.directory,
						config.ifChanged,
					);

					if (!sessionModifiedPatternFiles) {
						// Files changed since last hook run, but not by THIS session
						if (verbose) {
							const relativePath =
								config.directory === projectRoot
									? "."
									: config.directory.replace(`${projectRoot}/`, "");
							console.log(
								`[${pluginName}/${hookName}] Skipping ${relativePath}: Pattern files not modified by this ${checkpointType}`,
							);
						}
						transcriptSkippedCount++;
						continue;
					}
				}
				// If success=false or allModified is empty, fall through to run hook
			}
		}

		// This config needs to run
		// If command uses ${HAN_FILES} template and we have transcript data,
		// compute the session-filtered files for substitution
		configsToRun.push(config);
	}

	// Handle edge cases before acquiring lock
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

	if (
		configsToRun.length === 0 &&
		(skippedCount > 0 ||
			checkpointSkippedCount > 0 ||
			transcriptSkippedCount > 0)
	) {
		if (skippedCount > 0) {
			console.log(
				`Skipped ${skippedCount} director${skippedCount === 1 ? "y" : "ies"} (no changes detected)`,
			);
		}
		if (checkpointSkippedCount > 0) {
			console.log(
				`Skipped ${checkpointSkippedCount} director${checkpointSkippedCount === 1 ? "y" : "ies"} (no changes since ${checkpointType} checkpoint)`,
			);
		}
		if (transcriptSkippedCount > 0) {
			console.log(
				`Skipped ${transcriptSkippedCount} director${transcriptSkippedCount === 1 ? "y" : "ies"} (pattern files not modified by this ${checkpointType})`,
			);
		}
		console.log("No changes detected in any directories. Nothing to run.");
		process.exit(0);
	}

	// Phase 2: Run hooks, acquiring/releasing lock per directory
	// This allows other hooks to interleave between directories
	const failures: Array<{
		dir: string;
		command: string;
		idleTimedOut?: boolean;
		outputFile?: string;
		debugFile?: string;
	}> = [];
	const successfulConfigs: ResolvedHookConfig[] = [];

	// Create lock manager for failure signal checking
	const lockManager = createLockManager();
	// Clear any stale failure signals from previous runs
	clearFailureSignal(lockManager);

	for (const config of configsToRun) {
		const relativePath =
			config.directory === projectRoot
				? "."
				: config.directory.replace(`${projectRoot}/`, "");

		// Check if another hook has already failed (fail-fast across processes)
		if (failFast) {
			const failureInfo = checkFailureSignal(lockManager);
			if (failureInfo) {
				// This is an informational message only - the agent should focus on
				// fixing the ORIGINAL failure, not this exit message
				console.log(
					`\n⏭️ Skipping ${pluginName}/${hookName}: Fix the ${failureInfo.pluginName || "unknown"}/${failureInfo.hookName || "unknown"} failure first, then re-run all hooks.`,
				);
				process.exit(2);
			}
		}

		// Compute the actual command to run
		// If command uses ${HAN_FILES} template, substitute with:
		// - session-filtered files (when cache=true and transcript filter enabled)
		// - all files "." (when cache=false or transcript filter disabled)
		let cmdToRun = config.command;
		if (commandUsesSessionFiles(config.command)) {
			if (
				cache &&
				checkpointType &&
				checkpointId &&
				isTranscriptFilterEnabled()
			) {
				// Session-scoped: only run on files THIS session modified
				const modifiedFiles = getTranscriptModifiedFiles(
					checkpointType,
					checkpointId,
					projectRoot,
				);
				if (modifiedFiles.success) {
					const sessionFiles = getSessionFilteredFiles(
						modifiedFiles,
						config.directory,
						config.ifChanged ?? [],
					);
					cmdToRun = buildCommandWithFiles(config.command, sessionFiles);
					if (verbose && sessionFiles.length > 0) {
						console.log(
							`[${pluginName}/${hookName}] Session files: ${sessionFiles.join(", ")}`,
						);
					}
				} else {
					// Transcript not found - fall back to all files
					cmdToRun = buildCommandWithFiles(config.command, []);
				}
			} else {
				// cache=false or no transcript filter - run on all files
				cmdToRun = buildCommandWithFiles(config.command, []);
			}
		}

		// In verbose mode, show what we're running
		if (verbose) {
			console.log(`\n[${pluginName}/${hookName}] Running in ${relativePath}:`);
			console.log(`  $ ${cmdToRun}\n`);
		}

		// Run command (with slot management for CLI, without for MCP)
		const runFn = async () =>
			runCommand({
				dir: config.directory,
				cmd: cmdToRun,
				verbose,
				idleTimeout: config.idleTimeout,
				hookName,
				pluginRoot,
			});

		// MCP tools skip slot management - they have their own timeout handling
		const result = skipSlot
			? await runFn()
			: await withSlot(hookName, pluginName, runFn);

		if (!result.success) {
			// Show individual failure
			console.error(`  ✗ ${relativePath} failed`);

			failures.push({
				dir: relativePath,
				command: cmdToRun,
				idleTimedOut: result.idleTimedOut,
				outputFile: result.outputFile,
				debugFile: result.debugFile,
			});

			if (failFast) {
				// Signal failure to other hooks in the same session
				signalFailure(lockManager, {
					pluginName,
					hookName,
					directory: relativePath,
				});

				const reason = result.idleTimedOut
					? " (idle timeout - no output received)"
					: "";

				// Build the MCP tool re-run instruction (preferred over bash)
				const mcpToolCall = buildMcpToolInstruction(pluginName, hookName, {
					only: relativePath === "." ? undefined : relativePath,
				});

				const outputFile = result.outputFile
					? result.outputFile
					: "(no output captured)";

				// Show fail fast message
				console.error(`\n⚠ Stopped due to fail fast\n`);

				// Concise, directive error message that emphasizes subagent delegation
				// Uses MCP tool for re-run (better context control than bash)
				console.error(
					`Hook \`${pluginName}/${hookName}\` failed in \`${relativePath}\`${reason}.\n\n` +
						`**CRITICAL**: You MUST spawn a subagent to fix this. The subagent MUST:\n` +
						`1. Read the output file: ${outputFile}\n` +
						`2. Analyze the errors and fix them\n` +
						`3. Re-run using MCP tool: ${mcpToolCall}\n\n` +
						`Do NOT skip this. Do NOT ask the user. Do NOT dismiss as a "known issue".\n`,
				);
				process.exit(2);
			}
		} else {
			// Show individual success
			console.log(`  ✓ ${relativePath} passed`);
			successfulConfigs.push(config);
		}
	}

	const ranCount = successfulConfigs.length + failures.length;

	// Report skipped directories if any
	if (skippedCount > 0) {
		console.log(
			`Skipped ${skippedCount} director${skippedCount === 1 ? "y" : "ies"} (no changes detected)`,
		);
	}
	if (checkpointSkippedCount > 0) {
		console.log(
			`Skipped ${checkpointSkippedCount} director${checkpointSkippedCount === 1 ? "y" : "ies"} (no changes since ${checkpointType} checkpoint)`,
		);
	}
	if (transcriptSkippedCount > 0) {
		console.log(
			`Skipped ${transcriptSkippedCount} director${transcriptSkippedCount === 1 ? "y" : "ies"} (pattern files not modified by this ${checkpointType})`,
		);
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
				await trackFilesAsync(
					pluginName,
					cacheKey,
					config.directory,
					config.ifChanged,
					pluginRoot,
				);
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

		console.error(
			`\nReview the output files above and fix all issues.\n` +
				`Do NOT ask the user any questions - proceed directly with fixing the issues.\n`,
		);
		process.exit(2);
	}

	console.log(
		`\n✅ ${ranCount} director${ranCount === 1 ? "y" : "ies"} passed`,
	);
	process.exit(0);
}
