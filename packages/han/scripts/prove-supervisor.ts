import { strict as assert } from 'node:assert';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createServer } from 'node:net';
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
  supervisor: { pid: number; nonce: string; generationId: string } | null;
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
    HAN_BINARY: `'${process.execPath.replaceAll("'", "'\\''")}' '${cli.replaceAll("'", "'\\''")}'`,
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
    if (child.exitCode !== null) {
      const stdout = await new Response(child.stdout as ReadableStream).text();
      const stderr = await new Response(child.stderr as ReadableStream).text();
      throw new Error(
        `Fixture process ${child.pid} exited ${child.exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`
      );
    }
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
function observedSupervisor(
  dir: string,
  running: string,
  options: { port?: number; env?: Record<string, string> } = {}
): Bun.Subprocess {
  const daemon = resolve(
    import.meta.dir,
    '../lib/commands/coordinator/daemon.ts'
  );
  const port = options.port ?? 0;
  const script = `
    const fs = await import('node:fs');
    const log = console.log;
    console.log = (...args) => {
      if (String(args[0]).includes('[coordinator] Running.')) fs.writeFileSync(${JSON.stringify(running)}, 'running');
      log(...args);
    };
    const { startDaemon } = await import(${JSON.stringify(daemon)});
    try { await startDaemon({ port: ${port}, foreground: true }); } catch (e) { console.error(e); process.exit(1); }
  `;
  return Bun.spawn([process.execPath, '-e', script], {
    env: { ...environment(dir), ...(options.env ?? {}) },
    stdout: 'pipe',
    stderr: 'pipe',
  });
}

async function supervisorRecovery(): Promise<void> {
  const dir = directory();
  const running = join(dir, 'supervisor-running');
  const supervisor = observedSupervisor(dir, running);
  children.push(supervisor);
  let ownedPid: number | undefined;
  try {
    const initial = await ready(dir, supervisor);
    ownedPid = initial.pid;
    assertChild(initial.pid, supervisor.pid);
    await waitFor('supervisor running before crash', () =>
      existsSync(running) ? true : undefined
    );
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
    const oldBearer = await fetch(
      `https://127.0.0.1:${replacement.httpsPort}/health`,
      {
        headers: { Authorization: `Bearer ${initial.bearerToken}` },
        tls: { ca: replacement.certificatePem, rejectUnauthorized: true },
      } as RequestInit
    );
    assert.equal(oldBearer.status, 401);
    await assert.rejects(
      fetch(`https://127.0.0.1:${replacement.httpsPort}/health`, {
        headers: { Authorization: `Bearer ${replacement.bearerToken}` },
        tls: { ca: initial.certificatePem, rejectUnauthorized: true },
      } as RequestInit)
    );
    const shutdown = `https://127.0.0.1:${replacement.grpcPort}/han.coordinator.CoordinatorService/Shutdown`;
    const staleShutdown = await fetch(shutdown, {
      method: 'POST',
      headers: {
        'content-type': 'application/grpc-web+proto',
        Authorization: `Bearer ${initial.bearerToken}`,
      },
      body: new Uint8Array(5),
      tls: { ca: replacement.certificatePem, rejectUnauthorized: true },
    } as RequestInit);
    assert.equal(staleShutdown.headers.get('grpc-status'), '16');
    await assert.rejects(
      fetch(shutdown, {
        method: 'POST',
        headers: {
          'content-type': 'application/grpc-web+proto',
          Authorization: `Bearer ${replacement.bearerToken}`,
        },
        body: new Uint8Array(5),
        tls: { ca: initial.certificatePem, rejectUnauthorized: true },
      } as RequestInit)
    );
    assert.equal(await healthy(replacement), true);
    assert.equal(
      readdirSync(join(dir, 'runtime')).some((name) =>
        name.startsWith('coordinator.stopping.')
      ),
      false
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
  const started = join(dir, 'owner-started');
  const script = `
    const { existsSync, writeFileSync } = await import('node:fs');
    const { startCoordinatorService, stopCoordinatorService } = await import(${JSON.stringify(service)});
    await startCoordinatorService();
    writeFileSync(${JSON.stringify(started)}, 'started');
    while (!existsSync(${JSON.stringify(flag)})) await Bun.sleep(50);
    const result = await startCoordinatorService();
    if (result.kind !== 'attached') throw new Error('cached owner claimed a replacement');
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
    await waitFor('old owner startup complete', () => {
      if (owner.exitCode !== null)
        throw new Error('old owner exited before startup completed');
      return existsSync(started) ? true : undefined;
    });
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
    if (owner.exitCode !== 0) {
      const stdout = await new Response(owner.stdout as ReadableStream).text();
      const stderr = await new Response(owner.stderr as ReadableStream).text();
      throw new Error(
        `old owner exited ${owner.exitCode}\n${stdout}\n${stderr}`
      );
    }
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
async function replacementWinsStartupRace(): Promise<void> {
  const dir = directory();
  const paused = join(dir, 'spawn-paused');
  const resume = join(dir, 'spawn-resume');
  const readyFlag = join(dir, 'owner-ready');
  const finish = join(dir, 'owner-finish');
  const script = `
    const fs = await import('node:fs');
    const original = Bun.spawn;
    Bun.spawn = (args, options) => {
      if (Array.isArray(args) && args[0] === ${JSON.stringify(binary)}) {
        fs.writeFileSync(${JSON.stringify(paused)}, 'paused');
        while (!fs.existsSync(${JSON.stringify(resume)})) Bun.sleepSync(10);
      }
      return original(args, options);
    };
    const { startCoordinatorService, stopCoordinatorService } = await import(${JSON.stringify(service)});
    await startCoordinatorService();
    fs.writeFileSync(${JSON.stringify(readyFlag)}, 'ready');
    while (!fs.existsSync(${JSON.stringify(finish)})) await Bun.sleep(50);
    await stopCoordinatorService();
  `;
  const owner = Bun.spawn([process.execPath, '-e', script], {
    env: environment(dir),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  children.push(owner);
  let replacement: Bun.Subprocess | undefined;
  try {
    await waitFor('owned spawn barrier', () => {
      if (owner.exitCode !== null)
        throw new Error(`Owner exited before spawn barrier: ${owner.exitCode}`);
      return existsSync(paused) ? true : undefined;
    });
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
    const current = await ready(dir, replacement);
    assert.equal(current.pid, replacement.pid);
    writeFileSync(resume, 'resume');
    await waitFor('losing owner attached', () => {
      if (owner.exitCode !== null)
        throw new Error(`Owner exited during startup: ${owner.exitCode}`);
      return existsSync(readyFlag) ? true : undefined;
    });
    writeFileSync(finish, 'finish');
    await waitFor('losing owner shutdown', () =>
      owner.exitCode !== null ? owner.exitCode : undefined
    );
    assert.equal(owner.exitCode, 0);
    assert.equal(replacement.exitCode, null);
    assert.equal(
      await healthy(current),
      true,
      'startup winner was stopped by losing owner'
    );
    console.log('healthy startup winner survived its losing owner cleanup');
  } finally {
    if (replacement && replacement.exitCode === null) replacement.kill();
    if (replacement) await replacement.exited;
    if (owner.exitCode === null) owner.kill();
    await owner.exited;
  }
}

async function replacementWinsSupervisorRetry(): Promise<void> {
  const dir = directory();
  const arm = join(dir, 'arm-retry');
  const barrier = join(dir, 'retry-held');
  const release = join(dir, 'retry-release');
  const running = join(dir, 'supervisor-running');
  const daemon = resolve(
    import.meta.dir,
    '../lib/commands/coordinator/daemon.ts'
  );
  const script = `
    const fs = await import('node:fs');
    const log = console.log;
    console.log = (...args) => {
      if (String(args[0]).includes('[coordinator] Running.')) fs.writeFileSync(${JSON.stringify(running)}, 'running');
      log(...args);
    };
    const sleep = Bun.sleep;
    Bun.sleep = (ms) => {
      if (ms !== 2000 || !fs.existsSync(${JSON.stringify(arm)})) return sleep(ms);
      fs.writeFileSync(${JSON.stringify(barrier)}, 'held');
      return (async () => { while (!fs.existsSync(${JSON.stringify(release)})) await sleep(20); })();
    };
    const { startDaemon } = await import(${JSON.stringify(daemon)});
    try { await startDaemon({ port: 0, foreground: true }); } catch (e) { console.error(e); process.exitCode = 1; }
  `;
  const supervisor = Bun.spawn([process.execPath, '-e', script], {
    env: environment(dir),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  children.push(supervisor);
  let ownedPid: number | undefined;
  let replacement: Bun.Subprocess | undefined;
  try {
    const original = await ready(dir, supervisor);
    ownedPid = original.pid;
    assertChild(original.pid, supervisor.pid);
    await waitFor('owned supervisor running', () =>
      existsSync(running) ? true : undefined
    );
    writeFileSync(arm, 'armed');
    killChild(original.pid, supervisor.pid);
    ownedPid = undefined;
    await waitFor('retry barrier', async () => {
      if (supervisor.exitCode !== null) {
        const stdout = await new Response(
          supervisor.stdout as ReadableStream
        ).text();
        const stderr = await new Response(
          supervisor.stderr as ReadableStream
        ).text();
        throw new Error(
          `supervisor exited ${supervisor.exitCode} before retry barrier\nstdout:\n${stdout}\nstderr:\n${stderr}`
        );
      }
      return existsSync(barrier) && !existsSync(`/proc/${original.pid}`)
        ? true
        : undefined;
    });
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
    const current = await ready(dir, replacement, original.instanceId);
    assert.equal(current.pid, replacement.pid);
    writeFileSync(release, 'release');
    await waitFor('old supervisor to attach and exit', () =>
      supervisor.exitCode !== null ? supervisor.exitCode : undefined
    );
    assert.equal(supervisor.exitCode, 0);
    assert.equal(existsSync(join(dir, 'coordinator.pid')), false);
    assert.equal(existsSync(join(dir, 'coordinator.pid.takeover')), false);
    assert.equal(replacement.exitCode, null);
    assert.equal(await healthy(current), true);
    console.log(
      'retrying supervisor attached to the replacement and released its claim'
    );
  } finally {
    if (ownedPid !== undefined && supervisor.exitCode === null)
      killChild(ownedPid, supervisor.pid);
    if (supervisor.exitCode === null) supervisor.kill();
    await supervisor.exited;
    if (replacement && replacement.exitCode === null) replacement.kill();
    if (replacement) await replacement.exited;
  }
}

async function cliCommand(
  dir: string,
  command: 'stop' | 'restart'
): Promise<void> {
  const child = Bun.spawn(
    [process.execPath, cli, 'coordinator', command, '--port', '0'],
    {
      env: environment(dir),
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  children.push(child);
  await waitFor(`coordinator ${command} exit`, () =>
    child.exitCode !== null ? child.exitCode : undefined
  );
  if (child.exitCode !== 0) {
    const stdout = await new Response(child.stdout as ReadableStream).text();
    const stderr = await new Response(child.stderr as ReadableStream).text();
    throw new Error(
      `coordinator ${command} exited ${child.exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`
    );
  }
}

function assertStoppedRecords(dir: string): void {
  assert.equal(existsSync(join(dir, 'coordinator.pid')), false);
  assert.equal(existsSync(join(dir, 'coordinator.pid.takeover')), false);
  assert.equal(existsSync(join(dir, 'runtime/coordinator.json')), false);
  assert.equal(
    readdirSync(join(dir, 'runtime')).some((name) =>
      name.startsWith('coordinator.stopping.')
    ),
    false
  );
}

function killFixtureSupervisor(pid: number, dir: string, child?: number): void {
  try {
    const env = readFileSync(`/proc/${pid}/environ`, 'utf8').split('\0');
    assert.ok(
      env.includes(`HAN_DATA_DIR=${dir}`),
      'refusing to signal a supervisor outside the fixture'
    );
    const command = readFileSync(`/proc/${pid}/cmdline`, 'utf8');
    assert.ok(
      command.includes(cli),
      'refusing to signal a different executable'
    );
    if (child !== undefined) killChild(child, pid);
    process.kill(pid, 'SIGKILL');
  } catch (error) {
    if (
      (error as NodeJS.ErrnoException).code !== 'ENOENT' &&
      (error as NodeJS.ErrnoException).code !== 'ESRCH'
    )
      throw error;
  }
}

async function deadOwnerRecovery(
  command: 'stop' | 'restart' | 'orphan'
): Promise<void> {
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
  let original: Descriptor | undefined;
  let replacement: Descriptor | undefined;
  try {
    original = await ready(dir, supervisor);
    const predecessor = original;
    assertChild(original.pid, supervisor.pid);
    assert.equal(original.supervisor?.pid, supervisor.pid);
    // Freeze the supervisor so it cannot restart the child while the fixture
    // independently kills the pair. Only verified fixture-owned PIDs are signalled.
    process.kill(supervisor.pid, 'SIGSTOP');
    if (command !== 'orphan') killChild(original.pid, supervisor.pid);
    process.kill(supervisor.pid, 'SIGKILL');
    await supervisor.exited;
    if (command !== 'orphan') {
      await waitFor('dead coordinator process', () =>
        !existsSync(`/proc/${predecessor.pid}`) ? true : undefined
      );
      assert.equal(readDescriptor(dir)?.instanceId, original.instanceId);
      assert.equal(existsSync(join(dir, 'coordinator.pid.takeover')), true);
    } else {
      assert.equal(await healthy(original), true);
    }
    await cliCommand(dir, command === 'restart' ? 'restart' : 'stop');
    if (command === 'restart') {
      replacement = await waitFor('replacement after dead pair', async () => {
        const current = readDescriptor(dir);
        return current &&
          current.instanceId !== predecessor.instanceId &&
          (await healthy(current))
          ? current
          : undefined;
      });
      assert.ok(replacement.supervisor);
      assertChild(replacement.pid, replacement.supervisor.pid);
      await cliCommand(dir, 'stop');
    } else if (command === 'orphan') {
      await cliCommand(dir, 'restart');
      replacement = await waitFor(
        'replacement after orphan shutdown',
        async () => {
          const current = readDescriptor(dir);
          return current &&
            current.instanceId !== predecessor.instanceId &&
            (await healthy(current))
            ? current
            : undefined;
        }
      );
      assert.ok(replacement.supervisor);
      assertChild(replacement.pid, replacement.supervisor.pid);
      await cliCommand(dir, 'stop');
    }
    assertStoppedRecords(dir);
    console.log(`dead-owner recovery: ${command}`);
  } finally {
    if (supervisor.exitCode === null) {
      if (original) killChild(original.pid, supervisor.pid);
      supervisor.kill('SIGKILL');
      await supervisor.exited;
    }
    const remaining = readDescriptor(dir);
    if (remaining?.supervisor && remaining.supervisor.pid !== supervisor.pid)
      killFixtureSupervisor(remaining.supervisor.pid, dir, remaining.pid);
    // An orphan may still be alive if the stop failed. It was verified as the
    // fixture's child before the supervisor was killed.
    if (original && command === 'orphan' && (await healthy(original))) {
      const env = readFileSync(`/proc/${original.pid}/environ`, 'utf8').split(
        '\0'
      );
      if (env.includes(`HAN_DATA_DIR=${dir}`))
        process.kill(original.pid, 'SIGKILL');
    }
  }
}

async function intentionalStopAndRestart(): Promise<void> {
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
    {
      env: environment(dir),
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  children.push(supervisor);
  let ownedPid: number | undefined;
  let beforeRestart: Bun.Subprocess | undefined;
  let restartOwnedPid: number | undefined;
  let detachedSupervisor: number | undefined;
  let detachedChild: number | undefined;
  let failed = true;
  try {
    const initial = await ready(dir, supervisor);
    ownedPid = initial.pid;
    assertChild(initial.pid, supervisor.pid);
    assert.equal(initial.supervisor?.pid, supervisor.pid);
    await cliCommand(dir, 'stop');
    await waitFor('supervisor stop', () =>
      supervisor.exitCode !== null ? supervisor.exitCode : undefined
    );
    assert.equal(supervisor.exitCode, 0);
    await waitFor('stopped Rust child', () =>
      !existsSync(`/proc/${initial.pid}`) ? true : undefined
    );
    ownedPid = undefined;
    assertStoppedRecords(dir);

    beforeRestart = Bun.spawn(
      [
        process.execPath,
        cli,
        'coordinator',
        'start',
        '--foreground',
        '--port',
        '0',
      ],
      {
        env: environment(dir),
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );
    children.push(beforeRestart);
    const original = await ready(dir, beforeRestart);
    restartOwnedPid = original.pid;
    assertChild(original.pid, beforeRestart.pid);
    assert.equal(original.supervisor?.pid, beforeRestart.pid);
    await cliCommand(dir, 'restart');
    await waitFor('old supervisor after restart', () =>
      beforeRestart.exitCode !== null ? beforeRestart.exitCode : undefined
    );
    assert.equal(beforeRestart.exitCode, 0);
    await waitFor('old Rust child after restart', () =>
      !existsSync(`/proc/${original.pid}`) ? true : undefined
    );
    restartOwnedPid = undefined;
    const replacement = await waitFor('restarted coordinator', async () => {
      const descriptor = readDescriptor(dir);
      return descriptor &&
        descriptor.instanceId !== original.instanceId &&
        (await healthy(descriptor))
        ? descriptor
        : undefined;
    });
    assert.ok(replacement.supervisor);
    detachedSupervisor = replacement.supervisor.pid;
    detachedChild = replacement.pid;
    assert.notEqual(detachedSupervisor, beforeRestart.pid);
    assert.notEqual(replacement.certificatePem, original.certificatePem);
    assert.notEqual(replacement.bearerToken, original.bearerToken);
    assert.notEqual(
      replacement.supervisor.generationId,
      original.supervisor?.generationId
    );
    assertChild(replacement.pid, detachedSupervisor);
    await cliCommand(dir, 'stop');
    await waitFor('restarted supervisor exit', () =>
      !existsSync(`/proc/${detachedSupervisor}`) ? true : undefined
    );
    await waitFor('restarted child exit', () =>
      !existsSync(`/proc/${detachedChild}`) ? true : undefined
    );
    detachedSupervisor = undefined;
    detachedChild = undefined;
    assertStoppedRecords(dir);
    console.log(
      'actual coordinator stop and restart released their owned records'
    );
    failed = false;
  } finally {
    if (failed) {
      console.error(
        'supervisor diagnostics',
        JSON.stringify({
          exitCode: supervisor.exitCode,
          pidFile: existsSync(join(dir, 'coordinator.pid')),
          reservation: existsSync(join(dir, 'coordinator.pid.takeover')),
          runtime: readdirSync(join(dir, 'runtime')),
          processStat: existsSync(`/proc/${supervisor.pid}/stat`)
            ? readFileSync(`/proc/${supervisor.pid}/stat`, 'utf8')
            : null,
        })
      );
    }
    if (beforeRestart && beforeRestart.exitCode === null) {
      if (restartOwnedPid !== undefined)
        killChild(restartOwnedPid, beforeRestart.pid);
      beforeRestart.kill();
      await beforeRestart.exited;
    }
    if (ownedPid !== undefined && supervisor.exitCode === null)
      killChild(ownedPid, supervisor.pid);
    if (supervisor.exitCode === null) supervisor.kill();
    await supervisor.exited;
    if (failed) {
      console.error(
        'supervisor stdout:',
        await new Response(supervisor.stdout as ReadableStream).text()
      );
      console.error(
        'supervisor stderr:',
        await new Response(supervisor.stderr as ReadableStream).text()
      );
    }
    const remaining = readDescriptor(dir);
    if (
      detachedSupervisor === undefined &&
      remaining?.supervisor &&
      remaining.supervisor.pid !== supervisor.pid &&
      remaining.supervisor.pid !== beforeRestart?.pid
    ) {
      detachedSupervisor = remaining.supervisor.pid;
      detachedChild = remaining.pid;
    }
    if (detachedSupervisor !== undefined)
      killFixtureSupervisor(detachedSupervisor, dir, detachedChild);
  }
}

async function standaloneStopPreservesUnrelatedMarker(): Promise<void> {
  const dir = directory();
  const child = Bun.spawn(
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
  children.push(child);
  try {
    const descriptor = await ready(dir, child);
    assert.equal(descriptor.pid, child.pid);
    assert.equal(descriptor.supervisor, null);
    const pidPath = join(dir, 'coordinator.pid');
    writeFileSync(pidPath, String(process.pid));
    const requester = Bun.spawn(
      [process.execPath, cli, 'coordinator', 'stop', '--port', '0'],
      { env: environment(dir), stdout: 'pipe', stderr: 'pipe' }
    );
    children.push(requester);
    await waitFor('standalone stop rejection', () =>
      requester.exitCode !== null ? requester.exitCode : undefined
    );
    assert.notEqual(requester.exitCode, 0);
    assert.equal(child.exitCode, null);
    assert.equal(await healthy(descriptor), true);
    assert.equal(readFileSync(pidPath, 'utf8'), String(process.pid));
    assert.equal(readDescriptor(dir)?.instanceId, descriptor.instanceId);
    rmSync(pidPath);
    await cliCommand(dir, 'stop');
    await waitFor('standalone coordinator stop', () =>
      child.exitCode !== null ? child.exitCode : undefined
    );
    assert.equal(child.exitCode, 0);
    assert.equal(existsSync(join(dir, 'runtime/coordinator.json')), false);
    console.log(
      'standalone stop rejected an unbound PID without changing state'
    );
  } finally {
    if (child.exitCode === null) child.kill();
    await child.exited;
  }
}

async function committedStopSurvivesFailure(
  failure: 'child' | 'requester' | 'both'
): Promise<void> {
  const dir = directory();
  const running = join(dir, 'supervisor-running');
  const supervisor = observedSupervisor(dir, running);
  children.push(supervisor);
  let ownedPid: number | undefined;
  let requester: Bun.Subprocess | undefined;
  let paused = false;
  try {
    const descriptor = await ready(dir, supervisor);
    ownedPid = descriptor.pid;
    assertChild(descriptor.pid, supervisor.pid);
    assert.ok(descriptor.supervisor);
    assert.equal(descriptor.supervisor.pid, supervisor.pid);
    await waitFor('supervisor running before committed stop', () =>
      existsSync(running) ? true : undefined
    );
    supervisor.kill('SIGSTOP');
    paused = true;
    requester = Bun.spawn(
      [process.execPath, cli, 'coordinator', 'stop', '--port', '0'],
      { env: environment(dir), stdout: 'pipe', stderr: 'pipe' }
    );
    children.push(requester);
    const marker = join(
      dir,
      'runtime',
      `coordinator.stopping.${descriptor.supervisor.nonce}.${descriptor.supervisor.generationId}.json`
    );
    await waitFor('committed shutdown intent', () => {
      if (requester?.exitCode !== null)
        throw new Error('stop requester exited before intent was committed');
      return existsSync(marker) ? true : undefined;
    });
    assert.deepEqual(JSON.parse(readFileSync(marker, 'utf8')), descriptor);
    assert.equal(existsSync(join(dir, 'runtime/coordinator.json')), false);
    if (failure === 'both') {
      requester.kill('SIGKILL');
      killChild(descriptor.pid, supervisor.pid);
      supervisor.kill('SIGKILL');
      paused = false;
      await supervisor.exited;
      await requester.exited;
      await waitFor('dead committed-intent child', () =>
        !existsSync(`/proc/${descriptor.pid}`) ? true : undefined
      );
      assert.equal(existsSync(marker), true);
      await cliCommand(dir, 'stop');
      ownedPid = undefined;
      assertStoppedRecords(dir);
      console.log('CLI reclaimed committed intent after both owners died');
      return;
    }
    if (failure === 'child') killChild(descriptor.pid, supervisor.pid);
    else requester.kill('SIGKILL');
    supervisor.kill('SIGCONT');
    paused = false;
    await waitFor('supervisor to honor committed intent', () =>
      supervisor.exitCode !== null ? supervisor.exitCode : undefined
    );
    assert.equal(supervisor.exitCode, 0);
    await waitFor('committed shutdown child exit', () =>
      !existsSync(`/proc/${descriptor.pid}`) ? true : undefined
    );
    ownedPid = undefined;
    if (failure === 'child') {
      await waitFor('stop requester exit', () =>
        requester?.exitCode !== null ? requester?.exitCode : undefined
      );
      assert.equal(requester.exitCode, 0);
    } else {
      await requester.exited;
      assert.notEqual(requester.exitCode, 0);
    }
    assertStoppedRecords(dir);
    console.log(
      `committed shutdown survived ${failure} failure without restarting`
    );
  } finally {
    if (paused && supervisor.exitCode === null) supervisor.kill('SIGCONT');
    if (ownedPid !== undefined && supervisor.exitCode === null)
      killChild(ownedPid, supervisor.pid);
    if (supervisor.exitCode === null) supervisor.kill();
    await supervisor.exited;
    if (requester && requester.exitCode === null) requester.kill();
    if (requester) await requester.exited;
  }
}

async function preDispatchFailure(
  failure: 'stale-request' | 'dead-requester'
): Promise<void> {
  const dir = directory();
  const barrier = join(dir, 'request-held');
  const release = join(dir, 'request-release');
  const grpc = resolve(import.meta.dir, '../lib/grpc/client.ts');
  const daemon = resolve(
    import.meta.dir,
    '../lib/commands/coordinator/daemon.ts'
  );
  const script = `
    const fs = await import('node:fs');
    const { mock } = await import('bun:test');
    const original = await import(${JSON.stringify(grpc)});
    const createClients = original.createCoordinatorClients;
    mock.module(${JSON.stringify(grpc)}, () => ({
      ...original,
      createCoordinatorClients(...args) {
        const clients = createClients(...args);
        return { ...clients, coordinator: {
          async shutdown(...request) {
            fs.writeFileSync(${JSON.stringify(barrier)}, 'held');
            while (!fs.existsSync(${JSON.stringify(release)})) await Bun.sleep(20);
            return clients.coordinator.shutdown(...request);
          },
        } };
      },
    }));
    const { stopDaemon } = await import(${JSON.stringify(daemon)});
    try { await stopDaemon(0); } catch { process.exitCode = 1; }
  `;
  const running = join(dir, 'supervisor-running');
  const supervisor = observedSupervisor(dir, running);
  children.push(supervisor);
  let ownedPid: number | undefined;
  let requester: Bun.Subprocess | undefined;
  try {
    const original = await ready(dir, supervisor);
    ownedPid = original.pid;
    assertChild(original.pid, supervisor.pid);
    await waitFor('supervisor running before stop race', () =>
      existsSync(running) ? true : undefined
    );
    requester = Bun.spawn([process.execPath, '-e', script], {
      env: environment(dir),
      stdout: 'pipe',
      stderr: 'pipe',
    });
    children.push(requester);
    await waitFor('stop request held before dispatch', () => {
      if (requester?.exitCode !== null)
        throw new Error('requester exited before dispatch barrier');
      return existsSync(barrier) ? true : undefined;
    });
    if (failure === 'dead-requester') {
      requester.kill('SIGKILL');
      await requester.exited;
    }
    killChild(original.pid, supervisor.pid);
    ownedPid = undefined;
    const replacement = await ready(dir, supervisor, original.instanceId);
    ownedPid = replacement.pid;
    assertChild(replacement.pid, supervisor.pid);
    if (failure === 'stale-request') {
      writeFileSync(release, 'release');
      await waitFor('stale requester exit', () =>
        requester?.exitCode !== null ? requester?.exitCode : undefined
      );
      assert.notEqual(requester.exitCode, 0);
    }
    assert.equal(await healthy(replacement), true);
    assert.equal(
      readdirSync(join(dir, 'runtime')).some((name) =>
        name.startsWith('coordinator.stopping.')
      ),
      false
    );
    await cliCommand(dir, 'stop');
    await waitFor('recovered supervisor stop', () =>
      supervisor.exitCode !== null ? supervisor.exitCode : undefined
    );
    assert.equal(supervisor.exitCode, 0);
    await waitFor('recovered child stop', () =>
      !existsSync(`/proc/${replacement.pid}`) ? true : undefined
    );
    ownedPid = undefined;
    assertStoppedRecords(dir);
    console.log(`${failure} before dispatch left crash recovery intact`);
  } finally {
    if (requester && requester.exitCode === null) requester.kill();
    if (requester) await requester.exited;
    if (ownedPid !== undefined && supervisor.exitCode === null)
      killChild(ownedPid, supervisor.pid);
    if (supervisor.exitCode === null) supervisor.kill();
    await supervisor.exited;
  }
}

async function stopDuringStartup(): Promise<void> {
  const dir = directory();
  const barrier = join(dir, 'startup-held');
  const release = join(dir, 'startup-release');
  const observed = join(dir, 'startup-intent-observed');
  const intent = resolve(
    import.meta.dir,
    '../lib/commands/coordinator/shutdown-intent.ts'
  );
  const health = resolve(
    import.meta.dir,
    '../lib/commands/coordinator/health.ts'
  );
  const daemon = resolve(
    import.meta.dir,
    '../lib/commands/coordinator/daemon.ts'
  );
  const script = `
    const fs = await import('node:fs');
    const { mock } = await import('bun:test');
    const original = await import(${JSON.stringify(health)});
    const check = original.checkDescriptorHealth;
    mock.module(${JSON.stringify(health)}, () => ({
      ...original,
      async checkDescriptorHealth(descriptor, port) {
        const result = await check(descriptor, port);
        if (result) {
          fs.writeFileSync(${JSON.stringify(barrier)}, 'held');
          while (!fs.existsSync(${JSON.stringify(release)})) await Bun.sleep(20);
        }
        return result;
      },
    }));
    const originalIntent = await import(${JSON.stringify(intent)});
    const readIntent = originalIntent.readShutdownIntent;
    mock.module(${JSON.stringify(intent)}, () => ({
      ...originalIntent,
      readShutdownIntent(...args) {
        const result = readIntent(...args);
        if (result && args[2]) fs.writeFileSync(${JSON.stringify(observed)}, 'observed');
        return result;
      },
    }));
    const { startDaemon } = await import(${JSON.stringify(daemon)});
    try { await startDaemon({ port: 0, foreground: true }); } catch (e) { console.error(e); process.exitCode = 1; }
  `;
  const fixture = join(dir, 'startup-fixture.ts');
  writeFileSync(fixture, script);
  const supervisor = Bun.spawn([process.execPath, fixture], {
    env: environment(dir),
    stdout: 'pipe',
    stderr: 'pipe',
  });
  children.push(supervisor);
  let ownedPid: number | undefined;
  let requester: Bun.Subprocess | undefined;
  try {
    const descriptor = await ready(dir, supervisor);
    ownedPid = descriptor.pid;
    assertChild(descriptor.pid, supervisor.pid);
    assert.ok(descriptor.supervisor);
    await waitFor('startup health barrier', () =>
      existsSync(barrier) ? true : undefined
    );
    requester = Bun.spawn(
      [process.execPath, cli, 'coordinator', 'stop', '--port', '0'],
      {
        env: environment(dir),
        stdout: 'pipe',
        stderr: 'pipe',
      }
    );
    children.push(requester);
    const marker = join(
      dir,
      'runtime',
      `coordinator.stopping.${descriptor.supervisor.nonce}.${descriptor.supervisor.generationId}.json`
    );
    await waitFor('startup shutdown intent', () => {
      if (requester?.exitCode !== null)
        throw new Error('requester exited before startup intent');
      return existsSync(marker) ? true : undefined;
    });
    assertChild(descriptor.pid, supervisor.pid);
    process.kill(descriptor.pid, 'SIGSTOP');
    await waitFor('startup child suspended', () =>
      /^\d+ \(.*\) T /.test(
        readFileSync(`/proc/${descriptor.pid}/stat`, 'utf8')
      )
        ? true
        : undefined
    );
    writeFileSync(release, 'release');
    await waitFor('startup supervisor observed pinned intent', () =>
      existsSync(observed) ? true : undefined
    );
    process.kill(descriptor.pid, 'SIGCONT');
    await waitFor('startup supervisor stop', () =>
      supervisor.exitCode !== null ? supervisor.exitCode : undefined
    );
    await waitFor('startup stop request', () =>
      requester?.exitCode !== null ? requester?.exitCode : undefined
    );
    assert.equal(supervisor.exitCode, 0);
    assert.equal(requester.exitCode, 0);
    await waitFor('startup child stop', () =>
      !existsSync(`/proc/${descriptor.pid}`) ? true : undefined
    );
    ownedPid = undefined;
    assertStoppedRecords(dir);
    console.log('shutdown committed during startup did not trigger recovery');
  } finally {
    if (requester && requester.exitCode === null) requester.kill();
    if (requester) await requester.exited;
    if (ownedPid !== undefined && supervisor.exitCode === null)
      killChild(ownedPid, supervisor.pid);
    if (supervisor.exitCode === null) supervisor.kill();
    await supervisor.exited;
  }
}

async function fixedPortPublicationBarrier(): Promise<void> {
  const dir = directory();
  const barrier = directory();
  const listener = createServer();
  const listening = Promise.withResolvers<void>();
  listener.once('error', listening.reject);
  listener.listen(0, '127.0.0.1', listening.resolve);
  await listening.promise;
  const address = listener.address();
  assert.ok(address && typeof address !== 'string');
  const port = address.port;
  const closed = Promise.withResolvers<void>();
  listener.close((error) => (error ? closed.reject(error) : closed.resolve()));
  await closed.promise;
  const running = join(dir, 'supervisor-running');
  const supervisor = observedSupervisor(dir, running, {
    port,
    env: {
      HAN_COORDINATOR_PORT: String(port),
      HAN_PROOF_STARTUP_BARRIER: barrier,
    },
  });
  children.push(supervisor);
  let owned: number | undefined;
  try {
    const previous = await ready(dir, supervisor);
    owned = previous.pid;
    assert.equal(previous.httpsPort, port);
    assertChild(previous.pid, supervisor.pid);
    await waitFor('supervisor running before barrier arm', async () => {
      if (supervisor.exitCode !== null) {
        const stdout = await new Response(
          supervisor.stdout as ReadableStream
        ).text();
        const stderr = await new Response(
          supervisor.stderr as ReadableStream
        ).text();
        throw new Error(
          `Supervisor exited ${supervisor.exitCode} before running marker\nstdout:\n${stdout}\nstderr:\n${stderr}`
        );
      }
      return existsSync(running) ? true : undefined;
    });
    writeFileSync(join(barrier, 'arm'), '');
    killChild(previous.pid, supervisor.pid);
    const marker = await waitFor('bound replacement', async () => {
      if (supervisor.exitCode !== null) {
        const stdout = await new Response(
          supervisor.stdout as ReadableStream
        ).text();
        const stderr = await new Response(
          supervisor.stderr as ReadableStream
        ).text();
        throw new Error(
          `Supervisor exited ${supervisor.exitCode}\nstdout:\n${stdout}\nstderr:\n${stderr}`
        );
      }
      if (!existsSync(join(barrier, 'bound.json'))) return undefined;
      return JSON.parse(readFileSync(join(barrier, 'bound.json'), 'utf8')) as {
        pid: number;
        httpsPort: number;
        supervisor: Descriptor['supervisor'];
      };
    });
    owned = marker.pid;
    assertChild(marker.pid, supervisor.pid);
    assert.equal(marker.httpsPort, port);
    assert.equal(marker.supervisor?.pid, supervisor.pid);
    assert.notEqual(
      marker.supervisor?.generationId,
      previous.supervisor?.generationId
    );
    assert.equal(readDescriptor(dir)?.instanceId, previous.instanceId);
    // A TCP connection to the held listener remains established because the
    // server cannot accept or close it before release. Detect attempted stale
    // health requests without ever exposing the token.
    for (let i = 0; i < 20; i++) {
      assert.equal(supervisor.exitCode, null);
      const established = readFileSync('/proc/net/tcp', 'utf8')
        .split('\n')
        .some((line) => {
          const fields = line.trim().split(/\s+/);
          return (
            fields[1]?.endsWith(
              `:${port.toString(16).toUpperCase().padStart(4, '0')}`
            ) && fields[3] === '01'
          );
        });
      assert.equal(established, false, 'request reached unpublished listener');
      await Bun.sleep(100);
    }
    assert.equal(readDescriptor(dir)?.instanceId, previous.instanceId);
    writeFileSync(join(barrier, 'release'), '');
    const next = await ready(dir, supervisor, previous.instanceId);
    assert.equal(next.pid, marker.pid);
    assert.equal(
      next.supervisor?.generationId,
      marker.supervisor?.generationId
    );
    assert.notEqual(next.bearerToken, previous.bearerToken);
    await cliCommand(dir, 'stop');
    owned = undefined;
    await supervisor.exited;
    assert.equal(supervisor.exitCode, 0);
    const supervisorStderr = await new Response(
      supervisor.stderr as ReadableStream
    ).text();
    assert.equal(
      (
        supervisorStderr.match(
          /\[coordinator\] Server crashed \(attempt 1\/5\)/g
        ) || []
      ).length,
      1,
      'expected exactly one server crashed attempt in supervisor stderr'
    );
    assertStoppedRecords(dir);
    console.log(
      'feature-enabled fixed-port bind-before-publication proof passed'
    );
  } finally {
    if (supervisor.exitCode === null) {
      if (owned !== undefined) killChild(owned, supervisor.pid);
      supervisor.kill();
      await supervisor.exited;
    }
  }
}

async function securityFailureTerminatesSupervisor(): Promise<void> {
  const dir = directory();
  const running = join(dir, 'supervisor-running');
  const supervisor = observedSupervisor(dir, running);
  children.push(supervisor);
  let ownedPid: number | undefined;
  try {
    const original = await ready(dir, supervisor);
    ownedPid = original.pid;
    assertChild(original.pid, supervisor.pid);
    await waitFor('supervisor running', () =>
      existsSync(running) ? true : undefined
    );
    // Tamper with the active descriptor to introduce a security error (corrupt bearer token)
    // without killing the child. The supervisor's next health check must fail closed
    // and terminate the supervisor rather than continuing or auto-restarting.
    const tampered = {
      ...original,
      bearerToken: 'corrupted-token-padding-to-length-43-bytes!',
    };
    writeFileSync(
      join(dir, 'runtime/coordinator.json'),
      JSON.stringify(tampered),
      { mode: 0o600 }
    );
    await waitFor('supervisor security termination', () =>
      supervisor.exitCode !== null ? supervisor.exitCode : undefined
    );
    assert.notEqual(supervisor.exitCode, 0);
    console.log(
      'security error during supervisor loop terminated supervisor without restart'
    );
  } finally {
    if (ownedPid !== undefined && supervisor.exitCode === null)
      killChild(ownedPid, supervisor.pid);
    if (supervisor.exitCode === null) supervisor.kill();
    await supervisor.exited;
    // Clean up child if still running
    if (ownedPid !== undefined) {
      try {
        process.kill(ownedPid, 'SIGKILL');
      } catch {}
    }
  }
}

async function defaultBuildIgnoresBarrier(): Promise<void> {
  const dir = directory();
  const barrier = directory();
  writeFileSync(join(barrier, 'arm'), '');
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
    {
      env: { ...environment(dir), HAN_PROOF_STARTUP_BARRIER: barrier },
      stdout: 'pipe',
      stderr: 'pipe',
    }
  );
  children.push(supervisor);
  let owned: number | undefined;
  try {
    const current = await ready(dir, supervisor);
    owned = current.pid;
    assertChild(current.pid, supervisor.pid);
    assert.equal(existsSync(join(barrier, 'bound.json')), false);
    await cliCommand(dir, 'stop');
    owned = undefined;
    await supervisor.exited;
    assertStoppedRecords(dir);
    console.log('default build ignored the proof barrier');
  } finally {
    if (supervisor.exitCode === null) {
      if (owned !== undefined) killChild(owned, supervisor.pid);
      supervisor.kill();
      await supervisor.exited;
    }
  }
}

try {
  if (process.env.HAN_PROOF_BARRIER_ONLY === '1') {
    await fixedPortPublicationBarrier();
  } else {
    await defaultBuildIgnoresBarrier();
    await intentionalStopAndRestart();
    await deadOwnerRecovery('stop');
    await deadOwnerRecovery('restart');
    await deadOwnerRecovery('orphan');
    await supervisorRecovery();
    await replacementSurvivesOldOwner();
    await replacementWinsStartupRace();
    await replacementWinsSupervisorRetry();
    await standaloneStopPreservesUnrelatedMarker();
    await committedStopSurvivesFailure('child');
    await committedStopSurvivesFailure('requester');
    await committedStopSurvivesFailure('both');
    await preDispatchFailure('stale-request');
    await preDispatchFailure('dead-requester');
    await stopDuringStartup();
    await securityFailureTerminatesSupervisor();
  }
} finally {
  for (const child of children) if (child.exitCode === null) child.kill();
  await Promise.all(children.map((child) => child.exited));
  for (const dir of directories) rmSync(dir, { recursive: true, force: true });
}
