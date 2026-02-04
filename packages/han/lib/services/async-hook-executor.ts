/**
 * Async Hook Executor for Coordinator
 *
 * Manages execution of async PostToolUse hooks with deduplication.
 * When a hook is queued:
 * 1. Check if there's a pending hook with the same key (plugin+hook+files)
 * 2. If so, cancel the older one (deduplication)
 * 3. Execute the hook in the background
 * 4. Publish result via WebSocket subscription
 * 5. Log result to JSONL
 */

import { spawn } from "node:child_process";
import { EventLogger } from "../events/logger.ts";
import {
	type AsyncHookResultPayload,
	publishAsyncHookResult,
} from "../graphql/pubsub.ts";

/**
 * Queued async hook entry
 */
interface QueuedHook {
	hookId: string;
	sessionId: string;
	plugin: string;
	hook: string;
	cwd: string;
	filePaths: string[];
	command: string;
	triggerTool?: string;
	/** Deduplication key: plugin:hook:sorted-file-paths */
	dedupeKey: string;
	/** Timestamp when queued */
	queuedAt: number;
	/** AbortController for cancellation */
	abortController?: AbortController;
	/** Whether currently executing */
	isExecuting: boolean;
}

/**
 * Async Hook Executor
 * Singleton that manages the async hook queue
 */
class AsyncHookExecutor {
	/** Map of hookId -> QueuedHook */
	private queue: Map<string, QueuedHook> = new Map();
	/** Map of dedupeKey -> hookId for fast deduplication lookup */
	private dedupeIndex: Map<string, string> = new Map();
	/** Maximum concurrent hook executions */
	private maxConcurrent = 3;
	/** Currently executing count */
	private executing = 0;

	/**
	 * Generate deduplication key for a hook
	 * Two hooks with the same key should be deduplicated (newer wins)
	 */
	private generateDedupeKey(
		plugin: string,
		hook: string,
		filePaths: string[],
	): string {
		// Sort file paths for consistent deduplication
		const sortedPaths = [...filePaths].sort().join("|");
		return `${plugin}:${hook}:${sortedPaths}`;
	}

	/**
	 * Queue an async hook for execution
	 * Called when coordinator sees an async_hook_queued event in JSONL
	 */
	async queueHook(params: {
		hookId: string;
		sessionId: string;
		plugin: string;
		hook: string;
		cwd: string;
		filePaths: string[];
		command: string;
		triggerTool?: string;
	}): Promise<void> {
		const dedupeKey = this.generateDedupeKey(
			params.plugin,
			params.hook,
			params.filePaths,
		);

		// Check for existing hook with same key (deduplication)
		const existingHookId = this.dedupeIndex.get(dedupeKey);
		if (existingHookId) {
			const existingHook = this.queue.get(existingHookId);
			if (existingHook && !existingHook.isExecuting) {
				// Cancel the older hook
				console.log(
					`[async-executor] Deduplicating ${existingHookId} -> ${params.hookId}`,
				);
				await this.cancelHook(
					existingHookId,
					"deduplication",
					params.hookId,
					params.sessionId,
				);
			}
		}

		// Add new hook to queue
		const queuedHook: QueuedHook = {
			...params,
			dedupeKey,
			queuedAt: Date.now(),
			isExecuting: false,
		};

		this.queue.set(params.hookId, queuedHook);
		this.dedupeIndex.set(dedupeKey, params.hookId);

		console.log(
			`[async-executor] Queued ${params.plugin}/${params.hook} (${params.hookId})`,
		);

		// Try to execute immediately if slots available
		this.processQueue();
	}

	/**
	 * Cancel a queued hook
	 */
	private async cancelHook(
		hookId: string,
		reason: "deduplication" | "session_end" | "manual",
		replacedBy?: string,
		sessionId?: string,
	): Promise<void> {
		const hook = this.queue.get(hookId);
		if (!hook) return;

		// Abort if executing
		if (hook.abortController) {
			hook.abortController.abort();
		}

		// Remove from queue
		this.queue.delete(hookId);
		this.dedupeIndex.delete(hook.dedupeKey);

		// Log cancellation to JSONL
		const effectiveSessionId = sessionId || hook.sessionId;
		const logger = new EventLogger(effectiveSessionId, {}, hook.cwd);
		logger.logAsyncHookCancelled(
			hookId,
			hook.plugin,
			hook.hook,
			reason,
			replacedBy,
		);
		logger.flush();

		// Publish cancellation via WebSocket (so waiting clients know)
		// Set cancelled: true so client can exit 0 silently
		const payload: AsyncHookResultPayload = {
			hookId,
			sessionId: effectiveSessionId,
			pluginName: hook.plugin,
			hookName: hook.hook,
			success: true, // Treat cancellation as success (exit 0)
			durationMs: 0,
			exitCode: 0,
			cancelled: true,
		};
		publishAsyncHookResult(payload);

		console.log(`[async-executor] Cancelled ${hook.plugin}/${hook.hook} (${hookId}): ${reason}`);
	}

	/**
	 * Process the queue - execute hooks if slots available
	 */
	private processQueue(): void {
		if (this.executing >= this.maxConcurrent) {
			return;
		}

		// Find next pending hook (FIFO)
		for (const [hookId, hook] of this.queue) {
			if (!hook.isExecuting) {
				void this.executeHook(hookId);
				if (this.executing >= this.maxConcurrent) {
					break;
				}
			}
		}
	}

	/**
	 * Execute a hook
	 */
	private async executeHook(hookId: string): Promise<void> {
		const hook = this.queue.get(hookId);
		if (!hook) return;

		hook.isExecuting = true;
		hook.abortController = new AbortController();
		this.executing++;

		const startTime = Date.now();

		// Log started event
		const logger = new EventLogger(hook.sessionId, {}, hook.cwd);
		logger.logAsyncHookStarted(hookId, hook.plugin, hook.hook);
		logger.flush();

		console.log(
			`[async-executor] Executing ${hook.plugin}/${hook.hook} (${hookId})`,
		);

		try {
			// No timeout here - timeout is controlled by Claude Code plugin hooks.json
			const result = await this.runCommand(
				hook.command,
				hook.cwd,
				hook.abortController.signal,
			);

			const durationMs = Date.now() - startTime;
			const success = result.exitCode === 0;

			// Log completed event
			logger.logAsyncHookCompleted(
				hookId,
				hook.plugin,
				hook.hook,
				success,
				durationMs,
				result.exitCode,
				result.stdout,
				result.stderr,
			);
			logger.flush();

			// Publish result via WebSocket
			const payload: AsyncHookResultPayload = {
				hookId,
				sessionId: hook.sessionId,
				pluginName: hook.plugin,
				hookName: hook.hook,
				success,
				durationMs,
				exitCode: result.exitCode,
				output: result.stdout,
				error: result.stderr || undefined,
			};
			publishAsyncHookResult(payload);

			console.log(
				`[async-executor] Completed ${hook.plugin}/${hook.hook} (${hookId}): ${success ? "success" : "failure"} in ${durationMs}ms`,
			);
		} catch (error) {
			const durationMs = Date.now() - startTime;
			const errorMessage = error instanceof Error ? error.message : String(error);

			// Check if aborted (e.g., session ended or manual cancellation)
			if (hook.abortController.signal.aborted) {
				console.log(`[async-executor] Aborted ${hook.plugin}/${hook.hook} (${hookId})`);
				return;
			}

			// Log as failed
			logger.logAsyncHookCompleted(
				hookId,
				hook.plugin,
				hook.hook,
				false,
				durationMs,
				1,
				undefined,
				errorMessage,
			);
			logger.flush();

			// Publish failure
			const payload: AsyncHookResultPayload = {
				hookId,
				sessionId: hook.sessionId,
				pluginName: hook.plugin,
				hookName: hook.hook,
				success: false,
				durationMs,
				exitCode: 1,
				error: errorMessage,
			};
			publishAsyncHookResult(payload);

			console.error(
				`[async-executor] Error executing ${hook.plugin}/${hook.hook} (${hookId}): ${errorMessage}`,
			);
		} finally {
			// Clean up
			this.queue.delete(hookId);
			this.dedupeIndex.delete(hook.dedupeKey);
			this.executing--;

			// Process next in queue
			this.processQueue();
		}
	}

	/**
	 * Run a command and capture output
	 */
	private runCommand(
		command: string,
		cwd: string,
		signal: AbortSignal,
	): Promise<{ exitCode: number; stdout: string; stderr: string }> {
		return new Promise((resolve, reject) => {
			const proc = spawn("bash", ["-c", command], {
				cwd,
				stdio: ["ignore", "pipe", "pipe"],
				env: { ...process.env },
			});

			let stdout = "";
			let stderr = "";

			proc.stdout.on("data", (data: Buffer) => {
				stdout += data.toString();
			});

			proc.stderr.on("data", (data: Buffer) => {
				stderr += data.toString();
			});

			proc.on("close", (code) => {
				resolve({
					exitCode: code ?? 1,
					stdout,
					stderr,
				});
			});

			proc.on("error", reject);

			// Handle abort signal
			signal.addEventListener("abort", () => {
				proc.kill("SIGTERM");
				reject(new Error("Aborted"));
			});
		});
	}

	/**
	 * Clear all hooks for a session (called on SessionStart/SessionEnd)
	 */
	async clearSession(sessionId: string): Promise<number> {
		let cleared = 0;
		for (const [hookId, hook] of this.queue) {
			if (hook.sessionId === sessionId) {
				await this.cancelHook(hookId, "session_end", undefined, sessionId);
				cleared++;
			}
		}
		return cleared;
	}

	/**
	 * Get queue status for debugging
	 */
	getStatus(): {
		queued: number;
		executing: number;
		hooks: Array<{ hookId: string; plugin: string; hook: string; isExecuting: boolean }>;
	} {
		const hooks = Array.from(this.queue.values()).map((h) => ({
			hookId: h.hookId,
			plugin: h.plugin,
			hook: h.hook,
			isExecuting: h.isExecuting,
		}));

		return {
			queued: this.queue.size,
			executing: this.executing,
			hooks,
		};
	}
}

/**
 * Singleton instance
 */
export const asyncHookExecutor = new AsyncHookExecutor();
