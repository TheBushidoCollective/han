/**
 * The supervisor PID claim has to survive a real race.
 *
 * A read-then-write claim loses exactly the race it exists to win: several
 * `han coordinator start --foreground` invocations landing together all read
 * an empty PID file, all conclude they are first, and all sit in the
 * keep-alive loop forever. That is what left six idle 160MB supervisors on a
 * developer machine.
 *
 * So this drives claimPidFile from separate OS processes, released together
 * through a start flag so their claims genuinely overlap (spawning alone does
 * not race: a fresh `bun -e` takes tens of milliseconds to boot, by which
 * time the first claimant is already a live holder). Each claimant then holds
 * its claim the way a real supervisor does.
 */
import { afterEach, beforeEach, expect, test } from 'bun:test';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { delimiter, join, resolve } from 'node:path';
import {
  claimSupervisorPid,
  readSupervisorIdentity,
  releaseSupervisorPid,
} from '../lib/commands/coordinator/pid-claim.ts';
import { findCoordinatorBinary } from '../lib/coordinator/binary.ts';
import {
  recoveryInspect,
  recoveryReclaim,
} from '../lib/coordinator/recovery-runtime.ts';

const CLAIMANTS = 8;

let dataDir: string;
let children: Bun.Subprocess[];
let originalPath: string | undefined;
let originalHome: string | undefined;

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'han-pid-claim-'));
  children = [];
  originalPath = process.env.PATH;
  originalHome = process.env.HOME;
  if (process.env.CI === 'true' && process.platform !== 'win32') {
    const buildDir = resolve(import.meta.dir, '../../han-rs/target/debug');
    process.env.PATH = `${buildDir}${delimiter}${originalPath ?? ''}`;
    process.env.HOME = dataDir;
    const selected = findCoordinatorBinary();
    if (
      !selected ||
      realpathSync(selected) !== realpathSync(join(buildDir, 'han-coordinator'))
    )
      throw new Error('PID proof did not select the freshly built coordinator');
  }
});

afterEach(async () => {
  for (const child of children) {
    child.kill();
  }
  await Promise.all(children.map((child) => child.exited));
  process.env.PATH = originalPath;
  process.env.HOME = originalHome;
  rmSync(dataDir, { recursive: true, force: true });
});

test('read-only identity follows the owned reservation and rejects its absence after release', () => {
  const path = join(dataDir, 'coordinator.pid');
  const result = claimSupervisorPid(path);
  expect(result.kind).toBe('owned');
  if (result.kind !== 'owned') throw new Error('claim was not acquired');
  expect(readSupervisorIdentity(path)).toEqual({
    pid: process.pid,
    nonce: result.claim.nonce,
  });
  releaseSupervisorPid(result.claim);
  expect(readSupervisorIdentity(path)).toBeNull();
});

test.skipIf(process.platform === 'win32')(
  'recovery refuses a replacement PID file even when its contents match',
  () => {
    const path = join(dataDir, 'coordinator.pid');
    const result = claimSupervisorPid(path);
    if (result.kind !== 'owned' || result.claim.kind !== 'unix')
      throw new Error('test claim was not acquired');
    const snapshot = recoveryInspect(dataDir, { kind: 'active' }).snapshot;
    const replacement = `${path}.replacement`;
    writeFileSync(replacement, readFileSync(path), { mode: 0o600 });
    renameSync(replacement, path);
    expect(recoveryReclaim(dataDir, snapshot)).toBe('changed');
    expect(readFileSync(path, 'utf8')).toBe(String(process.pid));
    expect(existsSync(`${path}.takeover`)).toBe(true);
  }
);

/**
 * Read one newline-terminated line from a child's stdout.
 *
 * The reader is typed structurally because `Bun.Subprocess.stdout` and
 * `node:stream/web` disagree on the reader's nominal type.
 */
async function readLine(
  reader: { read(): Promise<{ done?: boolean; value?: Uint8Array }> },
  decoder: TextDecoder,
  carry: { text: string }
): Promise<string> {
  while (!carry.text.includes('\n')) {
    const { done, value } = await reader.read();
    if (done) break;
    carry.text += decoder.decode(value, { stream: true });
  }
  const newline = carry.text.indexOf('\n');
  if (newline === -1) {
    const rest = carry.text;
    carry.text = '';
    return rest.trim();
  }
  const line = carry.text.slice(0, newline);
  carry.text = carry.text.slice(newline + 1);
  return line.trim();
}

/**
 * Race CLAIMANTS fresh processes for the PID file in `dataDir` and return
 * what each one decided: WON, or BLOCKED:<pid>. HAN_DATA_DIR is the
 * highest-priority override in getHanDataDir(), so nothing touches a real
 * ~/.han.
 */
async function raceClaimants(): Promise<string[]> {
  // The claimant runs in a separate `bun -e` process, so its import
  // specifier is a string built here at runtime; a static import cannot
  // express that, and an in-process call would never race.
  const daemonPath = join(
    import.meta.dir,
    '..',
    'lib',
    'commands',
    'coordinator',
    'daemon.ts'
  );
  const startFlag = join(dataDir, 'start');

  const script = `
    const { existsSync } = await import('node:fs');
    const { claimPidFile } = await import(${JSON.stringify(daemonPath)});
    console.log('READY');
    // Spin rather than sleep: the point is for every claimant to call
    // claimPidFile in the same instant, and a timer would both slow the
    // test down and widen the window it is trying to close. Fake timers
    // cannot span processes.
    while (!existsSync(${JSON.stringify(startFlag)})) {}
    const holder = claimPidFile();
    console.log(holder === null ? 'WON' : 'BLOCKED:' + holder);
    // Hold the claim the way a real supervisor does, until killed.
    await Promise.withResolvers().promise;
  `;

  const scriptPath = join(dataDir, 'claimant.ts');
  writeFileSync(scriptPath, script);
  children = Array.from({ length: CLAIMANTS }, () =>
    Bun.spawn([process.execPath, scriptPath], {
      env: { ...process.env, HAN_DATA_DIR: dataDir },
      stdout: 'pipe',
      stderr: 'pipe',
    })
  );

  const readers = children.map((child) => ({
    reader: (child.stdout as ReadableStream<Uint8Array>).getReader(),
    decoder: new TextDecoder(),
    carry: { text: '' },
  }));

  // Every claimant is loaded and spinning before any of them may claim.
  for (const { reader, decoder, carry } of readers) {
    expect(await readLine(reader, decoder, carry)).toBe('READY');
  }
  writeFileSync(startFlag, 'go', 'utf-8');

  return await Promise.all(
    readers.map(async ({ reader, decoder, carry }, index) => {
      const line = await readLine(reader, decoder, carry);
      if (!line) {
        const error = await new Response(
          children[index].stderr as ReadableStream
        ).text();
        throw new Error(`Claimant ${index} exited without a result: ${error}`);
      }
      return line;
    })
  );
}

test('concurrent claims produce exactly one winner', async () => {
  const outcomes = await raceClaimants();

  expect(outcomes.filter((line) => line === 'WON')).toHaveLength(1);
  expect(outcomes.filter((line) => line.startsWith('BLOCKED:'))).toHaveLength(
    CLAIMANTS - 1
  );
  const winner = children[outcomes.indexOf('WON')];
  expect(readFileSync(join(dataDir, 'coordinator.pid'), 'utf8')).toBe(
    String(winner.pid)
  );
  expect(outcomes.filter((line) => line.startsWith('BLOCKED:'))).toEqual(
    Array.from({ length: CLAIMANTS - 1 }, () => `BLOCKED:${winner.pid}`)
  );
  expect(readdirSync(join(dataDir, 'coordinator.pid.takeover'))).toHaveLength(
    1
  );
  expect(winner.exitCode).toBeNull();
}, 30_000);

test('unanchored live and dead PID files cannot authorize takeover', async () => {
  const path = join(dataDir, 'coordinator.pid');
  const holder = Bun.spawn(
    [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
    { stdout: 'ignore' }
  );
  children.push(holder);
  writeFileSync(path, String(holder.pid), { mode: 0o600 });
  expect(() => claimSupervisorPid(path)).toThrow();
  expect(readFileSync(path, 'utf8')).toBe(String(holder.pid));
  holder.kill();
  await holder.exited;
  children.splice(children.indexOf(holder), 1);
  expect(() => claimSupervisorPid(path)).toThrow();
  expect(readFileSync(path, 'utf8')).toBe(String(holder.pid));
}, 30_000);

test('malformed PID metadata cannot grant a claim or be removed', () => {
  const path = join(dataDir, 'coordinator.pid');
  writeFileSync(path, '123junk', { mode: 0o600 });
  expect(() => claimSupervisorPid(path)).toThrow();
  expect(readFileSync(path, 'utf8')).toBe('123junk');
});

test('a live reservation blocks before its PID is published', () => {
  const path = join(dataDir, 'coordinator.pid');
  const reservation = `${path}.takeover`;
  mkdirSync(reservation, { mode: 0o700 });
  const nonce = '11111111-1111-4111-8111-111111111111';
  writeFileSync(
    join(reservation, `owner.${nonce}.json`),
    JSON.stringify({ version: 1, pid: process.pid, nonce }),
    { mode: 0o600 }
  );
  utimesSync(reservation, new Date(0), new Date(0));
  expect(claimSupervisorPid(path)).toEqual({
    kind: 'blocked',
    pid: process.pid,
  });
  expect(readdirSync(reservation)).toEqual([`owner.${nonce}.json`]);
});

test('old release cannot remove a later acquisition', () => {
  const path = join(dataDir, 'coordinator.pid');
  const first = claimSupervisorPid(path);
  if (first.kind !== 'owned') throw new Error('First claim blocked');
  releaseSupervisorPid(first.claim);
  const second = claimSupervisorPid(path);
  if (second.kind !== 'owned') throw new Error('Second claim blocked');
  releaseSupervisorPid(first.claim);
  expect(existsSync(path)).toBe(true);
  expect(readFileSync(path, 'utf8')).toBe(String(process.pid));
  if (second.claim.kind !== 'unix') throw new Error('expected unix claim');
  expect(readdirSync(`${path}.takeover`)).toEqual([
    `owner.${second.claim.nonce}.json`,
  ]);
  releaseSupervisorPid(second.claim);
});

test('delayed stale reclaimer cannot delete a successor reservation', () => {
  const path = join(dataDir, 'coordinator.pid');
  const old = claimSupervisorPid(path);
  if (old.kind !== 'owned') throw new Error('First claim blocked');
  const snapshot = recoveryInspect(dataDir, { kind: 'active' }).snapshot;
  releaseSupervisorPid(old.claim);
  const successor = claimSupervisorPid(path);
  if (successor.kind !== 'owned') throw new Error('Successor blocked');
  expect(recoveryReclaim(dataDir, snapshot)).toBe('changed');
  expect(readFileSync(path, 'utf8')).toBe(String(process.pid));
  expect(readdirSync(`${path}.takeover`)).toEqual([
    `owner.${successor.claim.nonce}.json`,
  ]);
  releaseSupervisorPid(successor.claim);
});

test('reclaims a dead owner stopped before PID publication', async () => {
  const path = join(dataDir, 'coordinator.pid');
  const reservation = `${path}.takeover`;
  const owner = Bun.spawn(
    [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
    {
      stdout: 'ignore',
    }
  );
  children.push(owner);
  const nonce = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  mkdirSync(reservation, { mode: 0o700 });
  writeFileSync(
    join(reservation, `owner.${nonce}.json`),
    JSON.stringify({ version: 1, pid: owner.pid, nonce }),
    { mode: 0o600 }
  );
  expect(claimSupervisorPid(path)).toEqual({ kind: 'blocked', pid: owner.pid });
  owner.kill();
  await owner.exited;
  children.splice(children.indexOf(owner), 1);
  const successor = claimSupervisorPid(path);
  if (successor.kind !== 'owned')
    throw new Error('Dead owner was not reclaimed');
  expect(readFileSync(path, 'utf8')).toBe(String(process.pid));
  releaseSupervisorPid(successor.claim);
}, 30_000);

test('live owner cannot be reclaimed through a recovery snapshot', () => {
  const path = join(dataDir, 'coordinator.pid');
  const claim = claimSupervisorPid(path);
  if (claim.kind !== 'owned') throw new Error('Claim blocked');
  const snapshot = recoveryInspect(dataDir, { kind: 'active' }).snapshot;
  expect(recoveryReclaim(dataDir, snapshot)).toBe('busy');
  expect(readFileSync(path, 'utf8')).toBe(String(process.pid));
  releaseSupervisorPid(claim.claim);
});

test('recovery preserves an intervening claim after an absent snapshot', () => {
  const path = join(dataDir, 'coordinator.pid');
  const first = claimSupervisorPid(path);
  if (first.kind !== 'owned') throw new Error('Claim blocked');
  releaseSupervisorPid(first.claim);
  const snapshot = recoveryInspect(dataDir, { kind: 'active' }).snapshot;
  const successor = claimSupervisorPid(path);
  if (successor.kind !== 'owned') throw new Error('Successor blocked');
  expect(recoveryReclaim(dataDir, snapshot)).toBe('changed');
  expect(readFileSync(path, 'utf8')).toBe(String(process.pid));
  releaseSupervisorPid(successor.claim);
});

test.skipIf(process.platform === 'win32')(
  'PID symlinks are rejected without changing their target',
  () => {
    const path = join(dataDir, 'coordinator.pid');
    const target = join(dataDir, 'target');
    writeFileSync(target, '123', { mode: 0o600 });
    symlinkSync(target, path);
    expect(() => claimSupervisorPid(path)).toThrow();
    expect(readFileSync(target, 'utf8')).toBe('123');
  }
);

test('malformed reservation never grants ownership', () => {
  const path = join(dataDir, 'coordinator.pid');
  const reservation = `${path}.takeover`;
  mkdirSync(reservation, { mode: 0o700 });
  writeFileSync(join(reservation, 'unexpected'), 'unsafe', { mode: 0o600 });
  expect(() => claimSupervisorPid(path)).toThrow();
  expect(readFileSync(join(reservation, 'unexpected'), 'utf8')).toBe('unsafe');
  expect(existsSync(path)).toBe(false);
});

test('legacy regular-file reservations honor live and dead holders', async () => {
  const path = join(dataDir, 'coordinator.pid');
  const marker = `${path}.takeover`;
  const holder = Bun.spawn(
    [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
    { stdout: 'ignore' }
  );
  writeFileSync(marker, String(holder.pid), { mode: 0o644 });
  try {
    expect(claimSupervisorPid(path)).toEqual({
      kind: 'blocked',
      pid: holder.pid,
    });
  } finally {
    holder.kill();
    await holder.exited;
  }
  const claim = claimSupervisorPid(path);
  if (claim.kind !== 'owned')
    throw new Error('Dead legacy marker was not reclaimed');
  expect(readFileSync(path, 'utf8')).toBe(String(process.pid));
  releaseSupervisorPid(claim.claim);
});
