import { createInterface } from "node:readline";
import { MetricsStorage } from "../../metrics/storage.js";
import type {
	CompleteTaskParams,
	FailTaskParams,
	QueryMetricsParams,
	RecordFrustrationParams,
	StartTaskParams,
	UpdateTaskParams,
} from "../../metrics/types.js";

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

// Lazy-load storage to avoid loading better-sqlite3 native bindings
// at module import time (which breaks basic CLI commands in CI)
let storage: MetricsStorage | null = null;

function getStorage(): MetricsStorage {
	if (!storage) {
		storage = new MetricsStorage();
	}
	return storage;
}

/**
 * Define all metrics tools
 */
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
	{
		name: "record_frustration",
		description:
			"Record a user frustration event detected through interaction analysis. Use when user messages indicate frustration, confusion, or dissatisfaction.",
		annotations: {
			title: "Record Frustration",
			readOnlyHint: false,
			destructiveHint: false,
			idempotentHint: false,
			openWorldHint: false,
		},
		inputSchema: {
			type: "object",
			properties: {
				task_id: {
					type: "string",
					description:
						"Optional task ID if frustration is related to a specific task",
				},
				frustration_level: {
					type: "string",
					enum: ["low", "moderate", "high"],
					description: "Assessed level of user frustration",
				},
				frustration_score: {
					type: "number",
					description: "Numeric frustration score (0-10)",
				},
				user_message: {
					type: "string",
					description: "The user message that triggered frustration detection",
				},
				detected_signals: {
					type: "array",
					items: { type: "string" },
					description: "List of signals that indicated frustration",
				},
				context: {
					type: "string",
					description:
						"Optional context about what may have caused frustration",
				},
			},
			required: [
				"frustration_level",
				"frustration_score",
				"user_message",
				"detected_signals",
			],
		},
	},
];

function handleInitialize(): unknown {
	return {
		protocolVersion: "2024-11-05",
		capabilities: {
			tools: {},
		},
		serverInfo: {
			name: "han-metrics",
			version: "1.0.0",
		},
	};
}

function handleToolsList(): unknown {
	return {
		tools: METRICS_TOOLS,
	};
}

async function handleToolsCall(params: {
	name: string;
	arguments?: Record<string, unknown>;
}): Promise<unknown> {
	try {
		const args = params.arguments || {};

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

			case "record_frustration": {
				const frustrationParams = args as unknown as RecordFrustrationParams;
				const result = getStorage().recordFrustration(frustrationParams);
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
					message: `Unknown tool: ${params.name}`,
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

/**
 * Start the metrics MCP server
 */
export async function startMetricsMcpServer(): Promise<void> {
	// Setup cleanup handlers for graceful shutdown
	process.on("SIGINT", () => {
		if (storage) {
			storage.close();
		}
		process.exit(0);
	});

	process.on("SIGTERM", () => {
		if (storage) {
			storage.close();
		}
		process.exit(0);
	});

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
