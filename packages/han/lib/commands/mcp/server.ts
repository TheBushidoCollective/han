import { createInterface } from "node:readline";
import { getOrCreateEventLogger } from "../../events/logger.ts";
import { isMemoryEnabled, isMetricsEnabled } from "../../han-settings.ts";
import {
	formatMemoryAgentResult,
	type MemoryQueryParams,
	queryMemoryAgent,
} from "../../memory/memory-agent.ts";
import { type BackendPool, createBackendPool } from "./backend-pool.ts";
import { getExposedMcpServers } from "./capability-registry.ts";
import { captureMemory, type LearnParams } from "./memory.ts";
import {
	getOrchestrator,
	getOrchestratorConfig,
	type Orchestrator,
} from "./orchestrator.ts";
import { handleToolsCall as handleTaskToolsCall, TASK_TOOLS } from "./task.ts";
import {
	discoverPluginTools,
	executePluginTool,
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

// Cache discovered tools
let cachedTools: PluginTool[] | null = null;

function discoverTools(): PluginTool[] {
	if (!cachedTools) {
		cachedTools = discoverPluginTools();
	}
	return cachedTools;
}

export function formatToolsForMcp(tools: PluginTool[]): McpTool[] {
	return tools.map((tool) => {
		// Generate a human-readable title from the tool name
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
				readOnlyHint: false, // These tools may modify files (e.g., formatters)
				destructiveHint: false, // Not destructive - can be safely re-run
				idempotentHint: true, // Safe to run multiple times with same result
				openWorldHint: false, // Works with local files only
			},
			inputSchema: {
				type: "object" as const,
				properties: {
					cache: {
						type: "boolean",
						description:
							"Use cached results when files haven't changed. Set to false to force re-run even if no changes detected. Default: true. Tip: If the result says 'no changes', you can retry with cache=false to run anyway.",
					},
					directory: {
						type: "string",
						description:
							"Limit execution to a specific directory path (relative to project root, e.g., 'packages/core' or 'src'). If omitted, runs in all applicable directories.",
					},
					verbose: {
						type: "boolean",
						description:
							"Show full command output in real-time. Set to true when debugging failures or when you want to see progress. Default: false (output captured and returned).",
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

// Workflow async tools definition (status, cancel, list)
const WORKFLOW_ASYNC_TOOLS: McpTool[] = [
	{
		name: "han_workflow_status",
		description:
			"Check the status of an async workflow. Returns progress, partial results, and whether to check again. Use this to poll for updates on workflows started with async=true.",
		annotations: {
			title: "Workflow Status",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				workflow_id: {
					type: "string",
					description:
						"The workflow ID returned from han_workflow with async=true",
				},
			},
			required: ["workflow_id"],
		},
	},
	{
		name: "han_workflow_cancel",
		description:
			"Cancel a running async workflow. Returns success if the workflow was cancelled.",
		annotations: {
			title: "Cancel Workflow",
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: false,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				workflow_id: {
					type: "string",
					description: "The workflow ID to cancel",
				},
			},
			required: ["workflow_id"],
		},
	},
	{
		name: "han_workflow_list",
		description:
			"List all active (running or pending) workflows. Useful for debugging or monitoring multiple concurrent workflows.",
		annotations: {
			title: "List Workflows",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {},
		},
	},
];

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

// Lazy-load orchestrator for han_workflow tool
let orchestratorInstance: Orchestrator | null = null;
let orchestratorInitPromise: Promise<Orchestrator> | null = null;

async function getOrchestratorInstance(): Promise<Orchestrator> {
	if (orchestratorInstance) {
		return orchestratorInstance;
	}
	if (!orchestratorInitPromise) {
		orchestratorInitPromise = getOrchestrator().then((orch) => {
			orchestratorInstance = orch;
			return orch;
		});
	}
	return orchestratorInitPromise;
}

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
	const hookTools = formatToolsForMcp(discoverTools());
	const memoryEnabled = isMemoryEnabled();
	const metricsEnabled = isMetricsEnabled();
	const orchestratorConfig = getOrchestratorConfig();

	// Get exposed tools from backend MCP servers
	const { tools: exposedTools } = await getExposedTools();

	// Get orchestrator workflow tools if enabled
	const orchestratorTools: McpTool[] = [];
	if (orchestratorConfig.enabled && orchestratorConfig.workflow.enabled) {
		const orchestrator = await getOrchestratorInstance();
		orchestratorTools.push(orchestrator.getWorkflowTool());
		// Also add async workflow tools (status, cancel, list)
		orchestratorTools.push(...WORKFLOW_ASYNC_TOOLS);
	}

	const allTools = [
		...hookTools,
		...exposedTools,
		...orchestratorTools,
		// Only include task tools if metrics are enabled
		...(metricsEnabled ? TASK_TOOLS : []),
		// Only include memory tools if memory is enabled
		// Two tools: `memory` (query) and `learn` (write)
		...(memoryEnabled ? UNIFIED_MEMORY_TOOLS : []),
		...(memoryEnabled ? LEARN_TOOLS : []),
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

	// Check if this is a workflow tool (orchestrator)
	const workflowTools = [
		"han_workflow",
		"han_workflow_status",
		"han_workflow_cancel",
		"han_workflow_list",
	];
	if (workflowTools.includes(params.name)) {
		const orchestratorConfig = getOrchestratorConfig();
		if (!orchestratorConfig.enabled || !orchestratorConfig.workflow.enabled) {
			return {
				content: [
					{
						type: "text",
						text: "Orchestrator workflow is disabled. Enable it in han.yml with: orchestrator:\n  enabled: true\n  workflow:\n    enabled: true",
					},
				],
				isError: true,
			};
		}

		try {
			const orchestrator = await getOrchestratorInstance();

			switch (params.name) {
				case "han_workflow":
					return await orchestrator.handleWorkflow(args);
				case "han_workflow_status":
					return orchestrator.handleWorkflowStatus(args);
				case "han_workflow_cancel":
					return orchestrator.handleWorkflowCancel(args);
				case "han_workflow_list":
					return orchestrator.handleWorkflowList();
				default:
					throw new Error(`Unknown workflow tool: ${params.name}`);
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

	// Handle hook tools
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
