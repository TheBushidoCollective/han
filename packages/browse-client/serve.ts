/**
 * Static File Server for Hosted Dashboard
 *
 * Serves the built browse-client as a static site on Railway.
 * Supports SPA routing by falling back to index.html.
 */

import { join } from 'node:path';
import { file } from 'bun';

const DIST_DIR = join(import.meta.dir, 'out');
const PORT = Number(process.env.PORT) || 3000;

Bun.serve({
  port: PORT,
  async fetch(req) {
    const url = new URL(req.url);
    const filePath = join(DIST_DIR, url.pathname);

    // Try exact file first
    let fileObj = file(filePath);
    if (await fileObj.exists()) {
      return new Response(fileObj);
    }

    // Try with .html extension
    fileObj = file(`${filePath}.html`);
    if (await fileObj.exists()) {
      return new Response(fileObj);
    }

    // Fallback to index.html for SPA routing
    const indexFile = file(join(DIST_DIR, 'index.html'));
    if (await indexFile.exists()) {
      return new Response(indexFile, {
        headers: { 'Content-Type': 'text/html' },
      });
    }

    return new Response('Not Found', { status: 404 });
  },
});

console.log(`Dashboard serving on port ${PORT}`);
console.log(`Serving files from: ${DIST_DIR}`);
