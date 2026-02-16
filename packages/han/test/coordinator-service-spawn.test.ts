/**
 * Additional coordinator-service tests focused on the binary spawn path.
 *
 * Uses existsSync mock that returns true to exercise findCoordinatorBinary
 * success path and Bun.spawn error handling.
 */
import { describe, expect, mock, test, beforeEach, afterEach } from "bun:test";

// ============================================================================
// Mock infrastructure — existsSync returns true to simulate binary found
// ============================================================================

const mockHealth = mock();
const mockShutdown = mock();
const mockStatus = mock();

mock.module("../lib/grpc/client.ts", () => ({
	createCoordinatorClients: () => ({
		coordinator: {
			health: mockHealth,
			shutdown: mockShutdown,
			status: mockStatus,
		},
		sessions: {},
		indexer: { indexFile: mock() },
		hooks: {},
		slots: {},
		memory: {},
	}),
	isCoordinatorHealthy: mockHealth,
	setCoordinatorPort: () => {},
	getCoordinatorClients: () => ({}),
}));

// existsSync returns true so findCoordinatorBinary "finds" the binary
// The binary won't actually exist, so Bun.spawn will throw
mock.module("node:fs", () => ({
	existsSync: () => true,
}));

const cs = await import("../lib/services/coordinator-service.ts");

let consoleOutput: string[] = [];
let originalLog: typeof console.log;
let originalError: typeof console.error;

beforeEach(() => {
	mockHealth.mockReset();
	mockShutdown.mockReset();
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

afterEach(async () => {
	console.log = originalLog;
	console.error = originalError;
	// Ensure stopped between tests
	mockShutdown.mockResolvedValue({});
	await cs.stopCoordinatorService();
});

// ============================================================================
// Binary spawn path
// ============================================================================

describe("startCoordinatorService with binary found", () => {
	test("when already running state, logs 'Already running'", async () => {
		// First make it think it's running
		mockHealth.mockResolvedValue(true);
		await cs.startCoordinatorService();
		consoleOutput = [];

		// Call again — should hit the isRunning early return
		await cs.startCoordinatorService();

		const hasAlreadyRunning = consoleOutput.some((msg) =>
			msg.includes("Already running"),
		);
		expect(hasAlreadyRunning).toBe(true);
	});

	test("attempts to spawn binary when not healthy and binary found", async () => {
		mockHealth.mockResolvedValue(false);
		await cs.stopCoordinatorService();
		mockHealth.mockReset();
		mockHealth.mockResolvedValue(false);

		await cs.startCoordinatorService();

		// Should attempt to start (binary "found" due to existsSync mock)
		// Either it tried to spawn (and potentially failed) or logged something
		const hasStartMsg = consoleOutput.some(
			(msg) =>
				msg.includes("Starting") ||
				msg.includes("failed") ||
				msg.includes("Failed"),
		);
		expect(hasStartMsg).toBe(true);
	});

	test("handles spawn failure gracefully", async () => {
		await cs.stopCoordinatorService();
		mockHealth.mockReset();
		// Not healthy — so it will try to find and spawn binary
		mockHealth.mockResolvedValue(false);

		// This should not throw even if Bun.spawn fails
		await cs.startCoordinatorService();

		// Should have error output
		expect(consoleOutput.length).toBeGreaterThan(0);
	});
});

// ============================================================================
// Ensure the version retrieval works with package.json
// ============================================================================

describe("COORDINATOR_VERSION", () => {
	test("is a semver-like string", () => {
		// getHanVersion reads from package.json
		expect(cs.COORDINATOR_VERSION).toMatch(/^\d+\.\d+/);
	});
});
