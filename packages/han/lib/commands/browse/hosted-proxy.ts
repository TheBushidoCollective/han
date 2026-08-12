/**
 * Loopback proxy for the hosted dashboard.
 *
 * The dashboard talks to the coordinator on a loopback port. Chrome 151 gates
 * that with the `local-network-access` permission whenever the page itself came
 * from a public origin, and the request stalls with no error until the
 * permission is granted. Opening `https://dashboard.local.han.guru` directly
 * therefore leaves the dashboard on "Connecting to Han Coordinator..." forever.
 *
 * Serving the same bundle from `http://127.0.0.1` puts the page and the
 * coordinator in the same address space, so no permission is involved. This
 * process fetches upstream itself, which is unrestricted.
 */

import { createServer } from 'node:http';
import type { Server } from 'node:http';

/** Origin the dashboard bundle is published to. */
export const HOSTED_DASHBOARD_ORIGIN = 'https://dashboard.local.han.guru';

/**
 * Headers that describe the upstream connection or its wire encoding. `fetch`
 * has already decoded the body, so forwarding `content-encoding` would make the
 * browser try to decode it a second time.
 */
const STRIPPED_RESPONSE_HEADERS = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
  'strict-transport-security',
]);

export interface HostedProxyOptions {
  /** Loopback port to listen on. */
  port: number;
  /** Upstream origin to fetch from. Defaults to the published dashboard. */
  origin?: string;
}

export interface HostedProxy {
  /** URL to open in the browser. */
  url: string;
  server: Server;
  close(): Promise<void>;
}

/**
 * Render the upstream failure as a page, so the browser shows the reason rather
 * than a bare connection error.
 */
function upstreamErrorPage(origin: string, reason: string): string {
  return `<!doctype html>
<html lang="en"><head><meta charset="utf-8"><title>Han Dashboard unavailable</title>
<style>
body{font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Helvetica,Arial,sans-serif;
background:#0d1117;color:#c9d1d9;display:flex;align-items:center;justify-content:center;
height:100vh;margin:0}
main{max-width:34rem;padding:2rem}
h1{font-size:1.25rem;margin-bottom:.75rem}
code{background:#161b22;padding:.15rem .35rem;border-radius:4px}
p{line-height:1.6;color:#8b949e}
</style></head>
<body><main>
<h1>Could not reach the dashboard bundle</h1>
<p>Han serves the dashboard from this machine so it can talk to your local
coordinator. Fetching it from <code>${origin}</code> failed: ${reason}</p>
<p>If you are offline and working from a checkout of the repository, run
<code>han browse --local</code> to build the dashboard from source instead.</p>
</main></body></html>`;
}

/**
 * Start the loopback proxy. Resolves once it is accepting connections.
 */
export async function startHostedDashboardProxy(
  options: HostedProxyOptions
): Promise<HostedProxy> {
  const origin = options.origin ?? HOSTED_DASHBOARD_ORIGIN;

  const server = createServer(async (req, res) => {
    const target = new URL(req.url || '/', origin);

    try {
      const upstream = await fetch(target, {
        headers: {
          // Upstream serves the SPA shell for unknown paths; pass the accept
          // header through so it can still content-negotiate assets.
          ...(req.headers.accept ? { accept: req.headers.accept } : {}),
        },
        redirect: 'follow',
      });

      const body = Buffer.from(await upstream.arrayBuffer());

      res.statusCode = upstream.status;
      upstream.headers.forEach((value, name) => {
        if (!STRIPPED_RESPONSE_HEADERS.has(name.toLowerCase())) {
          res.setHeader(name, value);
        }
      });
      res.setHeader('Content-Length', body.byteLength);
      res.end(body);
    } catch (error) {
      const reason = error instanceof Error ? error.message : String(error);
      res.statusCode = 502;
      res.setHeader('Content-Type', 'text/html');
      res.end(upstreamErrorPage(origin, reason));
    }
  });

  const { promise, resolve, reject } = Promise.withResolvers<void>();
  server.once('error', reject);
  // Bind the loopback address explicitly. `localhost` can resolve to ::1, and
  // the page origin should be the same literal the browser was pointed at.
  server.listen(options.port, '127.0.0.1', () => resolve());
  await promise;
  server.removeListener('error', reject);

  return {
    url: `http://127.0.0.1:${options.port}`,
    server,
    async close() {
      const closed = Promise.withResolvers<void>();
      server.close(() => closed.resolve());
      await closed.promise;
    },
  };
}
