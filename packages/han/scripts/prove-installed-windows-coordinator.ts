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
  writeSync,
} from 'node:fs';
import { createConnection, createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import {
  abortableSleep,
  type BoundedChild,
  waitFor as boundsWaitFor,
  createProofClock,
  ProofDeadlineError,
  ProofOutputRetained,
  ProofSubprocessTimeout,
  readProofBudget,
  spawnBounded,
  startBounded,
  sweepRoot,
} from './windows-proof-bounds.ts';
import {
  ProofCommandError,
  type ProofPhase,
  phases,
  type SafeHelperDiagnostic,
  type SafePreviousProgress,
  type SafeProcessDiagnostic,
  safeProofCleanup,
  safeProofFailure,
  safeProofProgress,
  validateHelperDiagnostic,
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

function combineSignals(timeoutMs: number, signal?: AbortSignal): AbortSignal {
  const timeoutSignal = AbortSignal.timeout(timeoutMs);
  if (!signal) return timeoutSignal;
  return AbortSignal.any([timeoutSignal, signal]);
}

async function request(
  d: Descriptor,
  port: number,
  path: string,
  token?: string,
  body?: Uint8Array,
  signal?: AbortSignal
): Promise<Response> {
  if (signal?.aborted) throw new ProofDeadlineError();
  try {
    return await fetch(`https://127.0.0.1:${port}${path}`, {
      method: body ? 'POST' : 'GET',
      headers: {
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...(body ? { 'Content-Type': 'application/grpc-web+proto' } : {}),
      },
      body,
      tls: { ca: d.certificatePem, rejectUnauthorized: true },
      signal: combineSignals(5000, signal),
    } as RequestInit);
  } catch (err) {
    if (signal?.aborted) throw new ProofDeadlineError();
    throw err;
  }
}

async function live(
  d: Descriptor,
  setPhase?: (p: string) => void,
  signal?: AbortSignal
): Promise<void> {
  assert.ok(d.supervisor, 'coordinator has no supervisor binding');
  assert.ok(d.httpsPort > 0 && d.grpcPort > 0);
  if (setPhase) setPhase('orphan-live-https');
  const health = await request(
    d,
    d.httpsPort,
    '/health',
    d.bearerToken,
    undefined,
    signal
  );
  let healthBody: unknown;
  try {
    healthBody = await health.json();
  } catch (err) {
    if (signal?.aborted) throw new ProofDeadlineError();
    throw err;
  }
  if (signal?.aborted) throw new ProofDeadlineError();
  assert.ok(
    healthBody && typeof healthBody === 'object' && 'pid' in healthBody
  );
  assert.equal(healthBody.pid, d.pid);
  if (setPhase) setPhase('orphan-live-unauth');
  assert.equal(
    (await request(d, d.httpsPort, '/health', undefined, undefined, signal))
      .status,
    401
  );
  if (setPhase) setPhase('orphan-live-badtoken');
  assert.equal(
    (await request(d, d.httpsPort, '/health', 'wrong', undefined, signal))
      .status,
    401
  );
  if (setPhase) setPhase('orphan-live-grpc');
  const grpcPath = '/han.coordinator.CoordinatorService/Health';
  const frame = new Uint8Array(5);
  const grpc = await request(
    d,
    d.grpcPort,
    grpcPath,
    d.bearerToken,
    frame,
    signal
  );
  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await grpc.arrayBuffer());
  } catch (err) {
    if (signal?.aborted) throw new ProofDeadlineError();
    throw err;
  }
  if (signal?.aborted) throw new ProofDeadlineError();
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
  const denied = await request(d, d.grpcPort, grpcPath, 'wrong', frame, signal);
  assert.equal(denied.headers.get('grpc-status'), '16');
  if (setPhase) setPhase('orphan-live-untrusted-ca');
  await assert.rejects(
    fetch(`https://127.0.0.1:${d.httpsPort}/health`, {
      headers: { Authorization: `Bearer ${d.bearerToken}` },
      signal: combineSignals(5000, signal),
    })
  );
  if (signal?.aborted) throw new ProofDeadlineError();
}

async function assertListenerUnbound(
  port: number,
  signal?: AbortSignal
): Promise<void> {
  if (signal?.aborted) throw new ProofDeadlineError();
  const { promise, resolve, reject } = Promise.withResolvers<void>();
  const socket = createConnection({ host: '127.0.0.1', port });
  socket.setTimeout(5000);
  const onAbort = () => {
    socket.destroy();
    reject(new ProofDeadlineError());
  };
  if (signal) {
    signal.addEventListener('abort', onAbort, { once: true });
  }
  socket.once('connect', () => {
    if (signal) signal.removeEventListener('abort', onAbort);
    socket.destroy();
    reject(new Error('Listener remains bound'));
  });
  socket.once('timeout', () => {
    if (signal) signal.removeEventListener('abort', onAbort);
    socket.destroy();
    reject(new Error('Listener probe timed out'));
  });
  socket.once('error', (error: NodeJS.ErrnoException) => {
    if (signal) signal.removeEventListener('abort', onAbort);
    socket.destroy();
    if (error.code === 'ECONNREFUSED') resolve();
    else reject(new Error('Listener probe failed'));
  });
  await promise;
}

async function waitProcessExit(
  exitedPromise: Promise<number | null>,
  timeoutMs: number,
  signal?: AbortSignal
): Promise<boolean> {
  const { promise, resolve } = Promise.withResolvers<'timeout' | 'abort'>();
  const timer = setTimeout(() => resolve('timeout'), timeoutMs);
  let onAbort: (() => void) | null = null;
  if (signal) {
    onAbort = () => resolve('abort');
    signal.addEventListener('abort', onAbort, { once: true });
  }

  try {
    const winner = await Promise.race([
      exitedPromise.then(() => 'exited' as const),
      promise,
    ]);
    return winner === 'exited';
  } finally {
    clearTimeout(timer);
    if (signal && onAbort) {
      signal.removeEventListener('abort', onAbort);
    }
  }
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
  const { deadlineMs, cleanupMs } = readProofBudget(process.env);
  const clock = createProofClock({
    deadlineMs,
    cleanupMs,
    watchdogMarginMs: 60000,
  });

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

  const runtime = join(data, 'runtime');
  const reservation = join(runtime, 'supervisor.reservation.json');
  const owner = join(runtime, 'supervisor.owner.json');
  const pidFile = join(runtime, 'supervisor.pid');
  const lock = join(runtime, 'descriptor-publication.lock');
  type Identity = Descriptor['process'];

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
  let fixture: BoundedChild | undefined;
  let feSupervisor: BoundedChild | undefined;
  let feSupervisorExitCodeBeforeCleanup: number | null = null;
  let feSupervisorProofKilled = false;
  let stopRequester: BoundedChild | undefined;

  let phase: ProofPhase = 'setup';
  let phaseStartTime = Date.now();
  let currentCliCount = 0;
  let currentCliMs = 0;
  let currentCliMaxMs = 0;
  let currentProbeCount = 0;
  let currentProbeMs = 0;

  clock.armWatchdog(root, () => phase);

  const setPhase = (p: string) => {
    if (!phases.includes(p as ProofPhase)) {
      throw new Error(`Unknown proof phase: ${p}`);
    }
    const nextPhase = p as ProofPhase;
    const now = Date.now();
    const phaseMs = now - phaseStartTime;
    const prev: SafePreviousProgress = {
      phase,
      ms: Math.max(0, phaseMs),
      cliCount: currentCliCount,
      cliMs: currentCliMs,
      cliMaxMs: currentCliMaxMs,
      probeCount: currentProbeCount,
      probeMs: currentProbeMs,
    };

    phase = nextPhase;
    phaseStartTime = now;
    currentCliCount = 0;
    currentCliMs = 0;
    currentCliMaxMs = 0;
    currentProbeCount = 0;
    currentProbeMs = 0;

    const progressLine = safeProofProgress({
      phase: nextPhase,
      elapsedMs: clock.elapsedMs(),
      previous: prev,
    });
    if (progressLine) {
      writeSync(2, `Installed Windows proof progress: ${progressLine}\n`);
    }
  };

  const waitFor = <T>(
    label: string,
    probe: () =>
      | Promise<T | null | undefined | false>
      | T
      | null
      | undefined
      | false,
    boundMs = 60000
  ): Promise<T> => boundsWaitFor(label, probe, clock.phaseSignal, boundMs);

  const run = async (
    argv: string[],
    cwd: string,
    runEnv: Record<string, string>,
    expectedFailure = false,
    timeoutMs = 90000
  ): Promise<string> => {
    const isCli = argv[0] === cli;
    const isProbe = argv[0] === powershell;
    const t0 = Date.now();
    const res = await spawnBounded(argv, {
      cwd,
      env: runEnv,
      timeoutMs,
      signal: clock.phaseSignal,
      capture: true,
      maxBytes: 65536,
      eofGraceMs: 5000,
    });
    const elapsed = Date.now() - t0;
    if (isCli) {
      currentCliCount++;
      currentCliMs += elapsed;
      if (elapsed > currentCliMaxMs) currentCliMaxMs = elapsed;
    } else if (isProbe) {
      currentProbeCount++;
      currentProbeMs += elapsed;
    }

    if (res.aborted) throw new ProofDeadlineError();
    if (res.timedOut) throw new ProofSubprocessTimeout();
    if (res.pipeRetained) throw new ProofOutputRetained();
    if ((res.exitCode !== 0) !== expectedFailure) {
      throw new ProofCommandError(res.exitCode, res.output);
    }
    return res.output;
  };

  const command = (...args: string[]) => run([cli, ...args], root, env);

  // Verify both the exact staged executable and creation time before signalling.
  const ownedProcess = async (
    identity: Identity,
    image: string,
    kill: boolean
  ): Promise<boolean> => {
    assert.ok(Number.isSafeInteger(identity.pid) && identity.pid > 0);
    assert.ok(/^[1-9][0-9]{0,19}$/.test(identity.creationTime));
    const script = `$ErrorActionPreference='Stop'; try { $p=Get-Process -Id ${identity.pid} -ErrorAction Stop } catch { if ($_.FullyQualifiedErrorId -like 'NoProcessFoundForGivenId*') { exit 3 }; exit 6 }; try { $actual=[System.IO.Path]::GetFullPath($p.Path); $expected=[System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $env:HAN_PROOF_IMAGE).Path); if ($actual -ne $expected) { exit 4 }; if ($p.StartTime.ToUniversalTime().ToFileTimeUtc().ToString() -ne $env:HAN_PROOF_TIME) { exit 5 }; ${kill ? 'Stop-Process -InputObject $p -Force -ErrorAction Stop;' : ''} exit 0 } catch { exit 6 }`;
    const t0 = Date.now();
    const res = await spawnBounded(
      [powershell, '-NoProfile', '-NonInteractive', '-Command', script],
      {
        cwd: root,
        env: {
          ...env,
          HAN_PROOF_IMAGE: image,
          HAN_PROOF_TIME: identity.creationTime,
        },
        timeoutMs: 20000,
        signal: clock.phaseSignal,
        capture: true,
      }
    );
    const elapsed = Date.now() - t0;
    currentProbeCount++;
    currentProbeMs += elapsed;

    if (res.aborted) throw new ProofDeadlineError();
    if (res.timedOut) throw new ProofSubprocessTimeout();
    if (res.pipeRetained) throw new ProofOutputRetained();
    const code = res.exitCode;
    if (code === 3 || code === 4 || code === 5) return false;
    if (code !== 0) throw new ProofCommandError(code, '');
    return true;
  };

  const inspectProcess = async (
    identity: Identity,
    image: string,
    signal: AbortSignal = clock.phaseSignal
  ): Promise<'alive' | 'dead' | 'mismatched' | 'unknown'> => {
    if (
      !Number.isSafeInteger(identity.pid) ||
      identity.pid <= 0 ||
      !/^[1-9][0-9]{0,19}$/.test(identity.creationTime)
    )
      return 'unknown';
    const script = `$ErrorActionPreference='Stop'; try { $p=Get-Process -Id ${identity.pid} -ErrorAction Stop } catch { if ($_.FullyQualifiedErrorId -like 'NoProcessFoundForGivenId*') { exit 3 }; exit 6 }; try { $actual=[System.IO.Path]::GetFullPath($p.Path); $expected=[System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $env:HAN_PROOF_IMAGE).Path); if ($actual -ne $expected) { exit 4 }; if ($p.StartTime.ToUniversalTime().ToFileTimeUtc().ToString() -ne $env:HAN_PROOF_TIME) { exit 5 }; exit 0 } catch { exit 6 }`;
    const t0 = Date.now();
    try {
      const res = await spawnBounded(
        [powershell, '-NoProfile', '-NonInteractive', '-Command', script],
        {
          cwd: root,
          env: {
            ...env,
            HAN_PROOF_IMAGE: image,
            HAN_PROOF_TIME: identity.creationTime,
          },
          timeoutMs: 20000,
          signal,
          capture: true,
        }
      );
      const elapsed = Date.now() - t0;
      currentProbeCount++;
      currentProbeMs += elapsed;

      if (res.aborted) {
        if (signal === clock.cleanupSignal) return 'unknown';
        throw new ProofDeadlineError();
      }
      if (res.timedOut) {
        if (signal === clock.cleanupSignal) return 'unknown';
        throw new ProofSubprocessTimeout();
      }
      if (res.pipeRetained) {
        if (signal === clock.cleanupSignal) return 'unknown';
        throw new ProofOutputRetained();
      }
      const code = res.exitCode;
      if (code === 0) return 'alive';
      if (code === 3) return 'dead';
      if (code === 4 || code === 5) return 'mismatched';
      return 'unknown';
    } catch (e) {
      if (
        e instanceof ProofDeadlineError ||
        e instanceof ProofSubprocessTimeout ||
        e instanceof ProofOutputRetained
      ) {
        if (signal === clock.cleanupSignal) return 'unknown';
        throw e;
      }
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
            'sec_runtime_helper_failed',
            'sec_spawn_claim_missing',
            'sec_runtime_response_invalid',
            'sec_descriptor_target_invalid',
            'sec_descriptor_invalid',
            'sec_process_identity_missing',
            'sec_receipt_pid_mismatch',
            'sec_receipt_supervisor_mismatch',
            'sec_receipt_envelope_invalid',
            'sec_receipt_json_malformed',
            'sec_stdout_stream_missing',
            'sec_intent_child_mismatch',
            'sec_coordinator_changed',
            'sec_predecessor_alive',
            'sec_port_mismatch',
            'sec_health_identity_mismatch',
            'sec_health_rejected',
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
      let helperStatus: SafeProcessDiagnostic['helperMarkerStatus'] = 'none';
      const helperDiagFile = join(fastExitData, 'runtime-diagnostic.json');
      if (existsSync(helperDiagFile)) {
        try {
          const rawDiag = JSON.parse(readFileSync(helperDiagFile, 'utf8'));
          const validated = validateHelperDiagnostic(rawDiag);
          if (validated) helperDiag = validated;
        } catch {}
      }

      const helperStatusFile = join(fastExitData, 'runtime-marker-status');
      if (existsSync(helperStatusFile)) {
        try {
          const rawStatus = readFileSync(helperStatusFile, 'utf8').trim();
          const allowedStatus = [
            'none',
            'marker_present_valid',
            'marker_present_invalid_json',
            'marker_present_invalid_schema',
            'no_marker_in_error',
          ] as const;
          if (
            allowedStatus.includes(rawStatus as (typeof allowedStatus)[number])
          ) {
            helperStatus =
              rawStatus as SafeProcessDiagnostic['helperMarkerStatus'];
          } else {
            helperStatus = 'marker_present_invalid_schema';
          }
        } catch {
          helperStatus = 'none';
        }
      } else {
        helperStatus = 'none';
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
        helperMarkerStatus: helperStatus,
        helperDiagnostic: helperDiag,
      };
    }
    if (!phase.startsWith('orphan-')) return undefined;
    const targetChild = orphanChildIdentity;
    if (!targetChild) return undefined;
    const childLiveness = await inspectProcess(
      targetChild,
      coordinator,
      clock.cleanupSignal
    );
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
    return claim.process;
  };

  const started = async (previous?: Descriptor) => {
    const d = await waitFor('new descriptor', () => {
      const next = readDescriptor(data);
      return next && (!previous || next.instanceId !== previous.instanceId)
        ? next
        : undefined;
    });
    if (phase === 'initial-start-descriptor')
      setPhase('initial-start-identity');
    if (phase === 'initial-start-identity')
      setPhase('initial-start-registration');
    const supervisor = register(d);
    if (phase === 'initial-start-registration')
      setPhase('initial-start-coordinator');
    assert.ok(await ownedProcess(d.process, coordinator, false));
    if (phase === 'initial-start-coordinator')
      setPhase('initial-start-supervisor');
    assert.ok(await ownedProcess(supervisor, cli, false));
    if (phase === 'initial-start-supervisor') setPhase('initial-start-health');
    await live(d, undefined, clock.phaseSignal);
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

  let failed = false;
  let cleanupFailed = false;

  try {
    setPhase('initial-status');
    assert.ok(
      /Coordinator: not running/.test(await command('coordinator', 'status'))
    );
    assert.equal(readDescriptor(data), undefined);
    setPhase('initial-start-command');
    await command('coordinator', 'start');
    setPhase('initial-start-descriptor');
    current = await started();
    setPhase('initial-start-status');
    assert.ok(
      /Coordinator: running/.test(await command('coordinator', 'status'))
    );

    if (barrierProof) {
      setPhase('fixed-port-bind-before-publication');
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
          { ...env, HAN_PROOF_IMAGE: coordinator },
          false,
          90000
        )
      ).trim();
      assert.match(creationTime, /^[1-9][0-9]{0,19}$/);
      assert.equal(marker.httpsPort, Number(env.HAN_COORDINATOR_PORT));
      assert.equal(marker.supervisor?.pid, previous.supervisor?.pid);
      assert.notEqual(
        marker.supervisor?.generationId,
        previous.supervisor?.generationId
      );
      assert.equal(readDescriptor(data)?.instanceId, previous.instanceId);
      for (let i = 0; i < 5; i++) {
        const t0 = Date.now();
        const check = await spawnBounded(
          [
            powershell,
            '-NoProfile',
            '-NonInteractive',
            '-Command',
            `$ErrorActionPreference='Stop'; try { $c=Get-NetTCPConnection -LocalAddress 127.0.0.1 -LocalPort ${marker.httpsPort} -State Established; if ($c) { exit 1 }; exit 0 } catch { if ($_.CategoryInfo.Category -eq 'ObjectNotFound' -or $_.FullyQualifiedErrorId -like 'CmdletizationQuery_NotFound*') { exit 0 }; exit 2 }`,
          ],
          {
            cwd: root,
            env,
            timeoutMs: 30000,
            signal: clock.phaseSignal,
            capture: true,
          }
        );
        const elapsed = Date.now() - t0;
        currentProbeCount++;
        currentProbeMs += elapsed;
        if (check.aborted) throw new ProofDeadlineError();
        if (check.timedOut) throw new ProofSubprocessTimeout();
        if (check.pipeRetained) throw new ProofOutputRetained();
        assert.notEqual(
          check.exitCode,
          1,
          'request reached unpublished listener'
        );
        assert.equal(check.exitCode, 0, 'TCP connection probe query failed');
        assert.equal(readDescriptor(data)?.instanceId, previous.instanceId);
        await abortableSleep(100, clock.phaseSignal);
      }
      writeFileSync(join(barrier, 'release'), '');
      current = await started(previous);
      assert.equal(current.pid, marker.pid);
      assert.equal(
        current.supervisor?.generationId,
        marker.supervisor?.generationId
      );
      assert.notEqual(current.bearerToken, previous.bearerToken);

      // Startup barrier Option (a): complete proof by stopping the coordinator
      // and falling through to finally/cleanup without running the default suite.
      setPhase('stop');
      await stop(current);
      assert.ok(
        /Coordinator: not running/.test(await command('coordinator', 'status'))
      );
    } else {
      setPhase('crash-recovery');
      const beforeCrash = current;
      assert.ok(await ownedProcess(beforeCrash.process, coordinator, true));
      current = await started(beforeCrash);
      assert.equal(current.supervisor?.pid, beforeCrash.supervisor?.pid);
      assert.ok(
        current.supervisor?.generationId !==
          beforeCrash.supervisor?.generationId
      );
      assert.ok(current.bearerToken !== beforeCrash.bearerToken);
      assert.equal(
        (
          await request(
            current,
            current.httpsPort,
            '/health',
            beforeCrash.bearerToken,
            undefined,
            clock.phaseSignal
          )
        ).status,
        401
      );

      setPhase('restart');
      const beforeRestart = current;
      await command('coordinator', 'restart');
      current = await started(beforeRestart);
      assert.ok(current.bearerToken !== beforeRestart.bearerToken);
      assert.ok(current.certificatePem !== beforeRestart.certificatePem);
      setPhase('stop');
      await stop(current);
      assert.ok(
        /Coordinator: not running/.test(await command('coordinator', 'status'))
      );
      setPhase('dead-pair-stop');
      await command('coordinator', 'start');
      current = await started(beforeRestart);
      const beforeDeadStop = current;
      await killPair(beforeDeadStop);
      assert.equal(readDescriptor(data)?.instanceId, beforeDeadStop.instanceId);
      assert.ok(existsSync(reservation));
      await command('coordinator', 'stop');
      assert.equal(readDescriptor(data), undefined);
      assert.ok(!existsSync(reservation));

      setPhase('dead-pair-restart');
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

      setPhase('orphan-start');
      await command('coordinator', 'start');
      setPhase('orphan-started');
      current = await started(beforeDeadRestart);
      const orphan = current;
      const deadSupervisor = register(orphan);
      orphanChildIdentity = orphan.process;
      expectedDescriptorInstance = orphan.instanceId;
      orphanSupervisorIdentity = deadSupervisor;
      orphanSupervisorStatusBefore = await inspectProcess(deadSupervisor, cli);
      setPhase('orphan-kill-supervisor');
      await ensureStopped(deadSupervisor, cli);
      orphanSupervisorStatusAfter = await inspectProcess(deadSupervisor, cli);
      setPhase('orphan-live');
      await live(
        orphan,
        (p) => {
          setPhase(p);
        },
        clock.phaseSignal
      );
      setPhase('orphan-stop');
      await command('coordinator', 'stop');
      setPhase('orphan-wait-exit');
      await waitFor('orphan coordinator exit', async () =>
        !(await ownedProcess(orphan.process, coordinator, false))
          ? true
          : undefined
      );
      setPhase('orphan-assert-stopped');
      assert.equal(readDescriptor(data), undefined);
      assert.ok(!existsSync(reservation));
      orphanChildIdentity = undefined;
      orphanSupervisorIdentity = undefined;
      orphanSupervisorStatusBefore = undefined;
      orphanSupervisorStatusAfter = undefined;
      expectedDescriptorInstance = undefined;
      setPhase('orphan-restart');
      await command('coordinator', 'restart');
      setPhase('orphan-restart-started');
      current = await started(orphan);
      setPhase('orphan-restart-stop');
      await stop(current);
      setPhase('missing-lock-status');
      rmSync(lock);
      await run([cli, 'coordinator', 'status'], root, env, true);
      assert.ok(!existsSync(lock));
      setPhase('missing-lock-start');
      await command('coordinator', 'start');
      current = await started(beforeRestart);
      assert.ok(existsSync(lock));

      setPhase('partial-claim-kill');
      const beforePartial = current;
      await killPair(beforePartial);
      setPhase('partial-claim-status');
      rmSync(pidFile);
      const reservationBytes = readFileSync(reservation);
      const ownerBytes = readFileSync(owner);
      assert.ok(
        /Coordinator: not running/.test(await command('coordinator', 'status'))
      );
      assert.ok(reservationBytes.equals(readFileSync(reservation)));
      assert.ok(ownerBytes.equals(readFileSync(owner)));
      assert.ok(!existsSync(pidFile));
      setPhase('partial-claim-start');
      await command('coordinator', 'start');
      current = await started(beforePartial);
      assert.ok(
        current.supervisor?.generationId !==
          beforePartial.supervisor?.generationId
      );
      assert.ok(current.supervisor?.nonce !== beforePartial.supervisor?.nonce);

      setPhase('modeled-pid-reuse');
      const beforeReuse = current;
      await killPair(beforeReuse);
      await assertListenerUnbound(beforeReuse.httpsPort, clock.phaseSignal);
      await assertListenerUnbound(beforeReuse.grpcPort, clock.phaseSignal);
      fixture = startBounded(
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
          timeoutMs: 330000,
          signal: clock.phaseSignal,
          capture: false,
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
        current.supervisor?.generationId !==
          beforeReuse.supervisor?.generationId
      );
      assert.equal(fixture.exitCode, null);
      await stop(current);

      setPhase('fast-exit-receipt');
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
        const { safeHelperDiagnostic, classifySupervisorError, evaluateHelperMarkerStatus } = await import(${JSON.stringify(diagModPath)});
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
            const errMsg = e instanceof Error ? (e.name + ': ' + e.message) : String(e);
            fs.writeFileSync(${JSON.stringify(join(fastExitData, 'runtime-marker-status'))}, evaluateHelperMarkerStatus(errMsg));
            const helper = safeHelperDiagnostic(errMsg);
            if (helper) {
              fs.writeFileSync(${JSON.stringify(join(fastExitData, 'runtime-diagnostic.json'))}, JSON.stringify(helper));
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
      feSupervisor = startBounded([process.execPath, fastExitSupervisorFile], {
        env: fastExitEnv,
        timeoutMs: 180000,
        signal: clock.phaseSignal,
        capture: false,
      });
      try {
        setPhase('fast-exit-receipt-capture');
        // Wait for child to publish and receipt to be captured & held; fail fast on early supervisor death
        const capturedIdentity = await waitFor('receipt captured', () => {
          if (feSupervisor?.timedOut) {
            throw new ProofSubprocessTimeout();
          }
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
        assert.ok(await ownedProcess(feChildIdentity, coordinator, false));

        setPhase('fast-exit-child-stop');
        // Initiate authenticated shutdown to the child in fastExitEnv without awaiting completion,
        // because stopDaemon waits for the supervisor claim to clear while the supervisor is held
        stopRequester = startBounded([cli, 'coordinator', 'stop'], {
          cwd: root,
          env: fastExitEnv,
          timeoutMs: 90000,
          signal: clock.phaseSignal,
          capture: true,
          maxBytes: 65536,
          eofGraceMs: 5000,
        });

        setPhase('fast-exit-child-exit');
        // Wait for child to receive shutdown and fully exit before releasing receipt; fail fast if supervisor dies
        await waitFor('child exit before receipt release', async () => {
          if (feSupervisor?.timedOut) {
            throw new ProofSubprocessTimeout();
          }
          if (feSupervisor && feSupervisor.exitCode !== null) {
            throw new Error(
              `supervisor exited early with code ${feSupervisor.exitCode}`
            );
          }
          return !(await ownedProcess(feChildIdentity, coordinator, false))
            ? true
            : undefined;
        });

        setPhase('fast-exit-receipt-release');
        // Now release the held receipt to startDaemon; it must safely accept shutdown-requested
        // from the committed intent and matching receipt without failing or restarting a successor
        writeFileSync(receiptReleaseSignal, 'release');

        // Await successful completion of the stop requester
        const stopResult = await stopRequester.waitBounded();
        if (stopResult.aborted) throw new ProofDeadlineError();
        if (stopResult.timedOut) throw new ProofSubprocessTimeout();
        if (stopResult.pipeRetained) throw new ProofOutputRetained();
        if (stopResult.exitCode !== 0) {
          throw new ProofCommandError(stopResult.exitCode, stopResult.output);
        }
        setPhase('fast-exit-supervisor-exit');
        await waitFor('supervisor exit after fast-exit', () => {
          if (feSupervisor?.timedOut) {
            throw new ProofSubprocessTimeout();
          }
          return feSupervisor?.exitCode !== null
            ? feSupervisor?.exitCode
            : undefined;
        });
        assert.equal(feSupervisor?.exitCode, 0);
        setPhase('fast-exit-cleanup');
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
          try {
            stopRequester.kill();
            await waitProcessExit(
              stopRequester.exited,
              5000,
              clock.cleanupSignal
            );
          } catch {}
        }
        if (feSupervisor && feSupervisor.exitCode === null) {
          feSupervisorProofKilled = true;
          try {
            feSupervisor.kill();
            await waitProcessExit(
              feSupervisor.exited,
              5000,
              clock.cleanupSignal
            );
          } catch {}
        }
      }
    }
  } catch (error) {
    failed = true;
    if (clock.phaseSignal.aborted) {
      try {
        await abortableSleep(1000, clock.cleanupSignal);
      } catch {}
    }
    let diagnostic: SafeProcessDiagnostic | undefined;
    try {
      diagnostic = await collectDiagnostic();
    } catch {}
    const failureLine = safeProofFailure(phase, error, diagnostic);
    writeSync(2, `Installed Windows proof failure: ${failureLine}\n`);
  } finally {
    const cleanupStartTime = Date.now();

    // Step 1: fixture
    {
      const t0 = Date.now();
      let ok = true;
      if (fixture && fixture.exitCode === null) {
        try {
          fixture.kill();
          const exited = await waitProcessExit(
            fixture.exited,
            5000,
            clock.cleanupSignal
          );
          if (!exited) {
            ok = false;
            cleanupFailed = true;
          }
        } catch {
          ok = false;
          cleanupFailed = true;
        }
      }
      if (feSupervisor && feSupervisor.exitCode === null) {
        try {
          feSupervisorProofKilled = true;
          feSupervisor.kill();
          const exited = await waitProcessExit(
            feSupervisor.exited,
            5000,
            clock.cleanupSignal
          );
          if (!exited) {
            ok = false;
            cleanupFailed = true;
          }
        } catch {
          ok = false;
          cleanupFailed = true;
        }
      }
      if (stopRequester && stopRequester.exitCode === null) {
        try {
          stopRequester.kill();
          const exited = await waitProcessExit(
            stopRequester.exited,
            5000,
            clock.cleanupSignal
          );
          if (!exited) {
            ok = false;
            cleanupFailed = true;
          }
        } catch {
          ok = false;
          cleanupFailed = true;
        }
      }
      const ms = Date.now() - t0;
      const line = safeProofCleanup({ step: 'fixture', ms, ok });
      if (line) writeSync(2, `Installed Windows proof cleanup: ${line}\n`);
    }

    // Step 2: stop
    {
      const t0 = Date.now();
      let ok = true;
      if (existsSync(join(runtime, 'coordinator.json'))) {
        const remainingCleanup = cleanupMs - (Date.now() - cleanupStartTime);
        if (remainingCleanup >= 60000) {
          try {
            const stopRes = await spawnBounded([cli, 'coordinator', 'stop'], {
              cwd: root,
              env,
              timeoutMs: 30000,
              signal: clock.cleanupSignal,
              capture: false,
            });
            if (
              stopRes.exitCode !== 0 ||
              stopRes.timedOut ||
              stopRes.pipeRetained ||
              stopRes.aborted
            ) {
              ok = false;
              cleanupFailed = true;
            }
          } catch {
            ok = false;
            cleanupFailed = true;
          }
        }
      }
      const ms = Date.now() - t0;
      const line = safeProofCleanup({ step: 'stop', ms, ok });
      if (line) writeSync(2, `Installed Windows proof cleanup: ${line}\n`);
    }

    // Step 3: fast-exit-stop
    {
      const t0 = Date.now();
      let ok = true;
      const fastExitRuntimePath = join(
        root,
        'fast-exit-data',
        'runtime',
        'coordinator.json'
      );
      if (existsSync(fastExitRuntimePath)) {
        const remainingCleanup = cleanupMs - (Date.now() - cleanupStartTime);
        if (remainingCleanup >= 60000) {
          try {
            const stopRes = await spawnBounded([cli, 'coordinator', 'stop'], {
              cwd: root,
              env: {
                ...env,
                HAN_DATA_DIR: join(root, 'fast-exit-data'),
              },
              timeoutMs: 30000,
              signal: clock.cleanupSignal,
              capture: false,
            });
            if (
              stopRes.exitCode !== 0 ||
              stopRes.timedOut ||
              stopRes.pipeRetained ||
              stopRes.aborted
            ) {
              ok = false;
              cleanupFailed = true;
            }
          } catch {
            ok = false;
            cleanupFailed = true;
          }
        }
      }
      const ms = Date.now() - t0;
      const line = safeProofCleanup({ step: 'fast-exit-stop', ms, ok });
      if (line) writeSync(2, `Installed Windows proof cleanup: ${line}\n`);
    }

    // Step 4: sweep
    {
      const t0 = Date.now();
      let ok = true;
      let terminated: number | undefined;
      let remaining: number | undefined;
      try {
        const sweepRes = await sweepRoot(root, 30000);
        terminated = sweepRes.terminated;
        remaining = sweepRes.remaining;
        if (remaining !== 0 || (terminated !== undefined && terminated < 0)) {
          ok = false;
          cleanupFailed = true;
        }
      } catch {
        ok = false;
        cleanupFailed = true;
      }
      const ms = Date.now() - t0;
      const line = safeProofCleanup({
        step: 'sweep',
        ms,
        ok,
        terminated:
          terminated !== undefined && terminated >= 0 ? terminated : 0,
        remaining: remaining !== undefined && remaining >= 0 ? remaining : 0,
      });
      if (line) writeSync(2, `Installed Windows proof cleanup: ${line}\n`);
    }

    // Step 5: remove
    {
      const t0 = Date.now();
      let ok = true;
      try {
        rmSync(root, {
          recursive: true,
          force: true,
          maxRetries: 5,
          retryDelay: 200,
        });
      } catch {
        ok = false;
        cleanupFailed = true;
      }
      const ms = Date.now() - t0;
      const line = safeProofCleanup({ step: 'remove', ms, ok });
      if (line) writeSync(2, `Installed Windows proof cleanup: ${line}\n`);
    }

    // Step 6: complete
    {
      const ms = Date.now() - cleanupStartTime;
      const ok = !cleanupFailed;
      const line = safeProofCleanup({ step: 'complete', ms, ok });
      if (line) writeSync(2, `Installed Windows proof cleanup: ${line}\n`);
    }

    clock.disarm();
  }

  if (failed || cleanupFailed) {
    if (!failed && cleanupFailed) {
      const failureLine = safeProofFailure('cleanup', undefined);
      writeSync(2, `Installed Windows proof failure: ${failureLine}\n`);
    }
    process.exit(1);
  } else {
    console.log(
      barrierProof
        ? 'Installed Windows CLI: fixed-port startup barrier passed'
        : 'Installed Windows CLI: authenticated transport, crash recovery, restart, stop, missing lock, partial claim, modeled PID reuse, and fast-exit receipt passed'
    );
    process.exit(0);
  }
}

process.exitCode = 1;

await main().catch((error: unknown) => {
  const failure = safeProofFailure('setup', error);
  try {
    writeSync(2, `Installed Windows proof failure: ${failure}\n`);
  } catch {
    console.error(`Installed Windows proof failure: ${failure}`);
  }
  process.exit(1);
});
