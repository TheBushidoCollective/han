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
  rmSync,
  symlinkSync,
  utimesSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import {
  claimSupervisorPid,
  readSupervisorIdentity,
  releaseSupervisorPid,
} from '../lib/commands/coordinator/pid-claim.ts';

const CLAIMANTS = 8;

let dataDir: string;
let children: Bun.Subprocess[];

beforeEach(() => {
  dataDir = mkdtempSync(join(tmpdir(), 'han-pid-claim-'));
  children = [];
});

afterEach(async () => {
  for (const child of children) {
    child.kill();
  }
  await Promise.all(children.map((child) => child.exited));
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

  children = Array.from({ length: CLAIMANTS }, () =>
    Bun.spawn([process.execPath, '-e', script], {
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

test('a claim held by a live process is refused, not stolen', async () => {
  const holder = Bun.spawn(
    [process.execPath, '-e', 'setInterval(() => {}, 1000)'],
    { stdout: 'ignore' }
  );
  writeFileSync(join(dataDir, 'coordinator.pid'), String(holder.pid), {
    mode: 0o600,
  });

  try {
    const outcomes = await raceClaimants();

    expect(outcomes).toEqual(
      Array.from({ length: CLAIMANTS }, () => `BLOCKED:${holder.pid}`)
    );
  } finally {
    holder.kill();
    await holder.exited;
  }
}, 30_000);

test('a dead holder is taken over by exactly one caller', async () => {
  const dead = Bun.spawn([process.execPath, '-e', ''], { stdout: 'ignore' });
  await dead.exited;
  writeFileSync(join(dataDir, 'coordinator.pid'), String(dead.pid), {
    mode: 0o600,
  });

  const outcomes = await raceClaimants();

  expect(outcomes.filter((line) => line === 'WON')).toHaveLength(1);
  expect(outcomes.filter((line) => line.startsWith('BLOCKED:'))).toHaveLength(
    CLAIMANTS - 1
  );
}, 30_000);

test('malformed PID metadata cannot grant a claim or be removed', () => {
  const path = join(dataDir, 'coordinator.pid');
  writeFileSync(path, '123junk', { mode: 0o600 });
  expect(() => claimSupervisorPid(path)).toThrow('Malformed supervisor PID');
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
  expect(readdirSync(`${path}.takeover`)).toEqual([second.claim.owner]);
  releaseSupervisorPid(second.claim);
});

test('delayed stale reclaimer cannot delete a successor reservation', async () => {
  const dead = Bun.spawn([process.execPath, '-e', ''], { stdout: 'ignore' });
  await dead.exited;
  const path = join(dataDir, 'coordinator.pid');
  const reservation = `${path}.takeover`;
  const nonce = 'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
  const staleOwner = join(reservation, `owner.${nonce}.json`);
  const resume = join(dataDir, 'resume');
  mkdirSync(reservation, { mode: 0o700 });
  writeFileSync(
    staleOwner,
    JSON.stringify({ version: 1, pid: dead.pid, nonce }),
    { mode: 0o600 }
  );
  const modulePath = join(
    import.meta.dir,
    '..',
    'lib',
    'commands',
    'coordinator',
    'pid-claim.ts'
  );
  const prefix = `
    const fs = await import('node:fs');
    const real = { ...fs };
    const { mock } = await import('bun:test');
  `;
  const pausedScript = `${prefix}
    mock.module('node:fs', () => ({ ...real, unlinkSync(path) {
      if (path === ${JSON.stringify(staleOwner)}) {
        console.log('PAUSED');
        while (!real.existsSync(${JSON.stringify(resume)})) {}
      }
      return real.unlinkSync(path);
    }}));
    const { claimSupervisorPid } = await import(${JSON.stringify(modulePath)});
    const result = claimSupervisorPid(${JSON.stringify(path)});
    console.log(result.kind === 'owned' ? 'WON' : 'BLOCKED:' + result.pid);
    await Promise.withResolvers().promise;
  `;
  const winnerScript = `
    const { claimSupervisorPid } = await import(${JSON.stringify(modulePath)});
    const result = claimSupervisorPid(${JSON.stringify(path)});
    console.log(result.kind === 'owned' ? 'WON' : 'BLOCKED:' + result.pid);
    await Promise.withResolvers().promise;
  `;
  const paused = Bun.spawn([process.execPath, '-e', pausedScript], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  children.push(paused);
  const pausedReader = (
    paused.stdout as ReadableStream<Uint8Array>
  ).getReader();
  const pausedDecoder = new TextDecoder();
  const pausedCarry = { text: '' };
  expect(await readLine(pausedReader, pausedDecoder, pausedCarry)).toBe(
    'PAUSED'
  );
  const winner = Bun.spawn([process.execPath, '-e', winnerScript], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  children.push(winner);
  const winnerReader = (
    winner.stdout as ReadableStream<Uint8Array>
  ).getReader();
  expect(await readLine(winnerReader, new TextDecoder(), { text: '' })).toBe(
    'WON'
  );
  const successorOwner = readdirSync(reservation);
  writeFileSync(resume, 'go');
  expect(await readLine(pausedReader, pausedDecoder, pausedCarry)).toBe(
    `BLOCKED:${winner.pid}`
  );
  expect(readFileSync(path, 'utf8')).toBe(String(winner.pid));
  expect(readdirSync(reservation)).toEqual(successorOwner);
  expect(winner.exitCode).toBeNull();
}, 30_000);

test.each([true, false])(
  'reclaims an owner stopped before PID publication: %s',
  async (crashBeforePublication) => {
    const path = join(dataDir, 'coordinator.pid');
    const reservation = `${path}.takeover`;
    const resume = join(dataDir, 'resume');
    const modulePath = join(
      import.meta.dir,
      '..',
      'lib',
      'commands',
      'coordinator',
      'pid-claim.ts'
    );
    const script = `
    const fs = await import('node:fs');
    const real = { ...fs };
    const { mock } = await import('bun:test');
    mock.module('node:fs', () => ({ ...real, renameSync(source, destination) {
      real.renameSync(source, destination);
      if (destination === ${JSON.stringify(reservation)}) {
        console.log('RESERVED');
        while (!real.existsSync(${JSON.stringify(resume)})) {}
      }
    }}));
    const { claimSupervisorPid } = await import(${JSON.stringify(modulePath)});
    const result = claimSupervisorPid(${JSON.stringify(path)});
    console.log(result.kind === 'owned' ? 'WON' : 'BLOCKED:' + result.pid);
    await Promise.withResolvers().promise;
  `;
    const owner = Bun.spawn([process.execPath, '-e', script], {
      stdout: 'pipe',
      stderr: 'pipe',
    });
    children.push(owner);
    const reader = (owner.stdout as ReadableStream<Uint8Array>).getReader();
    const decoder = new TextDecoder();
    const carry = { text: '' };
    expect(await readLine(reader, decoder, carry)).toBe('RESERVED');
    expect(claimSupervisorPid(path)).toEqual({
      kind: 'blocked',
      pid: owner.pid,
    });
    if (!crashBeforePublication) {
      writeFileSync(resume, 'go');
      expect(await readLine(reader, decoder, carry)).toBe('WON');
      expect(readFileSync(path, 'utf8')).toBe(String(owner.pid));
    }
    expect(owner.exitCode).toBeNull();
    owner.kill();
    await owner.exited;
    children.splice(children.indexOf(owner), 1);
    const successor = claimSupervisorPid(path);
    if (successor.kind !== 'owned')
      throw new Error('Dead owner was not reclaimed');
    expect(readFileSync(path, 'utf8')).toBe(String(process.pid));
    releaseSupervisorPid(successor.claim);
  },
  30_000
);

test('uncertain liveness cannot reclaim a reservation', () => {
  const path = join(dataDir, 'coordinator.pid');
  const reservation = `${path}.takeover`;
  const nonce = 'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
  const otherPid = 2147483000;
  mkdirSync(reservation, { mode: 0o700 });
  writeFileSync(
    join(reservation, `owner.${nonce}.json`),
    JSON.stringify({ version: 1, pid: otherPid, nonce }),
    { mode: 0o600 }
  );
  const original = process.kill;
  try {
    process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
      if (pid === otherPid)
        throw Object.assign(new Error('denied'), { code: 'EPERM' });
      return original(pid, signal);
    }) as typeof process.kill;
    expect(claimSupervisorPid(path)).toEqual({
      kind: 'blocked',
      pid: otherPid,
    });
    process.kill = ((pid: number, signal?: NodeJS.Signals | number) => {
      if (pid === otherPid)
        throw Object.assign(new Error('probe failed'), { code: 'EIO' });
      return original(pid, signal);
    }) as typeof process.kill;
    expect(() => claimSupervisorPid(path)).toThrow('probe failed');
    expect(readdirSync(reservation)).toEqual([`owner.${nonce}.json`]);
  } finally {
    process.kill = original;
  }
});

test('delayed removal of an empty reservation cannot remove a successor', async () => {
  const dead = Bun.spawn([process.execPath, '-e', ''], { stdout: 'ignore' });
  await dead.exited;
  const path = join(dataDir, 'coordinator.pid');
  const reservation = `${path}.takeover`;
  const nonce = 'cccccccc-cccc-4ccc-8ccc-cccccccccccc';
  const resume = join(dataDir, 'resume');
  mkdirSync(reservation, { mode: 0o700 });
  writeFileSync(
    join(reservation, `owner.${nonce}.json`),
    JSON.stringify({ version: 1, pid: dead.pid, nonce }),
    { mode: 0o600 }
  );
  const modulePath = join(
    import.meta.dir,
    '..',
    'lib',
    'commands',
    'coordinator',
    'pid-claim.ts'
  );
  const pausedScript = `
    const fs = await import('node:fs');
    const real = { ...fs };
    const { mock } = await import('bun:test');
    let paused = false;
    mock.module('node:fs', () => ({ ...real, rmdirSync(path) {
      if (path === ${JSON.stringify(reservation)} && !paused) {
        paused = true;
        console.log('PAUSED');
        while (!real.existsSync(${JSON.stringify(resume)})) {}
      }
      return real.rmdirSync(path);
    }}));
    const { claimSupervisorPid } = await import(${JSON.stringify(modulePath)});
    const result = claimSupervisorPid(${JSON.stringify(path)});
    console.log(result.kind === 'owned' ? 'WON' : 'BLOCKED:' + result.pid);
    await Promise.withResolvers().promise;
  `;
  const winnerScript = `
    const { claimSupervisorPid } = await import(${JSON.stringify(modulePath)});
    const result = claimSupervisorPid(${JSON.stringify(path)});
    console.log(result.kind === 'owned' ? 'WON' : 'BLOCKED:' + result.pid);
    await Promise.withResolvers().promise;
  `;
  const paused = Bun.spawn([process.execPath, '-e', pausedScript], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  children.push(paused);
  const reader = (paused.stdout as ReadableStream<Uint8Array>).getReader();
  const decoder = new TextDecoder();
  const carry = { text: '' };
  expect(await readLine(reader, decoder, carry)).toBe('PAUSED');
  const winner = Bun.spawn([process.execPath, '-e', winnerScript], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  children.push(winner);
  const winnerReader = (
    winner.stdout as ReadableStream<Uint8Array>
  ).getReader();
  expect(await readLine(winnerReader, new TextDecoder(), { text: '' })).toBe(
    'WON'
  );
  const successorOwner = readdirSync(reservation);
  writeFileSync(resume, 'go');
  expect(await readLine(reader, decoder, carry)).toBe(`BLOCKED:${winner.pid}`);
  expect(existsSync(reservation)).toBe(true);
  expect(readFileSync(path, 'utf8')).toBe(String(winner.pid));
  expect(readdirSync(reservation)).toEqual(successorOwner);
  expect(winner.exitCode).toBeNull();
}, 30_000);

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

test('retry exhaustion never grants ownership', async () => {
  const path = join(dataDir, 'coordinator.pid');
  const reservation = `${path}.takeover`;
  const modulePath = join(
    import.meta.dir,
    '..',
    'lib',
    'commands',
    'coordinator',
    'pid-claim.ts'
  );
  const script = `
    const fs = await import('node:fs');
    const real = { ...fs };
    const { mock } = await import('bun:test');
    mock.module('node:fs', () => ({ ...real, renameSync(source, destination) {
      if (destination === ${JSON.stringify(reservation)}) throw Object.assign(new Error('contended'), { code: 'EEXIST' });
      return real.renameSync(source, destination);
    }}));
    const { claimSupervisorPid } = await import(${JSON.stringify(modulePath)});
    try {
      claimSupervisorPid(${JSON.stringify(path)});
      console.log('UNEXPECTED_OWNERSHIP');
    } catch (error) {
      console.log('ERROR:' + error.message);
    }
  `;
  const child = Bun.spawn([process.execPath, '-e', script], {
    stdout: 'pipe',
    stderr: 'pipe',
  });
  const reader = (child.stdout as ReadableStream<Uint8Array>).getReader();
  expect(await readLine(reader, new TextDecoder(), { text: '' })).toBe(
    'ERROR:Supervisor claim contention exceeded retry limit'
  );
  expect(await child.exited).toBe(0);
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
