import { execSync } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readdirSync,
	readFileSync,
	statSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import type { Command } from "commander";
import {
	getClaudeConfigDir,
	getMergedPluginsAndMarketplaces,
	getSettingsPaths,
	type MarketplaceConfig,
	readSettingsFile,
} from "../../config/claude-settings.ts";

// Lazy import to avoid loading native module for commands that don't need it
// (e.g., `han hook reference` doesn't need the native module)
let _sessionFileChanges:
	| typeof import("../../db/index.ts").sessionFileChanges
	| null = null;
async function getSessionFileChanges() {
	if (!_sessionFileChanges) {
		const db = await import("../../db/index.ts");
		_sessionFileChanges = db.sessionFileChanges;
	}
	return _sessionFileChanges;
}

import { getEventLogger, initEventLogger } from "../../events/logger.ts";
import { getClaudeProjectPath } from "../../memory/paths.ts";
import { getPluginNameFromRoot, isDebugMode } from "../../shared.ts";
import { recordHookExecution as recordOtelHookExecution } from "../../telemetry/index.ts";

/**
 * Get the han temp directory for stderr output files
 */
function getHanStderrDir(): string {
	const dir = join(tmpdir(), "han-hook-stderr");
	mkdirSync(dir, { recursive: true });
	return dir;
}

/**
 * Write stderr to a temp file and return the path
 */
function writeStderrToFile(
	hookType: string,
	hookName: string,
	pluginName: string,
	stderr: string,
): string {
	const timestamp = Date.now();
	const sanitizedPlugin = pluginName.replace(/[^a-zA-Z0-9-]/g, "_");
	const sanitizedHook = hookName.replace(/[^a-zA-Z0-9-]/g, "_");
	const filename = `${hookType}_${sanitizedPlugin}_${sanitizedHook}_${timestamp}.txt`;
	const filepath = join(getHanStderrDir(), filename);
	writeFileSync(filepath, stderr, "utf-8");
	return filepath;
}

/**
 * Infer session ID from the most recently modified Claude transcript file.
 * This is a fallback when session_id isn't available via stdin.
 *
 * Looks for .jsonl files (excluding -han.jsonl) in the Claude project directory
 * for the current working directory, returns the session ID of the most recent one.
 */
function inferSessionIdFromTranscripts(): string | null {
	try {
		const projectDir = getClaudeProjectPath(process.cwd());
		if (!existsSync(projectDir)) {
			return null;
		}

		// Find all .jsonl files that aren't han events files
		const files = readdirSync(projectDir)
			.filter((f) => f.endsWith(".jsonl") && !f.endsWith("-han.jsonl"))
			.map((f) => ({
				name: f,
				path: join(projectDir, f),
				mtime: statSync(join(projectDir, f)).mtime.getTime(),
			}))
			.sort((a, b) => b.mtime - a.mtime); // Most recent first

		if (files.length === 0) {
			return null;
		}

		// Extract session ID from filename (format: {session-id}.jsonl)
		const mostRecent = files[0];
		const sessionId = basename(mostRecent.name, ".jsonl");

		// Validate it looks like a session ID (UUID format or similar)
		if (sessionId && sessionId.length >= 8) {
			return sessionId;
		}

		return null;
	} catch {
		return null;
	}
}

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
		const { fstatSync } = require("node:fs");
		const stat = fstatSync(0);
		// Accept any non-TTY stdin type (file, FIFO, socket, pipe)
		// Socket is used when parent process passes data via execSync's input option
		return stat.isFile() || stat.isFIFO() || stat.isSocket();
	} catch {
		return false;
	}
}

/**
 * Read raw stdin content from Claude Code hooks (for piping to child hooks)
 */
function readStdinRaw(): string | null {
	try {
		// Only read if stdin has data available
		if (!hasStdinData()) {
			return null;
		}
		// Read stdin synchronously (file descriptor 0)
		const stdin = readFileSync(0, "utf-8");
		if (stdin.trim()) {
			return stdin;
		}
	} catch {
		// stdin not available - this is fine
	}
	return null;
}

// Cache the raw stdin content so it's only read once
let cachedStdinRaw: string | null | undefined;
function getStdinRaw(): string | null {
	if (cachedStdinRaw === undefined) {
		cachedStdinRaw = readStdinRaw();
	}
	return cachedStdinRaw;
}

/**
 * Hook payload structure from Claude Code
 */
interface HookPayload {
	session_id?: string;
	hook_event_name?: string;
	agent_id?: string;
	agent_type?: string;
}

/**
 * Parse stdin to get full hook payload
 */
function getStdinPayload(): HookPayload | null {
	const raw = getStdinRaw();
	if (!raw) return null;
	try {
		return JSON.parse(raw) as HookPayload;
	} catch {
		return null;
	}
}

/**
 * Parse stdin to extract session_id for metrics reporting
 */
function _getSessionIdFromStdin(): string | undefined {
	const payload = getStdinPayload();
	return payload?.session_id;
}

/**
 * Hook definition from hooks.json
 */
interface HookEntry {
	type: "command" | "prompt";
	command?: string;
	prompt?: string;
	timeout?: number;
}

interface HookGroup {
	hooks: HookEntry[];
}

interface PluginHooks {
	hooks: Record<string, HookGroup[]>;
}

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
export function resolveToAbsolute(path: string): string {
	if (path.startsWith("/")) {
		return path;
	}
	return join(process.cwd(), path);
}

/**
 * Get plugin directory based on plugin name, marketplace, and marketplace config
 */
function getPluginDir(
	pluginName: string,
	marketplace: string,
	marketplaceConfig: MarketplaceConfig | undefined,
): string | null {
	// If marketplace config specifies a directory source, use that path
	if (marketplaceConfig?.source?.source === "directory") {
		const directoryPath = marketplaceConfig.source.path;
		if (directoryPath) {
			const absolutePath = resolveToAbsolute(directoryPath);
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
 * Load a plugin's hooks.json
 */
function loadPluginHooks(
	pluginName: string,
	marketplace: string,
	marketplaceConfig: MarketplaceConfig | undefined,
): { hooks: PluginHooks; pluginRoot: string } | null {
	const pluginRoot = getPluginDir(pluginName, marketplace, marketplaceConfig);
	if (!pluginRoot) {
		return null;
	}

	const hooksPath = join(pluginRoot, "hooks", "hooks.json");
	if (!existsSync(hooksPath)) {
		return null;
	}

	try {
		const content = readFileSync(hooksPath, "utf-8");
		return {
			hooks: JSON.parse(content) as PluginHooks,
			pluginRoot,
		};
	} catch {
		return null;
	}
}

/**
 * Execute a command hook and return its output
 * Also reports execution to metrics and logs events
 */
function executeCommandHook(
	command: string,
	pluginRoot: string,
	timeout: number,
	hookType: string,
	hookName: string,
	noCache = false,
	noCheckpoints = false,
): string | null {
	const startTime = Date.now();
	const pluginName = getPluginNameFromRoot(pluginRoot);
	const eventLogger = getEventLogger();

	// Check if this is a han hook command - those handle their own event logging
	// and may be cached (skip execution), so we shouldn't log here
	const isHanHookCommand = command.startsWith("han hook ");

	// Log hook run event only for non-han-hook commands
	// han hook commands log their own events and may skip due to caching
	const hookRunId = isHanHookCommand
		? undefined
		: eventLogger?.logHookRun(
				pluginName,
				hookName,
				hookType,
				process.cwd(),
				false,
			);

	try {
		// Replace ${CLAUDE_PLUGIN_ROOT} with the actual local plugin path
		const resolvedCommand = command.replace(
			/\$\{CLAUDE_PLUGIN_ROOT\}/g,
			pluginRoot,
		);

		// Get raw stdin content to pipe to child hooks
		const stdinContent = getStdinRaw();
		const payload = getStdinPayload();
		const sessionId = payload?.session_id;
		const agentId = payload?.agent_id;

		// Determine checkpoint context from hook type and payload
		let checkpointType: "session" | "agent" | undefined;
		let checkpointId: string | undefined;

		// Stop hooks use session checkpoint
		if (hookType === "Stop" && sessionId) {
			checkpointType = "session";
			checkpointId = sessionId;
		}
		// SubagentStop hooks use agent checkpoint
		else if (hookType === "SubagentStop" && agentId) {
			checkpointType = "agent";
			checkpointId = agentId;
		}

		const output = execSync(resolvedCommand, {
			encoding: "utf-8",
			timeout,
			stdio: ["pipe", "pipe", "pipe"],
			shell: "/bin/sh",
			cwd: process.cwd(),
			// Pipe the original stdin content to child hooks
			...(stdinContent ? { input: stdinContent } : {}),
			env: {
				...process.env,
				CLAUDE_PLUGIN_ROOT: pluginRoot,
				CLAUDE_PROJECT_DIR: process.cwd(),
				// Pass session ID for event logging
				...(sessionId ? { HAN_SESSION_ID: sessionId } : {}),
				// Disable fail-fast in subprocesses - dispatch handles aggregation
				HAN_NO_FAIL_FAST: "1",
				// Disable cache if --no-cache was passed to dispatch
				...(noCache ? { HAN_NO_CACHE: "1" } : {}),
				// Disable checkpoints if --no-checkpoints was passed to dispatch
				...(noCheckpoints ? { HAN_NO_CHECKPOINTS: "1" } : {}),
				// Pass checkpoint context to hook run commands (unless checkpoints disabled)
				...(!noCheckpoints && checkpointType && checkpointId
					? {
							HAN_CHECKPOINT_TYPE: checkpointType,
							HAN_CHECKPOINT_ID: checkpointId,
						}
					: {}),
			},
		});

		const duration = Date.now() - startTime;

		// Log appropriate event type based on command
		// bash/cat scripts: log as hook_script
		// han hook * commands: they log their own specific events (reference, validation, etc.)
		// Other commands: log as generic hook_result
		const isBashOrCat =
			command.startsWith("bash ") || command.startsWith("cat ");
		// isHanHookCommand already defined at function start

		if (isBashOrCat) {
			eventLogger?.logHookScript(
				pluginName,
				command,
				duration,
				0,
				true,
				output.trim(),
			);
		} else if (!isHanHookCommand) {
			// Only log generic result for non-han-hook commands
			// (han hook commands log their own specific events)
			eventLogger?.logHookResult(
				pluginName,
				hookName,
				hookType,
				process.cwd(),
				false,
				duration,
				0,
				true, // success
				output.trim(),
				undefined, // error
				hookRunId, // correlate with hook_run
			);
		}

		// Report to OTEL telemetry
		recordOtelHookExecution(hookName, true, duration, hookType);

		return output.trim();
	} catch (error: unknown) {
		const duration = Date.now() - startTime;
		const exitCode = (error as { status?: number })?.status || 1;
		const stderr = (error as { stderr?: Buffer })?.stderr?.toString() || "";

		// Log appropriate event type based on command (failure case)
		const isBashOrCat =
			command.startsWith("bash ") || command.startsWith("cat ");
		// isHanHookCommand already defined at function start

		if (isBashOrCat) {
			eventLogger?.logHookScript(
				pluginName,
				command,
				duration,
				exitCode,
				false,
				stderr,
			);
		} else if (!isHanHookCommand) {
			// Only log generic result for non-han-hook commands
			eventLogger?.logHookResult(
				pluginName,
				hookName,
				hookType,
				process.cwd(),
				false,
				duration,
				exitCode,
				false, // success
				undefined, // output
				stderr,
				hookRunId, // correlate with hook_run
			);
		}

		// Report to OTEL telemetry
		recordOtelHookExecution(hookName, false, duration, hookType);

		// For Stop/SubagentStop hooks, write stderr to file and return link
		// This prevents large error output from clogging the agent's context
		if ((hookType === "Stop" || hookType === "SubagentStop") && stderr.trim()) {
			const stderrFile = writeStderrToFile(
				hookType,
				hookName,
				pluginName,
				stderr,
			);
			return `❌ Hook \`${pluginName}/${hookName}\` failed. Output: ${stderrFile}`;
		}

		// Other hook types - silently skip errors for dispatch
		// (we don't want to block the agent on hook failures)
		return null;
	}
}

/**
 * Derive a readable hook name from command string
 */
export function deriveHookName(command: string, pluginName: string): string {
	// Try to extract meaningful name from command
	// Examples:
	// "cat hooks/metrics-tracking.md" -> "metrics-tracking"
	// "npx han hook reference hooks/professional-honesty.md" -> "professional-honesty"
	// "${CLAUDE_PLUGIN_ROOT}/hooks/pre-push-check.sh" -> "pre-push-check"

	const hookFileMatch = command.match(/hooks\/([a-z0-9-]+)\.(md|sh)/);
	if (hookFileMatch) {
		return hookFileMatch[1];
	}

	// Fall back to plugin name
	return pluginName;
}

/**
 * Execute hooks from settings files (not from Han plugins)
 */
function dispatchSettingsHooks(
	hookType: string,
	outputs: string[],
	noCache = false,
	noCheckpoints = false,
): void {
	for (const { path } of getSettingsPaths()) {
		// Check settings.json for hooks
		const settings = readSettingsFile(path);
		if (settings?.hooks) {
			const hookGroups = (settings.hooks as Record<string, unknown>)[hookType];
			if (Array.isArray(hookGroups)) {
				for (const group of hookGroups) {
					if (
						typeof group === "object" &&
						group !== null &&
						"hooks" in group &&
						Array.isArray(group.hooks)
					) {
						for (const hook of group.hooks as HookEntry[]) {
							if (hook.type === "command" && hook.command) {
								const output = executeCommandHook(
									hook.command,
									process.cwd(),
									hook.timeout || 30000,
									hookType,
									"settings-hook",
									noCache,
									noCheckpoints,
								);
								if (output) {
									outputs.push(output);
								}
							}
						}
					}
				}
			}
		}

		// Also check for hooks.json in the same directory
		const hooksJsonPath = path.replace(
			/settings(\.local)?\.json$/,
			"hooks.json",
		);
		if (hooksJsonPath !== path && existsSync(hooksJsonPath)) {
			try {
				const content = readFileSync(hooksJsonPath, "utf-8");
				const hooksJson = JSON.parse(content) as Record<string, unknown>;

				// hooks.json can have hooks at root level or under "hooks" key
				const hooksObj =
					(hooksJson.hooks as Record<string, unknown>) ?? hooksJson;
				const hookGroups = hooksObj[hookType];

				if (Array.isArray(hookGroups)) {
					for (const group of hookGroups) {
						if (
							typeof group === "object" &&
							group !== null &&
							"hooks" in group &&
							Array.isArray(group.hooks)
						) {
							for (const hook of group.hooks as HookEntry[]) {
								if (hook.type === "command" && hook.command) {
									const output = executeCommandHook(
										hook.command,
										process.cwd(),
										hook.timeout || 30000,
										hookType,
										"settings-hook",
										noCache,
										noCheckpoints,
									);
									if (output) {
										outputs.push(output);
									}
								}
							}
						}
					}
				}
			} catch {
				// Invalid JSON, skip
			}
		}
	}
}

/**
 * Check if this hook type should be skipped due to no file changes.
 * Stop and SubagentStop hooks are skipped when no files were modified in the session.
 */
async function shouldSkipDueToNoChanges(
	hookType: string,
	sessionId: string | undefined,
): Promise<boolean> {
	// Only skip Stop-type hooks (validation hooks)
	if (hookType !== "Stop" && hookType !== "SubagentStop") {
		return false;
	}

	// Can't check without a session ID
	if (!sessionId) {
		return false;
	}

	// Allow forcing hooks to run via environment variable
	if (
		process.env.HAN_FORCE_HOOKS === "true" ||
		process.env.HAN_FORCE_HOOKS === "1"
	) {
		return false;
	}

	const sfc = await getSessionFileChanges();
	const hasChanges = await sfc.hasChanges(sessionId);
	return !hasChanges;
}

/**
 * Dispatch hooks of a specific type across all installed plugins.
 * Uses merged settings from all scopes (user, project, local, enterprise).
 *
 * Smart dispatch: Skips Stop hooks when no files were modified in the session.
 */
async function dispatchHooks(
	hookType: string,
	includeSettings = false,
	noCache = false,
	noCheckpoints = false,
): Promise<void> {
	// Allow global disable of all hooks via environment variable
	if (
		process.env.HAN_DISABLE_HOOKS === "true" ||
		process.env.HAN_DISABLE_HOOKS === "1"
	) {
		process.exit(0);
	}

	// Initialize event logger for this session
	// Events are stored alongside Claude transcripts in the project directory
	const payload = getStdinPayload();
	let sessionId = payload?.session_id;

	// Fallback: infer session ID from most recent Claude transcript if not in stdin
	if (!sessionId) {
		sessionId = inferSessionIdFromTranscripts() ?? undefined;
	}

	if (isDebugMode()) {
		console.error(
			`[dispatch] hookType=${hookType} session_id=${sessionId || "(none)"} (from stdin: ${!!payload?.session_id})`,
		);
	}

	if (sessionId) {
		initEventLogger(sessionId, {}, process.cwd());
	}

	// Smart dispatch: Skip Stop hooks if no files were modified
	if (await shouldSkipDueToNoChanges(hookType, payload?.session_id)) {
		// No files modified - skip validation hooks silently
		return;
	}

	// Note: Checkpoint capture at session/agent start has been removed.
	// Session filtering now uses the database-backed session_file_changes table.

	const outputs: string[] = [];

	// Dispatch settings hooks if --all is specified
	if (includeSettings) {
		dispatchSettingsHooks(hookType, outputs, noCache, noCheckpoints);
	}

	// Dispatch Han plugin hooks
	const { plugins, marketplaces } = getMergedPluginsAndMarketplaces();

	for (const [pluginName, marketplace] of plugins.entries()) {
		const marketplaceConfig = marketplaces.get(marketplace);
		const result = loadPluginHooks(pluginName, marketplace, marketplaceConfig);

		if (!result?.hooks?.hooks?.[hookType]) {
			continue;
		}

		const { hooks: pluginHooks, pluginRoot } = result;
		const hookGroups = pluginHooks.hooks[hookType];

		for (const group of hookGroups) {
			for (const hook of group.hooks) {
				// Only execute command hooks - prompt hooks are handled by Claude Code directly
				if (hook.type === "command" && hook.command) {
					// Derive hook name from command or use plugin name
					const hookName = deriveHookName(hook.command, pluginName);

					const output = executeCommandHook(
						hook.command,
						pluginRoot,
						hook.timeout || 30000,
						hookType,
						hookName,
						noCache,
						noCheckpoints,
					);
					if (output) {
						outputs.push(output);
					}
				}
			}
		}
	}

	// Flush any buffered events before exiting
	const eventLogger = getEventLogger();
	if (eventLogger) {
		eventLogger.flush();
	}

	// Output aggregated results
	if (outputs.length > 0) {
		console.log(outputs.join("\n\n"));
	}
}

export function registerHookDispatch(hookCommand: Command): void {
	hookCommand
		.command("dispatch <hookType>")
		.description(
			"Dispatch hooks of a specific type across all installed Han plugins.\n" +
				"By default, only runs Han plugin hooks. Use --all to include settings hooks.\n\n" +
				"This is a workaround for Claude Code bug #12151 where plugin hook output\n" +
				"is not passed to the agent. Add this to ~/.claude/settings.json:\n\n" +
				'  "hooks": {\n' +
				'    "UserPromptSubmit": [{"hooks": [{"type": "command",\n' +
				'      "command": "han hook dispatch UserPromptSubmit"}]}],\n' +
				'    "SessionStart": [{"hooks": [{"type": "command",\n' +
				'      "command": "han hook dispatch SessionStart"}]}]\n' +
				"  }",
		)
		.option(
			"-a, --all",
			"Include hooks from Claude Code settings (not just Han plugins)",
		)
		.option(
			"--no-cache",
			"Disable caching - force all hooks to run regardless of file changes",
		)
		.option(
			"--no-checkpoints",
			"Disable checkpoint filtering - ignore session/agent checkpoint state",
		)
		.action(
			async (
				hookType: string,
				options: { all?: boolean; cache?: boolean; checkpoints?: boolean },
			) => {
				// Commander uses --no-X pattern which sets cache/checkpoints to false when used
				await dispatchHooks(
					hookType,
					options.all ?? false,
					options.cache === false,
					options.checkpoints === false,
				);
				// Explicitly exit to avoid hanging on open handles
				process.exit(0);
			},
		);
}
