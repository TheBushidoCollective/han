/**
 * HTTP server for the memory browse feature
 *
 * Uses Bun.serve() with GraphQL (graphql-yoga) and WebSocket subscriptions (graphql-ws).
 * Proxies UI requests to Next.js running as a subprocess.
 */

import { makeServer } from "graphql-ws";
import { createYoga } from "graphql-yoga";
import { publishMemoryEvent } from "../../graphql/pubsub.ts";
import { schema } from "../../graphql/schema.ts";
import type { BrowseServerResult, MemoryEvent, SSEClient } from "./types.ts";

/**
 * Check if running in development mode
 */
function detectDevMode(): boolean {
	if (process.env.NODE_ENV === "production") return false;
	if (process.env.NODE_ENV === "development") return true;
	const mainFile = Bun.main;
	return mainFile.endsWith(".ts") || mainFile.endsWith(".tsx");
}

const isDevelopment = detectDevMode();

export function isDevMode(): boolean {
	return isDevelopment;
}

/**
 * Next.js server port (set when Next.js is started)
 */
let nextJsPort: number | null = null;

/**
 * Set the Next.js server port for proxying
 */
export function setNextJsPort(port: number): void {
	nextJsPort = port;
}

/**
 * WebSocket data type for storing handlers
 */
interface WsData {
	wsId?: number;
	protocol?: string;
	onMessageCb?: (message: string) => void;
}

/**
 * Create the graphql-ws server handler
 */
const wsServer = makeServer({ schema });

/**
 * Create GraphQL Yoga instance with @defer support
 *
 * GraphQL Yoga v5+ has built-in support for @defer and @stream directives,
 * enabling incremental delivery for expensive fields.
 */
const yoga = createYoga({
	schema,
	graphqlEndpoint: "/graphql",
	graphiql: true,
	cors: {
		origin: "*",
		methods: ["GET", "POST", "OPTIONS"],
	},
});

/**
 * Generate a unique client ID
 */
function generateClientId(): string {
	const timestamp = Date.now().toString(36);
	const random = Math.random().toString(36).substring(2, 8);
	return `${timestamp}-${random}`;
}

/**
 * Format an SSE message
 */
function formatSSEMessage(event: MemoryEvent): string {
	const eventType = event.type;
	const data = JSON.stringify(event);
	return `event: ${eventType}\ndata: ${data}\n\n`;
}

/**
 * Proxy a request to the Next.js server
 */
async function proxyToNextJs(req: Request): Promise<Response> {
	if (!nextJsPort) {
		return new Response(
			`<!DOCTYPE html>
<html>
<head><title>Starting...</title></head>
<body style="font-family: system-ui; padding: 40px; background: #1a1a2e; color: #eee;">
	<h1>Starting Next.js...</h1>
	<p>The dashboard is starting up. Please refresh in a moment.</p>
	<script>setTimeout(() => location.reload(), 2000);</script>
</body>
</html>`,
			{
				status: 503,
				headers: { "Content-Type": "text/html" },
			},
		);
	}

	const url = new URL(req.url);
	const nextUrl = `http://localhost:${nextJsPort}${url.pathname}${url.search}`;

	try {
		const proxyReq = new Request(nextUrl, {
			method: req.method,
			headers: req.headers,
			body: req.body,
			// @ts-expect-error - duplex is needed for streaming
			duplex: "half",
		});

		const response = await fetch(proxyReq);

		// fetch() automatically decompresses gzip, so we need to remove
		// content-encoding header to avoid browser trying to decompress again
		const headers = new Headers(response.headers);
		headers.delete("content-encoding");
		headers.delete("transfer-encoding");

		// Buffer the response to get proper content-length
		const body = await response.arrayBuffer();
		headers.set("content-length", String(body.byteLength));

		return new Response(body, {
			status: response.status,
			statusText: response.statusText,
			headers,
		});
	} catch (error) {
		const message = error instanceof Error ? error.message : String(error);
		return new Response(
			`<!DOCTYPE html>
<html>
<head><title>Connection Error</title></head>
<body style="font-family: system-ui; padding: 40px; background: #1a1a2e; color: #eee;">
	<h1>Connection Error</h1>
	<p>Could not connect to Next.js server:</p>
	<pre style="background: #0d0d1a; padding: 20px; border-radius: 8px;">${message}</pre>
	<script>setTimeout(() => location.reload(), 2000);</script>
</body>
</html>`,
			{
				status: 502,
				headers: { "Content-Type": "text/html" },
			},
		);
	}
}

/**
 * Start the browse server with SSE support
 */
export async function startBrowseServer(port = 0): Promise<BrowseServerResult> {
	const clients = new Set<SSEClient>();

	function broadcast(event: MemoryEvent): void {
		publishMemoryEvent(event);

		const message = formatSSEMessage(event);
		const encoder = new TextEncoder();
		const encoded = encoder.encode(message);

		for (const client of clients) {
			try {
				client.controller.enqueue(encoded);
			} catch {
				clients.delete(client);
			}
		}
	}

	const wsCleanups = new Map<number, () => void>();
	let wsIdCounter = 0;

	const server = Bun.serve<WsData>({
		port,
		development: isDevelopment,
		fetch(req, server) {
			const url = new URL(req.url);

			// WebSocket upgrade for GraphQL subscriptions
			if (
				url.pathname === "/graphql" &&
				req.headers.get("upgrade") === "websocket"
			) {
				const wsId = ++wsIdCounter;
				const upgraded = server.upgrade(req, { data: { wsId } });
				if (!upgraded) {
					return new Response("WebSocket upgrade failed", { status: 400 });
				}
				return undefined;
			}

			// GraphQL endpoint
			if (url.pathname === "/graphql") {
				return yoga.fetch(req);
			}

			// Reload endpoint
			if (url.pathname === "/api/reload") {
				broadcast({
					type: "reload",
					action: "updated",
					path: "",
					timestamp: Date.now(),
				});
				return new Response(JSON.stringify({ reloaded: true }), {
					headers: { "Content-Type": "application/json" },
				});
			}

			// SSE endpoint for live updates
			if (url.pathname === "/events") {
				const clientId = generateClientId();

				const stream = new ReadableStream({
					start(controller) {
						const client: SSEClient = { controller, id: clientId };
						clients.add(client);

						const encoder = new TextEncoder();
						const connectMessage = encoder.encode(
							`event: connected\ndata: ${JSON.stringify({ clientId })}\n\n`,
						);
						controller.enqueue(connectMessage);

						req.signal.addEventListener("abort", () => {
							clients.delete(client);
						});
					},
					cancel() {
						for (const client of clients) {
							if (client.id === clientId) {
								clients.delete(client);
								break;
							}
						}
					},
				});

				return new Response(stream, {
					headers: {
						"Content-Type": "text/event-stream",
						"Cache-Control": "no-cache",
						Connection: "keep-alive",
						"Access-Control-Allow-Origin": "*",
					},
				});
			}

			// Health check
			if (url.pathname === "/health") {
				return new Response(JSON.stringify({ status: "ok", nextJsPort }), {
					headers: { "Content-Type": "application/json" },
				});
			}

			// All other routes proxy to Next.js
			return proxyToNextJs(req);
		},
		websocket: {
			open(ws) {
				const wsId = ws.data?.wsId ?? 0;
				const cleanup = wsServer.opened(
					{
						protocol: ws.data?.protocol || "graphql-transport-ws",
						send: (data) => {
							ws.send(data);
						},
						close: (code, reason) => ws.close(code, reason),
						onMessage: (cb) => {
							if (ws.data) {
								ws.data.onMessageCb = cb;
							}
						},
					},
					{ socket: ws },
				);
				wsCleanups.set(wsId, cleanup);
			},
			message(ws, message) {
				const msgCb = ws.data?.onMessageCb;
				if (msgCb) {
					msgCb(typeof message === "string" ? message : message.toString());
				}
			},
			close(ws) {
				const wsId = ws.data?.wsId ?? 0;
				const cleanup = wsCleanups.get(wsId);
				if (cleanup) {
					cleanup();
					wsCleanups.delete(wsId);
				}
			},
		},
	});

	const actualPort = server.port as number;
	const serverUrl = `http://localhost:${actualPort}`;

	return {
		server,
		port: actualPort,
		url: serverUrl,
		broadcast,
	};
}
