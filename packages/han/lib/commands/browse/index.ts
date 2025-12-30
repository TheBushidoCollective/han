/**
 * Entry point for the browse command
 *
 * Starts a simple web server that:
 * - Serves static files in production mode (from out/)
 * - Uses Bun dev server with live reload in development mode
 *
 * The frontend connects directly to the coordinator daemon
 * for GraphQL queries and subscriptions.
 */

import { spawn } from "node:child_process";
import { existsSync, readFileSync, watch } from "node:fs";
import { createServer } from "node:http";
import { platform } from "node:os";
import { dirname, extname, join } from "node:path";
import { fileURLToPath, parse } from "node:url";
import {
	ensureCoordinator,
	getBrowsePort,
	getCoordinatorPort,
	isCoordinatorRunning,
} from "../coordinator/index.ts";
import type { BrowseOptions } from "./types.ts";

/**
 * HTML page to show when coordinator is not running
 * Embedded as string to work in compiled binary
 */
const COORDINATOR_UNAVAILABLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Han Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e0e0e0;
        }
        .container { text-align: center; padding: 2rem; max-width: 500px; }
        .logo { font-size: 4rem; margin-bottom: 1.5rem; }
        h1 { font-size: 1.5rem; font-weight: 500; margin-bottom: 1rem; color: #fff; }
        .message { font-size: 1.1rem; color: #a0a0a0; line-height: 1.6; margin-bottom: 2rem; }
        .hint { font-size: 0.9rem; color: #666; border-top: 1px solid #333; padding-top: 1.5rem; }
        code { background: rgba(255, 255, 255, 0.1); padding: 0.2rem 0.5rem; border-radius: 4px; font-family: 'SF Mono', Monaco, monospace; }
        .pulse { animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo pulse">&#128526;</div>
        <h1>Han Dashboard</h1>
        <p class="message">Start a Claude Code session to see the active dashboard</p>
        <p class="hint">Or run <code>han start-coordinator</code> to start the backend manually</p>
    </div>
    <script>
        setInterval(() => {
            fetch('/api/health')
                .then(r => r.json())
                .then(data => { if (data.coordinatorRunning) window.location.reload(); })
                .catch(() => {});
        }, 5000);
    </script>
</body>
</html>`;

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Get the browse-client directory
 */
function getBrowseClientDir(): string {
	// Navigate from packages/han/lib/commands/browse to packages/browse-client
	return join(__dirname, "..", "..", "..", "..", "browse-client");
}

/**
 * Check if running in development mode
 *
 * Returns true (development) if:
 * - NODE_ENV is "development"
 * - Running from .ts/.tsx source files (not compiled)
 *
 * Returns false (production) if:
 * - NODE_ENV is "production"
 */
function detectDevMode(): boolean {
	if (process.env.NODE_ENV === "production") return false;
	if (process.env.NODE_ENV === "development") return true;
	// Fall back to checking if running from source
	const mainFile = Bun.main;
	return mainFile.endsWith(".ts") || mainFile.endsWith(".tsx");
}

/**
 * Open a URL in the default browser
 */
export async function openBrowser(url: string): Promise<boolean> {
	const plat = platform();

	let cmd: string;
	let args: string[];

	if (plat === "darwin") {
		cmd = "open";
		args = [url];
	} else if (plat === "win32") {
		cmd = "cmd";
		args = ["/c", "start", "", url];
	} else {
		cmd = "xdg-open";
		args = [url];
	}

	return new Promise((resolve) => {
		try {
			const child = spawn(cmd, args, {
				stdio: "ignore",
				detached: true,
			});
			child.unref();
			resolve(true);
		} catch {
			resolve(false);
		}
	});
}

/**
 * Get MIME type for a file extension
 */
function getMimeType(filePath: string): string {
	const ext = filePath.split(".").pop()?.toLowerCase();
	const mimeTypes: Record<string, string> = {
		html: "text/html",
		js: "application/javascript",
		css: "text/css",
		json: "application/json",
		png: "image/png",
		jpg: "image/jpeg",
		jpeg: "image/jpeg",
		gif: "image/gif",
		svg: "image/svg+xml",
		ico: "image/x-icon",
		woff: "font/woff",
		woff2: "font/woff2",
		ttf: "font/ttf",
	};
	return mimeTypes[ext || ""] || "application/octet-stream";
}

/**
 * Start the Han system browser
 *
 * - In development: Uses Bun with live reload
 * - In production: Serves static files from out/
 *
 * The frontend connects directly to the coordinator daemon
 * for GraphQL.
 */
export async function browse(options: BrowseOptions = {}): Promise<void> {
	const { port = getBrowsePort(), autoOpen = true } = options;
	const coordinatorPort = getCoordinatorPort();
	const devMode = detectDevMode();

	const clientDir = getBrowseClientDir();

	// Check if browse-client exists
	if (!existsSync(clientDir)) {
		throw new Error(`browse-client not found at ${clientDir}`);
	}

	console.log(`[han] Starting browse server...`);
	console.log(`[han] Mode: ${devMode ? "development" : "production"}`);

	// Ensure coordinator is running (lazy start if needed)
	console.log("[han] Ensuring coordinator is running...");
	let coordinatorRunning = false;
	try {
		const coordinatorStatus = await ensureCoordinator(coordinatorPort);
		coordinatorRunning = coordinatorStatus.running;
		if (coordinatorRunning) {
			console.log(
				`[han] Coordinator ready at http://127.0.0.1:${coordinatorStatus.port}/graphql`,
			);
		}
	} catch (error) {
		console.error("[han] Failed to start coordinator:", error);
		console.log(
			"[han] Dashboard will show placeholder until coordinator is available",
		);
	}

	// Create HTTP server
	const server = createServer();

	// Build output directory
	const outDir = join(clientDir, ".browse-out");

	// Connected clients for live reload (dev mode only)
	const liveReloadClients = new Set<import("node:http").ServerResponse>();

	// Build function - always uses Bun.build() with HTML entrypoint
	async function buildBundle(): Promise<boolean> {
		const pagesDir = join(clientDir, "src", "pages");
		const { relayPlugin } = await import(
			join(clientDir, "build", "relay-plugin.ts")
		);
		const { pagesPlugin } = await import(
			join(clientDir, "build", "pages-plugin.ts")
		);
		const { rnwCompatPlugin } = await import(
			join(clientDir, "build", "rnw-compat-plugin.ts")
		);

		const result = await Bun.build({
			entrypoints: [join(clientDir, "index.html")],
			outdir: outDir,
			target: "browser",
			splitting: true,
			minify: !devMode,
			sourcemap: devMode ? "inline" : "none",
			publicPath: "/",
			plugins: [
				rnwCompatPlugin(),
				relayPlugin({ devMode }),
				pagesPlugin({ pagesDir }),
			],
			define: {
				"process.env.NODE_ENV": JSON.stringify(
					devMode ? "development" : "production",
				),
			},
			loader: {
				".css": "css",
				".svg": "file",
				".png": "file",
				".jpg": "file",
				".jpeg": "file",
				".gif": "file",
				".woff": "file",
				".woff2": "file",
			},
		});

		if (!result.success) {
			console.error("[bun] Build failed:");
			for (const log of result.logs) {
				console.error("  ", log.message);
			}
			return false;
		}
		return true;
	}

	// Build on startup
	console.log("[bun] Building browse-client...");
	const buildStart = performance.now();
	if (!(await buildBundle())) {
		throw new Error("Bundle failed");
	}
	console.log(
		`[bun] Built in ${(performance.now() - buildStart).toFixed(0)}ms`,
	);

	// Dev mode: watch for changes
	if (devMode) {
		const srcDir = join(clientDir, "src");
		let buildTimeout: ReturnType<typeof setTimeout> | null = null;
		watch(srcDir, { recursive: true }, (_event, filename) => {
			if (!filename) return;
			if (buildTimeout) clearTimeout(buildTimeout);
			buildTimeout = setTimeout(async () => {
				console.log(`\n[bun] Rebuilding (${filename} changed)...`);
				const start = performance.now();
				if (await buildBundle()) {
					console.log(
						`[bun] Rebuilt in ${(performance.now() - start).toFixed(0)}ms`,
					);
					// Notify live reload clients
					for (const client of liveReloadClients) {
						try {
							client.write("data: reload\n\n");
						} catch {
							liveReloadClients.delete(client);
						}
					}
				}
			}, 100);
		});

		console.log("[bun] Dev server ready with live reload");
	}

	// Add request handler to server
	server.on("request", async (req, res) => {
		const parsedUrl = parse(req.url || "/", true);
		const pathname = parsedUrl.pathname || "/";

		// Health check - includes coordinator status
		if (pathname === "/api/health") {
			const coordRunning = await isCoordinatorRunning(coordinatorPort);
			res.setHeader("Content-Type", "application/json");
			res.end(
				JSON.stringify({
					status: "ok",
					coordinatorRunning: coordRunning,
					coordinatorPort,
				}),
			);
			return;
		}

		// Check if coordinator is running for serving frontend
		const coordRunning = await isCoordinatorRunning(coordinatorPort);

		// If coordinator is not running, show placeholder page
		if (!coordRunning && !pathname.startsWith("/api/")) {
			res.setHeader("Content-Type", "text/html");
			res.end(COORDINATOR_UNAVAILABLE_HTML);
			return;
		}

		// Live reload SSE endpoint (dev mode only)
		if (devMode && pathname === "/__live_reload") {
			res.setHeader("Content-Type", "text/event-stream");
			res.setHeader("Cache-Control", "no-cache");
			res.setHeader("Connection", "keep-alive");
			liveReloadClients.add(res);
			res.write("data: connected\n\n");
			req.on("close", () => liveReloadClients.delete(res));
			return;
		}

		// Serve from bundled output directory
		const hasExtension = pathname.includes(".") && !pathname.endsWith("/");
		const filePath = hasExtension
			? join(outDir, pathname)
			: join(outDir, "index.html");

		if (existsSync(filePath)) {
			const ext = extname(filePath) || ".html";
			let content = readFileSync(filePath);

			// Inject live reload script into HTML (dev mode only)
			if (devMode && ext === ".html") {
				const html = content.toString("utf-8");
				const liveReloadScript = `
<script>
(function() {
  let es;
  function connect() {
    es = new EventSource('/__live_reload');
    es.onmessage = (e) => { if (e.data === 'reload') location.reload(); };
    es.onerror = () => { es.close(); setTimeout(connect, 2000); };
  }
  connect();
})();
</script>
</body>`;
				content = Buffer.from(html.replace("</body>", liveReloadScript));
			}

			res.setHeader("Content-Type", getMimeType(filePath));
			res.setHeader("Cache-Control", devMode ? "no-cache" : "max-age=31536000");
			res.end(content);
			return;
		}

		// SPA fallback
		const indexPath = join(outDir, "index.html");
		if (existsSync(indexPath)) {
			let html = readFileSync(indexPath, "utf-8");

			// Inject live reload script (dev mode only)
			if (devMode) {
				const liveReloadScript = `
<script>
(function() {
  let es;
  function connect() {
    es = new EventSource('/__live_reload');
    es.onmessage = (e) => { if (e.data === 'reload') location.reload(); };
    es.onerror = () => { es.close(); setTimeout(connect, 2000); };
  }
  connect();
})();
</script>
</body>`;
				html = html.replace("</body>", liveReloadScript);
			}

			res.setHeader("Content-Type", "text/html");
			res.setHeader("Cache-Control", "no-cache");
			res.end(html);
			return;
		}

		res.statusCode = 404;
		res.end("Not Found");
	});

	// Start server
	server.listen(port, async () => {
		const serverUrl = `http://localhost:${port}`;
		console.log(`Han Browser running at ${serverUrl}`);
		if (coordinatorRunning) {
			console.log(
				`GraphQL available at http://127.0.0.1:${coordinatorPort}/graphql`,
			);
		}
		if (devMode) {
			console.log("[dev] Bun live reload enabled");
		}
		console.log("Press Ctrl+C to stop");

		// Open browser if requested
		if (autoOpen) {
			openBrowser(serverUrl).then((opened) => {
				if (opened) {
					console.log("Browser opened");
				} else {
					console.log(
						`Could not open browser automatically. Visit ${serverUrl} manually.`,
					);
				}
			});
		}
	});

	// Setup graceful shutdown
	const shutdown = () => {
		console.log("\nShutting down...");
		server.close();
		process.exit(0);
	};

	process.on("SIGINT", shutdown);
	process.on("SIGTERM", shutdown);

	// Keep the process running
	await new Promise(() => {
		// This promise never resolves - we wait for signals
	});
}
