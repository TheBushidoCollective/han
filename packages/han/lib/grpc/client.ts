/**
 * gRPC client factory for communicating with the han-coordinator daemon.
 *
 * Uses ConnectRPC with fetch-based transport for Bun compatibility
 * (connect-web, NOT connect-node which depends on Node http2).
 */

import { type Client, createClient } from "@connectrpc/connect";
import { createConnectTransport } from "@connectrpc/connect-web";
import {
	CoordinatorService,
	HookService,
	IndexerService,
	MemoryService,
	SessionService,
	SlotService,
} from "./generated/coordinator_pb.js";

export type CoordinatorClients = {
	coordinator: Client<typeof CoordinatorService>;
	sessions: Client<typeof SessionService>;
	indexer: Client<typeof IndexerService>;
	hooks: Client<typeof HookService>;
	slots: Client<typeof SlotService>;
	memory: Client<typeof MemoryService>;
};

const DEFAULT_PORT = 41956;

/**
 * Create typed gRPC clients for all coordinator services.
 */
export function createCoordinatorClients(
	port = DEFAULT_PORT,
): CoordinatorClients {
	const transport = createConnectTransport({
		baseUrl: `http://127.0.0.1:${port}`,
		useBinaryFormat: true,
	});

	return {
		coordinator: createClient(CoordinatorService, transport),
		sessions: createClient(SessionService, transport),
		indexer: createClient(IndexerService, transport),
		hooks: createClient(HookService, transport),
		slots: createClient(SlotService, transport),
		memory: createClient(MemoryService, transport),
	};
}

// Lazy singleton — auto-starts coordinator on first use
let _clients: CoordinatorClients | null = null;
let _port = DEFAULT_PORT;

/**
 * Set the coordinator port for the singleton client.
 * Must be called before getCoordinatorClients() if non-default port is needed.
 */
export function setCoordinatorPort(port: number): void {
	if (_clients && _port !== port) {
		_clients = null;
	}
	_port = port;
}

/**
 * Get the singleton coordinator clients instance.
 * Creates clients lazily on first call.
 * The caller is responsible for ensuring the coordinator is running
 * (see coordinator-service.ts for lifecycle management).
 */
export function getCoordinatorClients(): CoordinatorClients {
	if (!_clients) {
		_clients = createCoordinatorClients(_port);
	}
	return _clients;
}

/**
 * Check if the coordinator is reachable via gRPC health check.
 * Returns true if healthy, false on any error.
 */
export async function isCoordinatorHealthy(
	port = DEFAULT_PORT,
	timeoutMs = 2000,
): Promise<boolean> {
	try {
		const clients = createCoordinatorClients(port);
		const response = await clients.coordinator.health(
			{},
			{ timeoutMs },
		);
		return response.healthy;
	} catch {
		return false;
	}
}

// Re-export generated types for convenience
export type {
	HealthResponse,
	StatusResponse,
	SessionData,
	SessionResponse,
	ListSessionsResponse,
	ScanResponse,
	IndexFileResponse,
	ExecuteHooksRequest,
	HookOutput,
	HookComplete,
	HookDefinition,
	ListHooksResponse,
	AcquireSlotResponse,
	SlotInfo,
	ListSlotsResponse,
	MemorySearchResponse,
	MemoryResult,
} from "./generated/coordinator_pb.js";
