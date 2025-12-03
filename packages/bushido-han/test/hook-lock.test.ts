import { deepStrictEqual, strictEqual } from "node:assert";
import { execSync, spawn } from "node:child_process";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	readdirSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

// Import the module under test
import {
	acquireSlot,
	createLockManager,
	releaseSlot,
	cleanupOwnedSlots,
	isLockingEnabled,
	withSlot,
} from "../lib/hook-lock.js";

let testsPassed = 0;
let testsFailed = 0;

async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
	try {
		await fn();
		console.log(`✓ ${name}`);
		testsPassed++;
	} catch (error) {
		console.error(`✗ ${name}`);
		console.error(`  ${(error as Error).message}`);
		testsFailed++;
	}
}

async function runTests(): Promise<void> {
	const originalEnv = { ...process.env };

	// ============================================
	// Setup - set short timeouts for testing
	// ============================================
	process.env.HAN_HOOK_ACQUIRE_TIMEOUT = "5000"; // 5 seconds
	process.env.HAN_HOOK_LOCK_TIMEOUT = "1000"; // 1 second

	function cleanup(): void {
		// Clean up any test lock directories
		const lockBase = join(tmpdir(), "han-hooks");
		if (existsSync(lockBase)) {
			const dirs = readdirSync(lockBase);
			for (const dir of dirs) {
				if (dir.startsWith("test-")) {
					rmSync(join(lockBase, dir), { recursive: true, force: true });
				}
			}
		}
		// Restore env but keep test timeouts
		const timeoutEnv = {
			HAN_HOOK_ACQUIRE_TIMEOUT: process.env.HAN_HOOK_ACQUIRE_TIMEOUT,
			HAN_HOOK_LOCK_TIMEOUT: process.env.HAN_HOOK_LOCK_TIMEOUT,
		};
		process.env = { ...originalEnv, ...timeoutEnv };
	}

	// Clean up a specific session's lock directory
	function cleanupSession(sessionId: string): void {
		const lockDir = join(tmpdir(), "han-hooks", sessionId);
		if (existsSync(lockDir)) {
			rmSync(lockDir, { recursive: true, force: true });
		}
	}

	cleanup();

	// ============================================
	// createLockManager tests
	// ============================================

	await test("createLockManager uses HAN_SESSION_ID if set", async () => {
		process.env.HAN_SESSION_ID = "test-session-123";
		const manager = createLockManager();
		strictEqual(manager.sessionId, "test-session-123");
		delete process.env.HAN_SESSION_ID;
	});

	await test("createLockManager derives session ID from PPID and project dir", async () => {
		delete process.env.HAN_SESSION_ID;
		process.env.CLAUDE_PROJECT_DIR = "/test/project";
		const manager = createLockManager();
		strictEqual(manager.sessionId.length, 16, "Session ID should be 16 chars");
		strictEqual(/^[a-f0-9]+$/.test(manager.sessionId), true, "Session ID should be hex");
		delete process.env.CLAUDE_PROJECT_DIR;
	});

	await test("createLockManager uses HAN_HOOK_PARALLELISM if set", async () => {
		process.env.HAN_HOOK_PARALLELISM = "4";
		process.env.HAN_SESSION_ID = "test-parallelism";
		const manager = createLockManager();
		strictEqual(manager.parallelism, 4);
		delete process.env.HAN_HOOK_PARALLELISM;
		delete process.env.HAN_SESSION_ID;
	});

	await test("createLockManager defaults parallelism to CPU/2", async () => {
		delete process.env.HAN_HOOK_PARALLELISM;
		process.env.HAN_SESSION_ID = "test-default-parallelism";
		const manager = createLockManager();
		const { cpus } = await import("node:os");
		const expected = Math.max(1, Math.floor(cpus().length / 2));
		strictEqual(manager.parallelism, expected);
		delete process.env.HAN_SESSION_ID;
	});

	// ============================================
	// acquireSlot / releaseSlot tests
	// ============================================

	await test("acquireSlot creates lock directory and slot file", async () => {
		process.env.HAN_SESSION_ID = "test-acquire-1";
		process.env.HAN_HOOK_PARALLELISM = "2";
		cleanupSession("test-acquire-1");
		const manager = createLockManager();

		const slotIndex = await acquireSlot(manager, "test-hook", "test-plugin");

		strictEqual(slotIndex >= 0, true, "Should acquire a slot");
		strictEqual(existsSync(manager.lockDir), true, "Lock dir should exist");

		const slotPath = join(manager.lockDir, `slot-${slotIndex}.lock`);
		strictEqual(existsSync(slotPath), true, "Slot file should exist");

		const slotData = JSON.parse(readFileSync(slotPath, "utf-8"));
		strictEqual(slotData.pid, process.pid);
		strictEqual(slotData.hookName, "test-hook");
		strictEqual(slotData.pluginName, "test-plugin");

		releaseSlot(manager, slotIndex);
		strictEqual(existsSync(slotPath), false, "Slot file should be removed after release");

		delete process.env.HAN_SESSION_ID;
		delete process.env.HAN_HOOK_PARALLELISM;
	});

	await test("acquireSlot respects parallelism limit", async () => {
		process.env.HAN_SESSION_ID = "test-parallelism-limit";
		process.env.HAN_HOOK_PARALLELISM = "2";
		cleanupSession("test-parallelism-limit");
		const manager = createLockManager();

		// Acquire both slots
		const slot0 = await acquireSlot(manager, "hook1");
		const slot1 = await acquireSlot(manager, "hook2");

		strictEqual(slot0 >= 0, true);
		strictEqual(slot1 >= 0, true);
		strictEqual(slot0 !== slot1, true, "Should be different slots");

		// Both slots should be taken
		const slotFiles = readdirSync(manager.lockDir).filter((f) => f.endsWith(".lock"));
		strictEqual(slotFiles.length, 2);

		releaseSlot(manager, slot0);
		releaseSlot(manager, slot1);

		delete process.env.HAN_SESSION_ID;
		delete process.env.HAN_HOOK_PARALLELISM;
	});

	await test("releaseSlot only releases own slots", async () => {
		process.env.HAN_SESSION_ID = "test-release-own";
		process.env.HAN_HOOK_PARALLELISM = "2";
		cleanupSession("test-release-own");
		const manager = createLockManager();

		const slotIndex = await acquireSlot(manager, "test-hook");
		const slotPath = join(manager.lockDir, `slot-${slotIndex}.lock`);

		// Modify the slot file to have a different PID
		const slotData = JSON.parse(readFileSync(slotPath, "utf-8"));
		slotData.pid = 99999; // Different PID
		writeFileSync(slotPath, JSON.stringify(slotData));

		// Try to release - should NOT delete because PID doesn't match
		releaseSlot(manager, slotIndex);
		strictEqual(existsSync(slotPath), true, "Should not release slot owned by different PID");

		// Clean up
		rmSync(slotPath, { force: true });

		delete process.env.HAN_SESSION_ID;
		delete process.env.HAN_HOOK_PARALLELISM;
	});

	// ============================================
	// Stale lock detection tests
	// ============================================

	await test("acquireSlot cleans up stale locks (dead PID)", async () => {
		process.env.HAN_SESSION_ID = "test-stale-pid";
		process.env.HAN_HOOK_PARALLELISM = "1";
		cleanupSession("test-stale-pid");
		const manager = createLockManager();

		// Create a stale lock with a dead PID
		mkdirSync(manager.lockDir, { recursive: true });
		const staleLock = {
			pid: 99999, // Non-existent PID
			timestamp: Date.now(),
			hookName: "stale-hook",
		};
		writeFileSync(join(manager.lockDir, "slot-0.lock"), JSON.stringify(staleLock));

		// Should be able to acquire despite the stale lock
		const slotIndex = await acquireSlot(manager, "new-hook");
		strictEqual(slotIndex, 0, "Should acquire slot 0 after cleaning stale lock");

		releaseSlot(manager, slotIndex);

		delete process.env.HAN_SESSION_ID;
		delete process.env.HAN_HOOK_PARALLELISM;
	});

	await test("acquireSlot cleans up stale locks (timeout)", async () => {
		process.env.HAN_SESSION_ID = "test-stale-timeout";
		process.env.HAN_HOOK_PARALLELISM = "1";
		process.env.HAN_HOOK_LOCK_TIMEOUT = "100"; // 100ms timeout for testing
		cleanupSession("test-stale-timeout");
		const manager = createLockManager();

		// Create a lock that's older than the timeout
		mkdirSync(manager.lockDir, { recursive: true });
		const oldLock = {
			pid: process.pid, // Our own PID (still alive)
			timestamp: Date.now() - 200, // 200ms ago
			hookName: "old-hook",
		};
		writeFileSync(join(manager.lockDir, "slot-0.lock"), JSON.stringify(oldLock));

		// Should be able to acquire because the lock is stale (timeout)
		const slotIndex = await acquireSlot(manager, "new-hook");
		strictEqual(slotIndex, 0, "Should acquire slot 0 after timeout");

		releaseSlot(manager, slotIndex);

		delete process.env.HAN_SESSION_ID;
		delete process.env.HAN_HOOK_PARALLELISM;
		delete process.env.HAN_HOOK_LOCK_TIMEOUT;
	});

	// ============================================
	// withSlot tests
	// ============================================

	await test("withSlot acquires and releases slot around function", async () => {
		process.env.HAN_SESSION_ID = "test-withslot";
		process.env.HAN_HOOK_PARALLELISM = "1";
		cleanupSession("test-withslot");

		let slotAcquired = false;
		const manager = createLockManager();

		const result = await withSlot("test-hook", "test-plugin", async () => {
			// Check that slot is held
			const slotFiles = readdirSync(manager.lockDir).filter((f) => f.endsWith(".lock"));
			slotAcquired = slotFiles.length === 1;
			return "test-result";
		});

		strictEqual(result, "test-result");
		strictEqual(slotAcquired, true, "Slot should be acquired during function execution");

		// After withSlot, slot should be released
		const remainingSlots = existsSync(manager.lockDir)
			? readdirSync(manager.lockDir).filter((f) => f.endsWith(".lock"))
			: [];
		strictEqual(remainingSlots.length, 0, "Slot should be released after function");

		delete process.env.HAN_SESSION_ID;
		delete process.env.HAN_HOOK_PARALLELISM;
	});

	await test("withSlot releases slot even on error", async () => {
		process.env.HAN_SESSION_ID = "test-withslot-error";
		process.env.HAN_HOOK_PARALLELISM = "1";
		cleanupSession("test-withslot-error");
		const manager = createLockManager();

		let error: Error | null = null;
		try {
			await withSlot("test-hook", undefined, async () => {
				throw new Error("Test error");
			});
		} catch (e) {
			error = e as Error;
		}

		strictEqual(error?.message, "Test error");

		// Slot should still be released
		const remainingSlots = existsSync(manager.lockDir)
			? readdirSync(manager.lockDir).filter((f) => f.endsWith(".lock"))
			: [];
		strictEqual(remainingSlots.length, 0, "Slot should be released after error");

		delete process.env.HAN_SESSION_ID;
		delete process.env.HAN_HOOK_PARALLELISM;
	});

	// ============================================
	// isLockingEnabled tests
	// ============================================

	await test("isLockingEnabled returns true by default", async () => {
		delete process.env.HAN_HOOK_NO_LOCK;
		strictEqual(isLockingEnabled(), true);
	});

	await test("isLockingEnabled returns false when HAN_HOOK_NO_LOCK=1", async () => {
		process.env.HAN_HOOK_NO_LOCK = "1";
		strictEqual(isLockingEnabled(), false);
		delete process.env.HAN_HOOK_NO_LOCK;
	});

	await test("withSlot bypasses locking when disabled", async () => {
		process.env.HAN_HOOK_NO_LOCK = "1";
		process.env.HAN_SESSION_ID = "test-no-lock";

		const manager = createLockManager();

		const result = await withSlot("test-hook", undefined, async () => {
			// No lock dir should be created
			return "no-lock-result";
		});

		strictEqual(result, "no-lock-result");
		// Lock directory might not exist at all when locking is disabled
		if (existsSync(manager.lockDir)) {
			const slotFiles = readdirSync(manager.lockDir).filter((f) => f.endsWith(".lock"));
			strictEqual(slotFiles.length, 0, "No slot files when locking disabled");
		}

		delete process.env.HAN_HOOK_NO_LOCK;
		delete process.env.HAN_SESSION_ID;
	});

	// ============================================
	// cleanupOwnedSlots tests
	// ============================================

	await test("cleanupOwnedSlots removes all slots owned by current process", async () => {
		process.env.HAN_SESSION_ID = "test-cleanup";
		process.env.HAN_HOOK_PARALLELISM = "3";
		cleanupSession("test-cleanup");
		const manager = createLockManager();

		// Acquire multiple slots
		const slot0 = await acquireSlot(manager, "hook1");
		const slot1 = await acquireSlot(manager, "hook2");

		// Create a slot owned by different PID
		const otherSlot = {
			pid: 99999,
			timestamp: Date.now(),
			hookName: "other-hook",
		};
		writeFileSync(join(manager.lockDir, "slot-2.lock"), JSON.stringify(otherSlot));

		// Cleanup
		cleanupOwnedSlots(manager);

		// Only our slots should be removed
		const remaining = readdirSync(manager.lockDir).filter((f) => f.endsWith(".lock"));
		strictEqual(remaining.length, 1, "Only foreign slot should remain");
		strictEqual(remaining[0], "slot-2.lock");

		// Clean up foreign slot
		rmSync(join(manager.lockDir, "slot-2.lock"), { force: true });

		delete process.env.HAN_SESSION_ID;
		delete process.env.HAN_HOOK_PARALLELISM;
	});

	// ============================================
	// Cleanup and summary
	// ============================================

	cleanup();

	console.log(`\n${testsPassed} passed, ${testsFailed} failed`);

	if (testsFailed > 0) {
		process.exit(1);
	}
}

runTests().catch((error) => {
	console.error("Test runner error:", error);
	process.exit(1);
});
