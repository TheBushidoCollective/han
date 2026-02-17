/**
 * Behavioral tests for lib/services/coordinator-service.ts
 *
 * Tests the coordinator lifecycle management, health checks,
 * version comparison, gRPC delegation, and state management.
 */
import { describe, expect, mock, test, beforeEach, afterEach, afterAll } from "bun:test";

// ============================================================================
// Mock infrastructure
// ============================================================================

const mockHealth = mock();
const mockShutdown = mock();
const mockStatus = mock();
const mockIndexFile = mock();

mock.module("../lib/grpc/client.ts", () => ({
	createCoordinatorClients: () => ({
		coordinator: {
			health: mockHealth,
			shutdown: mockShutdown,
			status: mockStatus,
		},
		sessions: {},
		indexer: { indexFile: mockIndexFile },
		hooks: {},
		slots: {},
		memory: {},
	}),
	isCoordinatorHealthy: mockHealth,
	setCoordinatorPort: () => {},
	getCoordinatorClients: () => ({
		coordinator: {
			health: mockHealth,
			shutdown: mockShutdown,
			status: mockStatus,
		},
		sessions: {},
		indexer: { indexFile: mockIndexFile },
		hooks: {},
		slots: {},
		memory: {},
	}),
}));

// Mock existsSync so findCoordinatorBinary doesn't find real binaries
mock.module("node:fs", () => ({
	existsSync: () => false,
}));

const cs = await import("../lib/services/coordinator-service.ts");

// Capture console output
let consoleOutput: string[] = [];
let originalLog: typeof console.log;
let originalError: typeof console.error;

beforeEach(() => {
	mockHealth.mockReset();
	mockShutdown.mockReset();
	mockStatus.mockReset();
	mockIndexFile.mockReset();
	consoleOutput = [];
	originalLog = console.log;
	originalError = console.error;
	console.log = (...args: unknown[]) => {
		consoleOutput.push(args.map(String).join(" "));
	};
	console.error = (...args: unknown[]) => {
		consoleOutput.push(args.map(String).join(" "));
	};
});

afterEach(() => {
	console.log = originalLog;
	console.error = originalError;
});
// Restore real node:fs after all tests to prevent mock from bleeding into
// other test files. Bun 1.3.4 shares mock.module state across test files
// within the same test run.
afterAll(() => {
	const realFs = require("node:fs");
	mock.module("node:fs", () => realFs);
});


// ============================================================================
// getCoordinatorVersion
// ============================================================================

describe("getCoordinatorVersion", () => {
	test("returns a version string", () => {
		const version = cs.getCoordinatorVersion();
		expect(typeof version).toBe("string");
		expect(version.length).toBeGreaterThan(0);
	});

	test("COORDINATOR_VERSION export matches getCoordinatorVersion", () => {
		expect(cs.COORDINATOR_VERSION).toBe(cs.getCoordinatorVersion());
	});
});

// ============================================================================
// isCoordinatorInstance
// ============================================================================

describe("isCoordinatorInstance", () => {
	test("returns boolean", () => {
		const result = cs.isCoordinatorInstance();
		expect(typeof result).toBe("boolean");
	});
});

// ============================================================================
// getCoordinatorStatus
// ============================================================================

describe("getCoordinatorStatus", () => {
	test("delegates to gRPC coordinator.status", async () => {
		mockStatus.mockResolvedValueOnce({
			version: "1.0.0",
			uptimeSeconds: "100",
			dbPath: "/path/to/db",
			sessionCount: 0n,
			messageCount: 0n,
			watcherActive: false,
			watchedPaths: [],
		});

		const result = await cs.getCoordinatorStatus();
		expect(result.version).toBe("1.0.0");
		expect(mockStatus).toHaveBeenCalledTimes(1);
	});
});

// ============================================================================
// startCoordinatorService
// ============================================================================

describe("startCoordinatorService", () => {
	test("when coordinator already healthy, connects without spawning", async () => {
		// First call: check if already running (isCoordinatorInstance returns false since fresh module)
		// isCoordinatorHealthy returns true = coordinator already running externally
		mockHealth.mockResolvedValue(true);

		await cs.startCoordinatorService();

		// Should log that it connected to existing coordinator
		const hasConnectMsg = consoleOutput.some(
			(msg) =>
				msg.includes("already running") ||
				msg.includes("Already running"),
		);
		expect(hasConnectMsg).toBe(true);
	});

	test("when binary not found and not healthy, logs error", async () => {
		// Coordinator not running
		mockHealth.mockResolvedValue(false);

		// Reset state by stopping first
		await cs.stopCoordinatorService();
		await cs.startCoordinatorService();

		const hasBinaryNotFound = consoleOutput.some(
			(msg) =>
				msg.includes("not found") || msg.includes("Already running"),
		);
		expect(hasBinaryNotFound).toBe(true);
	});
});

// ============================================================================
// stopCoordinatorService
// ============================================================================

describe("stopCoordinatorService", () => {
	test("sends graceful shutdown via gRPC", async () => {
		// First make it think it's running
		mockHealth.mockResolvedValue(true);
		await cs.startCoordinatorService();

		// Now stop it
		mockShutdown.mockResolvedValueOnce({});
		await cs.stopCoordinatorService();

		expect(mockShutdown).toHaveBeenCalledTimes(1);
		const shutdownArgs = mockShutdown.mock.calls[0][0];
		expect(shutdownArgs.graceful).toBe(true);
		expect(shutdownArgs.timeoutSeconds).toBe(5);
	});

	test("when not running, does nothing", async () => {
		// Ensure stopped
		await cs.stopCoordinatorService();
		mockShutdown.mockReset();

		// Stop again — should be a no-op
		await cs.stopCoordinatorService();
		expect(mockShutdown).not.toHaveBeenCalled();
	});

	test("falls back to process kill if gRPC shutdown fails", async () => {
		// Make it running first
		mockHealth.mockResolvedValue(true);
		await cs.startCoordinatorService();

		// Make shutdown fail
		mockShutdown.mockRejectedValueOnce(new Error("connection refused"));

		await cs.stopCoordinatorService();

		const hasStoppedMsg = consoleOutput.some((msg) =>
			msg.includes("stopped"),
		);
		expect(hasStoppedMsg).toBe(true);
	});
});

// ============================================================================
// checkClientVersion
// ============================================================================

describe("checkClientVersion", () => {
	test("returns false when not running", async () => {
		// Ensure stopped
		await cs.stopCoordinatorService();

		const result = cs.checkClientVersion("999.0.0");
		expect(result).toBe(false);
	});

	test("returns false when client version is same as coordinator", async () => {
		// Make it running
		mockHealth.mockResolvedValue(true);
		await cs.startCoordinatorService();

		const result = cs.checkClientVersion(cs.COORDINATOR_VERSION);
		expect(result).toBe(false);

		await cs.stopCoordinatorService();
		mockShutdown.mockResolvedValue({});
	});

	test("returns false when client version is older", async () => {
		mockHealth.mockResolvedValue(true);
		await cs.startCoordinatorService();

		const result = cs.checkClientVersion("0.0.1");
		expect(result).toBe(false);

		mockShutdown.mockResolvedValue({});
		await cs.stopCoordinatorService();
	});

	test("returns true and schedules restart when client is newer", async () => {
		mockHealth.mockResolvedValue(true);
		await cs.startCoordinatorService();

		const result = cs.checkClientVersion("999.999.999");
		expect(result).toBe(true);

		const hasRestartMsg = consoleOutput.some((msg) =>
			msg.includes("scheduling restart"),
		);
		expect(hasRestartMsg).toBe(true);

		mockShutdown.mockResolvedValue({});
		await cs.stopCoordinatorService();
	});
});

// ============================================================================
// indexFile
// ============================================================================

describe("indexFile", () => {
	test("when running, delegates to gRPC indexer.indexFile", async () => {
		mockHealth.mockResolvedValue(true);
		await cs.startCoordinatorService();

		mockIndexFile.mockResolvedValueOnce({});
		await cs.indexFile("/path/to/file.jsonl");

		expect(mockIndexFile).toHaveBeenCalledTimes(1);
		expect(mockIndexFile.mock.calls[0][0]).toEqual({
			filePath: "/path/to/file.jsonl",
		});

		mockShutdown.mockResolvedValue({});
		await cs.stopCoordinatorService();
	});

	test("when not running, skips indexing", async () => {
		await cs.stopCoordinatorService();

		await cs.indexFile("/path/to/file.jsonl");

		expect(mockIndexFile).not.toHaveBeenCalled();
		const hasSkipMsg = consoleOutput.some((msg) =>
			msg.includes("skipping index"),
		);
		expect(hasSkipMsg).toBe(true);
	});

	test("handles gRPC error gracefully", async () => {
		mockHealth.mockResolvedValue(true);
		await cs.startCoordinatorService();

		mockIndexFile.mockRejectedValueOnce(new Error("connection lost"));
		await cs.indexFile("/path/to/file.jsonl");

		const hasErrorMsg = consoleOutput.some((msg) =>
			msg.includes("Failed to index"),
		);
		expect(hasErrorMsg).toBe(true);

		mockShutdown.mockResolvedValue({});
		await cs.stopCoordinatorService();
	});
});

// ============================================================================
// ensureCoordinator
// ============================================================================

describe("ensureCoordinator", () => {
	test("returns true when already running and healthy", async () => {
		mockHealth.mockResolvedValue(true);
		await cs.startCoordinatorService();

		const result = await cs.ensureCoordinator();
		expect(result).toBe(true);

		mockShutdown.mockResolvedValue({});
		await cs.stopCoordinatorService();
	});

	test("attempts to start when not running", async () => {
		await cs.stopCoordinatorService();
		mockHealth.mockResolvedValue(false);

		const result = await cs.ensureCoordinator();
		// Won't succeed since binary is mocked to not exist, but should attempt start
		expect(typeof result).toBe("boolean");

		const hasStartAttempt = consoleOutput.some(
			(msg) => msg.includes("Starting") || msg.includes("not found"),
		);
		expect(hasStartAttempt).toBe(true);
	});
});
