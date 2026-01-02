/**
 * Workflow Registry
 *
 * Tracks running workflows for async execution pattern.
 * Workflows can be started in the background and polled for status.
 *
 * Key features:
 * - In-memory storage (workflows are transient)
 * - Progress tracking with partial results
 * - Automatic cleanup of old completed workflows
 */

import { handleWorkflow, type WorkflowResult } from "./workflow-agent.ts";

/**
 * Progress state for a running workflow
 */
export interface WorkflowProgress {
	current: number;
	total: number;
	message: string;
}

/**
 * Status of a workflow
 */
export type WorkflowStatus =
	| "pending"
	| "running"
	| "complete"
	| "failed"
	| "cancelled";

/**
 * A tracked workflow
 */
export interface TrackedWorkflow {
	id: string;
	intent: string;
	status: WorkflowStatus;
	progress: WorkflowProgress;
	partialResults: string[];
	finalResult?: WorkflowResult;
	error?: string;
	startedAt: number;
	completedAt?: number;
}

/**
 * Status response from polling a workflow
 */
export interface WorkflowStatusResponse {
	workflow_id: string;
	status: WorkflowStatus;
	progress: WorkflowProgress;
	partial_results: string[];
	check_again: boolean;
	final_result?: WorkflowResult;
	error?: string;
	elapsed_ms: number;
}

/**
 * Options for starting an async workflow
 */
export interface AsyncWorkflowOptions {
	/** Session ID from main Claude Code session */
	sessionId?: string;
	/** Fork from the session */
	fork?: boolean;
}

// In-memory workflow storage
const workflows = new Map<string, TrackedWorkflow>();

// Cleanup interval (remove completed workflows after 5 minutes)
const CLEANUP_INTERVAL_MS = 60_000;
const MAX_AGE_MS = 5 * 60_000;

let cleanupInterval: ReturnType<typeof setInterval> | null = null;

/**
 * Generate a unique workflow ID
 */
function generateWorkflowId(): string {
	return `wf-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

/**
 * Start cleanup interval if not already running
 */
function ensureCleanup(): void {
	if (cleanupInterval) return;

	cleanupInterval = setInterval(() => {
		const now = Date.now();
		for (const [id, workflow] of workflows.entries()) {
			if (workflow.completedAt && now - workflow.completedAt > MAX_AGE_MS) {
				workflows.delete(id);
			}
		}
	}, CLEANUP_INTERVAL_MS);

	// Don't prevent process exit
	if (cleanupInterval.unref) {
		cleanupInterval.unref();
	}
}

/**
 * Start a workflow asynchronously
 *
 * Returns immediately with a workflow ID. The workflow executes in the background.
 * Use getWorkflowStatus() to poll for progress.
 */
export function startAsyncWorkflow(
	intent: string,
	options: AsyncWorkflowOptions = {},
): { workflow_id: string; status: WorkflowStatus } {
	ensureCleanup();

	const id = generateWorkflowId();
	const workflow: TrackedWorkflow = {
		id,
		intent,
		status: "pending",
		progress: { current: 0, total: 1, message: "Starting workflow..." },
		partialResults: [],
		startedAt: Date.now(),
	};

	workflows.set(id, workflow);

	// Start workflow in background (don't await)
	executeWorkflowAsync(id, intent, options);

	return { workflow_id: id, status: "pending" };
}

/**
 * Execute workflow in background and update registry
 */
async function executeWorkflowAsync(
	workflowId: string,
	intent: string,
	options: AsyncWorkflowOptions,
): Promise<void> {
	const workflow = workflows.get(workflowId);
	if (!workflow) return;

	workflow.status = "running";
	workflow.progress = { current: 0, total: 5, message: "Initializing..." };

	try {
		const result = await handleWorkflow(intent, {
			sessionId: options.sessionId,
			fork: options.fork,
			onProgress: (update) => {
				// Update progress based on events
				if (update.type === "tool_use" && update.toolName) {
					workflow.progress.current++;
					workflow.progress.message = `Using: ${update.toolName}`;
					workflow.partialResults.push(
						`[${new Date().toISOString()}] ${update.content}`,
					);
				} else if (update.type === "text") {
					workflow.partialResults.push(update.content.slice(0, 200));
				} else if (update.type === "error") {
					workflow.partialResults.push(`Error: ${update.content}`);
				}
			},
		});

		workflow.status = result.success ? "complete" : "failed";
		workflow.finalResult = result;
		workflow.completedAt = Date.now();
		workflow.progress = {
			current: workflow.progress.total,
			total: workflow.progress.total,
			message: result.success ? "Workflow complete" : "Workflow failed",
		};

		if (!result.success && result.error) {
			workflow.error = result.error;
		}
	} catch (error) {
		workflow.status = "failed";
		workflow.error = error instanceof Error ? error.message : String(error);
		workflow.completedAt = Date.now();
		workflow.progress.message = "Workflow failed with error";
	}
}

/**
 * Get the status of a workflow
 *
 * Returns current progress, partial results, and whether to check again.
 */
export function getWorkflowStatus(
	workflowId: string,
): WorkflowStatusResponse | null {
	const workflow = workflows.get(workflowId);
	if (!workflow) {
		return null;
	}

	const isComplete =
		workflow.status === "complete" || workflow.status === "failed";

	return {
		workflow_id: workflow.id,
		status: workflow.status,
		progress: workflow.progress,
		partial_results: workflow.partialResults.slice(-10), // Last 10 updates
		check_again: !isComplete,
		final_result: workflow.finalResult,
		error: workflow.error,
		elapsed_ms: Date.now() - workflow.startedAt,
	};
}

/**
 * Cancel a running workflow
 */
export function cancelWorkflow(workflowId: string): boolean {
	const workflow = workflows.get(workflowId);
	if (
		!workflow ||
		workflow.status === "complete" ||
		workflow.status === "failed"
	) {
		return false;
	}

	workflow.status = "cancelled";
	workflow.completedAt = Date.now();
	workflow.progress.message = "Workflow cancelled";
	return true;
}

/**
 * List all active workflows
 */
export function listWorkflows(): TrackedWorkflow[] {
	return Array.from(workflows.values()).filter(
		(w) => w.status === "pending" || w.status === "running",
	);
}

/**
 * Get a workflow by ID (for debugging/admin)
 */
export function getWorkflow(workflowId: string): TrackedWorkflow | null {
	return workflows.get(workflowId) || null;
}
