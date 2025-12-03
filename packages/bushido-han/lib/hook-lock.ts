import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { cpus, tmpdir } from "node:os";
import { join } from "node:path";

/**
 * Lock slot data stored in slot files
 */
interface LockSlot {
	pid: number;
	timestamp: number;
	hookName: string;
	pluginName?: string;
}

/**
 * Lock manager configuration
 */
interface LockManager {
	sessionId: string;
	parallelism: number;
	lockDir: string;
}

/**
 * Get the number of parallel hook slots allowed.
 * Reads from HAN_HOOK_PARALLELISM env var, defaults to CPU count / 2 (min 1).
 */
function getParallelism(): number {
	const envValue = process.env.HAN_HOOK_PARALLELISM;
	if (envValue) {
		const parsed = Number.parseInt(envValue, 10);
		if (!Number.isNaN(parsed) && parsed > 0) {
			return parsed;
		}
	}
	// Default: half the CPU count, minimum 1
	return Math.max(1, Math.floor(cpus().length / 2));
}

/**
 * Derive a session ID from available environment info.
 * Uses PPID + project directory to create a stable session identifier.
 */
function getSessionId(): string {
	// Allow explicit override for testing
	if (process.env.HAN_SESSION_ID) {
		return process.env.HAN_SESSION_ID;
	}

	// Use PPID - the parent of this process should be consistent within a Claude session
	const ppid = process.ppid;
	const projectDir = process.env.CLAUDE_PROJECT_DIR || process.cwd();

	return createHash("md5")
		.update(`${ppid}:${projectDir}`)
		.digest("hex")
		.substring(0, 16);
}

/**
 * Get the lock directory for a session
 */
function getLockDir(sessionId: string): string {
	return join(tmpdir(), "han-hooks", sessionId);
}

/**
 * Check if a process is still alive
 */
function isPidAlive(pid: number): boolean {
	try {
		// Sending signal 0 checks if process exists without actually signaling it
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get the stale lock timeout in milliseconds.
 * Defaults to 15 minutes.
 */
function getStaleLockTimeout(): number {
	const envValue = process.env.HAN_HOOK_LOCK_TIMEOUT;
	if (envValue) {
		const parsed = Number.parseInt(envValue, 10);
		if (!Number.isNaN(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return 15 * 60 * 1000; // 15 minutes
}

/**
 * Get the acquire timeout in milliseconds.
 * Defaults to 5 minutes.
 */
function getAcquireTimeout(): number {
	const envValue = process.env.HAN_HOOK_ACQUIRE_TIMEOUT;
	if (envValue) {
		const parsed = Number.parseInt(envValue, 10);
		if (!Number.isNaN(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return 5 * 60 * 1000; // 5 minutes
}

/**
 * Check if a lock slot is stale (process dead or too old)
 */
function isSlotStale(slot: LockSlot): boolean {
	// Check if PID is dead
	if (!isPidAlive(slot.pid)) {
		return true;
	}

	// Check if lock is too old (timeout fallback)
	const age = Date.now() - slot.timestamp;
	if (age > getStaleLockTimeout()) {
		return true;
	}

	return false;
}

/**
 * Read a slot file, returns null if doesn't exist or invalid
 */
function readSlotFile(slotPath: string): LockSlot | null {
	try {
		if (!existsSync(slotPath)) {
			return null;
		}
		const content = readFileSync(slotPath, "utf-8");
		return JSON.parse(content) as LockSlot;
	} catch {
		return null;
	}
}

/**
 * Write a slot file atomically
 */
function writeSlotFile(slotPath: string, slot: LockSlot): boolean {
	try {
		// Write to temp file first, then rename for atomicity
		const tempPath = `${slotPath}.${process.pid}.tmp`;
		writeFileSync(tempPath, JSON.stringify(slot), { flag: "wx" });

		// Check if slot was taken while we were writing
		if (existsSync(slotPath)) {
			rmSync(tempPath, { force: true });
			return false;
		}

		// Rename temp to final (atomic on most filesystems)
		const { renameSync } = require("node:fs");
		try {
			renameSync(tempPath, slotPath);
			return true;
		} catch {
			rmSync(tempPath, { force: true });
			return false;
		}
	} catch {
		return false;
	}
}

/**
 * Try to acquire an available slot, returns slot index or -1 if none available
 */
function tryAcquireSlot(
	manager: LockManager,
	hookName: string,
	pluginName?: string,
): number {
	// Ensure lock directory exists
	mkdirSync(manager.lockDir, { recursive: true });

	for (let i = 0; i < manager.parallelism; i++) {
		const slotPath = join(manager.lockDir, `slot-${i}.lock`);
		const existingSlot = readSlotFile(slotPath);

		if (existingSlot) {
			// Check if stale
			if (isSlotStale(existingSlot)) {
				// Remove stale lock
				try {
					rmSync(slotPath, { force: true });
				} catch {
					continue;
				}
			} else {
				// Slot is held by active process
				continue;
			}
		}

		// Try to acquire this slot
		const newSlot: LockSlot = {
			pid: process.pid,
			timestamp: Date.now(),
			hookName,
			pluginName,
		};

		if (writeSlotFile(slotPath, newSlot)) {
			return i;
		}
	}

	return -1; // No slots available
}

/**
 * Sleep for a given number of milliseconds
 */
function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Check if debug logging is enabled
 */
function isLockDebug(): boolean {
	return process.env.HAN_LOCK_DEBUG === "1";
}

/**
 * Log debug message if debug mode is enabled
 */
function debugLog(message: string): void {
	if (isLockDebug()) {
		console.error(`[han-lock] ${message}`);
	}
}

/**
 * Create a lock manager for the current session
 */
export function createLockManager(): LockManager {
	const sessionId = getSessionId();
	return {
		sessionId,
		parallelism: getParallelism(),
		lockDir: getLockDir(sessionId),
	};
}

/**
 * Acquire a slot, waiting if necessary.
 * Returns the slot index.
 * Throws if acquire timeout is exceeded.
 */
export async function acquireSlot(
	manager: LockManager,
	hookName: string,
	pluginName?: string,
): Promise<number> {
	const startTime = Date.now();
	const acquireTimeout = getAcquireTimeout();
	let attempt = 0;

	debugLog(
		`Acquiring slot for ${pluginName || "unknown"}:${hookName} (parallelism=${manager.parallelism})`,
	);

	while (true) {
		const slotIndex = tryAcquireSlot(manager, hookName, pluginName);

		if (slotIndex >= 0) {
			debugLog(
				`Acquired slot-${slotIndex} for ${pluginName || "unknown"}:${hookName}`,
			);
			return slotIndex;
		}

		// Check timeout
		const elapsed = Date.now() - startTime;
		if (elapsed > acquireTimeout) {
			throw new Error(
				`Timed out waiting for hook slot after ${Math.round(elapsed / 1000)}s. ` +
					`All ${manager.parallelism} slots are busy. ` +
					`Set HAN_HOOK_PARALLELISM to increase slots or HAN_HOOK_ACQUIRE_TIMEOUT to wait longer.`,
			);
		}

		// Wait with exponential backoff (100ms, 200ms, 400ms, ... up to 2s)
		const backoff = Math.min(100 * 2 ** attempt, 2000);
		attempt++;

		debugLog(
			`No slots available, waiting ${backoff}ms (attempt ${attempt}, elapsed ${Math.round(elapsed / 1000)}s)`,
		);

		await sleep(backoff);
	}
}

/**
 * Release a slot
 */
export function releaseSlot(manager: LockManager, slotIndex: number): void {
	const slotPath = join(manager.lockDir, `slot-${slotIndex}.lock`);

	try {
		// Verify we own this slot before deleting
		const slot = readSlotFile(slotPath);
		if (slot && slot.pid === process.pid) {
			rmSync(slotPath, { force: true });
			debugLog(`Released slot-${slotIndex}`);
		}
	} catch {
		// Ignore errors during cleanup
	}
}

/**
 * Cleanup all slots owned by this process (for graceful shutdown)
 */
export function cleanupOwnedSlots(manager: LockManager): void {
	try {
		for (let i = 0; i < manager.parallelism; i++) {
			const slotPath = join(manager.lockDir, `slot-${i}.lock`);
			const slot = readSlotFile(slotPath);
			if (slot && slot.pid === process.pid) {
				rmSync(slotPath, { force: true });
				debugLog(`Cleanup: released slot-${i}`);
			}
		}
	} catch {
		// Ignore errors during cleanup
	}
}

/**
 * Check if resource locking is enabled.
 * Can be disabled via HAN_HOOK_NO_LOCK=1
 */
export function isLockingEnabled(): boolean {
	return process.env.HAN_HOOK_NO_LOCK !== "1";
}

/**
 * Helper to run a function with slot acquisition/release
 */
export async function withSlot<T>(
	hookName: string,
	pluginName: string | undefined,
	fn: () => Promise<T>,
): Promise<T> {
	if (!isLockingEnabled()) {
		return fn();
	}

	const manager = createLockManager();
	const slotIndex = await acquireSlot(manager, hookName, pluginName);

	try {
		return await fn();
	} finally {
		releaseSlot(manager, slotIndex);
	}
}
