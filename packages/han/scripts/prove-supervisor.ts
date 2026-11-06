import { strict as assert } from 'node:assert';
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';

if (process.env.CI !== 'true' || process.platform !== 'linux')
  throw new Error('Supervisor proof requires an isolated Linux CI runner');
const binary = resolve(
  import.meta.dir,
  '../../han-rs/target/debug/han-coordinator'
);
const cli = resolve(import.meta.dir, '../lib/main.ts');
const service = resolve(
  import.meta.dir,
  '../lib/services/coordinator-service.ts'
);
interface Descriptor {
  instanceId: string;
  pid: number;
  httpsPort: number;
  grpcPort: number;
  certificatePem: string;
  bearerToken: string;
}
const children: Bun.Subprocess[] = [];
const directories: string[] = [];
function directory(): string {
  const dir = mkdtempSync(join(tmpdir(), 'han-supervisor-proof-'));
  directories.push(dir);
  return dir;
}
function environment(dir: string): Record<string, string | undefined> {
  return {
    ...process.env,
    HOME: dir,
    USERPROFILE: dir,
    HAN_DATA_DIR: dir,
    CLAUDE_CONFIG_DIR: join(dir, 'claude'),
    HAN_REEXEC: '1',
    HAN_COORDINATOR_PORT: '0',
    PATH: `${resolve(import.meta.dir, '../../han-rs/target/debug')}:${process.env.PATH}`,
  };
}
async function waitFor<T>(
  label: string,
  probe: () => T | undefined | Promise<T | undefined>
): Promise<T> {
  const deadline = Date.now() + 45000;
  while (Date.now() < deadline) {
    const value = await probe();
    if (value !== undefined) return value;
    await Bun.sleep(100);
  }
  throw new Error(`Timed out waiting for ${label}`);
}
function readDescriptor(dir: string): Descriptor | undefined {
  try {
    return JSON.parse(
      readFileSync(join(dir, 'runtime/coordinator.json'), 'utf8')
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}
async function healthy(d: Descriptor): Promise<boolean> {
  try {
    const response = await fetch(`https://127.0.0.1:${d.httpsPort}/health`, {
      headers: { Authorization: `Bearer ${d.bearerToken}` },
      tls: { ca: d.certificatePem, rejectUnauthorized: true },
      signal: AbortSignal.timeout(1500),
    } as RequestInit);
    return (
      response.ok && ((await response.json()) as { pid?: number }).pid === d.pid
    );
  } catch {
    return false;
  }
}
async function ready(
  dir: string,
  child: Bun.Subprocess,
  previous?: string
): Promise<Descriptor> {
  return waitFor('authenticated coordinator', async () => {
    if (child.exitCode !== null)
      throw new Error(`Fixture process ${child.pid} exited ${child.exitCode}`);
    const d = readDescriptor(dir);
    if (!d || d.instanceId === previous || !(await healthy(d)))
      return undefined;
    return d;
  });
}
function assertChild(pid: number, parent: number): void {
  const stat = readFileSync(`/proc/${pid}/stat`, 'utf8');
  const match = /^\d+ \(.*\) \S+ (\d+)/.exec(stat);
  assert.equal(
    Number(match?.[1]),
    parent,
    'refusing to signal a process outside the fixture'
  );
}
function killChild(pid: number, parent: number): void {
  try {
    assertChild(pid, parent);
    process.kill(pid, 'SIGKILL');
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== 'ENOENT' &&
      (error as NodeJS.ErrnoException).code !== 'ESRCH'
    )
      throw error;
  }
}
async function supervisorRecovery(): Promise<void> {
  const dir = directory();
  const supervisor = Bun.spawn(
    [
      process.execPath,
      cli,
      'coordinator',
      'start',
      '--foreground',
      '--port',
      '0',
    ],
    { env: environment(dir), stdout: 'pipe', stderr: 'pipe' }
  );
  children.push(supervisor);
  let ownedPid: number | undefined;
  try {
    const initial = await ready(dir, supervisor);
    ownedPid = initial.pid;
    assertChild(initial.pid, supervisor.pid);
    assert.equal(
      readFileSync(join(dir, 'coordinator.pid'), 'utf8'),
      String(supervisor.pid)
    );
    killChild(initial.pid, supervisor.pid);
    const replacement = await ready(dir, supervisor, initial.instanceId);
    ownedPid = replacement.pid;
    assert.notEqual(replacement.pid, initial.pid);
    assertChild(replacement.pid, supervisor.pid);
    assert.equal(
      readFileSync(join(dir, 'coordinator.pid'), 'utf8'),
      String(supervisor.pid)
    );
    const unauthorized = await fetch(
      `https://127.0.0.1:${replacement.httpsPort}/health`,
      {
        tls: { ca: replacement.certificatePem, rejectUnauthorized: true },
      } as RequestInit
    );
    assert.equal(unauthorized.status, 401);
    await assert.rejects(
      fetch(`https://127.0.0.1:${replacement.httpsPort}/health`, {
        headers: { Authorization: `Bearer ${replacement.bearerToken}` },
        tls: { ca: initial.certificatePem, rejectUnauthorized: true },
      } as RequestInit)
    );
    console.log(
      'supervisor restarted its crashed child with a new authenticated identity'
    );
  } finally {
    if (ownedPid !== undefined) killChild(ownedPid, supervisor.pid);
    supervisor.kill();
    await supervisor.exited;
  }
}
async function replacementSurvivesOldOwner(): Promise<void> {
  const dir = directory();
  const flag = join(dir, 'stop-owner');
  const script = `
    const { existsSync } = await import('node:fs');
    const { startCoordinatorService, stopCoordinatorService } = await import(${JSON.stringify(service)});
    await startCoordinatorService();
    while (!existsSync(${JSON.stringify(flag)})) await Bun.sleep(50);
    await stopCoordinatorService();
  `;
  const owner = Bun.spawn([process.execPath, '-e', script], {
    env: environment(dir),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  children.push(owner);
  let ownedPid: number | undefined;
  let replacement: Bun.Subprocess | undefined;
  try {
    const initial = await ready(dir, owner);
    ownedPid = initial.pid;
    assertChild(initial.pid, owner.pid);
    killChild(initial.pid, owner.pid);
    await waitFor('old child exit', () => {
      try {
        process.kill(initial.pid, 0);
        return undefined;
      } catch (e) {
        if ((e as NodeJS.ErrnoException).code === 'ESRCH') return true;
        throw e;
      }
    });
    ownedPid = undefined;
    replacement = Bun.spawn(
      [
        binary,
        '--foreground',
        '--port',
        '0',
        '--grpc-port',
        '0',
        '--no-watcher',
        '--data-dir',
        dir,
      ],
      { env: environment(dir), stdout: 'pipe', stderr: 'pipe' }
    );
    children.push(replacement);
    const current = await ready(dir, replacement, initial.instanceId);
    assert.equal(current.pid, replacement.pid);
    writeFileSync(flag, 'stop');
    await waitFor('old owner exit', () =>
      owner.exitCode !== null ? owner.exitCode : undefined
    );
    assert.equal(owner.exitCode, 0);
    assert.equal(replacement.exitCode, null);
    assert.equal(
      await healthy(current),
      true,
      'replacement was stopped by old owner'
    );
    console.log('replacement coordinator survived its former owner shutdown');
  } finally {
    if (ownedPid !== undefined) killChild(ownedPid, owner.pid);
    if (replacement && replacement.exitCode === null) replacement.kill();
    if (replacement) await replacement.exited;
    if (owner.exitCode === null) owner.kill();
    await owner.exited;
  }
}
try {
  await supervisorRecovery();
  await replacementSurvivesOldOwner();
} finally {
  for (const child of children) if (child.exitCode === null) child.kill();
  await Promise.all(children.map((child) => child.exited));
  for (const dir of directories) rmSync(dir, { recursive: true, force: true });
}
