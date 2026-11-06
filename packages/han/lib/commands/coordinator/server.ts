/**
 * Coordinator Server Interface
 *
 * Thin adapter between daemon.ts lifecycle management and the
 * gRPC-backed coordinator service. In the new architecture,
 * the "server" is the external Rust han-coordinator binary.
 */

import {
  type CoordinatorStartResult,
  startCoordinatorService,
  stopCoordinatorService,
} from '../../services/coordinator-service.ts';
import type { SupervisorBinding } from '../../coordinator/connection.ts';
import type { CoordinatorOptions } from './types.ts';

/**
 * Start the coordinator server.
 * Starts the Rust han-coordinator binary as a daemon process.
 */
export async function startServer(
  options: CoordinatorOptions = {},
  supervisor?: SupervisorBinding
): Promise<CoordinatorStartResult> {
  if (options.port !== undefined) {
    process.env.HAN_COORDINATOR_PORT = String(options.port);
  }
  return startCoordinatorService({ supervisor });
}

/**
 * Stop the coordinator server.
 * Sends graceful shutdown to the Rust coordinator binary.
 */
export async function stopServer(): Promise<void> {
  await stopCoordinatorService();
}
