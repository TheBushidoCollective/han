/**
 * Workflow Agent for Han's MCP Orchestrator
 *
 * This module handles complex workflows by:
 * 1. Analyzing user intent to select relevant backend tools
 * 2. Spawning Agent SDK agents with selected tools
 * 3. Running workflows to completion
 * 4. Returning summarized results
 *
 * The key insight is that Claude Code never sees the 50+ backend tools -
 * we expose a single "workflow" tool that orchestrates everything internally.
 *
 * Uses the capability registry to dynamically discover available backends
 * from installed hashi plugins.
 */

import { type McpServerConfig, query } from "@anthropic-ai/claude-agent-sdk";
import { findClaudeExecutable } from "../../shared/shared.ts";
import {
	type BackendCapability,
	discoverBackends,
	selectBackendsForIntent,
} from "./capability-registry.ts";

// Re-export the type for consumers
export type { McpServerConfig };

/**
 * JSONSchema for workflow agent structured output
 */
const WORKFLOW_OUTPUT_SCHEMA = {
	type: "object",
	properties: {
		summary: {
			type: "string",
			description: "Brief summary of what was accomplished in the workflow",
		},
		success: {
			type: "boolean",
			description: "Whether the workflow completed successfully",
		},
		details: {
			type: "string",
			description: "Detailed explanation of actions taken and results",
		},
		nextSteps: {
			type: "array",
			items: { type: "string" },
			description: "Optional suggested next steps or follow-up actions",
		},
	},
	required: ["summary", "success"],
} as const;

/**
 * Generate a system prompt for the workflow agent
 *
 * The prompt is tailored to the specific backends being used.
 */
export function generateAgentPrompt(
	intent: string,
	backends: BackendCapability[],
): string {
	const backendDescriptions = backends
		.map((b) => `- ${b.serverId}: ${b.summary}`)
		.join("\n");

	return `You are a workflow agent executing a specific task. Your job is to complete the requested workflow using the available tools.

## Available Capabilities
${backendDescriptions}

## Guidelines
1. Focus on completing the specific task requested
2. Use the most appropriate tools for each step
3. Report progress and any issues encountered
4. Provide a clear summary of what was accomplished
5. Be concise but thorough in your responses

## Task
${intent}

Execute this workflow step by step, using the available tools as needed.`;
}

/**
 * Build MCP server configurations from selected backends
 *
 * Converts BackendCapability objects to the format expected by Agent SDK.
 */
export function buildMcpServers(
	backends: BackendCapability[],
): Record<string, McpServerConfig> {
	const servers: Record<string, McpServerConfig> = {};

	for (const backend of backends) {
		const config = backend.serverConfig;

		if (config.type === "http" && config.url) {
			// HTTP transport (note: SDK HTTP config doesn't support env)
			servers[backend.serverId] = {
				type: "http",
				url: config.url,
			};
		} else if (config.command) {
			// stdio transport
			servers[backend.serverId] = {
				command: config.command,
				args: config.args,
				env: config.env,
			};
		}
	}

	return servers;
}

/**
 * Build allowed tools pattern for selected backends
 *
 * Since tools are discovered dynamically from MCP servers,
 * we use wildcard patterns based on server IDs.
 */
export function buildAllowedTools(backends: BackendCapability[]): string[] {
	return backends.map((b) => `mcp__${b.serverId}__*`);
}

/**
 * Workflow execution options
 */
export interface WorkflowOptions {
	/** Maximum number of turns for the agent */
	maxTurns?: number;
	/** Model to use for the agent */
	model?: "haiku" | "sonnet" | "opus";
	/** Whether to stream progress updates */
	streamProgress?: boolean;
	/** Callback for progress updates */
	onProgress?: (update: WorkflowProgressUpdate) => void;
	/**
	 * Session ID to resume or fork from.
	 * - If provided without fork=true, continues the existing session
	 * - If provided with fork=true, creates a new session branching from this one
	 */
	sessionId?: string;
	/**
	 * When true and sessionId is provided, creates a new session that forks
	 * from the specified session rather than continuing it.
	 * Use this when the main Claude Code session spawns a workflow.
	 */
	fork?: boolean;
}

/**
 * Progress update from the workflow
 */
export interface WorkflowProgressUpdate {
	type: "text" | "tool_use" | "tool_result" | "error";
	content: string;
	toolName?: string;
	toolInput?: Record<string, unknown>;
}

/**
 * Result from a workflow execution
 */
export interface WorkflowResult {
	/** Whether the workflow completed successfully */
	success: boolean;
	/** Summary of what was accomplished */
	summary: string;
	/** Backends that were used */
	backendsUsed: string[];
	/** Tools that were invoked */
	toolsInvoked: string[];
	/** Full response content for debugging */
	fullResponse?: string;
	/** Error message if failed */
	error?: string;
	/**
	 * Session ID for this workflow execution.
	 * Can be passed back to continue or fork this workflow.
	 */
	sessionId?: string;
}

/**
 * Handle a workflow request
 *
 * This is the main entry point for the workflow agent. It:
 * 1. Analyzes the intent to select relevant backends from installed plugins
 * 2. Builds MCP server configs from those backends
 * 3. Spawns an Agent SDK agent with those servers
 * 4. Runs to completion
 * 5. Returns a summarized result
 *
 * @param intent - The user's workflow request
 * @param options - Configuration options
 * @returns Promise<WorkflowResult> - The result of the workflow
 */
export async function handleWorkflow(
	intent: string,
	options: WorkflowOptions = {},
): Promise<WorkflowResult> {
	const { model = "sonnet", onProgress, sessionId, fork } = options;

	// 1. Discover all available backends from installed plugins
	const allBackends = discoverBackends();

	// 2. Select relevant backends based on intent
	const backends = selectBackendsForIntent(intent, allBackends);
	const backendNames = backends.map((b) => b.serverId);

	if (backends.length === 0) {
		// If no backends match, try to use all available backends
		if (allBackends.length === 0) {
			return {
				success: false,
				summary:
					"No MCP backends available. Install hashi plugins to enable workflow automation.",
				backendsUsed: [],
				toolsInvoked: [],
				error: "No hashi plugins with MCP servers installed",
			};
		}

		// Use all backends if no specific match found
		backends.push(...allBackends);
	}

	// 3. Build MCP server configs and allowed tools
	const mcpServers = buildMcpServers(backends);
	const allowedTools = buildAllowedTools(backends);

	// Check if we have any valid servers
	if (Object.keys(mcpServers).length === 0) {
		return {
			success: false,
			summary: "No valid MCP server configurations found for selected backends",
			backendsUsed: backendNames,
			toolsInvoked: [],
			error:
				"Backend servers are missing required command or URL configuration",
		};
	}

	// 4. Generate agent prompt
	const systemPrompt = generateAgentPrompt(intent, backends);

	// 5. Find Claude executable
	let claudePath: string;
	try {
		claudePath = findClaudeExecutable();
	} catch (error) {
		return {
			success: false,
			summary: "Claude CLI not found",
			backendsUsed: backendNames,
			toolsInvoked: [],
			error: error instanceof Error ? error.message : String(error),
		};
	}

	// 6. Spawn agent and run to completion
	const toolsInvoked: string[] = [];
	let responseContent = "";
	let workflowSessionId: string | undefined;

	try {
		const agent = query({
			prompt: systemPrompt,
			options: {
				model,
				mcpServers,
				allowedTools,
				pathToClaudeCodeExecutable: claudePath,
				includePartialMessages: true,
				outputFormat: {
					type: "json_schema",
					schema: WORKFLOW_OUTPUT_SCHEMA,
				},
				// Session management: resume or fork from existing session
				...(sessionId && { resume: sessionId }),
				...(sessionId && fork && { forkSession: true }),
			},
		});

		// Collect all messages from the agent
		for await (const message of agent) {
			// Capture session ID from init message
			if (
				message.type === "system" &&
				"subtype" in message &&
				message.subtype === "init"
			) {
				workflowSessionId = message.session_id;
			} else if (message.type === "assistant" && message.message?.content) {
				for (const block of message.message.content) {
					if (block.type === "text") {
						responseContent += block.text;
						onProgress?.({
							type: "text",
							content: block.text,
						});
					} else if (block.type === "tool_use") {
						const toolName = block.name;
						toolsInvoked.push(toolName);
						onProgress?.({
							type: "tool_use",
							content: `Using tool: ${toolName}`,
							toolName,
							toolInput: block.input as Record<string, unknown>,
						});
					}
				}
			} else if (message.type === "result") {
				// Handle tool results
				onProgress?.({
					type: "tool_result",
					content: "Tool completed",
				});
			}
		}

		// 7. Parse structured JSON response and generate summary
		interface WorkflowResponse {
			summary: string;
			success: boolean;
			details?: string;
			nextSteps?: string[];
		}

		let structuredResponse: WorkflowResponse | null = null;
		try {
			structuredResponse = JSON.parse(responseContent) as WorkflowResponse;
		} catch {
			// Fallback to text summarization if JSON parsing fails
			console.warn(
				"[Workflow Agent] Response was not valid JSON, using text summary",
			);
		}

		const summary = structuredResponse
			? structuredResponse.summary
			: summarizeResult(responseContent, backends, toolsInvoked);

		// Deduplicate tools invoked
		const uniqueToolsInvoked = Array.from(new Set(toolsInvoked));

		return {
			success: true,
			summary,
			backendsUsed: backendNames,
			toolsInvoked: uniqueToolsInvoked,
			fullResponse: responseContent,
			sessionId: workflowSessionId,
		};
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : String(error);
		onProgress?.({
			type: "error",
			content: errorMessage,
		});

		// Deduplicate tools invoked for error case
		const uniqueToolsInvoked = Array.from(new Set(toolsInvoked));

		return {
			success: false,
			summary: `Workflow failed: ${errorMessage}`,
			backendsUsed: backendNames,
			toolsInvoked: uniqueToolsInvoked,
			fullResponse: responseContent,
			error: errorMessage,
			sessionId: workflowSessionId,
		};
	}
}

/**
 * Summarize the workflow result
 *
 * Extracts key information from the full response to create a concise summary.
 */
function summarizeResult(
	fullResponse: string,
	backends: BackendCapability[],
	toolsInvoked: string[],
): string {
	const backendNames = backends.map((b) => b.serverId).join(", ");
	const uniqueTools = Array.from(new Set(toolsInvoked));

	// Try to extract the last paragraph as it often contains the conclusion
	const paragraphs = fullResponse.split("\n\n").filter((p) => p.trim());
	const conclusion = paragraphs[paragraphs.length - 1] || fullResponse;

	// Truncate if too long
	const maxLength = 500;
	const truncatedConclusion =
		conclusion.length > maxLength
			? `${conclusion.slice(0, maxLength)}...`
			: conclusion;

	return `Workflow completed using ${backendNames} backends.
Tools invoked: ${uniqueTools.length > 0 ? uniqueTools.join(", ") : "none"}

Result:
${truncatedConclusion}`;
}

/**
 * Quick intent check without full workflow execution
 *
 * Useful for preview or validation before running a workflow.
 */
export function previewWorkflow(intent: string): {
	backends: string[];
	allowedToolPatterns: string[];
	mcpServers: Record<string, McpServerConfig>;
} {
	const allBackends = discoverBackends();
	const backends = selectBackendsForIntent(intent, allBackends);

	// If no match, use all backends
	const selectedBackends = backends.length > 0 ? backends : allBackends;

	return {
		backends: selectedBackends.map((b) => b.serverId),
		allowedToolPatterns: buildAllowedTools(selectedBackends),
		mcpServers: buildMcpServers(selectedBackends),
	};
}
