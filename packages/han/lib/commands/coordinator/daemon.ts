/**
 * Coordinator Daemon Management
 *
 * Handles starting the coordinator as a background daemon,
 * managing PID files, and process lifecycle.
 */

import { spawn } from 'node:child_process';
import { randomUUID } from 'node:crypto';
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
import {
  CoordinatorSecurityError,
  type LocalCoordinatorDescriptor,
  readCoordinatorDescriptor,
  type SupervisorBinding,
  sameCoordinator,
} from '../../coordinator/connection.ts';
import { createCoordinatorClients } from '../../grpc/client.ts';
import { checkHealth, waitForHealth } from './health.ts';
import {
  claimStillOwned,
  claimSupervisorPid,
  readSupervisorIdentity,
  readSupervisorPid,
  releaseSupervisorPid,
  type SupervisorClaim,
  SupervisorReservationBusyError,
} from './pid-claim.ts';
import { startServer, stopServer } from './server.ts';
import { readShutdownIntent, removeShutdownIntent } from './shutdown-intent.ts';
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
export async function stopDaemon(_port?: number): Promise<void> {
  let descriptor: LocalCoordinatorDescriptor;
  try {
    descriptor = readCoordinatorDescriptor();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code !== 'ENOENT') throw error;
    if (readSupervisorIdentity(getPidFilePath()))
      throw new Error(
        'Coordinator supervisor is running or starting without an available descriptor'
      );
    return;
  }
  const binding = descriptor.supervisor;
  if (binding) {
    const identity = readSupervisorIdentity(getPidFilePath());
    if (
      !identity ||
      identity.pid !== binding.pid ||
      identity.nonce !== binding.nonce
    )
      throw new CoordinatorSecurityError(
        'Coordinator supervisor claim does not match descriptor'
      );
  }
  await createCoordinatorClients(
    descriptor.httpsPort,
    descriptor
  ).coordinator.shutdown(
    { graceful: true, timeoutSeconds: 5 },
    { timeoutMs: 10000 }
  );
  const deadline = Date.now() + 10000;
  while (Date.now() < deadline) {
    let descriptorGone = false;
    try {
      const current = readCoordinatorDescriptor();
      if (!sameCoordinator(current, descriptor))
        throw new Error('A different coordinator appeared during shutdown');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT')
        descriptorGone = true;
      else throw error;
    }
    if (!binding) {
      if (descriptorGone) return;
    } else {
      let identity: { pid: number; nonce: string } | null;
      try {
        identity = readSupervisorIdentity(getPidFilePath());
      } catch (error) {
        if (!(error instanceof SupervisorReservationBusyError)) throw error;
        await Bun.sleep(100);
        continue;
      }
      if (
        identity &&
        (identity.pid !== binding.pid || identity.nonce !== binding.nonce)
      )
        throw new Error('A different supervisor appeared during shutdown');
      const intent = readShutdownIntent(binding, descriptor.pid, descriptor);
      if (
        descriptorGone &&
        !identity &&
        !intent &&
        !isProcessRunning(binding.pid)
      )
        return;
    }
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

  let signal = false;
  let stopping: LocalCoordinatorDescriptor | null = null;
  let binding: SupervisorBinding | null = null;
  let child: Bun.Subprocess | null = null;
  let owned: LocalCoordinatorDescriptor | undefined;
  const shutdown = () => {
    signal = true;
  };
  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);
  let restartAttempts = 0;
  let currentDelay = RESTART_DELAY_MS;

  const observeIntent = () => {
    if (binding && child) {
      const intent = readShutdownIntent(binding, child.pid, owned);
      if (intent) stopping = intent;
    }
    return stopping !== null;
  };
  const finishIntent = async () => {
    if (!binding || !child || !stopping)
      throw new Error('Missing shutdown ownership');
    await child.exited;
    removeShutdownIntent(binding, child.pid, stopping);
  };

  try {
    while (!signal) {
      if (observeIntent()) break;
      binding = {
        pid: process.pid,
        nonce: claim.nonce,
        generationId: randomUUID(),
      };
      child = null;
      owned = undefined;
      try {
        const result = await startServer({ port }, binding);
        if (result.kind === 'attached') return;
        child = result.child;
        owned = result.descriptor;
        if (result.kind === 'shutdown-requested') {
          stopping = result.descriptor;
          break;
        }
        if (observeIntent() || signal) break;
        restartAttempts = 0;
        currentDelay = RESTART_DELAY_MS;
        console.log('[coordinator] Running. Press Ctrl+C to stop.');
        while (!signal) {
          if (child.exitCode !== null)
            throw new Error('Coordinator child exited');
          if (observeIntent()) break;
          let healthy: boolean;
          try {
            healthy = (await checkHealth(port)) !== null;
          } catch (error) {
            if (observeIntent()) break;
            await Promise.race([child.exited, Bun.sleep(2000)]);
            if (observeIntent()) break;
            if (child.exitCode !== null)
              throw new Error('Coordinator child exited');
            throw error;
          }
          if (observeIntent()) break;
          if (!healthy || child.exitCode !== null)
            throw new Error('Coordinator stopped responding');
          await Bun.sleep(1000);
        }
        if (signal || observeIntent()) break;
      } catch (error) {
        if (observeIntent() || signal) break;
        if (error instanceof CoordinatorSecurityError) throw error;
        if (child && child.exitCode === null) {
          if (observeIntent()) break;
          child.kill();
          await child.exited;
          if (observeIntent()) break;
        }
        restartAttempts++;
        console.error(
          `[coordinator] Server crashed (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}):`,
          error
        );
        if (restartAttempts >= MAX_RESTART_ATTEMPTS) throw error;
        if (observeIntent()) break;
        await Bun.sleep(currentDelay);
        if (observeIntent()) break;
        currentDelay *= RESTART_BACKOFF_MULTIPLIER;
      }
    }
    if (stopping) {
      await finishIntent();
    } else if (signal && child) {
      if (observeIntent()) {
        await finishIntent();
      } else {
        await stopServer();
        if (observeIntent()) await finishIntent();
        else await child.exited;
      }
    }
  } finally {
    process.off('SIGINT', shutdown);
    process.off('SIGTERM', shutdown);
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
