/**
 * Coordinator Lifecycle Manager
 *
 * Manages the Rust han-coordinator binary lifecycle:
 * 1. Discovery: finds the coordinator binary
 * 2. Auto-start: spawns as daemon process
 * 3. Health check: HTTPS /health probe with retry
 * 4. Shutdown: graceful stop via gRPC
 *
 * The Rust coordinator handles all internal operations:
 * file watching, JSONL indexing, SQLite, FTS, subscriptions.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { Code, ConnectError } from '@connectrpc/connect';
import { checkHealth } from '../commands/coordinator/health.ts';
import { readShutdownIntent } from '../commands/coordinator/shutdown-intent.ts';
import { getHanDataDir } from '../config/claude-settings.ts';
import {
  CoordinatorSecurityError,
  getCoordinatorDataDir,
  type LocalCoordinatorDescriptor,
  sameCoordinator,
  sameSupervisor,
  type SupervisorBinding,
  readCoordinatorDescriptor,
} from '../coordinator/connection.ts';
import { createCoordinatorClients } from '../grpc/client.ts';

async function isCoordinatorServing(port: number): Promise<boolean> {
  return Boolean(await checkHealth(port));
}

const DEFAULT_PORT = 41957;

/**
 * Get the han version from package.json
 */
const getHanVersion = (): string => {
  try {
    const pkg = require('../../package.json');
    return pkg.version || '0.0.0';
  } catch {
    return '0.0.0';
  }
};

export const COORDINATOR_VERSION = getHanVersion();

/**
 * Coordinator service state
 */
interface CoordinatorState {
  isRunning: boolean;
  version: string;
  process: Bun.Subprocess | null;
  port: number;
  ownedDescriptor: LocalCoordinatorDescriptor | null;
  /**
   * True only when *this* process actually spawned the coordinator (the
   * Bun.spawn call succeeded and the resulting process is tracked in
   * `process`). False on the "attach" path, where an already-healthy
   * coordinator started by someone else was simply found and connected to.
   * Only an owner may send it a shutdown; see stopCoordinatorService.
   */
  ownsProcess: boolean;
}

const state: CoordinatorState = {
  isRunning: false,
  version: COORDINATOR_VERSION,
  process: null,
  port: DEFAULT_PORT,
  ownedDescriptor: null,
  ownsProcess: false,
};

export type CoordinatorStartResult =
  | { kind: 'owned'; child: Bun.Subprocess; descriptor: LocalCoordinatorDescriptor }
  | { kind: 'attached' }
  | { kind: 'shutdown-requested'; child: Bun.Subprocess; descriptor: LocalCoordinatorDescriptor };

/**
 * Get the effective coordinator port.
 * Reads HAN_COORDINATOR_PORT at call time (set by server.ts before startup).
 */
function getEffectivePort(): number {
  const port = Number.parseInt(process.env.HAN_COORDINATOR_PORT ?? '', 10);
  return Number.isNaN(port) ? state.port : port;
}

// ============================================================================
// Binary Discovery
// ============================================================================

/**
 * Find the han-coordinator binary.
 * Search order:
 * 0. Local Rust build output (dev mode only)
 * 1. ~/.han/bin/han-coordinator
 * 2. npm platform package bundled binary
 * 3. PATH
 */
function findCoordinatorBinary(): string | null {
  const home = process.env.HOME || process.env.USERPROFILE || '/tmp';
  const binaryName =
    process.platform === 'win32' ? 'han-coordinator.exe' : 'han-coordinator';
  try {
    const sibling = join(dirname(realpathSync(process.execPath)), binaryName);
    if (existsSync(sibling)) return sibling;
  } catch {
    // Executable path not resolvable
  }

  // 0. Local Rust build (dev mode: running from .ts source)
  const mainFile = process.argv[1] || '';
  if (mainFile.endsWith('.ts') || mainFile.endsWith('.tsx')) {
    // packages/han/lib/services/ -> packages/han-rs/target/
    const pkgRoot = resolve(import.meta.dir, '..', '..', '..');
    for (const profile of ['release', 'debug']) {
      const localBin = join(pkgRoot, 'han-rs', 'target', profile, binaryName);
      if (existsSync(localBin)) return localBin;
    }
  }

  // 1. ~/.han/bin/han-coordinator
  const hanBin = join(home, '.han', 'bin', binaryName);
  if (existsSync(hanBin)) return hanBin;

  // 2. npm platform package
  // Resolve via package.json since the binary has no extension and
  // can't be loaded as a sub-path module via require.resolve directly.
  const arch = process.arch;
  const platform = process.platform;
  try {
    const pkgName = `@thebushidocollective/han-${platform}-${arch}`;
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
    const pkgPath = join(dirname(pkgJsonPath), binaryName);
    if (existsSync(pkgPath)) return pkgPath;
  } catch {
    // Package not installed
  }

  // 3. PATH lookup via which/where
  try {
    const result = Bun.spawnSync(
      [process.platform === 'win32' ? 'where' : 'which', binaryName],
      { stdout: 'pipe', stderr: 'ignore' }
    );
    if (result.exitCode === 0) {
      const path = result.stdout.toString().trim();
      if (path && existsSync(path)) return path;
    }
  } catch {
    // Not in PATH
  }

  return null;
}

// ============================================================================
// Health Check with Retry
// ============================================================================

const DEFAULT_HEALTH_BUDGET_MS = 30_000;

/**
 * Get the health check budget in milliseconds. Overridable via
 * HAN_COORDINATOR_HEALTH_BUDGET_MS for tests / fast-fail callers.
 */
function getHealthBudgetMs(): number {
  return (
    parseInt(process.env.HAN_COORDINATOR_HEALTH_BUDGET_MS || '', 10) ||
    DEFAULT_HEALTH_BUDGET_MS
  );
}

/**
 * Wait for coordinator to become healthy.
 * First start can be slow: TLS cert generation + --scan-on-start over a
 * large han.db can take 10-30s. Use exponential backoff capped at 2s, with
 * a configurable overall budget (default 30s, override via
 * HAN_COORDINATOR_HEALTH_BUDGET_MS for tests / fast-fail callers).
 */
async function waitForHealthy(
  port: number,
  budgetMs = getHealthBudgetMs()
): Promise<boolean> {
  const deadline = Date.now() + budgetMs;
  let delay = 100;
  while (Date.now() < deadline) {
    if (await checkHealth(port, true)) {
      return true;
    }
    await Bun.sleep(Math.min(delay, deadline - Date.now()));
    delay = Math.min(delay * 2, 2000);
  }
  return false;
}

// ============================================================================
// Cross-Process Spawn Guard
// ============================================================================

/**
 * How long a claimed spawn guard is honored before it is considered
 * abandoned. Kept comfortably above the default health budget (30s) so a
 * guard never goes stale while its owner is still legitimately inside
 * waitForHealthy.
 */
const SPAWN_GUARD_STALE_MS = 60_000;

/** Filename of the cross-process spawn guard, under getHanDataDir(). */
const SPAWN_GUARD_FILENAME = 'coordinator.spawn.lock';

interface SpawnGuardInfo {
  pid: number;
  timestamp: string;
}

function isPidAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function readSpawnGuard(guardPath: string): SpawnGuardInfo | null {
  try {
    const parsed = JSON.parse(readFileSync(guardPath, 'utf-8'));
    if (
      parsed &&
      typeof parsed.pid === 'number' &&
      typeof parsed.timestamp === 'string'
    ) {
      return parsed as SpawnGuardInfo;
    }
  } catch {
    // Missing, unreadable, or malformed — treated as "no usable guard".
  }
  return null;
}

function isSpawnGuardStale(info: SpawnGuardInfo): boolean {
  if (!isPidAlive(info.pid)) return true;
  const ageMs = Date.now() - Date.parse(info.timestamp);
  return !(ageMs >= 0 && ageMs < SPAWN_GUARD_STALE_MS);
}

/** Atomically create the guard file. Returns false if it already exists. */
function writeSpawnGuard(guardPath: string): boolean {
  try {
    writeFileSync(
      guardPath,
      JSON.stringify({
        pid: process.pid,
        timestamp: new Date().toISOString(),
      }),
      { flag: 'wx' }
    );
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') {
      return false;
    }
    throw error;
  }
}

/**
 * Atomically claim the cross-process spawn guard.
 *
 * N simultaneous `han` invocations can each pass the isCoordinatorServing
 * check in startCoordinatorService and each spawn their own han-coordinator
 * against the same (potentially multi-GB) database. Only the caller that
 * claims this guard actually spawns; everyone else falls through to
 * waitForHealthy instead. Returns true if this call now owns the guard.
 */
function claimSpawnGuard(): boolean {
  const guardPath = join(getHanDataDir(), SPAWN_GUARD_FILENAME);
  try {
    mkdirSync(dirname(guardPath), { recursive: true });
  } catch {
    // If the directory truly can't be created, the writeFileSync below
    // will surface the real error instead of a misleading guard failure.
  }

  if (writeSpawnGuard(guardPath)) return true;

  const existing = readSpawnGuard(guardPath);
  if (existing && !isSpawnGuardStale(existing)) {
    return false;
  }

  // Stale, unreadable, or malformed guard — take it over. A concurrent
  // claimant may win the race on the write below; that's fine, exactly one
  // of us proceeds.
  try {
    unlinkSync(guardPath);
  } catch {
    // Already gone, or another process just removed it first.
  }
  return writeSpawnGuard(guardPath);
}

/**
 * Release the spawn guard, but only if this process still owns it. A guard
 * file whose recorded pid isn't ours belongs to whoever took it over (or
 * claimed it after we went stale) and must never be unlinked out from under
 * them.
 */
function releaseSpawnGuard(): void {
  const guardPath = join(getHanDataDir(), SPAWN_GUARD_FILENAME);
  const existing = readSpawnGuard(guardPath);
  if (existing?.pid === process.pid) {
    try {
      unlinkSync(guardPath);
    } catch {
      // Nothing to clean up.
    }
  }
}

/**
 * Read the Rust coordinator's own advisory lock (~/.han/coordinator.lock,
 * see han-rs/crates/han-coordinator/src/lock.rs) and return its pid if it
 * names a live process. Best-effort: the lock is owned by the Rust binary,
 * we only ever read it here to make a health-check failure message
 * actionable ("is there already a live-but-unresponsive incumbent?").
 */
function readIncumbentCoordinatorPid(): number | null {
  try {
    const lockPath = join(getHanDataDir(), 'coordinator.lock');
    const parsed = JSON.parse(readFileSync(lockPath, 'utf-8'));
    if (typeof parsed?.pid === 'number' && isPidAlive(parsed.pid)) {
      return parsed.pid;
    }
  } catch {
    // No lock file, unreadable, or malformed — nothing to report.
  }
  return null;
}

/** Build an actionable error message for a failed post-spawn health check. */
function buildHealthFailureMessage(port: number, budgetMs: number): string {
  const incumbentPid = readIncumbentCoordinatorPid();
  const incumbentNote = incumbentPid
    ? ` coordinator.lock names a live pid ${incumbentPid}; it may be running but unresponsive.`
    : '';
  return (
    `[coordinator] Coordinator on port ${port} failed its health check ` +
    `after ${budgetMs}ms.${incumbentNote} See ${join(getHanDataDir(), 'coordinator.log')} for details.`
  );
}

// ============================================================================
// Lifecycle Management
// ============================================================================

/**
 * Start the coordinator service.
 *
 * If the coordinator is already running (another process), this just
 * verifies connectivity. Otherwise, spawns the Rust binary as a daemon.
 */
export async function startCoordinatorService(options: { supervisor?: SupervisorBinding } = {}): Promise<CoordinatorStartResult> {
  if (state.isRunning && (await isCoordinatorServing(state.port))) {
    if (state.ownsProcess && state.process && state.ownedDescriptor)
      return { kind: 'owned', child: state.process, descriptor: state.ownedDescriptor };
    return { kind: 'attached' };
  }
  state.isRunning = false;
  const port = getEffectivePort();
  if (await isCoordinatorServing(port)) {
    state.isRunning = true;
    state.port = port;
    state.ownsProcess = false;
    state.ownedDescriptor = null;
    return { kind: 'attached' };
  }

  // Find the binary
  const binaryPath = findCoordinatorBinary();
  if (!binaryPath) {
    throw new Error('[coordinator] han-coordinator binary not found');
  }

  // Cross-process spawn guard. An unhealthy coordinator doesn't mean no one
  // else is racing to start one right now: every simultaneous `han`
  // invocation just passed the same isCoordinatorServing check above and is
  // about to spawn its own han-coordinator against the same database. Only
  // the process that claims this guard spawns; everyone else waits on
  // health instead of piling on more processes.
  if (!claimSpawnGuard()) {
    console.log(
      '[coordinator] Another process is already starting the coordinator, waiting for it to become healthy...'
    );
    const budgetMs = getHealthBudgetMs();
    const healthy = await waitForHealthy(port, budgetMs);
    if (healthy) {
      state.isRunning = true;
      state.port = port;
      state.ownsProcess = false;
      state.ownedDescriptor = null;
      console.log('[coordinator] Coordinator started and healthy');
    } else {
      throw new Error(buildHealthFailureMessage(port, budgetMs));
    }
    return { kind: 'attached' };
  }

  try {
    console.log(`[coordinator] Starting ${binaryPath} on port ${port}`);

    // The daemon creates an ephemeral certificate and publishes its public descriptor.
    state.ownedDescriptor = null;
    try {
      // Keep the actual daemon as our child so ownership and shutdown remain reliable.
      state.process = Bun.spawn(
        [
          binaryPath,
          '--foreground',
          '--port',
          String(port),
          '--data-dir',
          getCoordinatorDataDir(),
          '--scan-on-start',
          ...(options.supervisor ? [
            '--supervisor-pid', String(options.supervisor.pid),
            '--supervisor-nonce', options.supervisor.nonce,
            '--supervisor-generation', options.supervisor.generationId,
          ] : []),
        ],
        {
          stdout: 'ignore',
          stderr: 'ignore',
        }
      );
      // Don't keep parent alive
      state.process.unref();
      state.ownsProcess = true;

      const child = state.process;
      const budgetMs = getHealthBudgetMs();
      const deadline = Date.now() + budgetMs;
      let delay = 100;
      const stopping = () => options.supervisor
        ? readShutdownIntent(options.supervisor, child.pid, state.ownedDescriptor ?? undefined)
        : null;
      while (Date.now() < deadline) {
        let intent = stopping();
        if (intent) return { kind: 'shutdown-requested', child, descriptor: intent };
        let healthy = false;
        try {
          healthy = Boolean(await checkHealth(port, true));
        } catch (error) {
          intent = stopping();
          if (intent) return { kind: 'shutdown-requested', child, descriptor: intent };
          throw error;
        }
        intent = stopping();
        if (intent) return { kind: 'shutdown-requested', child, descriptor: intent };
        if (healthy) {
          const descriptor = readCoordinatorDescriptor();
          if (descriptor.pid !== child.pid || child.exitCode !== null) {
            if (child.exitCode === null) child.kill();
            state.process = null;
            state.ownsProcess = false;
            state.isRunning = true;
            state.port = port;
            return { kind: 'attached' };
          }
          if (!sameSupervisor(descriptor.supervisor, options.supervisor ?? null))
            throw new CoordinatorSecurityError('Coordinator supervisor binding mismatch');
          state.ownedDescriptor = descriptor;
          state.isRunning = true;
          state.port = port;
          return { kind: 'owned', child, descriptor };
        }
        if (child.exitCode !== null) break;
        await Bun.sleep(Math.min(delay, Math.max(0, deadline - Date.now())));
        delay = Math.min(delay * 2, 2000);
      }
      const intent = stopping();
      if (intent) return { kind: 'shutdown-requested', child, descriptor: intent };
      throw new Error(buildHealthFailureMessage(port, budgetMs));
    } catch (error) {
      if (options.supervisor && state.process) {
        const intent = readShutdownIntent(options.supervisor, state.process.pid, state.ownedDescriptor ?? undefined);
        if (intent) return { kind: 'shutdown-requested', child: state.process, descriptor: intent };
      }
      if (state.ownsProcess && state.process) {
        const child = state.process;
        try {
          if (child.exitCode === null) child.kill();
          await child.exited;
        } catch {
          /* Child already exited. */
        }
        if (options.supervisor) {
          const intent = readShutdownIntent(options.supervisor, child.pid, state.ownedDescriptor ?? undefined);
          if (intent) return { kind: 'shutdown-requested', child, descriptor: intent };
        }
      }
      state.process = null;
      state.ownsProcess = false;
      throw error;
    }
  } finally {
    releaseSpawnGuard();
  }
}

/**
 * Stop the coordinator service.
 * Sends graceful shutdown via gRPC, falls back to process kill.
 *
 * Only sends the shutdown when this process actually owns the coordinator
 * process (i.e. it spawned it). On the attach path — where an
 * already-healthy coordinator started by someone else was simply connected
 * to — tearing it down here would kill a coordinator every other attached
 * `han` invocation is relying on.
 */
export async function stopCoordinatorService(): Promise<void> {
  if (!state.isRunning) return;

  state.isRunning = false;

  if (!state.ownsProcess) {
    state.ownedDescriptor = null;
    state.process = null;
    console.log(
      '[coordinator] Detached (did not own the coordinator process; leaving it running)'
    );
    return;
  }

  const owned = state.ownedDescriptor;
  let current: LocalCoordinatorDescriptor | null = null;
  try {
    current = readCoordinatorDescriptor();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
      state.process = null;
      state.ownsProcess = false;
      state.ownedDescriptor = null;
      throw error;
    }
  }
  if (
    !owned ||
    !current ||
    !sameCoordinator(current, owned) ||
    !state.process ||
    state.process.exitCode !== null
  ) {
    state.process = null;
    state.ownsProcess = false;
    state.ownedDescriptor = null;
    return;
  }
  try {
    const clients = createCoordinatorClients(state.port, owned);
    await clients.coordinator.shutdown({
      graceful: true,
      timeoutSeconds: 5,
    });
    console.log('[coordinator] Graceful shutdown sent');
  } catch (error) {
    if (
      error instanceof CoordinatorSecurityError ||
      (error instanceof ConnectError &&
        (error.code === Code.Unauthenticated ||
          error.code === Code.PermissionDenied))
    ) {
      state.process = null;
      state.ownsProcess = false;
      state.ownedDescriptor = null;
      throw error;
    }
    // A lost response can follow a committed shutdown. Never kill that child
    // or discard the intent that the supervisor must finish consuming.
    const committed = owned.supervisor && state.process
      ? readShutdownIntent(owned.supervisor, state.process.pid, owned)
      : null;
    if (!committed && state.process) {
      state.process.kill();
      console.log('[coordinator] Process killed');
    }
  }

  state.process = null;
  state.ownsProcess = false;
  state.ownedDescriptor = null;
  console.log('[coordinator] Service stopped');
}

/**
 * Check if coordinator is currently running and healthy.
 */
export function isCoordinatorInstance(): boolean {
  return state.isRunning;
}

/**
 * Get the current coordinator version.
 */
export function getCoordinatorVersion(): string {
  return state.version;
}

/**
 * Get coordinator status via gRPC.
 */
export async function getCoordinatorStatus() {
  const clients = createCoordinatorClients(state.port);
  return clients.coordinator.status({});
}

/**
 * Compare semantic versions.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
  const partsA = a.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const partsB = b.split('.').map((p) => Number.parseInt(p, 10) || 0);

  for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
    const partA = partsA[i] || 0;
    const partB = partsB[i] || 0;
    if (partA < partB) return -1;
    if (partA > partB) return 1;
  }
  return 0;
}

/**
 * Check if a client version is newer than the coordinator.
 * If so, schedule a coordinator restart.
 */
export function checkClientVersion(clientVersion: string): boolean {
  if (!state.isRunning) return false;

  const cmp = compareVersions(clientVersion, state.version);
  if (cmp > 0) {
    console.log(
      `[coordinator] Client version ${clientVersion} > coordinator version ${state.version}, scheduling restart`
    );
    // Schedule restart after a short delay
    setTimeout(async () => {
      try {
        console.log('[coordinator] Restarting for version upgrade...');
        await stopCoordinatorService();
        await startCoordinatorService();
      } catch (err) {
        console.error(
          '[coordinator] Failed to restart for version upgrade:',
          err
        );
      }
    }, 1000);
    return true;
  }
  return false;
}

/**
 * Trigger indexing of a file via gRPC.
 */
export async function indexFile(filePath: string): Promise<void> {
  if (!state.isRunning) {
    console.log('[coordinator] Not running, skipping index');
    return;
  }

  try {
    const clients = createCoordinatorClients(state.port);
    await clients.indexer.indexFile({ filePath });
  } catch (error) {
    console.error(`[coordinator] Failed to index ${filePath}:`, error);
  }
}

/**
 * Ensure coordinator is running, auto-starting if needed.
 * Returns true if coordinator is available.
 */
export async function ensureCoordinator(): Promise<boolean> {
  if (state.isRunning && (await isCoordinatorServing(state.port))) {
    return true;
  }

  await startCoordinatorService();
  return state.isRunning;
}
