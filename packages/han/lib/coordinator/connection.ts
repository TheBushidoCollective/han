import {
  closeSync,
  constants,
  fstatSync,
  lstatSync,
  openSync,
  readFileSync,
} from 'node:fs';
import { homedir } from 'node:os';
import { join, resolve } from 'node:path';
import WebSocket from 'ws';

export const LOCAL_TRANSPORT_VERSION = 1;
export interface SupervisorBinding {
  pid: number;
  nonce: string;
  generationId: string;
}

export function validSupervisorBinding(
  value: unknown
): value is SupervisorBinding {
  if (!value || typeof value !== 'object') return false;
  const b = value as SupervisorBinding;
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;
  return (
    Number.isSafeInteger(b.pid) &&
    b.pid > 0 &&
    typeof b.nonce === 'string' &&
    uuid.test(b.nonce) &&
    typeof b.generationId === 'string' &&
    uuid.test(b.generationId)
  );
}

export function sameSupervisor(
  a: SupervisorBinding | null,
  b: SupervisorBinding | null
): boolean {
  return a === null
    ? b === null
    : b !== null &&
        a.pid === b.pid &&
        a.nonce === b.nonce &&
        a.generationId === b.generationId;
}

export function sameCoordinator(
  a: LocalCoordinatorDescriptor,
  b: LocalCoordinatorDescriptor
): boolean {
  return (
    a.transportVersion === b.transportVersion &&
    a.instanceId === b.instanceId &&
    a.pid === b.pid &&
    a.httpsPort === b.httpsPort &&
    a.grpcPort === b.grpcPort &&
    a.certificatePem === b.certificatePem &&
    a.bearerToken === b.bearerToken &&
    sameSupervisor(a.supervisor, b.supervisor)
  );
}

export interface LocalCoordinatorDescriptor {
  transportVersion: 1;
  instanceId: string;
  pid: number;
  httpsPort: number;
  grpcPort: number | null;
  certificatePem: string;
  bearerToken: string;
  supervisor: SupervisorBinding | null;
}

export class CoordinatorSecurityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoordinatorSecurityError';
  }
}

export function getCoordinatorDataDir(): string {
  return resolve(
    process.env.HAN_DATA_DIR ||
      (process.env.CLAUDE_CONFIG_DIR
        ? join(process.env.CLAUDE_CONFIG_DIR, 'han')
        : join(homedir(), '.han'))
  );
}

export function readCoordinatorDescriptor(
  path = join(getCoordinatorDataDir(), 'runtime', 'coordinator.json')
): LocalCoordinatorDescriptor {
  if (process.platform === 'win32') {
    throw new CoordinatorSecurityError(
      'Windows coordinator descriptor ACL and reparse-point verification is not available'
    );
  }
  const runtime = join(getCoordinatorDataDir(), 'runtime');
  let fd: number | undefined;
  try {
    const directory = lstatSync(runtime);
    if (!directory.isDirectory() || directory.isSymbolicLink())
      throw new CoordinatorSecurityError(
        'Invalid coordinator runtime directory'
      );
    if (directory.mode & 0o077 || directory.uid !== process.getuid?.())
      throw new CoordinatorSecurityError(
        'Coordinator runtime directory is not owner-protected'
      );
    fd = openSync(path, constants.O_RDONLY | (constants.O_NOFOLLOW || 0));
    const stat = fstatSync(fd);
    if (!stat.isFile() || stat.mode & 0o077 || stat.uid !== process.getuid?.())
      throw new CoordinatorSecurityError(
        'Coordinator descriptor is not owner-protected'
      );
    const d = JSON.parse(
      readFileSync(fd, 'utf8')
    ) as LocalCoordinatorDescriptor;
    const validPort = (n: unknown) =>
      Number.isInteger(n) && (n as number) > 0 && (n as number) < 65536;
    if (d.transportVersion !== LOCAL_TRANSPORT_VERSION)
      throw new CoordinatorSecurityError(
        'UPGRADE_REQUIRED: unsupported coordinator transport version'
      );
    if (
      typeof d.instanceId !== 'string' ||
      !d.instanceId ||
      !Number.isSafeInteger(d.pid) ||
      d.pid <= 0 ||
      !validPort(d.httpsPort) ||
      !(d.grpcPort === null || validPort(d.grpcPort)) ||
      typeof d.certificatePem !== 'string' ||
      !d.certificatePem.includes('-----BEGIN CERTIFICATE-----') ||
      typeof d.bearerToken !== 'string' ||
      !(d.supervisor === null || validSupervisorBinding(d.supervisor)) ||
      !/^[A-Za-z0-9_-]{43}$/.test(d.bearerToken)
    )
      throw new CoordinatorSecurityError('Invalid coordinator descriptor');
    return d;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') throw error;
    if (error instanceof CoordinatorSecurityError) throw error;
    throw new CoordinatorSecurityError(
      `Cannot read coordinator descriptor: ${error instanceof Error ? error.message : String(error)}`
    );
  } finally {
    if (fd !== undefined) closeSync(fd);
  }
}

export async function coordinatorFetch(
  descriptor: LocalCoordinatorDescriptor,
  port: number,
  path: string,
  init: RequestInit = {}
): Promise<Response> {
  if (!path.startsWith('/') || path.startsWith('//'))
    throw new CoordinatorSecurityError('Invalid coordinator request path');
  const headers = new Headers(init.headers);
  headers.set('Authorization', `Bearer ${descriptor.bearerToken}`);
  let response: Response;
  try {
    response = await fetch(`https://127.0.0.1:${port}${path}`, {
      ...init,
      headers,
      redirect: 'error',
      tls: { ca: descriptor.certificatePem, rejectUnauthorized: true },
    } as RequestInit);
  } catch (error) {
    throw new CoordinatorSecurityError(
      `Coordinator connection failed: ${error instanceof Error ? error.message : String(error)}`
    );
  }
  if (
    response.status === 401 ||
    response.status === 403 ||
    response.status === 421
  )
    throw new CoordinatorSecurityError(
      `Coordinator rejected authenticated request (${response.status})`
    );
  return response;
}

export function coordinatorRequest(
  path: string,
  init?: RequestInit
): Promise<Response> {
  const descriptor = readCoordinatorDescriptor();
  return coordinatorFetch(descriptor, descriptor.httpsPort, path, init);
}

export function coordinatorWebSocket(
  path: string,
  protocols?: string | string[]
): WebSocket {
  if (!path.startsWith('/') || path.startsWith('//'))
    throw new CoordinatorSecurityError('Invalid coordinator WebSocket path');
  const descriptor = readCoordinatorDescriptor();
  return new WebSocket(
    `wss://127.0.0.1:${descriptor.httpsPort}${path}`,
    protocols,
    {
      ca: descriptor.certificatePem,
      rejectUnauthorized: true,
      headers: { Authorization: `Bearer ${descriptor.bearerToken}` },
    }
  );
}
