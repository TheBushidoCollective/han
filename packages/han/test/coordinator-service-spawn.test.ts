/**
 * Additional coordinator-service tests focused on the binary spawn path.
 *
 * Uses existsSync mock that returns true to exercise findCoordinatorBinary
 * success path and Bun.spawn error handling.
 */

import {
  afterAll,
  afterEach,
  beforeEach,
  describe,
  expect,
  mock,
  test,
} from 'bun:test';
import { dirname, join } from 'node:path';
import { Code, ConnectError } from '@connectrpc/connect';
import { getHanDataDir } from '../lib/config/claude-settings.ts';
import { realGrpcClient } from './setup.ts';

// ============================================================================
// Mock infrastructure — existsSync returns true to simulate binary found
// ============================================================================

const mockHealth = mock();
const mockShutdown = mock();
const mockStatus = mock();

mock.module('../lib/grpc/client.ts', () => ({
  createCoordinatorClients: () => ({
    coordinator: {
      health: mockHealth,
      shutdown: mockShutdown,
      status: mockStatus,
    },
    sessions: {},
    indexer: { indexFile: mock() },
    hooks: {},
    slots: {},
    memory: {},
  }),
  isCoordinatorHealthy: mockHealth,
  setCoordinatorPort: () => {},
  getCoordinatorClients: () => ({}),
}));

// The lifecycle's liveness probe is the coordinator's HTTPS /health route,
// not a gRPC call, so drive it from the same mockHealth boolean every test
// below already sets. Left real, these tests would hit the network and, on
// a machine running han, get a truthful "yes, one is already serving".
const realHealthModule = require('../lib/commands/coordinator/health.ts');
mock.module('../lib/commands/coordinator/health.ts', () => ({
  ...realHealthModule,
  checkHealth: async (port?: number) =>
    (await mockHealth(port))
      ? { status: 'ok', pid: 4242, uptime: 1, version: 'test' }
      : null,
  readOptionalDescriptor: () =>
    mockBunSpawn.mock.calls.length ? mockDescriptor() : null,
  checkDescriptorHealth: async (descriptor: { pid: number }) => {
    if (!(await mockHealth()))
      throw new realConnection.CoordinatorSecurityError('not healthy');
    return { status: 'ok', pid: descriptor.pid };
  },
  checkStartupObserver: async () => !!(await mockHealth()),
  descriptorIsDead: () => false,
}));
const realConnection = require('../lib/coordinator/connection.ts');
const readActualDescriptor = realConnection.readCoordinatorDescriptor;
const mockDescriptor = mock(() => ({
  transportVersion: 1,
  instanceId: 'owned',
  pid: 4242,
  httpsPort: 41957,
  grpcPort: 41958,
  certificatePem: 'certificate',
  bearerToken: 'token',
  supervisor: null,
}));
mock.module('../lib/coordinator/connection.ts', () => ({
  ...realConnection,
  readCoordinatorDescriptor: (path?: string) =>
    path === undefined ? mockDescriptor() : readActualDescriptor(path),
}));
const realRecovery = require('../lib/coordinator/recovery-runtime.ts');
mock.module('../lib/coordinator/recovery-runtime.ts', () => ({
  ...realRecovery,
  posixPrepare: () => {},
}));
const realWindowsRuntime = require('../lib/coordinator/windows-runtime.ts');
mock.module('../lib/coordinator/windows-runtime.ts', () => ({
  ...realWindowsRuntime,
  readWindowsChildDescriptor: async () => mockDescriptor(),
}));

// existsSync returns true so findCoordinatorBinary "finds" a binary path.
// Spread the real fs module (captured before this call) so the spawn
// guard's own mkdirSync/readFileSync/writeFileSync/unlinkSync still hit
// the real, test-temp-dir-scoped filesystem — only existsSync is stubbed.
const realFs = require('node:fs');
mock.module('node:fs', () => ({ ...realFs, existsSync: () => true }));

// Bun.spawn is a real global, not a module import, so mock.module can't
// intercept it. A dev machine that has actually installed han (this repo's
// own machines do) has a real ~/.han/bin/han-coordinator; letting
// Bun.spawn run for real here would launch it against the live port and
// database. Stub it so every test in this file is safe and deterministic
// on any machine, while still exercising the "spawn attempted, then
// failed" path these tests are about.
const originalBunSpawn = Bun.spawn;
const mockBunSpawn = mock((_args: string[]) => {
  throw new Error('ENOENT: no such file or directory (test double)');
});
Bun.spawn = mockBunSpawn as unknown as typeof Bun.spawn;

// Keep waitForHealthy short so tests don't time out while polling a
// non-existent coordinator (production default is 30s).
process.env.HAN_COORDINATOR_HEALTH_BUDGET_MS = '50';

const cs = await import('../lib/services/coordinator-service.ts');

let consoleOutput: string[] = [];
let originalLog: typeof console.log;
let originalError: typeof console.error;

beforeEach(() => {
  mockHealth.mockReset();
  mockBunSpawn.mockClear();
  mockShutdown.mockReset();
  mockDescriptor.mockReset();
  mockDescriptor.mockReturnValue({
    transportVersion: 1,
    instanceId: 'owned',
    pid: 4242,
    httpsPort: 41957,
    grpcPort: 41958,
    certificatePem: 'certificate',
    bearerToken: 'token',
    supervisor: null,
  });
  consoleOutput = [];
  originalLog = console.log;
  originalError = console.error;
  console.log = (...args: unknown[]) => {
    consoleOutput.push(args.map(String).join(' '));
  };
  console.error = (...args: unknown[]) => {
    consoleOutput.push(args.map(String).join(' '));
  };
});

afterEach(async () => {
  console.log = originalLog;
  console.error = originalError;
  // Ensure stopped between tests
  mockShutdown.mockResolvedValue({});
  await cs.stopCoordinatorService();
});

// Restore real node:fs and grpc/client after all tests so mocks don't
// bleed into later test files. Bun shares mock.module state across files
// within the same run, so this cleanup is essential.
afterAll(() => {
  mock.module('node:fs', () => realFs);
  mock.module('../lib/grpc/client.ts', () => realGrpcClient);
  mock.module('../lib/commands/coordinator/health.ts', () => realHealthModule);
  mock.module('../lib/coordinator/recovery-runtime.ts', () => realRecovery);
  mock.module(
    '../lib/coordinator/windows-runtime.ts',
    () => realWindowsRuntime
  );
  mock.module('../lib/coordinator/connection.ts', () => ({
    ...realConnection,
    readCoordinatorDescriptor: readActualDescriptor,
  }));
  Bun.spawn = originalBunSpawn;
});

// ============================================================================
// Binary spawn path
// ============================================================================

describe('startCoordinatorService with binary found', () => {
  test('rechecks health when already attached', async () => {
    mockHealth.mockResolvedValue(true);
    await cs.startCoordinatorService();
    mockHealth.mockClear();
    await cs.startCoordinatorService();
    expect(mockHealth).toHaveBeenCalled();
  });

  test('attempts to spawn binary when not healthy and binary found', async () => {
    mockHealth.mockResolvedValue(false);
    await cs.stopCoordinatorService();
    mockHealth.mockReset();
    mockHealth.mockResolvedValue(false);

    await expect(cs.startCoordinatorService()).rejects.toThrow('test double');
    expect(mockBunSpawn).toHaveBeenCalled();
    const args = mockBunSpawn.mock.calls[0][0] as string[];
    expect(args).toContain('--foreground');
    expect(args).toContain('--data-dir');
    expect(args[args.indexOf('--data-dir') + 1]).toBe(getHanDataDir());
  });

  test('passes all supervisor binding fields to its own foreground child', async () => {
    await cs.stopCoordinatorService();
    mockHealth.mockResolvedValue(false);
    const supervisor = {
      pid: process.pid,
      nonce: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      generationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    };
    await expect(cs.startCoordinatorService({ supervisor })).rejects.toThrow(
      'test double'
    );
    const args = mockBunSpawn.mock.calls[0][0] as string[];
    expect(args[args.indexOf('--supervisor-pid') + 1]).toBe(
      String(supervisor.pid)
    );
    expect(args[args.indexOf('--supervisor-nonce') + 1]).toBe(supervisor.nonce);
    expect(args[args.indexOf('--supervisor-generation') + 1]).toBe(
      supervisor.generationId
    );
  });

  test('handles spawn failure gracefully', async () => {
    await cs.stopCoordinatorService();
    mockHealth.mockReset();
    // Not healthy — so it will try to find and spawn binary
    mockHealth.mockResolvedValue(false);

    await expect(cs.startCoordinatorService()).rejects.toThrow('test double');
  });
});

// ============================================================================
// Ensure the version retrieval works with package.json
// ============================================================================

describe('COORDINATOR_VERSION', () => {
  test('is a semver-like string', () => {
    // getHanVersion reads from package.json
    expect(cs.COORDINATOR_VERSION).toMatch(/^\d+\.\d+/);
  });
});

// ============================================================================
// Cross-process spawn guard
// ============================================================================

function spawnGuardPath(): string {
  return join(getHanDataDir(), 'coordinator.spawn.lock');
}

describe('cross-process spawn guard', () => {
  beforeEach(() => {
    // Tests write a precondition guard file directly; ensure the directory
    // exists first rather than relying on an earlier test's own
    // claimSpawnGuard() call having created it as a side effect.
    realFs.mkdirSync(getHanDataDir(), { recursive: true });
  });

  afterEach(() => {
    // Belt and suspenders: never let a guard file leak into another test,
    // in this file or (since mock.module state is shared) another one.
    try {
      realFs.rmSync(spawnGuardPath(), { force: true });
    } catch {
      // Already gone.
    }
  });

  test('a live, fresh guard blocks spawning', async () => {
    const otherPid = process.ppid;
    realFs.writeFileSync(
      spawnGuardPath(),
      JSON.stringify({ pid: otherPid, timestamp: new Date().toISOString() })
    );

    await expect(cs.startCoordinatorService()).rejects.toThrow(
      'failed its health check'
    );

    expect(mockBunSpawn).not.toHaveBeenCalled();
    // The guard is untouched — we neither took it over nor released a
    // claim that isn't ours.
    const guard = JSON.parse(realFs.readFileSync(spawnGuardPath(), 'utf-8'));
    expect(guard.pid).toBe(otherPid);
  });

  test('a guard naming a dead pid is taken over rather than blocking forever', async () => {
    // Comfortably beyond any real PID space (macOS/Linux max well under
    // this), so process.kill(deadPid, 0) reliably reports ESRCH.
    const deadPid = 999_999_999;
    realFs.writeFileSync(
      spawnGuardPath(),
      JSON.stringify({ pid: deadPid, timestamp: new Date().toISOString() })
    );

    await expect(cs.startCoordinatorService()).rejects.toThrow('test double');
    expect(mockBunSpawn).toHaveBeenCalled();
    expect(realFs.existsSync(spawnGuardPath())).toBe(false);
  });

  test('a guard with an expired timestamp is taken over even if the pid is alive', async () => {
    const staleTimestamp = new Date(Date.now() - 61_000).toISOString();
    realFs.writeFileSync(
      spawnGuardPath(),
      JSON.stringify({ pid: process.ppid, timestamp: staleTimestamp })
    );

    await expect(cs.startCoordinatorService()).rejects.toThrow('test double');
    expect(mockBunSpawn).toHaveBeenCalled();
    expect(realFs.existsSync(spawnGuardPath())).toBe(false);
  });

  test('release only unlinks the guard if this process still owns it', async () => {
    const otherPid = process.ppid;
    // Replace the guard during spawn, after it was acquired.
    mockBunSpawn.mockImplementationOnce(() => {
      realFs.writeFileSync(
        spawnGuardPath(),
        JSON.stringify({ pid: otherPid, timestamp: new Date().toISOString() })
      );
      throw new Error('test double');
    });

    await expect(cs.startCoordinatorService()).rejects.toThrow('test double');

    // Our own release must not have deleted a file that, by the time it
    // ran, no longer named our pid.
    expect(realFs.existsSync(spawnGuardPath())).toBe(true);
    const guard = JSON.parse(realFs.readFileSync(spawnGuardPath(), 'utf-8'));
    expect(guard.pid).toBe(otherPid);
  });
});

// ============================================================================
// stopCoordinatorService ownership (fix 5)
// ============================================================================

// Only this describe controls Bun.spawn's per-call outcome (via
// mockImplementationOnce), so it's the only place that can actually reach
// state.ownsProcess === true — the behavioral test file's existsSync-false
// mock never gets past findCoordinatorBinary to a spawn attempt at all.
describe('stopCoordinatorService ownership', () => {
  test('retains a supervised child until the supervisor can reap it', async () => {
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockResolvedValue(true);
    const supervisor = {
      pid: process.pid,
      nonce: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      generationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    };
    const child = { pid: 4242, exitCode: null, unref: mock(), kill: mock() };
    mockBunSpawn.mockImplementationOnce(() => child as never);
    mockDescriptor.mockImplementation(
      () =>
        ({
          transportVersion: 1,
          instanceId: 'owned',
          pid: child.pid,
          httpsPort: 41957,
          grpcPort: 41958,
          certificatePem: 'certificate',
          bearerToken: 'token',
          supervisor,
        }) as never
    );
    const result = await cs.startCoordinatorService({ supervisor });
    expect(result.kind).toBe('owned');
    expect(child.unref).not.toHaveBeenCalled();
  });

  test('does not signal a live child when pinned health fails', async () => {
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockRejectedValueOnce(
      new realConnection.CoordinatorSecurityError('connection reset')
    );
    const child = {
      pid: 4242,
      exitCode: null as number | null,
      unref: mock(),
      kill: mock(),
      exited: new Promise<number>(() => {}),
    };
    mockBunSpawn.mockImplementationOnce(() => child as never);
    await expect(cs.startCoordinatorService()).rejects.toThrow(
      'connection reset'
    );
    expect(child.kill).not.toHaveBeenCalled();
  });

  test('attaches to a replacement instead of returning a cached dead child', async () => {
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockResolvedValue(true);
    const child = {
      pid: 4242,
      exitCode: null as number | null,
      unref: mock(),
      kill: mock(),
    };
    mockBunSpawn.mockImplementationOnce(() => child as never);
    expect((await cs.startCoordinatorService()).kind).toBe('owned');
    child.exitCode = 1;
    mockDescriptor.mockReturnValue({
      transportVersion: 1,
      instanceId: 'replacement',
      pid: 9999,
      httpsPort: 41957,
      grpcPort: 41958,
      certificatePem: 'replacement',
      bearerToken: 'replacement',
      supervisor: null,
    });
    expect((await cs.startCoordinatorService()).kind).toBe('attached');
    await cs.stopCoordinatorService();
    expect(mockShutdown).not.toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
  });

  test('a coordinator this process actually spawned still gets a graceful shutdown', async () => {
    mockHealth.mockReset();
    mockHealth.mockResolvedValueOnce(false); // not already running
    mockHealth.mockResolvedValue(true); // healthy once "spawned"

    const fakeSubprocess = {
      pid: 4242,
      exitCode: null,
      unref: mock(),
      kill: mock(),
    };
    mockBunSpawn.mockImplementationOnce(() => fakeSubprocess as never);

    await cs.startCoordinatorService();

    mockShutdown.mockReset();
    mockShutdown.mockResolvedValueOnce({});
    await cs.stopCoordinatorService();

    expect(mockShutdown).toHaveBeenCalledTimes(1);
    const shutdownArgs = mockShutdown.mock.calls[0][0];
    expect(shutdownArgs.graceful).toBe(true);
    expect(shutdownArgs.timeoutSeconds).toBe(5);
  });

  test('does not signal a child when shutdown fails without a committed intent', async () => {
    mockHealth.mockReset();
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockResolvedValue(true);

    const fakeSubprocess = {
      pid: 4242,
      exitCode: null,
      unref: mock(),
      kill: mock(),
    };
    mockBunSpawn.mockImplementationOnce(() => fakeSubprocess as never);

    await cs.startCoordinatorService();

    mockShutdown.mockReset();
    mockShutdown.mockRejectedValueOnce(new Error('connection refused'));
    await expect(cs.stopCoordinatorService()).rejects.toThrow(
      'connection refused'
    );
    expect(fakeSubprocess.kill).not.toHaveBeenCalled();
  });

  test('a replacement descriptor is never sent shutdown by an old owner', async () => {
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockResolvedValue(true);
    const child = { pid: 4242, exitCode: null, unref: mock(), kill: mock() };
    mockBunSpawn.mockImplementationOnce(() => child as never);
    await cs.startCoordinatorService();
    mockDescriptor.mockReturnValue({
      transportVersion: 1,
      instanceId: 'replacement',
      pid: 4343,
      httpsPort: 41957,
      grpcPort: 41958,
      certificatePem: 'replacement',
      bearerToken: 'other',
      supervisor: null,
    });
    await cs.stopCoordinatorService();
    expect(mockShutdown).not.toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
  });

  test('a child that loses startup does not own the healthy replacement', async () => {
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockResolvedValue(true);
    const child = { pid: 4241, exitCode: 1, unref: mock(), kill: mock() };
    mockBunSpawn.mockImplementationOnce(() => child as never);
    expect((await cs.startCoordinatorService()).kind).toBe('attached');
    expect(child.kill).not.toHaveBeenCalled();
    await cs.stopCoordinatorService();
    expect(mockShutdown).not.toHaveBeenCalled();
  });

  test('does not authenticate an unrelated publication while the child is live', async () => {
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockResolvedValue(true);
    const child = { pid: 4241, exitCode: null, unref: mock(), kill: mock() };
    mockBunSpawn.mockImplementationOnce(() => child as never);
    await expect(cs.startCoordinatorService()).rejects.toThrow(
      'failed its health check'
    );
    expect(mockHealth).toHaveBeenCalledTimes(1);
    expect(child.kill).not.toHaveBeenCalled();
  });

  test('descriptor security failure does not trigger an unverified shutdown', async () => {
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockResolvedValue(true);
    const child = { pid: 4242, exitCode: null, unref: mock(), kill: mock() };
    mockBunSpawn.mockImplementationOnce(() => child as never);
    await cs.startCoordinatorService();
    mockDescriptor.mockImplementationOnce(() => {
      throw new realConnection.CoordinatorSecurityError('invalid descriptor');
    });
    await expect(cs.stopCoordinatorService()).rejects.toThrow(
      'invalid descriptor'
    );
    expect(mockShutdown).not.toHaveBeenCalled();
    expect(child.kill).not.toHaveBeenCalled();
  });

  test.each([Code.Unauthenticated, Code.PermissionDenied])(
    'authentication RPC error %s does not trigger a kill',
    async (code) => {
      mockHealth.mockResolvedValueOnce(false);
      mockHealth.mockResolvedValue(true);
      const child = { pid: 4242, exitCode: null, unref: mock(), kill: mock() };
      mockBunSpawn.mockImplementationOnce(() => child as never);
      await cs.startCoordinatorService();
      mockShutdown.mockRejectedValueOnce(new ConnectError('refused', code));
      await expect(cs.stopCoordinatorService()).rejects.toThrow('refused');
      expect(child.kill).not.toHaveBeenCalled();
    }
  );

  test('live child ownership survives authentication failure, allowing shutdown retry', async () => {
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockResolvedValue(true);
    const child = {
      pid: 4242,
      exitCode: null as number | null,
      unref: mock(),
      kill: mock(),
    };
    mockBunSpawn.mockImplementationOnce(() => child as never);
    await cs.startCoordinatorService();
    const authError = new realConnection.CoordinatorSecurityError(
      'Coordinator rejected authenticated request (401)'
    );
    mockShutdown.mockRejectedValueOnce(
      new ConnectError(
        'wrapped rejection',
        Code.Unknown,
        undefined,
        undefined,
        authError
      )
    );
    await expect(cs.stopCoordinatorService()).rejects.toThrow(
      'wrapped rejection'
    );
    expect(mockShutdown).toHaveBeenCalledTimes(1);
    expect(child.kill).not.toHaveBeenCalled();

    // Ownership evidence survived: state.ownsProcess is true, child remains tracked.
    // A second shutdown attempt invokes the RPC again:
    mockShutdown.mockResolvedValueOnce({});
    await expect(cs.stopCoordinatorService()).resolves.toBeUndefined();
    expect(mockShutdown).toHaveBeenCalledTimes(2);
  });

  test('wrapped authentication error is not suppressed even when child exits during RPC', async () => {
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockResolvedValue(true);
    const child = {
      pid: 4242,
      exitCode: null as number | null,
      unref: mock(),
      kill: mock(),
    };
    mockBunSpawn.mockImplementationOnce(() => child as never);
    await cs.startCoordinatorService();
    const authError = new realConnection.CoordinatorSecurityError(
      'Coordinator rejected authenticated request (401)'
    );
    mockShutdown.mockImplementationOnce(() => {
      child.exitCode = 1;
      throw new ConnectError(
        'wrapped rejection',
        Code.Unknown,
        undefined,
        undefined,
        authError
      );
    });
    await expect(cs.stopCoordinatorService()).rejects.toThrow(
      'wrapped rejection'
    );
    expect(mockShutdown).toHaveBeenCalledTimes(1);
    expect(child.kill).not.toHaveBeenCalled();
  });

  test('wrapped TLS error is not suppressed even when child exits during RPC', async () => {
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockResolvedValue(true);
    const child = {
      pid: 4242,
      exitCode: null as number | null,
      unref: mock(),
      kill: mock(),
    };
    mockBunSpawn.mockImplementationOnce(() => child as never);
    await cs.startCoordinatorService();
    const tlsError = new realConnection.CoordinatorSecurityError(
      'Coordinator connection failed: UNABLE_TO_VERIFY_LEAF_SIGNATURE'
    );
    mockShutdown.mockImplementationOnce(() => {
      child.exitCode = 1;
      throw new ConnectError(
        'wrapped TLS failure',
        Code.Unknown,
        undefined,
        undefined,
        tlsError
      );
    });
    await expect(cs.stopCoordinatorService()).rejects.toThrow(
      'wrapped TLS failure'
    );
    expect(mockShutdown).toHaveBeenCalledTimes(1);
    expect(child.kill).not.toHaveBeenCalled();
  });

  test('explicit connection refusal on an exited child stops cleanly without error', async () => {
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockResolvedValue(true);
    const child = {
      pid: 4242,
      exitCode: null as number | null,
      unref: mock(),
      kill: mock(),
    };
    mockBunSpawn.mockImplementationOnce(() => child as never);
    await cs.startCoordinatorService();
    const refusalError = new realConnection.CoordinatorSecurityError(
      'Coordinator connection failed: ECONNREFUSED: Unable to connect'
    );
    mockShutdown.mockImplementationOnce(() => {
      child.exitCode = 1;
      throw new ConnectError(
        'wrapped refusal',
        Code.Unknown,
        undefined,
        undefined,
        refusalError
      );
    });
    await expect(cs.stopCoordinatorService()).resolves.toBeUndefined();
    expect(mockShutdown).toHaveBeenCalledTimes(1);
  });

  test('startup catch does not suppress pinned-health security failure when shutdown intent appears', async () => {
    mockHealth.mockResolvedValueOnce(false);
    const supervisor = {
      pid: process.pid,
      nonce: 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
      generationId: 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
    };
    const child = { pid: 4242, exitCode: null, unref: mock(), kill: mock() };
    mockBunSpawn.mockImplementationOnce(() => child as never);
    mockDescriptor.mockImplementation(() => ({
      transportVersion: 1,
      instanceId: 'owned',
      pid: child.pid,
      httpsPort: 41957,
      grpcPort: 41958,
      certificatePem: '-----BEGIN CERTIFICATE-----\ntest',
      bearerToken: 'a'.repeat(43),
      supervisor,
    }));
    const intentPath = join(
      getHanDataDir(),
      'runtime',
      `coordinator.stopping.${supervisor.nonce}.${supervisor.generationId}.json`
    );
    mockHealth.mockImplementationOnce(() => {
      realFs.mkdirSync(dirname(intentPath), { recursive: true });
      realFs.writeFileSync(
        intentPath,
        JSON.stringify({
          transportVersion: 1,
          instanceId: 'owned',
          pid: child.pid,
          httpsPort: 41957,
          grpcPort: 41958,
          certificatePem: '-----BEGIN CERTIFICATE-----\ntest',
          bearerToken: 'a'.repeat(43),
          supervisor,
        }),
        { mode: 0o600 }
      );
      throw new realConnection.CoordinatorSecurityError(
        'Coordinator rejected authenticated request (401)'
      );
    });
    try {
      await expect(cs.startCoordinatorService({ supervisor })).rejects.toThrow(
        'Coordinator rejected authenticated request'
      );
      expect(mockHealth).toHaveBeenCalledTimes(1);
    } finally {
      realFs.rmSync(intentPath, { force: true });
    }
  });
});
