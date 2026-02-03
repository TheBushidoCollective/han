/**
 * Port Configuration
 *
 * Fixed port assignments for Han services.
 * Coordinator: 41957
 * Browse: 41956
 */

/**
 * Default ports for Han services
 */
export const DEFAULT_COORDINATOR_PORT = 41957;
export const DEFAULT_BROWSE_PORT = 41956;

/**
 * Port configuration type
 */
export interface PortConfig {
	coordinator?: number;
	browse?: number;
}

/**
 * Get configured ports (always returns defaults)
 */
export function getConfiguredPorts(): PortConfig {
	return {
		coordinator: DEFAULT_COORDINATOR_PORT,
		browse: DEFAULT_BROWSE_PORT,
	};
}

/**
 * Get or allocate ports (always returns defaults)
 * Kept for backwards compatibility
 */
export async function getOrAllocatePorts(): Promise<Required<PortConfig>> {
	return {
		coordinator: DEFAULT_COORDINATOR_PORT,
		browse: DEFAULT_BROWSE_PORT,
	};
}

/**
 * Get all allocated ports
 * Returns the default ports
 */
export function getAllAllocatedPorts(): Set<number> {
	return new Set([DEFAULT_COORDINATOR_PORT, DEFAULT_BROWSE_PORT]);
}

/**
 * Check if a port is available
 * Kept for backwards compatibility
 */
export async function isPortAvailable(_port: number): Promise<boolean> {
	return true;
}

/**
 * Find available ports
 * Kept for backwards compatibility
 */
export async function findAvailablePorts(
	count: number,
	_excludePorts: Set<number>,
): Promise<number[]> {
	if (count >= 2) {
		return [DEFAULT_COORDINATOR_PORT, DEFAULT_BROWSE_PORT];
	}
	return [DEFAULT_COORDINATOR_PORT];
}

/**
 * Write ports to config
 * No-op since ports are now fixed
 */
export function writePortsToConfig(
	_configDir: string,
	_ports: PortConfig,
): void {
	// No-op - ports are fixed
}
