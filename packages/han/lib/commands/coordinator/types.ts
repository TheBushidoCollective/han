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
 * Coordinator FQDN. The coordinator serves HTTPS under this name so that
 * browsers get a valid certificate when real certs are available.
 */
export const COORDINATOR_HOST = 'coordinator.local.han.guru';

/**
 * Fetch options for talking to the local coordinator over HTTPS.
 *
 * When no Let's Encrypt cert has been cached the coordinator falls back to a
 * self-signed one, which every default TLS client rejects. Bun and Node accept
 * the override only under a nested `tls` key; a top-level `rejectUnauthorized`
 * is silently ignored and the request still throws `self signed certificate`.
 *
 * Skipping verification is safe here and only here: the connection is to a
 * loopback port owned by a process on this machine, so a CA chain proves
 * nothing that the port itself does not.
 */
export const COORDINATOR_TLS_FETCH_OPTIONS = {
  tls: { rejectUnauthorized: false },
} as const;

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

// PID and log files now live in ~/.han/ (see daemon.ts getLogFilePath/getPidFilePath)

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
