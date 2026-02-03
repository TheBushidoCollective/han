/**
 * Coordinator Port Configuration
 *
 * Extracts the coordinator port from URL query parameter or uses default.
 */

/**
 * Default coordinator port for local development
 * Matches DEFAULT_COORDINATOR_PORT in packages/han
 */
export const DEFAULT_COORDINATOR_PORT = 41957;

/**
 * Get coordinator port from URL query parameter or default
 * The han browse command passes ?coordinatorPort=XXXX in hosted mode
 */
export function getCoordinatorPort(): number {
  if (typeof window === 'undefined') {
    return DEFAULT_COORDINATOR_PORT;
  }
  const params = new URLSearchParams(window.location.search);
  const portParam = params.get('coordinatorPort');
  if (portParam) {
    const port = parseInt(portParam, 10);
    if (!Number.isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }
  return DEFAULT_COORDINATOR_PORT;
}
