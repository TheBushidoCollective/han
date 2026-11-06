import { afterEach, describe, expect, test } from 'bun:test';
import {
  existsSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { connect } from 'node:net';

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import WebSocket from 'ws';
import { startHostedDashboardProxy } from '../lib/commands/browse/hosted-proxy.ts';

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const cleanup of cleanups.splice(0).reverse()) await cleanup();
});

async function setup() {
  const dir = mkdtempSync(join(tmpdir(), 'han-gateway-test-'));
  mkdirSync(join(dir, 'runtime'), { mode: 0o700 });
  const old = process.env.HAN_DATA_DIR;
  process.env.HAN_DATA_DIR = dir;
  cleanups.push(() => {
    if (old === undefined) delete process.env.HAN_DATA_DIR;
    else process.env.HAN_DATA_DIR = old;
    rmSync(dir, { recursive: true, force: true });
  });
  const seen: Array<{
    path: string;
    authorization: string | null;
    cookie: string | null;
  }> = [];
  const upstream = Bun.serve({
    hostname: '127.0.0.1',
    port: 0,
    fetch(req) {
      const path = new URL(req.url).pathname;
      seen.push({
        path,
        authorization: req.headers.get('authorization'),
        cookie: req.headers.get('cookie'),
      });
      if (path === '/han-dashboard-manifest.json')
        return Response.json({
          kind: 'local-dashboard',
          transportVersion: 1,
          sourceRevision: 'a'.repeat(40),
        });
      if (path === '/escape')
        return new Response(null, {
          status: 302,
          headers: { location: 'http://example.com/' },
        });
      return new Response('dashboard', {
        headers: { 'set-cookie': 'bad=1', 'content-type': 'text/html' },
      });
    },
  });
  cleanups.push(() => upstream.stop(true));
  const proxy = await startHostedDashboardProxy({
    port: 0,
    origin: `http://127.0.0.1:${upstream.port}`,
  });
  cleanups.push(() => proxy.close());
  const html = readFileSync(fileURLToPath(proxy.launcherUrl), 'utf8');
  const launchToken = html.match(/#launchToken=([A-Za-z0-9_-]+)/)?.[1];
  if (!launchToken) throw new Error('Launcher has no capability');
  return { proxy, seen, launchToken };
}
async function exchange(url: string, launchToken: string, origin = url) {
  return fetch(`${url}/_han/session`, {
    method: 'POST',
    headers: { origin, 'content-type': 'application/json' },
    body: JSON.stringify({ transportVersion: 1, launchToken }),
  });
}

describe('local dashboard gateway', () => {
  test('exchanges a single-use capability and protects private requests', async () => {
    const { proxy, launchToken } = await setup();
    const launcherPath = fileURLToPath(proxy.launcherUrl);
    expect(statSync(launcherPath).mode & 0o777).toBe(0o600);
    expect(
      (await exchange(proxy.url, launchToken, 'http://127.0.0.1:1')).status
    ).toBe(403);
    const session = await exchange(proxy.url, launchToken);
    expect(existsSync(launcherPath)).toBe(false);
    expect(session.status).toBe(200);
    const { accessToken } = (await session.json()) as { accessToken: string };
    expect(accessToken).not.toBe(launchToken);
    expect((await exchange(proxy.url, launchToken)).status).toBe(401);
    expect(
      (
        await fetch(`${proxy.url}/graphql`, {
          method: 'POST',
          headers: { origin: proxy.url, 'content-type': 'application/json' },
          body: '{}',
        })
      ).status
    ).toBe(401);
    expect(
      (
        await fetch(`${proxy.url}/graphql`, {
          method: 'POST',
          headers: {
            origin: proxy.url,
            'content-type': 'text/plain',
            authorization: `Bearer ${accessToken}`,
          },
          body: '{}',
        })
      ).status
    ).toBe(415);
    expect((await fetch(`${proxy.url}/graphql`)).status).toBe(405);
  });
  test('does not forward browser credentials or upstream cookies', async () => {
    const { proxy, seen } = await setup();
    const response = await fetch(`${proxy.url}/`, {
      headers: { authorization: 'Bearer browser-secret', cookie: 'secret=1' },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get('set-cookie')).toBeNull();
    expect(response.headers.get('referrer-policy')).toBe('no-referrer');
    expect(seen.at(-1)?.authorization).toBeNull();
    expect(seen.at(-1)?.cookie).toBeNull();
    expect((await fetch(`${proxy.url}/escape`)).status).toBe(502);
  });
  test('rejects an incompatible dashboard before listening', async () => {
    const upstream = Bun.serve({
      hostname: '127.0.0.1',
      port: 0,
      fetch: () =>
        Response.json({
          kind: 'team-app',
          transportVersion: 1,
          sourceRevision: 'a'.repeat(40),
        }),
    });
    cleanups.push(() => upstream.stop(true));
    await expect(
      startHostedDashboardProxy({
        port: 0,
        origin: `http://127.0.0.1:${upstream.port}`,
      })
    ).rejects.toThrow('UPGRADE_REQUIRED');
  });
  test('an occupied gateway port fails instead of attaching to the incumbent', async () => {
    const { proxy } = await setup();
    const occupied = proxy.server.address();
    if (!occupied || typeof occupied === 'string')
      throw new Error('No address');
    const origin = `http://127.0.0.1:${occupied.port}`;
    await expect(
      startHostedDashboardProxy({ port: occupied.port, origin })
    ).rejects.toThrow();
  });
  test('rejects network-path and absolute-form asset requests', async () => {
    const { proxy, seen } = await setup();
    const target = new URL(proxy.url);
    for (const path of ['//example.com/steal', 'http://example.com/steal']) {
      const { promise, resolve, reject } = Promise.withResolvers<number>();
      const socket = connect(Number(target.port), target.hostname);
      let response = '';
      socket.on('data', (chunk) => {
        response += chunk.toString();
        const code = Number(/^HTTP\/1\.[01] (\d+)/.exec(response)?.[1]);
        if (code) {
          socket.end();
          resolve(code);
        }
      });
      socket.on('error', reject);
      socket.on('connect', () => {
        socket.write(
          `GET ${path} HTTP/1.1\r\nHost: ${target.host}\r\nConnection: close\r\n\r\n`
        );
      });
      const status = await promise;
      expect(status).toBe(400);
    }
    expect(seen.some((item) => item.path === '/steal')).toBe(false);
  });
  test('rejects wrong authority and non-loopback origins', async () => {
    const { proxy } = await setup();
    expect(
      (await fetch(proxy.url, { headers: { host: 'evil.example' } })).status
    ).toBe(421);
    expect(
      (await fetch(proxy.url, { headers: { origin: 'null' } })).status
    ).toBe(403);
    expect(
      (await fetch(proxy.url, { headers: { 'sec-fetch-site': 'cross-site' } }))
        .status
    ).toBe(403);
  });
  test('closes websocket before upstream connection when token is invalid', async () => {
    const { proxy } = await setup();
    const socket = new WebSocket(
      `${proxy.url.replace('http:', 'ws:')}/graphql`,
      'graphql-transport-ws',
      { origin: proxy.url }
    );
    const closed = Promise.withResolvers<number>();
    socket.on('open', () =>
      socket.send(
        JSON.stringify({
          type: 'connection_init',
          payload: { authorization: 'Bearer incorrect' },
        })
      )
    );
    socket.on('close', (code) => closed.resolve(code));
    socket.on('error', closed.reject);
    expect(await closed.promise).toBe(4401);
  });
});
