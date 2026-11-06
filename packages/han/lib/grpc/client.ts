/**
 * gRPC client factory for communicating with the han-coordinator daemon.
 *
 * Uses ConnectRPC with fetch-based transport for Bun compatibility
 * (connect-web, NOT connect-node which depends on Node http2).
 */

import { type Client, createClient } from '@connectrpc/connect';
import { createGrpcWebTransport } from '@connectrpc/connect-web';
import { checkHealth } from '../commands/coordinator/health.ts';
import {
  coordinatorFetch,
  readCoordinatorDescriptor,
  CoordinatorSecurityError,
} from '../coordinator/connection.ts';
import {
  CoordinatorService,
  HookService,
  IndexerService,
  MemoryService,
  SessionService,
  SlotService,
} from './generated/coordinator_pb.js';

export type CoordinatorClients = {
  coordinator: Client<typeof CoordinatorService>;
  sessions: Client<typeof SessionService>;
  indexer: Client<typeof IndexerService>;
  hooks: Client<typeof HookService>;
  slots: Client<typeof SlotService>;
  memory: Client<typeof MemoryService>;
};

const DEFAULT_PORT = 41957;

/**
 * Create typed gRPC clients for all coordinator services.
 */
export function createCoordinatorClients(
  _port = DEFAULT_PORT
): CoordinatorClients {
  const descriptor = readCoordinatorDescriptor();
  if (descriptor.grpcPort === null)
    throw new CoordinatorSecurityError('Coordinator gRPC listener is disabled');
  const grpcPort = descriptor.grpcPort;
  const transport = createGrpcWebTransport({
    baseUrl: `https://127.0.0.1:${grpcPort}`,
    useBinaryFormat: true,
    fetch: Object.assign(
      (input: string | URL | Request, init?: RequestInit) => {
        const url = new URL(
          typeof input === 'string'
            ? input
            : input instanceof URL
              ? input.href
              : input.url
        );
        if (url.origin !== `https://127.0.0.1:${grpcPort}`)
          throw new CoordinatorSecurityError('Invalid gRPC destination');
        return coordinatorFetch(
          descriptor,
          grpcPort,
          `${url.pathname}${url.search}`,
          init
        );
      },
      {
        preconnect: () => {
          throw new CoordinatorSecurityError(
            'Unpinned gRPC preconnect is not supported'
          );
        },
      }
    ),
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
let _port = DEFAULT_PORT;

/**
 * Set the coordinator port for the singleton client.
 * Must be called before getCoordinatorClients() if non-default port is needed.
 */
export function setCoordinatorPort(port: number): void {
  _port = port;
}

/**
 * Get the singleton coordinator clients instance.
 * Creates clients lazily on first call.
 * The caller is responsible for ensuring the coordinator is running
 * (see coordinator-service.ts for lifecycle management).
 */
export function getCoordinatorClients(): CoordinatorClients {
  return createCoordinatorClients(_port);
}

/**
 * Check if the coordinator is reachable via gRPC health check.
 * Returns true if healthy, false on any error.
 */
export async function isCoordinatorHealthy(
  port?: number,
  timeoutMs = 2000
): Promise<boolean> {
  if (!(await checkHealth(port))) return false;
  const response = await createCoordinatorClients(port).coordinator.health(
    {},
    { timeoutMs }
  );
  return response.healthy;
}

// Re-export generated types for convenience
export type {
  AcquireSlotResponse,
  ExecuteHooksRequest,
  HealthResponse,
  HookComplete,
  HookDefinition,
  HookOutput,
  IndexFileResponse,
  ListHooksResponse,
  ListSessionsResponse,
  ListSlotsResponse,
  MemoryResult,
  MemorySearchResponse,
  ScanResponse,
  SessionData,
  SessionResponse,
  SlotInfo,
  StatusResponse,
} from './generated/coordinator_pb.js';
