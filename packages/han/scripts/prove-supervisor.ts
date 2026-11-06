import { strict as assert } from 'node:assert';
import {
  existsSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
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
    await cliCommand(dir, 'stop');
    await waitFor('standalone coordinator stop', () =>
      child.exitCode !== null ? child.exitCode : undefined
    );
    assert.equal(child.exitCode, 0);
    assert.equal(readFileSync(pidPath, 'utf8'), String(process.pid));
    assert.equal(existsSync(join(dir, 'runtime/coordinator.json')), false);
    console.log('standalone stop preserved unrelated supervisor marker');
  } finally {
    if (child.exitCode === null) child.kill();
    await child.exited;
  }
}

async function committedStopSurvivesFailure(
  failure: 'child' | 'requester'
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
  let ownedPid: number | undefined;
  let requester: Bun.Subprocess | undefined;
  let paused = false;
  try {
    const descriptor = await ready(dir, supervisor);
    ownedPid = descriptor.pid;
    assertChild(descriptor.pid, supervisor.pid);
    assert.ok(descriptor.supervisor);
    assert.equal(descriptor.supervisor.pid, supervisor.pid);
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
  let requester: Bun.Subprocess | undefined;
  try {
    const original = await ready(dir, supervisor);
    ownedPid = original.pid;
    assertChild(original.pid, supervisor.pid);
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
    const check = original.checkHealth;
    mock.module(${JSON.stringify(health)}, () => ({
      ...original,
      async checkHealth(port, starting) {
        const result = await check(port, starting);
        if (starting && result) {
          fs.writeFileSync(${JSON.stringify(barrier)}, 'held');
          while (!fs.existsSync(${JSON.stringify(release)})) await Bun.sleep(20);
        }
        return result;
      },
    }));
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
    writeFileSync(release, 'release');
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

try {
  await intentionalStopAndRestart();
  await supervisorRecovery();
  await replacementSurvivesOldOwner();
  await replacementWinsStartupRace();
  await standaloneStopPreservesUnrelatedMarker();
  await committedStopSurvivesFailure('child');
  await committedStopSurvivesFailure('requester');
  await preDispatchFailure('stale-request');
  await preDispatchFailure('dead-requester');
  await stopDuringStartup();
} finally {
  for (const child of children) if (child.exitCode === null) child.kill();
  await Promise.all(children.map((child) => child.exited));
  for (const dir of directories) rmSync(dir, { recursive: true, force: true });
}
