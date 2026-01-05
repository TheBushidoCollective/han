/**
 * MCP Task Tools
 *
 * Provides task tracking tools via MCP protocol.
 * Uses the unified database API for storage.
 */

import { randomUUID } from "node:crypto";
import { createInterface } from "node:readline";
import { tasks } from "../../db/index.ts";
import { getOrCreateEventLogger } from "../../events/logger.ts";
import type {
	TaskComplexity,
	TaskOutcome,
	TaskType,
} from "../../events/types.ts";
import { isMetricsEnabled } from "../../han-settings.ts";
import { recordTaskCompletion } from "../../telemetry/index.ts";

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

/**
 * Define task tracking tools
 */
export const TASK_TOOLS: McpTool[] = [
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
				session_id: {
					type: "string",
					description:
						"Claude session ID (required). Get this from the CLAUDE_SESSION_ID environment variable in your Claude Code session.",
				},
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
			required: ["session_id", "description", "type"],
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
				session_id: {
					type: "string",
					description:
						"Claude session ID (required). Get this from the CLAUDE_SESSION_ID environment variable in your Claude Code session.",
				},
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
			required: ["session_id", "task_id"],
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
				session_id: {
					type: "string",
					description:
						"Claude session ID (required). Get this from the CLAUDE_SESSION_ID environment variable in your Claude Code session.",
				},
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
			required: ["session_id", "task_id", "outcome", "confidence"],
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
				session_id: {
					type: "string",
					description:
						"Claude session ID (required). Get this from the CLAUDE_SESSION_ID environment variable in your Claude Code session.",
				},
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
			required: ["session_id", "task_id", "reason"],
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
			name: "han-task",
			version: "1.0.0",
		},
	};
}

export function handleToolsList(): unknown {
	// Return empty tools list if metrics disabled
	if (!isMetricsEnabled()) {
		return { tools: [] };
	}
	return {
		tools: TASK_TOOLS,
	};
}

export async function handleToolsCall(params: {
	name: string;
	arguments?: Record<string, unknown>;
}): Promise<unknown> {
	// Block all calls if metrics disabled
	if (!isMetricsEnabled()) {
		return {
			content: [
				{
					type: "text",
					text: "Metrics tracking is disabled. Enable it in han.yml with: metrics:\n  enabled: true",
				},
			],
			isError: true,
		};
	}

	try {
		const args = params.arguments || {};

		switch (params.name) {
			case "start_task": {
				const sessionId = args.session_id as string;
				const description = args.description as string;
				const taskType = args.type as string;
				const complexity = args.estimated_complexity as string | undefined;

				// Generate a unique task ID
				const taskId = randomUUID();

				// Create task in database
				const task = await tasks.create({
					taskId,
					sessionId,
					description,
					taskType,
					estimatedComplexity: complexity,
				});

				// Log Han event for task start
				const logger = getOrCreateEventLogger();
				if (logger) {
					logger.logTaskStart(
						task.taskId,
						description,
						taskType as TaskType,
						complexity as TaskComplexity | undefined,
					);
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									task_id: task.taskId,
									session_id: sessionId,
									description: task.description,
									type: task.taskType,
									started_at: task.startedAt,
								},
								null,
								2,
							),
						},
					],
				};
			}

			case "update_task": {
				const taskId = args.task_id as string;
				const status = args.status as string | undefined;
				const notes = args.notes as string | undefined;

				// Get existing task
				const task = await tasks.get(taskId);
				if (!task) {
					return {
						content: [
							{
								type: "text",
								text: `Task not found: ${taskId}`,
							},
						],
						isError: true,
					};
				}

				// Log Han event for task update
				const logger = getOrCreateEventLogger();
				if (logger) {
					logger.logTaskUpdate(taskId, status, notes);
				}

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									task_id: taskId,
									status: status || task.outcome || "in_progress",
									notes: notes || "Update recorded",
								},
								null,
								2,
							),
						},
					],
				};
			}

			case "complete_task": {
				const taskId = args.task_id as string;
				const outcome = args.outcome as string;
				const confidence = args.confidence as number;
				const filesModified = args.files_modified as string[] | undefined;
				const testsAdded = args.tests_added as number | undefined;
				const notes = args.notes as string | undefined;

				// Complete task in database
				const task = await tasks.complete({
					taskId,
					outcome,
					confidence,
					filesModified,
					testsAdded,
					notes,
				});

				// Calculate duration
				const durationSeconds =
					task.completedAt && task.startedAt
						? Math.floor(
								(new Date(task.completedAt).getTime() -
									new Date(task.startedAt).getTime()) /
									1000,
							)
						: 0;

				// Log Han event for task complete
				const logger = getOrCreateEventLogger();
				if (logger) {
					logger.logTaskComplete(
						taskId,
						outcome as TaskOutcome,
						confidence,
						durationSeconds,
						filesModified,
						testsAdded,
						notes,
					);
				}

				// Record OTEL telemetry
				recordTaskCompletion(
					task.taskType || "unknown",
					outcome as "success" | "partial" | "failure",
					confidence,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									task_id: taskId,
									outcome,
									confidence,
									duration_seconds: durationSeconds,
									status: "completed",
								},
								null,
								2,
							),
						},
					],
				};
			}

			case "fail_task": {
				const taskId = args.task_id as string;
				const reason = args.reason as string;
				const confidence = args.confidence as number | undefined;
				const attemptedSolutions = args.attempted_solutions as
					| string[]
					| undefined;
				const notes = args.notes as string | undefined;

				// Fail task in database
				const task = await tasks.fail({
					taskId,
					reason,
					confidence,
					attemptedSolutions,
					notes,
				});

				// Calculate duration
				const durationSeconds =
					task.completedAt && task.startedAt
						? Math.floor(
								(new Date(task.completedAt).getTime() -
									new Date(task.startedAt).getTime()) /
									1000,
							)
						: 0;

				// Log Han event for task fail
				const logger = getOrCreateEventLogger();
				if (logger) {
					logger.logTaskFail(
						taskId,
						reason,
						durationSeconds,
						confidence,
						attemptedSolutions,
						notes,
					);
				}

				// Record OTEL telemetry
				recordTaskCompletion(
					task.taskType || "unknown",
					"failure",
					confidence || 0,
				);

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify(
								{
									task_id: taskId,
									reason,
									duration_seconds: durationSeconds,
									status: "failed",
								},
								null,
								2,
							),
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
				return { jsonrpc: "2.0", id: request.id, result: {} };
			case "ping":
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
 * Start the task MCP server
 */
export async function startTaskMcpServer(): Promise<void> {
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

			if (request.id !== undefined) {
				sendResponse(response);
			}
		} catch (error) {
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
