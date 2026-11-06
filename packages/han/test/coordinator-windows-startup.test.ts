import { afterAll, beforeAll, expect, mock, test } from 'bun:test';
import { existsSync, mkdirSync, mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { Command } from 'commander';

const windows = process.platform === 'win32';
let root = '';
let originalDataDir: string | undefined;
let events: string[] = [];
let realRuntime: typeof import('../lib/coordinator/windows-runtime.ts');
let realHealth: typeof import('../lib/commands/coordinator/health.ts');
let realConnection: typeof import('../lib/coordinator/connection.ts');
let daemon: typeof import('../lib/commands/coordinator/daemon.ts');
let service: typeof import('../lib/services/coordinator-service.ts');
let commands: typeof import('../lib/commands/coordinator/index.ts');

beforeAll(async () => {
  if (!windows) return;
  root = mkdtempSync(join(tmpdir(), 'han-windows-startup-'));
  originalDataDir = process.env.HAN_DATA_DIR;
  // These imports preserve real exports before installing the test boundary.
  realRuntime = { ...(await import('../lib/coordinator/windows-runtime.ts')) };
  realHealth = { ...(await import('../lib/commands/coordinator/health.ts')) };
  realConnection = { ...(await import('../lib/coordinator/connection.ts')) };
  mock.module('../lib/coordinator/windows-runtime.ts', () => ({
    ...realRuntime,
    windowsPrepareRuntime: (path: string) => {
      events.push('prepare');
      mkdirSync(path, { recursive: true });
    },
  }));
  mock.module('../lib/commands/coordinator/health.ts', () => ({
    ...realHealth,
    readOptionalDescriptor: () => null,
    checkHealth: async () => {
      events.push(
        existsSync(realConnection.getCoordinatorDataDir())
          ? 'health-prepared'
          : 'health-unprepared'
      );
      return { status: 'ok', pid: process.pid };
    },
  }));
  mock.module('../lib/coordinator/connection.ts', () => ({
    ...realConnection,
    readCoordinatorDescriptor: () => ({ httpsPort: 41957 }),
  }));
  // Load consumers after replacing their native and health boundaries.
  daemon = await import('../lib/commands/coordinator/daemon.ts');
  service = await import('../lib/services/coordinator-service.ts');
  commands = await import('../lib/commands/coordinator/index.ts');
});

afterAll(() => {
  if (!windows) return;
  mock.module('../lib/coordinator/windows-runtime.ts', () => realRuntime);
  mock.module('../lib/commands/coordinator/health.ts', () => realHealth);
  mock.module('../lib/coordinator/connection.ts', () => realConnection);
  if (originalDataDir === undefined) delete process.env.HAN_DATA_DIR;
  else process.env.HAN_DATA_DIR = originalDataDir;
  rmSync(root, { recursive: true, force: true });
});

async function checkStart(name: string, start: () => Promise<unknown>) {
  process.env.HAN_DATA_DIR = join(root, name);
  events = [];
  expect(existsSync(process.env.HAN_DATA_DIR)).toBe(false);
  await start();
  expect(events[0]).toBe('prepare');
  expect(events).toContain('health-prepared');
  expect(events).not.toContain('health-unprepared');
}

test.skipIf(!windows)(
  'each independent start path prepares a fresh data root before its first health read',
  async () => {
    await checkStart('daemon', () => daemon.startDaemon());
    await checkStart('ensure-daemon', () => daemon.ensureCoordinator());
    await checkStart('service', () => service.startCoordinatorService());
    await checkStart('ensure-service', () => service.ensureCoordinator());
    await checkStart('ensure-background', async () => {
      const program = new Command();
      commands.registerCoordinatorCommands(program);
      await program.parseAsync([
        'node',
        'han',
        'coordinator',
        'ensure',
        '--background',
      ]);
    });
  }
);

test.skipIf(!windows)('status does not prepare the runtime', async () => {
  process.env.HAN_DATA_DIR = join(root, 'status');
  events = [];
  await daemon.getStatus();
  expect(events).toEqual(['health-unprepared']);
  expect(existsSync(process.env.HAN_DATA_DIR)).toBe(false);
});
