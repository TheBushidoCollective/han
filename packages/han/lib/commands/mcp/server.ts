import { createInterface } from "node:readline";
import {
	isMemoryEnabled,
	isMetricsEnabled,
} from "../../config/han-settings.ts";
import { hookAttempts } from "../../db/index.ts";
import { getOrCreateEventLogger } from "../../events/logger.ts";
import {
	formatMemoryAgentResult,
	type MemoryQueryParams,
	queryMemoryAgent,
} from "../../memory/memory-agent.ts";
import { type BackendPool, createBackendPool } from "./backend-pool.ts";
import { getExposedMcpServers } from "./exposed-tools.ts";
import { captureMemory, type LearnParams } from "./memory.ts";
import { handleToolsCall as handleTaskToolsCall, TASK_TOOLS } from "./task.ts";
import {
	type AvailableHook,
	checkHookNeedsRun,
	discoverAvailableHooks,
	discoverPluginTools,
	executePluginTool,
	generateHookRunDescription,
	type PluginTool,
} from "./tools.ts";

interface JsonRpcRequest {
	jsonrpc: "2.0";
	id?: string | number;
	method: string;
	params?: Record<string, unknown>;
}

interface JsonRpcResponse {
	jsonrpc: "2.0";
	id?: string | number;
	result?: unknown;
	error?: {
		code: number;
		message: string;
		data?: unknown;
	};
}

interface McpToolAnnotations {
	title?: string;
	readOnlyHint?: boolean;
	destructiveHint?: boolean;
	idempotentHint?: boolean;
	openWorldHint?: boolean;
}

interface McpTool {
	name: string;
	description: string;
	annotations?: McpToolAnnotations;
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
}

// Cache discovered tools (for backwards compatibility with exposed tool lookup)
let cachedTools: PluginTool[] | null = null;

function discoverTools(): PluginTool[] {
	if (!cachedTools) {
		cachedTools = discoverPluginTools();
	}
	return cachedTools;
}

// Cache discovered hooks for the consolidated hook_run tool
let cachedHooks: AvailableHook[] | null = null;

function discoverHooks(): AvailableHook[] {
	if (!cachedHooks) {
		cachedHooks = discoverAvailableHooks();
	}
	return cachedHooks;
}

/**
 * Generate the consolidated hook_run tool with dynamic description
 */
export function getHookRunTool(): McpTool | null {
	const hooks = discoverHooks();
	if (hooks.length === 0) {
		return null;
	}

	// Generate enum values for plugin and hook parameters
	const pluginNames = [...new Set(hooks.map((h) => h.plugin))].sort();
	const hookNames = [...new Set(hooks.map((h) => h.hook))].sort();

	return {
		name: "hook_run",
		description: generateHookRunDescription(hooks),
		annotations: {
			title: "Run Plugin Hook",
			readOnlyHint: false, // Hooks may modify files (e.g., formatters)
			destructiveHint: false, // Not destructive - can be safely re-run
			idempotentHint: true, // Safe to run multiple times with same result
			openWorldHint: false, // Works with local files only
		},
		inputSchema: {
			type: "object" as const,
			properties: {
				plugin: {
					type: "string",
					description: `Plugin name. Available: ${pluginNames.join(", ")}`,
					enum: pluginNames,
				},
				hook: {
					type: "string",
					description: `Hook name. Available: ${hookNames.join(", ")}`,
					enum: hookNames,
				},
				session_id: {
					type: "string",
					description:
						"Claude session ID (required). Pass the value of CLAUDE_SESSION_ID from your session.",
				},
				cache: {
					type: "boolean",
					description:
						"Use cached results when files haven't changed. Set to false to force re-run even if no changes detected. Default: true.",
				},
				directory: {
					type: "string",
					description:
						"Limit execution to a specific directory path (relative to project root, e.g., 'packages/core' or 'src'). If omitted, runs in all applicable directories.",
				},
				verbose: {
					type: "boolean",
					description:
						"Show full command output in real-time. Set to true when debugging failures or when you want to see progress. Default: false.",
				},
			},
			required: ["plugin", "hook", "session_id"],
		},
	};
}

// Keep formatToolsForMcp for backwards compatibility (used by some internal tooling)
export function formatToolsForMcp(tools: PluginTool[]): McpTool[] {
	return tools.map((tool) => {
		const title =
			tool.hookName.charAt(0).toUpperCase() + tool.hookName.slice(1);
		const technology = tool.pluginName.replace(/^(jutsu|do|hashi)-/, "");
		const techDisplay =
			technology.charAt(0).toUpperCase() + technology.slice(1);

		return {
			name: tool.name,
			description: tool.description,
			annotations: {
				title: `${title} ${techDisplay}`,
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: true,
				openWorldHint: false,
			},
			inputSchema: {
				type: "object" as const,
				properties: {
					cache: {
						type: "boolean",
						description:
							"Use cached results when files haven't changed. Set to false to force re-run even if no changes detected. Default: true.",
					},
					directory: {
						type: "string",
						description:
							"Limit execution to a specific directory path (relative to project root, e.g., 'packages/core' or 'src'). If omitted, runs in all applicable directories.",
					},
					verbose: {
						type: "boolean",
						description:
							"Show full command output in real-time. Set to true when debugging failures or when you want to see progress. Default: false.",
					},
				},
				required: [],
			},
		};
	});
}

export function handleInitialize(): unknown {
	return {
		protocolVersion: "2024-11-05",
		capabilities: {
			tools: {},
		},
		serverInfo: {
			name: "han",
			version: "1.0.0",
		},
	};
}

// Task tools are imported from ./task.ts (TASK_TOOLS)

// Unified memory tool (auto-routes to Personal, Team, or Rules)
const UNIFIED_MEMORY_TOOLS: McpTool[] = [
	{
		name: "memory",
		description:
			"Query memory with auto-routing. Automatically determines whether to check personal sessions, team knowledge, or project conventions. Use this as the primary entry point for all memory queries. Examples: 'what was I working on?', 'who knows about authentication?', 'how do we handle errors?'",
		annotations: {
			title: "Memory (Unified)",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				question: {
					type: "string",
					description:
						"Any question about your work, the team, or project conventions. The system will automatically route to the appropriate memory layer.",
				},
				session_id: {
					type: "string",
					description:
						"Current Claude session ID. Used to associate queries with the active session context.",
				},
			},
			required: ["question"],
		},
	},
];

// Learn tool - captures learnings to .claude/rules/
const LEARN_TOOLS: McpTool[] = [
	{
		name: "learn",
		description:
			"Capture a learning into project memory. Use this PROACTIVELY when you discover project conventions, commands, gotchas, or patterns worth remembering. Writes to .claude/rules/<domain>.md files that persist across sessions.",
		annotations: {
			title: "Learn",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				content: {
					type: "string",
					description:
						"The learning content in markdown format. Should be concise, actionable, and include context. Example: '# API Rules\\n\\n- Validate all inputs with zod\\n- Return consistent error format'",
				},
				domain: {
					type: "string",
					description:
						"Domain name for the rule file (e.g., 'api', 'testing', 'api/validation'). Can include subdirectories. Creates .claude/rules/<domain>.md",
				},
				paths: {
					type: "array",
					items: { type: "string" },
					description:
						"Optional path patterns for path-specific rules. Example: ['src/api/**/*.ts', 'src/services/**/*.ts']. If provided, rules only apply when editing matching files.",
				},
				append: {
					type: "boolean",
					description:
						"Whether to append to existing file (true, default) or replace it (false).",
				},
				scope: {
					type: "string",
					enum: ["project", "user"],
					description:
						"Where to store the rule. 'project' (default) stores in .claude/rules/ for project-specific rules. 'user' stores in ~/.claude/rules/ for personal preferences across all projects.",
				},
			},
			required: ["content", "domain"],
		},
	},
];

// Keep storage tools - scoped key-value storage
import {
	type Scope as KeepScope,
	clear as keepClear,
	list as keepList,
	load as keepLoad,
	remove as keepRemove,
	save as keepSave,
} from "../keep/storage.ts";

const KEEP_TOOLS: McpTool[] = [
	{
		name: "han_keep_save",
		description:
			"Save content to scoped key-value storage. Use for persisting state across sessions (iteration state, scratchpads, blockers). Scopes: 'branch' (default) for branch-specific state, 'repo' for cross-branch state, 'global' for user-wide preferences.",
		annotations: {
			title: "Save to Keep Storage",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				key: {
					type: "string",
					description:
						"Storage key (filename). Examples: 'intent.md', 'iteration.json', 'scratchpad.md'",
				},
				content: {
					type: "string",
					description: "Content to save",
				},
				scope: {
					type: "string",
					enum: ["global", "repo", "branch"],
					description:
						"Storage scope. 'branch' (default): branch-specific. 'repo': shared across branches. 'global': shared across all repos.",
				},
			},
			required: ["key", "content"],
		},
	},
	{
		name: "han_keep_load",
		description:
			"Load content from scoped key-value storage. Returns null if key doesn't exist.",
		annotations: {
			title: "Load from Keep Storage",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				key: {
					type: "string",
					description: "Storage key to load",
				},
				scope: {
					type: "string",
					enum: ["global", "repo", "branch"],
					description: "Storage scope (default: 'branch')",
				},
			},
			required: ["key"],
		},
	},
	{
		name: "han_keep_list",
		description: "List all keys in a storage scope.",
		annotations: {
			title: "List Keep Storage Keys",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				scope: {
					type: "string",
					enum: ["global", "repo", "branch"],
					description: "Storage scope to list (default: 'branch')",
				},
			},
		},
	},
	{
		name: "han_keep_delete",
		description: "Delete a key from scoped storage.",
		annotations: {
			title: "Delete from Keep Storage",
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				key: {
					type: "string",
					description: "Storage key to delete",
				},
				scope: {
					type: "string",
					enum: ["global", "repo", "branch"],
					description: "Storage scope (default: 'branch')",
				},
			},
			required: ["key"],
		},
	},
	{
		name: "han_keep_clear",
		description: "Clear all keys in a storage scope.",
		annotations: {
			title: "Clear Keep Storage",
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				scope: {
					type: "string",
					enum: ["global", "repo", "branch"],
					description: "Storage scope to clear (default: 'branch')",
				},
			},
		},
	},
];

// Hook management tools for deferred execution
// Note: hook_wait was removed - use `han hook wait <orchestration-id>` CLI command instead
const HOOK_TOOLS: McpTool[] = [
	{
		name: "increase_max_attempts",
		description:
			"Increase the maximum retry attempts for a stuck hook. Use this when a hook keeps failing and you want to give it more chances after fixing the underlying issue.",
		annotations: {
			title: "Increase Hook Retries",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				session_id: {
					type: "string",
					description: "The Claude session ID",
				},
				plugin: {
					type: "string",
					description: "Plugin name (e.g., 'jutsu-biome')",
				},
				hook_name: {
					type: "string",
					description: "Hook name (e.g., 'lint')",
				},
				directory: {
					type: "string",
					description: "Directory where the hook runs",
				},
				increase: {
					type: "number",
					description: "Number of additional attempts to allow (default: 1)",
				},
			},
			required: ["session_id", "plugin", "hook_name", "directory"],
		},
	},
];

// Lazy-load backend pool for exposed MCP servers
let exposedBackendPool: BackendPool | null = null;

function getExposedBackendPool(): BackendPool {
	if (!exposedBackendPool) {
		exposedBackendPool = createBackendPool();
		const exposedServers = getExposedMcpServers();
		for (const server of exposedServers) {
			exposedBackendPool.registerBackend({
				id: server.serverName,
				type: server.type === "http" ? "http" : "stdio",
				command: server.command,
				args: server.args,
				url: server.url,
				env: server.env,
			});
		}
	}
	return exposedBackendPool;
}

// Interface to map prefixed tool names back to server/original name
interface ExposedToolMapping {
	serverId: string;
	originalName: string;
}

// Cache for exposed tools (avoids re-fetching on every tools/list)
let exposedToolMappings: Map<string, ExposedToolMapping> | null = null;
let exposedToolsCache: McpTool[] | null = null;

/**
 * Get tools from all exposed MCP servers with prefixed names
 * Example: context7 server's "resolve-library-id" becomes "context7_resolve-library-id"
 */
async function getExposedTools(): Promise<{
	tools: McpTool[];
	mappings: Map<string, ExposedToolMapping>;
}> {
	// Return cached if available
	if (exposedToolsCache && exposedToolMappings) {
		return { tools: exposedToolsCache, mappings: exposedToolMappings };
	}

	const exposedServers = getExposedMcpServers();
	if (exposedServers.length === 0) {
		exposedToolMappings = new Map();
		exposedToolsCache = [];
		return { tools: [], mappings: new Map() };
	}

	const pool = getExposedBackendPool();
	const allTools: McpTool[] = [];
	const mappings = new Map<string, ExposedToolMapping>();

	for (const server of exposedServers) {
		try {
			const tools = await pool.getTools(server.serverName);
			for (const tool of tools) {
				// Prefix tool name with server name
				const prefixedName = `${server.serverName}_${tool.name}`;
				allTools.push({
					...tool,
					name: prefixedName,
					description: `[${server.serverName}] ${tool.description}`,
				});
				mappings.set(prefixedName, {
					serverId: server.serverName,
					originalName: tool.name,
				});
			}
		} catch (error) {
			// Log error but continue with other servers
			console.error(
				`Failed to get tools from ${server.serverName}:`,
				error instanceof Error ? error.message : String(error),
			);
		}
	}

	exposedToolMappings = mappings;
	exposedToolsCache = allTools;
	return { tools: allTools, mappings };
}

async function handleToolsList(): Promise<unknown> {
	// Use consolidated hook_run tool instead of many individual tools
	const hookRunTool = getHookRunTool();
	const memoryEnabled = isMemoryEnabled();
	const metricsEnabled = isMetricsEnabled();

	// Get exposed tools from backend MCP servers
	const { tools: exposedTools } = await getExposedTools();

	const allTools = [
		// Single consolidated hook_run tool (replaces 30+ individual tools)
		...(hookRunTool ? [hookRunTool] : []),
		...exposedTools,
		// Only include task tools if metrics are enabled
		...(metricsEnabled ? TASK_TOOLS : []),
		// Only include memory tools if memory is enabled
		// Two tools: `memory` (query) and `learn` (write)
		...(memoryEnabled ? UNIFIED_MEMORY_TOOLS : []),
		...(memoryEnabled ? LEARN_TOOLS : []),
		// Hook management tools (always available)
		...HOOK_TOOLS,
		// Keep storage tools (always available)
		...KEEP_TOOLS,
	];
	return {
		tools: allTools,
	};
}

async function handleToolsCall(params: {
	name: string;
	arguments?: Record<string, unknown>;
}): Promise<unknown> {
	const args = params.arguments || {};

	// Check if this is an exposed tool (from backend MCP servers)
	if (exposedToolMappings?.has(params.name)) {
		const mapping = exposedToolMappings.get(params.name);
		if (mapping) {
			const eventLogger = getOrCreateEventLogger();
			const startTime = Date.now();

			// Log exposed tool call event
			const callId = eventLogger?.logExposedToolCall(
				mapping.serverId,
				mapping.originalName,
				params.name,
				args,
			);

			try {
				const pool = getExposedBackendPool();
				const result = await pool.callTool(
					mapping.serverId,
					mapping.originalName,
					args,
				);

				// Log exposed tool result event
				const durationMs = Date.now() - startTime;
				if (callId) {
					eventLogger?.logExposedToolResult(
						mapping.serverId,
						mapping.originalName,
						params.name,
						callId,
						true,
						durationMs,
						result,
					);
				}

				return result;
			} catch (error) {
				const message = error instanceof Error ? error.message : String(error);

				// Log exposed tool error event
				const durationMs = Date.now() - startTime;
				if (callId) {
					eventLogger?.logExposedToolResult(
						mapping.serverId,
						mapping.originalName,
						params.name,
						callId,
						false,
						durationMs,
						undefined,
						message,
					);
				}

				return {
					content: [
						{
							type: "text",
							text: `Error calling ${params.name}: ${message}`,
						},
					],
					isError: true,
				};
			}
		}
	}

	// Check if this is a task tool (metrics)
	const isTaskTool = TASK_TOOLS.some((t) => t.name === params.name);

	if (isTaskTool) {
		// Delegate to task.ts handler which uses the database API
		return await handleTaskToolsCall(params);
	}

	// Check if this is the unified memory tool
	const isUnifiedMemoryTool = UNIFIED_MEMORY_TOOLS.some(
		(t) => t.name === params.name,
	);

	if (isUnifiedMemoryTool) {
		// Block if memory is disabled
		if (!isMemoryEnabled()) {
			return {
				content: [
					{
						type: "text",
						text: "Memory system is disabled. Enable it in han.yml with: memory:\n  enabled: true",
					},
				],
				isError: true,
			};
		}
		try {
			switch (params.name) {
				case "memory": {
					const memoryParams = args as unknown as MemoryQueryParams;
					// Add projectPath from cwd for context-aware plugin discovery
					memoryParams.projectPath = process.cwd();
					const startTime = Date.now();
					const result = await queryMemoryAgent(memoryParams);
					const durationMs = Date.now() - startTime;

					// Log memory query event - derive source from searched layers
					const eventLogger = getOrCreateEventLogger();
					const primarySource =
						result.searchedLayers.length === 1
							? (result.searchedLayers[0] as
									| "personal"
									| "team"
									| "rules"
									| undefined)
							: result.searchedLayers.length > 1
								? ("combined" as "personal" | "team" | "rules" | undefined)
								: undefined;
					eventLogger?.logMemoryQuery(
						memoryParams.question,
						primarySource,
						result.success,
						durationMs,
					);

					const formatted = formatMemoryAgentResult(result);
					return {
						content: [
							{
								type: "text",
								text: formatted,
							},
						],
						isError: !result.success,
					};
				}

				default:
					throw {
						code: -32602,
						message: `Unknown unified memory tool: ${params.name}`,
					};
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text",
						text: `Error executing ${params.name}: ${message}`,
					},
				],
				isError: true,
			};
		}
	}

	// Check if this is a learn tool
	const isLearnTool = LEARN_TOOLS.some((t) => t.name === params.name);

	if (isLearnTool) {
		// Block if memory is disabled
		if (!isMemoryEnabled()) {
			return {
				content: [
					{
						type: "text",
						text: "Memory system is disabled. Enable it in han.yml with: memory:\n  enabled: true",
					},
				],
				isError: true,
			};
		}
		// Handle learn tool
		try {
			const learnParams = args as unknown as LearnParams;
			const result = captureMemory(learnParams);

			// Log memory learn event
			const eventLogger = getOrCreateEventLogger();
			eventLogger?.logMemoryLearn(
				learnParams.domain,
				(learnParams.scope as "project" | "user") || "project",
				result.success,
			);

			return {
				content: [
					{
						type: "text",
						text: result.success
							? `✅ ${result.message}`
							: `❌ ${result.message}`,
					},
				],
				isError: !result.success,
			};
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text",
						text: `Error executing learn: ${message}`,
					},
				],
				isError: true,
			};
		}
	}

	// Handle keep storage tools
	const isKeepTool = KEEP_TOOLS.some((t) => t.name === params.name);

	if (isKeepTool) {
		try {
			const scope = (args.scope as KeepScope) || "branch";

			switch (params.name) {
				case "han_keep_save": {
					const key = args.key as string;
					const content = args.content as string;

					if (!key || content === undefined) {
						return {
							content: [
								{
									type: "text",
									text: "Missing required parameters: key, content",
								},
							],
							isError: true,
						};
					}

					keepSave(scope, key, content);
					return {
						content: [
							{
								type: "text",
								text: `Saved to ${scope}:${key}`,
							},
						],
					};
				}

				case "han_keep_load": {
					const key = args.key as string;

					if (!key) {
						return {
							content: [
								{
									type: "text",
									text: "Missing required parameter: key",
								},
							],
							isError: true,
						};
					}

					const content = keepLoad(scope, key);
					if (content === null) {
						return {
							content: [
								{
									type: "text",
									text: `Key not found: ${scope}:${key}`,
								},
							],
							isError: true,
						};
					}

					return {
						content: [
							{
								type: "text",
								text: content,
							},
						],
					};
				}

				case "han_keep_list": {
					const keys = keepList(scope);
					return {
						content: [
							{
								type: "text",
								text:
									keys.length > 0
										? `Keys in ${scope} scope:\n${keys.join("\n")}`
										: `No keys in ${scope} scope`,
							},
						],
					};
				}

				case "han_keep_delete": {
					const key = args.key as string;

					if (!key) {
						return {
							content: [
								{
									type: "text",
									text: "Missing required parameter: key",
								},
							],
							isError: true,
						};
					}

					const deleted = keepRemove(scope, key);
					return {
						content: [
							{
								type: "text",
								text: deleted
									? `Deleted ${scope}:${key}`
									: `Key not found: ${scope}:${key}`,
							},
						],
						isError: !deleted,
					};
				}

				case "han_keep_clear": {
					const count = keepClear(scope);
					return {
						content: [
							{
								type: "text",
								text: `Cleared ${count} key(s) from ${scope} scope`,
							},
						],
					};
				}

				default:
					throw new Error(`Unknown keep tool: ${params.name}`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text",
						text: `Error executing ${params.name}: ${message}`,
					},
				],
				isError: true,
			};
		}
	}

	// Handle hook management tools (increase_max_attempts)
	const isHookTool = HOOK_TOOLS.some((t) => t.name === params.name);

	if (isHookTool) {
		try {
			switch (params.name) {
				case "increase_max_attempts": {
					const sessionId = args.session_id as string;
					const plugin = args.plugin as string;
					const hookName = args.hook_name as string;
					const directory = args.directory as string;
					const increase = (args.increase as number) || 1;

					if (!sessionId || !plugin || !hookName || !directory) {
						return {
							content: [
								{
									type: "text",
									text: "Missing required parameters: session_id, plugin, hook_name, directory",
								},
							],
							isError: true,
						};
					}

					hookAttempts.increaseMaxAttempts(
						sessionId,
						plugin,
						hookName,
						directory,
						increase,
					);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(
									{
										success: true,
										message: `Increased max attempts by ${increase} for ${plugin}/${hookName}`,
										plugin,
										hook_name: hookName,
										directory,
									},
									null,
									2,
								),
							},
						],
					};
				}

				default:
					throw new Error(`Unknown hook tool: ${params.name}`);
			}
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{
						type: "text",
						text: `Error executing ${params.name}: ${message}`,
					},
				],
				isError: true,
			};
		}
	}

	// Handle consolidated hook_run tool - checks cache first, returns CLI command if execution needed
	if (params.name === "hook_run") {
		const plugin = args.plugin as string | undefined;
		const hook = args.hook as string | undefined;
		// Get session_id from args (MCP servers don't have access to Claude Code environment)
		const sessionId = args.session_id as string | undefined;
		const cache = args.cache !== false; // Default to true
		const verbose = args.verbose === true;
		const directory =
			typeof args.directory === "string" ? args.directory : undefined;

		// Validate required parameters
		if (!plugin || !hook) {
			// Return helpful list of available hooks
			const hooks = discoverHooks();
			const hookList = hooks
				.map((h) => `  ${h.plugin}/${h.hook}`)
				.slice(0, 20)
				.join("\n");
			return {
				content: [
					{
						type: "text",
						text: `Missing required parameters: plugin and hook.\n\nAvailable hooks (first 20):\n${hookList}\n\nExample: hook_run({ plugin: "jutsu-biome", hook: "lint" })`,
					},
				],
				isError: true,
			};
		}

		// If caching is enabled, check if we can skip execution
		if (cache && sessionId) {
			try {
				const checkResult = await checkHookNeedsRun(plugin, hook, {
					sessionId,
					directory,
					checkSessionChangesOnly: true,
				});

				// If no changes needed, return fast feedback
				if (!checkResult.needsRun) {
					return {
						content: [
							{
								type: "text",
								text: checkResult.message,
							},
						],
					};
				}
			} catch (error) {
				// On error, fall through to return CLI command
				console.debug(
					`Cache check failed: ${error instanceof Error ? error.message : String(error)}`,
				);
			}
		}

		// Build the CLI command for execution
		const cmdParts = ["han", "hook", "run", plugin, hook];
		if (sessionId) {
			cmdParts.push(`--session-id=${sessionId}`);
		}
		if (!cache) {
			cmdParts.push("--no-cache");
		}
		if (verbose) {
			cmdParts.push("--verbose");
		}
		if (directory) {
			cmdParts.push(`--only=${directory}`);
		}
		const cliCommand = cmdParts.join(" ");

		// Get hook metadata for context
		const hookInfo = discoverHooks().find(
			(h) => h.plugin === plugin && h.hook === hook,
		);
		const hookDesc = hookInfo?.description.split(".")[0] || `${plugin}/${hook}`;

		return {
			content: [
				{
					type: "text",
					text: `**Run this command via Bash tool for real-time output:**

\`\`\`bash
${cliCommand}
\`\`\`

**Hook:** ${hookDesc}

Execute the command above using the Bash tool to see live output and allow the user to follow progress.`,
				},
			],
		};
	}

	// Handle legacy hook tools (for backwards compatibility during transition)
	const tools = discoverTools();
	const tool = tools.find((t) => t.name === params.name);

	if (!tool) {
		throw {
			code: -32602,
			message: `Unknown tool: ${params.name}`,
		};
	}

	const cache = args.cache !== false; // Default to true for MCP
	const verbose = args.verbose === true;
	const failFast = false; // Always false - MCP tools run independently without cross-tool fail-fast
	const directory =
		typeof args.directory === "string" ? args.directory : undefined;

	try {
		const result = await executePluginTool(tool, {
			cache,
			verbose,
			failFast,
			directory,
		});

		let outputText = result.output;

		// If caching is enabled and output suggests no changes/skipped,
		// add a helpful suggestion to retry without cache
		if (cache && result.success) {
			const lowerOutput = outputText.toLowerCase();
			const hasNoChanges =
				lowerOutput.includes("skipped") ||
				lowerOutput.includes("no changes") ||
				lowerOutput.includes("unchanged") ||
				lowerOutput.includes("up to date");

			if (hasNoChanges) {
				outputText +=
					"\n\n💡 Tip: Files appear unchanged. To force re-run, use cache=false.";
			}
		}

		return {
			content: [
				{
					type: "text",
					text: outputText,
				},
			],
			isError: !result.success,
		};
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return {
			content: [
				{
					type: "text",
					text: `Error executing ${params.name}: ${message}`,
				},
			],
			isError: true,
		};
	}
}

async function handleRequest(
	request: JsonRpcRequest,
): Promise<JsonRpcResponse> {
	try {
		let result: unknown;

		switch (request.method) {
			case "initialize":
				result = handleInitialize();
				break;
			case "initialized":
				// Notification, no response needed
				return { jsonrpc: "2.0", id: request.id, result: {} };
			case "ping":
				// Simple ping/pong for health checks
				result = {};
				break;
			case "tools/list":
				result = await handleToolsList();
				break;
			case "tools/call":
				result = await handleToolsCall(
					request.params as {
						name: string;
						arguments?: Record<string, unknown>;
					},
				);
				break;
			default:
				throw {
					code: -32601,
					message: `Method not found: ${request.method}`,
				};
		}

		return {
			jsonrpc: "2.0",
			id: request.id,
			result,
		};
	} catch (error) {
		const errorObj =
			typeof error === "object" && error !== null && "code" in error
				? (error as { code: number; message: string })
				: { code: -32603, message: String(error) };

		return {
			jsonrpc: "2.0",
			id: request.id,
			error: errorObj,
		};
	}
}

function sendResponse(response: JsonRpcResponse): void {
	const json = JSON.stringify(response);
	process.stdout.write(`${json}\n`);
}

export async function startMcpServer(): Promise<void> {
	// Setup signal handlers for graceful shutdown
	process.on("SIGINT", () => process.exit(0));
	process.on("SIGTERM", () => process.exit(0));

	// Ensure coordinator is running to keep database indexed during session
	try {
		const { ensureCoordinator } = await import("../coordinator/daemon.ts");
		await ensureCoordinator();
	} catch (_err) {
		// Log but don't fail - MCP can operate without coordinator for basic operations
		console.error("[mcp] Warning: Failed to start coordinator");
	}

	const rl = createInterface({
		input: process.stdin,
		terminal: false,
	});

	for await (const line of rl) {
		if (!line.trim()) continue;

		try {
			const request = JSON.parse(line) as JsonRpcRequest;
			const response = await handleRequest(request);

			// Only send response if there's an id (not a notification)
			if (request.id !== undefined) {
				sendResponse(response);
			}
		} catch (error) {
			// JSON parse error
			sendResponse({
				jsonrpc: "2.0",
				error: {
					code: -32700,
					message: "Parse error",
					data: String(error),
				},
			});
		}
	}
}
