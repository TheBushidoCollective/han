/**
 * Coordinator Daemon Management
 *
 * Handles starting the coordinator as a background daemon,
 * managing PID files, and process lifecycle.
 */

import { spawn } from 'node:child_process';
import {
  closeSync,
  existsSync,
  mkdirSync,
  openSync,
  readFileSync,
  renameSync,
  rmSync,
  statSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { getHanDataDir } from '../../config/claude-settings.ts';
import { getHanBinary } from '../../config/han-settings.ts';
import { checkHealth, waitForHealth } from './health.ts';
import { startServer, stopServer } from './server.ts';
import {
  type CoordinatorOptions,
  type CoordinatorStatus,
  getCoordinatorPort,
} from './types.ts';

/**
 * Get the log file path (~/.han/coordinator.log)
 */
export function getLogFilePath(): string {
  return join(getHanDataDir(), 'coordinator.log');
}

/**
 * Get the PID file path (~/.han/coordinator.pid)
 */
function getPidFilePath(): string {
  return join(getHanDataDir(), 'coordinator.pid');
}

/**
 * Rotate the coordinator log once it exceeds this size. A spawn storm can
 * turn a single restart-attempt message into megabytes of repeated lines;
 * rotating keeps the file bounded instead of growing forever.
 */
export const LOG_ROTATE_THRESHOLD_BYTES = 5 * 1024 * 1024;

/**
 * Rotate ~/.han/coordinator.log to coordinator.log.1 if it has grown past
 * the threshold. Called before the log stream is opened, both from the
 * background daemon spawn path and from the foreground path. Best effort:
 * a rotation failure must never prevent the coordinator from starting.
 */
export function rotateLogIfNeeded(): void {
  try {
    const logPath = getLogFilePath();
    const logDir = dirname(logPath);
    if (!existsSync(logDir)) {
      mkdirSync(logDir, { recursive: true });
    }
    if (!existsSync(logPath)) return;
    if (statSync(logPath).size <= LOG_ROTATE_THRESHOLD_BYTES) return;

    const rotatedPath = `${logPath}.1`;
    if (existsSync(rotatedPath)) {
      rmSync(rotatedPath, { force: true });
    }
    renameSync(logPath, rotatedPath);
  } catch (error) {
    if (process.env.HAN_DEBUG) {
      console.error('[coordinator] Log rotation failed:', error);
    }
  }
}

/**
 * Read PID from file
 */
function readPid(): number | null {
  const pidPath = getPidFilePath();
  try {
    if (existsSync(pidPath)) {
      const pid = parseInt(readFileSync(pidPath, 'utf-8').trim(), 10);
      return Number.isNaN(pid) ? null : pid;
    }
  } catch {
    // Ignore errors
  }
  return null;
}

/**
 * How long a takeover marker is honored before it is treated as abandoned.
 */
const TAKEOVER_MARKER_STALE_MS = 5000;

/**
 * Claim the supervisor PID file for this process, atomically.
 *
 * Returns the live pid already holding it, or null once we own it.
 *
 * A plain read-then-write loses the race it exists to win: several
 * `han coordinator start --foreground` invocations landing together all read
 * an empty file, all conclude they are first, and all sit in the keep-alive
 * loop forever. An exclusive create has exactly one winner.
 *
 * Taking over a dead holder's file needs its own serialization, because
 * "unlink what I just saw" can delete a file a fresh winner created a
 * moment ago, and then two callers both believe they won. So the removal
 * runs behind an exclusively created marker: only one caller ever removes a
 * stale file, and a caller that wins the pid file by fast path in that
 * window simply blocks the marker holder instead.
 *
 * Exported so the concurrency behaviour can be tested across real processes.
 */
export function claimPidFile(): number | null {
  const pidPath = getPidFilePath();
  const markerPath = `${pidPath}.takeover`;

  for (let attempt = 0; attempt < 5; attempt++) {
    if (tryCreateExclusive(pidPath, String(process.pid))) return null;

    const holder = readPid();
    if (holder === process.pid) return null;
    if (holder && isProcessRunning(holder)) return holder;

    // The file names a dead pid, or holds nothing readable. Serialize the
    // takeover so only one caller removes it.
    if (!tryCreateExclusive(markerPath, String(process.pid))) {
      clearStaleMarker(markerPath);
      Bun.sleepSync(25);
      continue;
    }

    try {
      const current = readPid();
      const revived =
        current && current !== process.pid && isProcessRunning(current);
      if (!revived) {
        try {
          unlinkSync(pidPath);
        } catch {
          // Already gone.
        }
      }
    } finally {
      try {
        unlinkSync(markerPath);
      } catch {
        // Already gone.
      }
    }
  }

  const holder = readPid();
  return holder && holder !== process.pid ? holder : null;
}

/**
 * Create `path` with `contents` only if it does not exist yet. Returns
 * whether this call created it.
 */
function tryCreateExclusive(path: string, contents: string): boolean {
  try {
    writeFileSync(path, contents, { encoding: 'utf-8', flag: 'wx' });
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'EEXIST') return false;
    throw error;
  }
}

/**
 * Drop a takeover marker whose owner died or which is simply too old to
 * still be meaningful, so a crash mid-takeover cannot wedge every later
 * claim.
 */
function clearStaleMarker(markerPath: string): void {
  try {
    const owner = parseInt(readFileSync(markerPath, 'utf-8').trim(), 10);
    const ageMs = Date.now() - statSync(markerPath).mtimeMs;
    if (
      ageMs > TAKEOVER_MARKER_STALE_MS ||
      (!Number.isNaN(owner) && !isProcessRunning(owner))
    ) {
      unlinkSync(markerPath);
    }
  } catch {
    // Missing or unreadable marker: nothing to clear.
  }
}

/**
 * Remove the PID file. Owner-checked by default: a supervisor that lost the
 * claim race must never delete the winner's file on its way out. `stopDaemon`
 * passes force after killing the holder, since the pid it names is gone.
 */
function removePidFile(force = false): void {
  const pidPath = getPidFilePath();
  try {
    if (existsSync(pidPath) && (force || readPid() === process.pid)) {
      unlinkSync(pidPath);
    }
  } catch {
    // Ignore errors
  }
}

/**
 * Check if a process is running
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get coordinator status
 * Automatically cleans up stale locks (dead process or old heartbeat)
 */
export async function getStatus(port?: number): Promise<CoordinatorStatus> {
  const effectivePort = port ?? getCoordinatorPort();
  const health = await checkHealth(effectivePort);

  if (health?.status === 'ok') {
    return {
      running: true,
      pid: health.pid,
      port: effectivePort,
      uptime: health.uptime,
    };
  }

  // Health check failed - try to clean up stale locks
  try {
    await import('../../grpc/data-access.ts');
    // In gRPC architecture, stale lock cleanup is handled by the Rust coordinator
    removePidFile();
    return {
      running: false,
      port: effectivePort,
    };
  } catch (error) {
    // gRPC data access not available or error - fall back to PID check
    if (process.env.HAN_DEBUG) {
      console.error('[coordinator] Failed to cleanup stale lock:', error);
    }
  }

  // Check if PID file exists with a running process
  const pid = readPid();
  if (pid && isProcessRunning(pid)) {
    return {
      running: false, // Not responding but process exists
      pid,
      port: effectivePort,
    };
  }

  // Clean up stale PID file
  if (pid && !isProcessRunning(pid)) {
    removePidFile(true);
  }

  return {
    running: false,
    port: effectivePort,
  };
}

/**
 * Start coordinator daemon in background
 */
export async function startDaemon(
  options: CoordinatorOptions = {}
): Promise<CoordinatorStatus> {
  const port = options.port ?? getCoordinatorPort();
  console.log(`[coordinator] Using port: ${port}`);

  // Check if already running
  const status = await getStatus(port);
  if (status.running) {
    console.log(`[coordinator] Already running (PID: ${status.pid})`);
    return status;
  }

  // Clean up stale PID file
  const stalePid = readPid();
  if (stalePid && !isProcessRunning(stalePid)) {
    removePidFile(true);
  }

  // Run in foreground mode
  if (options.foreground) {
    console.log('[coordinator] Starting in foreground mode...');
    await runForeground(port);
    return { running: true, pid: process.pid, port };
  }

  // Spawn daemon process
  console.log('[coordinator] Starting daemon...');

  // Setup log file for daemon output
  rotateLogIfNeeded();
  const logPath = getLogFilePath();
  const logDir = dirname(logPath);
  if (!existsSync(logDir)) {
    mkdirSync(logDir, { recursive: true });
  }

  // Open log file for appending (Bun requires fd, not stream)
  const logFd = openSync(logPath, 'a');

  // Use configured hanBinary (respects han.yml for development overrides)
  // Falls back to process.execPath for compiled binaries
  const configuredBinary = getHanBinary();
  let spawnCommand: string;
  let spawnArgs: string[];

  if (configuredBinary && configuredBinary !== 'han') {
    // hanBinary is set (e.g., `bun "/path/to/main.ts"`)
    // Use shell to handle the full command string
    spawnCommand = '/bin/bash';
    spawnArgs = [
      '-c',
      `${configuredBinary} coordinator start --foreground --port ${port}`,
    ];
  } else {
    // Use the current binary (compiled or han from PATH)
    spawnCommand = process.execPath;
    spawnArgs = [
      'coordinator',
      'start',
      '--foreground',
      '--port',
      String(port),
    ];
  }

  const child = spawn(spawnCommand, spawnArgs, {
    detached: true,
    stdio: ['ignore', logFd, logFd],
    env: {
      ...process.env,
      HAN_COORDINATOR_DAEMON: '1',
    },
  });

  // Close the fd in parent process after spawn
  closeSync(logFd);

  child.unref();

  // Wait for daemon to start
  // Timeout is configurable via HAN_COORDINATOR_TIMEOUT (default: 60s)
  // Increased from 30s to handle slow disks and heavy I/O
  const timeoutMs = parseInt(
    process.env.HAN_COORDINATOR_TIMEOUT || '60000',
    10
  );
  const healthy = await waitForHealth(port, timeoutMs, 100);

  if (!healthy) {
    throw new Error(
      `Coordinator failed to start within ${timeoutMs / 1000}s timeout. ` +
        `Set HAN_COORDINATOR_TIMEOUT to increase (milliseconds).`
    );
  }

  const newStatus = await getStatus(port);
  console.log(`[coordinator] Started (PID: ${newStatus.pid})`);
  return newStatus;
}

/**
 * Find PID of process listening on a port (fallback when health check has no PID).
 */
function findPidOnPort(port: number): number | null {
  try {
    const result = Bun.spawnSync(['lsof', '-ti', `tcp:${port}`], {
      stdout: 'pipe',
      stderr: 'ignore',
    });
    if (result.exitCode === 0) {
      const pids = result.stdout
        .toString()
        .trim()
        .split('\n')
        .map((s) => parseInt(s, 10))
        .filter((n) => !Number.isNaN(n) && n > 0);
      return pids[0] ?? null;
    }
  } catch {
    // lsof not available
  }
  return null;
}

/**
 * Kill a process by PID with graceful shutdown and forced kill fallback.
 */
async function killProcess(pid: number): Promise<void> {
  try {
    process.kill(pid, 'SIGTERM');

    // Wait for process to stop
    let attempts = 0;
    while (attempts < 50 && isProcessRunning(pid)) {
      await new Promise((resolve) => setTimeout(resolve, 100));
      attempts++;
    }

    // Force kill if still running
    if (isProcessRunning(pid)) {
      console.log('[coordinator] Force killing...');
      process.kill(pid, 'SIGKILL');
    }
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ESRCH') {
      throw error;
    }
  }
}

/**
 * Stop coordinator daemon
 */
export async function stopDaemon(port?: number): Promise<void> {
  const effectivePort = port ?? getCoordinatorPort();
  const status = await getStatus(effectivePort);

  if (!status.running && !status.pid) {
    console.log('[coordinator] Not running');
    removePidFile();
    return;
  }

  // Resolve the PID: prefer health response, then PID file, then port scan
  const pid = status.pid ?? readPid() ?? findPidOnPort(effectivePort);

  if (pid) {
    console.log(`[coordinator] Stopping (PID: ${pid})...`);
    await killProcess(pid);
  } else if (status.running) {
    // Health check says running but we can't find the PID at all
    console.warn(
      '[coordinator] Running but PID unknown. Trying port-based kill...'
    );
    const portPid = findPidOnPort(effectivePort);
    if (portPid) {
      await killProcess(portPid);
    } else {
      console.error(
        `[coordinator] Could not find process on port ${effectivePort}. ` +
          `Try: lsof -ti tcp:${effectivePort} | xargs kill -9`
      );
    }
  }

  // The supervisor this named has just been killed, so its file is ours to
  // clear even though we never owned it.
  removePidFile(true);
  console.log('[coordinator] Stopped');
}

// Constants for auto-restart
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_DELAY_MS = 2000;
const RESTART_BACKOFF_MULTIPLIER = 1.5;

/**
 * Run coordinator in foreground with auto-restart on crash
 */
async function runForeground(port: number): Promise<void> {
  // One supervisor per machine, claimed atomically. Without the exclusive
  // create, every concurrent invocation reads an empty PID file, decides it
  // is first, clobbers the file and idles forever even once a healthy
  // coordinator is up under a different pid.
  const holderPid = claimPidFile();
  if (holderPid !== null) {
    console.log(
      `[coordinator] Another coordinator supervisor is already running (PID: ${holderPid}). Exiting.`
    );
    return;
  }

  rotateLogIfNeeded();

  let shuttingDown = false;

  // Setup signal handlers
  const shutdown = () => {
    shuttingDown = true;
    console.log('\n[coordinator] Shutting down...');
    stopServer();
    removePidFile();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Catch uncaught exceptions to allow restart
  process.on('uncaughtException', (error) => {
    console.error('[coordinator] Uncaught exception:', error);
    // Don't exit - let the restart loop handle it
  });

  process.on('unhandledRejection', (reason) => {
    console.error('[coordinator] Unhandled rejection:', reason);
    // Don't exit - let the restart loop handle it
  });

  // Auto-restart loop
  let restartAttempts = 0;
  let currentDelay = RESTART_DELAY_MS;

  while (!shuttingDown) {
    try {
      // Start server
      await startServer({ port });

      // startServer resolving is not proof the coordinator is reachable:
      // startCoordinatorService swallows a failed spawn or health check
      // into a logged error instead of throwing, so without this check a
      // silent no-op "success" fell straight into the keep-alive loop below
      // with no coordinator ever listening on the port.
      const timeoutMs = parseInt(
        process.env.HAN_COORDINATOR_TIMEOUT || '60000',
        10
      );
      const healthy = await waitForHealth(port, timeoutMs, 100);
      if (!healthy) {
        console.error(
          `[coordinator] Coordinator on port ${port} never became reachable ` +
            `within ${timeoutMs / 1000}s. See ${getLogFilePath()} for details.`
        );
        removePidFile();
        process.exit(1);
      }

      console.log('[coordinator] Running. Press Ctrl+C to stop.');

      // Reset restart attempts on successful start
      restartAttempts = 0;
      currentDelay = RESTART_DELAY_MS;

      // Keep process alive until shutdown signal
      // Use a simple polling approach that properly exits
      while (!shuttingDown) {
        const { promise, resolve } = Promise.withResolvers<void>();
        setTimeout(resolve, 1000);
        await promise;
      }
    } catch (error) {
      if (shuttingDown) break;

      restartAttempts++;
      console.error(
        `[coordinator] Server crashed (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}):`,
        error
      );

      if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
        console.error('[coordinator] Max restart attempts reached. Exiting.');
        removePidFile();
        process.exit(1);
      }

      console.log(
        `[coordinator] Restarting in ${Math.round(currentDelay / 1000)}s...`
      );
      await new Promise((r) => setTimeout(r, currentDelay));
      currentDelay *= RESTART_BACKOFF_MULTIPLIER;
    }
  }
}

/**
 * Ensure coordinator is running
 * Starts it lazily if not already running
 *
 * @returns Status of the coordinator
 */
export async function ensureCoordinator(
  port?: number
): Promise<CoordinatorStatus> {
  const effectivePort = port ?? getCoordinatorPort();
  const status = await getStatus(effectivePort);

  if (status.running) {
    return status;
  }

  console.log('[coordinator] Starting coordinator daemon...');
  return startDaemon({ port: effectivePort });
}
