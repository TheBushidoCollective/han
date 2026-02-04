/**
 * Async Hook Client
 *
 * Connects to the coordinator's GraphQL WebSocket to receive async hook results.
 * Used by `han hook run --async` to wait for coordinator-executed hooks.
 *
 * Falls back to local execution if coordinator is not available.
 */

import { createClient } from "graphql-ws";
import WebSocket from "ws";

const COORDINATOR_URL = "ws://localhost:41956/graphql";
const CONNECTION_TIMEOUT = 2000;
const RESULT_TIMEOUT = 300000; // 5 minutes max

/**
 * Async hook result from coordinator
 */
export interface AsyncHookResult {
	hookId: string;
	sessionId: string;
	pluginName: string;
	hookName: string;
	success: boolean;
	durationMs: number;
	output?: string;
	error?: string;
	exitCode: number;
	/** Whether the hook was cancelled (e.g., due to deduplication) */
	cancelled?: boolean;
}

/**
 * Check if coordinator is running
 */
export async function isCoordinatorRunning(): Promise<boolean> {
	return new Promise((resolve) => {
		const ws = new WebSocket(COORDINATOR_URL, "graphql-ws");
		const timeout = setTimeout(() => {
			ws.close();
			resolve(false);
		}, CONNECTION_TIMEOUT);

		ws.on("open", () => {
			clearTimeout(timeout);
			ws.close();
			resolve(true);
		});

		ws.on("error", () => {
			clearTimeout(timeout);
			resolve(false);
		});
	});
}

/**
 * Wait for async hook result from coordinator
 * Returns null if coordinator is not available or timeout occurs
 */
export async function waitForAsyncHookResult(
	hookId: string,
	timeoutMs = RESULT_TIMEOUT,
): Promise<AsyncHookResult | null> {
	return new Promise((resolve) => {
		let client: ReturnType<typeof createClient> | null = null;
		let resolved = false;

		const timeout = setTimeout(() => {
			if (!resolved) {
				resolved = true;
				client?.dispose();
				resolve(null);
			}
		}, timeoutMs);

		try {
			client = createClient({
				url: COORDINATOR_URL,
				webSocketImpl: WebSocket,
				connectionParams: {},
				retryAttempts: 0,
				on: {
					error: () => {
						if (!resolved) {
							resolved = true;
							clearTimeout(timeout);
							resolve(null);
						}
					},
				},
			});

			const subscription = client.subscribe<{
				asyncHookResult: AsyncHookResult;
			}>(
				{
					query: `
						subscription AsyncHookResult($hookId: String!) {
							asyncHookResult(hookId: $hookId) {
								hookId
								sessionId
								pluginName
								hookName
								success
								durationMs
								output
								error
								exitCode
								cancelled
							}
						}
					`,
					variables: { hookId },
				},
				{
					next: (data) => {
						if (!resolved && data.data?.asyncHookResult) {
							resolved = true;
							clearTimeout(timeout);
							client?.dispose();
							resolve(data.data.asyncHookResult);
						}
					},
					error: () => {
						if (!resolved) {
							resolved = true;
							clearTimeout(timeout);
							client?.dispose();
							resolve(null);
						}
					},
					complete: () => {
						if (!resolved) {
							resolved = true;
							clearTimeout(timeout);
							resolve(null);
						}
					},
				},
			);

			// Return unsubscribe function (not needed here but kept for type safety)
			void subscription;
		} catch {
			if (!resolved) {
				resolved = true;
				clearTimeout(timeout);
				resolve(null);
			}
		}
	});
}
