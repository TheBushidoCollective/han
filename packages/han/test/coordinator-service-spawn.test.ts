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
import { realGrpcClient } from './setup.ts';
import { join } from 'node:path';
import { getHanDataDir } from '../lib/config/claude-settings.ts';

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
const mockBunSpawn = mock(() => {
  throw new Error('ENOENT: no such file or directory (test double)');
});
Bun.spawn = mockBunSpawn as unknown as typeof Bun.spawn;

// The spawn path fetches TLS certificates before launching the binary. Left
// real, these tests would hit certs.han.guru and write into the developer's
// ~/.claude/han/certs.
const mockEnsureCertificates = mock(async () => ({
  cert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
  key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
}));

mock.module('../lib/commands/coordinator/tls.ts', () => ({
  ensureCertificates: mockEnsureCertificates,
}));

// Keep waitForHealthy short so tests don't time out while polling a
// non-existent coordinator (production default is 30s).
process.env.HAN_COORDINATOR_HEALTH_BUDGET_MS = '50';

const cs = await import('../lib/services/coordinator-service.ts');

let consoleOutput: string[] = [];
let originalLog: typeof console.log;
let originalError: typeof console.error;

beforeEach(() => {
  mockHealth.mockReset();
  mockShutdown.mockReset();
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
  Bun.spawn = originalBunSpawn;
});

// ============================================================================
// Binary spawn path
// ============================================================================

describe('startCoordinatorService with binary found', () => {
  test("when already running state, logs 'Already running'", async () => {
    // First make it think it's running
    mockHealth.mockResolvedValue(true);
    await cs.startCoordinatorService();
    consoleOutput = [];

    // Call again — should hit the isRunning early return
    await cs.startCoordinatorService();

    const hasAlreadyRunning = consoleOutput.some((msg) =>
      msg.includes('Already running')
    );
    expect(hasAlreadyRunning).toBe(true);
  });

  test('attempts to spawn binary when not healthy and binary found', async () => {
    mockHealth.mockResolvedValue(false);
    await cs.stopCoordinatorService();
    mockHealth.mockReset();
    mockHealth.mockResolvedValue(false);

    await cs.startCoordinatorService();

    // Should attempt to start (binary "found" due to existsSync mock)
    // Either it tried to spawn (and potentially failed) or logged something
    const hasStartMsg = consoleOutput.some(
      (msg) =>
        msg.includes('Starting') ||
        msg.includes('failed') ||
        msg.includes('Failed')
    );
    expect(hasStartMsg).toBe(true);
  });

  // han-coordinator only reads the cert cache; it never fills it. If this step
  // is skipped the daemon self-signs, and the dashboard's browser then refuses
  // the connection and sits on "Connecting to Han Coordinator..." forever.
  test('fetches TLS certificates before spawning the binary', async () => {
    mockEnsureCertificates.mockClear();
    await cs.stopCoordinatorService();
    mockHealth.mockReset();
    mockHealth.mockResolvedValue(false);

    await cs.startCoordinatorService();

    expect(mockEnsureCertificates).toHaveBeenCalled();
  });

  test('handles spawn failure gracefully', async () => {
    await cs.stopCoordinatorService();
    mockHealth.mockReset();
    // Not healthy — so it will try to find and spawn binary
    mockHealth.mockResolvedValue(false);

    // This should not throw even if Bun.spawn fails
    await cs.startCoordinatorService();

    // Should have error output
    expect(consoleOutput.length).toBeGreaterThan(0);
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

  test('a live, fresh guard blocks spawning: no cert fetch, no spawn attempt', async () => {
    const otherPid = process.ppid;
    realFs.writeFileSync(
      spawnGuardPath(),
      JSON.stringify({ pid: otherPid, timestamp: new Date().toISOString() })
    );
    mockEnsureCertificates.mockClear();

    await cs.startCoordinatorService();

    // ensureCertificates() only runs once a call has claimed the guard and
    // is about to spawn. Blocked means it never gets there.
    expect(mockEnsureCertificates).not.toHaveBeenCalled();
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
    mockEnsureCertificates.mockClear();

    await cs.startCoordinatorService();

    // Taken over: this call claimed the guard and reached the spawn
    // attempt (proven by the certificate fetch), then released it again in
    // its finally block once Bun.spawn threw (no real binary in this test).
    expect(mockEnsureCertificates).toHaveBeenCalled();
    expect(realFs.existsSync(spawnGuardPath())).toBe(false);
  });

  test('a guard with an expired timestamp is taken over even if the pid is alive', async () => {
    const staleTimestamp = new Date(Date.now() - 61_000).toISOString();
    realFs.writeFileSync(
      spawnGuardPath(),
      JSON.stringify({ pid: process.ppid, timestamp: staleTimestamp })
    );
    mockEnsureCertificates.mockClear();

    await cs.startCoordinatorService();

    expect(mockEnsureCertificates).toHaveBeenCalled();
    expect(realFs.existsSync(spawnGuardPath())).toBe(false);
  });

  test('release only unlinks the guard if this process still owns it', async () => {
    const otherPid = process.ppid;
    // Simulate another process taking over the guard while this call is
    // mid-flight (between its own claim and its own release): once
    // ensureCertificates resolves, the guard file no longer names us.
    mockEnsureCertificates.mockImplementationOnce(async () => {
      realFs.writeFileSync(
        spawnGuardPath(),
        JSON.stringify({ pid: otherPid, timestamp: new Date().toISOString() })
      );
      return {
        cert: '-----BEGIN CERTIFICATE-----\ntest\n-----END CERTIFICATE-----',
        key: '-----BEGIN PRIVATE KEY-----\ntest\n-----END PRIVATE KEY-----',
      };
    });

    await cs.startCoordinatorService();

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
  test('a coordinator this process actually spawned still gets a graceful shutdown', async () => {
    mockHealth.mockReset();
    mockHealth.mockResolvedValueOnce(false); // not already running
    mockHealth.mockResolvedValue(true); // healthy once "spawned"

    const fakeSubprocess = { unref: mock(), kill: mock() };
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

  test('owned coordinator falls back to process kill if gRPC shutdown fails', async () => {
    mockHealth.mockReset();
    mockHealth.mockResolvedValueOnce(false);
    mockHealth.mockResolvedValue(true);

    const fakeSubprocess = { unref: mock(), kill: mock() };
    mockBunSpawn.mockImplementationOnce(() => fakeSubprocess as never);

    await cs.startCoordinatorService();

    mockShutdown.mockReset();
    mockShutdown.mockRejectedValueOnce(new Error('connection refused'));
    await cs.stopCoordinatorService();

    expect(fakeSubprocess.kill).toHaveBeenCalled();
  });
});
