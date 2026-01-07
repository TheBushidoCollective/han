/**
 * Types for Coordinator Daemon
 */

import {
	DEFAULT_BROWSE_PORT,
	DEFAULT_COORDINATOR_PORT,
	getConfiguredPorts,
} from "../../config/port-allocation.ts";

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
export const PID_FILE = ".han-coordinator.pid";

/**
 * Log file location (relative to ~/.claude/han/)
 */
export const LOG_FILE = "han/coordinator.log";

// Re-export defaults for backwards compatibility
export { DEFAULT_BROWSE_PORT, DEFAULT_COORDINATOR_PORT };

/**
 * Get the coordinator port
 *
 * Priority (highest to lowest):
 * 1. HAN_COORDINATOR_PORT environment variable
 * 2. ports.coordinator in han.yml config
 * 3. Default port (41957)
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

	// Check config file
	const configuredPorts = getConfiguredPorts();
	if (configuredPorts.coordinator) {
		return configuredPorts.coordinator;
	}

	return DEFAULT_COORDINATOR_PORT;
}

/**
 * Get the browse port
 *
 * Priority (highest to lowest):
 * 1. HAN_BROWSE_PORT environment variable
 * 2. ports.browse in han.yml config
 * 3. Default port (41956)
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

	// Check config file
	const configuredPorts = getConfiguredPorts();
	if (configuredPorts.browse) {
		return configuredPorts.browse;
	}

	return DEFAULT_BROWSE_PORT;
}

// Legacy exports for backwards compatibility
export const COORDINATOR_PORT = DEFAULT_COORDINATOR_PORT;
export const BROWSE_PORT = DEFAULT_BROWSE_PORT;
