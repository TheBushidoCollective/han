import { randomUUID } from 'node:crypto';
import type { Stats } from 'node:fs';
import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readFileSync,
  renameSync,
  rmdirSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import { basename, dirname, join, resolve } from 'node:path';

export interface SupervisorClaim {
  readonly pidPath: string;
  readonly reservation: string;
  readonly owner: string;
  readonly nonce: string;
  readonly device: number;
  readonly inode: number;
  released: boolean;
}
export type ClaimResult =
  | { kind: 'owned'; claim: SupervisorClaim }
  | { kind: 'blocked'; pid: number };

function missing(error: unknown): boolean {
  return (error as NodeJS.ErrnoException).code === 'ENOENT';
}
function removeIfPresent(path: string): void {
  try {
    unlinkSync(path);
  } catch (error) {
    if (!missing(error)) throw error;
  }
}
function removeCandidate(path: string, owner: string): void {
  try {
    unlinkSync(join(path, owner));
    rmdirSync(path);
  } catch (error) {
    if (!missing(error)) throw error;
  }
}
function protectedFile(
  path: string,
  allowPublicRead = false
): {
  text: string;
  device: number;
  inode: number;
} {
  const fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
  try {
    const s = fstatSync(fd);
    if (
      !s.isFile() ||
      (process.platform !== 'win32' &&
        (s.uid !== process.getuid?.() ||
          (s.mode & (allowPublicRead ? 0o022 : 0o077)) !== 0))
    )
      throw new Error(`Insecure supervisor file: ${path}`);
    return { text: readFileSync(fd, 'utf8'), device: s.dev, inode: s.ino };
  } finally {
    closeSync(fd);
  }
}
function pidValue(text: string): number {
  const trimmed = text.trim();
  if (!/^[1-9]\d*$/.test(trimmed)) throw new Error('Malformed supervisor PID');
  const pid = Number(trimmed);
  if (!Number.isSafeInteger(pid)) throw new Error('Invalid supervisor PID');
  return pid;
}
export function readSupervisorPid(path: string): number | null {
  try {
    return pidValue(protectedFile(path, true).text);
  } catch (e) {
    if (missing(e)) return null;
    throw e;
  }
}
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    if ((e as NodeJS.ErrnoException).code === 'ESRCH') return false;
    if ((e as NodeJS.ErrnoException).code === 'EPERM') return true;
    throw e;
  }
}
function inspectDirectory(path: string, privateOnly = false): void {
  const s = lstatSync(path);
  if (
    !s.isDirectory() ||
    s.isSymbolicLink() ||
    (process.platform !== 'win32' &&
      (s.uid !== process.getuid?.() ||
        (s.mode & (privateOnly ? 0o077 : 0o022)) !== 0))
  )
    throw new Error(`Insecure supervisor directory: ${path}`);
}

/** Read the protected reservation without acquiring or modifying it. */
export function readSupervisorIdentity(path: string): { pid: number; nonce: string } | null {
  if (process.platform === 'win32') throw new Error('Windows supervisor ACL and reparse-point verification is unavailable');
  const pidPath = resolve(path);
  const reservation = `${pidPath}.takeover`;
  try {
    inspectDirectory(dirname(pidPath));
    inspectDirectory(reservation, true);
    const names = readdirSync(reservation);
    if (names.length !== 1 || !/^owner\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/.test(names[0]))
      throw new Error('Invalid supervisor reservation');
    const record = JSON.parse(protectedFile(join(reservation, names[0])).text);
    if (record.version !== 1 || !Number.isSafeInteger(record.pid) || record.pid <= 0 ||
        names[0] !== `owner.${record.nonce}.json`) throw new Error('Invalid supervisor identity');
    return { pid: record.pid, nonce: record.nonce };
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
}
function reclaim(reservation: string, pidPath: string): number | null {
  let s: Stats;
  try {
    s = lstatSync(reservation);
  } catch (e) {
    if (missing(e)) return null;
    throw e;
  }
  if (s.isFile() && !s.isSymbolicLink()) {
    const pid = pidValue(protectedFile(reservation, true).text);
    if (alive(pid)) return pid;
    try {
      unlinkSync(reservation);
    } catch (e) {
      if (!missing(e) && (e as NodeJS.ErrnoException).code !== 'EISDIR')
        throw e;
    }
    return null;
  }
  let names: string[];
  try {
    inspectDirectory(reservation, true);
    names = readdirSync(reservation);
  } catch (error) {
    if (missing(error)) return null;
    throw error;
  }
  if (names.length === 0) {
    try {
      rmdirSync(reservation);
    } catch (e) {
      if (
        !missing(e) &&
        !['ENOTEMPTY', 'EEXIST'].includes(
          (e as NodeJS.ErrnoException).code ?? ''
        )
      )
        throw e;
    }
    return null;
  }
  if (names.length !== 1 || !/^owner\.[0-9a-f-]+\.json$/.test(names[0]))
    throw new Error('Invalid supervisor reservation');
  const owner = join(reservation, names[0]);
  let record: { version?: unknown; pid?: unknown; nonce?: unknown };
  try {
    record = JSON.parse(protectedFile(owner).text);
  } catch (e) {
    if (missing(e)) return null;
    throw e;
  }
  if (
    record.version !== 1 ||
    typeof record.pid !== 'number' ||
    !Number.isSafeInteger(record.pid) ||
    record.pid <= 0 ||
    typeof record.nonce !== 'string' ||
    names[0] !== `owner.${record.nonce}.json`
  )
    throw new Error('Malformed supervisor reservation');
  if (alive(record.pid)) {
    const published = readSupervisorPid(pidPath);
    return published !== null && alive(published) ? published : record.pid;
  }
  try {
    unlinkSync(owner);
  } catch (e) {
    if (!missing(e)) throw e;
  }
  try {
    rmdirSync(reservation);
  } catch (e) {
    if (
      !missing(e) &&
      !['ENOTEMPTY', 'EEXIST'].includes((e as NodeJS.ErrnoException).code ?? '')
    )
      throw e;
  }
  return null;
}
export function claimStillOwned(claim: SupervisorClaim): boolean {
  if (claim.released) return false;
  try {
    const record = JSON.parse(
      protectedFile(join(claim.reservation, claim.owner)).text
    );
    const pid = protectedFile(claim.pidPath);
    return (
      record.version === 1 &&
      record.pid === process.pid &&
      record.nonce === claim.nonce &&
      pid.device === claim.device &&
      pid.inode === claim.inode &&
      pidValue(pid.text) === process.pid
    );
  } catch (error) {
    if (missing(error)) return false;
    throw error;
  }
}
export function claimSupervisorPid(path: string): ClaimResult {
  if (process.platform === 'win32')
    throw new Error(
      'Windows supervisor ACL and reparse-point verification is unavailable'
    );
  const pidPath = resolve(path);
  const dir = dirname(pidPath);
  mkdirSync(dir, { recursive: true, mode: 0o700 });
  inspectDirectory(dir);
  const reservation = `${pidPath}.takeover`;
  for (let attempt = 0; attempt < 100; attempt++) {
    const nonce = randomUUID();
    const candidate = join(dir, `.${basename(pidPath)}.${nonce}`);
    const owner = `owner.${nonce}.json`;
    mkdirSync(candidate, { mode: 0o700 });
    try {
      writeFileSync(
        join(candidate, owner),
        JSON.stringify({ version: 1, pid: process.pid, nonce }),
        { mode: 0o600, flag: 'wx' }
      );
      try {
        renameSync(candidate, reservation);
      } catch (e) {
        if (
          !['EEXIST', 'ENOTEMPTY', 'ENOTDIR', 'EPERM', 'EACCES'].includes(
            (e as NodeJS.ErrnoException).code ?? ''
          )
        )
          throw e;
        const pid = reclaim(reservation, pidPath);
        if (pid !== null) return { kind: 'blocked', pid };
        continue;
      }
      try {
        const previous = readSupervisorPid(pidPath);
        if (previous !== null && alive(previous)) {
          unlinkSync(join(reservation, owner));
          try {
            rmdirSync(reservation);
          } catch (error) {
            if (
              !missing(error) &&
              !['ENOTEMPTY', 'EEXIST'].includes(
                (error as NodeJS.ErrnoException).code ?? ''
              )
            )
              throw error;
          }
          return { kind: 'blocked', pid: previous };
        }
        const tempPid = join(dir, `.${basename(pidPath)}.${nonce}.pid`);
        try {
          writeFileSync(tempPid, String(process.pid), {
            mode: 0o600,
            flag: 'wx',
          });
          renameSync(tempPid, pidPath);
        } finally {
          removeIfPresent(tempPid);
        }
        const file = protectedFile(pidPath);
        return {
          kind: 'owned',
          claim: {
            pidPath,
            reservation,
            owner,
            nonce,
            device: file.device,
            inode: file.inode,
            released: false,
          },
        };
      } catch (e) {
        try {
          unlinkSync(join(reservation, owner));
          rmdirSync(reservation);
        } catch {
          /* Preserve acquisition error. */
        }
        throw e;
      }
    } finally {
      removeCandidate(candidate, owner);
    }
  }
  throw new Error('Supervisor claim contention exceeded retry limit');
}
export function releaseSupervisorPid(claim: SupervisorClaim): void {
  if (claim.released) return;
  claim.released = true;
  const owner = join(claim.reservation, claim.owner);
  let record: { version?: unknown; pid?: unknown; nonce?: unknown };
  try {
    record = JSON.parse(protectedFile(owner).text);
  } catch (e) {
    if (missing(e)) return;
    throw e;
  }
  if (
    record.version !== 1 ||
    record.pid !== process.pid ||
    record.nonce !== claim.nonce
  )
    return;
  try {
    const current = protectedFile(claim.pidPath);
    if (
      current.device === claim.device &&
      current.inode === claim.inode &&
      pidValue(current.text) === process.pid
    )
      unlinkSync(claim.pidPath);
  } catch (e) {
    if (!missing(e)) throw e;
  }
  try {
    unlinkSync(owner);
  } catch (e) {
    if (!missing(e)) throw e;
  }
  try {
    rmdirSync(claim.reservation);
  } catch (e) {
    if (
      !missing(e) &&
      !['ENOTEMPTY', 'EEXIST'].includes((e as NodeJS.ErrnoException).code ?? '')
    )
      throw e;
  }
}
