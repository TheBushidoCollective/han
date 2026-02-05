/**
 * Static File Server for Hosted Dashboard
 *
 * Serves the built browse-client as a static site on Railway.
 * Supports SPA routing by falling back to index.html.
 */

import { join, extname } from "node:path";
import { file } from "bun";

const DIST_DIR = join(import.meta.dir, "out");
const PORT = Number(process.env.PORT) || 3000;

// MIME type mapping
const MIME_TYPES: Record<string, string> = {
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
	".ttf": "font/ttf",
	".map": "application/json",
};

function getContentType(filePath: string): string {
	const ext = extname(filePath).toLowerCase();
	return MIME_TYPES[ext] || "application/octet-stream";
}

Bun.serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);
		const filePath = join(DIST_DIR, url.pathname);

		// Try exact file first
		let fileObj = file(filePath);
		if (await fileObj.exists()) {
			return new Response(fileObj, {
				headers: { "Content-Type": getContentType(filePath) },
			});
		}

		// Try with .html extension
		const htmlPath = `${filePath}.html`;
		fileObj = file(htmlPath);
		if (await fileObj.exists()) {
			return new Response(fileObj, {
				headers: { "Content-Type": "text/html" },
			});
		}

		// Fallback to index.html for SPA routing
		const indexFile = file(join(DIST_DIR, "index.html"));
		if (await indexFile.exists()) {
			return new Response(indexFile, {
				headers: { "Content-Type": "text/html" },
			});
		}

		return new Response("Not Found", { status: 404 });
	},
});

console.log(`Dashboard serving on port ${PORT}`);
console.log(`Serving files from: ${DIST_DIR}`);
