/**
 * Port Allocation System
 *
 * Manages unique port allocation for Han services across multiple
 * CLAUDE_CONFIG_DIR environments to prevent conflicts.
 *
 * Strategy:
 * 1. First check if ports are already configured in han.yml
 * 2. If not, scan for other Han installations and their port allocations
 * 3. Allocate new unique ports and persist to han.yml
 */

import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readdirSync,
	readFileSync,
	renameSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { createServer } from "node:net";
import { homedir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import { getClaudeConfigDir } from "./claude-settings.ts";
import type { HanConfig, PortConfig } from "./han-settings.ts";

/**
 * Acquire a file-based lock with timeout
 * Uses atomic file creation to prevent race conditions
 */
function acquireFileLock(
	lockPath: string,
	timeout = 10000,
): { release: () => void } | null {
	const startTime = Date.now();
	const pid = process.pid;

	while (Date.now() - startTime < timeout) {
		try {
			// O_CREAT | O_EXCL ensures atomic creation - fails if file exists
			const fd = openSync(lockPath, "wx");
			writeFileSync(fd, String(pid));
			closeSync(fd);

			return {
				release: () => {
					try {
						// Only delete if we own the lock
						const content = readFileSync(lockPath, "utf-8").trim();
						if (content === String(pid)) {
							unlinkSync(lockPath);
						}
					} catch {
						// Ignore errors during cleanup
					}
				},
			};
		} catch (err) {
			if ((err as NodeJS.ErrnoException).code === "EEXIST") {
				// Lock exists, check if stale (process dead or lock too old)
				try {
					const lockPid = parseInt(readFileSync(lockPath, "utf-8").trim(), 10);
					let isStale = false;

					// Check if holding process is dead
					try {
						process.kill(lockPid, 0);
					} catch {
						isStale = true;
					}

					if (isStale) {
						// Remove stale lock and retry
						try {
							unlinkSync(lockPath);
						} catch {
							// Another process may have removed it
						}
						continue;
					}
				} catch {
					// Can't read lock file, try to remove it
					try {
						unlinkSync(lockPath);
					} catch {
						// Ignore
					}
					continue;
				}

				// Lock is held by active process, wait and retry
				Bun.sleepSync(50);
				continue;
			}
			throw err;
		}
	}

	return null; // Timeout
}

/**
 * Default port range for Han services
 * We use ports in the 41900-41999 range to avoid common conflicts
 */
const PORT_RANGE_START = 41900;
const PORT_RANGE_END = 41999;

/**
 * Default ports (used for the primary/default config)
 */
export const DEFAULT_COORDINATOR_PORT = 41957;
export const DEFAULT_BROWSE_PORT = 41956;

/**
 * Known locations where Han configs might exist
 */
function getKnownConfigLocations(): string[] {
	const locations: string[] = [];
	const home = homedir();

	// Default .claude directory
	locations.push(join(home, ".claude"));

	// Common alternative config locations
	locations.push(join(home, ".claude-dev"));
	locations.push(join(home, ".claude-test"));
	locations.push(join(home, ".claude-staging"));

	// XDG config home
	const xdgConfig = process.env.XDG_CONFIG_HOME || join(home, ".config");
	locations.push(join(xdgConfig, "claude"));

	// Check for CLAUDE_CONFIG_DIR variants in common locations
	const devDirs = [
		join(home, "dev"),
		join(home, "Development"),
		join(home, "projects"),
		join(home, "work"),
	];

	for (const devDir of devDirs) {
		if (existsSync(devDir)) {
			try {
				const entries = readdirSync(devDir, { withFileTypes: true });
				for (const entry of entries) {
					if (entry.isDirectory()) {
						const potentialConfig = join(devDir, entry.name, ".claude");
						if (existsSync(potentialConfig)) {
							locations.push(potentialConfig);
						}
					}
				}
			} catch {
				// Skip directories we can't read
			}
		}
	}

	return [...new Set(locations)]; // Deduplicate
}

/**
 * Read Han config from a config directory
 */
function readHanConfigFromDir(configDir: string): HanConfig | null {
	const hanYmlPath = join(configDir, "han.yml");
	if (!existsSync(hanYmlPath)) {
		return null;
	}

	try {
		const content = readFileSync(hanYmlPath, "utf-8");
		const config = YAML.parse(content);
		return config || null;
	} catch {
		return null;
	}
}

/**
 * Get all allocated ports across known Han installations
 */
export function getAllAllocatedPorts(): Set<number> {
	const allocatedPorts = new Set<number>();

	// Include known locations
	const locations = getKnownConfigLocations();

	// Also include the current CLAUDE_CONFIG_DIR if set
	const currentConfigDir = getClaudeConfigDir();
	if (currentConfigDir && !locations.includes(currentConfigDir)) {
		locations.push(currentConfigDir);
	}

	for (const configDir of locations) {
		const config = readHanConfigFromDir(configDir);
		if (config?.ports) {
			if (config.ports.coordinator) {
				allocatedPorts.add(config.ports.coordinator);
			}
			if (config.ports.browse) {
				allocatedPorts.add(config.ports.browse);
			}
		}
	}

	return allocatedPorts;
}

/**
 * Check if a port is available (not in use)
 */
export async function isPortAvailable(port: number): Promise<boolean> {
	return new Promise((resolve) => {
		const server = createServer();

		server.once("error", (err: NodeJS.ErrnoException) => {
			if (err.code === "EADDRINUSE") {
				resolve(false);
			} else {
				// Other errors - treat as unavailable to be safe
				resolve(false);
			}
		});

		server.once("listening", () => {
			server.close(() => resolve(true));
		});

		server.listen(port, "127.0.0.1");
	});
}

/**
 * Find available ports that don't conflict with existing allocations
 */
export async function findAvailablePorts(
	count: number,
	excludePorts: Set<number>,
): Promise<number[]> {
	const availablePorts: number[] = [];

	for (
		let port = PORT_RANGE_START;
		port <= PORT_RANGE_END && availablePorts.length < count;
		port++
	) {
		if (excludePorts.has(port)) {
			continue;
		}

		// Check if port is actually available on the system
		if (await isPortAvailable(port)) {
			availablePorts.push(port);
			excludePorts.add(port); // Don't use same port twice
		}
	}

	if (availablePorts.length < count) {
		throw new Error(
			`Could not find ${count} available ports in range ${PORT_RANGE_START}-${PORT_RANGE_END}`,
		);
	}

	return availablePorts;
}

/**
 * Write ports to the user's han.yml config
 * Uses atomic write pattern (write to temp, rename) for safety
 */
export function writePortsToConfig(configDir: string, ports: PortConfig): void {
	const hanYmlPath = join(configDir, "han.yml");

	// Ensure config directory exists (safe - mkdirSync with recursive is idempotent)
	try {
		mkdirSync(configDir, { recursive: true });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
			throw err;
		}
	}

	// Read existing config or create new
	let config: HanConfig = {};
	if (existsSync(hanYmlPath)) {
		try {
			const content = readFileSync(hanYmlPath, "utf-8");
			config = YAML.parse(content) || {};
		} catch {
			// Invalid YAML - start fresh
			config = {};
		}
	}

	// Update ports
	config.ports = {
		...config.ports,
		...ports,
	};

	// Atomic write: write to temp file, then rename
	const tempPath = `${hanYmlPath}.${process.pid}.${Date.now()}.tmp`;
	const yamlContent = YAML.stringify(config, {
		indent: 2,
		lineWidth: 0,
	});

	try {
		writeFileSync(tempPath, yamlContent, "utf-8");
		renameSync(tempPath, hanYmlPath);
	} catch (err) {
		// Clean up temp file on error
		try {
			unlinkSync(tempPath);
		} catch {
			// Ignore cleanup errors
		}
		throw err;
	}
}

/**
 * Get or allocate ports for the current Han instance
 *
 * This function:
 * 1. Checks if ports are already configured
 * 2. If not, allocates unique ports avoiding conflicts
 * 3. Persists the allocation to han.yml
 *
 * Uses file locking to prevent race conditions when multiple
 * processes try to allocate ports simultaneously.
 *
 * @param forceReallocate - Force reallocation even if ports are configured
 * @returns The port configuration
 */
export async function getOrAllocatePorts(
	forceReallocate = false,
): Promise<Required<PortConfig>> {
	const configDir = getClaudeConfigDir();

	// Check if ports are already configured (fast path, no lock needed)
	if (!forceReallocate) {
		const config = readHanConfigFromDir(configDir);
		if (config?.ports?.coordinator && config?.ports?.browse) {
			return {
				coordinator: config.ports.coordinator,
				browse: config.ports.browse,
			};
		}
	}

	// Acquire lock before allocating to prevent race conditions
	// Ensure config dir exists for lock file
	try {
		mkdirSync(configDir, { recursive: true });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
			throw err;
		}
	}

	const lockPath = join(configDir, "han-ports.lock");
	const lock = acquireFileLock(lockPath);

	if (!lock) {
		throw new Error("Failed to acquire port allocation lock (timeout)");
	}

	try {
		// Re-check after acquiring lock (another process may have allocated)
		if (!forceReallocate) {
			const config = readHanConfigFromDir(configDir);
			if (config?.ports?.coordinator && config?.ports?.browse) {
				return {
					coordinator: config.ports.coordinator,
					browse: config.ports.browse,
				};
			}
		}

		// Get all allocated ports from other Han installations
		const allocatedPorts = getAllAllocatedPorts();

		// Check if this is the default config directory
		const defaultConfigDir = join(homedir(), ".claude");
		const isDefaultConfig =
			configDir === defaultConfigDir ||
			(!process.env.CLAUDE_CONFIG_DIR && configDir === defaultConfigDir);

		let coordinator: number;
		let browse: number;

		if (isDefaultConfig && !allocatedPorts.has(DEFAULT_COORDINATOR_PORT)) {
			// Use default ports for the default config if available
			coordinator = DEFAULT_COORDINATOR_PORT;
			browse = DEFAULT_BROWSE_PORT;

			// Double-check they're not in use
			const coordAvailable = await isPortAvailable(coordinator);
			const browseAvailable = await isPortAvailable(browse);

			if (!coordAvailable || !browseAvailable) {
				// Default ports are in use, allocate new ones
				const ports = await findAvailablePorts(2, allocatedPorts);
				coordinator = ports[0];
				browse = ports[1];
			}
		} else {
			// Allocate unique ports for non-default config
			const ports = await findAvailablePorts(2, allocatedPorts);
			coordinator = ports[0];
			browse = ports[1];
		}

		// Persist the allocation
		const portConfig: Required<PortConfig> = { coordinator, browse };
		writePortsToConfig(configDir, portConfig);

		return portConfig;
	} finally {
		lock.release();
	}
}

/**
 * Get currently configured ports (without allocating)
 * Returns undefined values if not configured
 */
export function getConfiguredPorts(): PortConfig {
	const configDir = getClaudeConfigDir();
	const config = readHanConfigFromDir(configDir);
	return config?.ports || {};
}
