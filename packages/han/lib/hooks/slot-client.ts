/**
 * Global Slot Client
 *
 * Client for acquiring/releasing global execution slots from the coordinator.
 * Falls back to local file-based slots when coordinator is unavailable.
 *
 * This ensures resource-intensive operations (like playwright tests)
 * are properly coordinated across all Claude sessions.
 */

import { COORDINATOR_PORT } from "../commands/coordinator/types.ts";

/**
 * Debug logging
 */
function debugLog(message: string): void {
	if (process.env.HAN_LOCK_DEBUG === "1") {
		console.error(`[slot-client] ${message}`);
	}
}

/**
 * Check if coordinator is available
 */
async function isCoordinatorAvailable(): Promise<boolean> {
	try {
		const response = await fetch(
			`http://127.0.0.1:${COORDINATOR_PORT}/health`,
			{
				signal: AbortSignal.timeout(1000),
			},
		);
		if (!response.ok) return false;
		const data = await response.json();
		return data.status === "ok";
	} catch {
		return false;
	}
}

/**
 * Result of slot acquisition attempt
 */
export interface SlotAcquireResult {
	granted: boolean;
	slotId: number;
	waitingCount: number;
	source: "coordinator" | "local";
}

/**
 * Try to acquire a global slot from the coordinator
 */
async function acquireFromCoordinator(
	sessionId: string,
	hookName: string,
	pid: number,
	pluginName?: string,
): Promise<SlotAcquireResult | null> {
	try {
		const query = `
			mutation AcquireSlot($sessionId: String!, $hookName: String!, $pid: Int!, $pluginName: String) {
				acquireSlot(sessionId: $sessionId, hookName: $hookName, pid: $pid, pluginName: $pluginName) {
					granted
					slotId
					waitingCount
				}
			}
		`;

		const response = await fetch(
			`http://127.0.0.1:${COORDINATOR_PORT}/graphql`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query,
					variables: { sessionId, hookName, pid, pluginName },
				}),
				signal: AbortSignal.timeout(5000),
			},
		);

		if (!response.ok) {
			debugLog(`Coordinator returned ${response.status}`);
			return null;
		}

		const result = await response.json();
		if (result.errors) {
			debugLog(`GraphQL errors: ${JSON.stringify(result.errors)}`);
			return null;
		}

		const data = result.data.acquireSlot;
		return {
			granted: data.granted,
			slotId: data.slotId,
			waitingCount: data.waitingCount,
			source: "coordinator",
		};
	} catch (error) {
		debugLog(`Failed to acquire from coordinator: ${error}`);
		return null;
	}
}

/**
 * Release a slot back to the coordinator
 */
async function releaseToCoordinator(
	slotId: number,
	pid: number,
): Promise<boolean> {
	try {
		const query = `
			mutation ReleaseSlot($slotId: Int!, $pid: Int!) {
				releaseSlot(slotId: $slotId, pid: $pid) {
					success
					message
				}
			}
		`;

		const response = await fetch(
			`http://127.0.0.1:${COORDINATOR_PORT}/graphql`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					query,
					variables: { slotId, pid },
				}),
				signal: AbortSignal.timeout(5000),
			},
		);

		if (!response.ok) {
			debugLog(`Coordinator returned ${response.status}`);
			return false;
		}

		const result = await response.json();
		if (result.errors) {
			debugLog(`GraphQL errors: ${JSON.stringify(result.errors)}`);
			return false;
		}

		return result.data.releaseSlot.success;
	} catch (error) {
		debugLog(`Failed to release to coordinator: ${error}`);
		return false;
	}
}

/**
 * Slot handle returned when a slot is acquired
 */
export interface SlotHandle {
	slotId: number;
	source: "coordinator" | "local";
	release: () => Promise<void>;
}

/**
 * Try to acquire a global slot with retry logic.
 * First tries the coordinator, falls back to local slots if unavailable.
 *
 * @param sessionId - Session identifier
 * @param hookName - Name of the hook requesting the slot
 * @param pluginName - Optional plugin name
 * @param maxWait - Maximum time to wait in milliseconds (default: 5 minutes)
 * @returns SlotHandle if acquired, null if timeout
 */
export async function acquireGlobalSlot(
	sessionId: string,
	hookName: string,
	pluginName?: string,
	maxWait = 300000,
): Promise<SlotHandle | null> {
	const pid = process.pid;
	const startTime = Date.now();
	let attempt = 0;

	debugLog(
		`Attempting to acquire global slot for ${pluginName || "unknown"}:${hookName}`,
	);

	// Check if coordinator is available
	const coordinatorAvailable = await isCoordinatorAvailable();

	if (!coordinatorAvailable) {
		debugLog("Coordinator not available, falling back to local slots");
		// Import and use local slot system
		const { acquireSlot, releaseSlot, createLockManager } = await import(
			"./hook-lock.ts"
		);
		const manager = createLockManager(sessionId);
		const localSlotId = await acquireSlot(manager, hookName, pluginName);

		return {
			slotId: localSlotId,
			source: "local",
			release: async () => {
				releaseSlot(manager, localSlotId);
			},
		};
	}

	// Try to acquire from coordinator with retry
	while (true) {
		const result = await acquireFromCoordinator(
			sessionId,
			hookName,
			pid,
			pluginName,
		);

		if (result === null) {
			// Coordinator became unavailable, fall back to local
			debugLog("Coordinator became unavailable during acquisition");
			const { acquireSlot, releaseSlot, createLockManager } = await import(
				"./hook-lock.ts"
			);
			const manager = createLockManager(sessionId);
			const localSlotId = await acquireSlot(manager, hookName, pluginName);

			return {
				slotId: localSlotId,
				source: "local",
				release: async () => {
					releaseSlot(manager, localSlotId);
				},
			};
		}

		if (result.granted) {
			debugLog(`Acquired global slot ${result.slotId} from coordinator`);
			return {
				slotId: result.slotId,
				source: "coordinator",
				release: async () => {
					await releaseToCoordinator(result.slotId, pid);
				},
			};
		}

		// Check timeout
		const elapsed = Date.now() - startTime;
		if (elapsed > maxWait) {
			debugLog(`Timeout waiting for global slot after ${elapsed}ms`);
			return null;
		}

		// Wait with exponential backoff (100ms, 200ms, 400ms, ... up to 2s)
		const backoff = Math.min(100 * 2 ** attempt, 2000);
		attempt++;

		debugLog(
			`No slots available (${result.waitingCount} in use), waiting ${backoff}ms (attempt ${attempt})`,
		);

		await new Promise((resolve) => setTimeout(resolve, backoff));
	}
}

/**
 * Run a function with a global slot.
 * Acquires a slot before running, releases after completion.
 *
 * @param sessionId - Session identifier
 * @param hookName - Name of the hook
 * @param pluginName - Optional plugin name
 * @param fn - Function to run with the slot
 * @param maxWait - Maximum time to wait for slot (default: 5 minutes)
 */
export async function withGlobalSlot<T>(
	sessionId: string,
	hookName: string,
	pluginName: string | undefined,
	fn: () => Promise<T>,
	maxWait = 300000,
): Promise<T> {
	const handle = await acquireGlobalSlot(
		sessionId,
		hookName,
		pluginName,
		maxWait,
	);

	if (!handle) {
		throw new Error(
			`Timeout waiting for global slot for ${pluginName || "unknown"}:${hookName}`,
		);
	}

	try {
		return await fn();
	} finally {
		await handle.release();
	}
}

/**
 * Get current global slot status
 */
export async function getSlotStatus(): Promise<{
	total: number;
	available: number;
	active: Array<{
		slotId: number;
		sessionId: string;
		hookName: string;
		pluginName?: string;
		pid: number;
		heldForMs: number;
	}>;
} | null> {
	try {
		const query = `
			query SlotStatus {
				slots {
					total
					available
					active {
						slotId
						sessionId
						hookName
						pluginName
						pid
						heldForMs
					}
				}
			}
		`;

		const response = await fetch(
			`http://127.0.0.1:${COORDINATOR_PORT}/graphql`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ query }),
				signal: AbortSignal.timeout(5000),
			},
		);

		if (!response.ok) return null;

		const result = await response.json();
		if (result.errors) return null;

		return result.data.slots;
	} catch {
		return null;
	}
}
