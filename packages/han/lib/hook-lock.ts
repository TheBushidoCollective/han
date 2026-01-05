import { createHash } from "node:crypto";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	renameSync,
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
 * Defaults to 60 minutes (tasks can run for a long time).
 */
function getAcquireTimeout(): number {
	const envValue = process.env.HAN_HOOK_ACQUIRE_TIMEOUT;
	if (envValue) {
		const parsed = Number.parseInt(envValue, 10);
		if (!Number.isNaN(parsed) && parsed > 0) {
			return parsed;
		}
	}
	return 60 * 60 * 1000; // 60 minutes
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
		// Use timestamp + pid to avoid collisions with leftover temp files
		const tempPath = `${slotPath}.${process.pid}.${Date.now()}.tmp`;
		writeFileSync(tempPath, JSON.stringify(slot));

		// Check if slot was taken while we were writing
		if (existsSync(slotPath)) {
			debugLog(`writeSlotFile: slot already exists at ${slotPath}`);
			rmSync(tempPath, { force: true });
			return false;
		}

		// Rename temp to final (atomic on most filesystems)
		try {
			renameSync(tempPath, slotPath);
			return true;
		} catch (e) {
			debugLog(`writeSlotFile: rename failed: ${(e as Error).message}`);
			rmSync(tempPath, { force: true });
			return false;
		}
	} catch (e) {
		debugLog(`writeSlotFile: write failed: ${(e as Error).message}`);
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
		debugLog(
			`tryAcquireSlot: slot-${i} existingSlot=${existingSlot ? JSON.stringify(existingSlot) : "null"}`,
		);

		if (existingSlot) {
			// Check if stale
			if (isSlotStale(existingSlot)) {
				debugLog(`tryAcquireSlot: slot-${i} is stale, removing`);
				// Remove stale lock
				try {
					rmSync(slotPath, { force: true });
				} catch {
					continue;
				}
			} else {
				// Slot is held by active process
				debugLog(
					`tryAcquireSlot: slot-${i} is held by pid ${existingSlot.pid}`,
				);
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
		debugLog(`tryAcquireSlot: slot-${i} write failed`);
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
 * Get the path to the failure sentinel file for this session.
 */
function getFailureSentinelPath(manager: LockManager): string {
	return join(manager.lockDir, "failure.sentinel");
}

/**
 * Signal that a hook has failed.
 * Other hooks in the same session can check for this and exit early.
 */
export function signalFailure(
	manager: LockManager,
	info?: { pluginName?: string; hookName?: string; directory?: string },
): void {
	try {
		mkdirSync(manager.lockDir, { recursive: true });
		const sentinelPath = getFailureSentinelPath(manager);
		const content = JSON.stringify({
			pid: process.pid,
			timestamp: Date.now(),
			...info,
		});
		writeFileSync(sentinelPath, content);
		debugLog(
			`Signaled failure: ${info?.pluginName || "unknown"}/${info?.hookName || "unknown"}`,
		);
	} catch (e) {
		debugLog(`Failed to signal failure: ${(e as Error).message}`);
	}
}

/**
 * Check if any hook in this session has signaled failure.
 * Returns failure info if a sentinel exists, null otherwise.
 */
export function checkFailureSignal(
	manager: LockManager,
): { pluginName?: string; hookName?: string; directory?: string } | null {
	try {
		const sentinelPath = getFailureSentinelPath(manager);
		if (!existsSync(sentinelPath)) {
			return null;
		}
		const content = readFileSync(sentinelPath, "utf-8");
		const data = JSON.parse(content);
		debugLog(`Found failure signal from pid ${data.pid}`);
		return data;
	} catch {
		return null;
	}
}

/**
 * Clear the failure signal (called at session start or cleanup).
 */
export function clearFailureSignal(manager: LockManager): void {
	try {
		const sentinelPath = getFailureSentinelPath(manager);
		if (existsSync(sentinelPath)) {
			rmSync(sentinelPath, { force: true });
			debugLog("Cleared failure signal");
		}
	} catch {
		// Ignore errors during cleanup
	}
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

/**
 * Helper to run a function with global slot coordination.
 * Uses the coordinator's global slot pool when available for cross-session coordination.
 * Falls back to local per-session slots when coordinator is unavailable.
 *
 * Use this for resource-intensive operations like playwright tests where you want
 * to prevent multiple sessions from overwhelming the system.
 */
export async function withGlobalSlot<T>(
	hookName: string,
	pluginName: string | undefined,
	fn: () => Promise<T>,
): Promise<T> {
	if (!isLockingEnabled()) {
		return fn();
	}

	// Use the slot client which handles coordinator detection and fallback
	const { withGlobalSlot: clientWithGlobalSlot } = await import(
		"./hooks/slot-client.ts"
	);

	const sessionId = getSessionId();
	return clientWithGlobalSlot(sessionId, hookName, pluginName, fn);
}

/**
 * Check if a specific plugin:hook is currently running in any slot.
 * Used for dependency coordination - if the dependency hook is already running,
 * we should wait for it rather than spawn another instance.
 */
export function isHookRunning(
	manager: LockManager,
	pluginName: string,
	hookName: string,
): boolean {
	try {
		if (!existsSync(manager.lockDir)) {
			return false;
		}

		for (let i = 0; i < manager.parallelism; i++) {
			const slotPath = join(manager.lockDir, `slot-${i}.lock`);
			const slot = readSlotFile(slotPath);

			if (slot && !isSlotStale(slot)) {
				// Check if this slot matches the plugin:hook we're looking for
				if (slot.pluginName === pluginName && slot.hookName === hookName) {
					debugLog(
						`isHookRunning: found ${pluginName}:${hookName} running in slot-${i} (pid ${slot.pid})`,
					);
					return true;
				}
			}
		}

		return false;
	} catch (e) {
		debugLog(`isHookRunning error: ${(e as Error).message}`);
		return false;
	}
}

/**
 * Wait for a specific plugin:hook to complete.
 * Polls the lock files until the hook is no longer running or timeout is reached.
 *
 * @param manager - The lock manager for this session
 * @param pluginName - The plugin name to wait for
 * @param hookName - The hook name to wait for
 * @param timeout - Maximum time to wait in milliseconds (default: 5 minutes)
 * @returns true if the hook completed, false if timeout was reached
 */
export async function waitForHook(
	manager: LockManager,
	pluginName: string,
	hookName: string,
	timeout = 300000, // 5 minutes default
): Promise<boolean> {
	const startTime = Date.now();
	let attempt = 0;

	debugLog(
		`waitForHook: waiting for ${pluginName}:${hookName} (timeout: ${timeout}ms)`,
	);

	while (true) {
		// Check if hook is still running
		if (!isHookRunning(manager, pluginName, hookName)) {
			debugLog(`waitForHook: ${pluginName}:${hookName} is no longer running`);
			return true; // Hook completed
		}

		// Check timeout
		const elapsed = Date.now() - startTime;
		if (elapsed > timeout) {
			debugLog(
				`waitForHook: timeout waiting for ${pluginName}:${hookName} after ${Math.round(elapsed / 1000)}s`,
			);
			return false; // Timeout reached
		}

		// Wait with exponential backoff (100ms, 200ms, 400ms, ... up to 2s)
		const backoff = Math.min(100 * 2 ** attempt, 2000);
		attempt++;

		debugLog(
			`waitForHook: ${pluginName}:${hookName} still running, waiting ${backoff}ms (attempt ${attempt})`,
		);

		await sleep(backoff);
	}
}

/**
 * Get the lock manager session ID.
 * Useful for coordinating between processes.
 */
export function getSessionIdFromManager(manager: LockManager): string {
	return manager.sessionId;
}
