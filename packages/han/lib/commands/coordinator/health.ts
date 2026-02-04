/**
 * Health Check for Coordinator Daemon
 *
 * Provides utilities to check if the coordinator is running
 * and healthy by making HTTPS requests to the health endpoint.
 */

import { getCoordinatorPort } from './types.ts';

/**
 * Coordinator FQDN for HTTPS connections
 */
const COORDINATOR_HOST = 'coordinator.local.han.guru';

/**
 * Health check response
 */
export interface HealthCheckResponse {
  status: 'ok' | 'error';
  pid?: number;
  uptime?: number;
  version?: string;
}

/**
 * Check if the coordinator daemon is running and healthy
 * Uses HTTPS with the coordinator FQDN
 */
export async function checkHealth(
  port?: number
): Promise<HealthCheckResponse | null> {
  const effectivePort = port ?? getCoordinatorPort();

  try {
    const response = await fetch(
      `https://${COORDINATOR_HOST}:${effectivePort}/health`,
      {
        signal: AbortSignal.timeout(2000),
        // @ts-expect-error - Node.js/Bun fetch option for self-signed certs
        rejectUnauthorized: false,
      }
    );

    if (response.ok) {
      return (await response.json()) as HealthCheckResponse;
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Check if the coordinator is running with HTTPS/TLS enabled
 * Returns the protocol and host if successful
 */
export async function checkHealthHttps(port?: number): Promise<{
  protocol: 'https';
  host: string;
  health: HealthCheckResponse;
} | null> {
  const effectivePort = port ?? getCoordinatorPort();

  try {
    const response = await fetch(
      `https://${COORDINATOR_HOST}:${effectivePort}/health`,
      {
        signal: AbortSignal.timeout(2000),
        // @ts-expect-error - Node.js/Bun fetch option for self-signed certs
        rejectUnauthorized: false,
      }
    );

    if (response.ok) {
      const health = (await response.json()) as HealthCheckResponse;
      return {
        protocol: 'https',
        host: COORDINATOR_HOST,
        health,
      };
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Wait for the coordinator to become healthy
 *
 * @param port - Port to check
 * @param timeoutMs - Maximum time to wait
 * @param intervalMs - Time between checks
 * @returns True if coordinator became healthy, false if timed out
 */
export async function waitForHealth(
  port?: number,
  timeoutMs: number = 10000,
  intervalMs: number = 200
): Promise<boolean> {
  const effectivePort = port ?? getCoordinatorPort();
  const startTime = Date.now();

  while (Date.now() - startTime < timeoutMs) {
    const health = await checkHealth(effectivePort);
    if (health?.status === 'ok') {
      return true;
    }
    await new Promise((resolve) => setTimeout(resolve, intervalMs));
  }

  return false;
}

/**
 * Check if coordinator is running (quick check)
 */
export async function isCoordinatorRunning(port?: number): Promise<boolean> {
  const effectivePort = port ?? getCoordinatorPort();
  const health = await checkHealth(effectivePort);
  return health?.status === 'ok';
}
