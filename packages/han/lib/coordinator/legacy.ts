import { basename } from 'node:path';
import { getCoordinatorDataDir } from './connection.ts';
import {
  CoordinatorPortOccupiedError,
  CoordinatorSecurityError,
} from './errors.ts';
import { requestPosixRuntime } from './recovery-runtime.ts';
import { requestWindowsRuntime } from './windows-runtime.ts';

export interface LegacyIdentity {
  pid: number;
  startTime: string;
  httpsPort: number;
  grpcPort: number;
  exe: string;
}

export type LegacyInspectResult =
  | { status: 'absent' }
  | { status: 'modern'; pid: number }
  | { status: 'starting'; pid: number }
  | { status: 'legacy'; identity: LegacyIdentity }
  | {
      status: 'foreign';
      reason:
        | 'other-user'
        | 'unattributable'
        | 'not-legacy'
        | 'ambiguous'
        | 'unsupported';
      pid: number | null;
      exe: string | null;
    };

export type LegacyStopResult =
  | {
      status: 'stopped';
      escalation: 'none' | 'pidfd' | 'handle';
      retired: string[];
    }
  | { status: 'changed' }
  | { status: 'stuck'; pid: number; exe: string };

export type LegacyRetireResult =
  | { status: 'clean'; retired: string[] }
  | { status: 'retired'; retired: string[]; supervisorPid: number | null }
  | { status: 'blocked'; pid: number; exe: string | null }
  | { status: 'listener-present' };

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function hasExactKeys(v: Record<string, unknown>, keys: string[]): boolean {
  const actual = Object.keys(v).sort();
  const expected = [...keys].sort();
  return (
    actual.length === expected.length &&
    actual.every((k, idx) => k === expected[idx])
  );
}

export function validateInspectResult(res: unknown): LegacyInspectResult {
  if (!isObject(res))
    throw new CoordinatorSecurityError('Invalid inspect response');
  const status = res.status;
  if (status === 'absent') {
    if (!hasExactKeys(res, ['status']))
      throw new CoordinatorSecurityError('Extra keys in absent inspect');
    return { status: 'absent' };
  }
  if (status === 'modern') {
    if (!hasExactKeys(res, ['status', 'pid']) || typeof res.pid !== 'number') {
      throw new CoordinatorSecurityError('Invalid modern inspect response');
    }
    return { status: 'modern', pid: res.pid };
  }
  if (status === 'starting') {
    if (!hasExactKeys(res, ['status', 'pid']) || typeof res.pid !== 'number') {
      throw new CoordinatorSecurityError('Invalid starting inspect response');
    }
    return { status: 'starting', pid: res.pid };
  }
  if (status === 'legacy') {
    if (!hasExactKeys(res, ['status', 'identity']) || !isObject(res.identity)) {
      throw new CoordinatorSecurityError('Invalid legacy inspect response');
    }
    const id = res.identity;
    if (
      !hasExactKeys(id, ['pid', 'startTime', 'httpsPort', 'grpcPort', 'exe']) ||
      typeof id.pid !== 'number' ||
      typeof id.startTime !== 'string' ||
      typeof id.httpsPort !== 'number' ||
      typeof id.grpcPort !== 'number' ||
      typeof id.exe !== 'string'
    ) {
      throw new CoordinatorSecurityError(
        'Invalid legacy identity in inspect response'
      );
    }
    return {
      status: 'legacy',
      identity: {
        pid: id.pid,
        startTime: id.startTime,
        httpsPort: id.httpsPort,
        grpcPort: id.grpcPort,
        exe: id.exe,
      },
    };
  }
  if (status === 'foreign') {
    if (
      !hasExactKeys(res, ['status', 'reason', 'pid', 'exe']) ||
      typeof res.reason !== 'string' ||
      (res.pid !== null && typeof res.pid !== 'number') ||
      (res.exe !== null && typeof res.exe !== 'string')
    ) {
      throw new CoordinatorSecurityError('Invalid foreign inspect response');
    }
    const reason = res.reason;
    if (
      reason !== 'other-user' &&
      reason !== 'unattributable' &&
      reason !== 'not-legacy' &&
      reason !== 'ambiguous' &&
      reason !== 'unsupported'
    ) {
      throw new CoordinatorSecurityError(
        `Unexpected foreign inspect reason: ${reason}`
      );
    }
    return {
      status: 'foreign',
      reason,
      pid: res.pid,
      exe: res.exe,
    };
  }
  throw new CoordinatorSecurityError(`Unknown inspect status: ${status}`);
}

export function validateStopResult(res: unknown): LegacyStopResult {
  if (!isObject(res))
    throw new CoordinatorSecurityError('Invalid stop response');
  const status = res.status;
  if (status === 'stopped') {
    if (
      !hasExactKeys(res, ['status', 'escalation', 'retired']) ||
      (res.escalation !== 'none' &&
        res.escalation !== 'pidfd' &&
        res.escalation !== 'handle') ||
      !Array.isArray(res.retired) ||
      !res.retired.every((r) => typeof r === 'string')
    ) {
      throw new CoordinatorSecurityError('Invalid stopped response');
    }
    return {
      status: 'stopped',
      escalation: res.escalation,
      retired: res.retired,
    };
  }
  if (status === 'changed') {
    if (!hasExactKeys(res, ['status']))
      throw new CoordinatorSecurityError('Extra keys in changed stop response');
    return { status: 'changed' };
  }
  if (status === 'stuck') {
    if (
      !hasExactKeys(res, ['status', 'pid', 'exe']) ||
      typeof res.pid !== 'number' ||
      typeof res.exe !== 'string'
    ) {
      throw new CoordinatorSecurityError('Invalid stuck stop response');
    }
    return {
      status: 'stuck',
      pid: res.pid,
      exe: res.exe,
    };
  }
  throw new CoordinatorSecurityError(`Unknown stop status: ${status}`);
}

export function validateRetireResult(res: unknown): LegacyRetireResult {
  if (!isObject(res))
    throw new CoordinatorSecurityError('Invalid retire response');
  const status = res.status;
  if (status === 'clean') {
    if (
      !hasExactKeys(res, ['status', 'retired']) ||
      !Array.isArray(res.retired) ||
      !res.retired.every((r) => typeof r === 'string')
    ) {
      throw new CoordinatorSecurityError('Invalid clean retire response');
    }
    return { status: 'clean', retired: res.retired };
  }
  if (status === 'retired') {
    if (
      !hasExactKeys(res, ['status', 'retired', 'supervisorPid']) ||
      !Array.isArray(res.retired) ||
      !res.retired.every((r) => typeof r === 'string') ||
      (res.supervisorPid !== null && typeof res.supervisorPid !== 'number')
    ) {
      throw new CoordinatorSecurityError('Invalid retired response');
    }
    return {
      status: 'retired',
      retired: res.retired,
      supervisorPid: res.supervisorPid,
    };
  }
  if (status === 'blocked') {
    if (
      !hasExactKeys(res, ['status', 'pid', 'exe']) ||
      typeof res.pid !== 'number' ||
      (res.exe !== null && typeof res.exe !== 'string')
    ) {
      throw new CoordinatorSecurityError('Invalid blocked retire response');
    }
    return {
      status: 'blocked',
      pid: res.pid,
      exe: res.exe,
    };
  }
  if (status === 'listener-present') {
    if (!hasExactKeys(res, ['status']))
      throw new CoordinatorSecurityError(
        'Extra keys in listener-present retire response'
      );
    return { status: 'listener-present' };
  }
  throw new CoordinatorSecurityError(`Unknown retire status: ${status}`);
}

function requestRuntime(op: string, args: Record<string, unknown>): unknown {
  const dataDir = getCoordinatorDataDir();
  if (process.platform === 'win32') {
    return requestWindowsRuntime(dataDir, op, args);
  }
  return requestPosixRuntime(dataDir, op, args);
}

export async function inspectLegacy(
  port: number
): Promise<LegacyInspectResult> {
  const raw = await requestRuntime('legacy.inspect', { port });
  return validateInspectResult(raw);
}

export async function stopLegacy(
  port: number,
  identity: LegacyIdentity,
  escalate = true
): Promise<LegacyStopResult> {
  const raw = await requestRuntime('legacy.stop', { port, identity, escalate });
  return validateStopResult(raw);
}

export async function retireLegacy(port: number): Promise<LegacyRetireResult> {
  const raw = await requestRuntime('legacy.retire', { port });
  return validateRetireResult(raw);
}

export async function stopLegacyCoordinator(port: number): Promise<boolean> {
  const dataDir = getCoordinatorDataDir();

  if (process.env.HAN_LEGACY_MIGRATION === 'off') {
    // S0 behavior when migration is off: if port occupied, fail closed
    const inspectRes = await inspectLegacy(port);
    if (inspectRes.status === 'absent' || inspectRes.status === 'modern') {
      return false;
    }
    throw new CoordinatorPortOccupiedError(
      `UPGRADE_REQUIRED: port ${port} is in use by a process Han cannot identify. Free the port, then run: han coordinator start`
    );
  }

  const inspection = await inspectLegacy(port);
  if (inspection.status === 'absent') {
    const ret = await retireLegacy(port);
    if (ret.status === 'blocked') {
      const exeName = ret.exe ? basename(ret.exe) : 'unknown';
      throw new CoordinatorPortOccupiedError(
        `UPGRADE_REQUIRED: ${dataDir}/coordinator.pid names running process ${ret.pid} (${exeName}). Remove it only if that process is not Han, then run: han coordinator start`
      );
    }
    return false;
  }

  if (inspection.status === 'starting') {
    // Wait for health
    for (let i = 0; i < 30; i++) {
      await Bun.sleep(100);
      const re = await inspectLegacy(port);
      if (re.status === 'modern') return false;
      if (re.status !== 'starting') break;
    }
    return false;
  }

  if (inspection.status === 'legacy') {
    const escalate = process.env.HAN_LEGACY_ESCALATION !== 'off';
    const stopRes = await stopLegacy(port, inspection.identity, escalate);
    if (stopRes.status === 'stopped') {
      await retireLegacy(port);
      return true;
    }
    if (stopRes.status === 'stuck') {
      throw new CoordinatorPortOccupiedError(
        `UPGRADE_REQUIRED: the Han v3.22 coordinator (PID ${stopRes.pid}, ${stopRes.exe}) did not exit after a shutdown request. Quit it, then run: han coordinator start`
      );
    }
    if (stopRes.status === 'changed') {
      throw new CoordinatorPortOccupiedError(
        `UPGRADE_REQUIRED: port ${port} is in use by a process Han cannot identify. Free the port, then run: han coordinator start`
      );
    }
  }

  if (inspection.status === 'foreign') {
    if (inspection.pid !== null && inspection.exe !== null) {
      const exeName = basename(inspection.exe);
      throw new CoordinatorPortOccupiedError(
        `UPGRADE_REQUIRED: port ${port} is in use by process ${inspection.pid} (${exeName}). Han did not stop it. Quit it, then run: han coordinator start`
      );
    }
    throw new CoordinatorPortOccupiedError(
      `UPGRADE_REQUIRED: port ${port} is in use by a process Han cannot identify. Free the port, then run: han coordinator start`
    );
  }

  if (inspection.status === 'modern') {
    throw new CoordinatorPortOccupiedError(
      `UPGRADE_REQUIRED: port ${port} is in use by a process Han cannot identify. Free the port, then run: han coordinator start`
    );
  }

  return false;
}
