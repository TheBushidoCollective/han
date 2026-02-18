#!/usr/bin/env bun
/**
 * Development server with live reload using Bun
 *
 * Features:
 * - Full rebuilds on file changes with relay and pages plugins
 * - Live reload via WebSocket
 * - Proxies /graphql to the han backend
 * - SPA fallback for client-side routing
 */
import { watch } from "node:fs";
import { dirname, extname, join } from "node:path";
import { pagesPlugin } from "./pages-plugin";
import { relayPlugin } from "./relay-plugin";
import { rnwCompatPlugin } from "./rnw-compat-plugin";

const projectRoot = dirname(import.meta.dir);
const srcDir = join(projectRoot, "src");
const pagesDir = join(srcDir, "pages");
const outDir = join(projectRoot, ".dev-out");

const PORT = Number(process.env.PORT) || 3000;

// Connected clients for live reload
const liveReloadClients = new Set<{ send: (msg: string) => void }>();

// MIME types
const mimeTypes: Record<string, string> = {
	".html": "text/html",
	".js": "application/javascript",
	".mjs": "application/javascript",
	".css": "text/css",
	".json": "application/json",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".gif": "image/gif",
	".svg": "image/svg+xml",
	".ico": "image/x-icon",
	".woff": "font/woff",
	".woff2": "font/woff2",
};

async function build() {
	const start = performance.now();

	const result = await Bun.build({
		entrypoints: [join(projectRoot, "index.html")],
		outdir: outDir,
		target: "browser",
		splitting: true,
		minify: false,
		sourcemap: "inline",
		plugins: [
			rnwCompatPlugin(),
			relayPlugin({ devMode: true }),
			pagesPlugin({ pagesDir }),
		],
		define: {
			"process.env.NODE_ENV": JSON.stringify("development"),
			"import.meta.env.MODE": JSON.stringify("development"),
			"import.meta.env.PROD": "false",
			"import.meta.env.DEV": "true",
			global: "globalThis",
		},
	});

	const elapsed = (performance.now() - start).toFixed(0);

	if (!result.success) {
		console.error("Build failed:");
		for (const log of result.logs) {
			console.error("  ", log.message);
		}
		return false;
	}

	console.log(`Built in ${elapsed}ms`);
	return true;
}

// Live reload script injected into HTML
const liveReloadScript = `
<script>
(function() {
  const ws = new WebSocket('ws://' + location.host + '/__live_reload');
  ws.onmessage = () => location.reload();
  ws.onclose = () => setTimeout(() => location.reload(), 1000);
})();
</script>
</body>`;

// Initial build
console.log("Building...");
if (!(await build())) {
	console.error("Initial build failed");
	process.exit(1);
}

// Watch for changes and rebuild
let buildTimeout: Timer | null = null;
watch(srcDir, { recursive: true }, (_event, filename) => {
	if (!filename) return;
	// Debounce rebuilds
	if (buildTimeout) clearTimeout(buildTimeout);
	buildTimeout = setTimeout(async () => {
		console.log(`\nRebuilding (${filename} changed)...`);
		if (await build()) {
			// Notify clients to reload
			for (const client of liveReloadClients) {
				try {
					client.send("reload");
				} catch {
					liveReloadClients.delete(client);
				}
			}
		}
	}, 100);
});

Bun.serve({
	port: PORT,
	async fetch(req, server) {
		const url = new URL(req.url);
		const pathname = url.pathname;

		// Live reload WebSocket
		if (pathname === "/__live_reload") {
			if (server.upgrade(req)) {
				return undefined;
			}
			return new Response("WebSocket upgrade failed", { status: 400 });
		}

		// Note: /graphql is NOT proxied - the React app connects directly to the coordinator
		// at https://coordinator.local.han.guru:41957/graphql via urls.ts config

		// Serve built files
		let filePath: string;
		if (pathname === "/" || !extname(pathname)) {
			filePath = join(outDir, "index.html");
		} else {
			filePath = join(outDir, pathname);
		}

		const file = Bun.file(filePath);
		if (await file.exists()) {
			const ext = extname(filePath);
			let content: string | Blob = file;

			// Inject live reload script into HTML
			if (ext === ".html") {
				const html = await file.text();
				content = html.replace("</body>", liveReloadScript);
			}

			return new Response(content, {
				headers: {
					"Content-Type": mimeTypes[ext] || "application/octet-stream",
					"Cache-Control": "no-cache",
				},
			});
		}

		// SPA fallback
		const indexFile = Bun.file(join(outDir, "index.html"));
		if (await indexFile.exists()) {
			const html = await indexFile.text();
			return new Response(html.replace("</body>", liveReloadScript), {
				headers: {
					"Content-Type": "text/html",
					"Cache-Control": "no-cache",
				},
			});
		}

		return new Response("Not Found", { status: 404 });
	},
	websocket: {
		open(ws) {
			liveReloadClients.add(ws);
		},
		close(ws) {
			liveReloadClients.delete(ws);
		},
		message() {
			// No messages expected from client
		},
	},
});

console.log(`\nDev server running at http://localhost:${PORT}`);
console.log(
	"GraphQL connects directly to coordinator at https://coordinator.local.han.guru:41957/graphql",
);
console.log("Watching for changes...\n");
