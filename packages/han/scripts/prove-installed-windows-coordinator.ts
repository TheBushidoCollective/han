import { strict as assert } from 'node:assert';
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  ProofCommandError,
  type SafeProcessDiagnostic,
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

async function live(
  d: Descriptor,
  setPhase?: (p: string) => void
): Promise<void> {
  assert.ok(d.supervisor, 'coordinator has no supervisor binding');
  assert.ok(d.httpsPort > 0 && d.grpcPort > 0);
  if (setPhase) setPhase('orphan-live-https');
  const health = await request(d, d.httpsPort, '/health', d.bearerToken);
  assert.equal(health.status, 200);
  const healthBody: unknown = await health.json();
  assert.ok(
    healthBody && typeof healthBody === 'object' && 'pid' in healthBody
  );
  assert.equal(healthBody.pid, d.pid);
  if (setPhase) setPhase('orphan-live-unauth');
  assert.equal((await request(d, d.httpsPort, '/health')).status, 401);
  if (setPhase) setPhase('orphan-live-badtoken');
  assert.equal((await request(d, d.httpsPort, '/health', 'wrong')).status, 401);
  if (setPhase) setPhase('orphan-live-grpc');
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
  if (setPhase) setPhase('orphan-live-grpc-denied');
  const denied = await request(d, d.grpcPort, grpcPath, 'wrong', frame);
  assert.equal(denied.headers.get('grpc-status'), '16');
  if (setPhase) setPhase('orphan-live-untrusted-ca');
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
  const barrier = join(root, 'startup-barrier');
  const barrierProof = process.env.HAN_PROOF_BARRIER_ONLY === '1';
  if (barrierProof) {
    mkdirSync(barrier);
    env.HAN_PROOF_STARTUP_BARRIER = barrier;
    const listener = createServer();
    const listening = Promise.withResolvers<void>();
    listener.once('error', listening.reject);
    listener.listen(0, '127.0.0.1', listening.resolve);
    await listening.promise;
    const address = listener.address();
    assert.ok(address && typeof address !== 'string');
    env.HAN_COORDINATOR_PORT = String(address.port);
    const closed = Promise.withResolvers<void>();
    listener.close((error) =>
      error ? closed.reject(error) : closed.resolve()
    );
    await closed.promise;
  }
  const command = (...args: string[]) => run([cli, ...args], root, env);
  const runtime = join(data, 'runtime');
  const reservation = join(runtime, 'supervisor.reservation.json');
  const owner = join(runtime, 'supervisor.owner.json');
  const pidFile = join(runtime, 'supervisor.pid');
  const lock = join(runtime, 'descriptor-publication.lock');
  type Identity = Descriptor['process'];
  const owned: { identity: Identity; image: string }[] = [];
  let orphanChildIdentity: Identity | undefined;
  let orphanSupervisorIdentity: Identity | undefined;
  let orphanSupervisorStatusBefore:
    | 'alive'
    | 'dead'
    | 'mismatched'
    | 'unknown'
    | undefined;
  let orphanSupervisorStatusAfter:
    | 'alive'
    | 'dead'
    | 'mismatched'
    | 'unknown'
    | undefined;
  let expectedDescriptorInstance: string | undefined;
  let current: Descriptor | undefined;
  let fixture:
    | {
        pid: number;
        exitCode: number | null;
        kill: () => void;
        exited: Promise<number>;
      }
    | undefined;
  let feSupervisor:
    | {
        pid: number;
        exitCode: number | null;
        kill: () => void;
        exited: Promise<number>;
      }
    | undefined;
  let feSupervisorExitCodeBeforeCleanup: number | null = null;
  let feSupervisorProofKilled = false;
  let stopRequester:
    | {
        pid: number;
        exitCode: number | null;
        kill: () => void;
        exited: Promise<number>;
        stderr: unknown;
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
  const inspectProcess = async (
    identity: Identity,
    image: string
  ): Promise<'alive' | 'dead' | 'mismatched' | 'unknown'> => {
    if (
      !Number.isSafeInteger(identity.pid) ||
      identity.pid <= 0 ||
      !/^[1-9][0-9]{0,19}$/.test(identity.creationTime)
    )
      return 'unknown';
    const script = `$p=Get-Process -Id ${identity.pid} -ErrorAction SilentlyContinue; if (!$p) { exit 3 }; $actual=[System.IO.Path]::GetFullPath($p.Path); $expected=[System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $env:HAN_PROOF_IMAGE).Path); if ($actual -ne $expected) { exit 4 }; if ($p.StartTime.ToUniversalTime().ToFileTimeUtc().ToString() -ne $env:HAN_PROOF_TIME) { exit 5 }; exit 0`;
    try {
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
      if (code === 0) return 'alive';
      if (code === 3) return 'dead';
      if (code === 4 || code === 5) return 'mismatched';
      return 'unknown';
    } catch {
      return 'unknown';
    }
  };
  const collectDiagnostic = async (): Promise<
    SafeProcessDiagnostic | undefined
  > => {
    if (phase.startsWith('fast-exit-')) {
      let marker: SafeProcessDiagnostic['markerFile'] = 'none';
      const fastExitData = join(root, 'fast-exit-data');
      if (existsSync(join(fastExitData, 'startup-completed'))) {
        marker = 'startup-completed';
      } else if (existsSync(join(fastExitData, 'receipt-release'))) {
        marker = 'receipt-released';
      } else if (existsSync(join(fastExitData, 'receipt-held'))) {
        marker = 'receipt-held';
      } else if (existsSync(join(fastExitData, 'start-daemon-called'))) {
        marker = 'start-daemon-called';
      } else if (existsSync(join(fastExitData, 'daemon-imported'))) {
        marker = 'daemon-imported';
      } else if (existsSync(join(fastExitData, 'runtime-imported'))) {
        marker = 'runtime-imported';
      } else if (existsSync(join(fastExitData, 'mock-installed'))) {
        marker = 'mock-installed';
      }

      let errorCat: SafeProcessDiagnostic['errorCategory'] = 'none';
      const errorCatFile = join(fastExitData, 'error-category');
      if (existsSync(errorCatFile)) {
        try {
          const raw = readFileSync(errorCatFile, 'utf8').trim();
          const allowed = [
            'reference_error',
            'type_error',
            'syntax_error',
            'module_not_found',
            'binary_missing',
            'assertion_error',
            'connection_refused',
            'timeout',
            'security_error',
            'child_exit_error',
            'pid_claim_failed',
            'health_check_failed',
            'generic_error',
          ] as const;
          if (allowed.includes(raw as (typeof allowed)[number])) {
            errorCat = raw as SafeProcessDiagnostic['errorCategory'];
          } else {
            errorCat = 'generic_error';
          }
        } catch {
          errorCat = 'generic_error';
        }
      }

      let helperDiag: SafeHelperDiagnostic | null = null;
      const helperDiagFile = join(fastExitData, 'runtime-diagnostic.json');
      if (existsSync(helperDiagFile)) {
        try {
          const rawDiag = JSON.parse(readFileSync(helperDiagFile, 'utf8'));
          const validated = validateHelperDiagnostic(rawDiag);
          if (validated) helperDiag = validated;
        } catch {}
      }

      return {
        supervisorExitCode: feSupervisorProofKilled
          ? null
          : (feSupervisorExitCodeBeforeCleanup ??
            feSupervisor?.exitCode ??
            null),
        supervisorProofKilled: feSupervisorProofKilled,
        markerFile: marker,
        errorCategory: errorCat,
        helperDiagnostic: helperDiag,
      };
    }
    if (!phase.startsWith('orphan-')) return undefined;
    const targetChild = orphanChildIdentity;
    if (!targetChild) return undefined;
    const childLiveness = await inspectProcess(targetChild, coordinator);
    const diskDescriptor = readDescriptor(data);
    let descriptorMatches: boolean | null = null;
    let descriptorState: 'present' | 'absent' | 'mismatched' | 'unknown' =
      'unknown';
    if (!diskDescriptor) {
      descriptorState = 'absent';
      descriptorMatches = false;
    } else if (expectedDescriptorInstance) {
      descriptorMatches =
        diskDescriptor.instanceId === expectedDescriptorInstance;
      descriptorState = descriptorMatches ? 'present' : 'mismatched';
    } else {
      descriptorState = 'unknown';
      descriptorMatches = null;
    }
    return {
      childPid: targetChild.pid,
      childCreationTime: targetChild.creationTime,
      childLiveness,
      descriptorMatches,
      descriptorState,
      supervisorPid: orphanSupervisorIdentity?.pid ?? null,
      supervisorCreationTime: orphanSupervisorIdentity?.creationTime ?? null,
      supervisorStatusBefore: orphanSupervisorStatusBefore ?? null,
      supervisorStatusAfter: orphanSupervisorStatusAfter ?? null,
    };
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
    current = await started();
    phase = 'initial-start-status';
    assert.ok(
      /Coordinator: running/.test(await command('coordinator', 'status'))
    );

    if (barrierProof) {
      phase = 'fixed-port-bind-before-publication';
      const previous = current;
      writeFileSync(join(barrier, 'arm'), '');
      assert.ok(await ownedProcess(previous.process, coordinator, true));
      const marker = await waitFor('bound replacement', () => {
        const path = join(barrier, 'bound.json');
        if (!existsSync(path)) return undefined;
        return JSON.parse(readFileSync(path, 'utf8')) as {
          pid: number;
          httpsPort: number;
          supervisor: Descriptor['supervisor'];
        };
      });
      assert.ok(Number.isSafeInteger(marker.pid) && marker.pid > 0);
      const creationTime = (
        await run(
          [
            powershell,
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `$p=Get-Process -Id ${marker.pid} -ErrorAction Stop; $w=Get-CimInstance Win32_Process -Filter 'ProcessId=${marker.pid}'; if ($w.ParentProcessId -ne ${previous.supervisor?.pid ?? 0}) { exit 4 }; if ([System.IO.Path]::GetFullPath($p.Path) -ne [System.IO.Path]::GetFullPath($env:HAN_PROOF_IMAGE)) { exit 5 }; $p.StartTime.ToUniversalTime().ToFileTimeUtc().ToString()`,
          ],
          root,
          { ...env, HAN_PROOF_IMAGE: coordinator }
        )
      ).trim();
      assert.match(creationTime, /^[1-9][0-9]{0,19}$/);
      owned.push({
        identity: {
          pid: marker.pid,
          creationTime,
          userSid: previous.process.userSid,
        },
        image: coordinator,
      });
      assert.equal(marker.httpsPort, Number(env.HAN_COORDINATOR_PORT));
      assert.equal(marker.supervisor?.pid, previous.supervisor?.pid);
      assert.notEqual(
        marker.supervisor?.generationId,
        previous.supervisor?.generationId
      );
      assert.equal(readDescriptor(data)?.instanceId, previous.instanceId);
      for (let i = 0; i < 5; i++) {
        const check = Bun.spawn(
          [
            powershell,
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `$c=Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort ${marker.httpsPort} -State Established -ErrorAction SilentlyContinue; if ($c) { exit 1 }`,
          ],
          { cwd: root, env, stdout: 'ignore', stderr: 'ignore' }
        );
        assert.equal(
          await check.exited,
          0,
          'request reached unpublished listener'
        );
        assert.equal(readDescriptor(data)?.instanceId, previous.instanceId);
        await Bun.sleep(100);
      }
      writeFileSync(join(barrier, 'release'), '');
      current = await started(previous);
      assert.equal(current.pid, marker.pid);
      assert.equal(
        current.supervisor?.generationId,
        marker.supervisor?.generationId
      );
      assert.notEqual(current.bearerToken, previous.bearerToken);
    }

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
    phase = 'dead-pair-stop';
    await command('coordinator', 'start');
    current = await started(beforeRestart);
    const beforeDeadStop = current;
    await killPair(beforeDeadStop);
    assert.equal(readDescriptor(data)?.instanceId, beforeDeadStop.instanceId);
    assert.ok(existsSync(reservation));
    await command('coordinator', 'stop');
    assert.equal(readDescriptor(data), undefined);
    assert.ok(!existsSync(reservation));

    phase = 'dead-pair-restart';
    await command('coordinator', 'start');
    current = await started(beforeDeadStop);
    const beforeDeadRestart = current;
    await killPair(beforeDeadRestart);
    assert.equal(
      readDescriptor(data)?.instanceId,
      beforeDeadRestart.instanceId
    );
    await command('coordinator', 'restart');
    current = await started(beforeDeadRestart);
    await stop(current);

    phase = 'orphan-start';
    await command('coordinator', 'start');
    phase = 'orphan-started';
    current = await started(beforeDeadRestart);
    const orphan = current;
    const deadSupervisor = register(orphan);
    orphanChildIdentity = orphan.process;
    expectedDescriptorInstance = orphan.instanceId;
    orphanSupervisorIdentity = deadSupervisor;
    orphanSupervisorStatusBefore = await inspectProcess(deadSupervisor, cli);
    phase = 'orphan-kill-supervisor';
    await ensureStopped(deadSupervisor, cli);
    orphanSupervisorStatusAfter = await inspectProcess(deadSupervisor, cli);
    phase = 'orphan-live';
    await live(orphan, (p) => {
      phase = p;
    });
    phase = 'orphan-stop';
    await command('coordinator', 'stop');
    phase = 'orphan-wait-exit';
    await waitFor('orphan coordinator exit', async () =>
      !(await ownedProcess(orphan.process, coordinator, false))
        ? true
        : undefined
    );
    phase = 'orphan-assert-stopped';
    assert.equal(readDescriptor(data), undefined);
    assert.ok(!existsSync(reservation));
    orphanChildIdentity = undefined;
    orphanSupervisorIdentity = undefined;
    orphanSupervisorStatusBefore = undefined;
    orphanSupervisorStatusAfter = undefined;
    expectedDescriptorInstance = undefined;
    phase = 'orphan-restart';
    await command('coordinator', 'restart');
    phase = 'orphan-restart-started';
    current = await started(orphan);
    phase = 'orphan-restart-stop';
    await stop(current);
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

    phase = 'fast-exit-receipt';
    // Deterministic supervisor path: Start the supervisor, hold receipt delivery
    // until the child has received authenticated shutdown, committed intent, and exited.
    // This exercises accepting shutdown-requested when child is already gone.
    const fastExitData = join(root, 'fast-exit-data');
    mkdirSync(fastExitData);
    const fastExitEnv: Record<string, string> = {
      ...env,
      HAN_DATA_DIR: fastExitData,
      HAN_COORDINATOR_PORT: '0',
    };
    delete fastExitEnv.HAN_PROOF_STARTUP_BARRIER;
    const receiptHoldBarrier = join(fastExitData, 'receipt-held');
    const receiptReleaseSignal = join(fastExitData, 'receipt-release');
    const runtimeModPath = resolve(
      import.meta.dir,
      '../lib/coordinator/windows-runtime.ts'
    );
    const helperModPath = resolve(
      import.meta.dir,
      '../lib/coordinator/windows-helper.ts'
    );
    const daemonModPath = resolve(
      import.meta.dir,
      '../lib/commands/coordinator/daemon.ts'
    );
    const diagModPath = resolve(
      import.meta.dir,
      './windows-proof-diagnostics.ts'
    );
    const fastExitSupervisorScript = `
      const fs = await import('node:fs');
      const { safeHelperDiagnostic, classifySupervisorError } = await import(${JSON.stringify(diagModPath)});
      try {
        const { mock } = await import('bun:test');
        const binaryModPath = ${JSON.stringify(resolve(import.meta.dir, '../lib/coordinator/binary.ts'))};
        const realBinary = await import(binaryModPath);
        mock.module(binaryModPath, () => ({
          ...realBinary,
          findCoordinatorBinary: () => ${JSON.stringify(coordinator)},
        }));
        const realHelper = await import(${JSON.stringify(helperModPath)});
        mock.module(${JSON.stringify(helperModPath)}, () => ({
          ...realHelper,
          findCoordinatorBinary: () => ${JSON.stringify(coordinator)},
        }));
        fs.writeFileSync(${JSON.stringify(join(fastExitData, 'mock-installed'))}, 'ok');

        const realRuntime = await import(${JSON.stringify(runtimeModPath)});
        fs.writeFileSync(${JSON.stringify(join(fastExitData, 'runtime-imported'))}, 'ok');
        const origRead = realRuntime.readWindowsChildDescriptor;
        mock.module(${JSON.stringify(runtimeModPath)}, () => ({
          ...realRuntime,
          async readWindowsChildDescriptor(...args) {
            const result = await origRead(...args);
            if (result && result.process && result.process.pid > 0) {
              const safeIdentity = {
                pid: result.process.pid,
                creationTime: result.process.creationTime,
                userSid: result.process.userSid,
              };
              fs.writeFileSync(${JSON.stringify(receiptHoldBarrier)}, JSON.stringify(safeIdentity));
              while (!fs.existsSync(${JSON.stringify(receiptReleaseSignal)})) {
                await Bun.sleep(20);
              }
            }
            return result;
          },
        }));

        const { startDaemon } = await import(${JSON.stringify(daemonModPath)});
        fs.writeFileSync(${JSON.stringify(join(fastExitData, 'daemon-imported'))}, 'ok');

        fs.writeFileSync(${JSON.stringify(join(fastExitData, 'start-daemon-called'))}, 'ok');
        await startDaemon({ port: 0, foreground: true });
        fs.writeFileSync(${JSON.stringify(join(fastExitData, 'startup-completed'))}, 'ok');
      } catch (e) {
        try {
          fs.writeFileSync(${JSON.stringify(join(fastExitData, 'error-category'))}, classifySupervisorError(e));
          if (e && e.message) {
            const helper = safeHelperDiagnostic(String(e.message));
            if (helper) {
              fs.writeFileSync(${JSON.stringify(join(fastExitData, 'runtime-diagnostic.json'))}, JSON.stringify(helper));
            }
          }
        } catch {}
        process.exit(1);
      }
    `;
    const fastExitSupervisorFile = join(
      fastExitData,
      'fast-exit-supervisor.ts'
    );
    writeFileSync(fastExitSupervisorFile, fastExitSupervisorScript);
    feSupervisor = Bun.spawn([process.execPath, fastExitSupervisorFile], {
      env: fastExitEnv,
      stdout: 'pipe',
      stderr: 'pipe',
    });
    try {
      phase = 'fast-exit-receipt-capture';
      // Wait for child to publish and receipt to be captured & held; fail fast on early supervisor death
      const capturedIdentity = await waitFor('receipt captured', () => {
        if (feSupervisor && feSupervisor.exitCode !== null) {
          throw new Error(
            `supervisor exited early with code ${feSupervisor.exitCode}`
          );
        }
        if (!existsSync(receiptHoldBarrier)) return undefined;
        try {
          return JSON.parse(
            readFileSync(receiptHoldBarrier, 'utf8')
          ) as Identity;
        } catch {
          return undefined;
        }
      });
      const feChildIdentity = capturedIdentity;
      assert.ok(feChildIdentity && feChildIdentity.pid > 0);
      owned.push({ identity: feChildIdentity, image: coordinator });
      assert.ok(await ownedProcess(feChildIdentity, coordinator, false));

      phase = 'fast-exit-child-stop';
      // Initiate authenticated shutdown to the child in fastExitEnv without awaiting completion,
      // because stopDaemon waits for the supervisor claim to clear while the supervisor is held
      stopRequester = Bun.spawn([cli, 'coordinator', 'stop'], {
        cwd: root,
        env: fastExitEnv,
        stdout: 'pipe',
        stderr: 'pipe',
      });

      phase = 'fast-exit-child-exit';
      // Wait for child to receive shutdown and fully exit before releasing receipt; fail fast if supervisor dies
      await waitFor('child exit before receipt release', async () => {
        if (feSupervisor && feSupervisor.exitCode !== null) {
          throw new Error(
            `supervisor exited early with code ${feSupervisor.exitCode}`
          );
        }
        return !(await ownedProcess(feChildIdentity, coordinator, false))
          ? true
          : undefined;
      });

      phase = 'fast-exit-receipt-release';
      // Now release the held receipt to startDaemon; it must safely accept shutdown-requested
      // from the committed intent and matching receipt without failing or restarting a successor
      writeFileSync(receiptReleaseSignal, 'release');

      // Await successful completion of the stop requester
      const stopCode = await stopRequester.exited;
      if (stopCode !== 0) {
        const err = await new Response(
          stopRequester.stderr as ReadableStream
        ).text();
        throw new Error(`fast-exit stop failed with code ${stopCode}: ${err}`);
      }
      phase = 'fast-exit-supervisor-exit';
      await waitFor('supervisor exit after fast-exit', () =>
        feSupervisor?.exitCode !== null ? feSupervisor?.exitCode : undefined
      );
      assert.equal(feSupervisor?.exitCode, 0);
      phase = 'fast-exit-cleanup';
      assert.equal(readDescriptor(fastExitData), undefined);
      assert.ok(
        !existsSync(join(fastExitData, 'runtime/supervisor.reservation.json'))
      );
      assert.ok(
        !existsSync(join(fastExitData, 'runtime/supervisor.owner.json'))
      );
      assert.ok(!existsSync(join(fastExitData, 'runtime/supervisor.pid')));
      // descriptor-publication.lock is a permanent file created to serialize
      // descriptor publication and must remain present
      assert.ok(
        existsSync(join(fastExitData, 'runtime/descriptor-publication.lock'))
      );
      const fastExitRuntime = join(fastExitData, 'runtime');
      if (existsSync(fastExitRuntime)) {
        const leftoverStopping = readdirSync(fastExitRuntime).filter((name) =>
          name.startsWith('coordinator.stopping.')
        );
        assert.equal(leftoverStopping.length, 0);
      }
    } catch (fastExitErr) {
      feSupervisorExitCodeBeforeCleanup = feSupervisor?.exitCode ?? null;
      throw fastExitErr;
    } finally {
      if (stopRequester && stopRequester.exitCode === null) {
        stopRequester.kill();
        await stopRequester.exited;
      }
      if (feSupervisor && feSupervisor.exitCode === null) {
        feSupervisorProofKilled = true;
        feSupervisor.kill();
        await feSupervisor.exited;
      }
    }
  } catch (error) {
    failed = true;
    let diagnostic: SafeProcessDiagnostic | undefined;
    try {
      diagnostic = await collectDiagnostic();
    } catch {}
    console.error(
      `Installed Windows proof failure: ${safeProofFailure(
        phase,
        error,
        diagnostic
      )}`
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
    const fastExitRuntimePath = join(
      root,
      'fast-exit-data',
      'runtime',
      'coordinator.json'
    );
    if (existsSync(fastExitRuntimePath)) {
      try {
        await run([cli, 'coordinator', 'stop'], root, {
          ...env,
          HAN_DATA_DIR: join(root, 'fast-exit-data'),
        });
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
      'Installed Windows CLI: authenticated transport, crash recovery, restart, stop, missing lock, partial claim, modeled PID reuse, and fast-exit receipt passed'
    );
  }
}

await main().catch((error: unknown) => {
  console.error(
    `Installed Windows proof failure: ${safeProofFailure('setup', error)}`
  );
  process.exitCode = 1;
});
