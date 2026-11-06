import { join, resolve } from 'node:path';
import {
  type LocalCoordinatorDescriptor,
  type SupervisorBinding,
  sameSupervisor,
  validateCoordinatorDescriptor,
  validSupervisorBinding,
} from './connection.ts';
import { findCoordinatorBinary, spawnSync } from './windows-helper.ts';

export class CoordinatorSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoordinatorSecurityError';
  }
}
export interface WindowsFileIdentity {
  volumeSerial: string;
  fileId: string;
}
export interface WindowsProcessIdentity {
  pid: number;
  creationTime: string;
  userSid: string;
}
export interface WindowsClaim {
  nonce: string;
  process: WindowsProcessIdentity;
  reservation: WindowsFileIdentity;
  ownerFile: WindowsFileIdentity;
  pidFile: WindowsFileIdentity;
}
export interface WindowsSupervisorIdentity {
  pid: number;
  nonce: string;
  process: WindowsProcessIdentity;
}
export type WindowsSupervisorRead =
  | { status: 'absent' }
  | { status: 'recoverable' }
  | ({ status: 'present' } & WindowsSupervisorIdentity);
export interface WindowsLauncher {
  name: string;
  path: string;
  identity: WindowsFileIdentity;
}
type Status =
  | 'owned'
  | 'changed'
  | 'absent'
  | 'released'
  | 'removed'
  | 'alive'
  | 'gone'
  | 'unknown';
const MAX_MESSAGE = 128 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === 'object' && !Array.isArray(v);
const pid = (v: unknown): v is number =>
  Number.isSafeInteger(v) && (v as number) > 0 && (v as number) <= 0xffffffff;
const file = (v: unknown): v is unknown & WindowsFileIdentity =>
  object(v) &&
  typeof v.volumeSerial === 'string' &&
  /^[0-9a-f]{16}$/i.test(v.volumeSerial) &&
  typeof v.fileId === 'string' &&
  /^[0-9a-f]{32}$/i.test(v.fileId);
export const validWindowsProcessIdentity = (
  v: unknown
): v is WindowsProcessIdentity =>
  object(v) &&
  pid(v.pid) &&
  typeof v.creationTime === 'string' &&
  /^[1-9][0-9]{0,19}$/.test(v.creationTime) &&
  BigInt(v.creationTime) <= 0xffffffffffffffffn &&
  typeof v.userSid === 'string' &&
  /^S-1-(?:[0-9]+-)*[0-9]+$/.test(v.userSid);
const processIdentity = validWindowsProcessIdentity;
const claim = (v: unknown): v is unknown & WindowsClaim =>
  object(v) &&
  typeof v.nonce === 'string' &&
  uuid.test(v.nonce) &&
  processIdentity(v.process) &&
  file(v.reservation) &&
  file(v.ownerFile) &&
  file(v.pidFile);
function invalid(): never {
  throw new CoordinatorSecurityError('Invalid Windows local-runtime response');
}

type RuntimeOperation =
  | 'runtime.prepare'
  | 'descriptor.read'
  | 'supervisor.read'
  | 'supervisor.acquire'
  | 'spawn.acquire'
  | 'supervisor.check'
  | 'supervisor.release'
  | 'spawn.release'
  | 'intent.remove'
  | 'launcher.create'
  | 'launcher.remove'
  | 'process.state';
type Category =
  | 'binary_missing'
  | 'request_too_large'
  | 'spawn_error'
  | 'nonzero_exit'
  | 'no_exit_status'
  | 'missing_stdout'
  | 'oversized_stdout'
  | 'invalid_json'
  | 'invalid_envelope'
  | 'invalid_result';
const stages = [
  'input_read',
  'input_validation',
  'parent_identity',
  'data_directory',
  'runtime_directory',
  'publication_lock',
  'claim_inspection',
  'claim_acquisition',
  'descriptor_read',
  'process_state',
  'response_write',
];
const kinds = [
  'invalid_data',
  'not_found',
  'permission_denied',
  'already_exists',
  'timed_out',
  'other',
];
const spawnCodes = ['ENOENT', 'EACCES', 'EPERM', 'ETIMEDOUT', 'ENOBUFS'];
function fail(
  operation: RuntimeOperation,
  category: Category,
  extra: Record<string, string | number | null> = {}
): never {
  throw new CoordinatorSecurityError(
    `Windows local-runtime helper failed HAN_WINDOWS_RUNTIME_DIAGNOSTIC=${JSON.stringify({ operation, category, ...extra })}`
  );
}

/** One bounded request on inherited pipes. Never expose arbitrary native output. */
function request(
  dataDir: string,
  op: RuntimeOperation,
  args: Record<string, unknown> = {}
): unknown {
  const binary = findCoordinatorBinary();
  if (!binary) return fail(op, 'binary_missing');
  const input = JSON.stringify({ version: 1, dataDir, op, ...args });
  if (Buffer.byteLength(input) > MAX_MESSAGE)
    return fail(op, 'request_too_large');
  let result: {
    error?: NodeJS.ErrnoException;
    status: number | null;
    stdout: string | null;
  };
  try {
    result = spawnSync(binary, ['--local-runtime'], {
      input,
      encoding: 'utf8',
      maxBuffer: MAX_MESSAGE,
      timeout: 10000,
      windowsHide: true,
    });
  } catch (error) {
    const code = (error as NodeJS.ErrnoException)?.code;
    return fail(op, 'spawn_error', {
      spawnCode:
        typeof code === 'string' && spawnCodes.includes(code) ? code : 'other',
    });
  }
  return parseWindowsRuntimeResponse(result, op);
}

/** Validate a completed helper invocation without exposing its diagnostics. */
export function parseWindowsRuntimeResponse(
  result: {
    error?: NodeJS.ErrnoException;
    status: number | null;
    stdout: string | null;
  },
  op: RuntimeOperation = 'supervisor.read'
): unknown {
  if (result.error) {
    const code = result.error.code;
    return fail(op, 'spawn_error', {
      spawnCode:
        typeof code === 'string' && spawnCodes.includes(code) ? code : 'other',
    });
  }
  if (result.status === null) return fail(op, 'no_exit_status');
  if (result.status !== 0) {
    let response: unknown;
    try {
      if (
        typeof result.stdout === 'string' &&
        Buffer.byteLength(result.stdout) <= MAX_MESSAGE
      )
        response = JSON.parse(result.stdout);
    } catch {}
    if (
      object(response) &&
      response.version === 1 &&
      response.ok === false &&
      object(response.error)
    ) {
      const e = response.error;
      if (
        Object.keys(response).sort().join(',') === 'error,ok,version' &&
        Object.keys(e).sort().join(',') === 'kind,stage,win32Code' &&
        typeof e.stage === 'string' &&
        stages.includes(e.stage) &&
        typeof e.kind === 'string' &&
        kinds.includes(e.kind) &&
        (e.win32Code === null ||
          (Number.isInteger(e.win32Code) &&
            (e.win32Code as number) >= 0 &&
            (e.win32Code as number) <= 0xffffffff))
      )
        return fail(op, 'nonzero_exit', {
          exitStatus: result.status,
          stage: e.stage,
          kind: e.kind,
          win32Code: e.win32Code as number | null,
        });
    }
    return fail(op, 'nonzero_exit', { exitStatus: result.status });
  }
  if (typeof result.stdout !== 'string' || result.stdout.length === 0)
    return fail(op, 'missing_stdout');
  if (Buffer.byteLength(result.stdout) > MAX_MESSAGE)
    return fail(op, 'oversized_stdout');
  let response: unknown;
  try {
    response = JSON.parse(result.stdout);
  } catch {
    return fail(op, 'invalid_json');
  }
  if (
    !object(response) ||
    response.version !== 1 ||
    response.ok !== true ||
    !('result' in response) ||
    Object.keys(response).sort().join(',') !== 'ok,result,version'
  )
    return fail(op, 'invalid_envelope');
  return response.result;
}
export function windowsPrepareRuntime(dataDir: string): void {
  const value = request(dataDir, 'runtime.prepare');
  if (
    !object(value) ||
    value.status !== 'prepared' ||
    Object.keys(value).length !== 1
  )
    fail('runtime.prepare', 'invalid_result');
}
function status(v: unknown, allowed: Status[], op: RuntimeOperation): Status {
  if (
    !object(v) ||
    typeof v.status !== 'string' ||
    !allowed.includes(v.status as Status)
  )
    return fail(op, 'invalid_result');
  return v.status as Status;
}
export function windowsReadDescriptor(
  dataDir: string,
  target: { kind: 'active' } | { kind: 'stopping'; binding: SupervisorBinding }
): LocalCoordinatorDescriptor | null {
  if (
    target.kind !== 'active' &&
    (target.kind !== 'stopping' || !validSupervisorBinding(target.binding))
  )
    return invalid();
  const value = request(dataDir, 'descriptor.read', { target });
  if (value === null) return null;
  if (
    !object(value) ||
    !file(value.identity) ||
    !object(value.descriptor) ||
    Buffer.byteLength(JSON.stringify(value.descriptor)) > 65536
  )
    return fail('descriptor.read', 'invalid_result');
  let descriptor: LocalCoordinatorDescriptor;
  try {
    descriptor = validateCoordinatorDescriptor(
      value.descriptor as unknown as LocalCoordinatorDescriptor
    );
  } catch {
    return fail('descriptor.read', 'invalid_result');
  }
  if (
    !processIdentity(descriptor.process) ||
    descriptor.process.pid !== descriptor.pid
  )
    return fail('descriptor.read', 'invalid_result');
  return descriptor;
}
export function windowsAcquire(
  dataDir: string,
  kind: 'supervisor' | 'spawn'
):
  | { status: 'owned'; claim: WindowsClaim }
  | { status: 'blocked'; ownerPid: number } {
  const value = request(dataDir, `${kind}.acquire`);
  if (!object(value)) return fail(`${kind}.acquire`, 'invalid_result');
  if (
    value.status === 'owned' &&
    claim(value.claim) &&
    value.claim.process.pid === process.pid
  )
    return { status: 'owned', claim: value.claim };
  if (value.status === 'blocked' && pid(value.ownerPid))
    return { status: 'blocked', ownerPid: value.ownerPid };
  return fail(`${kind}.acquire`, 'invalid_result');
}
export function windowsReadSupervisor(dataDir: string): WindowsSupervisorRead {
  const value = request(dataDir, 'supervisor.read');
  if (!object(value)) return fail('supervisor.read', 'invalid_result');
  if (
    (value.status === 'absent' || value.status === 'recoverable') &&
    Object.keys(value).length === 1
  )
    return { status: value.status };
  if (
    value.status !== 'present' ||
    Object.keys(value).sort().join(',') !== 'nonce,pid,process,status' ||
    !pid(value.pid) ||
    typeof value.nonce !== 'string' ||
    !uuid.test(value.nonce) ||
    !processIdentity(value.process) ||
    value.process.pid !== value.pid
  )
    return fail('supervisor.read', 'invalid_result');
  return value as unknown as WindowsSupervisorRead;
}
export function windowsCheck(
  dataDir: string,
  expected: WindowsClaim
): 'owned' | 'changed' | 'absent' {
  if (!claim(expected) || expected.process.pid !== process.pid) invalid();
  return status(
    request(dataDir, 'supervisor.check', { claim: expected }),
    ['owned', 'changed', 'absent'],
    'supervisor.check'
  ) as 'owned' | 'changed' | 'absent';
}
export function windowsRelease(
  dataDir: string,
  kind: 'supervisor' | 'spawn',
  expected: WindowsClaim
): void {
  if (!claim(expected) || expected.process.pid !== process.pid) invalid();
  const s = status(
    request(dataDir, `${kind}.release`, { claim: expected }),
    ['released', 'changed', 'absent'],
    `${kind}.release`
  );
  if (s === 'changed')
    throw new CoordinatorSecurityError('Windows ownership changed');
}
export function windowsRemoveIntent(
  dataDir: string,
  binding: SupervisorBinding,
  childPid: number,
  descriptor: LocalCoordinatorDescriptor
): void {
  if (!validSupervisorBinding(binding) || !pid(childPid)) invalid();
  validateCoordinatorDescriptor(descriptor);
  if (
    descriptor.pid !== childPid ||
    !descriptor.supervisor ||
    descriptor.supervisor.pid !== binding.pid ||
    descriptor.supervisor.nonce !== binding.nonce ||
    descriptor.supervisor.generationId !== binding.generationId
  )
    invalid();
  const s = status(
    request(dataDir, 'intent.remove', { binding, childPid, descriptor }),
    ['removed', 'changed', 'absent'],
    'intent.remove'
  );
  if (s === 'changed')
    throw new CoordinatorSecurityError('Windows shutdown intent changed');
}
export function windowsCreateLauncher(
  dataDir: string,
  origin: string,
  token: string
): WindowsLauncher {
  if (
    !/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(origin) ||
    Number(origin.slice(origin.lastIndexOf(':') + 1)) > 65535 ||
    !/^[A-Za-z0-9_-]{43}$/.test(token)
  )
    throw new CoordinatorSecurityError('Invalid launcher input');
  const value = request(dataDir, 'launcher.create', { origin, token });
  if (
    !object(value) ||
    typeof value.name !== 'string' ||
    !/^launcher-[A-Za-z0-9_-]+\.html$/.test(value.name) ||
    typeof value.path !== 'string' ||
    resolve(value.path) !== resolve(join(dataDir, 'runtime', value.name)) ||
    !file(value.identity)
  )
    return fail('launcher.create', 'invalid_result');
  return value as unknown as WindowsLauncher;
}
export function windowsRemoveLauncher(
  dataDir: string,
  launcher: WindowsLauncher
): void {
  if (
    !/^launcher-[A-Za-z0-9_-]+\.html$/.test(launcher.name) ||
    !file(launcher.identity)
  )
    invalid();
  const s = status(
    request(dataDir, 'launcher.remove', {
      name: launcher.name,
      identity: launcher.identity,
    }),
    ['removed', 'changed', 'absent'],
    'launcher.remove'
  );
  if (s === 'changed')
    throw new CoordinatorSecurityError('Windows launcher changed');
}
export function windowsProcessState(
  dataDir: string,
  process: WindowsProcessIdentity
): 'alive' | 'gone' {
  if (!processIdentity(process)) return invalid();
  const s = status(
    request(dataDir, 'process.state', { process }),
    ['alive', 'gone', 'unknown'],
    'process.state'
  );
  if (s === 'unknown')
    throw new CoordinatorSecurityError('Windows process state is unknown');
  return s as 'alive' | 'gone';
}
export type WindowsChildDescriptor = LocalCoordinatorDescriptor & {
  process: WindowsProcessIdentity;
};

export async function readWindowsChildDescriptor(
  child: Bun.Subprocess,
  expectedSupervisor: SupervisorBinding | null,
  deadline: number
): Promise<WindowsChildDescriptor | null> {
  if (
    !child.stdout ||
    typeof (child.stdout as ReadableStream<Uint8Array>).getReader !== 'function'
  )
    throw new CoordinatorSecurityError('Missing child stdout stream');
  const reader = (child.stdout as ReadableStream<Uint8Array>).getReader();
  const chunks: Uint8Array[] = [];
  let totalBytes = 0;
  const maxBytes = 131072;
  try {
    while (true) {
      const remainingMs = deadline - Date.now();
      if (remainingMs <= 0)
        throw new CoordinatorSecurityError('Startup receipt timed out');

      const timeout = Promise.withResolvers<never>();
      const timer = setTimeout(() => {
        timeout.reject(
          new CoordinatorSecurityError('Startup receipt timed out')
        );
      }, remainingMs);

      const chunk = await Promise.race([
        reader.read(),
        timeout.promise,
      ]).finally(() => {
        clearTimeout(timer);
      });
      if (chunk.done) {
        if (totalBytes === 0) return null;
        throw new CoordinatorSecurityError('Incomplete startup receipt frame');
      }

      const value = chunk.value;
      const lfIndex = value.indexOf(0x0a);
      if (lfIndex !== -1) {
        const slice = value.subarray(0, lfIndex);
        chunks.push(slice);
        totalBytes += slice.length;
        if (totalBytes > maxBytes)
          throw new CoordinatorSecurityError(
            'Startup receipt exceeds size limit'
          );
        break;
      }

      chunks.push(value);
      totalBytes += value.length;
      if (totalBytes > maxBytes)
        throw new CoordinatorSecurityError(
          'Startup receipt exceeds size limit'
        );
    }
  } finally {
    try {
      await reader.cancel();
    } catch {}
    reader.releaseLock();
  }

  const totalBuffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    totalBuffer.set(chunk, offset);
    offset += chunk.length;
  }
  const text = new TextDecoder('utf-8', { fatal: true }).decode(totalBuffer);
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new CoordinatorSecurityError('Malformed startup receipt JSON');
  }
  if (
    !object(parsed) ||
    parsed.version !== 1 ||
    !('descriptor' in parsed) ||
    Object.keys(parsed).length !== 2
  )
    throw new CoordinatorSecurityError('Invalid startup receipt envelope');

  const rawDescriptor = parsed.descriptor;
  const descriptor = validateCoordinatorDescriptor(
    rawDescriptor as LocalCoordinatorDescriptor
  );
  if (!validWindowsProcessIdentity(descriptor.process))
    throw new CoordinatorSecurityError(
      'Missing Windows process identity in startup receipt'
    );
  if (descriptor.pid !== child.pid || descriptor.process.pid !== child.pid)
    throw new CoordinatorSecurityError('Startup receipt PID mismatch');
  if (!sameSupervisor(descriptor.supervisor, expectedSupervisor))
    throw new CoordinatorSecurityError('Startup receipt supervisor mismatch');

  return descriptor as WindowsChildDescriptor;
}
