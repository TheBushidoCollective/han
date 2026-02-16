import { describe, expect, it } from "bun:test";
import {
	createCoordinatorClients,
	getCoordinatorClients,
	isCoordinatorHealthy,
	setCoordinatorPort,
} from "../lib/grpc/client.ts";

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
