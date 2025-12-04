import { createInterface } from "node:readline";
import {
	discoverPluginTools,
	executePluginTool,
	type PluginTool,
} from "./tools.js";

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

function formatToolsForMcp(tools: PluginTool[]): McpTool[] {
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
					failFast: {
						type: "boolean",
						description:
							"Stop immediately on first failure. Set to false to see all errors across all directories. Default: true.",
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

function handleInitialize(): unknown {
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

function handleToolsList(): unknown {
	const tools = discoverTools();
	return {
		tools: formatToolsForMcp(tools),
	};
}

async function handleToolsCall(params: {
	name: string;
	arguments?: Record<string, unknown>;
}): Promise<unknown> {
	const tools = discoverTools();
	const tool = tools.find((t) => t.name === params.name);

	if (!tool) {
		throw {
			code: -32602,
			message: `Unknown tool: ${params.name}`,
		};
	}

	const args = params.arguments || {};
	const cache = args.cache !== false; // Default to true for MCP
	const verbose = args.verbose === true;
	const failFast = args.failFast !== false; // Default to true for MCP
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
