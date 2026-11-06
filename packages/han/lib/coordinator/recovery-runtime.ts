import { randomUUID } from 'node:crypto';
import { findCoordinatorBinary } from './binary.ts';
import {
  CoordinatorSecurityError,
  type LocalCoordinatorDescriptor,
  type SupervisorBinding,
  sameSupervisor,
  validateCoordinatorDescriptor,
  validSupervisorBinding,
} from './connection.ts';
import { spawnSync } from './windows-helper.ts';
import {
  validWindowsProcessIdentity,
  type WindowsProcessIdentity,
} from './windows-runtime.ts';

const MAX_MESSAGE = 128 * 1024;
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const exact = (v: Record<string, unknown>, keys: string[]) =>
  Object.keys(v).sort().join(',') === [...keys].sort().join(',');
export interface PosixFileIdentity {
  device: string;
  inode: string;
}
export interface PosixRecord {
  identity: PosixFileIdentity;
  bytes: string;
}
export interface PosixClaim {
  pid: number;
  nonce: string;
  reservation: PosixFileIdentity;
  ownerFile: PosixFileIdentity;
  pidFile: PosixFileIdentity;
}
export type PosixClaimSnapshot =
  | { kind: 'absent' }
  | { kind: 'vacated'; reservation: PosixFileIdentity }
  | {
      kind: 'anchored';
      reservation: PosixFileIdentity;
      ownerName: string;
      ownerFile: PosixRecord;
      pidFile: PosixRecord | null;
    }
  | { kind: 'descriptor-bound-pid'; pidFile: PosixRecord };
type Target =
  | { kind: 'active' }
  | { kind: 'stopping'; binding: SupervisorBinding };
export interface PosixRecoverySnapshot {
  platform: 'posix';
  dataDirectory: PosixFileIdentity;
  runtimeDirectory: PosixFileIdentity;
  publicationLock: PosixFileIdentity;
  target: Target;
  active: PosixRecord | null;
  stopping: Array<{ name: string; record: PosixRecord }>;
  claim: PosixClaimSnapshot;
}
export interface WindowsRecord {
  identity: { volumeSerial: string; fileId: string };
  bytes: string;
}
export interface WindowsRecoverySnapshot {
  platform: 'windows';
  target: Target;
  active: WindowsRecord | null;
  selected: WindowsRecord | null;
  reservation: WindowsRecord | null;
  ownerFile: WindowsRecord | null;
  pidFile: WindowsRecord | null;
  stoppingNames: string[];
  stopping: Array<{ name: string; record: WindowsRecord }>;
  authorities: Array<{ name: string; record: WindowsRecord }>;
}
export type RecoverySnapshot = PosixRecoverySnapshot | WindowsRecoverySnapshot;
type ProcessState = 'alive' | 'gone' | 'absent';
export interface RecoveryInspection {
  status: 'present' | 'absent';
  snapshot: RecoverySnapshot;
  descriptor: LocalCoordinatorDescriptor | null;
  childState: ProcessState;
  supervisorState: ProcessState;
  stoppingNames: string[];
  stoppingBindings: SupervisorBinding[];
  supervisorProcess?: WindowsProcessIdentity | null;
  claimState?: ProcessState;
  claimProcess?: WindowsProcessIdentity | null;
}

/** Reject any new record or claim identity while permitting removal and an exact intent rename. */
export function assertRecoveryFence(
  initial: RecoverySnapshot,
  current: RecoverySnapshot,
  binding: SupervisorBinding | null
): void {
  const equal = (a: unknown, b: unknown) =>
    JSON.stringify(a) === JSON.stringify(b);
  const conflict = (): never => {
    throw new CoordinatorSecurityError('Coordinator recovery fence changed');
  };
  if (initial.platform !== current.platform) conflict();
  if (initial.platform === 'posix' && current.platform === 'posix') {
    if (
      !equal(initial.dataDirectory, current.dataDirectory) ||
      !equal(initial.runtimeDirectory, current.runtimeDirectory) ||
      !equal(initial.publicationLock, current.publicationLock)
    )
      conflict();
    const a = initial.claim;
    const b = current.claim;
    if (b.kind === 'anchored') {
      if (
        a.kind !== 'anchored' ||
        !equal(a.reservation, b.reservation) ||
        a.ownerName !== b.ownerName ||
        !equal(a.ownerFile, b.ownerFile) ||
        (b.pidFile !== null && !equal(a.pidFile, b.pidFile))
      )
        conflict();
    } else if (b.kind === 'vacated') {
      if (
        (a.kind !== 'anchored' && a.kind !== 'vacated') ||
        !equal(a.reservation, b.reservation)
      )
        conflict();
    } else if (b.kind === 'descriptor-bound-pid') {
      if (
        (a.kind !== 'anchored' && a.kind !== 'descriptor-bound-pid') ||
        !equal(a.pidFile, b.pidFile)
      )
        conflict();
    } else if (b.kind !== 'absent') conflict();
  } else if (initial.platform === 'windows' && current.platform === 'windows') {
    for (const name of ['reservation', 'ownerFile', 'pidFile'] as const)
      if (current[name] !== null && !equal(initial[name], current[name]))
        conflict();
    for (const entry of current.authorities) {
      const old = initial.authorities.find((item) => item.name === entry.name);
      if (old && equal(old.record, entry.record)) continue;
      conflict();
    }
  }
  if (current.active !== null && !equal(initial.active, current.active))
    conflict();
  const intentName = binding
    ? `coordinator.stopping.${binding.nonce}.${binding.generationId}.json`
    : null;
  for (const entry of current.stopping) {
    const old = initial.stopping.find((item) => item.name === entry.name);
    if (old && equal(old.record, entry.record)) continue;
    if (
      entry.name === intentName &&
      initial.active &&
      equal(initial.active, entry.record)
    )
      continue;
    conflict();
  }
}

function request(
  dataDir: string,
  op: string,
  args: Record<string, unknown> = {}
): unknown {
  const binary = findCoordinatorBinary();
  if (!binary)
    throw new CoordinatorSecurityError('Local runtime helper unavailable');
  const input = JSON.stringify({ version: 1, dataDir, op, ...args });
  if (Buffer.byteLength(input) > MAX_MESSAGE)
    throw new CoordinatorSecurityError('Local runtime request exceeds limit');
  const result = spawnSync(binary, ['--local-runtime'], {
    input,
    encoding: 'utf8',
    maxBuffer: MAX_MESSAGE,
    timeout: 10000,
    windowsHide: true,
  });
  if (
    result.error ||
    result.status !== 0 ||
    typeof result.stdout !== 'string' ||
    Buffer.byteLength(result.stdout) > MAX_MESSAGE
  )
    throw new CoordinatorSecurityError(`Local runtime ${op} failed`);
  let response: unknown;
  try {
    response = JSON.parse(result.stdout);
  } catch {
    throw new CoordinatorSecurityError('Invalid local runtime response');
  }
  if (
    !object(response) ||
    !exact(response, ['version', 'ok', 'result']) ||
    response.version !== 1 ||
    response.ok !== true
  )
    throw new CoordinatorSecurityError('Invalid local runtime response');
  return response.result;
}
const validPid = (n: unknown): n is number =>
  Number.isSafeInteger(n) && (n as number) > 0 && (n as number) <= 0x7fffffff;
const validIdentity = (v: unknown): v is PosixFileIdentity =>
  object(v) &&
  exact(v, ['device', 'inode']) &&
  typeof v.device === 'string' &&
  /^(0|[1-9][0-9]*)$/.test(v.device) &&
  typeof v.inode === 'string' &&
  /^(0|[1-9][0-9]*)$/.test(v.inode);
const validClaim = (v: unknown): v is PosixClaim =>
  object(v) &&
  exact(v, ['pid', 'nonce', 'reservation', 'ownerFile', 'pidFile']) &&
  validPid(v.pid) &&
  typeof v.nonce === 'string' &&
  UUID.test(v.nonce) &&
  validIdentity(v.reservation) &&
  validIdentity(v.ownerFile) &&
  validIdentity(v.pidFile);
function validSnapshot(
  value: unknown,
  target: Target
): value is RecoverySnapshot {
  if (
    !object(value) ||
    !object(value.target) ||
    value.target.kind !== target.kind
  )
    return false;
  if (target.kind === 'active') {
    if (!exact(value.target, ['kind'])) return false;
  } else if (
    !exact(value.target, ['kind', 'binding']) ||
    !validSupervisorBinding(value.target.binding) ||
    !sameSupervisor(value.target.binding, target.binding)
  )
    return false;
  const bytes = (v: unknown) =>
    typeof v === 'string' &&
    v.length <= MAX_MESSAGE &&
    /^[A-Za-z0-9+/]*={0,2}$/.test(v) &&
    Buffer.from(v, 'base64').toString('base64') === v;
  const windowsIdentity = (v: unknown) =>
    object(v) &&
    exact(v, ['volumeSerial', 'fileId']) &&
    typeof v.volumeSerial === 'string' &&
    /^[0-9a-f]{16}$/i.test(v.volumeSerial) &&
    typeof v.fileId === 'string' &&
    /^[0-9a-f]{32}$/i.test(v.fileId);
  const record = (v: unknown, identity: (v: unknown) => boolean) =>
    object(v) &&
    exact(v, ['identity', 'bytes']) &&
    identity(v.identity) &&
    bytes(v.bytes);
  const nullableRecord = (v: unknown, identity: (v: unknown) => boolean) =>
    v === null || record(v, identity);
  const stopping = (v: unknown, identity: (v: unknown) => boolean) =>
    Array.isArray(v) &&
    v.length <= 256 &&
    v.every(
      (entry, index) =>
        object(entry) &&
        exact(entry, ['name', 'record']) &&
        typeof entry.name === 'string' &&
        /^coordinator\.stopping\.[0-9a-f-]+\.([0-9a-f-]+)\.json$/.test(
          entry.name
        ) &&
        (index === 0 || v[index - 1].name < entry.name) &&
        record(entry.record, identity)
    );
  const authorities = (v: unknown, identity: (v: unknown) => boolean) =>
    Array.isArray(v) &&
    v.length <= 256 &&
    v.every(
      (entry, index) =>
        object(entry) &&
        exact(entry, ['name', 'record']) &&
        typeof entry.name === 'string' &&
        /^supervisor\.authority\.[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.json$/.test(
          entry.name
        ) &&
        (index === 0 || v[index - 1].name < entry.name) &&
        record(entry.record, identity)
    );
  if (value.platform === 'posix') {
    if (
      !exact(value, [
        'platform',
        'dataDirectory',
        'runtimeDirectory',
        'publicationLock',
        'target',
        'active',
        'stopping',
        'claim',
      ]) ||
      !validIdentity(value.dataDirectory) ||
      !validIdentity(value.runtimeDirectory) ||
      !validIdentity(value.publicationLock) ||
      !nullableRecord(value.active, validIdentity) ||
      !stopping(value.stopping, validIdentity) ||
      !object(value.claim)
    )
      return false;
    const claim = value.claim;
    if (claim.kind === 'absent') return exact(claim, ['kind']);
    if (claim.kind === 'vacated')
      return (
        exact(claim, ['kind', 'reservation']) &&
        validIdentity(claim.reservation)
      );
    if (claim.kind === 'descriptor-bound-pid')
      return (
        exact(claim, ['kind', 'pidFile']) &&
        record(claim.pidFile, validIdentity)
      );
    return (
      claim.kind === 'anchored' &&
      exact(claim, [
        'kind',
        'reservation',
        'ownerName',
        'ownerFile',
        'pidFile',
      ]) &&
      validIdentity(claim.reservation) &&
      typeof claim.ownerName === 'string' &&
      /^owner\.[0-9a-f-]+\.json$/.test(claim.ownerName) &&
      record(claim.ownerFile, validIdentity) &&
      nullableRecord(claim.pidFile, validIdentity)
    );
  }
  if (
    value.platform !== 'windows' ||
    !exact(value, [
      'platform',
      'target',
      'active',
      'selected',
      'reservation',
      'ownerFile',
      'pidFile',
      'stoppingNames',
      'stopping',
      'authorities',
    ]) ||
    !Array.isArray(value.stoppingNames) ||
    !stopping(value.stopping, windowsIdentity) ||
    !authorities(value.authorities, windowsIdentity)
  )
    return false;
  return (
    ['active', 'selected', 'reservation', 'ownerFile', 'pidFile'].every((key) =>
      nullableRecord(value[key], windowsIdentity)
    ) &&
    JSON.stringify(value.stoppingNames) ===
      JSON.stringify(
        (value.stopping as Array<{ name: string }>).map((entry) => entry.name)
      )
  );
}

function resultStatus(v: unknown, choices: string[]): string {
  if (
    !object(v) ||
    !exact(v, ['status']) ||
    typeof v.status !== 'string' ||
    !choices.includes(v.status)
  )
    throw new CoordinatorSecurityError('Invalid local runtime response');
  return v.status;
}
export function posixPrepare(dataDir: string): void {
  resultStatus(request(dataDir, 'runtime.prepare'), ['prepared']);
}
export function posixAcquire(
  dataDir: string
):
  | { status: 'owned'; claim: PosixClaim }
  | { status: 'blocked'; ownerPid: number } {
  const nonce = randomUUID();
  const v = request(dataDir, 'supervisor.acquire', { pid: process.pid, nonce });
  if (
    object(v) &&
    exact(v, ['status', 'claim']) &&
    v.status === 'owned' &&
    validClaim(v.claim) &&
    v.claim.pid === process.pid &&
    v.claim.nonce === nonce
  )
    return { status: 'owned', claim: v.claim };
  if (
    object(v) &&
    exact(v, ['status', 'ownerPid']) &&
    v.status === 'blocked' &&
    validPid(v.ownerPid)
  )
    return { status: 'blocked', ownerPid: v.ownerPid };
  throw new CoordinatorSecurityError('Invalid supervisor acquisition response');
}
export function posixReadSupervisor(
  dataDir: string
):
  | { status: 'absent' }
  | { status: 'recoverable' }
  | { status: 'present'; pid: number; nonce: string } {
  const v = request(dataDir, 'supervisor.read');
  if (
    object(v) &&
    exact(v, ['status']) &&
    (v.status === 'absent' || v.status === 'recoverable')
  )
    return { status: v.status };
  if (
    object(v) &&
    exact(v, ['status', 'pid', 'nonce']) &&
    v.status === 'present' &&
    validPid(v.pid) &&
    typeof v.nonce === 'string' &&
    UUID.test(v.nonce)
  )
    return { status: 'present', pid: v.pid, nonce: v.nonce };
  throw new CoordinatorSecurityError('Invalid supervisor read response');
}
export function posixCheck(
  dataDir: string,
  claim: PosixClaim
): 'owned' | 'changed' | 'absent' {
  if (!validClaim(claim))
    throw new CoordinatorSecurityError('Invalid supervisor claim');
  return resultStatus(request(dataDir, 'supervisor.check', { claim }), [
    'owned',
    'changed',
    'absent',
  ]) as 'owned' | 'changed' | 'absent';
}
export function posixRelease(
  dataDir: string,
  claim: PosixClaim
): 'released' | 'changed' | 'absent' {
  if (!validClaim(claim))
    throw new CoordinatorSecurityError('Invalid supervisor claim');
  return resultStatus(request(dataDir, 'supervisor.release', { claim }), [
    'released',
    'changed',
    'absent',
  ]) as 'released' | 'changed' | 'absent';
}
export function recoveryInspect(
  dataDir: string,
  target: Target
): RecoveryInspection {
  const value = request(dataDir, 'recovery.inspect', {
    target,
  }) as RecoveryInspection;
  const states = ['alive', 'gone', 'absent'];
  if (
    !object(value) ||
    !exact(
      value,
      process.platform === 'win32'
        ? [
            'status',
            'snapshot',
            'descriptor',
            'childState',
            'supervisorState',
            'supervisorProcess',
            'claimState',
            'claimProcess',
            'stoppingNames',
            'stoppingBindings',
          ]
        : [
            'status',
            'snapshot',
            'descriptor',
            'childState',
            'supervisorState',
            'stoppingNames',
            'stoppingBindings',
          ]
    ) ||
    !['present', 'absent'].includes(value.status) ||
    !validSnapshot(value.snapshot, target) ||
    value.snapshot.platform !==
      (process.platform === 'win32' ? 'windows' : 'posix') ||
    !states.includes(value.childState) ||
    !states.includes(value.supervisorState) ||
    !Array.isArray(value.stoppingNames) ||
    !Array.isArray(value.stoppingBindings) ||
    !value.stoppingBindings.every(validSupervisorBinding) ||
    value.stoppingNames.length !== value.stoppingBindings.length ||
    JSON.stringify(value.snapshot.stopping.map((entry) => entry.name)) !==
      JSON.stringify(value.stoppingNames) ||
    value.stoppingBindings.some(
      (b, i) =>
        value.stoppingNames[i] !==
        `coordinator.stopping.${b.nonce}.${b.generationId}.json`
    ) ||
    (value.status === 'present') !== (value.descriptor !== null) ||
    (value.descriptor === null) !== (value.childState === 'absent')
  )
    throw new CoordinatorSecurityError('Invalid recovery inspection');
  if (process.platform === 'win32') {
    if (
      value.supervisorProcess !== null &&
      value.supervisorProcess !== undefined &&
      !validWindowsProcessIdentity(value.supervisorProcess)
    )
      throw new CoordinatorSecurityError('Invalid supervisor process identity');
    if (!states.includes(value.claimState as ProcessState))
      throw new CoordinatorSecurityError('Invalid claim state');
    if (
      value.claimProcess !== null &&
      value.claimProcess !== undefined &&
      !validWindowsProcessIdentity(value.claimProcess)
    )
      throw new CoordinatorSecurityError('Invalid claim process identity');
  }
  if (value.descriptor !== null)
    validateCoordinatorDescriptor(value.descriptor);
  return value;
}
export function recoveryReclaim(
  dataDir: string,
  snapshot: RecoverySnapshot
): 'removed' | 'absent' | 'changed' | 'busy' {
  return resultStatus(request(dataDir, 'recovery.reclaim', { snapshot }), [
    'removed',
    'absent',
    'changed',
    'busy',
  ]) as 'removed' | 'absent' | 'changed' | 'busy';
}
export function removePosixIntent(
  dataDir: string,
  binding: SupervisorBinding,
  descriptor: LocalCoordinatorDescriptor,
  claim: PosixClaim
): void {
  if (!validClaim(claim))
    throw new CoordinatorSecurityError('Invalid supervisor claim');
  const status = resultStatus(
    request(dataDir, 'intent.remove', { binding, descriptor, claim }),
    ['removed', 'absent', 'changed']
  );
  if (status === 'changed')
    throw new CoordinatorSecurityError(
      'Shutdown intent changed during removal'
    );
}
