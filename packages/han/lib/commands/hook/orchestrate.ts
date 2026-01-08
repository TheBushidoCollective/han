import { execSync, spawn } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import type { Command } from "commander";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	type MarketplaceConfig,
} from "../../config/claude-settings.ts";
import { getPluginHookSettings } from "../../config/han-settings.ts";
import { hookAttempts, pendingHooks } from "../../db/index.ts";
import {
	getEventLogger,
	getOrCreateEventLogger,
	initEventLogger,
} from "../../events/logger.ts";
import {
	checkForChangesAsync,
	findDirectoriesWithMarkers,
	hookMatchesEvent,
	loadPluginConfig,
	type PluginHookDefinition,
	trackFilesAsync,
} from "../../hooks/index.ts";
import { acquireGlobalSlot } from "../../hooks/slot-client.ts";
import { isDebugMode } from "../../shared.ts";
import { getCacheKeyForDirectory } from "../../validate.ts";

/**
 * Get the han binary invocation string.
 * Uses the current process's execPath and script to ensure
 * we invoke the same han binary for child processes.
 */
function getHanBinary(): string {
	// process.execPath = runtime (bun/node)
	// process.argv[1] = script path (e.g., /path/to/lib/main.ts)
	const scriptPath = process.argv[1];
	if (scriptPath) {
		return `"${process.execPath}" "${scriptPath}"`;
	}
	// Fallback to 'han' from PATH if we can't determine the script
	return "han";
}

/**
 * Replace 'han ' prefix in commands with the actual binary invocation.
 * This ensures inner han commands use the same version as the orchestrator.
 */
function resolveHanCommand(command: string): string {
	const hanBinary = getHanBinary();
	// Replace 'han ' at the start of the command
	if (command.startsWith("han ")) {
		return hanBinary + command.slice(3);
	}
	return command;
}

/**
 * Result of running a command with timeout
 */
interface CommandWithTimeoutResult {
	completed: boolean;
	success: boolean;
	output: string;
	error: string;
	exitCode: number;
	duration: number;
}

/**
 * Run a command with a timeout. If the command doesn't complete within the timeout,
 * returns { completed: false } so the caller can defer to background execution.
 *
 * @param command - The shell command to run
 * @param cwd - Working directory
 * @param env - Environment variables
 * @param payloadJson - JSON payload to pass via stdin
 * @param timeoutMs - Maximum time to wait before returning (default: 5000ms)
 * @returns Result with completed flag indicating if finished within timeout
 */
async function runCommandWithTimeout(
	command: string,
	cwd: string,
	env: Record<string, string | undefined>,
	payloadJson: string,
	timeoutMs = 5000,
): Promise<CommandWithTimeoutResult> {
	const startTime = Date.now();

	return new Promise((resolve) => {
		let stdout = "";
		let stderr = "";
		let resolved = false;

		const proc = spawn("/bin/bash", ["-c", command], {
			cwd,
			env: { ...process.env, ...env },
		});

		// Write payload to stdin
		proc.stdin.write(payloadJson);
		proc.stdin.end();

		proc.stdout.on("data", (data) => {
			stdout += data.toString();
		});

		proc.stderr.on("data", (data) => {
			stderr += data.toString();
		});

		// Set up timeout
		const timer = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				// Don't kill the process - it will continue running
				// The coordinator will pick it up via pendingHooks
				resolve({
					completed: false,
					success: false,
					output: stdout,
					error: "timeout - deferred to background",
					exitCode: -1,
					duration: Date.now() - startTime,
				});
			}
		}, timeoutMs);

		proc.on("close", (code) => {
			clearTimeout(timer);
			if (!resolved) {
				resolved = true;
				resolve({
					completed: true,
					success: code === 0,
					output: stdout,
					error: stderr,
					exitCode: code ?? 1,
					duration: Date.now() - startTime,
				});
			}
		});

		proc.on("error", (err) => {
			clearTimeout(timer);
			if (!resolved) {
				resolved = true;
				resolve({
					completed: true,
					success: false,
					output: stdout,
					error: err.message,
					exitCode: 1,
					duration: Date.now() - startTime,
				});
			}
		});
	});
}

/**
 * ANSI color codes for CLI output
 */
const colors = {
	reset: "\x1b[0m",
	dim: "\x1b[2m",
	cyan: "\x1b[36m",
	green: "\x1b[32m",
	red: "\x1b[31m",
	yellow: "\x1b[33m",
	bold: "\x1b[1m",
	magenta: "\x1b[35m",
};

/**
 * Format duration in human-readable form
 */
function formatDuration(ms: number): string {
	if (ms < 1000) {
		return `${ms}ms`;
	}
	const seconds = ms / 1000;
	if (seconds < 60) {
		return `${seconds.toFixed(1)}s`;
	}
	const minutes = Math.floor(seconds / 60);
	const remainingSeconds = seconds % 60;
	return `${minutes}m ${remainingSeconds.toFixed(0)}s`;
}

/**
 * Hook payload structure from Claude Code stdin
 * These are the common fields that Claude Code sends with hook invocations.
 */
interface HookPayload {
	// Common fields (always present from Claude Code)
	session_id?: string;
	transcript_path?: string;
	cwd?: string;
	permission_mode?: string;

	// Event-specific fields
	hook_event_name?: string;
	agent_id?: string;
	agent_type?: string;
	tool_name?: string;

	// Stop hook specific - indicates this is a retry after a previous stop hook failure
	// When true, we track consecutive failures for attempt tracking
	stop_hook_active?: boolean;
}

/**
 * Generate a CLI payload when running orchestrate directly from command line.
 * This mimics the payload structure that Claude Code would send.
 */
function generateCliPayload(
	eventType: string,
	projectRoot: string,
): HookPayload {
	const sessionId = `cli-${randomUUID()}`;

	return {
		session_id: sessionId,
		transcript_path: "", // No transcript in CLI mode
		cwd: projectRoot,
		permission_mode: "default",
		hook_event_name: eventType,
	};
}

/**
 * A discovered hook task ready for execution
 */
interface HookTask {
	plugin: string;
	pluginRoot: string;
	hookName: string;
	hookDef: PluginHookDefinition;
	directories: string[];
	dependsOn: Array<{ plugin: string; hook: string; optional?: boolean }>;
}

/**
 * Result of executing a hook in a directory
 */
interface HookResult {
	plugin: string;
	hook: string;
	directory: string;
	success: boolean;
	output?: string;
	error?: string;
	duration: number;
	skipped?: boolean;
	skipReason?: string;
	/** Hook was deferred to background execution */
	deferred?: boolean;
}

/**
 * Read stdin payload from Claude Code.
 * Handles various stdin types: files, FIFOs, pipes, and sockets.
 */
function readStdinPayload(): HookPayload | null {
	try {
		// TTY means interactive terminal - no piped input
		if (process.stdin.isTTY) {
			return null;
		}

		const { fstatSync } = require("node:fs");
		const stat = fstatSync(0);

		// Accept any non-TTY stdin type (file, FIFO, socket, pipe)
		if (!stat.isFile() && !stat.isFIFO() && !stat.isSocket()) {
			return null;
		}

		// For files, check if there's content before reading
		if (stat.isFile() && stat.size === 0) {
			return null;
		}

		const stdin = readFileSync(0, "utf-8");
		if (stdin.trim()) {
			return JSON.parse(stdin) as HookPayload;
		}
	} catch {
		// stdin not available
	}
	return null;
}

/**
 * Find plugin directory in a marketplace
 */
function findPluginInMarketplace(
	marketplaceRoot: string,
	pluginName: string,
): string | null {
	const potentialPaths = [
		join(marketplaceRoot, "jutsu", pluginName),
		join(marketplaceRoot, "do", pluginName),
		join(marketplaceRoot, "hashi", pluginName),
		join(marketplaceRoot, "core"),
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
 * Get plugin directory for a plugin
 */
function getPluginDir(
	pluginName: string,
	marketplace: string,
	marketplaceConfig: MarketplaceConfig | undefined,
): string | null {
	// Check marketplace config for directory source
	if (marketplaceConfig?.source?.source === "directory") {
		const directoryPath = marketplaceConfig.source.path;
		if (directoryPath) {
			const absolutePath = directoryPath.startsWith("/")
				? directoryPath
				: join(process.cwd(), directoryPath);
			const found = findPluginInMarketplace(absolutePath, pluginName);
			if (found) return found;
		}
	}

	// Check if we're in the marketplace repo (development)
	const cwd = process.cwd();
	if (existsSync(join(cwd, ".claude-plugin", "marketplace.json"))) {
		const found = findPluginInMarketplace(cwd, pluginName);
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
 * Discover all hook tasks for a given event type
 */
function discoverHookTasks(
	eventType: string,
	payload: HookPayload | null,
	projectRoot: string,
): HookTask[] {
	const tasks: HookTask[] = [];
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

	for (const [pluginName, marketplace] of plugins.entries()) {
		const marketplaceConfig = marketplaces.get(marketplace);
		const pluginRoot = getPluginDir(pluginName, marketplace, marketplaceConfig);

		if (!pluginRoot) continue;

		const config = loadPluginConfig(pluginRoot, false);
		if (!config?.hooks) continue;

		for (const [hookName, hookDef] of Object.entries(config.hooks)) {
			// Check if this hook responds to this event type
			if (!hookMatchesEvent(hookDef, eventType)) {
				continue;
			}

			// For PreToolUse/PostToolUse, check tool filter
			if (
				(eventType === "PreToolUse" || eventType === "PostToolUse") &&
				hookDef.toolFilter &&
				hookDef.toolFilter.length > 0
			) {
				const toolName = payload?.tool_name;
				if (!toolName || !hookDef.toolFilter.includes(toolName)) {
					continue;
				}
			}

			// Find directories for this hook
			let directories: string[];
			if (!hookDef.dirsWith || hookDef.dirsWith.length === 0) {
				directories = [projectRoot];
			} else {
				directories = findDirectoriesWithMarkers(projectRoot, hookDef.dirsWith);

				// Apply dirTest filter if specified
				const dirTestCmd = hookDef.dirTest;
				if (dirTestCmd) {
					directories = directories.filter((dir) => {
						try {
							execSync(dirTestCmd, {
								cwd: dir,
								stdio: ["ignore", "ignore", "ignore"],
								encoding: "utf8",
								shell: "/bin/sh",
							});
							return true;
						} catch {
							return false;
						}
					});
				}
			}

			if (directories.length === 0) continue;

			tasks.push({
				plugin: pluginName,
				pluginRoot,
				hookName,
				hookDef,
				directories,
				dependsOn: hookDef.dependsOn || [],
			});
		}
	}

	return tasks;
}

/**
 * Topological sort of hook tasks based on dependencies
 * Returns batches that can be executed in parallel
 */
function resolveDependencies(tasks: HookTask[]): HookTask[][] {
	const taskMap = new Map<string, HookTask>();
	const inDegree = new Map<string, number>();
	const graph = new Map<string, string[]>();

	// Build task lookup and initialize in-degrees
	for (const task of tasks) {
		const key = `${task.plugin}/${task.hookName}`;
		taskMap.set(key, task);
		inDegree.set(key, 0);
		graph.set(key, []);
	}

	// Build dependency graph
	for (const task of tasks) {
		const key = `${task.plugin}/${task.hookName}`;
		for (const dep of task.dependsOn) {
			const depKey = `${dep.plugin}/${dep.hook}`;

			// Check if dependency exists
			if (!taskMap.has(depKey)) {
				if (dep.optional) {
					continue; // Skip optional missing dependencies
				}
				console.error(
					`Error: Hook ${key} depends on ${depKey}, but it's not available for this event type.`,
				);
				continue;
			}

			// Add edge: dep -> task (dep must run before task)
			const edges = graph.get(depKey) || [];
			edges.push(key);
			graph.set(depKey, edges);

			// Increment in-degree
			inDegree.set(key, (inDegree.get(key) || 0) + 1);
		}
	}

	// Kahn's algorithm for topological sort into batches
	const batches: HookTask[][] = [];
	const remaining = new Set(taskMap.keys());

	while (remaining.size > 0) {
		// Find all tasks with no remaining dependencies
		const batch: HookTask[] = [];
		const toRemove: string[] = [];

		for (const key of remaining) {
			if ((inDegree.get(key) || 0) === 0) {
				const task = taskMap.get(key);
				if (task) {
					batch.push(task);
					toRemove.push(key);
				}
			}
		}

		if (batch.length === 0) {
			// Circular dependency detected
			console.error("Error: Circular dependency detected in hooks:");
			for (const key of remaining) {
				console.error(`  - ${key}`);
			}
			break;
		}

		batches.push(batch);

		// Remove processed tasks and update in-degrees
		for (const key of toRemove) {
			remaining.delete(key);
			for (const dependent of graph.get(key) || []) {
				inDegree.set(dependent, (inDegree.get(dependent) || 0) - 1);
			}
		}
	}

	return batches;
}

/**
 * Execute a single hook in a directory
 */
async function executeHookInDirectory(
	task: HookTask,
	directory: string,
	projectRoot: string,
	payload: HookPayload,
	options: {
		cache: boolean;
		checkpoints: boolean;
		verbose: boolean;
		cliMode: boolean;
		sessionId: string;
		hookType: string;
		isStopHook: boolean;
	},
): Promise<HookResult> {
	const startTime = Date.now();
	const relativePath =
		directory === projectRoot ? "." : directory.replace(`${projectRoot}/`, "");

	// Helper for CLI mode verbose output
	const cliLog = (message: string, color: keyof typeof colors = "reset") => {
		if (options.cliMode) {
			const time = new Date().toLocaleTimeString();
			console.error(
				`${colors.dim}[${time}]${colors.reset} ${colors[color]}${message}${colors.reset}`,
			);
		}
	};

	// Check user overrides for enabled state
	const hookSettings = getPluginHookSettings(
		task.plugin,
		task.hookName,
		directory,
	);
	if (hookSettings?.enabled === false) {
		const duration = Date.now() - startTime;
		// Log skipped hook
		const logger = getOrCreateEventLogger();
		logger?.logHookResult(
			task.plugin,
			task.hookName,
			options.hookType,
			relativePath,
			false,
			duration,
			0,
			true,
			"[skipped: disabled by user config]",
			undefined, // error
			undefined, // hookRunId
			task.hookDef.ifChanged,
			task.hookDef.command,
		);
		return {
			plugin: task.plugin,
			hook: task.hookName,
			directory: relativePath,
			success: true,
			skipped: true,
			skipReason: "disabled by user config",
			duration,
		};
	}

	// Check cache if enabled
	if (
		options.cache &&
		task.hookDef.ifChanged &&
		task.hookDef.ifChanged.length > 0
	) {
		const cacheKey = getCacheKeyForDirectory(
			task.hookName,
			directory,
			projectRoot,
		);
		const hasChanges = await checkForChangesAsync(
			task.plugin,
			cacheKey,
			directory,
			task.hookDef.ifChanged,
			task.pluginRoot,
		);

		if (!hasChanges) {
			const duration = Date.now() - startTime;
			// Log cached skip
			const logger = getOrCreateEventLogger();
			logger?.logHookResult(
				task.plugin,
				task.hookName,
				options.hookType,
				relativePath,
				true, // cached
				duration,
				0,
				true,
				"[skipped: no changes detected]",
				undefined, // error
				undefined, // hookRunId
				task.hookDef.ifChanged,
				task.hookDef.command,
			);
			return {
				plugin: task.plugin,
				hook: task.hookName,
				directory: relativePath,
				success: true,
				skipped: true,
				skipReason: "no changes detected",
				duration,
			};
		}
	}

	// Get resolved command (with user overrides)
	// Also resolve 'han ' prefix to use the current binary for inner commands
	const rawCommand = hookSettings?.command || task.hookDef.command;
	const command = resolveHanCommand(rawCommand);

	// For Stop hooks: acquire a slot with short timeout, defer if unavailable
	// This prevents resource exhaustion and enables background execution
	let slotHandle: Awaited<ReturnType<typeof acquireGlobalSlot>> | null = null;
	if (options.isStopHook) {
		// Try to acquire slot with 2 second timeout
		slotHandle = await acquireGlobalSlot(
			options.sessionId,
			task.hookName,
			task.plugin,
			2000, // Short timeout - defer if no slot available quickly
		);

		if (!slotHandle) {
			// No slot available - queue for background execution
			const duration = Date.now() - startTime;

			pendingHooks.queue({
				sessionId: options.sessionId,
				hookType: options.hookType,
				hookName: task.hookName,
				plugin: task.plugin,
				directory,
				command,
				ifChanged: task.hookDef.ifChanged
					? JSON.stringify(task.hookDef.ifChanged)
					: undefined,
			});

			const logger = getOrCreateEventLogger();
			logger?.logHookResult(
				task.plugin,
				task.hookName,
				options.hookType,
				relativePath,
				false,
				duration,
				0,
				true,
				"[deferred to background execution]",
				undefined,
				undefined,
				task.hookDef.ifChanged,
				command,
			);
			cliLog(
				`⏳ hook_deferred: ${task.plugin}/${task.hookName} in ${relativePath}`,
				"yellow",
			);

			return {
				plugin: task.plugin,
				hook: task.hookName,
				directory: relativePath,
				success: true,
				skipped: true,
				skipReason: "deferred to background",
				duration,
				deferred: true,
			};
		}
	}

	// Log hook_run event and capture UUID for correlation with result
	// Include ifChanged patterns and command to enable per-file validation tracking
	const logger = getOrCreateEventLogger();
	const hookRunId = logger?.logHookRun(
		task.plugin,
		task.hookName,
		options.hookType,
		relativePath,
		false,
		task.hookDef.ifChanged,
		command,
	);
	cliLog(
		`🪝 hook_run: ${task.plugin}/${task.hookName} in ${relativePath}`,
		"cyan",
	);

	if (options.verbose) {
		console.log(
			`\n[${task.plugin}/${task.hookName}] Running in ${relativePath}:`,
		);
		console.log(`  $ ${command}\n`);
	}

	// Serialize payload to pass via stdin to child process
	const payloadJson = JSON.stringify(payload);
	const hookEnv = {
		CLAUDE_PLUGIN_ROOT: task.pluginRoot,
		CLAUDE_PROJECT_DIR: projectRoot,
		HAN_SESSION_ID: options.sessionId,
	};

	// For Stop hooks: Use timeout-based execution (5 seconds)
	// If hook doesn't complete in time, defer to background and return immediately
	if (options.isStopHook) {
		const STOP_HOOK_TIMEOUT_MS = 5000; // 5 seconds before deferring

		const result = await runCommandWithTimeout(
			command,
			directory,
			hookEnv,
			payloadJson,
			STOP_HOOK_TIMEOUT_MS,
		);

		// Release slot early if we acquired one (before any deferral)
		if (slotHandle) {
			await slotHandle.release();
			slotHandle = null;
		}

		if (!result.completed) {
			// Hook didn't complete in time - queue for background execution
			pendingHooks.queue({
				sessionId: options.sessionId,
				hookType: options.hookType,
				hookName: task.hookName,
				plugin: task.plugin,
				directory,
				command,
				ifChanged: task.hookDef.ifChanged
					? JSON.stringify(task.hookDef.ifChanged)
					: undefined,
			});

			logger?.logHookResult(
				task.plugin,
				task.hookName,
				options.hookType,
				relativePath,
				false,
				result.duration,
				0,
				true, // Mark as success so Claude can continue
				"[deferred to background - took too long]",
				undefined,
				hookRunId,
				task.hookDef.ifChanged,
				command,
			);
			cliLog(
				`⏳ hook_deferred: ${task.plugin}/${task.hookName} in ${relativePath} (exceeded ${STOP_HOOK_TIMEOUT_MS}ms)`,
				"yellow",
			);

			return {
				plugin: task.plugin,
				hook: task.hookName,
				directory: relativePath,
				success: true, // Report success so Claude can continue
				skipped: true,
				skipReason: "deferred to background (timeout)",
				duration: result.duration,
				deferred: true,
			};
		}

		// Hook completed in time
		if (result.success) {
			// Update cache on success
			if (
				options.cache &&
				task.hookDef.ifChanged &&
				task.hookDef.ifChanged.length > 0
			) {
				const cacheKey = getCacheKeyForDirectory(
					task.hookName,
					directory,
					projectRoot,
				);
				const commandHash = createHash("sha256").update(command).digest("hex");
				await trackFilesAsync(
					task.plugin,
					cacheKey,
					directory,
					task.hookDef.ifChanged,
					task.pluginRoot,
					{
						logger: logger ?? undefined,
						directory: relativePath,
						commandHash,
					},
				);
			}

			logger?.logHookResult(
				task.plugin,
				task.hookName,
				options.hookType,
				relativePath,
				false,
				result.duration,
				0,
				true,
				result.output.trim(),
				undefined,
				hookRunId,
				task.hookDef.ifChanged,
				command,
			);
			cliLog(
				`✅ hook_result: ${task.plugin}/${task.hookName} passed in ${relativePath} (${formatDuration(result.duration)})`,
				"green",
			);

			return {
				plugin: task.plugin,
				hook: task.hookName,
				directory: relativePath,
				success: true,
				output: result.output.trim(),
				duration: result.duration,
			};
		}

		// Hook completed but failed
		logger?.logHookResult(
			task.plugin,
			task.hookName,
			options.hookType,
			relativePath,
			false,
			result.duration,
			result.exitCode,
			false,
			result.output.trim(),
			result.error.trim(),
			hookRunId,
			task.hookDef.ifChanged,
			command,
		);
		cliLog(
			`❌ hook_result: ${task.plugin}/${task.hookName} failed in ${relativePath} (${formatDuration(result.duration)})`,
			"red",
		);

		return {
			plugin: task.plugin,
			hook: task.hookName,
			directory: relativePath,
			success: false,
			output: result.output.trim(),
			error: result.error.trim(),
			duration: result.duration,
		};
	}

	// For non-Stop hooks: Use synchronous execution (blocking is fine)
	try {
		const output = execSync(command, {
			cwd: directory,
			encoding: "utf-8",
			timeout: 300000, // 5 minute timeout
			input: payloadJson,
			shell: "/bin/bash",
			env: {
				...process.env,
				...hookEnv,
			},
		});

		// Update cache on success
		if (
			options.cache &&
			task.hookDef.ifChanged &&
			task.hookDef.ifChanged.length > 0
		) {
			const cacheKey = getCacheKeyForDirectory(
				task.hookName,
				directory,
				projectRoot,
			);
			const commandHash = createHash("sha256").update(command).digest("hex");
			await trackFilesAsync(
				task.plugin,
				cacheKey,
				directory,
				task.hookDef.ifChanged,
				task.pluginRoot,
				{
					logger: logger ?? undefined,
					directory: relativePath,
					commandHash,
				},
			);
		}

		const duration = Date.now() - startTime;

		logger?.logHookResult(
			task.plugin,
			task.hookName,
			options.hookType,
			relativePath,
			false,
			duration,
			0,
			true,
			output.trim(),
			undefined,
			hookRunId,
			task.hookDef.ifChanged,
			command,
		);
		cliLog(
			`✅ hook_result: ${task.plugin}/${task.hookName} passed in ${relativePath} (${formatDuration(duration)})`,
			"green",
		);

		return {
			plugin: task.plugin,
			hook: task.hookName,
			directory: relativePath,
			success: true,
			output: output.trim(),
			duration,
		};
	} catch (error: unknown) {
		const stderr = (error as { stderr?: Buffer })?.stderr?.toString() || "";
		const stdout = (error as { stdout?: Buffer })?.stdout?.toString() || "";
		const exitCode = (error as { status?: number })?.status ?? 1;
		const duration = Date.now() - startTime;

		logger?.logHookResult(
			task.plugin,
			task.hookName,
			options.hookType,
			relativePath,
			false,
			duration,
			exitCode,
			false,
			stdout.trim(),
			stderr.trim(),
			hookRunId,
			task.hookDef.ifChanged,
			command,
		);
		cliLog(
			`❌ hook_result: ${task.plugin}/${task.hookName} failed in ${relativePath} (${formatDuration(duration)})`,
			"red",
		);

		return {
			plugin: task.plugin,
			hook: task.hookName,
			directory: relativePath,
			success: false,
			output: stdout.trim(),
			error: stderr.trim(),
			duration,
		};
	} finally {
		if (slotHandle) {
			await slotHandle.release();
		}
	}
}

/**
 * Main orchestration function
 */
async function orchestrate(
	eventType: string,
	options: {
		cache: boolean;
		checkpoints: boolean;
		verbose: boolean;
		failFast: boolean;
	},
): Promise<void> {
	const projectRoot = process.cwd();

	// Read stdin payload or generate CLI payload
	const stdinPayload = readStdinPayload();
	const cliMode = !stdinPayload;

	// Use stdin payload or generate a CLI payload with proper structure
	const payload: HookPayload =
		stdinPayload || generateCliPayload(eventType, projectRoot);

	// Validate event type matches payload (only for real stdin payloads)
	if (
		stdinPayload?.hook_event_name &&
		stdinPayload.hook_event_name !== eventType
	) {
		console.error(
			`Event mismatch: orchestrate called with "${eventType}" ` +
				`but stdin contains "${stdinPayload.hook_event_name}"`,
		);
		process.exit(1);
	}

	// Session ID is always available (from stdin or generated CLI payload)
	// Fallback to generating one if somehow missing (shouldn't happen)
	const sessionId = payload.session_id || `cli-${randomUUID()}`;
	initEventLogger(sessionId, {}, projectRoot);

	if (isDebugMode()) {
		console.error(
			`${colors.dim}[orchestrate]${colors.reset} eventType=${colors.cyan}${eventType}${colors.reset} session_id=${colors.magenta}${sessionId || "(none)"}${colors.reset}`,
		);
	}

	// Discover all hook tasks for this event
	const tasks = discoverHookTasks(eventType, payload, projectRoot);

	if (tasks.length === 0) {
		if (cliMode) {
			console.error(
				`${colors.yellow}No hooks found for event type "${eventType}"${colors.reset}`,
			);
		}
		return;
	}

	if (isDebugMode()) {
		console.error(
			`${colors.dim}[orchestrate]${colors.reset} Found ${colors.bold}${tasks.length}${colors.reset} hook tasks for ${colors.cyan}${eventType}${colors.reset}`,
		);
	}

	// Resolve dependencies into execution batches
	const batches = resolveDependencies(tasks);

	if (isDebugMode()) {
		console.error(
			`${colors.dim}[orchestrate]${colors.reset} Resolved into ${colors.bold}${batches.length}${colors.reset} batches`,
		);
		for (let i = 0; i < batches.length; i++) {
			const batchHooks = batches[i].map(
				(t) => `${colors.cyan}${t.plugin}/${t.hookName}${colors.reset}`,
			);
			console.error(
				`  ${colors.dim}Batch ${i + 1}:${colors.reset} ${batchHooks.join(", ")}`,
			);
		}
	}

	const allResults: HookResult[] = [];
	const outputs: string[] = [];
	let hasFailures = false;
	let aborted = false; // Abort flag for fail-fast

	// Execute batches sequentially, hooks within batch in parallel
	for (const batch of batches) {
		// Check abort flag before starting a batch
		if (aborted) break;
		// Run before_all for each hook in the batch (if configured)
		for (const task of batch) {
			const hookSettings = getPluginHookSettings(task.plugin, task.hookName);
			if (hookSettings?.before_all) {
				const beforeAllCmd = resolveHanCommand(hookSettings.before_all);
				if (options.verbose) {
					console.log(
						`\n[${task.plugin}/${task.hookName}] Running before_all:`,
					);
					console.log(`  $ ${beforeAllCmd}\n`);
				}
				try {
					execSync(beforeAllCmd, {
						encoding: "utf-8",
						timeout: 60000,
						stdio: options.verbose ? "inherit" : ["pipe", "pipe", "pipe"],
						shell: "/bin/bash",
						cwd: projectRoot,
						env: {
							...process.env,
							CLAUDE_PROJECT_DIR: projectRoot,
							CLAUDE_PLUGIN_ROOT: task.pluginRoot,
						},
					});
				} catch (error: unknown) {
					const stderr =
						(error as { stderr?: Buffer })?.stderr?.toString() || "";
					console.error(
						`\n❌ before_all failed for ${task.plugin}/${task.hookName}:\n${stderr}`,
					);
					hasFailures = true;
				}
			}
		}

		// Build list of all task/directory combinations for this batch
		const pendingTasks: Array<{ task: HookTask; directory: string }> = [];
		for (const task of batch) {
			for (const directory of task.directories) {
				pendingTasks.push({ task, directory });
			}
		}

		// Execute tasks sequentially with fail-fast
		const batchResults: HookResult[] = [];
		let taskIndex = 0;

		// Helper to schedule the next task if not aborted
		const scheduleNext = (): Promise<HookResult> | null => {
			if (aborted && options.failFast) return null;
			if (taskIndex >= pendingTasks.length) return null;

			const { task, directory } = pendingTasks[taskIndex++];
			const relativePath =
				directory === projectRoot
					? "."
					: directory.replace(`${projectRoot}/`, "");

			const promise = (async (): Promise<HookResult> => {
				// Double-check abort flag (may have changed while waiting for slot)
				if (aborted && options.failFast) {
					return {
						plugin: task.plugin,
						hook: task.hookName,
						directory: relativePath,
						success: true,
						skipped: true,
						skipReason: "aborted due to earlier failure",
						duration: 0,
					};
				}

				const result = await executeHookInDirectory(
					task,
					directory,
					projectRoot,
					payload,
					{
						...options,
						cliMode,
						sessionId,
						hookType: eventType,
						isStopHook: eventType === "Stop",
					},
				);

				// Set abort flag on failure
				if (!result.success && !result.skipped && options.failFast) {
					aborted = true;
					if (isDebugMode()) {
						console.error(
							`${colors.red}[fail-fast]${colors.reset} Aborting due to failure in ${task.plugin}/${task.hookName}`,
						);
					}
				}

				return result;
			})();

			return promise;
		};

		// Execute tasks sequentially (execSync blocks, so no real parallelism anyway)
		// This ensures fail-fast works correctly - no new tasks start after failure
		while (taskIndex < pendingTasks.length && (!aborted || !options.failFast)) {
			const p = scheduleNext();
			if (!p) break;

			const result = await p;
			batchResults.push(result);
		}

		// Mark remaining tasks as skipped if aborted
		while (taskIndex < pendingTasks.length) {
			const { task, directory } = pendingTasks[taskIndex++];
			const relativePath =
				directory === projectRoot
					? "."
					: directory.replace(`${projectRoot}/`, "");
			batchResults.push({
				plugin: task.plugin,
				hook: task.hookName,
				directory: relativePath,
				success: true,
				skipped: true,
				skipReason: "aborted due to earlier failure",
				duration: 0,
			});
		}
		allResults.push(...batchResults);

		// Check for failures
		const failures = batchResults.filter((r) => !r.success && !r.skipped);
		if (failures.length > 0) {
			hasFailures = true;

			// Report failures
			for (const failure of failures) {
				console.error(
					`\n❌ Hook \`${failure.plugin}/${failure.hook}\` failed in \`${failure.directory}\``,
				);
				// Include stdout if present (some tools output errors to stdout)
				if (failure.output) {
					console.error(failure.output);
				}
				// Include stderr if present
				if (failure.error) {
					console.error(failure.error);
				}
				// If neither, note that there was no output
				if (!failure.output && !failure.error) {
					console.error("(no output)");
				}
			}

			// Fail fast: abort and stop executing remaining batches
			if (options.failFast) {
				aborted = true;
				break;
			}
		}

		// Collect successful outputs
		for (const result of batchResults) {
			if (result.success && result.output && !result.skipped) {
				outputs.push(result.output);
			}
		}
	}

	// Log summary
	const eventLogger = getEventLogger();
	if (eventLogger) {
		const successful = allResults.filter((r) => r.success && !r.skipped).length;
		const skipped = allResults.filter((r) => r.skipped).length;
		const failed = allResults.filter((r) => !r.success).length;

		if (options.verbose) {
			console.log(
				`\nOrchestration complete: ${successful} passed, ${skipped} skipped, ${failed} failed`,
			);
		}

		eventLogger.flush();
	}

	// Output aggregated results
	if (outputs.length > 0) {
		console.log(outputs.join("\n\n"));
	}

	// For Stop hooks only: handle deferred execution and attempt tracking
	if (eventType === "Stop") {
		const deferredHooks = allResults.filter((r) => r.deferred);
		const failedHooks = allResults.filter((r) => !r.success && !r.skipped);
		const isRetryRun = payload.stop_hook_active === true;

		// If this is a retry run, increment attempts for failed hooks and check if stuck
		if (isRetryRun && failedHooks.length > 0) {
			const stuckHooks: Array<{
				plugin: string;
				hookName: string;
				directory: string;
				attempts: number;
				maxAttempts: number;
			}> = [];

			for (const hook of failedHooks) {
				const attemptInfo = hookAttempts.increment(
					sessionId,
					hook.plugin,
					hook.hook,
					hook.directory,
				);

				if (attemptInfo.isStuck) {
					stuckHooks.push({
						plugin: hook.plugin,
						hookName: hook.hook,
						directory: hook.directory,
						attempts: attemptInfo.consecutiveFailures,
						maxAttempts: attemptInfo.maxAttempts,
					});
				}
			}

			// If any hooks are stuck, ask user before continuing
			if (stuckHooks.length > 0) {
				console.error(`The following hooks have failed ${stuckHooks[0].maxAttempts} times:
${stuckHooks.map((h) => `  - ${h.plugin}/${h.hookName} in ${h.directory}`).join("\n")}

Use AskUserQuestion to ask the user: "Would you like to continue trying to fix these hooks?"
If yes, call mcp__plugin_core_han__increase_max_attempts for each stuck hook:
${stuckHooks.map((h) => `  - session_id: "${sessionId}", plugin: "${h.plugin}", hook_name: "${h.hookName}", directory: "${h.directory}"`).join("\n")}
Then retry fixing the issues.`);
				process.exit(2);
			}
		}

		// If we have deferred hooks (queued for background), tell agent to spawn subagent
		if (deferredHooks.length > 0) {
			console.error(`Hooks deferred to background execution:
${deferredHooks.map((h) => `  - ${h.plugin}/${h.hook} (${h.directory})`).join("\n")}

Spawn a subagent to call mcp__plugin_core_han__hook_wait with session_id="${sessionId}".
This is a BLOCKING operation - the subagent will wait until all hooks complete.
After hooks complete, if any failed, the subagent should attempt to fix the issues.`);
			process.exit(2);
		}

		// If we have failed hooks (but not stuck), tell agent to fix them
		if (failedHooks.length > 0) {
			console.error(`Hook validation failed:
${failedHooks.map((h) => `  - ${h.plugin}/${h.hook} in ${h.directory}: ${h.error || h.output || "(no output)"}`).join("\n")}

Spawn a subagent to fix these issues. The subagent should:
1. Fix the reported errors
2. When done, the Stop hook will run again to verify the fixes`);
			process.exit(2);
		}

		// All hooks passed - reset attempt counters for any hooks that previously failed
		for (const result of allResults) {
			if (result.success && !result.skipped) {
				hookAttempts.reset(
					sessionId,
					result.plugin,
					result.hook,
					result.directory,
				);
			}
		}

		// All hooks passed - allow stop (exit 0)
		return;
	}

	// For non-Stop hooks, original behavior
	if (hasFailures) {
		process.exit(2);
	}
}

/**
 * Register the orchestrate command
 */
export function registerHookOrchestrate(hookCommand: Command): void {
	hookCommand
		.command("orchestrate <eventType>")
		.description(
			"Orchestrate all hooks for a given Claude Code event type.\n\n" +
				"This is the central entry point for hook execution. It:\n" +
				"  - Discovers all installed plugins and their hooks\n" +
				"  - Filters hooks by event type (Stop, PreToolUse, etc.)\n" +
				"  - Resolves dependencies between hooks\n" +
				"  - Executes hooks with controlled parallelism\n\n" +
				"Event types: Stop, SubagentStop, PreToolUse, PostToolUse,\n" +
				"             SessionStart, UserPromptSubmit, SubagentStart",
		)
		.option("--no-cache", "Disable caching - force all hooks to run")
		.option("--no-checkpoints", "Disable checkpoint filtering")
		.option("--no-fail-fast", "Continue executing even after failures")
		.option("-v, --verbose", "Show detailed execution output")
		.action(
			async (
				eventType: string,
				opts: {
					cache?: boolean;
					checkpoints?: boolean;
					failFast?: boolean;
					verbose?: boolean;
				},
			) => {
				await orchestrate(eventType, {
					cache: opts.cache !== false,
					checkpoints: opts.checkpoints !== false,
					failFast: opts.failFast !== false,
					verbose: opts.verbose ?? false,
				});
			},
		);
}
