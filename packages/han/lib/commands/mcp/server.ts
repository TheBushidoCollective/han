import { createInterface } from "node:readline";
import { isMemoryEnabled } from "../../han-settings.ts";
import { JsonlMetricsStorage } from "../../metrics/jsonl-storage.ts";
import type {
	CompleteTaskParams,
	FailTaskParams,
	QueryMetricsParams,
	StartTaskParams,
	UpdateTaskParams,
} from "../../metrics/types.ts";
import { recordTaskCompletion } from "../../telemetry/index.ts";
import { cleanCheckpoints } from "../checkpoint/clean.ts";
import { listCheckpoints } from "../checkpoint/list.ts";
import { captureMemory, type LearnParams } from "./memory.ts";
import {
	formatMemoryResult,
	type MemoryParams,
	queryMemory,
} from "./memory-router.ts";
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

// Lazy-load metrics storage instance
let storage: JsonlMetricsStorage | null = null;

function getStorage(): JsonlMetricsStorage {
	if (!storage) {
		storage = new JsonlMetricsStorage();
	}
	return storage;
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

// Checkpoint tools definition
const CHECKPOINT_TOOLS: McpTool[] = [
	{
		name: "checkpoint_list",
		description:
			"List checkpoints for current project. Shows session and agent checkpoints with creation time and file counts.",
		annotations: {
			title: "List Checkpoints",
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
	{
		name: "checkpoint_clean",
		description:
			"Clean stale checkpoints with optional maxAge parameter. Removes checkpoints older than specified age.",
		annotations: {
			title: "Clean Checkpoints",
			readOnlyHint: false,
			destructiveHint: true,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				maxAge: {
					type: "number",
					description:
						"Maximum age in hours (default: 24). Checkpoints older than this will be removed.",
				},
			},
		},
	},
];

// Metrics tools definition
const METRICS_TOOLS: McpTool[] = [
	{
		name: "start_task",
		description:
			"Start tracking a new task. Returns a task_id for future updates. Use this when beginning work on a feature, fix, or refactoring.",
		annotations: {
			title: "Start Task",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				description: {
					type: "string",
					description: "Clear description of the task being performed",
				},
				type: {
					type: "string",
					enum: ["implementation", "fix", "refactor", "research"],
					description: "Type of task being performed",
				},
				estimated_complexity: {
					type: "string",
					enum: ["simple", "moderate", "complex"],
					description: "Optional estimated complexity of the task",
				},
			},
			required: ["description", "type"],
		},
	},
	{
		name: "update_task",
		description:
			"Update a task with progress notes or status changes. Use this to log incremental progress.",
		annotations: {
			title: "Update Task",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				task_id: {
					type: "string",
					description: "The task ID returned from start_task",
				},
				status: {
					type: "string",
					description: "Optional status update",
				},
				notes: {
					type: "string",
					description: "Progress notes or observations",
				},
			},
			required: ["task_id"],
		},
	},
	{
		name: "complete_task",
		description:
			"Mark a task as completed with outcome assessment. Use this when finishing a task successfully or partially.",
		annotations: {
			title: "Complete Task",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				task_id: {
					type: "string",
					description: "The task ID returned from start_task",
				},
				outcome: {
					type: "string",
					enum: ["success", "partial", "failure"],
					description: "Outcome of the task",
				},
				confidence: {
					type: "number",
					minimum: 0,
					maximum: 1,
					description:
						"Confidence level (0-1) in the success of this task. Used for calibration.",
				},
				files_modified: {
					type: "array",
					items: { type: "string" },
					description: "Optional list of files modified during this task",
				},
				tests_added: {
					type: "number",
					description: "Optional count of tests added",
				},
				notes: {
					type: "string",
					description: "Optional completion notes",
				},
			},
			required: ["task_id", "outcome", "confidence"],
		},
	},
	{
		name: "fail_task",
		description:
			"Mark a task as failed with detailed reason and attempted solutions. Use when unable to complete a task.",
		annotations: {
			title: "Fail Task",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				task_id: {
					type: "string",
					description: "The task ID returned from start_task",
				},
				reason: {
					type: "string",
					description: "Reason for failure",
				},
				confidence: {
					type: "number",
					minimum: 0,
					maximum: 1,
					description: "Optional confidence in the failure assessment",
				},
				attempted_solutions: {
					type: "array",
					items: { type: "string" },
					description: "Optional list of solutions that were attempted",
				},
				notes: {
					type: "string",
					description: "Optional additional notes",
				},
			},
			required: ["task_id", "reason"],
		},
	},
	{
		name: "query_metrics",
		description:
			"Query task metrics and performance data. Use this to generate reports or analyze agent performance over time.",
		annotations: {
			title: "Query Metrics",
			readOnlyHint: true,
			destructiveHint: false,
			idempotentHint: true,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				period: {
					type: "string",
					enum: ["day", "week", "month"],
					description: "Optional time period to filter by",
				},
				task_type: {
					type: "string",
					enum: ["implementation", "fix", "refactor", "research"],
					description: "Optional filter by task type",
				},
				outcome: {
					type: "string",
					enum: ["success", "partial", "failure"],
					description: "Optional filter by outcome",
				},
			},
		},
	},
];

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

function handleToolsList(): unknown {
	const hookTools = formatToolsForMcp(discoverTools());
	const memoryEnabled = isMemoryEnabled();

	const allTools = [
		...hookTools,
		...CHECKPOINT_TOOLS,
		...METRICS_TOOLS,
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

	// Check if this is a checkpoint tool
	const isCheckpointTool = CHECKPOINT_TOOLS.some((t) => t.name === params.name);

	if (isCheckpointTool) {
		// Handle checkpoint tools
		try {
			switch (params.name) {
				case "checkpoint_list": {
					// Capture output by temporarily overriding console.log
					const output: string[] = [];
					const originalLog = console.log;
					console.log = (...args: unknown[]) => {
						output.push(args.join(" "));
					};

					try {
						await listCheckpoints();
					} finally {
						console.log = originalLog;
					}

					return {
						content: [
							{
								type: "text",
								text: output.join("\n"),
							},
						],
					};
				}

				case "checkpoint_clean": {
					const maxAge = typeof args.maxAge === "number" ? args.maxAge : 24;

					// Capture output by temporarily overriding console.log
					const output: string[] = [];
					const originalLog = console.log;
					console.log = (...args: unknown[]) => {
						output.push(args.join(" "));
					};

					try {
						await cleanCheckpoints({ maxAge: maxAge.toString() });
					} finally {
						console.log = originalLog;
					}

					return {
						content: [
							{
								type: "text",
								text: output.join("\n"),
							},
						],
					};
				}

				default:
					throw {
						code: -32602,
						message: `Unknown checkpoint tool: ${params.name}`,
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

	// Check if this is a metrics tool
	const isMetricsTool = METRICS_TOOLS.some((t) => t.name === params.name);

	if (isMetricsTool) {
		// Handle metrics tools
		try {
			switch (params.name) {
				case "start_task": {
					const taskParams = args as unknown as StartTaskParams;
					const result = getStorage().startTask(taskParams);
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(result, null, 2),
							},
						],
					};
				}

				case "update_task": {
					const taskParams = args as unknown as UpdateTaskParams;
					const result = getStorage().updateTask(taskParams);
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(result, null, 2),
							},
						],
					};
				}

				case "complete_task": {
					const taskParams = args as unknown as CompleteTaskParams;
					const result = getStorage().completeTask(taskParams);

					// Record OTEL telemetry for task completion
					recordTaskCompletion(
						(result as { type?: string })?.type || "unknown",
						taskParams.outcome,
						taskParams.confidence,
					);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(result, null, 2),
							},
						],
					};
				}

				case "fail_task": {
					const taskParams = args as unknown as FailTaskParams;
					const result = getStorage().failTask(taskParams);

					// Record OTEL telemetry for task failure
					recordTaskCompletion(
						(result as { type?: string })?.type || "unknown",
						"failure",
						taskParams.confidence || 0,
					);

					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(result, null, 2),
							},
						],
					};
				}

				case "query_metrics": {
					const taskParams = args as unknown as QueryMetricsParams;
					const result = getStorage().queryMetrics(taskParams);
					return {
						content: [
							{
								type: "text",
								text: JSON.stringify(result, null, 2),
							},
						],
					};
				}

				default:
					throw {
						code: -32602,
						message: `Unknown metrics tool: ${params.name}`,
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
					const memoryParams = args as unknown as MemoryParams;
					const result = await queryMemory(memoryParams);
					const formatted = formatMemoryResult(result);
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
				result = handleToolsList();
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
