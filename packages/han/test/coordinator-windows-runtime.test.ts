import { afterAll, beforeEach, expect, mock, test } from 'bun:test';
import { join, resolve } from 'node:path';

const realHelper = {
  ...(await import('../lib/coordinator/windows-helper.ts')),
};

let binary: string | null = 'native-helper';
let output: unknown = null;
let exitStatus: number | null = 0;
let failure: Error | undefined;
let rawOutput: string | undefined;
let invocation:
  | {
      executable: string;
      argv: string[];
      options: { input: string; maxBuffer: number; timeout: number };
    }
  | undefined;

mock.module('../lib/coordinator/windows-helper.ts', () => ({
  findCoordinatorBinary: () => binary,
  spawnSync: (
    executable: string,
    argv: string[],
    options: { input: string; maxBuffer: number; timeout: number }
  ) => {
    invocation = { executable, argv, options };
    return {
      status: exitStatus,
      error: failure,
      stdout:
        rawOutput ?? JSON.stringify({ version: 1, ok: true, result: output }),
    };
  },
}));
afterAll(() => {
  mock.module('../lib/coordinator/windows-helper.ts', () => realHelper);
});
// Install the fake native boundary before loading the bridge.
const bridge = await import('../lib/coordinator/windows-runtime.ts');
const dir = resolve('bridge-test-data');
const file = {
  volumeSerial: '0123456789abcdef',
  fileId: '0123456789abcdef0123456789abcdef',
};
const processIdentity = {
  pid: process.pid,
  creationTime: '133000000000000000',
  userSid: 'S-1-5-21-123',
};
const nonce = '00000000-0000-4000-8000-000000000001';
const binding = {
  pid: process.pid,
  nonce,
  generationId: '00000000-0000-4000-8000-000000000002',
};
const claim = {
  nonce,
  process: processIdentity,
  reservation: file,
  ownerFile: file,
  pidFile: file,
};
const descriptor = {
  transportVersion: 1 as const,
  instanceId: 'instance',
  pid: 42,
  process: { ...processIdentity, pid: 42 },
  httpsPort: 1234,
  grpcPort: null,
  certificatePem: '-----BEGIN CERTIFICATE-----',
  bearerToken: 'a'.repeat(43),
  supervisor: binding,
};
const launcher = {
  name: 'launcher-abc.html',
  path: join(dir, 'runtime', 'launcher-abc.html'),
  identity: file,
};
function recorded() {
  if (!invocation) throw new Error('helper was not invoked');
  return invocation;
}
const sent = () => JSON.parse(recorded().options.input);

beforeEach(() => {
  binary = 'native-helper';
  output = null;
  exitStatus = 0;
  failure = undefined;
  rawOutput = undefined;
  invocation = undefined;
});

test('bounded inherited-pipe envelope rejects missing or incompatible helper without exposing diagnostics', () => {
  binary = null;
  expect(() => bridge.windowsReadSupervisor(dir)).toThrow(
    bridge.CoordinatorSecurityError
  );
  binary = 'native-helper';
  for (const body of [
    '',
    '{',
    '{}',
    'null',
    '[]',
    '{"version":2,"ok":true,"result":null}',
    '{"version":1,"ok":false,"error":{"code":"ENOENT"}}',
    '{"version":1,"ok":true}',
    '{"version":1,"ok":true,"result":null} trailing',
    'x'.repeat(128 * 1024 + 1),
  ]) {
    rawOutput = body;
    expect(() => bridge.windowsReadSupervisor(dir)).toThrow(
      bridge.CoordinatorSecurityError
    );
  }
  rawOutput = undefined;
  exitStatus = 1;
  expect(() => bridge.windowsReadSupervisor(dir)).toThrow(
    bridge.CoordinatorSecurityError
  );
  exitStatus = null;
  failure = new Error('secret diagnostics');
  expect(() => bridge.windowsReadSupervisor(dir)).toThrow(
    'Windows local-runtime helper failed'
  );
  expect(recorded().argv).toEqual(['--local-runtime']);
  expect(recorded().options.maxBuffer).toBe(128 * 1024);
  expect(recorded().options.timeout).toBeGreaterThan(0);
  expect(sent()).toEqual({ version: 1, dataDir: dir, op: 'supervisor.read' });
});

test('descriptor targets accept only complete bounded records and validated identity', () => {
  expect(bridge.windowsReadDescriptor(dir, { kind: 'active' })).toBeNull();
  expect(sent().target).toEqual({ kind: 'active' });
  output = { identity: file, descriptor };
  expect(
    bridge.windowsReadDescriptor(dir, { kind: 'stopping', binding })
  ).toEqual(descriptor);
  expect(sent().target).toEqual({ kind: 'stopping', binding });
  for (const bad of [
    { identity: {}, descriptor },
    { identity: file, descriptor: {} },
    {
      identity: file,
      descriptor: { ...descriptor, certificatePem: 'x'.repeat(65537) },
    },
  ]) {
    output = bad;
    expect(() => bridge.windowsReadDescriptor(dir, { kind: 'active' })).toThrow(
      bridge.CoordinatorSecurityError
    );
  }
  expect(() =>
    bridge.windowsReadDescriptor(dir, {
      kind: 'stopping',
      binding: { ...binding, nonce: '../bad' },
    })
  ).toThrow(bridge.CoordinatorSecurityError);
});

test('acquisition and conditional release use complete claims and reject changed owners', () => {
  for (const kind of ['supervisor', 'spawn'] as const) {
    output = { status: 'owned', claim };
    expect(bridge.windowsAcquire(dir, kind)).toEqual({
      status: 'owned',
      claim,
    });
    expect(sent().op).toBe(`${kind}.acquire`);
    output = { status: 'blocked', ownerPid: 123 };
    expect(bridge.windowsAcquire(dir, kind)).toEqual({
      status: 'blocked',
      ownerPid: 123,
    });
    output = {
      status: 'owned',
      claim: {
        ...claim,
        process: { ...processIdentity, pid: process.pid + 1 },
      },
    };
    expect(() => bridge.windowsAcquire(dir, kind)).toThrow(
      bridge.CoordinatorSecurityError
    );
    output = { status: 'released' };
    bridge.windowsRelease(dir, kind, claim);
    expect(sent()).toEqual({
      version: 1,
      dataDir: dir,
      op: `${kind}.release`,
      claim,
    });
    output = { status: 'changed' };
    expect(() => bridge.windowsRelease(dir, kind, claim)).toThrow(
      bridge.CoordinatorSecurityError
    );
    output = { status: 'absent' };
    bridge.windowsRelease(dir, kind, claim);
  }
  for (const status of ['owned', 'changed', 'absent'] as const) {
    output = { status };
    expect(bridge.windowsCheck(dir, claim)).toBe(status);
  }
  output = { status: 'released' };
  expect(() => bridge.windowsCheck(dir, claim)).toThrow(
    bridge.CoordinatorSecurityError
  );
  expect(() =>
    bridge.windowsRelease(dir, 'supervisor', {
      ...claim,
      ownerFile: {},
    } as never)
  ).toThrow(bridge.CoordinatorSecurityError);
});

test('supervisor identity and process state reject PID reuse and uncertainty', () => {
  const present = {
    status: 'present' as const,
    pid: process.pid,
    nonce,
    process: processIdentity,
  };
  output = present;
  expect(bridge.windowsReadSupervisor(dir)).toEqual(present);
  for (const status of ['absent', 'recoverable'] as const) {
    const record = { status };
    output = record;
    expect(bridge.windowsReadSupervisor(dir)).toEqual(record);
  }
  output = {
    status: 'present',
    pid: process.pid + 1,
    nonce,
    process: processIdentity,
  };
  expect(() => bridge.windowsReadSupervisor(dir)).toThrow(
    bridge.CoordinatorSecurityError
  );
  for (const status of ['alive', 'gone'] as const) {
    output = { status };
    expect(bridge.windowsProcessState(dir, processIdentity)).toBe(status);
    expect(sent()).toEqual({
      version: 1,
      dataDir: dir,
      op: 'process.state',
      process: processIdentity,
    });
  }
  output = { status: 'unknown' };
  expect(() => bridge.windowsProcessState(dir, processIdentity)).toThrow(
    bridge.CoordinatorSecurityError
  );
  expect(() =>
    bridge.windowsProcessState(dir, {
      ...processIdentity,
      creationTime: '18446744073709551616',
    })
  ).toThrow(bridge.CoordinatorSecurityError);
});

test('intent cleanup requires the entire matching generation and does not remove a replacement', () => {
  output = { status: 'removed' };
  bridge.windowsRemoveIntent(dir, binding, 42, descriptor);
  expect(sent()).toEqual({
    version: 1,
    dataDir: dir,
    op: 'intent.remove',
    binding,
    childPid: 42,
    descriptor,
  });
  output = { status: 'changed' };
  expect(() =>
    bridge.windowsRemoveIntent(dir, binding, 42, descriptor)
  ).toThrow(bridge.CoordinatorSecurityError);
  expect(() =>
    bridge.windowsRemoveIntent(dir, binding, 43, descriptor)
  ).toThrow(bridge.CoordinatorSecurityError);
  output = { status: 'absent' };
  bridge.windowsRemoveIntent(dir, binding, 42, descriptor);
});

test('launcher creation and removal stay bound to the returned file identity', () => {
  output = launcher;
  expect(
    bridge.windowsCreateLauncher(dir, 'http://127.0.0.1:1234', 'a'.repeat(43))
  ).toEqual(launcher);
  expect(recorded().argv).not.toContain('a'.repeat(43));
  expect(sent()).toEqual({
    version: 1,
    dataDir: dir,
    op: 'launcher.create',
    origin: 'http://127.0.0.1:1234',
    token: 'a'.repeat(43),
  });
  for (const origin of [
    'http://localhost:1234',
    'https://127.0.0.1:1234',
    'http://127.0.0.1:0',
    'http://127.0.0.1:1234/',
    'http://127.0.0.1:65536',
    'http://user@127.0.0.1:1234',
  ])
    expect(() =>
      bridge.windowsCreateLauncher(dir, origin, 'a'.repeat(43))
    ).toThrow(bridge.CoordinatorSecurityError);
  output = { ...launcher, path: join(dir, 'elsewhere', launcher.name) };
  expect(() =>
    bridge.windowsCreateLauncher(dir, 'http://127.0.0.1:1234', 'a'.repeat(43))
  ).toThrow(bridge.CoordinatorSecurityError);
  output = { status: 'changed' };
  expect(() => bridge.windowsRemoveLauncher(dir, launcher)).toThrow(
    bridge.CoordinatorSecurityError
  );
  expect(sent()).toEqual({
    version: 1,
    dataDir: dir,
    op: 'launcher.remove',
    name: launcher.name,
    identity: file,
  });
  output = { status: 'absent' };
  bridge.windowsRemoveLauncher(dir, launcher);
});

test('preparation and supervisor variants validate exact helper responses', () => {
  output = { status: 'prepared' };
  bridge.windowsPrepareRuntime(dir);
  expect(sent()).toEqual({ version: 1, dataDir: dir, op: 'runtime.prepare' });
  for (const bad of [
    null,
    {},
    { status: 'prepared', extra: true },
    { status: 'absent', pid: 42 },
    { status: 'recoverable', process: processIdentity },
  ]) {
    output = bad;
    if ((bad as { status?: string } | null)?.status === 'prepared')
      expect(() => bridge.windowsPrepareRuntime(dir)).toThrow(
        bridge.CoordinatorSecurityError
      );
    else
      expect(() => bridge.windowsReadSupervisor(dir)).toThrow(
        bridge.CoordinatorSecurityError
      );
  }
  output = {
    identity: file,
    descriptor: { ...descriptor, process: undefined },
  };
  expect(() => bridge.windowsReadDescriptor(dir, { kind: 'active' })).toThrow(
    bridge.CoordinatorSecurityError
  );
  output = {
    identity: file,
    descriptor: { ...descriptor, process: { ...processIdentity, pid: 43 } },
  };
  expect(() => bridge.windowsReadDescriptor(dir, { kind: 'active' })).toThrow(
    bridge.CoordinatorSecurityError
  );
});

test('diagnostics allow only bounded native metadata and never copy secrets', () => {
  const secret = 'SENTINEL_SECRET_DO_NOT_PRINT';
  const readError = () => {
    try {
      bridge.windowsReadSupervisor(dir);
    } catch (error) {
      return String(error);
    }
    throw new Error('Expected helper failure');
  };
  failure = Object.assign(new Error(secret), { code: secret });
  expect(readError()).toContain('"spawnCode":"other"');
  expect(readError()).not.toContain(secret);
  failure = undefined;
  exitStatus = 17;
  rawOutput = JSON.stringify({
    version: 1,
    ok: false,
    error: {
      stage: 'runtime_directory',
      kind: 'permission_denied',
      win32Code: 5,
    },
  });
  expect(readError()).toContain('"stage":"runtime_directory"');
  rawOutput = JSON.stringify({
    version: 1,
    ok: false,
    error: { stage: secret, kind: 'other', win32Code: 5 },
  });
  expect(readError()).not.toContain(secret);
  rawOutput = secret;
  expect(readError()).not.toContain(secret);
  exitStatus = 0;
  expect(readError()).not.toContain(secret);
});

test.skipIf(process.platform !== 'win32')(
  'strict supervisor adapters reject recoverable records rather than reporting shutdown',
  async () => {
    const old = process.env.HAN_DATA_DIR;
    process.env.HAN_DATA_DIR = dir;
    try {
      // Load the consumer after installing the fake native boundary above.
      const {
        readSupervisorPid,
        readSupervisorIdentity,
        SupervisorReservationBusyError,
      } = await import('../lib/commands/coordinator/pid-claim.ts');
      const path = join(dir, 'coordinator.pid');
      output = { status: 'recoverable' };
      expect(() => readSupervisorPid(path)).toThrow(
        SupervisorReservationBusyError
      );
      expect(() => readSupervisorIdentity(path)).toThrow(
        SupervisorReservationBusyError
      );
      output = { status: 'absent' };
      expect(readSupervisorPid(path)).toBeNull();
      output = {
        status: 'present',
        pid: process.pid,
        nonce,
        process: processIdentity,
      };
      expect(readSupervisorPid(path)).toBe(process.pid);
    } finally {
      if (old === undefined) delete process.env.HAN_DATA_DIR;
      else process.env.HAN_DATA_DIR = old;
    }
  }
);

test.skipIf(process.platform !== 'win32')(
  'Windows recovery inspection accepts nonempty authority records and validates fence',
  async () => {
    // Load after installing mock.module boundary above.
    const recovery = await import('../lib/coordinator/recovery-runtime.ts');
    const authorityRecord = {
      identity: file,
      bytes: Buffer.from(
        JSON.stringify({ version: 1, nonce, process: processIdentity })
      ).toString('base64'),
    };
    output = {
      status: 'present',
      snapshot: {
        platform: 'windows',
        target: { kind: 'active' },
        active: {
          identity: file,
          bytes: Buffer.from(JSON.stringify(descriptor)).toString('base64'),
        },
        selected: {
          identity: file,
          bytes: Buffer.from(JSON.stringify(descriptor)).toString('base64'),
        },
        reservation: { identity: file, bytes: '' },
        ownerFile: {
          identity: file,
          bytes: Buffer.from(
            JSON.stringify({ version: 1, nonce, process: processIdentity })
          ).toString('base64'),
        },
        pidFile: {
          identity: file,
          bytes: Buffer.from('4242').toString('base64'),
        },
        stoppingNames: [],
        stopping: [],
        authorities: [
          {
            name: `supervisor.authority.${nonce}.json`,
            record: authorityRecord,
          },
        ],
      },
      descriptor,
      childState: 'alive',
      supervisorState: 'alive',
      supervisorProcess: processIdentity,
      claimState: 'alive',
      claimProcess: processIdentity,
      stoppingNames: [],
      stoppingBindings: [],
    };
    const inspection = recovery.recoveryInspect(dir, { kind: 'active' });
    expect(inspection.status).toBe('present');
    expect(inspection.snapshot.platform).toBe('windows');
    if (inspection.snapshot.platform === 'windows') {
      expect(inspection.snapshot.authorities.length).toBe(1);
      expect(inspection.snapshot.authorities[0].name).toBe(
        `supervisor.authority.${nonce}.json`
      );
    }
    expect(() =>
      recovery.assertRecoveryFence(
        inspection.snapshot,
        inspection.snapshot,
        descriptor.supervisor
      )
    ).not.toThrow();
  }
);

function mockChildWithStdout(bytes: Uint8Array, childPid = descriptor.pid) {
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      if (bytes.length > 0) controller.enqueue(bytes);
      controller.close();
    },
  });
  return {
    pid: childPid,
    stdout: stream,
    exitCode: 0,
  } as unknown as Bun.Subprocess;
}

test('readWindowsChildDescriptor reads complete receipt and validates descriptor', async () => {
  const receiptLine = new TextEncoder().encode(
    `${JSON.stringify({ version: 1, descriptor })}\n`
  );
  const child = mockChildWithStdout(receiptLine);
  const read = await bridge.readWindowsChildDescriptor(
    child,
    descriptor.supervisor,
    Date.now() + 5000
  );
  expect(read).toEqual(descriptor);
});

test('readWindowsChildDescriptor returns null on zero-byte EOF', async () => {
  const emptyChild = mockChildWithStdout(new Uint8Array(0));
  const read = await bridge.readWindowsChildDescriptor(
    emptyChild,
    descriptor.supervisor,
    Date.now() + 5000
  );
  expect(read).toBeNull();
});

test('readWindowsChildDescriptor rejects partial-frame, PID mismatch, and oversize receipts', async () => {
  const receiptLine = new TextEncoder().encode(
    `${JSON.stringify({ version: 1, descriptor })}\n`
  );
  const partialChild = mockChildWithStdout(
    new TextEncoder().encode('{"version":1')
  );
  await expect(
    bridge.readWindowsChildDescriptor(
      partialChild,
      descriptor.supervisor,
      Date.now() + 5000
    )
  ).rejects.toThrow(bridge.CoordinatorSecurityError);

  const mismatchChild = mockChildWithStdout(receiptLine, descriptor.pid + 1);
  await expect(
    bridge.readWindowsChildDescriptor(
      mismatchChild,
      descriptor.supervisor,
      Date.now() + 5000
    )
  ).rejects.toThrow(bridge.CoordinatorSecurityError);

  const oversized = new Uint8Array(131073);
  oversized.fill(0x61);
  oversized[131072] = 0x0a;
  const oversizedChild = mockChildWithStdout(oversized);
  await expect(
    bridge.readWindowsChildDescriptor(
      oversizedChild,
      descriptor.supervisor,
      Date.now() + 5000
    )
  ).rejects.toThrow(bridge.CoordinatorSecurityError);
});
