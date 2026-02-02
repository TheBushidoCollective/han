/**
 * Coordinator CLI Commands
 *
 * Manages the coordinator daemon that serves as the central
 * GraphQL server, database manager, and event publisher.
 *
 * Commands:
 *   han coordinator start    - Start the coordinator daemon
 *   han coordinator stop     - Stop the coordinator daemon
 *   han coordinator restart  - Restart the coordinator daemon
 *   han coordinator status   - Check coordinator status
 *   han coordinator logs     - View coordinator logs
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

	// Subcommand group for coordinator operations
	const coordinator = program
		.command("coordinator")
		.description("Manage the coordinator daemon");

	// coordinator start
	coordinator
		.command("start")
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

	// coordinator stop
	coordinator
		.command("stop")
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

	// coordinator restart
	coordinator
		.command("restart")
		.description("Restart the coordinator daemon")
		.option("-p, --port <port>", `Port number (default: ${defaultPort})`)
		.action(async (options: { port?: string }) => {
			try {
				const port = options.port
					? parseInt(options.port, 10)
					: getCoordinatorPort();

				// Stop if running
				const status = await getStatus(port);
				if (status.running) {
					console.log("[coordinator] Stopping...");
					await stopDaemon(port);
					// Wait a moment for port to be released
					await new Promise((resolve) => setTimeout(resolve, 1000));
				}

				// Start
				console.log("[coordinator] Starting...");
				await startDaemon({ port });
			} catch (error: unknown) {
				console.error(
					"Error restarting coordinator:",
					error instanceof Error ? error.message : error,
				);
				process.exit(1);
			}
		});

	// coordinator status
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

	// coordinator ensure
	coordinator
		.command("ensure")
		.description("Ensure coordinator is running (start if needed)")
		.option("-p, --port <port>", `Port number (default: ${defaultPort})`)
		.option(
			"--background",
			"Start in background without waiting for health check",
		)
		.action(async (options: { port?: string; background?: boolean }) => {
			try {
				const port = options.port
					? parseInt(options.port, 10)
					: getCoordinatorPort();

				if (options.background) {
					// Non-blocking: start daemon and return immediately
					// Used by SessionStart hook to not block session startup
					const status = await getStatus(port);
					if (status.running) {
						// Already running, nothing to do
						return;
					}

					// Start in background - fire and forget
					// Don't await the full startup, just spawn the daemon
					const { spawn } = await import("node:child_process");

					// For compiled Bun binaries, process.execPath is the binary itself
					// and we shouldn't pass process.argv[1] (which is internal /$bunfs/... path)
					// Just spawn the binary directly with the command arguments
					const child = spawn(
						process.execPath,
						["coordinator", "start", "--daemon", "--port", String(port)],
						{
							detached: true,
							stdio: "ignore",
						},
					);
					child.unref();
					return;
				}

				// Blocking: wait for coordinator to be healthy
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
					"\nStart the coordinator to generate logs: han coordinator start",
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

	// coordinator register - Register a config directory for multi-environment indexing
	coordinator
		.command("register")
		.description("Register a config directory for multi-environment indexing")
		.option(
			"--config-dir <path>",
			"Config directory path to register (default: CLAUDE_CONFIG_DIR)",
		)
		.option("--name <name>", "Human-friendly name for this environment")
		.action(
			async (options: { configDir?: string; name?: string }) => {
				try {
					const { registerConfigDir, getConfigDirByPath } = await import(
						"../../db/index.ts"
					);

					// Determine config dir to register
					const configDir =
						options.configDir ||
						process.env.CLAUDE_CONFIG_DIR ||
						`${process.env.HOME}/.claude`;

					// Get the default config dir
					const defaultConfigDir = `${process.env.HOME}/.claude`;

					// Check if this is the default config dir (no need to register)
					if (configDir === defaultConfigDir) {
						console.log(
							"Default config directory detected - no registration needed",
						);
						return;
					}

					// Check if already registered
					const existing = await getConfigDirByPath(configDir);
					if (existing) {
						console.log(
							`Config directory already registered: ${configDir}${existing.name ? ` (${existing.name})` : ""}`,
						);
						return;
					}

					// Register the config directory
					const result = await registerConfigDir({
						path: configDir,
						name: options.name,
						isDefault: false,
					});

					console.log(
						`Registered config directory: ${result.path}${result.name ? ` (${result.name})` : ""}`,
					);

					// If watcher is running, add the watch path
					const { watcher } = await import("../../db/index.ts");
					if (watcher.isRunning()) {
						const projectsPath = `${configDir}/projects`;
						const added = watcher.addWatchPath(configDir, projectsPath);
						if (added) {
							console.log(`Added watch path: ${projectsPath}`);
						}
					}
				} catch (error: unknown) {
					console.error(
						"Error registering config directory:",
						error instanceof Error ? error.message : error,
					);
					process.exit(1);
				}
			},
		);

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
	ensureCoordinatorReady,
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
