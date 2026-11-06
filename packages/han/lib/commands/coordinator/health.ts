import { connect } from 'node:net';
import {
  CoordinatorSecurityError,
  coordinatorRequest,
  readCoordinatorDescriptor,
} from '../../coordinator/connection.ts';
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

export async function checkHealth(
  port?: number,
  starting = false
): Promise<HealthCheckResponse | null> {
  try {
    const descriptor = readCoordinatorDescriptor();
    if (port !== undefined && port !== 0 && port !== descriptor.httpsPort)
      throw new CoordinatorSecurityError(
        'Coordinator descriptor port does not match requested port'
      );
    const response = await coordinatorRequest('/health', {
      signal: AbortSignal.timeout(2000),
    });
    if (!response.ok)
      throw new CoordinatorSecurityError(
        `Coordinator health rejected (${response.status})`
      );
    return (await response.json()) as HealthCheckResponse;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      if (!starting && (await portOccupied(port ?? getCoordinatorPort())))
        throw new CoordinatorSecurityError(
          'UPGRADE_REQUIRED: occupied coordinator port has no compatible descriptor; identify and stop its owner'
        );
      return null;
    }
    if (error instanceof CoordinatorSecurityError) throw error;
    throw new CoordinatorSecurityError(
      `Coordinator TLS or authentication failed: ${error instanceof Error ? error.message : String(error)}`
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
  intervalMs = 200
): Promise<boolean> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    if ((await checkHealth(port, true))?.status === 'ok') return true;
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }
  return false;
}

export async function isCoordinatorRunning(port?: number): Promise<boolean> {
  return (await checkHealth(port))?.status === 'ok';
}
