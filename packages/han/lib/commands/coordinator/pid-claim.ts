import {
  closeSync,
  constants,
  fstatSync,
  openSync,
  readFileSync,
} from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import {
  CoordinatorSecurityError,
  getCoordinatorDataDir,
} from '../../coordinator/connection.ts';
import {
  type PosixClaim,
  posixAcquire,
  posixCheck,
  posixPrepare,
  posixReadSupervisor,
  posixRelease,
} from '../../coordinator/recovery-runtime.ts';
import {
  type WindowsClaim,
  type WindowsProcessIdentity,
  windowsAcquire,
  windowsCheck,
  windowsReadSupervisor,
  windowsRelease,
} from '../../coordinator/windows-runtime.ts';

export type SupervisorClaim =
  | {
      readonly kind: 'unix';
      readonly pidPath: string;
      readonly nonce: string;
      readonly native: PosixClaim;
      released: boolean;
    }
  | {
      readonly kind: 'windows';
      readonly pidPath: string;
      readonly nonce: string;
      readonly native: WindowsClaim;
      released: boolean;
    };
export type ClaimResult =
  | { kind: 'owned'; claim: SupervisorClaim }
  | { kind: 'blocked'; pid: number };
export class SupervisorReservationBusyError extends Error {}

function dataDir(path: string): string {
  const resolved = resolve(path);
  if (process.platform === 'win32') {
    const dir = getCoordinatorDataDir();
    if (resolved !== join(dir, 'coordinator.pid'))
      throw new CoordinatorSecurityError('Invalid supervisor target');
    return dir;
  }
  if (resolved !== join(dirname(resolved), 'coordinator.pid'))
    throw new CoordinatorSecurityError('Invalid supervisor target');
  return dirname(resolved);
}

/** Read-only status never creates runtime state. */
export function readSupervisorPid(path: string): number | null {
  if (process.platform === 'win32')
    return readSupervisorIdentity(path)?.pid ?? null;
  let fd: number;
  try {
    fd = openSync(
      resolve(path),
      constants.O_RDONLY | (constants.O_NOFOLLOW || 0)
    );
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
  try {
    const s = fstatSync(fd);
    if (
      !s.isFile() ||
      s.uid !== process.getuid?.() ||
      (s.mode & 0o022) !== 0 ||
      s.size > 65536
    )
      throw new CoordinatorSecurityError('Insecure supervisor PID file');
    const text = readFileSync(fd, 'utf8').trim();
    if (!/^[1-9]\d*$/.test(text)) throw new Error('Malformed supervisor PID');
    const pid = Number(text);
    if (!Number.isSafeInteger(pid) || pid > 0x7fffffff)
      throw new Error('Invalid supervisor PID');
    return pid;
  } finally {
    closeSync(fd);
  }
}
export function readSupervisorIdentity(
  path: string
): { pid: number; nonce: string; process?: WindowsProcessIdentity } | null {
  const result =
    process.platform === 'win32'
      ? windowsReadSupervisor(dataDir(path))
      : posixReadSupervisor(dataDir(path));
  if (result.status === 'recoverable')
    throw new SupervisorReservationBusyError(
      'Supervisor reservation is incomplete'
    );
  if (result.status === 'absent') return null;
  return {
    pid: result.pid,
    nonce: result.nonce,
    ...('process' in result ? { process: result.process } : {}),
  };
}
export function claimStillOwned(claim: SupervisorClaim): boolean {
  if (claim.released) return false;
  return claim.kind === 'windows'
    ? windowsCheck(dataDir(claim.pidPath), claim.native) === 'owned'
    : posixCheck(dataDir(claim.pidPath), claim.native) === 'owned';
}
export function claimSupervisorPid(path: string): ClaimResult {
  const pidPath = resolve(path);
  const dir = dataDir(pidPath);
  if (process.platform === 'win32') {
    const result = windowsAcquire(dir, 'supervisor');
    if (result.status === 'blocked')
      return { kind: 'blocked', pid: result.ownerPid };
    return {
      kind: 'owned',
      claim: {
        kind: 'windows',
        pidPath,
        nonce: result.claim.nonce,
        native: result.claim,
        released: false,
      },
    };
  }
  posixPrepare(dir);
  const result = posixAcquire(dir);
  if (result.status === 'blocked')
    return { kind: 'blocked', pid: result.ownerPid };
  return {
    kind: 'owned',
    claim: {
      kind: 'unix',
      pidPath,
      nonce: result.claim.nonce,
      native: result.claim,
      released: false,
    },
  };
}
export function releaseSupervisorPid(claim: SupervisorClaim): void {
  if (claim.released) return;
  if (claim.kind === 'windows')
    windowsRelease(dataDir(claim.pidPath), 'supervisor', claim.native);
  else if (posixRelease(dataDir(claim.pidPath), claim.native) === 'changed')
    throw new CoordinatorSecurityError('Supervisor ownership changed');
  claim.released = true;
}
