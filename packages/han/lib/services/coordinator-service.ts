/**
 * Coordinator Lifecycle Manager
 *
 * Manages the Rust han-coordinator binary lifecycle:
 * 1. Discovery: finds the coordinator binary
 * 2. Auto-start: spawns as daemon process
 * 3. Health check: gRPC health probe with retry
 * 4. Shutdown: graceful stop via gRPC
 *
 * The Rust coordinator handles all internal operations:
 * file watching, JSONL indexing, SQLite, FTS, subscriptions.
 */

import {
  existsSync,
  mkdirSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { getHanDataDir } from '../config/claude-settings.ts';
import {
  createCoordinatorClients,
  isCoordinatorHealthy,
} from '../grpc/client.ts';
import { ensureCertificates } from '../commands/coordinator/tls.ts';

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
  ownsProcess: false,
};

/**
 * Get the effective coordinator port.
 * Reads HAN_COORDINATOR_PORT at call time (set by server.ts before startup).
 */
function getEffectivePort(): number {
  return parseInt(process.env.HAN_COORDINATOR_PORT || '', 10) || state.port;
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

  // 0. Local Rust build (dev mode: running from .ts source)
  const mainFile = process.argv[1] || '';
  if (mainFile.endsWith('.ts') || mainFile.endsWith('.tsx')) {
    // packages/han/lib/services/ -> packages/han-rs/target/
    const pkgRoot = resolve(import.meta.dir, '..', '..', '..');
    for (const profile of ['release', 'debug']) {
      const localBin = join(
        pkgRoot,
        'han-rs',
        'target',
        profile,
        'han-coordinator'
      );
      if (existsSync(localBin)) return localBin;
    }
  }

  // 1. ~/.han/bin/han-coordinator
  const hanBin = join(home, '.han', 'bin', 'han-coordinator');
  if (existsSync(hanBin)) return hanBin;

  // 2. npm platform package
  // Resolve via package.json since the binary has no extension and
  // can't be loaded as a sub-path module via require.resolve directly.
  const arch = process.arch;
  const platform = process.platform;
  try {
    const pkgName = `@thebushidocollective/han-${platform}-${arch}`;
    const pkgJsonPath = require.resolve(`${pkgName}/package.json`);
    const pkgPath = join(dirname(pkgJsonPath), 'han-coordinator');
    if (existsSync(pkgPath)) return pkgPath;
  } catch {
    // Package not installed
  }

  // 3. PATH lookup via which/where
  try {
    const result = Bun.spawnSync(
      [process.platform === 'win32' ? 'where' : 'which', 'han-coordinator'],
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
    if (await isCoordinatorHealthy(port, 2000)) {
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
 * N simultaneous `han` invocations can each pass the isCoordinatorHealthy
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
export async function startCoordinatorService(): Promise<void> {
  if (state.isRunning) {
    console.log('[coordinator] Already running');
    return;
  }

  const port = getEffectivePort();

  // Check if coordinator is already running (from another process)
  if (await isCoordinatorHealthy(port)) {
    console.log('[coordinator] Coordinator already running, connecting...');
    state.isRunning = true;
    state.port = port;
    state.ownsProcess = false;
    return;
  }

  // Find the binary
  const binaryPath = findCoordinatorBinary();
  if (!binaryPath) {
    console.error(
      '[coordinator] han-coordinator binary not found. ' +
        'Install via: curl -fsSL https://han.guru/install.sh | bash'
    );
    return;
  }

  // Cross-process spawn guard. An unhealthy coordinator doesn't mean no one
  // else is racing to start one right now: every simultaneous `han`
  // invocation just passed the same isCoordinatorHealthy check above and is
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
      console.log('[coordinator] Coordinator started and healthy');
    } else {
      console.error(buildHealthFailureMessage(port, budgetMs));
    }
    return;
  }

  try {
    console.log(`[coordinator] Starting ${binaryPath} on port ${port}`);

    // Cache real Let's Encrypt certificates before the Rust binary reads them.
    // han-coordinator only *reads* ~/.claude/han/certs and self-signs when that
    // cache is empty, and a self-signed cert is one the dashboard's browser
    // refuses, leaving it stuck on "Connecting to Han Coordinator...". Fetching
    // is best-effort: on failure the coordinator still starts, just self-signed.
    const credentials = await ensureCertificates();
    if (!credentials) {
      console.error(
        '[coordinator] No trusted certificate available; the dashboard may not ' +
          'be able to connect. Falling back to a self-signed certificate.'
      );
    }

    try {
      // Spawn Rust coordinator binary (daemonizes by default, no --daemon flag)
      state.process = Bun.spawn(
        [binaryPath, '--port', String(port), '--scan-on-start'],
        {
          stdout: 'ignore',
          stderr: 'ignore',
        }
      );
      // Don't keep parent alive
      state.process.unref();
      state.ownsProcess = true;

      // Wait for it to become healthy
      const budgetMs = getHealthBudgetMs();
      const healthy = await waitForHealthy(port, budgetMs);
      if (healthy) {
        state.isRunning = true;
        state.port = port;
        console.log('[coordinator] Coordinator started and healthy');
      } else {
        // Don't leak an orphaned child running a full --scan-on-start against
        // a multi-GB database; kill it before dropping the handle.
        try {
          state.process?.kill();
        } catch {
          // Best-effort — process may have already exited.
        }
        console.error(buildHealthFailureMessage(port, budgetMs));
        state.process = null;
        state.ownsProcess = false;
      }
    } catch (error) {
      console.error('[coordinator] Failed to start coordinator:', error);
      state.process = null;
      state.ownsProcess = false;
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
    state.process = null;
    console.log(
      '[coordinator] Detached (did not own the coordinator process; leaving it running)'
    );
    return;
  }

  try {
    const clients = createCoordinatorClients(state.port);
    await clients.coordinator.shutdown({
      graceful: true,
      timeoutSeconds: 5,
    });
    console.log('[coordinator] Graceful shutdown sent');
  } catch {
    // If gRPC shutdown fails, kill the process directly
    if (state.process) {
      state.process.kill();
      console.log('[coordinator] Process killed');
    }
  }

  state.process = null;
  state.ownsProcess = false;
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
      console.log('[coordinator] Restarting for version upgrade...');
      await stopCoordinatorService();
      await startCoordinatorService();
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
  if (state.isRunning && (await isCoordinatorHealthy(state.port))) {
    return true;
  }

  await startCoordinatorService();
  return state.isRunning;
}
