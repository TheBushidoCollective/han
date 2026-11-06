import { strict as assert } from 'node:assert';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  writeFileSync,
  rmSync,
} from 'node:fs';
import { createConnection } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  ProofCommandError,
  safeProofFailure,
} from './windows-proof-diagnostics.ts';

// Run only on a disposable Windows CI runner against the freshly built artifacts:
// bun packages/han/scripts/prove-installed-windows-coordinator.ts <han.exe> <han-coordinator.exe>
interface Descriptor {
  instanceId: string;
  pid: number;
  httpsPort: number;
  grpcPort: number;
  certificatePem: string;
  bearerToken: string;
  supervisor: { pid: number; nonce: string; generationId: string } | null;
  process: { pid: number; creationTime: string; userSid: string };
}

async function waitFor<T>(
  label: string,
  probe: () => T | undefined | Promise<T | undefined>
): Promise<T> {
  const deadline = Date.now() + 60000;
  do {
    const result = await probe();
    if (result !== undefined) return result;
    await Bun.sleep(200);
  } while (Date.now() < deadline);
  throw new Error(`Timed out waiting for ${label}`);
}

function readDescriptor(data: string): Descriptor | undefined {
  try {
    return JSON.parse(
      readFileSync(join(data, 'runtime', 'coordinator.json'), 'utf8')
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
    throw error;
  }
}

async function run(
  argv: string[],
  cwd: string,
  env: Record<string, string>,
  expectedFailure = false
): Promise<string> {
  const child = Bun.spawn(argv, { cwd, env, stdout: 'pipe', stderr: 'pipe' });
  const stdout = new Response(child.stdout).text();
  const stderr = new Response(child.stderr).text();
  const timer = setTimeout(() => child.kill(), 90000);
  try {
    const code = await child.exited;
    const output = `${await stdout}\n${await stderr}`;
    if ((code !== 0) !== expectedFailure) {
      throw new ProofCommandError(code, output);
    }
    return output;
  } finally {
    clearTimeout(timer);
  }
}

async function request(
  d: Descriptor,
  port: number,
  path: string,
  token?: string,
  body?: Uint8Array
): Promise<Response> {
  return fetch(`https://127.0.0.1:${port}${path}`, {
    method: body ? 'POST' : 'GET',
    headers: {
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(body ? { 'Content-Type': 'application/grpc-web+proto' } : {}),
    },
    body,
    tls: { ca: d.certificatePem, rejectUnauthorized: true },
    signal: AbortSignal.timeout(5000),
  } as RequestInit);
}

async function live(d: Descriptor): Promise<void> {
  assert.ok(d.supervisor, 'coordinator has no supervisor binding');
  assert.ok(d.httpsPort > 0 && d.grpcPort > 0);
  const health = await request(d, d.httpsPort, '/health', d.bearerToken);
  assert.equal(health.status, 200);
  const healthBody: unknown = await health.json();
  assert.ok(
    healthBody && typeof healthBody === 'object' && 'pid' in healthBody
  );
  assert.equal(healthBody.pid, d.pid);
  assert.equal((await request(d, d.httpsPort, '/health')).status, 401);
  assert.equal((await request(d, d.httpsPort, '/health', 'wrong')).status, 401);
  const grpcPath = '/han.coordinator.CoordinatorService/Health';
  const frame = new Uint8Array(5);
  const grpc = await request(d, d.grpcPort, grpcPath, d.bearerToken, frame);
  assert.equal(grpc.status, 200);
  const bytes = new Uint8Array(await grpc.arrayBuffer());
  assert.ok(
    bytes.length >= 7 && bytes[0] === 0,
    'missing gRPC response message'
  );
  const messageLength = new DataView(
    bytes.buffer,
    bytes.byteOffset + 1,
    4
  ).getUint32(0);
  assert.ok(messageLength >= 2 && bytes.length >= 5 + messageLength);
  assert.equal(bytes[5], 8, 'gRPC health response lacks healthy field');
  assert.equal(bytes[6], 1, 'gRPC coordinator reports unhealthy');
  const denied = await request(d, d.grpcPort, grpcPath, 'wrong', frame);
  assert.equal(denied.headers.get('grpc-status'), '16');
  await assert.rejects(
    fetch(`https://127.0.0.1:${d.httpsPort}/health`, {
      headers: { Authorization: `Bearer ${d.bearerToken}` },
      signal: AbortSignal.timeout(5000),
    })
  );
}

async function assertListenerUnbound(port: number): Promise<void> {
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const socket = createConnection({ host: '127.0.0.1', port });
  socket.setTimeout(5000);
  socket.once('connect', () => {
    socket.destroy();
    reject(new Error('Listener remains bound'));
  });
  socket.once('timeout', () => {
    socket.destroy();
    reject(new Error('Listener probe timed out'));
  });
  socket.once('error', (error: NodeJS.ErrnoException) => {
    socket.destroy();
    if (error.code === 'ECONNREFUSED') resolve();
    else reject(new Error('Listener probe failed'));
  });
  await promise;
}

async function main(): Promise<void> {
  if (process.platform !== 'win32' || process.env.CI !== 'true')
    throw new Error('Requires a disposable Windows CI runner');
  if (process.argv.length !== 4)
    throw new Error('Expected CLI and coordinator artifact paths');
  const systemRoot = process.env.SystemRoot;
  if (!systemRoot) throw new Error('SystemRoot is required');
  const powershell = join(
    systemRoot,
    'System32',
    'WindowsPowerShell',
    'v1.0',
    'powershell.exe'
  );
  const root = mkdtempSync(join(tmpdir(), 'han-windows-installed-'));
  const bin = join(root, 'bin');
  const data = join(root, 'data');
  const cli = join(bin, 'han.exe');
  const coordinator = join(bin, 'han-coordinator.exe');
  mkdirSync(bin);
  mkdirSync(join(root, 'tmp'));
  mkdirSync(join(root, 'claude'));
  copyFileSync(resolve(process.argv[2]), cli);
  copyFileSync(resolve(process.argv[3]), coordinator);
  const env: Record<string, string> = {
    SystemRoot: systemRoot,
    WINDIR: systemRoot,
    PATH: `${bin};${join(systemRoot, 'System32')};${systemRoot}`,
    HOME: root,
    USERPROFILE: root,
    APPDATA: join(root, 'appdata'),
    LOCALAPPDATA: join(root, 'localappdata'),
    TEMP: join(root, 'tmp'),
    TMP: join(root, 'tmp'),
    HAN_DATA_DIR: data,
    CLAUDE_CONFIG_DIR: join(root, 'claude'),
    HAN_COORDINATOR_PORT: '0',
    HAN_COORDINATOR_TIMEOUT: '60000',
    CI: 'true',
    CLAUDE_CODE_ENABLE_TELEMETRY: '0',
  };
  const command = (...args: string[]) => run([cli, ...args], root, env);
  const runtime = join(data, 'runtime');
  const reservation = join(runtime, 'supervisor.reservation.json');
  const owner = join(runtime, 'supervisor.owner.json');
  const pidFile = join(runtime, 'supervisor.pid');
  const lock = join(runtime, 'descriptor-publication.lock');
  type Identity = Descriptor['process'];
  const owned: { identity: Identity; image: string }[] = [];
  let fixture:
    | {
        pid: number;
        exitCode: number | null;
        kill: () => void;
        exited: Promise<number>;
      }
    | undefined;
  let phase = 'initial-status';
  let failed = false;
  let cleanupFailed = false;

  // Verify both the exact staged executable and creation time before signalling.
  const ownedProcess = async (
    identity: Identity,
    image: string,
    kill: boolean
  ): Promise<boolean> => {
    assert.ok(Number.isSafeInteger(identity.pid) && identity.pid > 0);
    assert.ok(/^[1-9][0-9]{0,19}$/.test(identity.creationTime));
    const script = `$p=Get-Process -Id ${identity.pid} -ErrorAction SilentlyContinue; if (!$p) { exit 3 }; $actual=[System.IO.Path]::GetFullPath($p.Path); $expected=[System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $env:HAN_PROOF_IMAGE).Path); if ($actual -ne $expected) { exit 4 }; if ($p.StartTime.ToUniversalTime().ToFileTimeUtc().ToString() -ne $env:HAN_PROOF_TIME) { exit 5 }; ${kill ? 'Stop-Process -InputObject $p -Force -ErrorAction Stop' : ''}`;
    const child = Bun.spawn(
      [powershell, '-NoProfile', '-NonInteractive', '-Command', script],
      {
        cwd: root,
        env: {
          ...env,
          HAN_PROOF_IMAGE: image,
          HAN_PROOF_TIME: identity.creationTime,
        },
        stdout: 'ignore',
        stderr: 'ignore',
      }
    );
    const code = await child.exited;
    if (code === 3 || code === 4 || code === 5) return false;
    if (code !== 0) throw new ProofCommandError(code, '');
    return true;
  };
  const register = (d: Descriptor) => {
    const claim = JSON.parse(readFileSync(reservation, 'utf8')) as {
      process: Identity;
    };
    assert.ok(d.supervisor && claim.process.pid === d.supervisor.pid);
    owned.push(
      { identity: d.process, image: coordinator },
      { identity: claim.process, image: cli }
    );
    return claim.process;
  };
  const started = async (previous?: Descriptor) => {
    const d = await waitFor('new descriptor', () => {
      const next = readDescriptor(data);
      return next && (!previous || next.instanceId !== previous.instanceId)
        ? next
        : undefined;
    });
    if (phase === 'initial-start-descriptor') phase = 'initial-start-identity';
    if (phase === 'initial-start-identity')
      phase = 'initial-start-registration';
    const supervisor = register(d);
    if (phase === 'initial-start-registration')
      phase = 'initial-start-coordinator';
    assert.ok(await ownedProcess(d.process, coordinator, false));
    if (phase === 'initial-start-coordinator')
      phase = 'initial-start-supervisor';
    assert.ok(await ownedProcess(supervisor, cli, false));
    if (phase === 'initial-start-supervisor') phase = 'initial-start-health';
    await live(d);
    return d;
  };
  const stop = async (d: Descriptor) => {
    const supervisor = register(d);
    await command('coordinator', 'stop');
    await waitFor('descriptor withdrawal', () =>
      !readDescriptor(data) ? true : undefined
    );
    await waitFor('supervisor exit', async () =>
      !(await ownedProcess(supervisor, cli, false)) ? true : undefined
    );
    await waitFor('coordinator exit', async () =>
      !(await ownedProcess(d.process, coordinator, false)) ? true : undefined
    );
  };
  const ensureStopped = async (identity: Identity, image: string) => {
    if (!(await ownedProcess(identity, image, false))) return;
    assert.ok(await ownedProcess(identity, image, true));
    await waitFor('fixture process exit', async () =>
      !(await ownedProcess(identity, image, false)) ? true : undefined
    );
  };
  const killPair = async (d: Descriptor) => {
    const supervisor = register(d);
    await ensureStopped(supervisor, cli);
    await ensureStopped(d.process, coordinator);
  };

  try {
    assert.ok(
      /Coordinator: not running/.test(await command('coordinator', 'status'))
    );
    assert.equal(readDescriptor(data), undefined);
    phase = 'initial-start-command';
    await command('coordinator', 'start');
    phase = 'initial-start-descriptor';
    let current = await started();
    phase = 'initial-start-status';
    assert.ok(
      /Coordinator: running/.test(await command('coordinator', 'status'))
    );

    phase = 'crash-recovery';
    const beforeCrash = current;
    assert.ok(await ownedProcess(beforeCrash.process, coordinator, true));
    current = await started(beforeCrash);
    assert.equal(current.supervisor?.pid, beforeCrash.supervisor?.pid);
    assert.ok(
      current.supervisor?.generationId !== beforeCrash.supervisor?.generationId
    );
    assert.ok(current.bearerToken !== beforeCrash.bearerToken);
    assert.equal(
      (
        await request(
          current,
          current.httpsPort,
          '/health',
          beforeCrash.bearerToken
        )
      ).status,
      401
    );

    phase = 'restart';
    const beforeRestart = current;
    await command('coordinator', 'restart');
    current = await started(beforeRestart);
    assert.ok(current.bearerToken !== beforeRestart.bearerToken);
    assert.ok(current.certificatePem !== beforeRestart.certificatePem);
    phase = 'stop';
    await stop(current);
    assert.ok(
      /Coordinator: not running/.test(await command('coordinator', 'status'))
    );

    phase = 'missing-lock-status';
    rmSync(lock);
    await run([cli, 'coordinator', 'status'], root, env, true);
    assert.ok(!existsSync(lock));
    phase = 'missing-lock-start';
    await command('coordinator', 'start');
    current = await started(beforeRestart);
    assert.ok(existsSync(lock));

    phase = 'partial-claim-kill';
    const beforePartial = current;
    await killPair(beforePartial);
    phase = 'partial-claim-status';
    rmSync(pidFile);
    const reservationBytes = readFileSync(reservation);
    const ownerBytes = readFileSync(owner);
    assert.ok(
      /Coordinator: not running/.test(await command('coordinator', 'status'))
    );
    assert.ok(reservationBytes.equals(readFileSync(reservation)));
    assert.ok(ownerBytes.equals(readFileSync(owner)));
    assert.ok(!existsSync(pidFile));
    phase = 'partial-claim-start';
    await command('coordinator', 'start');
    current = await started(beforePartial);
    assert.ok(
      current.supervisor?.generationId !==
        beforePartial.supervisor?.generationId
    );
    assert.ok(current.supervisor?.nonce !== beforePartial.supervisor?.nonce);

    phase = 'modeled-pid-reuse';
    const beforeReuse = current;
    await killPair(beforeReuse);
    await assertListenerUnbound(beforeReuse.httpsPort);
    await assertListenerUnbound(beforeReuse.grpcPort);
    fixture = Bun.spawn(
      [
        powershell,
        '-NoProfile',
        '-NonInteractive',
        '-Command',
        'Start-Sleep -Seconds 300',
      ],
      {
        cwd: root,
        env,
        stdout: 'ignore',
        stderr: 'ignore',
      }
    );
    assert.ok(fixture.pid > 0);
    const stale = {
      ...beforeReuse,
      pid: fixture.pid,
      process: { ...beforeReuse.process, pid: fixture.pid },
    };
    assert.ok(!(await ownedProcess(stale.process, powershell, false)));
    writeFileSync(join(runtime, 'coordinator.json'), JSON.stringify(stale));
    await command('coordinator', 'start');
    current = await started(beforeReuse);
    assert.ok(
      current.supervisor?.generationId !== beforeReuse.supervisor?.generationId
    );
    assert.equal(fixture.exitCode, null);
    await stop(current);
  } catch (error) {
    failed = true;
    console.error(
      `Installed Windows proof failure: ${safeProofFailure(phase, error)}`
    );
  } finally {
    if (fixture && fixture.exitCode === null) {
      try {
        fixture.kill();
        await fixture.exited;
      } catch {
        cleanupFailed = true;
      }
    }
    if (existsSync(join(runtime, 'coordinator.json'))) {
      try {
        await command('coordinator', 'stop');
      } catch {
        cleanupFailed = true;
      }
    }
    for (const { identity, image } of owned) {
      try {
        if (await ownedProcess(identity, image, false)) {
          await ownedProcess(identity, image, true);
          await waitFor('owned process exit', async () =>
            !(await ownedProcess(identity, image, false)) ? true : undefined
          );
        }
      } catch {
        cleanupFailed = true;
      }
    }
    try {
      rmSync(root, {
        recursive: true,
        force: true,
        maxRetries: 10,
        retryDelay: 300,
      });
    } catch {
      cleanupFailed = true;
    }
    if (cleanupFailed)
      console.error(
        `Installed Windows proof failure: ${safeProofFailure('cleanup', undefined)}`
      );
  }
  if (failed || cleanupFailed) {
    // The primary phase has already been reported; never print the thrown object.
    process.exitCode = 1;
  } else {
    console.log(
      'Installed Windows CLI: authenticated transport, crash recovery, restart, stop, missing lock, partial claim, and modeled PID reuse passed'
    );
  }
}

await main().catch((error: unknown) => {
  console.error(
    `Installed Windows proof failure: ${safeProofFailure('setup', error)}`
  );
  process.exitCode = 1;
});
