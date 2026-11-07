import { connect } from 'node:net';
import {
  CoordinatorPortOccupiedError,
  CoordinatorSecurityError,
  coordinatorFetch,
  getCoordinatorDataDir,
  type LocalCoordinatorDescriptor,
  readCoordinatorDescriptor,
  sameCoordinator,
  validateCoordinatorDescriptor,
} from '../../coordinator/connection.ts';
import {
  validWindowsProcessIdentity,
  windowsProcessState,
} from '../../coordinator/windows-runtime.ts';
import { getCoordinatorPort } from './types.ts';

export interface HealthCheckResponse {
  status: 'ok' | 'error';
  pid?: number;
  uptime?: number;
  version?: string;
}

async function portOccupied(port: number): Promise<boolean> {
  return new Promise((resolve) => {
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
  });
}
function processIsDead(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return false;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ESRCH') return true;
    if ((error as NodeJS.ErrnoException).code === 'EPERM') return false;
    throw new CoordinatorSecurityError(
      'Cannot establish coordinator process liveness'
    );
  }
}

async function portRefusesConnection(port: number): Promise<boolean> {
  const { promise, resolve, reject } = Promise.withResolvers<boolean>();
  const socket = connect({ host: '127.0.0.1', port });
  socket.setTimeout(2000);
  socket.once('connect', () => {
    socket.destroy();
    resolve(false);
  });
  socket.once('error', (error: NodeJS.ErrnoException) => {
    socket.destroy();
    if (error.code === 'ECONNREFUSED') resolve(true);
    else
      reject(
        new CoordinatorSecurityError(
          `Cannot establish coordinator listener state: ${error.code ?? error.message}`
        )
      );
  });
  socket.once('timeout', () => {
    socket.destroy();
    reject(
      new CoordinatorSecurityError('Coordinator listener probe timed out')
    );
  });
  return promise;
}

export function descriptorIsDead(
  descriptor: LocalCoordinatorDescriptor
): boolean {
  validateCoordinatorDescriptor(descriptor);
  if (process.platform === 'win32') {
    if (!validWindowsProcessIdentity(descriptor.process))
      throw new CoordinatorSecurityError('Missing Windows process identity');
    return (
      windowsProcessState(getCoordinatorDataDir(), descriptor.process) ===
      'gone'
    );
  }
  return processIsDead(descriptor.pid);
}

export function readOptionalDescriptor(): LocalCoordinatorDescriptor | null {
  try {
    return readCoordinatorDescriptor();
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return null;
    throw error;
  }
}

export async function checkStartupObserver(
  port: number,
  predecessor: LocalCoordinatorDescriptor | null
): Promise<boolean> {
  const selected = readOptionalDescriptor();
  if (!selected) return false;
  if (predecessor && sameCoordinator(selected, predecessor)) {
    if (!descriptorIsDead(predecessor))
      throw new CoordinatorSecurityError('Previous coordinator is still alive');
    return false;
  }
  if (descriptorIsDead(selected))
    throw new CoordinatorSecurityError('Unexpected dead startup candidate');
  await checkDescriptorHealth(selected, port);
  const current = readOptionalDescriptor();
  if (!current || !sameCoordinator(current, selected))
    throw new CoordinatorSecurityError(
      'Coordinator descriptor changed during health check'
    );
  return true;
}

export async function checkDescriptorHealth(
  descriptor: LocalCoordinatorDescriptor,
  requestedPort?: number
): Promise<HealthCheckResponse> {
  validateCoordinatorDescriptor(descriptor);
  if (
    requestedPort !== undefined &&
    requestedPort !== 0 &&
    (!Number.isInteger(requestedPort) ||
      requestedPort < 1 ||
      requestedPort > 65535 ||
      requestedPort !== descriptor.httpsPort)
  )
    throw new CoordinatorSecurityError(
      'Coordinator descriptor port does not match requested port'
    );
  const response = await coordinatorFetch(
    descriptor,
    descriptor.httpsPort,
    '/health',
    {
      signal: AbortSignal.timeout(2000),
    }
  );
  if (!response.ok)
    throw new CoordinatorSecurityError(
      `Coordinator health rejected (${response.status})`
    );
  const health = (await response.json()) as HealthCheckResponse;
  if (health?.status !== 'ok' || health.pid !== descriptor.pid)
    throw new CoordinatorSecurityError('Coordinator health identity mismatch');
  return health;
}

export async function checkHealth(
  port?: number,
  starting = false
): Promise<HealthCheckResponse | null> {
  try {
    const descriptor = readCoordinatorDescriptor();
    if (
      (process.platform === 'win32'
        ? validWindowsProcessIdentity(descriptor.process) &&
          windowsProcessState(getCoordinatorDataDir(), descriptor.process) ===
            'gone'
        : processIsDead(descriptor.pid)) &&
      (await portRefusesConnection(descriptor.httpsPort))
    ) {
      const current = readCoordinatorDescriptor();
      if (!sameCoordinator(current, descriptor))
        throw new CoordinatorSecurityError(
          'Coordinator descriptor changed during stale-instance check'
        );
      return null;
    }
    return await checkDescriptorHealth(descriptor, port);
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      if (!starting && (await portOccupied(port ?? getCoordinatorPort())))
        throw new CoordinatorPortOccupiedError(
          'UPGRADE_REQUIRED: occupied coordinator port has no compatible descriptor; identify and stop its owner'
        );
      return null;
    }
    if (error instanceof CoordinatorSecurityError) throw error;
    throw new CoordinatorSecurityError(
      `Coordinator TLS or authentication failed: ${error instanceof Error ? error.message : String(error)}`,
      { cause: error }
    );
  }
}

export async function checkHealthHttps(port?: number): Promise<{
  protocol: 'https';
  host: string;
  health: HealthCheckResponse;
} | null> {
  const health = await checkHealth(port);
  return health ? { protocol: 'https', host: '127.0.0.1', health } : null;
}

export async function waitForHealth(
  port?: number,
  timeoutMs = 10000,
  intervalMs = 200,
  predecessor: LocalCoordinatorDescriptor | null = null
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if (await checkStartupObserver(port ?? getCoordinatorPort(), predecessor))
      return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

export async function isCoordinatorRunning(port?: number): Promise<boolean> {
  return (await checkHealth(port))?.status === 'ok';
}
