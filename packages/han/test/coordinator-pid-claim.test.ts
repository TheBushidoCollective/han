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
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

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
    Bun.spawn(['bun', '-e', script], {
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
    readers.map(({ reader, decoder, carry }) =>
      readLine(reader, decoder, carry)
    )
  );
}

test('concurrent claims produce exactly one winner', async () => {
  const outcomes = await raceClaimants();

  expect(outcomes.filter((line) => line === 'WON')).toHaveLength(1);
  expect(outcomes.filter((line) => line.startsWith('BLOCKED:'))).toHaveLength(
    CLAIMANTS - 1
  );
}, 30_000);

test('a claim held by a live process is refused, not stolen', async () => {
  const holder = Bun.spawn(['sleep', '30'], { stdout: 'ignore' });
  writeFileSync(join(dataDir, 'coordinator.pid'), String(holder.pid), 'utf-8');

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
  const dead = Bun.spawn(['true'], { stdout: 'ignore' });
  await dead.exited;
  writeFileSync(join(dataDir, 'coordinator.pid'), String(dead.pid), 'utf-8');

  const outcomes = await raceClaimants();

  expect(outcomes.filter((line) => line === 'WON')).toHaveLength(1);
  expect(outcomes.filter((line) => line.startsWith('BLOCKED:'))).toHaveLength(
    CLAIMANTS - 1
  );
}, 30_000);
