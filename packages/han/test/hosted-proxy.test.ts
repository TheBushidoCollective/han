/**
 * Tests for the loopback dashboard proxy.
 *
 * The point of the proxy is that the page origin becomes loopback, so these
 * assert the bytes survive the hop and that a broken upstream is reported
 * rather than hanging.
 */
import { afterEach, describe, expect, test } from 'bun:test';
import { request } from 'node:http';
import { gzipSync } from 'node:zlib';
import { startHostedDashboardProxy } from '../lib/commands/browse/hosted-proxy.ts';

interface Upstream {
  origin: string;
  stop(): void;
  requestedPaths: string[];
}

function startUpstream(
  handler: (path: string) => Response | Promise<Response>
): Upstream {
  const requestedPaths: string[] = [];
  const server = Bun.serve({
    port: 0,
    hostname: '127.0.0.1',
    async fetch(req) {
      const path = new URL(req.url).pathname;
      requestedPaths.push(path);
      return await handler(path);
    },
  });
  return {
    origin: `http://127.0.0.1:${server.port}`,
    stop: () => server.stop(true),
    requestedPaths,
  };
}

const cleanups: Array<() => void | Promise<void>> = [];

afterEach(async () => {
  for (const cleanup of cleanups.splice(0)) {
    await cleanup();
  }
});

async function proxyTo(upstream: Upstream) {
  const proxy = await startHostedDashboardProxy({
    port: 0,
    origin: upstream.origin,
  });
  cleanups.push(() => proxy.close());
  cleanups.push(() => upstream.stop());
  // port 0 asks the OS to pick one; read back what it chose.
  const address = proxy.server.address();
  const port = typeof address === 'object' && address ? address.port : 0;
  return `http://127.0.0.1:${port}`;
}

describe('hosted dashboard proxy', () => {
  test('serves the upstream shell from a loopback origin', async () => {
    const upstream = startUpstream(
      () =>
        new Response('<!doctype html><html><body>dash</body></html>', {
          headers: { 'content-type': 'text/html' },
        })
    );
    const base = await proxyTo(upstream);

    const res = await fetch(base);

    expect(res.status).toBe(200);
    expect(res.headers.get('content-type')).toContain('text/html');
    expect(await res.text()).toContain('dash');
    expect(new URL(base).hostname).toBe('127.0.0.1');
  });

  test('forwards the request path so SPA routes and assets resolve', async () => {
    const upstream = startUpstream(
      (path) =>
        new Response(`served ${path}`, {
          headers: { 'content-type': 'text/plain' },
        })
    );
    const base = await proxyTo(upstream);

    expect(await (await fetch(`${base}/main-abc123.js`)).text()).toBe(
      'served /main-abc123.js'
    );
    expect(await (await fetch(`${base}/sessions`)).text()).toBe(
      'served /sessions'
    );
  });

  test('does not forward content-encoding, which fetch already decoded', async () => {
    // A second decode attempt in the browser shows up as a corrupt bundle.
    const upstream = startUpstream(
      () =>
        new Response(gzipSync(Buffer.from('console.log("bundle")')), {
          headers: {
            'content-type': 'application/javascript',
            'content-encoding': 'gzip',
          },
        })
    );
    const base = await proxyTo(upstream);

    const res = await fetch(`${base}/main.js`);

    expect(res.headers.get('content-encoding')).toBeNull();
    expect(await res.text()).toBe('console.log("bundle")');
  });

  test('preserves an upstream error status', async () => {
    const upstream = startUpstream(() => new Response('nope', { status: 404 }));
    const base = await proxyTo(upstream);

    expect((await fetch(`${base}/missing`)).status).toBe(404);
  });

  test('rejects absolute and network-path request targets', async () => {
    const upstream = startUpstream(() => new Response('unexpected'));
    const proxy = await proxyTo(upstream);
    for (const path of ['http://example.com/secret', '//example.com/secret']) {
      const { promise, resolve, reject } = Promise.withResolvers<
        number | undefined
      >();
      const req = request(proxy, { path }, (res) => {
        res.resume();
        resolve(res.statusCode);
      });
      req.on('error', reject);
      req.end();
      expect(await promise).toBe(400);
    }
    expect(upstream.requestedPaths).toEqual([]);
  });

  test('follows same-origin redirects but refuses a different origin', async () => {
    const other = startUpstream(() => new Response('secret'));
    cleanups.push(() => other.stop());
    const upstream = startUpstream((path) => {
      if (path === '/local')
        return new Response(null, {
          status: 302,
          headers: { location: '/final' },
        });
      if (path === '/external')
        return Response.redirect(`${other.origin}/secret`, 302);
      return new Response('dashboard');
    });
    const proxy = await proxyTo(upstream);
    expect(await (await fetch(`${proxy}/local`)).text()).toBe('dashboard');
    expect((await fetch(`${proxy}/external`)).status).toBe(502);
    expect(other.requestedPaths).toEqual([]);
  });

  test('reports an unreachable upstream instead of hanging', async () => {
    // Nothing is listening on this port, so the fetch fails immediately.
    const proxy = await startHostedDashboardProxy({
      port: 0,
      origin: 'http://127.0.0.1:1',
    });
    cleanups.push(() => proxy.close());
    const address = proxy.server.address();
    const port = typeof address === 'object' && address ? address.port : 0;

    const res = await fetch(`http://127.0.0.1:${port}/`);

    expect(res.status).toBe(502);
    const body = await res.text();
    expect(body).toContain('Could not reach the dashboard bundle');
    expect(body).toContain('han browse --local');
  });
});
