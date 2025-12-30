/**
 * Health Check for Coordinator Daemon
 *
 * Provides utilities to check if the coordinator is running
 * and healthy by making HTTP requests to the health endpoint.
 */

import { getCoordinatorPort } from "./types.ts";

/**
 * Health check response
 */
export interface HealthCheckResponse {
	status: "ok" | "error";
	pid?: number;
	uptime?: number;
	version?: string;
}

/**
 * Check if the coordinator daemon is running and healthy
 */
export async function checkHealth(
	port?: number,
): Promise<HealthCheckResponse | null> {
	const effectivePort = port ?? getCoordinatorPort();
	try {
		const response = await fetch(`http://127.0.0.1:${effectivePort}/health`, {
			signal: AbortSignal.timeout(2000),
		});

		if (response.ok) {
			return (await response.json()) as HealthCheckResponse;
		}
		return null;
	} catch {
		return null;
	}
}

/**
 * Wait for the coordinator to become healthy
 *
 * @param port - Port to check
 * @param timeoutMs - Maximum time to wait
 * @param intervalMs - Time between checks
 * @returns True if coordinator became healthy, false if timed out
 */
export async function waitForHealth(
	port?: number,
	timeoutMs: number = 10000,
	intervalMs: number = 200,
): Promise<boolean> {
	const effectivePort = port ?? getCoordinatorPort();
	const startTime = Date.now();

	while (Date.now() - startTime < timeoutMs) {
		const health = await checkHealth(effectivePort);
		if (health?.status === "ok") {
			return true;
		}
		await new Promise((resolve) => setTimeout(resolve, intervalMs));
	}

	return false;
}

/**
 * Check if coordinator is running (quick check)
 */
export async function isCoordinatorRunning(port?: number): Promise<boolean> {
	const effectivePort = port ?? getCoordinatorPort();
	const health = await checkHealth(effectivePort);
	return health?.status === "ok";
}
