/**
 * Unit tests for hook-lock.ts
 * Tests the lock manager and slot management for parallel hook execution
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { cpus, tmpdir } from 'node:os';
import { join } from 'node:path';

// Import the module under test
import {
  acquireSlot,
  checkFailureSignal,
  cleanupOwnedSlots,
  clearFailureSignal,
  createLockManager,
  isLockingEnabled,
  releaseSlot,
  signalFailure,
  withSlot,
} from '../lib/hooks/index.ts';

// Store original environment
const originalEnv = { ...process.env };

function cleanupSession(sessionId: string): void {
  const lockDir = join(tmpdir(), 'han-hooks', sessionId);
  if (existsSync(lockDir)) {
    rmSync(lockDir, { recursive: true, force: true });
  }
}

function cleanupAllTestSessions(): void {
  const lockBase = join(tmpdir(), 'han-hooks');
  if (existsSync(lockBase)) {
    const dirs = readdirSync(lockBase);
    for (const dir of dirs) {
      if (dir.startsWith('test-')) {
        rmSync(join(lockBase, dir), { recursive: true, force: true });
      }
    }
  }
}

describe('hook-lock.ts', () => {
  beforeEach(() => {
    // Set short timeouts for testing
    process.env.HAN_HOOK_ACQUIRE_TIMEOUT = '5000';
    process.env.HAN_HOOK_LOCK_TIMEOUT = '1000';
  });

  afterEach(() => {
    cleanupAllTestSessions();
    process.env = { ...originalEnv };
  });

  describe('createLockManager', () => {
    test('uses HAN_SESSION_ID if set', () => {
      process.env.HAN_SESSION_ID = 'test-session-123';
      const manager = createLockManager();
      expect(manager.sessionId).toBe('test-session-123');
    });

    test('derives session ID from PPID and project dir', () => {
      delete process.env.HAN_SESSION_ID;
      process.env.CLAUDE_PROJECT_DIR = '/test/project';
      const manager = createLockManager();
      expect(manager.sessionId.length).toBe(16);
      expect(/^[a-f0-9]+$/.test(manager.sessionId)).toBe(true);
    });

    test('uses HAN_HOOK_PARALLELISM if set', () => {
      process.env.HAN_HOOK_PARALLELISM = '4';
      process.env.HAN_SESSION_ID = 'test-parallelism';
      const manager = createLockManager();
      expect(manager.parallelism).toBe(4);
    });

    test('defaults parallelism to CPU/2', () => {
      delete process.env.HAN_HOOK_PARALLELISM;
      process.env.HAN_SESSION_ID = 'test-default-parallelism';
      const manager = createLockManager();
      const expected = Math.max(1, Math.floor(cpus().length / 2));
      expect(manager.parallelism).toBe(expected);
    });

    test('creates correct lock directory path', () => {
      process.env.HAN_SESSION_ID = 'test-lock-dir';
      const manager = createLockManager();
      expect(manager.lockDir).toBe(
        join(tmpdir(), 'han-hooks', 'test-lock-dir')
      );
    });
  });

  describe('acquireSlot and releaseSlot', () => {
    test('creates lock directory and slot file', async () => {
      process.env.HAN_SESSION_ID = 'test-acquire-1';
      process.env.HAN_HOOK_PARALLELISM = '2';
      cleanupSession('test-acquire-1');
      const manager = createLockManager();

      const slotIndex = await acquireSlot(manager, 'test-hook', 'test-plugin');

      expect(slotIndex).toBeGreaterThanOrEqual(0);
      expect(existsSync(manager.lockDir)).toBe(true);

      const slotPath = join(manager.lockDir, `slot-${slotIndex}.lock`);
      expect(existsSync(slotPath)).toBe(true);

      const slotData = JSON.parse(readFileSync(slotPath, 'utf-8'));
      expect(slotData.pid).toBe(process.pid);
      expect(slotData.hookName).toBe('test-hook');
      expect(slotData.pluginName).toBe('test-plugin');

      releaseSlot(manager, slotIndex);
      expect(existsSync(slotPath)).toBe(false);
    });

    test('respects parallelism limit', async () => {
      process.env.HAN_SESSION_ID = 'test-parallelism-limit';
      process.env.HAN_HOOK_PARALLELISM = '2';
      cleanupSession('test-parallelism-limit');
      const manager = createLockManager();

      const slot0 = await acquireSlot(manager, 'hook1');
      const slot1 = await acquireSlot(manager, 'hook2');

      expect(slot0).toBeGreaterThanOrEqual(0);
      expect(slot1).toBeGreaterThanOrEqual(0);
      expect(slot0).not.toBe(slot1);

      const slotFiles = readdirSync(manager.lockDir).filter((f) =>
        f.endsWith('.lock')
      );
      expect(slotFiles.length).toBe(2);

      releaseSlot(manager, slot0);
      releaseSlot(manager, slot1);
    });

    test('only releases own slots', async () => {
      process.env.HAN_SESSION_ID = 'test-release-own';
      process.env.HAN_HOOK_PARALLELISM = '2';
      cleanupSession('test-release-own');
      const manager = createLockManager();

      const slotIndex = await acquireSlot(manager, 'test-hook');
      const slotPath = join(manager.lockDir, `slot-${slotIndex}.lock`);

      // Modify the slot file to have a different PID
      const slotData = JSON.parse(readFileSync(slotPath, 'utf-8'));
      slotData.pid = 99999;
      writeFileSync(slotPath, JSON.stringify(slotData));

      // Try to release - should NOT delete because PID doesn't match
      releaseSlot(manager, slotIndex);
      expect(existsSync(slotPath)).toBe(true);

      // Clean up
      rmSync(slotPath, { force: true });
    });
  });

  describe('stale lock detection', () => {
    test('cleans up stale locks from dead PID', async () => {
      process.env.HAN_SESSION_ID = 'test-stale-pid';
      process.env.HAN_HOOK_PARALLELISM = '1';
      cleanupSession('test-stale-pid');
      const manager = createLockManager();

      mkdirSync(manager.lockDir, { recursive: true });
      const staleLock = {
        pid: 99999,
        timestamp: Date.now(),
        hookName: 'stale-hook',
      };
      writeFileSync(
        join(manager.lockDir, 'slot-0.lock'),
        JSON.stringify(staleLock)
      );

      const slotIndex = await acquireSlot(manager, 'new-hook');
      expect(slotIndex).toBe(0);

      releaseSlot(manager, slotIndex);
    });

    test('cleans up stale locks from timeout', async () => {
      process.env.HAN_SESSION_ID = 'test-stale-timeout';
      process.env.HAN_HOOK_PARALLELISM = '1';
      process.env.HAN_HOOK_LOCK_TIMEOUT = '100';
      cleanupSession('test-stale-timeout');
      const manager = createLockManager();

      mkdirSync(manager.lockDir, { recursive: true });
      const oldLock = {
        pid: process.pid,
        timestamp: Date.now() - 200,
        hookName: 'old-hook',
      };
      writeFileSync(
        join(manager.lockDir, 'slot-0.lock'),
        JSON.stringify(oldLock)
      );

      const slotIndex = await acquireSlot(manager, 'new-hook');
      expect(slotIndex).toBe(0);

      releaseSlot(manager, slotIndex);
    });
  });

  describe('withSlot', () => {
    test('acquires and releases slot around function', async () => {
      process.env.HAN_SESSION_ID = 'test-withslot';
      process.env.HAN_HOOK_PARALLELISM = '1';
      cleanupSession('test-withslot');

      let slotAcquired = false;
      const manager = createLockManager();

      const result = await withSlot('test-hook', 'test-plugin', async () => {
        const slotFiles = readdirSync(manager.lockDir).filter((f) =>
          f.endsWith('.lock')
        );
        slotAcquired = slotFiles.length === 1;
        return 'test-result';
      });

      expect(result).toBe('test-result');
      expect(slotAcquired).toBe(true);

      const remainingSlots = existsSync(manager.lockDir)
        ? readdirSync(manager.lockDir).filter((f) => f.endsWith('.lock'))
        : [];
      expect(remainingSlots.length).toBe(0);
    });

    test('releases slot even on error', async () => {
      process.env.HAN_SESSION_ID = 'test-withslot-error';
      process.env.HAN_HOOK_PARALLELISM = '1';
      cleanupSession('test-withslot-error');
      const manager = createLockManager();

      let error: Error | null = null;
      try {
        await withSlot('test-hook', undefined, async () => {
          throw new Error('Test error');
        });
      } catch (e) {
        error = e as Error;
      }

      expect(error?.message).toBe('Test error');

      const remainingSlots = existsSync(manager.lockDir)
        ? readdirSync(manager.lockDir).filter((f) => f.endsWith('.lock'))
        : [];
      expect(remainingSlots.length).toBe(0);
    });

    test('bypasses locking when disabled', async () => {
      process.env.HAN_HOOK_NO_LOCK = '1';
      process.env.HAN_SESSION_ID = 'test-no-lock';
      const manager = createLockManager();

      const result = await withSlot('test-hook', undefined, async () => {
        return 'no-lock-result';
      });

      expect(result).toBe('no-lock-result');
      if (existsSync(manager.lockDir)) {
        const slotFiles = readdirSync(manager.lockDir).filter((f) =>
          f.endsWith('.lock')
        );
        expect(slotFiles.length).toBe(0);
      }
    });
  });

  describe('isLockingEnabled', () => {
    test('returns true by default', () => {
      delete process.env.HAN_HOOK_NO_LOCK;
      expect(isLockingEnabled()).toBe(true);
    });

    test('returns false when HAN_HOOK_NO_LOCK=1', () => {
      process.env.HAN_HOOK_NO_LOCK = '1';
      expect(isLockingEnabled()).toBe(false);
    });
  });

  describe('cleanupOwnedSlots', () => {
    test('removes all slots owned by current process', async () => {
      process.env.HAN_SESSION_ID = 'test-cleanup';
      process.env.HAN_HOOK_PARALLELISM = '3';
      cleanupSession('test-cleanup');
      const manager = createLockManager();

      await acquireSlot(manager, 'hook1');
      await acquireSlot(manager, 'hook2');

      // Create a slot owned by different PID
      const otherSlot = {
        pid: 99999,
        timestamp: Date.now(),
        hookName: 'other-hook',
      };
      writeFileSync(
        join(manager.lockDir, 'slot-2.lock'),
        JSON.stringify(otherSlot)
      );

      cleanupOwnedSlots(manager);

      const remaining = readdirSync(manager.lockDir).filter((f) =>
        f.endsWith('.lock')
      );
      expect(remaining.length).toBe(1);
      expect(remaining[0]).toBe('slot-2.lock');

      rmSync(join(manager.lockDir, 'slot-2.lock'), { force: true });
    });
  });

  describe('failure signaling', () => {
    test('signalFailure creates failure sentinel file', () => {
      process.env.HAN_SESSION_ID = 'test-signal-failure';
      cleanupSession('test-signal-failure');
      const manager = createLockManager();

      signalFailure(manager, {
        pluginName: 'test-plugin',
        hookName: 'test-hook',
        directory: 'test-dir',
      });

      const sentinelPath = join(manager.lockDir, 'failure.sentinel');
      expect(existsSync(sentinelPath)).toBe(true);

      const content = JSON.parse(readFileSync(sentinelPath, 'utf-8'));
      expect(content.pluginName).toBe('test-plugin');
      expect(content.hookName).toBe('test-hook');
      expect(content.directory).toBe('test-dir');
      expect(content.pid).toBe(process.pid);
    });

    test('checkFailureSignal returns null when no failure', () => {
      process.env.HAN_SESSION_ID = 'test-no-failure';
      cleanupSession('test-no-failure');
      const manager = createLockManager();

      const result = checkFailureSignal(manager);
      expect(result).toBeNull();
    });

    test('checkFailureSignal returns failure info when signaled', () => {
      process.env.HAN_SESSION_ID = 'test-check-failure';
      cleanupSession('test-check-failure');
      const manager = createLockManager();

      signalFailure(manager, {
        pluginName: 'failing-plugin',
        hookName: 'failing-hook',
      });

      const result = checkFailureSignal(manager);
      expect(result).not.toBeNull();
      expect(result?.pluginName).toBe('failing-plugin');
      expect(result?.hookName).toBe('failing-hook');
    });

    test('clearFailureSignal removes sentinel file', () => {
      process.env.HAN_SESSION_ID = 'test-clear-failure';
      cleanupSession('test-clear-failure');
      const manager = createLockManager();

      signalFailure(manager, { pluginName: 'test' });
      expect(checkFailureSignal(manager)).not.toBeNull();

      clearFailureSignal(manager);
      expect(checkFailureSignal(manager)).toBeNull();
    });

    test('failure signal works across same session', () => {
      process.env.HAN_SESSION_ID = 'test-shared-session';
      cleanupSession('test-shared-session');

      const manager1 = createLockManager();
      const manager2 = createLockManager();

      expect(manager1.sessionId).toBe(manager2.sessionId);

      signalFailure(manager1, { pluginName: 'plugin1', hookName: 'hook1' });

      const result = checkFailureSignal(manager2);
      expect(result).not.toBeNull();
      expect(result?.pluginName).toBe('plugin1');
    });
  });
});
