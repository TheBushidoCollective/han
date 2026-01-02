/**
 * Coordinator Daemon Management
 *
 * Handles starting the coordinator as a background daemon,
 * managing PID files, and process lifecycle.
 */

import { spawn } from "node:child_process";
import {
	closeSync,
	existsSync,
	mkdirSync,
	openSync,
	readFileSync,
	unlinkSync,
	writeFileSync,
} from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { getOrAllocatePorts } from "../../config/port-allocation.ts";
import { checkHealth, waitForHealth } from "./health.ts";
import { startServer, stopServer } from "./server.ts";
import {
	type CoordinatorOptions,
	type CoordinatorStatus,
	getCoordinatorPort,
	LOG_FILE,
	PID_FILE,
} from "./types.ts";

/**
 * Get the log file path
 */
export function getLogFilePath(): string {
	return join(homedir(), ".claude", LOG_FILE);
}

/**
 * Get the PID file path
 */
function getPidFilePath(): string {
	return join(homedir(), ".claude", PID_FILE);
}

/**
 * Read PID from file
 */
function readPid(): number | null {
	const pidPath = getPidFilePath();
	try {
		if (existsSync(pidPath)) {
			const pid = parseInt(readFileSync(pidPath, "utf-8").trim(), 10);
			return Number.isNaN(pid) ? null : pid;
		}
	} catch {
		// Ignore errors
	}
	return null;
}

/**
 * Write PID to file
 */
function writePid(pid: number): void {
	const pidPath = getPidFilePath();
	writeFileSync(pidPath, String(pid), "utf-8");
}

/**
 * Remove PID file
 */
function removePidFile(): void {
	const pidPath = getPidFilePath();
	try {
		if (existsSync(pidPath)) {
			unlinkSync(pidPath);
		}
	} catch {
		// Ignore errors
	}
}

/**
 * Check if a process is running
 */
function isProcessRunning(pid: number): boolean {
	try {
		process.kill(pid, 0);
		return true;
	} catch {
		return false;
	}
}

/**
 * Get coordinator status
 */
export async function getStatus(port?: number): Promise<CoordinatorStatus> {
	const effectivePort = port ?? getCoordinatorPort();
	const health = await checkHealth(effectivePort);

	if (health?.status === "ok") {
		return {
			running: true,
			pid: health.pid,
			port: effectivePort,
			uptime: health.uptime,
		};
	}

	// Check if PID file exists with a running process
	const pid = readPid();
	if (pid && isProcessRunning(pid)) {
		return {
			running: false, // Not responding but process exists
			pid,
			port: effectivePort,
		};
	}

	return {
		running: false,
		port: effectivePort,
	};
}

/**
 * Start coordinator daemon in background
 */
export async function startDaemon(
	options: CoordinatorOptions = {},
): Promise<CoordinatorStatus> {
	// Ensure ports are allocated before starting
	// This persists port configuration to han.yml if not already set
	if (!options.port) {
		const allocatedPorts = await getOrAllocatePorts();
		console.log(
			`[coordinator] Using ports: coordinator=${allocatedPorts.coordinator}, browse=${allocatedPorts.browse}`,
		);
	}

	const port = options.port ?? getCoordinatorPort();

	// Check if already running
	const status = await getStatus(port);
	if (status.running) {
		console.log(`[coordinator] Already running (PID: ${status.pid})`);
		return status;
	}

	// Clean up stale PID file
	const stalePid = readPid();
	if (stalePid && !isProcessRunning(stalePid)) {
		removePidFile();
	}

	// Run in foreground mode
	if (options.foreground) {
		console.log("[coordinator] Starting in foreground mode...");
		await runForeground(port);
		return { running: true, pid: process.pid, port };
	}

	// Spawn daemon process
	console.log("[coordinator] Starting daemon...");

	// Get the han binary path
	const hanBinary = process.argv[1];

	// Setup log file for daemon output
	const logPath = getLogFilePath();
	const logDir = dirname(logPath);
	if (!existsSync(logDir)) {
		mkdirSync(logDir, { recursive: true });
	}

	// Open log file for appending (Bun requires fd, not stream)
	const logFd = openSync(logPath, "a");

	const child = spawn(
		process.execPath,
		[hanBinary, "start-coordinator", "--foreground", "--port", String(port)],
		{
			detached: true,
			stdio: ["ignore", logFd, logFd],
			env: {
				...process.env,
				HAN_COORDINATOR_DAEMON: "1",
			},
		},
	);

	// Close the fd in parent process after spawn
	closeSync(logFd);

	child.unref();

	// Wait for daemon to start (30s timeout, check every 100ms)
	const healthy = await waitForHealth(port, 30000, 100);

	if (!healthy) {
		throw new Error("Coordinator failed to start within timeout");
	}

	const newStatus = await getStatus(port);
	console.log(`[coordinator] Started (PID: ${newStatus.pid})`);
	return newStatus;
}

/**
 * Stop coordinator daemon
 */
export async function stopDaemon(port?: number): Promise<void> {
	const effectivePort = port ?? getCoordinatorPort();
	const status = await getStatus(effectivePort);

	if (!status.running && !status.pid) {
		console.log("[coordinator] Not running");
		removePidFile();
		return;
	}

	if (status.pid) {
		console.log(`[coordinator] Stopping (PID: ${status.pid})...`);
		try {
			process.kill(status.pid, "SIGTERM");

			// Wait for process to stop
			let attempts = 0;
			while (attempts < 50 && isProcessRunning(status.pid)) {
				await new Promise((resolve) => setTimeout(resolve, 100));
				attempts++;
			}

			// Force kill if still running
			if (isProcessRunning(status.pid)) {
				console.log("[coordinator] Force killing...");
				process.kill(status.pid, "SIGKILL");
			}
		} catch (error) {
			if ((error as NodeJS.ErrnoException).code !== "ESRCH") {
				throw error;
			}
		}
	}

	removePidFile();
	console.log("[coordinator] Stopped");
}

// Constants for auto-restart
const MAX_RESTART_ATTEMPTS = 5;
const RESTART_DELAY_MS = 2000;
const RESTART_BACKOFF_MULTIPLIER = 1.5;

/**
 * Run coordinator in foreground with auto-restart on crash
 */
async function runForeground(port: number): Promise<void> {
	// Write PID file
	writePid(process.pid);

	let shuttingDown = false;

	// Setup signal handlers
	const shutdown = () => {
		shuttingDown = true;
		console.log("\n[coordinator] Shutting down...");
		stopServer();
		removePidFile();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	// Catch uncaught exceptions to allow restart
	process.on("uncaughtException", (error) => {
		console.error("[coordinator] Uncaught exception:", error);
		// Don't exit - let the restart loop handle it
	});

	process.on("unhandledRejection", (reason) => {
		console.error("[coordinator] Unhandled rejection:", reason);
		// Don't exit - let the restart loop handle it
	});

	// Auto-restart loop
	let restartAttempts = 0;
	let currentDelay = RESTART_DELAY_MS;

	while (!shuttingDown) {
		try {
			// Start server
			await startServer({ port });

			console.log("[coordinator] Running. Press Ctrl+C to stop.");

			// Reset restart attempts on successful start
			restartAttempts = 0;
			currentDelay = RESTART_DELAY_MS;

			// Keep process alive until shutdown or crash
			await new Promise<void>((resolve) => {
				// Check every 5s if server is still healthy
				const healthCheck = setInterval(async () => {
					if (shuttingDown) {
						clearInterval(healthCheck);
						resolve();
					}
				}, 5000);
			});
		} catch (error) {
			if (shuttingDown) break;

			restartAttempts++;
			console.error(
				`[coordinator] Server crashed (attempt ${restartAttempts}/${MAX_RESTART_ATTEMPTS}):`,
				error,
			);

			if (restartAttempts >= MAX_RESTART_ATTEMPTS) {
				console.error("[coordinator] Max restart attempts reached. Exiting.");
				removePidFile();
				process.exit(1);
			}

			console.log(
				`[coordinator] Restarting in ${Math.round(currentDelay / 1000)}s...`,
			);
			await new Promise((r) => setTimeout(r, currentDelay));
			currentDelay *= RESTART_BACKOFF_MULTIPLIER;
		}
	}
}

/**
 * Ensure coordinator is running
 * Starts it lazily if not already running
 *
 * This function also ensures ports are allocated before checking status,
 * so the first call will persist port configuration to han.yml.
 *
 * @returns Status of the coordinator
 */
export async function ensureCoordinator(
	port?: number,
): Promise<CoordinatorStatus> {
	// Ensure ports are allocated on first call
	if (!port) {
		await getOrAllocatePorts();
	}

	const effectivePort = port ?? getCoordinatorPort();
	const status = await getStatus(effectivePort);

	if (status.running) {
		return status;
	}

	console.log("[coordinator] Starting coordinator daemon...");
	return startDaemon({ port: effectivePort });
}
