/**
 * Global Slot Management
 *
 * Manages a global pool of execution slots across all Claude sessions.
 * This ensures resource-intensive operations (like playwright tests)
 * don't overwhelm the system when multiple sessions are running.
 */

import { cpus } from "node:os";
import { builder } from "../builder.ts";

/**
 * Individual slot data
 */
interface Slot {
	id: number;
	sessionId: string;
	hookName: string;
	pluginName?: string;
	pid: number;
	acquiredAt: number;
	lastHeartbeat: number;
}

/**
 * Stale slot timeout - slots held longer than this are force-released
 * Default: 30 minutes (allows for long-running tests but catches zombies)
 */
const STALE_SLOT_TIMEOUT_MS = 30 * 60 * 1000;

/**
 * Debug logging for slot operations
 */
function debugLog(message: string): void {
	if (process.env.HAN_SLOT_DEBUG === "1") {
		console.error(`[slot-manager] ${message}`);
	}
}

/**
 * Global slot pool state - singleton managed by coordinator
 */
class GlobalSlotManager {
	private slots: Map<number, Slot> = new Map();
	private maxSlots: number;
	private cleanupInterval: NodeJS.Timeout | null = null;

	constructor() {
		// Default: half CPU count, minimum 2 for some parallelism
		const envValue = process.env.HAN_GLOBAL_SLOTS;
		if (envValue) {
			const parsed = Number.parseInt(envValue, 10);
			if (!Number.isNaN(parsed) && parsed > 0) {
				this.maxSlots = parsed;
			} else {
				this.maxSlots = Math.max(2, Math.floor(cpus().length / 2));
			}
		} else {
			this.maxSlots = Math.max(2, Math.floor(cpus().length / 2));
		}
	}

	/**
	 * Start periodic cleanup of dead slots
	 */
	start(): void {
		if (this.cleanupInterval) return;

		// Check for dead processes every 5 seconds for fast recovery
		this.cleanupInterval = setInterval(() => {
			const cleaned = this.cleanupDeadSlots();
			if (cleaned > 0) {
				console.log(`[slot-manager] Cleaned ${cleaned} dead/stale slots`);
			}
		}, 5000);
	}

	/**
	 * Stop the cleanup interval
	 */
	stop(): void {
		if (this.cleanupInterval) {
			clearInterval(this.cleanupInterval);
			this.cleanupInterval = null;
		}
		this.slots.clear();
	}

	/**
	 * Check if a process is still alive
	 */
	private isPidAlive(pid: number): boolean {
		try {
			process.kill(pid, 0);
			return true;
		} catch {
			return false;
		}
	}

	/**
	 * Clean up slots held by dead processes or stale slots
	 * Returns the number of slots cleaned
	 */
	private cleanupDeadSlots(): number {
		let cleaned = 0;
		const now = Date.now();

		for (const [slotId, slot] of this.slots) {
			const isDead = !this.isPidAlive(slot.pid);
			// Use lastHeartbeat for stale check - allows long-running tasks to send heartbeats
			const isStale = now - slot.lastHeartbeat > STALE_SLOT_TIMEOUT_MS;

			if (isDead || isStale) {
				debugLog(
					`Cleaning slot ${slotId}: pid=${slot.pid} dead=${isDead} stale=${isStale} hook=${slot.pluginName}:${slot.hookName}`,
				);
				this.slots.delete(slotId);
				cleaned++;
			}
		}

		return cleaned;
	}

	/**
	 * Try to acquire a slot
	 * Returns slot ID if acquired, -1 if no slots available
	 */
	acquire(
		sessionId: string,
		hookName: string,
		pid: number,
		pluginName?: string,
	): number {
		// First, clean up any dead slots
		this.cleanupDeadSlots();

		// Find an available slot
		for (let i = 0; i < this.maxSlots; i++) {
			if (!this.slots.has(i)) {
				const now = Date.now();
				const slot: Slot = {
					id: i,
					sessionId,
					hookName,
					pluginName,
					pid,
					acquiredAt: now,
					lastHeartbeat: now,
				};
				this.slots.set(i, slot);
				debugLog(
					`Acquired slot ${i} for pid=${pid} hook=${pluginName}:${hookName}`,
				);
				return i;
			}
		}

		debugLog(`No slots available (${this.slots.size}/${this.maxSlots} in use)`);
		return -1; // No slots available
	}

	/**
	 * Release a slot
	 * Returns true if released, false if not found or not owned by pid
	 */
	release(slotId: number, pid: number): boolean {
		const slot = this.slots.get(slotId);
		if (slot && slot.pid === pid) {
			const heldFor = Date.now() - slot.acquiredAt;
			debugLog(
				`Released slot ${slotId} for pid=${pid} (held for ${Math.round(heldFor / 1000)}s)`,
			);
			this.slots.delete(slotId);
			return true;
		}
		debugLog(`Failed to release slot ${slotId} for pid=${pid} (not owned)`);
		return false;
	}

	/**
	 * Update heartbeat for a slot (prevents stale cleanup for long-running tasks)
	 * Returns true if updated, false if not found or not owned
	 */
	heartbeat(slotId: number, pid: number): boolean {
		const slot = this.slots.get(slotId);
		if (slot && slot.pid === pid) {
			slot.lastHeartbeat = Date.now();
			return true;
		}
		return false;
	}

	/**
	 * Force release a slot (used by cleanup)
	 */
	forceRelease(slotId: number): boolean {
		return this.slots.delete(slotId);
	}

	/**
	 * Get current slot status
	 */
	getStatus(): {
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
	} {
		this.cleanupDeadSlots();

		const now = Date.now();
		const active = Array.from(this.slots.values()).map((slot) => ({
			slotId: slot.id,
			sessionId: slot.sessionId,
			hookName: slot.hookName,
			pluginName: slot.pluginName,
			pid: slot.pid,
			heldForMs: now - slot.acquiredAt,
		}));

		return {
			total: this.maxSlots,
			available: this.maxSlots - this.slots.size,
			active,
		};
	}

	/**
	 * Check if a specific hook is running
	 */
	isHookRunning(pluginName: string, hookName: string): boolean {
		for (const slot of this.slots.values()) {
			if (slot.pluginName === pluginName && slot.hookName === hookName) {
				if (this.isPidAlive(slot.pid)) {
					return true;
				}
			}
		}
		return false;
	}
}

// Singleton instance
export const globalSlotManager = new GlobalSlotManager();

// ==================== GraphQL Types ====================

/**
 * Active slot information
 */
const ActiveSlotType = builder.objectRef<{
	slotId: number;
	sessionId: string;
	hookName: string;
	pluginName?: string;
	pid: number;
	heldForMs: number;
}>("ActiveSlot");

ActiveSlotType.implement({
	description: "Information about an active slot",
	fields: (t) => ({
		slotId: t.exposeInt("slotId", { description: "Slot identifier" }),
		sessionId: t.exposeString("sessionId", {
			description: "Session that owns this slot",
		}),
		hookName: t.exposeString("hookName", {
			description: "Hook currently running",
		}),
		pluginName: t.exposeString("pluginName", {
			nullable: true,
			description: "Plugin that owns the hook",
		}),
		pid: t.exposeInt("pid", { description: "Process ID holding the slot" }),
		heldForMs: t.exposeInt("heldForMs", {
			description: "How long the slot has been held in milliseconds",
		}),
	}),
});

/**
 * Slot status query result
 */
export const SlotStatusType = builder.objectRef<{
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
}>("SlotStatus");

SlotStatusType.implement({
	description: "Global slot pool status",
	fields: (t) => ({
		total: t.exposeInt("total", { description: "Total number of slots" }),
		available: t.exposeInt("available", {
			description: "Number of available slots",
		}),
		active: t.field({
			type: [ActiveSlotType],
			description: "Currently active slots",
			resolve: (parent) => parent.active,
		}),
	}),
});

/**
 * Slot acquire result
 */
export const SlotAcquireResultType = builder.objectRef<{
	granted: boolean;
	slotId: number;
	waitingCount: number;
}>("SlotAcquireResult");

SlotAcquireResultType.implement({
	description: "Result of slot acquisition attempt",
	fields: (t) => ({
		granted: t.exposeBoolean("granted", {
			description: "Whether the slot was granted",
		}),
		slotId: t.exposeInt("slotId", {
			description: "Slot ID if granted, -1 otherwise",
		}),
		waitingCount: t.exposeInt("waitingCount", {
			description: "Number of slots currently in use (if not granted)",
		}),
	}),
});

/**
 * Slot release result
 */
export const SlotReleaseResultType = builder.objectRef<{
	success: boolean;
	message: string;
}>("SlotReleaseResult");

SlotReleaseResultType.implement({
	description: "Result of slot release",
	fields: (t) => ({
		success: t.exposeBoolean("success", {
			description: "Whether the slot was released",
		}),
		message: t.exposeString("message", { description: "Result message" }),
	}),
});

// ==================== Query/Mutation Helpers ====================

/**
 * Get current slot status
 */
export function querySlotStatus() {
	return globalSlotManager.getStatus();
}

/**
 * Acquire a slot
 */
export function acquireSlot(
	sessionId: string,
	hookName: string,
	pid: number,
	pluginName?: string,
): { granted: boolean; slotId: number; waitingCount: number } {
	const slotId = globalSlotManager.acquire(
		sessionId,
		hookName,
		pid,
		pluginName,
	);
	const status = globalSlotManager.getStatus();

	return {
		granted: slotId >= 0,
		slotId,
		waitingCount: status.total - status.available,
	};
}

/**
 * Release a slot
 */
export function releaseSlot(
	slotId: number,
	pid: number,
): { success: boolean; message: string } {
	const released = globalSlotManager.release(slotId, pid);
	return {
		success: released,
		message: released
			? `Slot ${slotId} released`
			: `Failed to release slot ${slotId} (not found or not owned)`,
	};
}

/**
 * Check if a hook is running
 */
export function isHookRunning(pluginName: string, hookName: string): boolean {
	return globalSlotManager.isHookRunning(pluginName, hookName);
}
