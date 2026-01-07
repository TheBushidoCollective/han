/**
 * Coordinator GraphQL Server
 *
 * Sets up the GraphQL server with WebSocket subscriptions.
 * This is the central server that all clients connect to.
 */

import { createServer, type Server } from "node:http";
import { parse } from "node:url";
import { makeServer } from "graphql-ws";
import { createYoga } from "graphql-yoga";
import { WebSocketServer } from "ws";
import {
	coordinator,
	type IndexResult,
	initDb,
	messages,
	watcher,
} from "../../db/index.ts";
import { createLoaders } from "../../graphql/loaders.ts";
import {
	type MessageEdgeData,
	publishSessionAdded,
	publishSessionMessageAdded,
	publishSessionUpdated,
} from "../../graphql/pubsub.ts";
import { schema } from "../../graphql/schema.ts";
import { globalSlotManager } from "../../graphql/types/slot-manager.ts";
import { createLogger } from "../../logger.ts";
import { COORDINATOR_PORT, type CoordinatorOptions } from "./types.ts";

const log = createLogger("coordinator");

/**
 * Server state
 */
interface ServerState {
	httpServer: Server | null;
	wss: WebSocketServer | null;
	startedAt: Date | null;
	heartbeatInterval: NodeJS.Timeout | null;
	watchdogInterval: NodeJS.Timeout | null;
	lastActivity: number;
}

const state: ServerState = {
	httpServer: null,
	wss: null,
	startedAt: null,
	heartbeatInterval: null,
	watchdogInterval: null,
	lastActivity: Date.now(),
};

// Watchdog constants
const WATCHDOG_INTERVAL_MS = 30000; // Check every 30 seconds
const WATCHDOG_TIMEOUT_MS = 120000; // Consider stuck after 2 minutes of no activity

/**
 * Update the last activity timestamp (called on any request/event)
 */
function recordActivity(): void {
	state.lastActivity = Date.now();
}

/**
 * Handle indexed data from the watcher
 * Publishes events to GraphQL subscriptions for real-time updates
 */
async function onDataIndexed(result: IndexResult): Promise<void> {
	if (result.error) {
		log.debug("Index result had error, skipping publish");
		return;
	}

	// Publish session events
	if (result.isNewSession) {
		publishSessionAdded(result.sessionId, null);
	}

	// Always publish session updated for any change
	publishSessionUpdated(result.sessionId);

	// Publish message added events for new messages
	if (result.messagesIndexed > 0) {
		// Fetch the newly indexed messages to include in the subscription payload
		try {
			const newMessages = await messages.list({
				sessionId: result.sessionId,
				limit: result.messagesIndexed,
				offset: Math.max(0, result.totalMessages - result.messagesIndexed),
			});

			// Publish each message with edge data for @prependEdge
			// Skip messages with parentId - they belong to a parent message
			for (let i = 0; i < newMessages.length; i++) {
				const msg = newMessages[i];

				// Skip messages with parentId - these are tool results that belong to a parent message
				if (msg.parentId) {
					continue;
				}

				const messageIndex = result.totalMessages - result.messagesIndexed + i;

				const edgeData: MessageEdgeData = {
					node: {
						id: msg.id,
						timestamp: msg.timestamp,
						type: msg.messageType,
						rawJson: msg.rawJson ?? "{}",
						projectDir: "", // Project dir is on session, not message
						sessionId: result.sessionId,
						lineNumber: msg.lineNumber,
						toolName: msg.toolName, // Required for han_event subtype resolution
					},
					cursor: Buffer.from(`cursor:${messageIndex}`).toString("base64"),
				};

				publishSessionMessageAdded(result.sessionId, messageIndex, edgeData);
			}
		} catch (error) {
			log.error("Failed to fetch messages for subscription:", error);
			publishSessionMessageAdded(result.sessionId, -1, null);
		}
	}
}

/**
 * Start the coordinator server
 */
export async function startServer(
	options: CoordinatorOptions = {},
): Promise<void> {
	const port = options.port ?? COORDINATOR_PORT;

	if (state.httpServer) {
		log.info("Server already running");
		return;
	}

	// Initialize database
	await initDb();
	log.info("Database initialized");

	// Acquire coordinator lock
	const acquired = coordinator.tryAcquire();
	if (!acquired) {
		throw new Error(
			"Failed to acquire coordinator lock - another instance may be running",
		);
	}
	log.info("Acquired coordinator lock");

	// Start heartbeat
	const heartbeatMs = coordinator.getHeartbeatInterval() * 1000;
	state.heartbeatInterval = setInterval(() => {
		if (!coordinator.updateHeartbeat()) {
			log.error("Failed to update heartbeat");
		}
	}, heartbeatMs);

	// Start watchdog timer to detect hangs
	state.watchdogInterval = setInterval(() => {
		const timeSinceActivity = Date.now() - state.lastActivity;
		if (timeSinceActivity > WATCHDOG_TIMEOUT_MS) {
			log.error(
				`Watchdog: No activity for ${Math.round(timeSinceActivity / 1000)}s, restarting...`,
			);
			// Force restart by stopping server - the daemon will restart it
			stopServer();
			process.exit(1);
		}
	}, WATCHDOG_INTERVAL_MS);

	// Record initial activity
	recordActivity();

	// Create GraphQL Yoga handler with DataLoader context
	const yoga = createYoga({
		schema,
		graphqlEndpoint: "/graphql",
		graphiql: true,
		cors: {
			origin: "*",
			methods: ["GET", "POST", "OPTIONS"],
		},
		context: ({ request }) => ({
			request,
			loaders: createLoaders(),
		}),
	});

	// Create WebSocket server for subscriptions
	const wsServer = makeServer({ schema });

	// Create HTTP server
	const httpServer = createServer(async (req, res) => {
		// Record activity on every request
		recordActivity();

		const pathname = parse(req.url || "/").pathname || "/";

		// Health endpoint
		if (pathname === "/health") {
			const uptime = state.startedAt
				? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
				: 0;

			res.setHeader("Content-Type", "application/json");
			res.end(
				JSON.stringify({
					status: "ok",
					pid: process.pid,
					uptime,
					version: process.env.HAN_VERSION || "dev",
				}),
			);
			return;
		}

		// GraphQL endpoint
		if (pathname === "/graphql") {
			try {
				const webRequest = await nodeToWebRequest(req);
				const webResponse = await yoga.fetch(webRequest);
				await sendWebResponse(res, webResponse);
			} catch (error) {
				log.error("GraphQL error:", error);
				res.statusCode = 500;
				res.end("Internal Server Error");
			}
			return;
		}

		// 404 for other routes
		res.statusCode = 404;
		res.end("Not Found");
	});

	// WebSocket handling
	const wss = new WebSocketServer({ noServer: true });

	httpServer.on("upgrade", (request, socket, head) => {
		// Record activity on WebSocket upgrades
		recordActivity();

		const pathname = parse(request.url || "/").pathname;

		if (pathname === "/graphql") {
			wss.handleUpgrade(request, socket, head, (ws) => {
				const closed = wsServer.opened(
					{
						protocol: ws.protocol,
						send: (data) => ws.send(data),
						close: (code, reason) => ws.close(code, reason),
						onMessage: (cb) => {
							ws.on("message", (data) => {
								cb(data.toString());
							});
						},
					},
					{ socket: ws, request },
				);

				ws.on("close", () => {
					closed();
				});
			});
		}
	});

	state.httpServer = httpServer;
	state.wss = wss;
	state.startedAt = new Date();

	// Start listening
	await new Promise<void>((resolve) => {
		httpServer.listen(port, "127.0.0.1", () => {
			log.info(`GraphQL server listening on http://127.0.0.1:${port}/graphql`);
			resolve();
		});
	});

	// Start file watcher first to handle incremental updates
	log.info("Starting file watcher...");
	const watchPath = watcher.getDefaultPath();
	const watchStarted = await watcher.start(watchPath);

	if (watchStarted) {
		log.info(`Watching ${watchPath}`);

		// Register callback for instant event-driven updates
		// This is called directly from Rust when new messages are indexed
		watcher.setCallback((result) => {
			// Record activity from file watcher
			recordActivity();
			// Fire and forget - don't block the watcher callback
			void onDataIndexed(result);
		});
		log.info("Event-driven updates enabled");
	} else {
		log.error("Failed to start file watcher");
	}

	// Start global slot manager for cross-session resource coordination
	globalSlotManager.start();
	log.info("Global slot manager started");

	// Skip initial index to keep server responsive during startup
	// Sessions are indexed incrementally via file watcher
	// A full reindex can be triggered with: han index run --all
	log.info("Ready (run 'han index run --all' to index existing sessions)");
}

/**
 * Stop the coordinator server
 */
export function stopServer(): void {
	if (state.heartbeatInterval) {
		clearInterval(state.heartbeatInterval);
		state.heartbeatInterval = null;
	}

	if (state.watchdogInterval) {
		clearInterval(state.watchdogInterval);
		state.watchdogInterval = null;
	}

	// Callback is cleared automatically by watcher.stop()
	watcher.stop();
	globalSlotManager.stop();
	coordinator.release();

	if (state.wss) {
		state.wss.close();
		state.wss = null;
	}

	if (state.httpServer) {
		state.httpServer.close();
		state.httpServer = null;
	}

	state.startedAt = null;
	log.info("Server stopped");
}

/**
 * Get server uptime in seconds
 */
export function getUptime(): number {
	if (!state.startedAt) return 0;
	return Math.floor((Date.now() - state.startedAt.getTime()) / 1000);
}

/**
 * Convert Node.js request to Web API Request
 */
async function nodeToWebRequest(
	req: import("node:http").IncomingMessage,
): Promise<Request> {
	const protocol = "http";
	const host = req.headers.host || "127.0.0.1";
	const url = `${protocol}://${host}${req.url}`;

	const headers = new Headers();
	for (const [key, value] of Object.entries(req.headers)) {
		if (value) {
			if (Array.isArray(value)) {
				for (const v of value) {
					headers.append(key, v);
				}
			} else {
				headers.set(key, value);
			}
		}
	}

	let body: BodyInit | null = null;
	if (req.method !== "GET" && req.method !== "HEAD") {
		const chunks: Buffer[] = [];
		for await (const chunk of req) {
			chunks.push(Buffer.from(chunk));
		}
		body = Buffer.concat(chunks);
	}

	return new Request(url, {
		method: req.method,
		headers,
		body,
	});
}

/**
 * Send Web API Response through Node.js response
 */
async function sendWebResponse(
	res: import("node:http").ServerResponse,
	webResponse: Response,
): Promise<void> {
	res.statusCode = webResponse.status;
	res.statusMessage = webResponse.statusText;

	webResponse.headers.forEach((value, key) => {
		// Skip Transfer-Encoding - Node.js handles chunked encoding automatically
		// when using res.write() with streaming responses
		if (key.toLowerCase() === "transfer-encoding") return;
		res.setHeader(key, value);
	});

	if (webResponse.body) {
		const reader = webResponse.body.getReader();
		while (true) {
			const { done, value } = await reader.read();
			if (done) break;
			res.write(value);
		}
	}
	res.end();
}
