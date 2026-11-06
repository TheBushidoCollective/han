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
  renameSync,
  rmSync,
  statSync,
} from 'node:fs';
import { dirname, join } from 'node:path';
import { getHanDataDir } from '../../config/claude-settings.ts';
import { getHanBinary } from '../../config/han-settings.ts';
import { readCoordinatorDescriptor } from '../../coordinator/connection.ts';
import { createCoordinatorClients } from '../../grpc/client.ts';
import { checkHealth, waitForHealth } from './health.ts';
import {
  claimStillOwned,
  claimSupervisorPid,
  readSupervisorPid,
  releaseSupervisorPid,
  type SupervisorClaim,
} from './pid-claim.ts';
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

const claims = new Map<string, SupervisorClaim>();

function readPid(): number | null {
  return readSupervisorPid(getPidFilePath());
}

export function claimPidFile(): number | null {
  const path = getPidFilePath();
  const existing = claims.get(path);
  if (existing && !existing.released) {
    if (!claimStillOwned(existing))
      throw new Error('Supervisor claim no longer belongs to this process');
    return null;
  }
  const result = claimSupervisorPid(path);
  if (result.kind === 'blocked') return result.pid;
  claims.set(path, result.claim);
  return null;
}

function releaseClaim(claim: SupervisorClaim): void {
  if (claims.get(claim.pidPath) === claim) claims.delete(claim.pidPath);
  releaseSupervisorPid(claim);
}

/**
 * Check if a process is running
 */
function isProcessRunning(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return false;
    if ((error as NodeJS.ErrnoException).code === 'EPERM') return true;
    throw error;
  }
}

/** Get coordinator status without changing supervisor ownership. */
export async function getStatus(port?: number): Promise<CoordinatorStatus> {
  const effectivePort = port ?? getCoordinatorPort();
  const health = await checkHealth(effectivePort);

  if (health?.status === 'ok') {
    return {
      running: true,
      pid: health.pid,
      port: readCoordinatorDescriptor().httpsPort,
      uptime: health.uptime,
    };
  }

  // A supervisor PID file is not proof of daemon identity.

  // Check if PID file exists with a running process
  const pid = readPid();
  if (pid && isProcessRunning(pid)) {
    return {
      running: false, // Not responding but process exists
      pid,
      port: effectivePort,
    };
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
    spawnCommand = process.platform === 'win32' ? 'cmd.exe' : '/bin/bash';
    spawnArgs = [
      process.platform === 'win32' ? '/c' : '-c',
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

/** Stop only a coordinator authenticated by its runtime descriptor. */
export async function stopDaemon(port?: number): Promise<void> {
  const status = await getStatus(port);
  if (!status.running) return;
  const descriptor = readCoordinatorDescriptor();
  const supervisorPid = readPid();
  await createCoordinatorClients().coordinator.shutdown({
    graceful: true,
    timeoutSeconds: 5,
  });
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    let descriptorGone = false;
    try {
      const current = readCoordinatorDescriptor();
      if (current.instanceId !== descriptor.instanceId) {
        throw new Error('A different coordinator appeared during shutdown');
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        descriptorGone = true;
      else throw error;
    }
    const supervisorGone =
      !supervisorPid ||
      readPid() !== supervisorPid ||
      !isProcessRunning(supervisorPid);
    if (descriptorGone && supervisorGone) return;
    await Bun.sleep(100);
  }
  throw new Error(
    'Coordinator shutdown did not release its descriptor and supervisor'
  );
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
  const claim = claims.get(getPidFilePath());
  if (!claim) throw new Error('Supervisor claim disappeared');

  rotateLogIfNeeded();

  let shuttingDown = false;

  // Setup signal handlers
  const shutdown = () => {
    shuttingDown = true;
    console.log('\n[coordinator] Shutting down...');
    stopServer();
    releaseClaim(claim);
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

  try {
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
          releaseClaim(claim);
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
          try {
            if (!(await checkHealth(port))) {
              releaseClaim(claim);
              return;
            }
          } catch {
            releaseClaim(claim);
            return;
          }
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
          releaseClaim(claim);
          process.exit(1);
        }

        console.log(
          `[coordinator] Restarting in ${Math.round(currentDelay / 1000)}s...`
        );
        await new Promise((r) => setTimeout(r, currentDelay));
        currentDelay *= RESTART_BACKOFF_MULTIPLIER;
      }
    }
  } finally {
    releaseClaim(claim);
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
