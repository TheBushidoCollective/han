/**
 * Tests for Deferred Hook Execution System
 *
 * Tests the database layer (hookAttempts, deferredHooks), MCP tools
 * (hook_wait, increase_max_attempts), and coordinator background processing.
 *
 * NOTE: These tests require the native module for database access.
 */

import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { _resetDbState } from '../lib/db/index.ts';

// Skip tests that require native module when SKIP_NATIVE is set
const SKIP_NATIVE = process.env.SKIP_NATIVE === 'true';

// Save original environment
const originalClaudeConfigDir = process.env.CLAUDE_CONFIG_DIR;

// Create isolated test directory
const testDir = join(
  '/tmp',
  `han-deferred-hooks-test-${Date.now()}-${Math.random().toString(36).slice(2)}`
);
const configDir = join(testDir, 'config');

beforeAll(() => {
  // Reset database state to pick up new CLAUDE_CONFIG_DIR
  _resetDbState();
  // Create test directories
  mkdirSync(join(configDir, 'han'), { recursive: true });
  // Set isolated config dir for database
  process.env.CLAUDE_CONFIG_DIR = configDir;
});

afterAll(() => {
  // Reset database state before restoring environment
  _resetDbState();
  // Restore original environment
  if (originalClaudeConfigDir) {
    process.env.CLAUDE_CONFIG_DIR = originalClaudeConfigDir;
  } else {
    delete process.env.CLAUDE_CONFIG_DIR;
  }
  // Clean up test directory
  try {
    rmSync(testDir, { recursive: true, force: true });
  } catch {
    // Ignore cleanup errors
  }
});

// Skip describe blocks when native module not available
const describeWithNative = SKIP_NATIVE ? describe.skip : describe;

// Helper to create a test session
async function createTestSession(sessionId: string) {
  const { sessions, initDb } = await import('../lib/db/index.ts');
  await initDb();
  return sessions.upsert({
    id: sessionId,
    status: 'active',
  });
}

// Helper to create an orchestration for testing
async function createTestOrchestration(sessionId?: string) {
  const { orchestrations, initDb } = await import('../lib/db/index.ts');
  await initDb();
  // Create session first if sessionId provided (FK constraint)
  if (sessionId) {
    await createTestSession(sessionId);
  }
  return orchestrations.create({
    sessionId,
    hookType: 'Stop',
    projectRoot: '/test/project',
  });
}

// Helper to create a hook execution record for testing hookAttempts
async function createHookExecution(
  sessionId: string,
  plugin: string,
  hookName: string,
  directory: string
) {
  const { hookExecutions, initDb } = await import('../lib/db/index.ts');
  await initDb();
  return hookExecutions.record({
    sessionId,
    hookType: 'Stop',
    hookName,
    hookSource: plugin,
    directory,
    durationMs: 100,
    exitCode: 0,
    passed: true,
    output: '',
    command: 'echo test',
  });
}

describe('Deferred Hook Execution System', () => {
  describe('hookAttempts namespace', () => {
    test('getOrCreate returns default values for new hook', async () => {
      const { hookAttempts, initDb } = await import('../lib/db/index.ts');
      await initDb();

      const result = hookAttempts.getOrCreate(
        'test-session-1',
        'jutsu-biome',
        'lint',
        '/project/dir'
      );

      expect(result).toBeDefined();
      expect(result.consecutiveFailures).toBe(0);
      expect(result.maxAttempts).toBe(3);
      expect(result.isStuck).toBe(false);
    });

    test('increment increases consecutive failures on existing hook', async () => {
      const { hookAttempts } = await import('../lib/db/index.ts');

      // Create a session and hook execution first (required by FK and for UPDATE)
      await createTestSession('test-session-2');
      await createHookExecution(
        'test-session-2',
        'jutsu-typescript',
        'typecheck',
        '/project/dir'
      );

      // Increment failures
      const after1 = hookAttempts.increment(
        'test-session-2',
        'jutsu-typescript',
        'typecheck',
        '/project/dir'
      );
      expect(after1.consecutiveFailures).toBe(1);

      const after2 = hookAttempts.increment(
        'test-session-2',
        'jutsu-typescript',
        'typecheck',
        '/project/dir'
      );
      expect(after2.consecutiveFailures).toBe(2);
    });

    test('isStuck becomes true when failures exceed max attempts', async () => {
      const { hookAttempts } = await import('../lib/db/index.ts');

      // Create session and hook execution
      await createTestSession('test-session-3');
      await createHookExecution(
        'test-session-3',
        'jutsu-bun',
        'test',
        '/project/dir'
      );

      // Increment 3 times (default max is 3)
      hookAttempts.increment(
        'test-session-3',
        'jutsu-bun',
        'test',
        '/project/dir'
      );
      hookAttempts.increment(
        'test-session-3',
        'jutsu-bun',
        'test',
        '/project/dir'
      );
      const afterMax = hookAttempts.increment(
        'test-session-3',
        'jutsu-bun',
        'test',
        '/project/dir'
      );

      expect(afterMax.consecutiveFailures).toBe(3);
      expect(afterMax.isStuck).toBe(true);
    });

    test('reset clears consecutive failures', async () => {
      const { hookAttempts } = await import('../lib/db/index.ts');

      // Create session and hook execution
      await createTestSession('test-session-4');
      await createHookExecution(
        'test-session-4',
        'jutsu-relay',
        'compile',
        '/project/dir'
      );

      // Increment failures
      hookAttempts.increment(
        'test-session-4',
        'jutsu-relay',
        'compile',
        '/project/dir'
      );
      hookAttempts.increment(
        'test-session-4',
        'jutsu-relay',
        'compile',
        '/project/dir'
      );

      const beforeReset = hookAttempts.getOrCreate(
        'test-session-4',
        'jutsu-relay',
        'compile',
        '/project/dir'
      );
      expect(beforeReset.consecutiveFailures).toBe(2);

      // Reset
      hookAttempts.reset(
        'test-session-4',
        'jutsu-relay',
        'compile',
        '/project/dir'
      );

      const afterReset = hookAttempts.getOrCreate(
        'test-session-4',
        'jutsu-relay',
        'compile',
        '/project/dir'
      );
      expect(afterReset.consecutiveFailures).toBe(0);
      expect(afterReset.isStuck).toBe(false);
    });

    test('increaseMaxAttempts allows more retries', async () => {
      const { hookAttempts } = await import('../lib/db/index.ts');

      const sessionId = 'test-session-5';
      const plugin = 'jutsu-playwright';
      const hookName = 'test';
      const directory = '/project/dir';

      // Create session and hook execution
      await createTestSession(sessionId);
      await createHookExecution(sessionId, plugin, hookName, directory);

      hookAttempts.increment(sessionId, plugin, hookName, directory);
      hookAttempts.increment(sessionId, plugin, hookName, directory);
      hookAttempts.increment(sessionId, plugin, hookName, directory);

      const maxedOut = hookAttempts.getOrCreate(
        sessionId,
        plugin,
        hookName,
        directory
      );
      expect(maxedOut.isStuck).toBe(true);
      expect(maxedOut.maxAttempts).toBe(3);

      // Increase max attempts
      hookAttempts.increaseMaxAttempts(
        sessionId,
        plugin,
        hookName,
        directory,
        2
      );

      const afterIncrease = hookAttempts.getOrCreate(
        sessionId,
        plugin,
        hookName,
        directory
      );
      expect(afterIncrease.maxAttempts).toBe(5);
      expect(afterIncrease.isStuck).toBe(false);
    });

    test('tracks different hooks independently', async () => {
      const { hookAttempts } = await import('../lib/db/index.ts');

      const sessionId = 'test-session-6';

      // Create session
      await createTestSession(sessionId);

      // Create hook execution for hook A
      await createHookExecution(sessionId, 'jutsu-biome', 'lint', '/dir1');

      // Increment failures for hook A
      hookAttempts.increment(sessionId, 'jutsu-biome', 'lint', '/dir1');
      hookAttempts.increment(sessionId, 'jutsu-biome', 'lint', '/dir1');

      // Hook B should be independent (no record yet)
      const hookB = hookAttempts.getOrCreate(
        sessionId,
        'jutsu-typescript',
        'typecheck',
        '/dir1'
      );
      expect(hookB.consecutiveFailures).toBe(0);

      // Same plugin/hook but different directory should be independent
      const hookC = hookAttempts.getOrCreate(
        sessionId,
        'jutsu-biome',
        'lint',
        '/dir2'
      );
      expect(hookC.consecutiveFailures).toBe(0);
    });
  });

  describe('deferredHooks namespace', () => {
    test('queue creates pending hook execution', async () => {
      const { deferredHooks } = await import('../lib/db/index.ts');

      // Create orchestration (hooks now link to orchestrations, not sessions directly)
      const orch = await createTestOrchestration('pending-session-1');

      const id = deferredHooks.queue({
        orchestrationId: orch.id,
        sessionId: 'pending-session-1',
        hookType: 'Stop',
        hookName: 'lint',
        plugin: 'jutsu-biome',
        directory: '/project/dir',
        command: 'bun run lint',
      });

      expect(id).toBeDefined();
      expect(typeof id).toBe('string');
      expect(id.length).toBeGreaterThan(0);
    });

    test('getAll returns all pending hooks', async () => {
      const { deferredHooks } = await import('../lib/db/index.ts');

      // Create orchestration
      const orch = await createTestOrchestration('pending-session-2');

      // Queue a hook
      deferredHooks.queue({
        orchestrationId: orch.id,
        sessionId: 'pending-session-2',
        hookType: 'Stop',
        hookName: 'typecheck',
        plugin: 'jutsu-typescript',
        directory: '/project',
        command: 'bun run typecheck',
      });

      const all = deferredHooks.getAll();
      expect(Array.isArray(all)).toBe(true);
      // Should include our queued hook
      const found = all.find(
        (h) => h.sessionId === 'pending-session-2' && h.hookName === 'typecheck'
      );
      expect(found).toBeDefined();
      expect(found?.status).toBe('pending');
    });

    test('getForSession filters by session', async () => {
      const { deferredHooks } = await import('../lib/db/index.ts');

      // Create orchestrations for different sessions
      const orchA = await createTestOrchestration('pending-session-3a');
      const orchB = await createTestOrchestration('pending-session-3b');

      // Queue hooks for different sessions
      deferredHooks.queue({
        orchestrationId: orchA.id,
        sessionId: 'pending-session-3a',
        hookType: 'Stop',
        hookName: 'build',
        plugin: 'jutsu-bun',
        directory: '/project',
        command: 'bun run build',
      });

      deferredHooks.queue({
        orchestrationId: orchB.id,
        sessionId: 'pending-session-3b',
        hookType: 'Stop',
        hookName: 'test',
        plugin: 'jutsu-bun',
        directory: '/project',
        command: 'bun test',
      });

      const sessionA = deferredHooks.getForSession('pending-session-3a');
      const sessionB = deferredHooks.getForSession('pending-session-3b');

      expect(sessionA.every((h) => h.sessionId === 'pending-session-3a')).toBe(
        true
      );
      expect(sessionB.every((h) => h.sessionId === 'pending-session-3b')).toBe(
        true
      );
    });

    test('updateStatus changes hook status', async () => {
      const { deferredHooks } = await import('../lib/db/index.ts');

      // Create orchestration
      const orch = await createTestOrchestration('pending-session-4');

      const id = deferredHooks.queue({
        orchestrationId: orch.id,
        sessionId: 'pending-session-4',
        hookType: 'Stop',
        hookName: 'format',
        plugin: 'jutsu-biome',
        directory: '/project',
        command: 'bun run format',
      });

      // Update to running
      deferredHooks.updateStatus(id, 'running');

      const hooks = deferredHooks.getForSession('pending-session-4');
      const hook = hooks.find((h) => h.id === id);
      expect(hook?.status).toBe('running');
    });

    test('complete marks hook as finished and removes from pending list', async () => {
      const { deferredHooks } = await import('../lib/db/index.ts');

      // Create orchestration
      const orch = await createTestOrchestration('pending-session-5');

      const id = deferredHooks.queue({
        orchestrationId: orch.id,
        sessionId: 'pending-session-5',
        hookType: 'Stop',
        hookName: 'test',
        plugin: 'jutsu-playwright',
        directory: '/project',
        command: 'bun test',
      });

      // Verify hook is pending
      const beforeComplete = deferredHooks.getForSession('pending-session-5');
      const hookBefore = beforeComplete.find((h) => h.id === id);
      expect(hookBefore?.status).toBe('pending');

      // Complete successfully
      deferredHooks.complete(id, true, 'All tests passed', null, 5000);

      // Completed hooks are filtered out of getForSession (only pending/running/failed)
      const afterComplete = deferredHooks.getForSession('pending-session-5');
      const hookAfter = afterComplete.find((h) => h.id === id);
      expect(hookAfter).toBeUndefined(); // No longer in pending list
    });

    test('complete handles failures', async () => {
      const { deferredHooks } = await import('../lib/db/index.ts');

      // Create orchestration
      const orch = await createTestOrchestration('pending-session-6');

      const id = deferredHooks.queue({
        orchestrationId: orch.id,
        sessionId: 'pending-session-6',
        hookType: 'Stop',
        hookName: 'lint',
        plugin: 'jutsu-shellcheck',
        directory: '/scripts',
        command: 'shellcheck *.sh',
      });

      // Complete with failure
      deferredHooks.complete(id, false, '', 'lint errors found', 1500);

      const hooks = deferredHooks.getForSession('pending-session-6');
      const hook = hooks.find((h) => h.id === id);
      expect(hook?.status).toBe('failed');
      expect(hook?.error).toBe('lint errors found');
    });
  });

  describe('MCP tools integration', () => {
    test('MCP server exports are defined', async () => {
      // Import the server module to check exports are defined
      const serverModule = await import('../lib/commands/mcp/server.ts');

      // The key handlers should be exported
      expect(serverModule.handleInitialize).toBeDefined();
      expect(serverModule.startMcpServer).toBeDefined();
    });
  });

  describe('HookAttemptInfo structure', () => {
    test('has correct shape', async () => {
      const { hookAttempts, initDb } = await import('../lib/db/index.ts');
      await initDb();

      const info = hookAttempts.getOrCreate(
        'shape-test-session',
        'jutsu-test',
        'hook',
        '/dir'
      );

      // Check required fields exist
      expect(typeof info.consecutiveFailures).toBe('number');
      expect(typeof info.maxAttempts).toBe('number');
      expect(typeof info.isStuck).toBe('boolean');
    });
  });

  describe('HookExecution structure', () => {
    test('queued hook has expected fields', async () => {
      const { deferredHooks } = await import('../lib/db/index.ts');

      // Create orchestration
      const orch = await createTestOrchestration('structure-test-session');

      const id = deferredHooks.queue({
        orchestrationId: orch.id,
        sessionId: 'structure-test-session',
        hookType: 'Stop',
        hookName: 'test-hook',
        plugin: 'test-plugin',
        directory: '/test/dir',
        command: 'echo test',
      });

      const hooks = deferredHooks.getForSession('structure-test-session');
      const hook = hooks.find((h) => h.id === id);

      expect(hook).toBeDefined();
      expect(hook?.id).toBe(id);
      expect(hook?.sessionId).toBe('structure-test-session');
      expect(hook?.hookType).toBe('Stop');
      expect(hook?.hookName).toBe('test-hook');
      expect(hook?.hookSource).toBe('test-plugin');
      expect(hook?.directory).toBe('/test/dir');
      expect(hook?.command).toBe('echo test');
      expect(hook?.status).toBe('pending');
    });
  });
});

describe('Edge Cases', () => {
  test('handles empty session gracefully', async () => {
    const { deferredHooks, initDb } = await import('../lib/db/index.ts');
    await initDb();

    const hooks = deferredHooks.getForSession('nonexistent-session-xyz');
    expect(Array.isArray(hooks)).toBe(true);
    expect(hooks.length).toBe(0);
  });

  test('handles special characters in parameters', async () => {
    const { hookAttempts, initDb } = await import('../lib/db/index.ts');
    await initDb();

    // Test with special characters - getOrCreate returns defaults for non-existent
    const result = hookAttempts.getOrCreate(
      'session-with-special-chars!@#$',
      'plugin-name',
      'hook-name',
      '/path/with spaces/and-dashes'
    );

    expect(result).toBeDefined();
    expect(result.consecutiveFailures).toBe(0);
  });

  test('multiple increments in sequence work correctly', async () => {
    const { hookAttempts } = await import('../lib/db/index.ts');

    const sessionId = 'rapid-increment-session';
    const plugin = 'test-plugin';
    const hookName = 'test-hook';
    const directory = '/test';

    // Create session and hook execution
    await createTestSession(sessionId);
    await createHookExecution(sessionId, plugin, hookName, directory);

    // Rapid increments
    for (let i = 0; i < 10; i++) {
      hookAttempts.increment(sessionId, plugin, hookName, directory);
    }

    const result = hookAttempts.getOrCreate(
      sessionId,
      plugin,
      hookName,
      directory
    );
    expect(result.consecutiveFailures).toBe(10);
    expect(result.isStuck).toBe(true);
  });
});
