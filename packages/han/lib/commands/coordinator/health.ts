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
 * Defaults to HTTP (localhost) for speed, use checkHealthHttps() for TLS check
 */
export async function checkHealth(
	port?: number,
): Promise<HealthCheckResponse | null> {
	const effectivePort = port ?? getCoordinatorPort();

	// Try HTTP on localhost (fast, no DNS lookup)
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
 * Check if the coordinator is running with HTTPS/TLS enabled
 * Returns the protocol and host if successful
 */
export async function checkHealthHttps(
	port?: number,
): Promise<
	| { protocol: "https"; host: string; health: HealthCheckResponse }
	| { protocol: "http"; host: string; health: HealthCheckResponse }
	| null
> {
	const effectivePort = port ?? getCoordinatorPort();

	// Try HTTPS first (TLS-enabled coordinator)
	try {
		const response = await fetch(
			`https://coordinator.local.han.guru:${effectivePort}/health`,
			{
				signal: AbortSignal.timeout(2000),
				// @ts-expect-error - Node.js fetch rejectUnauthorized option
				rejectUnauthorized: false,
			},
		);

		if (response.ok) {
			const health = (await response.json()) as HealthCheckResponse;
			return {
				protocol: "https",
				host: "coordinator.local.han.guru",
				health,
			};
		}
	} catch {
		// Fall through to HTTP attempt
	}

	// Fallback to HTTP (non-TLS coordinator)
	try {
		const response = await fetch(`http://127.0.0.1:${effectivePort}/health`, {
			signal: AbortSignal.timeout(2000),
		});

		if (response.ok) {
			const health = (await response.json()) as HealthCheckResponse;
			return { protocol: "http", host: "127.0.0.1", health };
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
