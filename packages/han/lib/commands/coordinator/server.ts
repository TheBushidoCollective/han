/**
 * Coordinator Server Interface
 *
 * Thin adapter between daemon.ts lifecycle management and the
 * gRPC-backed coordinator service. In the new architecture,
 * the "server" is the external Rust han-coordinator binary.
 */

import {
  startCoordinatorService,
  stopCoordinatorService,
} from '../../services/coordinator-service.ts';
import type { CoordinatorOptions } from './types.ts';

/**
 * Start the coordinator server.
 * Starts the Rust han-coordinator binary as a daemon process.
 */
export async function startServer(
  options: CoordinatorOptions = {}
): Promise<void> {
  if (options.port) {
    process.env.HAN_COORDINATOR_PORT = String(options.port);
  }
  await startCoordinatorService();
}

/**
 * Stop the coordinator server.
 * Sends graceful shutdown to the Rust coordinator binary.
 */
export function stopServer(): void {
  // Fire and forget — stopCoordinatorService is async but shutdown is best-effort
  void stopCoordinatorService();
}
