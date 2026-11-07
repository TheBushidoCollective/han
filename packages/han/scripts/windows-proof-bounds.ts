import { spawnSync } from 'node:child_process';
import { existsSync, realpathSync, writeSync } from 'node:fs';
import { basename, join, parse, resolve } from 'node:path';
import { safeProofFailure } from './windows-proof-diagnostics.ts';

export class ProofDeadlineError extends Error {
  constructor(message = 'Proof deadline exceeded') {
    super(message);
    this.name = 'ProofDeadlineError';
  }
}

export class ProofSubprocessTimeout extends Error {
  constructor(message = 'Subprocess timed out') {
    super(message);
    this.name = 'ProofSubprocessTimeout';
  }
}

export class ProofOutputRetained extends Error {
  constructor(message = 'Output handle retained after process exit') {
    super(message);
    this.name = 'ProofOutputRetained';
  }
}

export class ProofWatchdogError extends Error {
  readonly code = 'WATCHDOG';
  constructor(message = 'Watchdog timeout expired') {
    super(message);
    this.name = 'ProofWatchdogError';
  }
}

export interface ProofBudget {
  deadlineMs: number;
  cleanupMs: number;
}

export function readProofBudget(
  env?: Record<string, string | undefined>
): ProofBudget;
export function readProofBudget(
  env: Record<string, string | undefined>,
  key: string,
  defaultValue?: number
): number;
export function readProofBudget(
  env: Record<string, string | undefined> = process.env,
  key?: string,
  defaultValue?: number
): ProofBudget | number {
  if (key !== undefined) {
    const raw = env[key];
    if (raw === undefined || raw === '') {
      if (defaultValue !== undefined) return defaultValue;
      throw new Error(`Missing required proof budget for ${key}`);
    }
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(
        `Invalid proof budget for ${key}: expected integer string between 30000 and 3600000, got "${raw}"`
      );
    }
    const val = Number.parseInt(trimmed, 10);
    if (!Number.isSafeInteger(val) || val < 30000 || val > 3600000) {
      throw new Error(
        `Invalid proof budget for ${key}: value ${val} out of bounds [30000, 3600000]`
      );
    }
    return val;
  }

  const parseVal = (name: string, def: number): number => {
    const raw = env[name];
    if (raw === undefined || raw === '') return def;
    const trimmed = raw.trim();
    if (!/^\d+$/.test(trimmed)) {
      throw new Error(
        `Invalid proof budget for ${name}: expected integer string between 30000 and 3600000, got "${raw}"`
      );
    }
    const val = Number.parseInt(trimmed, 10);
    if (!Number.isSafeInteger(val) || val < 30000 || val > 3600000) {
      throw new Error(
        `Invalid proof budget for ${name}: value ${val} out of bounds [30000, 3600000]`
      );
    }
    return val;
  };

  return {
    deadlineMs: parseVal('HAN_PROOF_DEADLINE_MS', 2100000),
    cleanupMs: parseVal('HAN_PROOF_CLEANUP_MS', 180000),
  };
}

export interface ProofClockOptions {
  deadlineMs: number;
  cleanupMs: number;
  watchdogMarginMs?: number;
}

export interface ProofClock {
  readonly phaseSignal: AbortSignal;
  readonly cleanupSignal: AbortSignal;
  elapsedMs(): number;
  armWatchdog(
    rootOrOptions?:
      | string
      | {
          root?: string;
          getPhase?: () => string;
          getCurrentPhase?: () => string;
        },
    maybeGetPhase?: () => string
  ): void;
  disarm(): void;
}

export function createProofClock(options: ProofClockOptions): ProofClock {
  const startTime = Date.now();
  const deadlineMs = options.deadlineMs;
  const cleanupMs = options.cleanupMs;
  const watchdogMarginMs = options.watchdogMarginMs ?? 60000;

  const phaseController = new AbortController();
  const cleanupController = new AbortController();

  // Active timers hold the event loop open until explicit completion or disarm
  const phaseTimer = setTimeout(() => {
    phaseController.abort(
      new ProofDeadlineError('Proof phase deadline exceeded')
    );
  }, deadlineMs);

  const cleanupTimer = setTimeout(() => {
    cleanupController.abort(
      new ProofDeadlineError('Proof cleanup deadline exceeded')
    );
  }, deadlineMs + cleanupMs);

  let watchdogTimer: NodeJS.Timeout | undefined;
  let watchdogArmed = false;
  let watchdogRoot: string | undefined;
  let phaseGetter: (() => string) | undefined;

  const scheduleWatchdog = () => {
    clearTimeout(watchdogTimer);
    const totalDelay = deadlineMs + cleanupMs + watchdogMarginMs;
    watchdogTimer = setTimeout(() => {
      if (!watchdogArmed) return;
      const currentPhase = phaseGetter ? phaseGetter() : 'setup';
      const failureJson = safeProofFailure(
        currentPhase,
        new ProofWatchdogError()
      );
      try {
        writeSync(2, `Installed Windows proof failure: ${failureJson}\n`);
      } catch {}
      if (watchdogRoot) {
        try {
          sweepRootSync(watchdogRoot, 15000);
        } catch {}
      }
      process.exit(1);
    }, totalDelay);
  };

  const armWatchdog = (
    rootOrOptions?:
      | string
      | {
          root?: string;
          getPhase?: () => string;
          getCurrentPhase?: () => string;
        },
    maybeGetPhase?: () => string
  ) => {
    watchdogArmed = true;
    if (typeof rootOrOptions === 'string') {
      watchdogRoot = rootOrOptions;
      phaseGetter = maybeGetPhase;
    } else if (rootOrOptions && typeof rootOrOptions === 'object') {
      watchdogRoot = rootOrOptions.root;
      phaseGetter = rootOrOptions.getCurrentPhase ?? rootOrOptions.getPhase;
    }
    scheduleWatchdog();
  };

  const disarm = () => {
    watchdogArmed = false;
    clearTimeout(phaseTimer);
    clearTimeout(cleanupTimer);
    clearTimeout(watchdogTimer);
  };

  return {
    get phaseSignal() {
      return phaseController.signal;
    },
    get cleanupSignal() {
      return cleanupController.signal;
    },
    elapsedMs() {
      return Math.max(0, Math.floor(Date.now() - startTime));
    },
    armWatchdog,
    disarm,
  };
}

interface MinimalStreamReader {
  read(): Promise<{ value?: Uint8Array | undefined; done: boolean }>;
  cancel(reason?: unknown): Promise<unknown> | unknown;
  releaseLock(): void;
}

class BoundedStreamReader {
  private reader: MinimalStreamReader | null = null;
  private finished = false;
  private cancelled = false;
  private readPromise: Promise<void> | null = null;

  constructor(
    stream: { getReader(): MinimalStreamReader } | null | undefined,
    onChunk: (chunk: Uint8Array) => void
  ) {
    if (!stream) {
      this.finished = true;
      return;
    }
    try {
      this.reader = stream.getReader();
    } catch {
      this.finished = true;
      return;
    }

    this.readPromise = (async () => {
      try {
        while (!this.cancelled) {
          const activeReader = this.reader;
          if (!activeReader) break;
          const { value, done } = await activeReader.read();
          if (done) {
            this.finished = true;
            break;
          }
          if (value && !this.cancelled) {
            onChunk(value);
          }
        }
      } catch {
        // Stream reading cancelled, closed or aborted
      } finally {
        this.finished = true;
        try {
          this.reader?.releaseLock();
        } catch {}
      }
    })();
  }

  isDone(): boolean {
    return this.finished;
  }

  async wait(): Promise<void> {
    if (this.readPromise) {
      await this.readPromise;
    }
  }

  async cancel(): Promise<void> {
    if (this.finished || this.cancelled) return;
    this.cancelled = true;
    try {
      await this.reader?.cancel();
    } catch {}
    try {
      this.reader?.releaseLock();
    } catch {}
  }
}

export interface SpawnBoundedOptions {
  cwd?: string;
  env?: Record<string, string | undefined>;
  timeoutMs?: number;
  signal?: AbortSignal;
  capture?: boolean;
  maxBytes?: number;
  eofGraceMs?: number;
  windowsHide?: boolean;
}

export interface SpawnBoundedResult {
  exitCode: number | null;
  timedOut: boolean;
  aborted: boolean;
  pipeRetained: boolean;
  output: string;
  ms: number;
  pid?: number;
}

export interface ProofSubprocess {
  readonly pid: number;
  readonly exitCode: number | null;
  readonly exited: Promise<number>;
  kill(signal?: number | string): void;
  readonly stdout?: unknown;
  readonly stderr?: unknown;
}

export async function spawnBounded(
  argv: string[],
  options: SpawnBoundedOptions = {}
): Promise<SpawnBoundedResult> {
  if (options.signal?.aborted) {
    throw new ProofDeadlineError('Proof phase aborted: signal already aborted');
  }

  const startTime = Date.now();
  const capture = Boolean(options.capture);
  const maxBytes = options.maxBytes ?? 65536;
  const eofGraceMs = options.eofGraceMs ?? 5000;

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  const onChunk = (chunk: Uint8Array) => {
    if (totalBytes < maxBytes) {
      const take = Math.min(chunk.length, maxBytes - totalBytes);
      chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, take));
      totalBytes += take;
    }
  };

  const spawnConfig: Parameters<typeof Bun.spawn>[1] = {
    cwd: options.cwd,
    env: options.env,
    stdin: 'ignore',
    windowsHide: options.windowsHide ?? true,
    killSignal: 'SIGKILL',
    stdout: capture ? 'pipe' : 'ignore',
    stderr: capture ? 'pipe' : 'ignore',
  };

  let child: ProofSubprocess;
  try {
    child = Bun.spawn(argv, spawnConfig) as unknown as ProofSubprocess;
  } catch (err) {
    if (options.signal?.aborted) {
      throw new ProofDeadlineError(
        'Proof phase aborted: signal aborted during spawn'
      );
    }
    throw err;
  }

  const stdoutReader =
    capture && child.stdout
      ? new BoundedStreamReader(
          child.stdout as unknown as { getReader(): MinimalStreamReader },
          onChunk
        )
      : null;
  const stderrReader =
    capture && child.stderr
      ? new BoundedStreamReader(
          child.stderr as unknown as { getReader(): MinimalStreamReader },
          onChunk
        )
      : null;

  let timedOut = false;
  let timeoutTimer: NodeJS.Timeout | undefined;
  if (options.timeoutMs && options.timeoutMs > 0) {
    timeoutTimer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {}
    }, options.timeoutMs);
  }

  let aborted = false;
  let abortHandler: (() => void) | null = null;
  if (options.signal) {
    abortHandler = () => {
      aborted = true;
      try {
        child.kill('SIGKILL');
      } catch {}
    };
    options.signal.addEventListener('abort', abortHandler, { once: true });
  }

  let exitCode: number | null = null;
  try {
    exitCode = await child.exited;
  } finally {
    clearTimeout(timeoutTimer);
    if (options.signal && abortHandler) {
      options.signal.removeEventListener('abort', abortHandler);
    }
  }

  if (aborted || options.signal?.aborted) {
    if (stdoutReader) await stdoutReader.cancel();
    if (stderrReader) await stderrReader.cancel();
    throw new ProofDeadlineError('Proof phase aborted: deadline exceeded');
  }

  let pipeRetained = false;
  if (capture && (stdoutReader || stderrReader)) {
    const eofPromise = Promise.all([
      stdoutReader ? stdoutReader.wait() : Promise.resolve(),
      stderrReader ? stderrReader.wait() : Promise.resolve(),
    ]);

    const { promise: graceTimeoutPromise, resolve: resolveGrace } =
      Promise.withResolvers<'timeout'>();
    const graceTimer = setTimeout(() => resolveGrace('timeout'), eofGraceMs);

    const winner = await Promise.race([
      eofPromise.then(() => 'eof'),
      graceTimeoutPromise,
    ]);
    clearTimeout(graceTimer);

    if (winner === 'timeout') {
      pipeRetained = true;
      if (stdoutReader) await stdoutReader.cancel();
      if (stderrReader) await stderrReader.cancel();
    }
  }

  const output = Buffer.concat(chunks).toString('utf8');
  const elapsed = Date.now() - startTime;

  return {
    exitCode,
    timedOut,
    aborted: false,
    pipeRetained,
    output,
    ms: elapsed,
    pid: child.pid,
  };
}

export interface BoundedChild {
  readonly pid: number;
  readonly exitCode: number | null;
  readonly timedOut: boolean;
  readonly exited: Promise<number | null>;
  kill(signal?: number | string): void;
  waitBounded(): Promise<SpawnBoundedResult>;
  readonly child: ProofSubprocess;
}

export function startBounded(
  argv: string[],
  options: SpawnBoundedOptions = {}
): BoundedChild {
  if (options.signal?.aborted) {
    throw new ProofDeadlineError('Proof phase aborted: signal already aborted');
  }

  const startTime = Date.now();
  const capture = Boolean(options.capture);
  const maxBytes = options.maxBytes ?? 65536;
  const eofGraceMs = options.eofGraceMs ?? 5000;

  const chunks: Buffer[] = [];
  let totalBytes = 0;

  const onChunk = (chunk: Uint8Array) => {
    if (totalBytes < maxBytes) {
      const take = Math.min(chunk.length, maxBytes - totalBytes);
      chunks.push(Buffer.from(chunk.buffer, chunk.byteOffset, take));
      totalBytes += take;
    }
  };

  const spawnConfig: Parameters<typeof Bun.spawn>[1] = {
    cwd: options.cwd,
    env: options.env,
    stdin: 'ignore',
    windowsHide: options.windowsHide ?? true,
    killSignal: 'SIGKILL',
    stdout: capture ? 'pipe' : 'ignore',
    stderr: capture ? 'pipe' : 'ignore',
  };

  const child = Bun.spawn(argv, spawnConfig) as unknown as ProofSubprocess;

  const stdoutReader =
    capture && child.stdout
      ? new BoundedStreamReader(
          child.stdout as unknown as { getReader(): MinimalStreamReader },
          onChunk
        )
      : null;
  const stderrReader =
    capture && child.stderr
      ? new BoundedStreamReader(
          child.stderr as unknown as { getReader(): MinimalStreamReader },
          onChunk
        )
      : null;

  let timedOut = false;
  let timeoutTimer: NodeJS.Timeout | undefined;
  if (options.timeoutMs && options.timeoutMs > 0) {
    timeoutTimer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill('SIGKILL');
      } catch {}
    }, options.timeoutMs);
  }

  let aborted = false;
  let abortHandler: (() => void) | null = null;
  if (options.signal) {
    abortHandler = () => {
      aborted = true;
      try {
        child.kill('SIGKILL');
      } catch {}
    };
    options.signal.addEventListener('abort', abortHandler, { once: true });
  }

  const exitedPromise: Promise<number | null> = (async () => {
    try {
      const code = await child.exited;
      return code;
    } finally {
      clearTimeout(timeoutTimer);
      if (options.signal && abortHandler) {
        options.signal.removeEventListener('abort', abortHandler);
      }
    }
  })();

  const waitBounded = async (): Promise<SpawnBoundedResult> => {
    const exitCode = await exitedPromise;

    if (aborted || options.signal?.aborted) {
      if (stdoutReader) await stdoutReader.cancel();
      if (stderrReader) await stderrReader.cancel();
      throw new ProofDeadlineError('Proof phase aborted: deadline exceeded');
    }

    let pipeRetained = false;
    if (capture && (stdoutReader || stderrReader)) {
      const eofPromise = Promise.all([
        stdoutReader ? stdoutReader.wait() : Promise.resolve(),
        stderrReader ? stderrReader.wait() : Promise.resolve(),
      ]);

      const { promise: graceTimeoutPromise, resolve: resolveGrace } =
        Promise.withResolvers<'timeout'>();
      const graceTimer = setTimeout(() => resolveGrace('timeout'), eofGraceMs);

      const winner = await Promise.race([
        eofPromise.then(() => 'eof'),
        graceTimeoutPromise,
      ]);
      clearTimeout(graceTimer);

      if (winner === 'timeout') {
        pipeRetained = true;
        if (stdoutReader) await stdoutReader.cancel();
        if (stderrReader) await stderrReader.cancel();
      }
    }

    const output = Buffer.concat(chunks).toString('utf8');
    const elapsed = Date.now() - startTime;

    return {
      exitCode,
      timedOut,
      aborted: false,
      pipeRetained,
      output,
      ms: elapsed,
      pid: child.pid,
    };
  };

  return {
    get pid() {
      return child.pid;
    },
    get exitCode() {
      return child.exitCode;
    },
    get timedOut() {
      return timedOut;
    },
    exited: exitedPromise,
    kill(signal = 'SIGKILL') {
      try {
        child.kill(signal);
      } catch {}
    },
    waitBounded,
    child,
  };
}

export interface CancellableSleepPromise extends Promise<void> {
  cancel(): void;
}

export function abortableSleep(
  ms: number,
  signal?: AbortSignal
): CancellableSleepPromise {
  let cancelCallback = () => {};
  const sleepPromise = (async () => {
    if (signal?.aborted) {
      throw new ProofDeadlineError(
        'Proof phase aborted: signal already aborted'
      );
    }
    if (!signal) {
      await Bun.sleep(ms);
      return;
    }
    const { promise, resolve, reject } = Promise.withResolvers<void>();
    let timer: NodeJS.Timeout | undefined;
    let settled = false;

    const cleanup = () => {
      settled = true;
      clearTimeout(timer);
      signal.removeEventListener('abort', onAbort);
    };

    const onAbort = () => {
      if (settled) return;
      cleanup();
      reject(new ProofDeadlineError('Proof phase aborted: deadline exceeded'));
    };

    timer = setTimeout(() => {
      if (settled) return;
      cleanup();
      resolve();
    }, ms);

    cancelCallback = () => {
      if (settled) return;
      cleanup();
      resolve();
    };

    signal.addEventListener('abort', onAbort, { once: true });
    await promise;
  })();

  const cancellable = sleepPromise as CancellableSleepPromise;
  cancellable.cancel = () => cancelCallback();
  return cancellable;
}

export async function waitFor<T>(
  label: string,
  probe: () =>
    | Promise<T | null | undefined | false>
    | T
    | null
    | undefined
    | false,
  signal?: AbortSignal,
  boundMs = 60000
): Promise<T> {
  if (signal?.aborted) {
    throw new ProofDeadlineError(
      `Proof phase aborted before waiting for ${label}`
    );
  }
  const deadline = Date.now() + boundMs;
  do {
    if (signal?.aborted) {
      throw new ProofDeadlineError(
        `Proof phase aborted while waiting for ${label}`
      );
    }
    const result = await probe();
    if (result !== undefined && result !== null && result !== false) {
      return result;
    }
    const remaining = deadline - Date.now();
    if (remaining <= 0) break;
    await abortableSleep(Math.min(200, remaining), signal);
  } while (Date.now() < deadline);

  if (signal?.aborted) {
    throw new ProofDeadlineError(
      `Proof phase aborted while waiting for ${label}`
    );
  }
  throw new Error(`Timed out waiting for ${label}`);
}

export function findPowershell(): string {
  if (process.platform === 'win32') {
    const systemRoot =
      process.env.SystemRoot || process.env.SYSTEMROOT || 'C:\\Windows';
    const candidate = join(
      systemRoot,
      'System32',
      'WindowsPowerShell',
      'v1.0',
      'powershell.exe'
    );
    if (existsSync(candidate)) return candidate;
    return 'powershell.exe';
  }
  return 'pwsh';
}

function buildSweepScript(targetRoots: string[]): string {
  const rootLiterals = targetRoots
    .map((r) => `'${r.replace(/'/g, "''")}'`)
    .join(', ');
  return `
$ErrorActionPreference = 'SilentlyContinue'
$rawRoots = @(${rootLiterals})
if ($rawRoots.Count -eq 0) {
    [Console]::Out.WriteLine('{"terminated":0,"remaining":0}')
    exit 0
}

$targets = @()
foreach ($r in $rawRoots) {
    if ($r) {
        $full = [System.IO.Path]::GetFullPath($r)
        if (-not $full.EndsWith('\\')) { $full += '\\' }
        $targets += $full
    }
}

function Test-InTargetRoot([string]$path) {
    if (-not $path) { return $false }
    $fullPath = [System.IO.Path]::GetFullPath($path)
    foreach ($t in $targets) {
        if ($fullPath.StartsWith($t, [System.StringComparison]::OrdinalIgnoreCase)) {
            return $true
        }
    }
    return $false
}

$terminatedCount = 0
$seenPids = @{}
for ($iter = 0; $iter -lt 10; $iter++) {
    $matched = @(Get-Process | Where-Object {
        try {
            if ($_.Path) {
                Test-InTargetRoot $_.Path
            } else { $false }
        } catch { $false }
    })
    if ($matched.Count -eq 0) { break }
    foreach ($p in $matched) {
        if (-not $seenPids.ContainsKey($p.Id)) {
            $seenPids[$p.Id] = $true
            $terminatedCount++
        }
        try {
            Stop-Process -InputObject $p -Force -ErrorAction SilentlyContinue
        } catch {}
    }
    Start-Sleep -Milliseconds 100
}

$remaining = @(Get-Process | Where-Object {
    try {
        if ($_.Path) {
            Test-InTargetRoot $_.Path
        } else { $false }
    } catch { $false }
}).Count

[Console]::Out.WriteLine(([ordered]@{ terminated = $terminatedCount; remaining = $remaining } | ConvertTo-Json -Compress))
`.trim();
}

export interface SweepResult {
  terminated: number;
  remaining: number;
}

function parseSweepOutput(output: string): SweepResult {
  const lines = output.split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        if (
          typeof parsed.terminated === 'number' &&
          typeof parsed.remaining === 'number' &&
          Number.isSafeInteger(parsed.terminated) &&
          Number.isSafeInteger(parsed.remaining)
        ) {
          return {
            terminated: parsed.terminated,
            remaining: parsed.remaining,
          };
        }
      } catch {}
    }
  }
  throw new Error('Failed to parse sweep output');
}

const ALLOWED_SWEEP_PREFIXES = [
  'han-windows-installed-',
  'han-bounds-',
] as const;

function hasAllowedSweepPrefix(pathStr: string): boolean {
  const base = basename(pathStr).toLowerCase();
  return ALLOWED_SWEEP_PREFIXES.some((prefix) => base.startsWith(prefix));
}

export function validateSweepRoots(root: string): string[] {
  if (!root || typeof root !== 'string' || root.trim().length === 0) {
    throw new Error('Refusing to sweep: root path must be a non-empty string');
  }
  const resolved = resolve(root);
  const parsed = parse(resolved);
  if (
    resolved === parsed.root ||
    resolved.toLowerCase() === 'c:\\windows' ||
    resolved.toLowerCase().startsWith('c:\\windows\\')
  ) {
    throw new Error(`Refusing to sweep protected root: ${resolved}`);
  }

  if (!hasAllowedSweepPrefix(resolved)) {
    throw new Error(
      `Refusing to sweep: directory basename "${basename(resolved)}" does not start with an allowed prefix (${ALLOWED_SWEEP_PREFIXES.join(', ')})`
    );
  }

  if (!existsSync(resolved)) {
    throw new Error(
      `Refusing to sweep: root directory does not exist: ${resolved}`
    );
  }

  const roots = new Set<string>();
  roots.add(resolved);

  if (process.platform === 'win32') {
    let native: string;
    try {
      native = realpathSync.native(resolved);
    } catch (err) {
      throw new Error(
        `Refusing to sweep: failed to resolve native path for ${resolved}: ${err instanceof Error ? err.message : String(err)}`
      );
    }
    const parsedNative = parse(native);
    if (
      native === parsedNative.root ||
      native.toLowerCase() === 'c:\\windows' ||
      native.toLowerCase().startsWith('c:\\windows\\')
    ) {
      throw new Error(`Refusing to sweep protected native root: ${native}`);
    }
    if (!hasAllowedSweepPrefix(native)) {
      throw new Error(
        `Refusing to sweep: canonical native directory basename "${basename(native)}" does not start with an allowed prefix (${ALLOWED_SWEEP_PREFIXES.join(', ')})`
      );
    }
    roots.add(native);
  }

  return Array.from(roots);
}

export async function sweepRoot(
  root: string,
  timeoutMs = 30000
): Promise<SweepResult> {
  if (process.platform !== 'win32') {
    return { terminated: 0, remaining: 0 };
  }
  const targetRoots = validateSweepRoots(root);
  const powershell = findPowershell();
  const script = buildSweepScript(targetRoots);

  const result = await spawnBounded(
    [powershell, '-NoProfile', '-NonInteractive', '-Command', script],
    {
      timeoutMs,
      capture: true,
      windowsHide: true,
    }
  );

  if (result.aborted) {
    throw new ProofDeadlineError('Sweep aborted: deadline exceeded');
  }
  if (result.timedOut) {
    throw new ProofSubprocessTimeout('Sweep subprocess timed out');
  }
  if (result.pipeRetained) {
    throw new ProofOutputRetained('Sweep output handle retained');
  }
  if (result.exitCode !== 0) {
    throw new Error(`Sweep subprocess exited with code ${result.exitCode}`);
  }

  return parseSweepOutput(result.output);
}

export function sweepRootSync(root: string, timeoutMs = 15000): SweepResult {
  if (process.platform !== 'win32') {
    return { terminated: 0, remaining: 0 };
  }
  const targetRoots = validateSweepRoots(root);
  const powershell = findPowershell();
  const script = buildSweepScript(targetRoots);

  const res = spawnSync(
    powershell,
    ['-NoProfile', '-NonInteractive', '-Command', script],
    {
      timeout: timeoutMs,
      encoding: 'utf8',
      windowsHide: true,
      stdio: ['ignore', 'pipe', 'ignore'],
    }
  );

  if (res.error) {
    throw res.error;
  }
  if (res.status !== 0) {
    throw new Error(`sweepRootSync failed with exit status ${res.status}`);
  }

  return parseSweepOutput(res.stdout || '');
}
