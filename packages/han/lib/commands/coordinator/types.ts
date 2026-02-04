/**
 * Types for Coordinator Daemon
 *
 * Includes status, options, and port configuration types.
 */

/**
 * Fixed port assignments for Han services
 */
export const DEFAULT_COORDINATOR_PORT = 41957;
export const DEFAULT_BROWSE_PORT = 41956;

// Legacy exports for backwards compatibility
export const COORDINATOR_PORT = DEFAULT_COORDINATOR_PORT;
export const BROWSE_PORT = DEFAULT_BROWSE_PORT;

/**
 * Coordinator daemon status
 */
export interface CoordinatorStatus {
  running: boolean;
  pid?: number;
  port: number;
  uptime?: number; // seconds
  startedAt?: string; // ISO timestamp
}

/**
 * Coordinator daemon options
 */
export interface CoordinatorOptions {
  port?: number;
  foreground?: boolean; // Run in foreground (don't daemonize)
}

/**
 * PID file location
 */
export const PID_FILE = '.han-coordinator.pid';

/**
 * Log file location (relative to ~/.claude/han/)
 */
export const LOG_FILE = 'han/coordinator.log';

/**
 * Get the coordinator port
 *
 * Priority (highest to lowest):
 * 1. HAN_COORDINATOR_PORT environment variable
 * 2. Default port (41957)
 */
export function getCoordinatorPort(): number {
  // Environment variable takes highest priority
  const envPort = process.env.HAN_COORDINATOR_PORT;
  if (envPort) {
    const port = parseInt(envPort, 10);
    if (!Number.isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }

  return DEFAULT_COORDINATOR_PORT;
}

/**
 * Get the browse port
 *
 * Priority (highest to lowest):
 * 1. HAN_BROWSE_PORT environment variable
 * 2. Default port (41956)
 */
export function getBrowsePort(): number {
  // Environment variable takes highest priority
  const envPort = process.env.HAN_BROWSE_PORT;
  if (envPort) {
    const port = parseInt(envPort, 10);
    if (!Number.isNaN(port) && port > 0 && port < 65536) {
      return port;
    }
  }

  return DEFAULT_BROWSE_PORT;
}
