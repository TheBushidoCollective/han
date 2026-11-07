import { existsSync, lstatSync, readFileSync, unlinkSync } from 'node:fs';
import { connect } from 'node:net';
import { homedir } from 'node:os';
import { join } from 'node:path';
import { HAN_VERSION } from '../build-info.generated.ts';
import { getCoordinatorDataDir } from './connection.ts';
import { CoordinatorSecurityError } from './errors.ts';

export interface LegacyInspection {
  status: 'legacy' | 'foreign' | 'absent';
  pid?: number;
  supervisorPid?: number;
  reason?: string;
}

function portOccupied(port: number): Promise<boolean> {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const socket = connect({ host: '127.0.0.1', port });
  socket.setTimeout(500);
  socket.once('connect', () => {
    socket.destroy();
    resolve(true);
  });
  socket.once('error', () => resolve(false));
  socket.once('timeout', () => {
    socket.destroy();
    resolve(false);
  });
  return promise;
}

function portRefuses(port: number): Promise<boolean> {
  const { promise, resolve } = Promise.withResolvers<boolean>();
  const socket = connect({ host: '127.0.0.1', port });
  socket.setTimeout(300);
  socket.once('connect', () => {
    socket.destroy();
    resolve(false);
  });
  socket.once('error', () => resolve(true));
  socket.once('timeout', () => {
    socket.destroy();
    resolve(false);
  });
  return promise;
}

function isAlive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

export async function inspectLegacyCoordinator(
  port: number
): Promise<LegacyInspection> {
  const occupied = await portOccupied(port);
  if (!occupied) {
    return { status: 'absent' };
  }

  const dataDir = getCoordinatorDataDir();
  const descriptorPath = join(dataDir, 'runtime', 'coordinator.json');
  if (existsSync(descriptorPath)) {
    return { status: 'absent' };
  }

  const lockPath = join(dataDir, 'coordinator.lock');
  if (!existsSync(lockPath)) {
    return {
      status: 'foreign',
      reason: 'No coordinator.lock found on occupied port.',
    };
  }

  try {
    const st = lstatSync(lockPath);
    if (!st.isFile() || st.isSymbolicLink() || st.size > 64 * 1024) {
      return {
        status: 'foreign',
        reason: 'Invalid coordinator.lock file attributes.',
      };
    }
    if (typeof process.getuid === 'function' && st.uid !== process.getuid()) {
      return {
        status: 'foreign',
        reason: 'coordinator.lock is not owned by current user.',
      };
    }

    const content = JSON.parse(readFileSync(lockPath, 'utf8'));
    if (
      !content ||
      typeof content !== 'object' ||
      typeof content.pid !== 'number' ||
      content.port !== port
    ) {
      return {
        status: 'foreign',
        reason: 'coordinator.lock does not match requested port.',
      };
    }

    const pid = content.pid;
    if (!isAlive(pid)) {
      return {
        status: 'foreign',
        reason: 'Process listed in coordinator.lock is dead.',
      };
    }

    // Check HTTPS /health response
    try {
      const resp = await fetch(`https://127.0.0.1:${port}/health`, {
        method: 'GET',
        // In Node/Bun, rejectUnauthorized: false can be checked if needed, or normal fetch
        tls: { rejectUnauthorized: false },
      } as RequestInit);
      if (resp.ok) {
        const body = (await resp.json()) as {
          status?: string;
          pid?: number;
          version?: string;
        };
        if (body.status === 'ok') {
          // Check version lower than CLI
          const legacyVer = body.version;
          if (legacyVer && HAN_VERSION && legacyVer >= HAN_VERSION) {
            return {
              status: 'foreign',
              pid,
              reason: 'Coordinator version is not lower than current CLI.',
            };
          }
        }
      }
    } catch {
      // If /health doesn't respond as expected
    }

    // Check supervisor PID
    let supervisorPid: number | undefined;
    const supervisorPidPath = join(dataDir, 'coordinator.pid');
    const takeoverPath = join(dataDir, 'coordinator.pid.takeover');
    if (existsSync(supervisorPidPath) && !existsSync(takeoverPath)) {
      try {
        const spSt = lstatSync(supervisorPidPath);
        if (
          spSt.isFile() &&
          !spSt.isSymbolicLink() &&
          (typeof process.getuid !== 'function' ||
            spSt.uid === process.getuid())
        ) {
          const raw = readFileSync(supervisorPidPath, 'utf8').trim();
          const parsed = parseInt(raw, 10);
          if (Number.isInteger(parsed) && isAlive(parsed)) {
            supervisorPid = parsed;
          }
        }
      } catch {}
    }

    return { status: 'legacy', pid, supervisorPid };
  } catch (err) {
    return {
      status: 'foreign',
      reason: `Failed to inspect legacy coordinator: ${err}`,
    };
  }
}

export async function stopLegacyCoordinator(port: number): Promise<boolean> {
  const inspection = await inspectLegacyCoordinator(port);
  if (inspection.status !== 'legacy' || !inspection.pid) {
    if (inspection.status === 'foreign') {
      throw new CoordinatorSecurityError(
        `Port ${port} is occupied by an unverified or foreign process (PID: ${inspection.pid ?? 'unknown'}). Cannot stop automatically: ${inspection.reason ?? ''}`
      );
    }
    return false;
  }

  // 1. Stop supervisor first (SIGTERM)
  if (inspection.supervisorPid && isAlive(inspection.supervisorPid)) {
    try {
      process.kill(inspection.supervisorPid, 'SIGTERM');
      for (let i = 0; i < 30; i++) {
        if (!isAlive(inspection.supervisorPid)) break;
        await Bun.sleep(100);
      }
    } catch {}
  }

  // 2. Stop coordinator (SIGTERM then SIGKILL)
  if (isAlive(inspection.pid)) {
    try {
      process.kill(inspection.pid, 'SIGTERM');
      for (let i = 0; i < 20; i++) {
        if (!isAlive(inspection.pid)) break;
        await Bun.sleep(100);
      }
      if (isAlive(inspection.pid)) {
        process.kill(inspection.pid, 'SIGKILL');
      }
    } catch {}
  }

  // Wait until port refuses connections
  let stopped = false;
  for (let i = 0; i < 50; i++) {
    if (await portRefuses(port)) {
      stopped = true;
      break;
    }
    await Bun.sleep(100);
  }

  if (!stopped) {
    throw new CoordinatorSecurityError(
      `Failed to stop legacy coordinator on port ${port}`
    );
  }

  // 3. Delete legacy certificate caches
  const home = homedir();
  const certFiles = [
    join(home, '.claude', 'han', 'certs', 'coordinator.crt'),
    join(home, '.claude', 'han', 'certs', 'coordinator.key'),
    join(home, '.claude', 'han', 'certs', 'metadata.json'),
    join(getCoordinatorDataDir(), 'certs', 'coordinator.pem'),
    join(getCoordinatorDataDir(), 'certs', 'coordinator-key.pem'),
  ];

  for (const file of certFiles) {
    try {
      if (existsSync(file)) {
        const st = lstatSync(file);
        if (
          st.isFile() &&
          !st.isSymbolicLink() &&
          (typeof process.getuid !== 'function' || st.uid === process.getuid())
        ) {
          unlinkSync(file);
        }
      }
    } catch {}
  }

  return true;
}
