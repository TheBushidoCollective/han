import { afterAll, beforeAll, expect, mock, spyOn, test } from 'bun:test';
import { createServer } from 'node:net';
import type { LocalCoordinatorDescriptor } from '../lib/coordinator/connection.ts';

// These module substitutions exercise the Windows health boundary without touching process.platform.
const windows = process.platform === 'win32';
let health: typeof import('../lib/commands/coordinator/health.ts');
let realConnection: typeof import('../lib/coordinator/connection.ts');
let realRuntime: typeof import('../lib/coordinator/windows-runtime.ts');
let descriptor: LocalCoordinatorDescriptor;
let replacement: typeof descriptor | undefined;
let reads = 0;
let state: 'alive' | 'gone' | 'unknown' = 'gone';
let requests = 0;
let rejectRequest = false;
let port = 0;

beforeAll(async () => {
  if (!windows) return;
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  port = (server.address() as { port: number }).port;
  await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  // Load the real exports before replacing only the native boundary and reads.
  realConnection = { ...await import('../lib/coordinator/connection.ts') };
  realRuntime = { ...await import('../lib/coordinator/windows-runtime.ts') };
  mock.module('../lib/coordinator/windows-runtime.ts', () => ({
    ...realRuntime,
    windowsProcessState: () => {
      if (state === 'unknown') throw new realConnection.CoordinatorSecurityError('unknown');
      return state;
    },
  }));
  mock.module('../lib/coordinator/connection.ts', () => ({
    ...realConnection,
    readCoordinatorDescriptor: () => (++reads > 1 && replacement ? replacement : descriptor),
    coordinatorRequest: async () => {
      requests++;
      if (rejectRequest) throw new Error('TLS rejection');
      return new Response('{}', { status: 401 });
    },
  }));
  // Import after mocks so this test exercises the substituted boundaries.
  health = await import('../lib/commands/coordinator/health.ts');
  descriptor = {
    transportVersion: 1, instanceId: 'same', pid: process.pid, httpsPort: port,
    grpcPort: null, certificatePem: '-----BEGIN CERTIFICATE-----', bearerToken: 'x'.repeat(43),
    supervisor: null, process: { pid: process.pid, creationTime: '133000000000000000', userSid: 'S-1-5-21-1' },
  };
});

afterAll(() => {
  if (!windows) return;
  mock.module('../lib/coordinator/connection.ts', () => realConnection);
  mock.module('../lib/coordinator/windows-runtime.ts', () => realRuntime);
});

test.skipIf(!windows)('gone original identity and refused listener is stale despite a live reused PID', async () => {
  reads = requests = 0; replacement = undefined; state = 'gone'; rejectRequest = false;
  const kill = spyOn(process, 'kill');
  try {
    expect(await health.checkHealth(port)).toBeNull();
    expect(kill).not.toHaveBeenCalled();
    expect(reads).toBe(2);
    expect(requests).toBe(0);
  } finally { kill.mockRestore(); }
});

test.skipIf(!windows)('changed identity with the same instance ID is not stale', async () => {
  reads = requests = 0; state = 'gone';
  replacement = { ...descriptor, process: { ...descriptor.process!, creationTime: '133000000000000001' } };
  await expect(health.checkHealth(port)).rejects.toThrow(realConnection.CoordinatorSecurityError);
  replacement = undefined;
});

test.skipIf(!windows)('alive and unknown identity, TLS failure and authentication rejection fail closed', async () => {
  reads = requests = 0; replacement = undefined; state = 'unknown';
  await expect(health.checkHealth(port)).rejects.toThrow(realConnection.CoordinatorSecurityError);
  state = 'alive'; rejectRequest = true;
  await expect(health.checkHealth(port)).rejects.toThrow(realConnection.CoordinatorSecurityError);
  rejectRequest = false;
  await expect(health.checkHealth(port)).rejects.toThrow(realConnection.CoordinatorSecurityError);
});

test.skipIf(!windows)('gone identity with an occupied listener does not become stale', async () => {
  const server = createServer((socket) => socket.destroy());
  await new Promise<void>((resolve) => server.listen(0, '127.0.0.1', resolve));
  const original = descriptor;
  descriptor = { ...descriptor, httpsPort: (server.address() as { port: number }).port };
  reads = requests = 0; state = 'gone'; replacement = undefined; rejectRequest = false;
  try {
    await expect(health.checkHealth(descriptor.httpsPort)).rejects.toThrow(realConnection.CoordinatorSecurityError);
    expect(requests).toBe(1);
  } finally {
    descriptor = original;
    await new Promise<void>((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});
