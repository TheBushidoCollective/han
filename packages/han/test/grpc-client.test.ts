import { describe, expect, it, mock } from "bun:test";
import {
	createCoordinatorClients,
	getCoordinatorClients,
	isCoordinatorHealthy,
	setCoordinatorPort,
} from "../lib/grpc/client.ts";
import type { ExecuteHooksOptions, HookExecutionResult } from "../lib/grpc/hook-executor.ts";

describe("gRPC Client Factory", () => {
	it("creates typed clients for all 6 services", () => {
		const clients = createCoordinatorClients(12345);

		expect(clients.coordinator).toBeDefined();
		expect(clients.sessions).toBeDefined();
		expect(clients.indexer).toBeDefined();
		expect(clients.hooks).toBeDefined();
		expect(clients.slots).toBeDefined();
		expect(clients.memory).toBeDefined();
	});

	it("returns singleton from getCoordinatorClients()", () => {
		setCoordinatorPort(54321);
		const a = getCoordinatorClients();
		const b = getCoordinatorClients();
		expect(a).toBe(b);
	});

	it("resets singleton when port changes", () => {
		setCoordinatorPort(11111);
		const a = getCoordinatorClients();
		setCoordinatorPort(22222);
		const b = getCoordinatorClients();
		expect(a).not.toBe(b);
	});

	it("isCoordinatorHealthy returns false for non-existent server", async () => {
		const healthy = await isCoordinatorHealthy(19999, 500);
		expect(healthy).toBe(false);
	});

	it("clients have expected method shapes", () => {
		const clients = createCoordinatorClients(12345);

		// CoordinatorService
		expect(typeof clients.coordinator.health).toBe("function");
		expect(typeof clients.coordinator.shutdown).toBe("function");
		expect(typeof clients.coordinator.status).toBe("function");

		// SessionService
		expect(typeof clients.sessions.getActive).toBe("function");
		expect(typeof clients.sessions.get).toBe("function");
		expect(typeof clients.sessions.list).toBe("function");

		// IndexerService
		expect(typeof clients.indexer.triggerScan).toBe("function");
		expect(typeof clients.indexer.indexFile).toBe("function");

		// HookService
		expect(typeof clients.hooks.executeHooks).toBe("function");
		expect(typeof clients.hooks.listHooks).toBe("function");

		// SlotService
		expect(typeof clients.slots.acquire).toBe("function");
		expect(typeof clients.slots.release).toBe("function");
		expect(typeof clients.slots.list).toBe("function");

		// MemoryService
		expect(typeof clients.memory.search).toBe("function");
		expect(typeof clients.memory.indexDocument).toBe("function");
	});
});

describe("Hook Executor Types", () => {
	it("ExecuteHooksOptions has required fields", () => {
		const opts: ExecuteHooksOptions = {
			event: "Stop",
			sessionId: "test-session",
			toolName: "Bash",
			toolInput: '{"command":"echo hello"}',
			cwd: "/tmp/test",
			env: { FOO: "bar" },
		};
		expect(opts.event).toBe("Stop");
		expect(opts.sessionId).toBe("test-session");
		expect(opts.toolName).toBe("Bash");
		expect(opts.cwd).toBe("/tmp/test");
	});

	it("ExecuteHooksOptions works with minimal fields", () => {
		const opts: ExecuteHooksOptions = {
			event: "SessionStart",
		};
		expect(opts.event).toBe("SessionStart");
		expect(opts.sessionId).toBeUndefined();
		expect(opts.toolName).toBeUndefined();
	});

	it("HookExecutionResult captures hook outcomes", () => {
		const result: HookExecutionResult = {
			hookId: "hook-123",
			pluginName: "biome",
			hookName: "lint",
			exitCode: 0,
			cached: false,
			durationMs: 1500,
		};
		expect(result.exitCode).toBe(0);
		expect(result.cached).toBe(false);
		expect(result.error).toBeUndefined();
	});

	it("HookExecutionResult captures errors", () => {
		const result: HookExecutionResult = {
			hookId: "hook-456",
			pluginName: "eslint",
			hookName: "check",
			exitCode: 1,
			cached: false,
			error: "Lint errors found",
			durationMs: 2000,
		};
		expect(result.exitCode).toBe(1);
		expect(result.error).toBe("Lint errors found");
	});
});

describe("gRPC Hook Execution Integration", () => {
	it("executeHooksViaGrpc fails gracefully when coordinator is down", async () => {
		// Import dynamically to avoid module-level side effects
		const { executeHooksViaGrpc } = await import("../lib/grpc/hook-executor.ts");
		setCoordinatorPort(19998); // Non-existent port

		try {
			await executeHooksViaGrpc({
				event: "Stop",
				cwd: "/tmp/test",
			});
			// Should not reach here
			expect(true).toBe(false);
		} catch (error) {
			// Expected: connection refused or similar
			expect(error).toBeDefined();
		}
	});

	it("run.ts imports gRPC executor", async () => {
		// Verify the hook run module can be loaded (imports resolve)
		const mod = await import("../lib/commands/hook/run.ts");
		expect(typeof mod.registerHookRun).toBe("function");
	});

	it("dispatch.ts imports gRPC executor", async () => {
		// Verify the dispatch module can be loaded (imports resolve)
		const mod = await import("../lib/commands/hook/dispatch.ts");
		expect(typeof mod.registerHookDispatch).toBe("function");
	});
});

describe("Coordinator Lifecycle", () => {
	it("coordinator-service exports ensureCoordinator", async () => {
		const mod = await import("../lib/services/coordinator-service.ts");
		expect(typeof mod.ensureCoordinator).toBe("function");
	});

	it("coordinator-service exports startCoordinatorService", async () => {
		const mod = await import("../lib/services/coordinator-service.ts");
		expect(typeof mod.startCoordinatorService).toBe("function");
	});

	it("coordinator-service exports stopCoordinatorService", async () => {
		const mod = await import("../lib/services/coordinator-service.ts");
		expect(typeof mod.stopCoordinatorService).toBe("function");
	});

	it("coordinator-service exports getCoordinatorStatus", async () => {
		const mod = await import("../lib/services/coordinator-service.ts");
		expect(typeof mod.getCoordinatorStatus).toBe("function");
	});

	it("gRPC health check returns false when coordinator is down", async () => {
		const healthy = await isCoordinatorHealthy(19997, 500);
		expect(healthy).toBe(false);
	});
});

describe("Bun Builtins", () => {
	it("sha256 produces correct hash", async () => {
		const { sha256 } = await import("../lib/bun-utils.ts");
		const hash = sha256("hello world");
		// Known SHA-256 of "hello world"
		expect(hash).toBe("b94d27b9934d3e08a52e52d7da7dabfac484efe37a5380ee9088f7ace2efcde9");
	});

	it("sha256 handles empty string", async () => {
		const { sha256 } = await import("../lib/bun-utils.ts");
		const hash = sha256("");
		// Known SHA-256 of empty string
		expect(hash).toBe("e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855");
	});

	it("globFiles returns array", async () => {
		const { globFiles } = await import("../lib/bun-utils.ts");
		const files = await globFiles("*.ts", "/tmp");
		expect(Array.isArray(files)).toBe(true);
	});
});
