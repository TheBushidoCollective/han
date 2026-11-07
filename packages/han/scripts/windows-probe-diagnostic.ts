import { existsSync, mkdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import {
  type BoundedChild,
  ProofDeadlineError,
  startBounded,
} from './windows-proof-bounds.ts';

export const tokens = [
  'S0',
  'S1',
  'S2',
  'S3',
  'X0',
  'X3',
  'X4',
  'X5',
  'X6A',
  'X6B',
] as const;

export type TraceToken = (typeof tokens)[number];

export function ownedProcessScript(
  pid: number,
  kill: boolean,
  trace = false
): string {
  if (!Number.isSafeInteger(pid) || pid <= 0) {
    throw new Error('Invalid process id');
  }
  const at = (t: TraceToken) => (trace ? `hanTrace '${t}'; ` : '');
  const prelude = trace
    ? "$hanTraceStart=[Diagnostics.Process]::GetCurrentProcess().StartTime.ToUniversalTime(); function hanTrace([string]$t) { try { [IO.File]::AppendAllText($env:HAN_PROBE_TRACE, $t + ' ' + [int](([DateTime]::UtcNow - $hanTraceStart).TotalMilliseconds) + ' ' + [int]([Diagnostics.Process]::GetCurrentProcess().TotalProcessorTime.TotalMilliseconds) + [Environment]::NewLine) } catch {} }; "
    : '';
  return `$ErrorActionPreference='Stop'; ${prelude}${at('S0')}try { $p=Get-Process -Id ${pid} -ErrorAction Stop } catch { if ($_.FullyQualifiedErrorId -like 'NoProcessFoundForGivenId*') { ${at('X3')}exit 3 }; ${at('X6A')}exit 6 }; ${at('S1')}try { $actual=[System.IO.Path]::GetFullPath($p.Path); ${at('S2')}$expected=[System.IO.Path]::GetFullPath((Resolve-Path -LiteralPath $env:HAN_PROOF_IMAGE).Path); ${at('S3')}if ($actual -ne $expected) { ${at('X4')}exit 4 }; if ($p.StartTime.ToUniversalTime().ToFileTimeUtc().ToString() -ne $env:HAN_PROOF_TIME) { ${at('X5')}exit 5 }; ${kill ? 'Stop-Process -InputObject $p -Force -ErrorAction Stop;' : ''} ${at('X0')}exit 0 } catch { ${at('X6B')}exit 6 }`;
}

export class ProofProbeDiagnosticComplete extends Error {
  constructor(message = 'Proof probe diagnostic complete') {
    super(message);
    this.name = 'ProofProbeDiagnosticComplete';
  }
}

export type LivenessStatus = 'alive' | 'exited' | 'error';

export function liveness(pid: number): LivenessStatus {
  try {
    process.kill(pid, 0);
    return 'alive';
  } catch (error: unknown) {
    if (
      error &&
      typeof error === 'object' &&
      'code' in error &&
      error.code === 'ESRCH'
    ) {
      return 'exited';
    }
    return 'error';
  }
}

const MAX_SAFE_INTEGER_LIMIT = 10_000_000;

function isNonNegativeBoundedInteger(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= 0 &&
    value <= MAX_SAFE_INTEGER_LIMIT
  );
}

function isBoundedExitCode(value: unknown): value is number {
  return (
    typeof value === 'number' &&
    Number.isSafeInteger(value) &&
    value >= -2147483648 &&
    value <= 2147483647
  );
}

const VALID_VARIANTS: Record<string, true> = {
  'proof-hidden-traced': true,
  'os-liveness-control': true,
  'proof-fresh-hidden-untraced': true,
  'proof-fresh-visible-traced': true,
  'runner-hidden-traced': true,
  'runner-fresh-profile-hidden-traced': true,
};

const VALID_OS_STATUS: Record<string, true> = {
  alive: true,
  exited: true,
  error: true,
  'not-checked': true,
};
const VALID_CONTROL_CLASSIFIED: Record<string, true> = {
  alive: true,
  exited: true,
  error: true,
};

export function serializeDiagnosticRecord(
  record: Record<string, unknown>
): string {
  if (!record || typeof record !== 'object') {
    throw new Error('Diagnostic record must be an object');
  }

  let sanitized: Record<string, unknown>;

  if (record.variant === 'os-liveness-control') {
    const expectedKeys = [
      'variant',
      'bunExitedBeforeCheck',
      'classified',
      'reaped',
    ];
    const keys = Object.keys(record);
    if (
      keys.length !== expectedKeys.length ||
      !expectedKeys.every((k) => keys.includes(k))
    ) {
      throw new Error(`Invalid control record keys: ${keys.sort().join(',')}`);
    }
    if (typeof record.bunExitedBeforeCheck !== 'boolean') {
      throw new Error('bunExitedBeforeCheck must be boolean');
    }
    if (
      typeof record.classified !== 'string' ||
      !VALID_CONTROL_CLASSIFIED[record.classified]
    ) {
      throw new Error(
        `Invalid classified status: ${String(record.classified)}`
      );
    }
    if (typeof record.reaped !== 'boolean') {
      throw new Error('reaped must be boolean');
    }
    sanitized = {
      variant: 'os-liveness-control',
      bunExitedBeforeCheck: record.bunExitedBeforeCheck,
      classified: record.classified,
      reaped: record.reaped,
    };
  } else {
    const expectedKeys = [
      'variant',
      'at20s',
      'ps',
      'traceBytes',
      'otherTraceLines',
      'osPoll',
      'osExitMs',
      'bunExitMs',
      'exitCode',
      'killedAtCap',
      'reaped',
      'pipeRetained',
    ];
    const keys = Object.keys(record);
    if (
      keys.length !== expectedKeys.length ||
      !expectedKeys.every((k) => keys.includes(k))
    ) {
      throw new Error(`Invalid launch record keys: ${keys.sort().join(',')}`);
    }
    if (typeof record.variant !== 'string' || !VALID_VARIANTS[record.variant]) {
      throw new Error(`Invalid variant: ${String(record.variant)}`);
    }

    const at20s = record.at20s as Record<string, unknown>;
    if (!at20s || typeof at20s !== 'object') {
      throw new Error('at20s must be an object');
    }
    const at20sKeys = Object.keys(at20s);
    const expectedAt20sKeys = ['ms', 'bunExited', 'os', 'last'];
    if (
      at20sKeys.length !== expectedAt20sKeys.length ||
      !expectedAt20sKeys.every((k) => at20sKeys.includes(k))
    ) {
      throw new Error(`Invalid at20s keys: ${at20sKeys.sort().join(',')}`);
    }
    if (at20s.ms !== null && !isNonNegativeBoundedInteger(at20s.ms)) {
      throw new Error(`Invalid at20s.ms: ${String(at20s.ms)}`);
    }
    if (typeof at20s.bunExited !== 'boolean') {
      throw new Error('at20s.bunExited must be boolean');
    }
    if (typeof at20s.os !== 'string' || !VALID_OS_STATUS[at20s.os]) {
      throw new Error(`Invalid at20s.os: ${String(at20s.os)}`);
    }
    if (
      typeof at20s.last !== 'string' ||
      (!tokens.includes(at20s.last as TraceToken) &&
        at20s.last !== 'none' &&
        at20s.last !== 'untraced')
    ) {
      throw new Error(`Invalid at20s.last: ${String(at20s.last)}`);
    }

    const ps = record.ps as Record<string, unknown>;
    if (!ps || typeof ps !== 'object' || Array.isArray(ps)) {
      throw new Error('ps must be an object');
    }
    const sanitizedPs: Record<string, [number, number]> = {};
    for (const [k, v] of Object.entries(ps)) {
      if (!tokens.includes(k as TraceToken)) {
        throw new Error(`Invalid token in ps: ${k}`);
      }
      if (
        !Array.isArray(v) ||
        v.length !== 2 ||
        !isNonNegativeBoundedInteger(v[0]) ||
        !isNonNegativeBoundedInteger(v[1])
      ) {
        throw new Error(`Invalid token timing in ps for ${k}`);
      }
      sanitizedPs[k] = [v[0], v[1]];
    }

    if (!isNonNegativeBoundedInteger(record.traceBytes)) {
      throw new Error(`Invalid traceBytes: ${String(record.traceBytes)}`);
    }
    if (!isNonNegativeBoundedInteger(record.otherTraceLines)) {
      throw new Error(
        `Invalid otherTraceLines: ${String(record.otherTraceLines)}`
      );
    }

    const osPoll = record.osPoll as Record<string, unknown>;
    if (!osPoll || typeof osPoll !== 'object' || Array.isArray(osPoll)) {
      throw new Error('osPoll must be an object');
    }
    const osPollKeys = Object.keys(osPoll);
    const expectedOsPollKeys = ['alive', 'exited', 'error'];
    if (
      osPollKeys.length !== expectedOsPollKeys.length ||
      !expectedOsPollKeys.every((k) => osPollKeys.includes(k))
    ) {
      throw new Error(`Invalid osPoll keys: ${osPollKeys.sort().join(',')}`);
    }
    if (
      !isNonNegativeBoundedInteger(osPoll.alive) ||
      !isNonNegativeBoundedInteger(osPoll.exited) ||
      !isNonNegativeBoundedInteger(osPoll.error)
    ) {
      throw new Error('osPoll values must be bounded non-negative integers');
    }

    if (
      record.osExitMs !== null &&
      !isNonNegativeBoundedInteger(record.osExitMs)
    ) {
      throw new Error(`Invalid osExitMs: ${String(record.osExitMs)}`);
    }
    if (
      record.bunExitMs !== null &&
      !isNonNegativeBoundedInteger(record.bunExitMs)
    ) {
      throw new Error(`Invalid bunExitMs: ${String(record.bunExitMs)}`);
    }
    if (record.exitCode !== null && !isBoundedExitCode(record.exitCode)) {
      throw new Error(`Invalid exitCode: ${String(record.exitCode)}`);
    }
    if (typeof record.killedAtCap !== 'boolean') {
      throw new Error('killedAtCap must be boolean');
    }
    if (typeof record.reaped !== 'boolean') {
      throw new Error('reaped must be boolean');
    }
    if (
      record.pipeRetained !== null &&
      typeof record.pipeRetained !== 'boolean'
    ) {
      throw new Error('pipeRetained must be boolean or null');
    }

    sanitized = {
      variant: record.variant,
      at20s: {
        ms: at20s.ms,
        bunExited: at20s.bunExited,
        os: at20s.os,
        last: at20s.last,
      },
      ps: sanitizedPs,
      traceBytes: record.traceBytes,
      otherTraceLines: record.otherTraceLines,
      osPoll: {
        alive: osPoll.alive,
        exited: osPoll.exited,
        error: osPoll.error,
      },
      osExitMs: record.osExitMs,
      bunExitMs: record.bunExitMs,
      exitCode: record.exitCode,
      killedAtCap: record.killedAtCap,
      reaped: record.reaped,
      pipeRetained: record.pipeRetained,
    };
  }

  const json = JSON.stringify(sanitized);
  if (json.includes('\\')) {
    throw new Error('Diagnostic record contains backslash');
  }
  return json;
}

function getLastToken(tracePath: string): string {
  if (!tracePath) return 'untraced';
  try {
    if (!existsSync(tracePath)) return 'none';
    const st = statSync(tracePath);
    if (st.size > 4096) return 'none';
    const content = readFileSync(tracePath, 'utf8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const tokenRegex =
      /^(S0|S1|S2|S3|X0|X3|X4|X5|X6A|X6B) (\d{1,8}) (\d{1,8})$/;
    let last = 'none';
    for (const line of lines) {
      const m = tokenRegex.exec(line.trim());
      if (m) {
        last = m[1];
      }
    }
    return last;
  } catch {
    return 'none';
  }
}

function parseTrace(
  tracePath: string,
  traced: boolean
): {
  ps: Record<string, [number, number]>;
  traceBytes: number;
  otherTraceLines: number;
} {
  if (!traced) {
    return { ps: {}, traceBytes: 0, otherTraceLines: 0 };
  }
  try {
    if (!existsSync(tracePath)) {
      return { ps: {}, traceBytes: 0, otherTraceLines: 0 };
    }
    const st = statSync(tracePath);
    const traceBytes = st.size;
    if (st.size > 4096) {
      return { ps: {}, traceBytes, otherTraceLines: 0 };
    }
    const content = readFileSync(tracePath, 'utf8');
    const lines = content.split(/\r?\n/).filter((l) => l.trim().length > 0);
    const ps: Record<string, [number, number]> = {};
    let otherTraceLines = 0;
    const tokenRegex =
      /^(S0|S1|S2|S3|X0|X3|X4|X5|X6A|X6B) (\d{1,8}) (\d{1,8})$/;
    for (const line of lines) {
      const match = tokenRegex.exec(line.trim());
      if (match) {
        const token = match[1];
        const wallMs = Number.parseInt(match[2], 10);
        const cpuMs = Number.parseInt(match[3], 10);
        if (!(token in ps)) {
          ps[token] = [wallMs, cpuMs];
        } else {
          otherTraceLines++;
        }
      } else {
        otherTraceLines++;
      }
    }
    return { ps, traceBytes, otherTraceLines };
  } catch {
    return { ps: {}, traceBytes: 0, otherTraceLines: 0 };
  }
}

interface RunPowerShellVariantOptions {
  variant: string;
  powershell: string;
  root: string;
  env: Record<string, string>;
  pid: number;
  traced: boolean;
  windowsHide: boolean;
  tracePath: string;
  signal?: AbortSignal;
  onSpawn?: (child: BoundedChild) => void;
}

async function runPowerShellVariant(options: RunPowerShellVariantOptions) {
  const {
    variant,
    powershell,
    root,
    env,
    pid,
    traced,
    windowsHide,
    tracePath,
    signal,
  } = options;

  const script = ownedProcessScript(pid, false, traced);
  const t0 = Date.now();
  const ms = () => Date.now() - t0;

  let bunExitMs: number | null = null;
  let exitCode: number | null = null;
  let osExitMs: number | null = null;
  let at20s: {
    ms: number | null;
    bunExited: boolean;
    os: 'alive' | 'exited' | 'error' | 'not-checked';
    last: string;
  } | null = null;
  const osPoll = { alive: 0, exited: 0, error: 0 };

  const child = startBounded(
    [powershell, '-NoProfile', '-NonInteractive', '-Command', script],
    {
      cwd: root,
      env,
      timeoutMs: 90000,
      signal,
      capture: true,
      windowsHide,
    }
  );
  if (options.onSpawn) {
    options.onSpawn(child);
  }

  const exited = child.exited.then(
    (c) => {
      if (bunExitMs === null) bunExitMs = ms();
      exitCode = c;
    },
    () => {
      if (bunExitMs === null) bunExitMs = ms();
    }
  );

  while (bunExitMs === null && ms() < 105000) {
    if (child.exitCode === null) {
      const s = liveness(child.pid);
      osPoll[s]++;
      if (s === 'exited' && osExitMs === null) {
        osExitMs = ms();
      }
      if (at20s === null && ms() >= 20000) {
        at20s = {
          ms: ms(),
          bunExited: false,
          os: s,
          last: traced ? getLastToken(tracePath) : 'untraced',
        };
      }
    }
    await Promise.race([exited, Bun.sleep(250)]);
  }

  if (at20s === null) {
    at20s = {
      ms: null,
      bunExited: bunExitMs !== null && bunExitMs <= 20000,
      os: 'not-checked',
      last: traced ? getLastToken(tracePath) : 'untraced',
    };
  }
  if (signal?.aborted) {
    throw new ProofDeadlineError('Proof phase aborted: deadline exceeded');
  }
  if (bunExitMs === null) {
    try {
      child.kill('SIGKILL');
    } catch {}
    await Promise.race([
      child.exited.then(
        (c) => {
          if (bunExitMs === null) bunExitMs = ms();
          exitCode = c;
        },
        () => {
          if (bunExitMs === null) bunExitMs = ms();
        }
      ),
      Bun.sleep(5000),
    ]);
  }

  const reaped = bunExitMs !== null;
  let pipeRetained: boolean | null = null;
  if (reaped) {
    try {
      const waitResult = await child.waitBounded();
      pipeRetained = waitResult.pipeRetained;
    } catch {
      pipeRetained = null;
    }
  }

  const traceInfo = parseTrace(tracePath, traced);

  return {
    variant,
    at20s,
    ps: traceInfo.ps,
    traceBytes: traceInfo.traceBytes,
    otherTraceLines: traceInfo.otherTraceLines,
    osPoll,
    osExitMs,
    bunExitMs,
    exitCode,
    killedAtCap: child.timedOut,
    reaped,
    pipeRetained,
  };
}

export interface RunProbeDiagnosticOptions {
  powershell: string;
  systemRoot: string;
  root: string;
  proofEnv: Record<string, string>;
  runnerEnv: NodeJS.ProcessEnv;
  identity: { pid: number; creationTime: string };
  image: string;
  signal?: AbortSignal;
  emit: (line: string) => void;
}

export async function runProbeDiagnostic(
  options: RunProbeDiagnosticOptions
): Promise<void> {
  const {
    powershell,
    systemRoot,
    root,
    proofEnv,
    runnerEnv,
    identity,
    image,
    signal,
    emit,
  } = options;

  const diagDir = join(root, 'probe-diagnostic');
  mkdirSync(diagDir, { recursive: true });

  const spawnedChildren: BoundedChild[] = [];
  const onSpawn = (c: BoundedChild) => spawnedChildren.push(c);

  let runError: unknown = null;
  try {
    // 1. Variant 1: proof-hidden-traced
    {
      const variant = 'proof-hidden-traced';
      const tracePath = join(diagDir, `${variant}.trace`);
      const env: Record<string, string> = {
        ...proofEnv,
        HAN_PROOF_IMAGE: image,
        HAN_PROOF_TIME: identity.creationTime,
        HAN_PROBE_TRACE: tracePath,
      };
      const record = await runPowerShellVariant({
        variant,
        powershell,
        root,
        env,
        pid: identity.pid,
        traced: true,
        windowsHide: true,
        tracePath,
        signal,
        onSpawn,
      });
      emit(serializeDiagnosticRecord(record));
      if (!record.reaped) return;
      if (signal?.aborted) {
        throw new ProofDeadlineError('Proof phase aborted: deadline exceeded');
      }
    }

    // 2. Variant 2: os-liveness-control
    {
      const cmdPath = join(systemRoot, 'System32', 'cmd.exe');
      const child = startBounded([cmdPath, '/d', '/c', 'exit 0'], {
        cwd: root,
        env: runnerEnv as Record<string, string>,
        timeoutMs: 10000,
        capture: false,
        windowsHide: true,
        signal,
      });
      onSpawn(child);

      const busyStart = Date.now();
      while (Date.now() - busyStart < 2000) {}

      const bunExitedBeforeCheck = child.exitCode !== null;
      const classified = liveness(child.pid);

      let reaped = await Promise.race([
        child.exited.then(
          () => true,
          () => false
        ),
        Bun.sleep(10000).then(() => false),
      ]);
      if (reaped) {
        try {
          await child.waitBounded();
        } catch {}
      } else {
        try {
          child.kill('SIGKILL');
        } catch {}
        reaped = await Promise.race([
          child.exited.then(
            () => true,
            () => false
          ),
          Bun.sleep(5000).then(() => false),
        ]);
      }

      const controlRecord = {
        variant: 'os-liveness-control',
        bunExitedBeforeCheck,
        classified,
        reaped,
      };
      emit(serializeDiagnosticRecord(controlRecord));
      if (!reaped) return;
      if (signal?.aborted) {
        throw new ProofDeadlineError('Proof phase aborted: deadline exceeded');
      }
    }

    // 3. Variant 3: proof-fresh-hidden-untraced
    {
      const variant = 'proof-fresh-hidden-untraced';
      const freshDir = join(diagDir, variant);
      mkdirSync(freshDir, { recursive: true });
      mkdirSync(join(freshDir, 'tmp'), { recursive: true });
      const env: Record<string, string> = {
        ...proofEnv,
        HOME: freshDir,
        USERPROFILE: freshDir,
        TEMP: join(freshDir, 'tmp'),
        TMP: join(freshDir, 'tmp'),
        APPDATA: join(freshDir, 'appdata'),
        LOCALAPPDATA: join(freshDir, 'localappdata'),
        HAN_PROOF_IMAGE: image,
        HAN_PROOF_TIME: identity.creationTime,
      };
      const record = await runPowerShellVariant({
        variant,
        powershell,
        root,
        env,
        pid: identity.pid,
        traced: false,
        windowsHide: true,
        tracePath: '',
        signal,
        onSpawn,
      });
      emit(serializeDiagnosticRecord(record));
      if (!record.reaped) return;
      if (signal?.aborted) {
        throw new ProofDeadlineError('Proof phase aborted: deadline exceeded');
      }
    }

    // 4. Variant 4: proof-fresh-visible-traced
    {
      const variant = 'proof-fresh-visible-traced';
      const freshDir = join(diagDir, variant);
      mkdirSync(freshDir, { recursive: true });
      mkdirSync(join(freshDir, 'tmp'), { recursive: true });
      const tracePath = join(diagDir, `${variant}.trace`);
      const env: Record<string, string> = {
        ...proofEnv,
        HOME: freshDir,
        USERPROFILE: freshDir,
        TEMP: join(freshDir, 'tmp'),
        TMP: join(freshDir, 'tmp'),
        APPDATA: join(freshDir, 'appdata'),
        LOCALAPPDATA: join(freshDir, 'localappdata'),
        HAN_PROOF_IMAGE: image,
        HAN_PROOF_TIME: identity.creationTime,
        HAN_PROBE_TRACE: tracePath,
      };
      const record = await runPowerShellVariant({
        variant,
        powershell,
        root,
        env,
        pid: identity.pid,
        traced: true,
        windowsHide: false,
        tracePath,
        signal,
        onSpawn,
      });
      emit(serializeDiagnosticRecord(record));
      if (!record.reaped) return;
      if (signal?.aborted) {
        throw new ProofDeadlineError('Proof phase aborted: deadline exceeded');
      }
    }

    // 5. Variant 5: runner-hidden-traced
    {
      const variant = 'runner-hidden-traced';
      const tracePath = join(diagDir, `${variant}.trace`);
      const env: Record<string, string> = {
        ...(runnerEnv as Record<string, string>),
        HAN_PROOF_IMAGE: image,
        HAN_PROOF_TIME: identity.creationTime,
        HAN_PROBE_TRACE: tracePath,
      };
      const record = await runPowerShellVariant({
        variant,
        powershell,
        root,
        env,
        pid: identity.pid,
        traced: true,
        windowsHide: true,
        tracePath,
        signal,
        onSpawn,
      });
      emit(serializeDiagnosticRecord(record));
      if (signal?.aborted) {
        throw new ProofDeadlineError('Proof phase aborted: deadline exceeded');
      }
    }
  } catch (error) {
    runError = error;
  }

  let unreapedCount = 0;
  for (const child of spawnedChildren) {
    if (child.exitCode === null) {
      try {
        child.kill('SIGKILL');
      } catch {}
      const reaped = await Promise.race([
        child.exited.then(
          () => true,
          () => false
        ),
        Bun.sleep(5000).then(() => false),
      ]);
      if (!reaped) {
        unreapedCount++;
      }
    }
  }

  if (runError) {
    throw runError;
  }
  if (unreapedCount > 0) {
    throw new Error(
      `Diagnostic failed to reap ${unreapedCount} subprocess(es) after SIGKILL`
    );
  }
}
