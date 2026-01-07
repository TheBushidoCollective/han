/**
 * Coordinator CLI Commands
 *
 * Manages the coordinator daemon that serves as the central
 * GraphQL server, database manager, and event publisher.
 *
 * Commands:
 *   han start-coordinator   - Start the coordinator daemon
 *   han stop-coordinator    - Stop the coordinator daemon
 *   han coordinator status  - Check coordinator status
 */

import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import type { Command } from "commander";
import { isDevMode } from "../../shared.ts";
import {
	ensureCoordinator,
	getLogFilePath,
	getStatus,
	startDaemon,
	stopDaemon,
} from "./daemon.ts";
import {
	getLaunchdStatus,
	installLaunchd,
	uninstallLaunchd,
} from "./launchd/install.ts";
import { getCoordinatorPort } from "./types.ts";

/**
 * Register coordinator commands
 */
export function registerCoordinatorCommands(program: Command): void {
	const defaultPort = getCoordinatorPort();

	// Top-level start-coordinator command
	program
		.command("start-coordinator")
		.description("Start the coordinator daemon")
		.option("-p, --port <port>", `Port number (default: ${defaultPort})`)
		.option("--foreground", "Run in foreground (don't daemonize)")
		.option("--daemon", "Force daemon mode even in dev mode")
		.action(
			async (options: {
				port?: string;
				foreground?: boolean;
				daemon?: boolean;
			}) => {
				try {
					const port = options.port
						? parseInt(options.port, 10)
						: getCoordinatorPort();

					// Auto-foreground in dev mode when run from CLI interactively
					// Skip if --daemon flag is set or if being spawned by the daemon system
					const isDaemonSpawn = process.env.HAN_COORDINATOR_DAEMON === "1";
					const isInteractive = process.stdin.isTTY;
					const autoForeground =
						isDevMode() && isInteractive && !isDaemonSpawn && !options.daemon;

					const foreground = options.foreground || autoForeground;

					if (autoForeground && !options.foreground) {
						console.log(
							"[coordinator] Dev mode detected, running in foreground",
						);
					}

					await startDaemon({ port, foreground });
				} catch (error: unknown) {
					console.error(
						"Error starting coordinator:",
						error instanceof Error ? error.message : error,
					);
					process.exit(1);
				}
			},
		);

	// Top-level stop-coordinator command
	program
		.command("stop-coordinator")
		.description("Stop the coordinator daemon")
		.option("-p, --port <port>", `Port number (default: ${defaultPort})`)
		.action(async (options: { port?: string }) => {
			try {
				const port = options.port
					? parseInt(options.port, 10)
					: getCoordinatorPort();
				await stopDaemon(port);
			} catch (error: unknown) {
				console.error(
					"Error stopping coordinator:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	// Subcommand group for additional coordinator operations
	const coordinator = program
		.command("coordinator")
		.description("Manage the coordinator daemon");

	coordinator
		.command("status")
		.description("Check coordinator daemon status")
		.option("-p, --port <port>", `Port number (default: ${defaultPort})`)
		.action(async (options: { port?: string }) => {
			try {
				const port = options.port
					? parseInt(options.port, 10)
					: getCoordinatorPort();
				const status = await getStatus(port);

				if (status.running) {
					console.log("Coordinator: running");
					if (status.pid) console.log(`  PID: ${status.pid}`);
					console.log(`  Port: ${status.port}`);
					if (status.uptime !== undefined) {
						const hours = Math.floor(status.uptime / 3600);
						const minutes = Math.floor((status.uptime % 3600) / 60);
						const seconds = status.uptime % 60;
						const uptimeStr =
							hours > 0
								? `${hours}h ${minutes}m ${seconds}s`
								: minutes > 0
									? `${minutes}m ${seconds}s`
									: `${seconds}s`;
						console.log(`  Uptime: ${uptimeStr}`);
					}
				} else {
					console.log("Coordinator: not running");
					if (status.pid) {
						console.log(`  Stale PID: ${status.pid} (process not responding)`);
					}
				}
			} catch (error: unknown) {
				console.error(
					"Error checking coordinator status:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	coordinator
		.command("ensure")
		.description("Ensure coordinator is running (start if needed)")
		.option("-p, --port <port>", `Port number (default: ${defaultPort})`)
		.action(async (options: { port?: string }) => {
			try {
				const port = options.port
					? parseInt(options.port, 10)
					: getCoordinatorPort();
				const status = await ensureCoordinator(port);

				if (status.running) {
					console.log(
						`Coordinator ready at http://127.0.0.1:${status.port}/graphql`,
					);
				}
			} catch (error: unknown) {
				console.error(
					"Error ensuring coordinator:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	coordinator
		.command("logs")
		.description("View coordinator daemon logs")
		.option("-f, --follow", "Follow log output (like tail -f)")
		.option("-n, --lines <lines>", "Number of lines to show (default: 50)")
		.action(async (options: { follow?: boolean; lines?: string }) => {
			const logPath = getLogFilePath();

			if (!existsSync(logPath)) {
				console.log("No coordinator logs found.");
				console.log(`Log file: ${logPath}`);
				console.log(
					"\nStart the coordinator to generate logs: han start-coordinator",
				);
				return;
			}

			const lines = options.lines ? parseInt(options.lines, 10) : 50;
			const tailArgs = options.follow
				? ["-f", "-n", String(lines), logPath]
				: ["-n", String(lines), logPath];

			const tail = spawn("tail", tailArgs, {
				stdio: "inherit",
			});

			tail.on("error", (error) => {
				console.error("Error reading logs:", error.message);
				process.exit(1);
			});

			tail.on("close", (code) => {
				process.exit(code ?? 0);
			});
		});

	// launchd subcommand group (macOS only)
	const launchd = coordinator
		.command("launchd")
		.description("Manage coordinator as a macOS launchd agent");

	launchd
		.command("install")
		.description("Install coordinator as a launchd agent (auto-start on login)")
		.option("-p, --port <port>", `Port number (default: ${defaultPort})`)
		.option("--force", "Force reinstall if already installed")
		.action(async (options: { port?: string; force?: boolean }) => {
			if (process.platform !== "darwin") {
				console.error("launchd is only available on macOS");
				process.exit(1);
			}
			try {
				const port = options.port
					? parseInt(options.port, 10)
					: getCoordinatorPort();
				await installLaunchd({ port, force: options.force });
			} catch (error: unknown) {
				console.error(
					"Error installing launchd agent:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	launchd
		.command("uninstall")
		.description("Uninstall the launchd agent")
		.action(async () => {
			if (process.platform !== "darwin") {
				console.error("launchd is only available on macOS");
				process.exit(1);
			}
			try {
				await uninstallLaunchd();
			} catch (error: unknown) {
				console.error(
					"Error uninstalling launchd agent:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	launchd
		.command("status")
		.description("Check launchd agent status")
		.action(async () => {
			if (process.platform !== "darwin") {
				console.error("launchd is only available on macOS");
				process.exit(1);
			}
			try {
				const status = await getLaunchdStatus();
				if (!status.installed) {
					console.log("launchd agent: not installed");
					console.log("\nInstall with: han coordinator launchd install");
				} else if (status.running) {
					console.log("launchd agent: running");
					if (status.pid) console.log(`  PID: ${status.pid}`);
				} else {
					console.log("launchd agent: installed but not running");
				}
			} catch (error: unknown) {
				console.error(
					"Error checking launchd status:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});
}

export {
	CoordinatorClient,
	createCoordinatorClient,
	getCoordinatorClient,
} from "./client.ts";
// Re-export utilities for use by other commands
export { ensureCoordinator, getStatus } from "./daemon.ts";
export { checkHealth, isCoordinatorRunning, waitForHealth } from "./health.ts";
export {
	BROWSE_PORT,
	COORDINATOR_PORT,
	DEFAULT_BROWSE_PORT,
	DEFAULT_COORDINATOR_PORT,
	getBrowsePort,
	getCoordinatorPort,
} from "./types.ts";
