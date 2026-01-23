/**
 * Coordinator Auto-Discovery
 *
 * Scans the known Han port range (41900-41999) to find running coordinators.
 * This allows the dashboard to automatically discover and connect to available
 * coordinator instances without manual configuration.
 */

import type { Environment } from './environments.ts';

/**
 * Han port range for coordinator services
 * Matches PORT_RANGE_START and PORT_RANGE_END from packages/han/lib/config/port-allocation.ts
 */
const PORT_RANGE_START = 41900;
const PORT_RANGE_END = 41999;

/**
 * Default ports to check first (most likely to be in use)
 */
const PRIORITY_PORTS = [41957, 41956, 41900, 41901];

/**
 * Probe a single port to see if a coordinator is running
 */
async function probeCoordinator(port: number): Promise<boolean> {
  const protocol = 'https'; // coordinator.local.han.guru uses HTTPS
  const url = `${protocol}://coordinator.local.han.guru:${port}/graphql`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1000); // 1s timeout

    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query: '{ __typename }' }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) return false;

    const data = await response.json();
    return data?.data?.__typename === 'Query';
  } catch {
    return false;
  }
}

/**
 * Scan a range of ports for running coordinators
 */
export async function discoverCoordinators(
  signal?: AbortSignal
): Promise<Environment[]> {
  const environments: Environment[] = [];

  // Check priority ports first
  for (const port of PRIORITY_PORTS) {
    if (signal?.aborted) break;

    const isRunning = await probeCoordinator(port);
    if (isRunning) {
      environments.push({
        id: `discovered-${port}`,
        name: port === 41957 ? 'Default Local' : `Local (port ${port})`,
        coordinatorUrl: `https://coordinator.local.han.guru:${port}`,
        wsUrl: `wss://coordinator.local.han.guru:${port}`,
        lastConnected: new Date().toISOString(),
      });
    }
  }

  // If we found any on priority ports, return early
  if (environments.length > 0) {
    return environments;
  }

  // Scan remaining ports in the range
  for (let port = PORT_RANGE_START; port <= PORT_RANGE_END; port++) {
    if (signal?.aborted) break;
    if (PRIORITY_PORTS.includes(port)) continue; // Already checked

    const isRunning = await probeCoordinator(port);
    if (isRunning) {
      environments.push({
        id: `discovered-${port}`,
        name: `Local (port ${port})`,
        coordinatorUrl: `https://coordinator.local.han.guru:${port}`,
        wsUrl: `wss://coordinator.local.han.guru:${port}`,
        lastConnected: new Date().toISOString(),
      });
    }
  }

  return environments;
}

/**
 * Quick check for the most likely coordinator port
 * Returns immediately on first success for faster initial load
 */
export async function quickDiscoverCoordinator(): Promise<Environment | null> {
  // Check priority ports in parallel
  const results = await Promise.allSettled(
    PRIORITY_PORTS.map(async (port) => {
      const isRunning = await probeCoordinator(port);
      return { port, isRunning };
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled' && result.value.isRunning) {
      const port = result.value.port;
      return {
        id: `discovered-${port}`,
        name: port === 41957 ? 'Default Local' : `Local (port ${port})`,
        coordinatorUrl: `https://coordinator.local.han.guru:${port}`,
        wsUrl: `wss://coordinator.local.han.guru:${port}`,
        lastConnected: new Date().toISOString(),
      };
    }
  }

  return null;
}
