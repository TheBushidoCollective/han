import { afterEach, describe, expect, test } from 'bun:test';
import { once } from 'node:events';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  statSync,
} from 'node:fs';
import { connect } from 'node:net';

import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { startHostedDashboardProxy } from '../lib/commands/browse/hosted-proxy.ts';

const cleanups: Array<() => void | Promise<void>> = [];
afterEach(async () => {
  for (const [index, cleanup] of cleanups.splice(0).reverse().entries()) {
    const { promise, reject } = Promise.withResolvers<never>();
    const timer = setTimeout(
      () => reject(new Error(`Gateway cleanup ${index} timed out`)),
      3000
    );
    try {
      await Promise.race([cleanup(), promise]);
    } finally {
      clearTimeout(timer);
    }
  }
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

async function rawRequest(
  url: string,
  method: string,
  path: string,
  requestHeaders: string[],
  body = ''
): Promise<{ status: number; response: string }> {
  const target = new URL(url);
  const socket = connect(Number(target.port), target.hostname);
  const { promise, resolve, reject } = Promise.withResolvers<{
    status: number;
    response: string;
  }>();
  let response = '';
  socket.setTimeout(3000, () => socket.destroy(new Error('Request timed out')));
  socket.on('error', reject);
  socket.on('data', (chunk) => {
    response += chunk.toString();
  });
  socket.on('end', () => {
    const status = Number(/^HTTP\/1\.[01] (\d+)/.exec(response)?.[1]);
    if (!status) reject(new Error('Missing HTTP response status'));
    else resolve({ status, response });
  });
  socket.on('connect', () => {
    socket.write(
      `${method} ${path} HTTP/1.1\r\n${requestHeaders.join('\r\n')}\r\n${requestHeaders.some((h) => h.toLowerCase().startsWith('connection:')) ? '' : 'Connection: close\r\n'}Content-Length: ${Buffer.byteLength(body)}\r\n\r\n${body}`
    );
  });
  return promise;
}

function navigationHeaders(url: string): string[] {
  return [
    `Host: ${new URL(url).host}`,
    'Sec-Fetch-Site: cross-site',
    'Sec-Fetch-Mode: navigate',
    'Sec-Fetch-Dest: document',
  ];
}

describe('local dashboard gateway', () => {
  test('allows only a public cross-site root document navigation', async () => {
    const { proxy, seen, launchToken } = await setup();
    const nav = navigationHeaders(proxy.url);
    const before = seen.length;
    const result = await rawRequest(proxy.url, 'GET', '/', nav);
    expect(result.status).toBe(200);
    expect(result.response).toContain('dashboard');
    expect(result.response).not.toContain(launchToken);
    expect(result.response.toLowerCase()).not.toContain('set-cookie:');
    expect(result.response.toLowerCase()).not.toContain(
      'access-control-allow-origin:'
    );
    expect(result.response.toLowerCase()).toContain(
      'referrer-policy: no-referrer'
    );
    expect(result.response.toLowerCase()).toContain(
      'x-content-type-options: nosniff'
    );
    expect(result.response.toLowerCase()).toContain("frame-ancestors 'none'");
    expect(seen.length).toBe(before + 1);
    expect(existsSync(fileURLToPath(proxy.launcherUrl))).toBe(true);
    const session = await exchange(proxy.url, launchToken);
    expect(session.status).toBe(200);
    const { accessToken } = (await session.json()) as { accessToken: string };
    expect(result.response).not.toContain(accessToken);
  });

  test('rejects neighboring navigation requests before asset dispatch', async () => {
    const { proxy, seen } = await setup();
    const nav = navigationHeaders(proxy.url);
    const cases: Array<[string, string, string[], number]> = [];
    for (const method of ['HEAD', 'POST', 'OPTIONS', 'PUT', 'DELETE'])
      cases.push([method, '/', nav, 403]);
    for (const path of [
      '/index.html',
      '/sessions',
      '/graphql',
      '/_han/session',
      '/_han/react-preamble.js',
      '/?x=1',
    ])
      cases.push(['GET', path, nav, 403]);
    for (const dest of [
      'iframe',
      'frame',
      'fencedframe',
      'object',
      'embed',
      'empty',
      'script',
      'style',
      'image',
      'font',
      'worker',
    ])
      cases.push([
        'GET',
        '/',
        nav.map((h) =>
          h.startsWith('Sec-Fetch-Dest:') ? `Sec-Fetch-Dest: ${dest}` : h
        ),
        403,
      ]);
    for (const mode of ['cors', 'no-cors', 'same-origin', 'websocket'])
      cases.push([
        'GET',
        '/',
        nav.map((h) =>
          h.startsWith('Sec-Fetch-Mode:') ? `Sec-Fetch-Mode: ${mode}` : h
        ),
        403,
      ]);
    cases.push([
      'GET',
      '/',
      nav.filter((h) => !h.startsWith('Sec-Fetch-Mode:')),
      403,
    ]);
    cases.push([
      'GET',
      '/',
      nav.filter((h) => !h.startsWith('Sec-Fetch-Dest:')),
      403,
    ]);
    for (const site of ['same-site', 'unrecognized'])
      cases.push([
        'GET',
        '/',
        nav.map((h) =>
          h.startsWith('Sec-Fetch-Site:') ? `Sec-Fetch-Site: ${site}` : h
        ),
        403,
      ]);
    for (const origin of ['null', 'http://example.com', proxy.url])
      cases.push(['GET', '/', [...nav, `Origin: ${origin}`], 403]);
    const target = new URL(proxy.url);
    for (const host of [
      'example.com',
      `127.0.0.1:${Number(target.port) + 1}`,
      `localhost:${target.port}`,
    ])
      cases.push([
        'GET',
        '/',
        nav.map((h) => (h.startsWith('Host:') ? `Host: ${host}` : h)),
        421,
      ]);
    cases.push(['GET', '/', nav.filter((h) => !h.startsWith('Host:')), 400]);
    cases.push([
      'GET',
      '/',
      nav.map((h) => (h.startsWith('Host:') ? 'Host: invalid host' : h)),
      400,
    ]);
    for (const name of [
      'Host',
      'Origin',
      'Sec-Fetch-Site',
      'Sec-Fetch-Mode',
      'Sec-Fetch-Dest',
    ]) {
      const headers =
        name === 'Origin' ? [...nav, `Origin: ${proxy.url}`] : nav;
      const original = headers.find((h) => h.startsWith(`${name}:`));
      if (!original) throw new Error(`Missing ${name}`);
      cases.push(['GET', '/', [...headers, original], 400]);
    }
    const before = seen.length;
    for (const [method, path, headers, status] of cases) {
      expect((await rawRequest(proxy.url, method, path, headers)).status).toBe(
        status
      );
      expect(seen.length).toBe(before);
    }
    for (const site of ['same-origin', 'none']) {
      for (const method of ['GET', 'HEAD']) {
        const headers = nav.map((h) =>
          h.startsWith('Sec-Fetch-Site:') ? `Sec-Fetch-Site: ${site}` : h
        );
        expect((await rawRequest(proxy.url, method, '/', headers)).status).toBe(
          200
        );
      }
    }
    expect((await rawRequest(proxy.url, 'GET', '/', [nav[0]])).status).toBe(
      200
    );
  });
  test('keeps session, GraphQL, and upgrade protections independent', async () => {
    const { proxy, launchToken } = await setup();
    const host = `Host: ${new URL(proxy.url).host}`;
    const json = 'Content-Type: application/json';
    const body = JSON.stringify({ transportVersion: 1, launchToken });
    const post = (path: string, headers: string[], payload = body) =>
      rawRequest(proxy.url, 'POST', path, [host, json, ...headers], payload);
    const origin = `Origin: ${proxy.url}`;
    const sameOrigin = 'Sec-Fetch-Site: same-origin';
    for (const site of ['cross-site', 'same-site', 'none'])
      expect(
        (await post('/_han/session', [origin, `Sec-Fetch-Site: ${site}`]))
          .status
      ).toBe(403);
    for (const badOrigin of [
      [],
      ['Origin: null'],
      ['Origin: http://example.com'],
    ])
      expect(
        (await post('/_han/session', [sameOrigin, ...badOrigin])).status
      ).toBe(403);
    expect(
      (
        await post(
          '/_han/session',
          [origin, sameOrigin],
          JSON.stringify({ transportVersion: 1, launchToken: 'wrong' })
        )
      ).status
    ).toBe(401);
    expect(
      (
        await post(
          '/_han/session',
          [origin, sameOrigin],
          JSON.stringify({ transportVersion: 1 })
        )
      ).status
    ).toBe(401);
    expect(
      (
        await post(
          '/_han/session',
          [origin, sameOrigin],
          JSON.stringify({ transportVersion: 2, launchToken })
        )
      ).status
    ).toBe(401);
    expect(
      (
        await rawRequest(
          proxy.url,
          'POST',
          '/_han/session',
          [host, origin, sameOrigin, 'Content-Type: text/plain'],
          body
        )
      ).status
    ).toBe(415);
    const session = await exchange(proxy.url, launchToken);
    expect(session.status).toBe(200);
    const { accessToken } = (await session.json()) as { accessToken: string };
    expect((await post('/_han/session', [origin, sameOrigin])).status).toBe(
      401
    );

    const bearer = `Authorization: Bearer ${accessToken}`;
    expect(
      (
        await post(
          '/graphql',
          [origin, 'Sec-Fetch-Site: cross-site', bearer],
          '{}'
        )
      ).status
    ).toBe(403);
    for (const badOrigin of [
      [],
      ['Origin: null'],
      ['Origin: http://example.com'],
    ])
      expect(
        (await post('/graphql', [sameOrigin, bearer, ...badOrigin], '{}'))
          .status
      ).toBe(403);
    for (const authorization of [[], ['Authorization: Bearer wrong']])
      expect(
        (await post('/graphql', [origin, sameOrigin, ...authorization], '{}'))
          .status
      ).toBe(401);

    const upgrade = [
      host,
      'Upgrade: websocket',
      'Connection: Upgrade',
      'Sec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==',
      'Sec-WebSocket-Version: 13',
      'Sec-WebSocket-Protocol: graphql-transport-ws',
    ];
    for (const site of ['cross-site', 'same-site', 'none'])
      expect(
        (
          await rawRequest(proxy.url, 'GET', '/graphql', [
            ...upgrade,
            origin,
            `Sec-Fetch-Site: ${site}`,
          ])
        ).status
      ).toBe(403);
    for (const badOrigin of [
      [],
      ['Origin: null'],
      ['Origin: http://example.com'],
    ])
      expect(
        (
          await rawRequest(proxy.url, 'GET', '/graphql', [
            ...upgrade,
            sameOrigin,
            ...badOrigin,
          ])
        ).status
      ).toBe(403);
    for (const metadata of [
      'Sec-Fetch-Mode: navigate',
      'Sec-Fetch-Dest: document',
    ])
      expect(
        (
          await rawRequest(proxy.url, 'GET', '/graphql', [
            ...upgrade,
            origin,
            sameOrigin,
            metadata,
          ])
        ).status
      ).toBe(403);
    expect(
      (
        await rawRequest(proxy.url, 'GET', '/', [
          ...upgrade,
          ...navigationHeaders(proxy.url).slice(1),
        ])
      ).status
    ).toBe(403);
  });

  test('rejects an expired launch capability', async () => {
    const { proxy, launchToken } = await setup();
    const now = Date.now;
    try {
      Date.now = () => now() + 120_001;
      expect((await exchange(proxy.url, launchToken)).status).toBe(401);
    } finally {
      Date.now = now;
    }
  });
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
  test('rejects non-loopback origin before listening', async () => {
    await expect(
      startHostedDashboardProxy({
        port: 0,
        origin: 'https://example.com',
      })
    ).rejects.toThrow('Development assets must use a literal loopback origin');
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
  test('shutdown closes an idle keep-alive connection', async () => {
    const { proxy } = await setup();
    const target = new URL(proxy.url);
    const socket = connect(Number(target.port), target.hostname);
    const response = once(socket, 'data');
    const closed = once(socket, 'close');
    socket.write(
      `GET / HTTP/1.1\r\nHost: ${target.host}\r\nConnection: keep-alive\r\n\r\n`
    );
    await response;
    await proxy.close();
    await closed;
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
    const target = new URL(proxy.url);
    const { promise, resolve, reject } = Promise.withResolvers<number>();
    const socket = connect(Number(target.port), target.hostname);
    let buffer = Buffer.alloc(0);
    let upgraded = false;
    socket.setTimeout(3000, () =>
      socket.destroy(
        new Error(
          `WebSocket timed out ${upgraded ? 'after' : 'before'} upgrade`
        )
      )
    );
    socket.on('error', reject);
    socket.on('end', () =>
      reject(new Error('WebSocket closed before close frame'))
    );
    socket.on('connect', () => {
      socket.write(
        `GET /graphql HTTP/1.1\r\nHost: ${target.host}\r\nOrigin: ${proxy.url}\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Key: dGhlIHNhbXBsZSBub25jZQ==\r\nSec-WebSocket-Version: 13\r\nSec-WebSocket-Protocol: graphql-transport-ws\r\n\r\n`
      );
    });
    socket.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk]);
      if (!upgraded) {
        const end = buffer.indexOf('\r\n\r\n');
        if (end < 0) return;
        const headers = buffer.subarray(0, end).toString();
        if (!/^HTTP\/1\.1 101\b/.test(headers)) {
          socket.destroy();
          reject(
            new Error(`WebSocket upgrade rejected: ${headers.split('\r\n')[0]}`)
          );
          return;
        }
        upgraded = true;
        buffer = buffer.subarray(end + 4);
        const payload = Buffer.from(
          JSON.stringify({
            type: 'connection_init',
            payload: { authorization: 'Bearer incorrect' },
          })
        );
        const mask = Buffer.from([1, 2, 3, 4]);
        const masked = Buffer.from(
          payload.map((byte, index) => byte ^ mask[index % 4])
        );
        socket.write(
          Buffer.concat([
            Buffer.from([0x81, 0x80 | payload.length]),
            mask,
            masked,
          ])
        );
      }
      if (buffer.length >= 4 && (buffer[0] & 0x0f) === 8) {
        const code = buffer.readUInt16BE(2);
        socket.destroy();
        resolve(code);
      }
    });
    expect(await promise).toBe(4401);
  });
});
