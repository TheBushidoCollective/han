import { randomUUID } from "node:crypto";
import { execSync } from "node:child_process";
import { existsSync, fstatSync, readFileSync, realpathSync } from "node:fs";
import { homedir } from "node:os";
import { join, relative } from "node:path";
import type { Command } from "commander";
import { minimatch } from "minimatch";
import {
	getMergedPluginsAndMarketplaces,
	type MarketplaceConfig,
} from "../../config/claude-settings.ts";
import { EventLogger, initEventLogger } from "../../events/logger.ts";
import {
	buildCommandWithFiles,
	findDirectoriesWithMarkers,
	loadPluginConfig,
	type PluginHookDefinition,
} from "../../hooks/index.ts";
import {
	isCoordinatorRunning,
	waitForAsyncHookResult,
} from "../../services/async-hook-client.ts";
import { isDebugMode } from "../../shared.ts";
import { runConfiguredHook, validate } from "../../validate.ts";

/**
 * Check if stdin has data available.
 * Handles various stdin types: files, FIFOs, pipes, and sockets.
 */
function hasStdinData(): boolean {
	try {
		// TTY means interactive terminal - no piped input
		if (process.stdin.isTTY) {
			return false;
		}
		const stat = fstatSync(0);
		// Accept any non-TTY stdin type (file, FIFO, socket, pipe)
		// Socket is used when parent process passes data via execSync's input option
		return stat.isFile() || stat.isFIFO() || stat.isSocket();
	} catch {
		return false;
	}
}

/**
 * Full stdin payload structure from Claude Code hooks
 */
interface HookPayload {
	session_id?: string;
	hook_event_name?: string;
	tool_name?: string;
	tool_input?: Record<string, unknown>;
	tool_result?: unknown;
	cwd?: string;
}

/**
 * Read and parse stdin to extract full payload
 * This is called once at startup since stdin is only readable once
 */
let stdinPayload: HookPayload | null = null;
let stdinRead = false;
function getStdinPayload(): HookPayload | null {
	if (!stdinRead) {
		stdinRead = true;
		try {
			// Only read if stdin has data available (prevents blocking)
			if (!hasStdinData()) {
				if (isDebugMode()) {
					console.error("[han hook run] No stdin data available");
				}
				return null;
			}
			const raw = readFileSync(0, "utf-8");
			stdinPayload = raw ? JSON.parse(raw) : null;
		} catch {
			stdinPayload = null;
		}
	}
	return stdinPayload;
}

/**
 * Extract file path from tool input based on tool type
 */
function extractFilePath(payload: HookPayload): string | null {
	const toolInput = payload.tool_input;
	if (!toolInput) return null;

	switch (payload.tool_name) {
		case "Edit":
		case "Write":
		case "Read":
			return (toolInput.file_path as string) || null;
		case "NotebookEdit":
			return (toolInput.notebook_path as string) || null;
		default:
			return null;
	}
}

/**
 * Check if file matches glob patterns
 */
function matchesFileFilter(
	filePath: string,
	fileFilter: string[] | undefined,
	cwd: string,
): boolean {
	if (!fileFilter || fileFilter.length === 0) {
		return true; // No filter means match all
	}

	// Make path relative to cwd for matching
	const relativePath = filePath.startsWith(cwd)
		? filePath.slice(cwd.length + 1)
		: filePath;

	for (const pattern of fileFilter) {
		if (minimatch(relativePath, pattern, { dot: true })) {
			return true;
		}
	}
	return false;
}

/**
 * Run file_test command to check if file content should be processed
 */
function passesFileTest(
	filePath: string,
	fileTest: string | undefined,
	cwd: string,
): boolean {
	if (!fileTest) {
		return true; // No test means pass
	}

	try {
		execSync(fileTest, {
			cwd,
			stdio: ["ignore", "ignore", "ignore"],
			encoding: "utf8",
			shell: "/bin/bash",
			env: {
				...process.env,
				HAN_FILE: filePath,
			},
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Check if directory passes dir_test command
 */
function passesDirTest(dir: string, dirTest: string | undefined): boolean {
	if (!dirTest) {
		return true;
	}

	try {
		execSync(dirTest, {
			cwd: dir,
			stdio: ["ignore", "ignore", "ignore"],
			encoding: "utf8",
			shell: "/bin/bash",
			env: process.env,
			timeout: 5000,
		});
		return true;
	} catch {
		return false;
	}
}

/**
 * Async hook output format for Claude Code
 */
interface AsyncHookOutput {
	systemMessage?: string;
	additionalContext?: string;
}

/**
 * Get the Claude config directory
 */
function getClaudeConfigDir(): string | null {
	const home = homedir();
	const configDir = join(home, ".claude");
	return existsSync(configDir) ? configDir : null;
}

/**
 * Find a plugin within a marketplace directory structure
 */
function findPluginInMarketplace(
	marketplaceRoot: string,
	pluginName: string,
): string | null {
	// Check standard plugin locations: bushido/, jutsu/, do/, hashi/, etc.
	const pluginDirs = [
		"bushido",
		"jutsu",
		"do",
		"hashi",
		"languages",
		"validation",
		"tools",
	];

	for (const subdir of pluginDirs) {
		const pluginPath = join(marketplaceRoot, subdir, pluginName);
		if (existsSync(join(pluginPath, "han-plugin.yml"))) {
			return pluginPath;
		}
	}

	// Check root level
	const rootPath = join(marketplaceRoot, pluginName);
	if (existsSync(join(rootPath, "han-plugin.yml"))) {
		return rootPath;
	}

	return null;
}

/**
 * Get plugin directory for a given plugin name
 */
function getPluginDir(
	pluginName: string,
	marketplace: string,
	marketplaceConfig: MarketplaceConfig | undefined,
): string | null {
	const projectDir = process.cwd();

	// Check marketplace config for directory source
	if (marketplaceConfig?.source?.source === "directory") {
		const directoryPath = marketplaceConfig.source.path;
		if (directoryPath) {
			const absolutePath = directoryPath.startsWith("/")
				? directoryPath
				: join(projectDir, directoryPath);
			const found = findPluginInMarketplace(absolutePath, pluginName);
			if (found) return found;
		}
	}

	// Check if we're in the marketplace repo (development)
	if (existsSync(join(projectDir, ".claude-plugin", "marketplace.json"))) {
		const found = findPluginInMarketplace(projectDir, pluginName);
		if (found) return found;
	}

	// Fall back to default shared config path
	const configDir = getClaudeConfigDir();
	if (!configDir) return null;

	const marketplaceRoot = join(
		configDir,
		"plugins",
		"marketplaces",
		marketplace,
	);
	if (!existsSync(marketplaceRoot)) return null;

	return findPluginInMarketplace(marketplaceRoot, pluginName);
}

/**
 * Discover plugin root by searching all marketplaces
 */
function discoverPluginRoot(
	pluginName: string,
	plugins: Map<string, string>,
	marketplaces: Map<string, MarketplaceConfig>,
): string | null {
	// First check if plugin is explicitly enabled with a marketplace
	const marketplace = plugins.get(pluginName);
	if (marketplace) {
		const marketplaceConfig = marketplaces.get(marketplace);
		const pluginRoot = getPluginDir(pluginName, marketplace, marketplaceConfig);
		if (pluginRoot) return pluginRoot;
	}

	// Fallback: check all marketplaces
	for (const [mktName, mktConfig] of marketplaces.entries()) {
		const pluginRoot = getPluginDir(pluginName, mktName, mktConfig);
		if (pluginRoot) return pluginRoot;
	}

	return null;
}

/**
 * Run a hook in async mode for PostToolUse/Stop
 * Returns JSON output for Claude Code async hook handling
 *
 * Event-sourced architecture:
 * 1. Log async_hook_queued to JSONL
 * 2. If coordinator running, wait for result via WebSocket
 * 3. If not, execute locally and log async_hook_completed
 */
async function runAsyncHook(
	pluginName: string,
	hookName: string,
	pluginRoot: string,
	hookDef: PluginHookDefinition,
	payload: HookPayload,
	sessionId: string,
	projectRoot: string,
): Promise<AsyncHookOutput | null> {
	// Check tool_filter
	if (hookDef.toolFilter && hookDef.toolFilter.length > 0) {
		if (!payload.tool_name || !hookDef.toolFilter.includes(payload.tool_name)) {
			if (isDebugMode()) {
				console.error(
					`[async] Tool ${payload.tool_name} doesn't match filter ${hookDef.toolFilter.join(", ")}`,
				);
			}
			return null; // Tool doesn't match filter
		}
	}

	// Extract file path for file-based hooks
	const filePath = extractFilePath(payload);
	if (!filePath && hookDef.fileFilter && hookDef.fileFilter.length > 0) {
		if (isDebugMode()) {
			console.error("[async] No file path in payload for file-filtered hook");
		}
		return null; // File filter specified but no file in payload
	}

	// Find matching directories (dirs_with)
	let directories: string[] = [projectRoot];
	if (hookDef.dirsWith && hookDef.dirsWith.length > 0) {
		directories = findDirectoriesWithMarkers(projectRoot, hookDef.dirsWith);
		if (directories.length === 0) {
			if (isDebugMode()) {
				console.error(
					`[async] No directories found with markers: ${hookDef.dirsWith.join(", ")}`,
				);
			}
			return null;
		}
	}

	// Find first matching directory
	let matchedDir: string | null = null;
	for (const dir of directories) {
		// Check dir_test
		if (!passesDirTest(dir, hookDef.dirTest)) {
			continue;
		}

		// Check file_filter if we have a file
		if (filePath && !matchesFileFilter(filePath, hookDef.fileFilter, dir)) {
			continue;
		}

		// Check file_test if we have a file
		if (filePath && !passesFileTest(filePath, hookDef.fileTest, dir)) {
			continue;
		}

		matchedDir = dir;
		break;
	}

	if (!matchedDir) {
		if (isDebugMode()) {
			console.error("[async] No matching directory found after all filters");
		}
		return null;
	}

	// Build command with file path
	let command = hookDef.command;
	if (filePath) {
		command = buildCommandWithFiles(command, [filePath]);
	}

	// Replace ${CLAUDE_PLUGIN_ROOT} placeholder
	command = command.replace(/\$\{CLAUDE_PLUGIN_ROOT\}/g, pluginRoot);

	// Generate unique hook ID
	const hookId = randomUUID();
	const filePaths = filePath ? [filePath] : [];

	// Create event logger for this session
	const logger = new EventLogger(sessionId, {}, matchedDir);

	// Log async_hook_queued event to JSONL
	logger.logAsyncHookQueued(
		hookId,
		pluginName,
		hookName,
		matchedDir,
		filePaths,
		command,
		payload.tool_name,
	);
	logger.flush();

	if (isDebugMode()) {
		console.error(
			`[async] Queued ${pluginName}/${hookName} (id: ${hookId}) for ${filePath || matchedDir}`,
		);
	}

	// Check if coordinator is running
	const coordinatorAvailable = await isCoordinatorRunning();

	let success = false;
	let output = "";
	let errorOutput = "";
	let duration = 0;
	let exitCode = 0;

	if (coordinatorAvailable) {
		// Coordinator is running - wait for result via WebSocket
		if (isDebugMode()) {
			console.error(`[async] Waiting for coordinator to execute ${hookId}...`);
		}

		const result = await waitForAsyncHookResult(
			hookId,
			hookDef.timeout || 300000,
		);

		if (result) {
			// Check if hook was cancelled (e.g., due to deduplication)
			// Exit silently with no output
			if (result.cancelled) {
				if (isDebugMode()) {
					console.error(
						`[async] Hook ${hookId} was cancelled (deduplication), exiting silently`,
					);
				}
				return null;
			}

			success = result.success;
			output = result.output || "";
			errorOutput = result.error || "";
			duration = result.durationMs;
			exitCode = result.exitCode;
		} else {
			// Timeout or error - fall back to local execution
			if (isDebugMode()) {
				console.error(
					`[async] Coordinator result timeout, falling back to local execution`,
				);
			}
			const localResult = await executeHookLocally(
				command,
				matchedDir,
				pluginRoot,
				projectRoot,
				sessionId,
				filePath,
				hookDef.timeout || 300000,
			);
			success = localResult.success;
			output = localResult.output;
			errorOutput = localResult.error;
			duration = localResult.duration;
			exitCode = localResult.exitCode;

			// Log completed event (coordinator wasn't able to do it)
			logger.logAsyncHookCompleted(
				hookId,
				pluginName,
				hookName,
				success,
				duration,
				exitCode,
				output,
				errorOutput,
			);
			logger.flush();
		}
	} else {
		// Coordinator not running - execute locally
		if (isDebugMode()) {
			console.error(
				`[async] Coordinator not available, executing locally`,
			);
		}

		const localResult = await executeHookLocally(
			command,
			matchedDir,
			pluginRoot,
			projectRoot,
			sessionId,
			filePath,
			hookDef.timeout || 300000,
		);
		success = localResult.success;
		output = localResult.output;
		errorOutput = localResult.error;
		duration = localResult.duration;
		exitCode = localResult.exitCode;

		// Log completed event
		logger.logAsyncHookCompleted(
			hookId,
			pluginName,
			hookName,
			success,
			duration,
			exitCode,
			output,
			errorOutput,
		);
		logger.flush();
	}

	const relativeDir =
		matchedDir === projectRoot ? "." : relative(projectRoot, matchedDir);
	const fileInfo = filePath ? ` (${relative(projectRoot, filePath)})` : "";

	if (success) {
		if (isDebugMode()) {
			console.error(
				`[async] ✓ ${pluginName}/${hookName} in ${relativeDir}${fileInfo} (${duration}ms)`,
			);
		}
		// Success - no output needed (or minimal output)
		return null;
	}

	// Failure - return structured output for Claude
	const errorSummary = errorOutput.slice(0, 2000); // Truncate long errors

	return {
		systemMessage: `❌ ${pluginName}/${hookName} failed in ${relativeDir}${fileInfo}:\n\n${errorSummary}`,
		additionalContext: `REQUIREMENT: Fix the ${hookName} errors shown above before proceeding. The validation hook "${pluginName}/${hookName}" failed. You must address these issues.\n\nAfter fixing, run \`han hook run ${pluginName} ${hookName}\` to verify the fix (this will use caching to avoid re-running if already passing).`,
	};
}

/**
 * Execute hook locally (fallback when coordinator not available)
 */
async function executeHookLocally(
	command: string,
	cwd: string,
	pluginRoot: string,
	projectRoot: string,
	sessionId: string,
	filePath: string | null,
	timeout: number,
): Promise<{
	success: boolean;
	output: string;
	error: string;
	duration: number;
	exitCode: number;
}> {
	const startTime = Date.now();
	let success = false;
	let output = "";
	let errorOutput = "";
	let exitCode = 0;

	try {
		output = execSync(command, {
			cwd,
			encoding: "utf-8",
			timeout,
			shell: "/bin/bash",
			env: {
				...process.env,
				CLAUDE_PLUGIN_ROOT: pluginRoot,
				CLAUDE_PROJECT_DIR: projectRoot,
				HAN_SESSION_ID: sessionId,
				...(filePath ? { HAN_FILE: filePath, HAN_FILES: filePath } : {}),
			},
		});
		success = true;
	} catch (error: unknown) {
		const stderr = (error as { stderr?: Buffer })?.stderr?.toString() || "";
		const stdout = (error as { stdout?: Buffer })?.stdout?.toString() || "";
		exitCode = (error as { status?: number })?.status || 1;
		output = stdout;
		errorOutput = stderr || stdout;
	}

	return {
		success,
		output: output.trim(),
		error: errorOutput.trim(),
		duration: Date.now() - startTime,
		exitCode,
	};
}

export function registerHookRun(hookCommand: Command): void {
	// Supports two formats:
	// 1. New format: han hook run <plugin-name> <hook-name> [--no-cache] [--no-fail-fast] [--only=<dir>]
	//    Uses plugin han-plugin.yml to determine dirsWith and default command
	// 2. Legacy format: han hook run --dirs-with <file> -- <command>
	//    Explicit dirsWith and command specification
	hookCommand
		.command("run [args...]")
		.description(
			"Run a hook across directories.\n" +
				"New format: han hook run <plugin-name> <hook-name> [--no-cache] [--no-fail-fast] [--only=<dir>]\n" +
				"Legacy format: han hook run --dirs-with <file> -- <command>",
		)
		.option(
			"--no-fail-fast",
			"Disable fail-fast - continue running even after failures",
		)
		.option("--fail-fast", "(Deprecated) Fail-fast is now the default behavior")
		.option(
			"--dirs-with <file>",
			"(Legacy) Only run in directories containing the specified file",
		)
		.option(
			"--test-dir <command>",
			"(Legacy) Only include directories where this command exits 0",
		)
		.option(
			"--no-cache",
			"Disable caching - run even if no files have changed since last successful run",
		)
		.option("--cached", "(Deprecated) Caching is now the default behavior")
		.option(
			"--only <directory>",
			"Only run in the specified directory (for targeted re-runs after failures)",
		)
		.option(
			"--verbose",
			"Show full command output (also settable via HAN_HOOK_RUN_VERBOSE=1)",
		)
		.option(
			"--checkpoint-type <type>",
			"Checkpoint type to filter against (session or agent)",
		)
		.option("--checkpoint-id <id>", "Checkpoint ID to filter against")
		.option(
			"--skip-deps",
			"Skip dependency checks (for recheck/retry scenarios)",
		)
		.option(
			"--session-id <id>",
			"Claude session ID for event logging and cache tracking",
		)
		.option(
			"--async",
			"Run in async mode for PostToolUse hooks (returns JSON for Claude Code)",
		)
		.allowUnknownOption()
		.action(
			async (
				args: string[],
				options: {
					failFast?: boolean;
					dirsWith?: string;
					testDir?: string;
					cache?: boolean;
					cached?: boolean;
					only?: string;
					verbose?: boolean;
					checkpointType?: string;
					checkpointId?: string;
					skipDeps?: boolean;
					sessionId?: string;
					async?: boolean;
				},
			) => {
				// Allow global disable of all hooks via environment variable
				if (
					process.env.HAN_DISABLE_HOOKS === "true" ||
					process.env.HAN_DISABLE_HOOKS === "1"
				) {
					process.exit(0);
				}

				// Initialize event logger for this session
				// Session ID can come from: CLI option, stdin payload, or environment
				const payload = getStdinPayload();
				const sessionId =
					options.sessionId ||
					payload?.session_id ||
					process.env.CLAUDE_SESSION_ID;
				if (isDebugMode()) {
					console.error(
						`[han hook run] stdin payload: ${JSON.stringify(payload)}`,
					);
					console.error(
						`[han hook run] session_id: ${sessionId || "(none)"} (source: ${options.sessionId ? "cli" : payload?.session_id ? "stdin" : process.env.CLAUDE_SESSION_ID ? "env" : "none"})`,
					);
				}
				if (sessionId) {
					// Events are stored alongside Claude transcripts in the project directory
					initEventLogger(sessionId, {}, process.cwd());
				} else if (isDebugMode()) {
					console.error(
						"[han hook run] No session_id found, event logging disabled",
					);
				}

				// Async mode: for PostToolUse hooks called by Claude Code with async: true
				if (options.async) {
					const pluginName = args.length > 0 ? args[0] : undefined;
					const hookName = args.length > 1 ? args[1] : undefined;

					if (!pluginName || !hookName) {
						console.error(
							"Error: Plugin name and hook name are required for async mode.",
						);
						process.exit(1);
					}

					if (!sessionId) {
						console.error("Error: Session ID is required for async mode.");
						process.exit(1);
					}

					// Discover plugin root
					const { plugins, marketplaces } = getMergedPluginsAndMarketplaces(
						process.cwd(),
					);
					const pluginRoot = discoverPluginRoot(
						pluginName,
						plugins,
						marketplaces,
					);

					if (!pluginRoot) {
						console.error(`Error: Plugin '${pluginName}' not found.`);
						process.exit(1);
					}

					// Load plugin config
					const pluginConfig = loadPluginConfig(pluginRoot);
					if (!pluginConfig) {
						console.error(
							`Error: No han-plugin.yml found for plugin '${pluginName}'.`,
						);
						process.exit(1);
					}

					const hookDef = pluginConfig.hooks?.[hookName];
					if (!hookDef) {
						console.error(
							`Error: Hook '${hookName}' not found in plugin '${pluginName}'.`,
						);
						process.exit(1);
					}

					// Run the async hook with full matching logic
					const result = await runAsyncHook(
						pluginName,
						hookName,
						pluginRoot,
						hookDef,
						payload || {},
						sessionId,
						process.cwd(),
					);

					// Output JSON if there's a result (failure)
					if (result) {
						console.log(JSON.stringify(result));
					}

					// Exit 0 even on failure - Claude Code handles the result
					process.exit(0);
				}

				const separatorIndex = process.argv.indexOf("--");
				const isLegacyFormat = separatorIndex !== -1;

				// Determine verbose mode from option or environment variable
				const verbose =
					options.verbose ||
					process.env.HAN_HOOK_RUN_VERBOSE === "1" ||
					process.env.HAN_HOOK_RUN_VERBOSE === "true";

				// Settings resolution: CLI --no-X options explicitly disable features.
				// If not passed, validate.ts will use han.yml defaults and check env vars.
				// Commander sets cache=false when --no-cache is used, failFast=false when --no-fail-fast is used.
				const cacheOverride = options.cache === false ? false : undefined;
				const failFastOverride = options.failFast === false ? false : undefined;

				if (isLegacyFormat) {
					const commandArgs = process.argv.slice(separatorIndex + 1);

					if (commandArgs.length === 0) {
						console.error(
							"Error: No command specified after --\n\nExample: han hook run --dirs-with package.json -- npm test",
						);
						process.exit(1);
					}

					const quotedArgs = commandArgs.map((arg) => {
						if (
							arg.includes(" ") ||
							arg.includes("&") ||
							arg.includes("|") ||
							arg.includes(";")
						) {
							return `'${arg.replace(/'/g, "'\\''")}'`;
						}
						return arg;
					});

					await validate({
						failFast: failFastOverride ?? true, // Legacy format defaults to fail-fast
						dirsWith: options.dirsWith || null,
						testDir: options.testDir || null,
						command: quotedArgs.join(" "),
						verbose,
					});
				} else {
					// New format: han hook run <plugin-name> <hook-name>
					const pluginName = args.length > 0 ? args[0] : undefined;
					const hookName = args.length > 1 ? args[1] : undefined;

					if (!pluginName || !hookName) {
						console.error(
							"Error: Plugin name and hook name are required.\n\n" +
								"Usage:\n" +
								"  New format:    han hook run <plugin-name> <hook-name> [--no-cache] [--no-fail-fast] [--only=<dir>]\n" +
								"  Legacy format: han hook run --dirs-with <file> -- <command>",
						);
						process.exit(1);
					}

					// Read checkpoint info from options or environment variables
					const checkpointTypeRaw =
						options.checkpointType || process.env.HAN_CHECKPOINT_TYPE;
					const checkpointId =
						options.checkpointId || process.env.HAN_CHECKPOINT_ID;

					// Validate checkpoint options
					if (checkpointTypeRaw && !checkpointId) {
						console.error(
							"Error: --checkpoint-id is required when --checkpoint-type is set",
						);
						process.exit(1);
					}
					if (
						checkpointTypeRaw &&
						checkpointTypeRaw !== "session" &&
						checkpointTypeRaw !== "agent"
					) {
						console.error(
							"Error: --checkpoint-type must be 'session' or 'agent'",
						);
						process.exit(1);
					}

					// Type-safe checkpoint type
					const checkpointType: "session" | "agent" | undefined =
						checkpointTypeRaw === "session" || checkpointTypeRaw === "agent"
							? checkpointTypeRaw
							: undefined;

					await runConfiguredHook({
						pluginName,
						hookName,
						failFast: failFastOverride, // undefined = use han.yml default
						cache: cacheOverride, // undefined = use han.yml default
						only: options.only,
						verbose,
						checkpointType,
						checkpointId,
						skipDeps: options.skipDeps,
						sessionId, // Pass sessionId for cache tracking
					});
				}
			},
		);
}
