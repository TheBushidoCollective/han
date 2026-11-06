import { spawnSync } from 'node:child_process';
import { join, resolve } from 'node:path';
import { findCoordinatorBinary } from './binary.ts';
import type { LocalCoordinatorDescriptor, SupervisorBinding } from './connection.ts';

export class CoordinatorSecurityError extends Error {
  constructor(message: string) { super(message); this.name = 'CoordinatorSecurityError'; }
}
export interface WindowsFileIdentity { volumeSerial: string; fileId: string }
export interface WindowsProcessIdentity { pid: number; creationTime: string; userSid: string }
export interface WindowsClaim {
  nonce: string;
  process: WindowsProcessIdentity;
  reservation: WindowsFileIdentity;
  ownerFile: WindowsFileIdentity;
  pidFile: WindowsFileIdentity;
}
export interface WindowsSupervisorIdentity { pid: number; nonce: string; process: WindowsProcessIdentity }
export interface WindowsLauncher { name: string; path: string; identity: WindowsFileIdentity }
type Status = 'owned' | 'changed' | 'absent' | 'released' | 'removed' | 'alive' | 'gone' | 'unknown';
const MAX_MESSAGE = 128 * 1024;
const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
const object = (v: unknown): v is Record<string, unknown> => !!v && typeof v === 'object' && !Array.isArray(v);
const pid = (v: unknown): v is number => Number.isSafeInteger(v) && (v as number) > 0 && (v as number) <= 0xffffffff;
const file = (v: unknown): v is unknown & WindowsFileIdentity => object(v) && typeof v.volumeSerial === 'string' && /^[0-9a-f]{16}$/i.test(v.volumeSerial) && typeof v.fileId === 'string' && /^[0-9a-f]{32}$/i.test(v.fileId);
const processIdentity = (v: unknown): v is unknown & WindowsProcessIdentity => object(v) && pid(v.pid) && typeof v.creationTime === 'string' && /^[1-9][0-9]{0,19}$/.test(v.creationTime) && typeof v.userSid === 'string' && /^S-1-(?:[0-9]+-)*[0-9]+$/.test(v.userSid);
const claim = (v: unknown): v is unknown & WindowsClaim => object(v) && typeof v.nonce === 'string' && uuid.test(v.nonce) && processIdentity(v.process) && file(v.reservation) && file(v.ownerFile) && file(v.pidFile);
function invalid(): never { throw new CoordinatorSecurityError('Invalid Windows local-runtime response'); }

/** One bounded request on inherited pipes. Never include native diagnostics, which may contain secrets. */
function request(dataDir: string, op: string, args: Record<string, unknown> = {}): unknown {
  const binary = findCoordinatorBinary();
  if (!binary) throw new CoordinatorSecurityError('Windows local-runtime helper not found');
  const input = JSON.stringify({ version: 1, dataDir, op, ...args });
  if (Buffer.byteLength(input) > MAX_MESSAGE) throw new CoordinatorSecurityError('Windows local-runtime request too large');
  const result = spawnSync(binary, ['--local-runtime'], { input, encoding: 'utf8', maxBuffer: MAX_MESSAGE, timeout: 10000, windowsHide: true });
  return parseWindowsRuntimeResponse(result);
}

/** Validate a completed helper invocation without exposing its diagnostics. */
export function parseWindowsRuntimeResponse(result: {error?: Error; status: number | null; stdout: string | null}): unknown {
  if (result.error || result.status !== 0 || typeof result.stdout !== 'string' || Buffer.byteLength(result.stdout) > MAX_MESSAGE)
    throw new CoordinatorSecurityError('Windows local-runtime helper failed');
  let response: unknown;
  try { response = JSON.parse(result.stdout); } catch { return invalid(); }
  if (!object(response) || response.version !== 1 || response.ok !== true || !('result' in response)) return invalid();
  return response.result;
}
function status(v: unknown, allowed: Status[]): Status {
  if (!object(v) || typeof v.status !== 'string' || !allowed.includes(v.status as Status)) return invalid();
  return v.status as Status;
}
export function windowsReadDescriptor(dataDir: string, target: {kind:'active'} | {kind:'stopping';binding:SupervisorBinding}): LocalCoordinatorDescriptor | null {
  const value = request(dataDir, 'descriptor.read', { target });
  if (value === null) return null;
  if (!object(value) || !file(value.identity) || !object(value.descriptor) || Buffer.byteLength(JSON.stringify(value.descriptor)) > 65536) return invalid();
  return value.descriptor as unknown as LocalCoordinatorDescriptor;
}
export function windowsAcquire(dataDir: string, kind: 'supervisor' | 'spawn'): {status:'owned';claim:WindowsClaim} | {status:'blocked';ownerPid:number} {
  const value = request(dataDir, `${kind}.acquire`);
  if (!object(value)) return invalid();
  if (value.status === 'owned' && claim(value.claim) && value.claim.process.pid === process.pid) return {status:'owned',claim:value.claim};
  if (value.status === 'blocked' && pid(value.ownerPid)) return {status:'blocked',ownerPid:value.ownerPid};
  return invalid();
}
export function windowsReadSupervisor(dataDir: string): WindowsSupervisorIdentity | null {
  const value = request(dataDir, 'supervisor.read');
  if (value === null) return null;
  if (!object(value) || !pid(value.pid) || typeof value.nonce !== 'string' || !uuid.test(value.nonce) || !processIdentity(value.process) || value.process.pid !== value.pid) return invalid();
  return value as unknown as WindowsSupervisorIdentity;
}
export function windowsCheck(dataDir: string, expected: WindowsClaim): 'owned' | 'changed' | 'absent' {
  if (!claim(expected)) return invalid();
  return status(request(dataDir, 'supervisor.check', {claim:expected}), ['owned','changed','absent']) as 'owned' | 'changed' | 'absent';
}
export function windowsRelease(dataDir: string, kind: 'supervisor' | 'spawn', expected: WindowsClaim): void {
  if (!claim(expected)) return invalid();
  const s = status(request(dataDir, `${kind}.release`, {claim:expected}), ['released','changed','absent']);
  if (s === 'changed') throw new CoordinatorSecurityError('Windows ownership changed');
}
export function windowsRemoveIntent(dataDir: string, binding: SupervisorBinding, childPid: number, descriptor: LocalCoordinatorDescriptor): void {
  const s = status(request(dataDir, 'intent.remove', {binding,childPid,descriptor}), ['removed','changed','absent']);
  if (s === 'changed') throw new CoordinatorSecurityError('Windows shutdown intent changed');
}
export function windowsCreateLauncher(dataDir: string, origin: string, token: string): WindowsLauncher {
  if (!/^http:\/\/127\.0\.0\.1:[1-9][0-9]{0,4}$/.test(origin) || Number(origin.slice(origin.lastIndexOf(':') + 1)) > 65535 || !/^[A-Za-z0-9_-]{43}$/.test(token)) throw new CoordinatorSecurityError('Invalid launcher input');
  const value = request(dataDir, 'launcher.create', {origin,token});
  if (!object(value) || typeof value.name !== 'string' || !/^launcher-[A-Za-z0-9_-]+\.html$/.test(value.name) || typeof value.path !== 'string' || resolve(value.path) !== resolve(join(dataDir, 'runtime', value.name)) || !file(value.identity)) return invalid();
  return value as unknown as WindowsLauncher;
}
export function windowsRemoveLauncher(dataDir: string, launcher: WindowsLauncher): void {
  if (!/^launcher-[A-Za-z0-9_-]+\.html$/.test(launcher.name) || !file(launcher.identity)) return invalid();
  const s = status(request(dataDir, 'launcher.remove', {name:launcher.name, identity:launcher.identity}), ['removed','changed','absent']);
  if (s === 'changed') throw new CoordinatorSecurityError('Windows launcher changed');
}
export function windowsProcessState(dataDir: string, process: WindowsProcessIdentity): 'alive' | 'gone' {
  if (!processIdentity(process)) return invalid();
  const s = status(request(dataDir, 'process.state', {process}), ['alive','gone','unknown']);
  if (s === 'unknown') throw new CoordinatorSecurityError('Windows process state is unknown');
  return s as 'alive' | 'gone';
}
