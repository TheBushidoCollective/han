import { afterEach, beforeEach, expect, test } from 'bun:test';
import { randomUUID } from 'node:crypto';
import {
  chmodSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  readShutdownIntent,
  removeShutdownIntent,
} from '../lib/commands/coordinator/shutdown-intent.ts';
import {
  CoordinatorSecurityError,
  readCoordinatorDescriptor,
  sameCoordinator,
} from '../lib/coordinator/connection.ts';

let dir: string;
const previous = process.env.HAN_DATA_DIR;
const binding = {
  pid: process.pid,
  nonce: randomUUID(),
  generationId: randomUUID(),
};
const descriptor = {
  transportVersion: 1 as const,
  instanceId: randomUUID(),
  pid: 12345,
  httpsPort: 41957,
  grpcPort: 41958,
  certificatePem: '-----BEGIN CERTIFICATE-----\ntest',
  bearerToken: 'a'.repeat(43),
  supervisor: binding,
};
let path: string;

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), 'han-intent-'));
  process.env.HAN_DATA_DIR = dir;
  mkdirSync(join(dir, 'runtime'), { mode: 0o700 });
  path = join(
    dir,
    'runtime',
    `coordinator.stopping.${binding.nonce}.${binding.generationId}.json`
  );
});
afterEach(() => {
  if (previous === undefined) delete process.env.HAN_DATA_DIR;
  else process.env.HAN_DATA_DIR = previous;
  rmSync(dir, { recursive: true, force: true });
});

test('accepts and removes only a bound child generation', () => {
  writeFileSync(path, JSON.stringify(descriptor), { mode: 0o600 });
  expect(readShutdownIntent(binding, descriptor.pid, descriptor)).toEqual(
    descriptor
  );
  expect(() => readShutdownIntent(binding, descriptor.pid + 1)).toThrow(
    CoordinatorSecurityError
  );
  expect(() =>
    readShutdownIntent(binding, descriptor.pid, {
      ...descriptor,
      instanceId: randomUUID(),
    })
  ).toThrow(CoordinatorSecurityError);
  removeShutdownIntent(binding, descriptor.pid, descriptor);
  expect(readShutdownIntent(binding, descriptor.pid)).toBeNull();
});

test('rejects unsafe filenames, permissions and symlinks', () => {
  expect(() =>
    readShutdownIntent({ ...binding, nonce: '../escape' }, descriptor.pid)
  ).toThrow(CoordinatorSecurityError);
  writeFileSync(path, JSON.stringify(descriptor), { mode: 0o600 });
  chmodSync(path, 0o644);
  expect(() => readShutdownIntent(binding, descriptor.pid)).toThrow(
    CoordinatorSecurityError
  );
  rmSync(path);
  const target = join(dir, 'target');
  writeFileSync(target, JSON.stringify(descriptor), { mode: 0o600 });
  symlinkSync(target, path);
  expect(() => readShutdownIntent(binding, descriptor.pid)).toThrow(
    CoordinatorSecurityError
  );
});

test('descriptor requires a valid supervisor field and equality pins it', () => {
  const active = join(dir, 'runtime', 'coordinator.json');
  writeFileSync(active, JSON.stringify({ ...descriptor, supervisor: null }), {
    mode: 0o600,
  });
  expect(readCoordinatorDescriptor().supervisor).toBeNull();
  expect(
    sameCoordinator(descriptor, {
      ...descriptor,
      supervisor: { ...binding, generationId: randomUUID() },
    })
  ).toBe(false);
  writeFileSync(
    active,
    JSON.stringify({ ...descriptor, supervisor: undefined })
  );
  expect(() => readCoordinatorDescriptor()).toThrow(CoordinatorSecurityError);
});
