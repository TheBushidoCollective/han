/**
 * Coordinator Lifecycle Manager
 *
 * Manages the Rust han-coordinator binary lifecycle:
 * 1. Discovery: finds the coordinator binary
 * 2. Auto-start: spawns as daemon process
 * 3. Health check: gRPC health probe with retry
 * 4. Shutdown: graceful stop via gRPC
 *
 * The Rust coordinator handles all internal operations:
 * file watching, JSONL indexing, SQLite, FTS, subscriptions.
 */

import { existsSync } from "node:fs";
import { join } from "node:path";
import {
	createCoordinatorClients,
	isCoordinatorHealthy,
} from "../grpc/client.ts";

const DEFAULT_PORT = 41956;

/**
 * Get the han version from package.json
 */
const getHanVersion = (): string => {
	try {
		const pkg = require("../../package.json");
		return pkg.version || "0.0.0";
	} catch {
		return "0.0.0";
	}
};

export const COORDINATOR_VERSION = getHanVersion();

/**
 * Coordinator service state
 */
interface CoordinatorState {
	isRunning: boolean;
	version: string;
	process: ReturnType<typeof Bun.spawn> | null;
	port: number;
}

const state: CoordinatorState = {
	isRunning: false,
	version: COORDINATOR_VERSION,
	process: null,
	port: DEFAULT_PORT,
};

// ============================================================================
// Binary Discovery
// ============================================================================

/**
 * Find the han-coordinator binary.
 * Search order:
 * 1. ~/.han/bin/han-coordinator
 * 2. npm platform package bundled binary
 * 3. PATH
 */
function findCoordinatorBinary(): string | null {
	const home = process.env.HOME || process.env.USERPROFILE || "/tmp";

	// 1. ~/.han/bin/han-coordinator
	const hanBin = join(home, ".han", "bin", "han-coordinator");
	if (existsSync(hanBin)) return hanBin;

	// 2. npm platform package
	const arch = process.arch;
	const platform = process.platform;
	try {
		const pkgName = `@thebushidocollective/han-${platform}-${arch}`;
		const pkgPath = require.resolve(`${pkgName}/han-coordinator`);
		if (existsSync(pkgPath)) return pkgPath;
	} catch {
		// Package not installed
	}

	// 3. PATH lookup via which/where
	try {
		const result = Bun.spawnSync(
			[process.platform === "win32" ? "where" : "which", "han-coordinator"],
			{ stdout: "pipe", stderr: "ignore" },
		);
		if (result.exitCode === 0) {
			const path = result.stdout.toString().trim();
			if (path && existsSync(path)) return path;
		}
	} catch {
		// Not in PATH
	}

	return null;
}

// ============================================================================
// Health Check with Retry
// ============================================================================

/**
 * Wait for coordinator to become healthy with exponential backoff.
 * Retries: 100ms, 200ms, 400ms, 800ms, 1600ms (total ~3.1s)
 */
async function waitForHealthy(
	port: number,
	maxRetries = 5,
): Promise<boolean> {
	for (let i = 0; i < maxRetries; i++) {
		if (await isCoordinatorHealthy(port, 2000)) {
			return true;
		}
		const delay = 100 * 2 ** i;
		await Bun.sleep(delay);
	}
	return false;
}

// ============================================================================
// Lifecycle Management
// ============================================================================

/**
 * Start the coordinator service.
 *
 * If the coordinator is already running (another process), this just
 * verifies connectivity. Otherwise, spawns the Rust binary as a daemon.
 */
export async function startCoordinatorService(): Promise<void> {
	if (state.isRunning) {
		console.log("[coordinator] Already running");
		return;
	}

	// Check if coordinator is already running (from another process)
	if (await isCoordinatorHealthy(state.port)) {
		console.log("[coordinator] Coordinator already running, connecting...");
		state.isRunning = true;
		return;
	}

	// Find the binary
	const binaryPath = findCoordinatorBinary();
	if (!binaryPath) {
		console.error(
			"[coordinator] han-coordinator binary not found. " +
				"Install via: curl -fsSL https://han.guru/install.sh | bash",
		);
		return;
	}

	console.log(`[coordinator] Starting ${binaryPath} on port ${state.port}`);

	try {
		// Spawn as daemon process
		state.process = Bun.spawn(
			[binaryPath, "--daemon", "--port", String(state.port)],
			{
				stdout: "ignore",
				stderr: "ignore",
				// Don't keep parent alive
				unref: true,
			},
		);

		// Wait for it to become healthy
		const healthy = await waitForHealthy(state.port);
		if (healthy) {
			state.isRunning = true;
			console.log("[coordinator] Coordinator started and healthy");
		} else {
			console.error(
				"[coordinator] Coordinator started but failed health check",
			);
			state.process = null;
		}
	} catch (error) {
		console.error("[coordinator] Failed to start coordinator:", error);
		state.process = null;
	}
}

/**
 * Stop the coordinator service.
 * Sends graceful shutdown via gRPC, falls back to process kill.
 */
export async function stopCoordinatorService(): Promise<void> {
	if (!state.isRunning) return;

	state.isRunning = false;

	try {
		const clients = createCoordinatorClients(state.port);
		await clients.coordinator.shutdown({
			graceful: true,
			timeoutSeconds: 5,
		});
		console.log("[coordinator] Graceful shutdown sent");
	} catch {
		// If gRPC shutdown fails, kill the process directly
		if (state.process) {
			state.process.kill();
			console.log("[coordinator] Process killed");
		}
	}

	state.process = null;
	console.log("[coordinator] Service stopped");
}

/**
 * Check if coordinator is currently running and healthy.
 */
export function isCoordinatorInstance(): boolean {
	return state.isRunning;
}

/**
 * Get the current coordinator version.
 */
export function getCoordinatorVersion(): string {
	return state.version;
}

/**
 * Get coordinator status via gRPC.
 */
export async function getCoordinatorStatus() {
	const clients = createCoordinatorClients(state.port);
	return clients.coordinator.status({});
}

/**
 * Compare semantic versions.
 * Returns: -1 if a < b, 0 if a == b, 1 if a > b
 */
function compareVersions(a: string, b: string): number {
	const partsA = a.split(".").map((p) => Number.parseInt(p, 10) || 0);
	const partsB = b.split(".").map((p) => Number.parseInt(p, 10) || 0);

	for (let i = 0; i < Math.max(partsA.length, partsB.length); i++) {
		const partA = partsA[i] || 0;
		const partB = partsB[i] || 0;
		if (partA < partB) return -1;
		if (partA > partB) return 1;
	}
	return 0;
}

/**
 * Check if a client version is newer than the coordinator.
 * If so, schedule a coordinator restart.
 */
export function checkClientVersion(clientVersion: string): boolean {
	if (!state.isRunning) return false;

	const cmp = compareVersions(clientVersion, state.version);
	if (cmp > 0) {
		console.log(
			`[coordinator] Client version ${clientVersion} > coordinator version ${state.version}, scheduling restart`,
		);
		// Schedule restart after a short delay
		setTimeout(async () => {
			console.log("[coordinator] Restarting for version upgrade...");
			await stopCoordinatorService();
			await startCoordinatorService();
		}, 1000);
		return true;
	}
	return false;
}

/**
 * Trigger indexing of a file via gRPC.
 */
export async function indexFile(filePath: string): Promise<void> {
	if (!state.isRunning) {
		console.log("[coordinator] Not running, skipping index");
		return;
	}

	try {
		const clients = createCoordinatorClients(state.port);
		await clients.indexer.indexFile({ filePath });
	} catch (error) {
		console.error(`[coordinator] Failed to index ${filePath}:`, error);
	}
}

/**
 * Ensure coordinator is running, auto-starting if needed.
 * Returns true if coordinator is available.
 */
export async function ensureCoordinator(): Promise<boolean> {
	if (state.isRunning && (await isCoordinatorHealthy(state.port))) {
		return true;
	}

	await startCoordinatorService();
	return state.isRunning;
}
