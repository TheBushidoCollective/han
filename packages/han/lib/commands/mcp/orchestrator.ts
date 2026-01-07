/**
 * Han MCP Orchestrator
 *
 * Provides the han_workflow tool for autonomous backend execution.
 * The orchestrator coordinates capability discovery and workflow execution
 * while keeping backend tools hidden from Claude Code.
 *
 * Design goals:
 * - han_workflow encapsulates all backend tool execution
 * - Dynamic workflow description based on available capabilities
 * - CC never sees backend tools directly
 *
 * Note: All other tools (memory, metrics, checkpoints, hooks) are defined
 * and handled by server.ts. The orchestrator only adds han_workflow.
 */

import { getMergedHanConfig } from "../../config/index.ts";
import {
	type BackendPool,
	createBackendPool as createPool,
} from "./backend-pool.ts";
import {
	type CapabilityRegistry,
	discoverCapabilities,
	generateWorkflowDescription as generateCapabilityDescription,
} from "./capability-registry.ts";
import {
	handleWorkflow as executeWorkflow,
	type WorkflowResult,
} from "./workflow-agent.ts";
import {
	cancelWorkflow,
	getWorkflowStatus,
	listWorkflows,
	startAsyncWorkflow,
	type WorkflowStatusResponse,
} from "./workflow-registry.ts";

/**
 * MCP Tool definition for tools/list response
 */
export interface McpTool {
	name: string;
	description: string;
	annotations?: {
		title?: string;
		readOnlyHint?: boolean;
		destructiveHint?: boolean;
		idempotentHint?: boolean;
		openWorldHint?: boolean;
	};
	inputSchema: {
		type: "object";
		properties: Record<string, unknown>;
		required?: string[];
	};
}

/**
 * Tool call result for tools/call response
 */
export interface ToolCallResult {
	content: Array<{
		type: "text";
		text: string;
	}>;
	isError?: boolean;
}

/**
 * Orchestrator configuration from han.yml
 */
export interface OrchestratorConfig {
	enabled: boolean;
	always_available: string[];
	workflow: {
		enabled: boolean;
		max_steps: number;
		timeout: number;
	};
}

/**
 * Get orchestrator config from han.yml with defaults
 */
export function getOrchestratorConfig(): OrchestratorConfig {
	const config = getMergedHanConfig();

	// Default orchestrator config
	const defaults: OrchestratorConfig = {
		enabled: true,
		always_available: [
			"memory",
			"learn",
			"checkpoint_list",
			"start_task",
			"complete_task",
		],
		workflow: {
			enabled: true,
			max_steps: 20,
			timeout: 300,
		},
	};

	// Merge with config from han.yml if present
	const orchConfig = (config as Record<string, unknown>).orchestrator as
		| Partial<OrchestratorConfig>
		| undefined;

	if (!orchConfig) {
		return defaults;
	}

	return {
		enabled: orchConfig.enabled ?? defaults.enabled,
		always_available: orchConfig.always_available ?? defaults.always_available,
		workflow: {
			enabled: orchConfig.workflow?.enabled ?? defaults.workflow.enabled,
			max_steps: orchConfig.workflow?.max_steps ?? defaults.workflow.max_steps,
			timeout: orchConfig.workflow?.timeout ?? defaults.workflow.timeout,
		},
	};
}

/**
 * Generate dynamic description for han_workflow tool
 * based on available capabilities from the registry
 */
export function generateWorkflowDescription(
	registry?: CapabilityRegistry,
): string {
	// Delegate to the capability registry's implementation
	return generateCapabilityDescription(registry);
}

/**
 * Main MCP Orchestrator
 *
 * Provides the han_workflow tool for autonomous backend execution.
 * All other tools are defined and handled by server.ts.
 */
export class Orchestrator {
	private registry: CapabilityRegistry | null = null;
	private pool: BackendPool | null = null;
	private config: OrchestratorConfig;
	private initialized = false;

	constructor() {
		this.config = getOrchestratorConfig();
	}

	/**
	 * Initialize the orchestrator
	 *
	 * Scans plugins, builds capability index, starts backend pool.
	 * Must be called before getWorkflowTool() or handleWorkflow().
	 */
	async initialize(): Promise<void> {
		if (this.initialized) {
			return;
		}

		if (!this.config.enabled) {
			this.initialized = true;
			return;
		}

		// Initialize capability registry (scans plugins)
		this.registry = discoverCapabilities();

		// Initialize backend pool (manages MCP server connections)
		this.pool = createPool();

		this.initialized = true;
	}

	/**
	 * Get the han_workflow tool definition
	 *
	 * Returns the workflow tool with a dynamic description
	 * based on available capabilities from installed hashi plugins.
	 */
	getWorkflowTool(): McpTool {
		return {
			name: "han_workflow",
			description: generateWorkflowDescription(this.registry ?? undefined),
			annotations: {
				title: "Execute Workflow",
				readOnlyHint: false,
				destructiveHint: false,
				idempotentHint: false,
				openWorldHint: true,
			},
			inputSchema: {
				type: "object",
				properties: {
					intent: {
						type: "string",
						description:
							"What you want to accomplish. Be specific about the goal, files involved, and expected outcome.",
					},
					context: {
						type: "object",
						description:
							"Optional context to pass to the workflow (e.g., file paths, configuration).",
					},
					sessionId: {
						type: "string",
						description:
							"Session ID for workflow continuity. For initial calls from the main session, pass the main session ID with fork=true to create an independent workflow session. For follow-up queries within the same workflow, pass the sessionId returned from the previous workflow call without fork to continue that session.",
					},
					fork: {
						type: "boolean",
						description:
							"When true and sessionId is provided, creates a new workflow session that forks from the specified session. Use this when invoking from the main Claude Code session to create an independent workflow. Do not use fork when continuing an existing workflow session.",
					},
					async: {
						type: "boolean",
						description:
							"When true, starts the workflow in the background and returns immediately with a workflow_id. Use han_workflow_status to poll for progress. Recommended for long-running workflows - spawn a monitor agent to track progress.",
					},
				},
				required: ["intent"],
			},
		};
	}

	/**
	 * Handle a han_workflow tool call
	 */
	async handleWorkflow(args: Record<string, unknown>): Promise<ToolCallResult> {
		try {
			const intent = args.intent as string;
			if (!intent || intent.trim().length === 0) {
				return {
					content: [{ type: "text", text: "Intent cannot be empty." }],
					isError: true,
				};
			}

			const sessionId = args.sessionId as string | undefined;
			const fork = args.fork as boolean | undefined;
			const isAsync = args.async as boolean | undefined;

			// Async mode: start in background and return immediately
			if (isAsync) {
				const { workflow_id } = startAsyncWorkflow(intent, {
					sessionId,
					fork,
				});

				return this.formatAsyncStartResult(workflow_id);
			}

			// Sync mode: execute and wait for completion
			const result = await executeWorkflow(intent, {
				maxTurns: this.config.workflow.max_steps,
				sessionId,
				fork,
			});

			return this.formatWorkflowResult(result);
		} catch (error) {
			const message = error instanceof Error ? error.message : String(error);
			return {
				content: [
					{ type: "text", text: `Error executing workflow: ${message}` },
				],
				isError: true,
			};
		}
	}

	/**
	 * Handle a han_workflow_status tool call
	 */
	handleWorkflowStatus(args: Record<string, unknown>): ToolCallResult {
		const workflowId = args.workflow_id as string;
		if (!workflowId) {
			return {
				content: [{ type: "text", text: "workflow_id is required." }],
				isError: true,
			};
		}

		const status = getWorkflowStatus(workflowId);
		if (!status) {
			return {
				content: [{ type: "text", text: `Workflow not found: ${workflowId}` }],
				isError: true,
			};
		}

		return this.formatStatusResult(status);
	}

	/**
	 * Handle a han_workflow_cancel tool call
	 */
	handleWorkflowCancel(args: Record<string, unknown>): ToolCallResult {
		const workflowId = args.workflow_id as string;
		if (!workflowId) {
			return {
				content: [{ type: "text", text: "workflow_id is required." }],
				isError: true,
			};
		}

		const cancelled = cancelWorkflow(workflowId);
		if (!cancelled) {
			return {
				content: [
					{
						type: "text",
						text: `Could not cancel workflow: ${workflowId} (not found or already completed)`,
					},
				],
				isError: true,
			};
		}

		return {
			content: [{ type: "text", text: `Workflow ${workflowId} cancelled.` }],
		};
	}

	/**
	 * Handle a han_workflow_list tool call
	 */
	handleWorkflowList(): ToolCallResult {
		const workflows = listWorkflows();

		if (workflows.length === 0) {
			return {
				content: [{ type: "text", text: "No active workflows." }],
			};
		}

		const lines = ["**Active Workflows:**", ""];
		for (const wf of workflows) {
			const elapsed = Math.round((Date.now() - wf.startedAt) / 1000);
			lines.push(
				`- **${wf.id}** [${wf.status}] ${wf.progress.message} (${elapsed}s)`,
			);
			lines.push(`  Intent: ${wf.intent.slice(0, 100)}...`);
		}

		return {
			content: [{ type: "text", text: lines.join("\n") }],
		};
	}

	/**
	 * Shutdown the orchestrator
	 */
	async shutdown(): Promise<void> {
		if (this.pool) {
			await this.pool.disconnectAll();
		}
		this.initialized = false;
	}

	// =========================================================================
	// Helpers
	// =========================================================================

	private formatAsyncStartResult(workflowId: string): ToolCallResult {
		const lines = [
			"**Workflow Started (Async)**",
			"",
			`**Workflow ID:** \`${workflowId}\``,
			"",
			"The workflow is running in the background. To monitor progress:",
			"",
			"1. **Recommended:** Spawn a `core:workflow-monitor` agent to track this workflow:",
			"   ```",
			`   Task(subagent_type="core:workflow-monitor", prompt="Monitor workflow ${workflowId}")`,
			"   ```",
			"",
			"2. **Manual:** Poll status with `han_workflow_status`:",
			"   ```",
			`   han_workflow_status({ workflow_id: "${workflowId}" })`,
			"   ```",
			"",
			"The monitor agent will poll for updates and report progress until completion.",
		];

		return {
			content: [{ type: "text", text: lines.join("\n") }],
		};
	}

	private formatStatusResult(status: WorkflowStatusResponse): ToolCallResult {
		const lines: string[] = [];

		// Status header
		const statusEmoji =
			status.status === "complete"
				? "✅"
				: status.status === "failed"
					? "❌"
					: status.status === "running"
						? "🔄"
						: "⏳";

		lines.push(`${statusEmoji} **Status:** ${status.status}`);
		lines.push(`**Workflow ID:** ${status.workflow_id}`);
		lines.push(
			`**Progress:** ${status.progress.current}/${status.progress.total} - ${status.progress.message}`,
		);
		lines.push(`**Elapsed:** ${Math.round(status.elapsed_ms / 1000)}s`);

		// Partial results
		if (status.partial_results.length > 0) {
			lines.push("", "**Recent Activity:**");
			for (const result of status.partial_results.slice(-5)) {
				lines.push(`- ${result.slice(0, 150)}`);
			}
		}

		// Check again instruction
		if (status.check_again) {
			lines.push("", "---", "**check_again: true** - Poll again for updates.");
		} else {
			lines.push("", "---", "**check_again: false** - Workflow complete.");

			// Final result
			if (status.final_result) {
				lines.push("", "## Final Result");
				lines.push(status.final_result.summary);

				if (status.final_result.backendsUsed?.length) {
					lines.push(
						"",
						"**Backends Used:**",
						status.final_result.backendsUsed.join(", "),
					);
				}
				if (status.final_result.toolsInvoked?.length) {
					lines.push(
						"",
						"**Tools Invoked:**",
						status.final_result.toolsInvoked.join(", "),
					);
				}
			}

			if (status.error) {
				lines.push("", "## Error", status.error);
			}
		}

		return {
			content: [{ type: "text", text: lines.join("\n") }],
			isError: status.status === "failed",
		};
	}

	private formatWorkflowResult(result: WorkflowResult): ToolCallResult {
		const lines: string[] = [];

		// Status header
		const statusIcon = result.success ? "Success" : "Failed";
		lines.push(`**Status:** ${statusIcon}`);

		// Session ID for workflow continuity
		if (result.sessionId) {
			lines.push(`**Session ID:** ${result.sessionId}`);
			lines.push(
				"_Pass this sessionId (without fork) in subsequent han_workflow calls to continue this workflow session._",
			);
		}

		// Summary
		if (result.summary) {
			lines.push("", "## Summary", result.summary);
		}

		// Backends used
		if (result.backendsUsed && result.backendsUsed.length > 0) {
			lines.push("", "**Backends Used:**", result.backendsUsed.join(", "));
		}

		// Tools invoked
		if (result.toolsInvoked && result.toolsInvoked.length > 0) {
			lines.push("", "**Tools Invoked:**", result.toolsInvoked.join(", "));
		}

		// Error
		if (result.error) {
			lines.push("", "## Error", result.error);
		}

		return {
			content: [{ type: "text", text: lines.join("\n") }],
			isError: !result.success,
		};
	}
}

/**
 * Create and initialize an orchestrator instance
 */
export async function createOrchestrator(): Promise<Orchestrator> {
	const orchestrator = new Orchestrator();
	await orchestrator.initialize();
	return orchestrator;
}

/**
 * Singleton instance for the MCP server
 */
let orchestratorInstance: Orchestrator | null = null;

/**
 * Get the singleton orchestrator instance
 */
export async function getOrchestrator(): Promise<Orchestrator> {
	if (!orchestratorInstance) {
		orchestratorInstance = await createOrchestrator();
	}
	return orchestratorInstance;
}
