/**
 * Unit tests for port-allocation.ts
 * Tests port allocation and conflict detection for Han services
 */
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
	existsSync,
	mkdirSync,
	readFileSync,
	rmSync,
	writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import YAML from "yaml";
import type { HanConfig } from "../lib/config/han-settings.ts";
import {
	DEFAULT_BROWSE_PORT,
	DEFAULT_COORDINATOR_PORT,
	findAvailablePorts,
	getAllAllocatedPorts,
	getConfiguredPorts,
	getOrAllocatePorts,
	isPortAvailable,
	writePortsToConfig,
} from "../lib/config/port-allocation.ts";

// Store original environment
const originalEnv = { ...process.env };

let tempConfigDir: string;
let tempConfigDir2: string;

function setup(): void {
	const random = Math.random().toString(36).substring(2, 9);
	tempConfigDir = join(tmpdir(), `han-test-port-${Date.now()}-${random}`);
	tempConfigDir2 = join(tmpdir(), `han-test-port2-${Date.now()}-${random}`);

	mkdirSync(tempConfigDir, { recursive: true });
	mkdirSync(tempConfigDir2, { recursive: true });

	// Set test config directory
	process.env.CLAUDE_CONFIG_DIR = tempConfigDir;
}

function teardown(): void {
	// Restore environment
	process.env = { ...originalEnv };

	// Clean up temp directories
	for (const dir of [tempConfigDir, tempConfigDir2]) {
		if (dir && existsSync(dir)) {
			try {
				rmSync(dir, { recursive: true, force: true });
			} catch {
				// Ignore cleanup errors
			}
		}
	}
}

describe.serial("port-allocation.ts", () => {
	beforeEach(() => {
		setup();
	});

	afterEach(() => {
		teardown();
	});

	describe("DEFAULT_COORDINATOR_PORT and DEFAULT_BROWSE_PORT", () => {
		test("has expected default values", () => {
			expect(DEFAULT_COORDINATOR_PORT).toBe(41957);
			expect(DEFAULT_BROWSE_PORT).toBe(41956);
		});
	});

	describe("isPortAvailable", () => {
		test("returns true for unused port", async () => {
			// Use a high port that's unlikely to be in use
			const available = await isPortAvailable(49999);
			expect(available).toBe(true);
		});

		test("returns false for port in use", async () => {
			// Start a server on a port using Node's createServer for consistency
			const { createServer } = await import("node:net");

			const server = createServer();
			const port = await new Promise<number>((resolve) => {
				server.listen(0, "127.0.0.1", () => {
					const addr = server.address();
					if (addr && typeof addr === "object") {
						resolve(addr.port);
					}
				});
			});

			try {
				const available = await isPortAvailable(port);
				expect(available).toBe(false);
			} finally {
				server.close();
			}
		});
	});

	describe("getConfiguredPorts", () => {
		test("returns empty object when no config exists", () => {
			const ports = getConfiguredPorts();
			expect(ports).toEqual({});
		});

		test("returns configured ports from han.yml", () => {
			const config: HanConfig = {
				ports: {
					coordinator: 12345,
					browse: 12346,
				},
			};
			writeFileSync(join(tempConfigDir, "han.yml"), YAML.stringify(config));

			const ports = getConfiguredPorts();
			expect(ports.coordinator).toBe(12345);
			expect(ports.browse).toBe(12346);
		});

		test("returns partial ports when only one is configured", () => {
			const config: HanConfig = {
				ports: {
					coordinator: 12345,
				},
			};
			writeFileSync(join(tempConfigDir, "han.yml"), YAML.stringify(config));

			const ports = getConfiguredPorts();
			expect(ports.coordinator).toBe(12345);
			expect(ports.browse).toBeUndefined();
		});
	});

	describe("writePortsToConfig", () => {
		test("creates han.yml if it does not exist", () => {
			writePortsToConfig(tempConfigDir, {
				coordinator: 12345,
				browse: 12346,
			});

			const hanYmlPath = join(tempConfigDir, "han.yml");
			expect(existsSync(hanYmlPath)).toBe(true);

			const content = readFileSync(hanYmlPath, "utf-8");
			const config = YAML.parse(content);
			expect(config.ports.coordinator).toBe(12345);
			expect(config.ports.browse).toBe(12346);
		});

		test("merges ports with existing config", () => {
			// Write initial config
			const initialConfig: HanConfig = {
				hanBinary: "bun run test.ts",
				hooks: { enabled: true },
			};
			writeFileSync(
				join(tempConfigDir, "han.yml"),
				YAML.stringify(initialConfig),
			);

			// Add ports
			writePortsToConfig(tempConfigDir, {
				coordinator: 12345,
				browse: 12346,
			});

			const content = readFileSync(join(tempConfigDir, "han.yml"), "utf-8");
			const config = YAML.parse(content);

			// Original config preserved
			expect(config.hanBinary).toBe("bun run test.ts");
			expect(config.hooks.enabled).toBe(true);

			// Ports added
			expect(config.ports.coordinator).toBe(12345);
			expect(config.ports.browse).toBe(12346);
		});

		test("creates config directory if it does not exist", () => {
			const newDir = join(tempConfigDir, "subdir");
			expect(existsSync(newDir)).toBe(false);

			writePortsToConfig(newDir, {
				coordinator: 12345,
				browse: 12346,
			});

			expect(existsSync(newDir)).toBe(true);
			expect(existsSync(join(newDir, "han.yml"))).toBe(true);
		});
	});

	describe("getAllAllocatedPorts", () => {
		test("returns a Set (may include ports from system configs)", () => {
			// Note: getAllAllocatedPorts scans known system locations (e.g., ~/.claude)
			// so it may return ports from real configs even in tests
			const ports = getAllAllocatedPorts();
			expect(ports).toBeInstanceOf(Set);
		});

		test("includes ports from config", () => {
			const config: HanConfig = {
				ports: {
					coordinator: 12345,
					browse: 12346,
				},
			};
			writeFileSync(join(tempConfigDir, "han.yml"), YAML.stringify(config));

			const ports = getAllAllocatedPorts();
			expect(ports.has(12345)).toBe(true);
			expect(ports.has(12346)).toBe(true);
		});
	});

	describe("findAvailablePorts", () => {
		test("finds requested number of available ports", async () => {
			const excludePorts = new Set<number>();
			const ports = await findAvailablePorts(2, excludePorts);

			expect(ports).toHaveLength(2);
			expect(ports[0]).toBeGreaterThanOrEqual(41900);
			expect(ports[0]).toBeLessThanOrEqual(41999);
			expect(ports[1]).toBeGreaterThanOrEqual(41900);
			expect(ports[1]).toBeLessThanOrEqual(41999);
			expect(ports[0]).not.toBe(ports[1]);
		});

		test("skips excluded ports", async () => {
			const excludePorts = new Set<number>([41900, 41901, 41902]);
			const originalExcluded = new Set(excludePorts);
			const ports = await findAvailablePorts(1, excludePorts);

			expect(ports).toHaveLength(1);
			// The returned port should not have been in the original excluded set
			expect(originalExcluded.has(ports[0])).toBe(false);
			// But it should be added to excludePorts now
			expect(excludePorts.has(ports[0])).toBe(true);
		});

		test("adds found ports to exclude set", async () => {
			const excludePorts = new Set<number>();
			const ports = await findAvailablePorts(2, excludePorts);

			// The found ports should be added to exclude set
			expect(excludePorts.size).toBe(2);
			expect(excludePorts.has(ports[0])).toBe(true);
			expect(excludePorts.has(ports[1])).toBe(true);
		});
	});

	describe("getOrAllocatePorts", () => {
		test("returns existing ports if already configured", async () => {
			const config: HanConfig = {
				ports: {
					coordinator: 12345,
					browse: 12346,
				},
			};
			writeFileSync(join(tempConfigDir, "han.yml"), YAML.stringify(config));

			const ports = await getOrAllocatePorts();
			expect(ports.coordinator).toBe(12345);
			expect(ports.browse).toBe(12346);
		});

		test("allocates new ports if not configured", async () => {
			const ports = await getOrAllocatePorts();

			expect(ports.coordinator).toBeGreaterThanOrEqual(41900);
			expect(ports.coordinator).toBeLessThanOrEqual(41999);
			expect(ports.browse).toBeGreaterThanOrEqual(41900);
			expect(ports.browse).toBeLessThanOrEqual(41999);
			expect(ports.coordinator).not.toBe(ports.browse);
		});

		test("persists allocated ports to config", async () => {
			await getOrAllocatePorts();

			const content = readFileSync(join(tempConfigDir, "han.yml"), "utf-8");
			const config = YAML.parse(content);

			expect(config.ports.coordinator).toBeDefined();
			expect(config.ports.browse).toBeDefined();
		});

		test("force reallocates when requested", async () => {
			// Set initial ports
			const config: HanConfig = {
				ports: {
					coordinator: 12345,
					browse: 12346,
				},
			};
			writeFileSync(join(tempConfigDir, "han.yml"), YAML.stringify(config));

			// Force reallocation
			const ports = await getOrAllocatePorts(true);

			// Should get different ports (in the 41900-41999 range)
			expect(ports.coordinator).toBeGreaterThanOrEqual(41900);
			expect(ports.coordinator).toBeLessThanOrEqual(41999);
		});

		test("allocates only missing port if one is configured", async () => {
			const config: HanConfig = {
				ports: {
					coordinator: 12345,
					// browse not set
				},
			};
			writeFileSync(join(tempConfigDir, "han.yml"), YAML.stringify(config));

			// Should allocate since both ports are required
			const ports = await getOrAllocatePorts();

			// Both should be valid now
			expect(ports.coordinator).toBeDefined();
			expect(ports.browse).toBeDefined();
		});
	});

	describe("port conflict avoidance", () => {
		test("avoids ports already allocated in other configs", async () => {
			// Create a config in a different directory with specific ports
			const otherConfigDir = tempConfigDir2;
			const otherConfig: HanConfig = {
				ports: {
					coordinator: 41950,
					browse: 41951,
				},
			};
			writeFileSync(
				join(otherConfigDir, "han.yml"),
				YAML.stringify(otherConfig),
			);

			// Now allocate ports in our test config dir
			// They should avoid 41950 and 41951
			const ports = await getOrAllocatePorts();

			expect(ports.coordinator).not.toBe(41950);
			expect(ports.coordinator).not.toBe(41951);
			expect(ports.browse).not.toBe(41950);
			expect(ports.browse).not.toBe(41951);
		});
	});
});
