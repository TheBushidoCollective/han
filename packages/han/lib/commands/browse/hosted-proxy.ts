import { randomBytes, timingSafeEqual } from 'node:crypto';
import {
  closeSync,
  constants,
  lstatSync,
  openSync,
  readFileSync,
  unlinkSync,
  writeFileSync,
} from 'node:fs';
import {
  createServer,
  type IncomingMessage,
  type Server,
  type ServerResponse,
} from 'node:http';
import type { Socket } from 'node:net';
import { join, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import type { ReadableStream as NodeReadableStream } from 'node:stream/web';
import { pathToFileURL } from 'node:url';
import WebSocket, { WebSocketServer } from 'ws';
import {
  CoordinatorSecurityError,
  coordinatorRequest,
  coordinatorWebSocket,
  getCoordinatorDataDir,
} from '../../coordinator/connection.ts';

export const HOSTED_DASHBOARD_ORIGIN = 'https://dashboard.local.han.guru';
const TOKEN_LIFETIME = 120_000;
const INIT_TIMEOUT = 5_000;
const stripped = new Set([
  'connection',
  'content-encoding',
  'content-length',
  'keep-alive',
  'transfer-encoding',
  'strict-transport-security',
  'set-cookie',
  'content-security-policy',
  'content-security-policy-report-only',
  'x-frame-options',
  'referrer-policy',
  'access-control-allow-origin',
  'access-control-allow-credentials',
  'access-control-allow-private-network',
  'location',
]);

export interface HostedProxyOptions {
  port: number;
  origin?: string;
  assetDir?: string;
  dev?: boolean;
}
export interface HostedProxy {
  url: string;
  launcherUrl: string;
  server: Server;
  close(): Promise<void>;
}

function token(): string {
  return randomBytes(32).toString('base64url');
}
function equal(a: unknown, b: string): boolean {
  if (typeof a !== 'string') return false;
  const left = Buffer.from(a);
  const right = Buffer.from(b);
  return left.length === right.length && timingSafeEqual(left, right);
}
function header(req: IncomingMessage, name: string): string | undefined | null {
  const values: string[] = [];
  for (let i = 0; i < req.rawHeaders.length; i += 2)
    if (req.rawHeaders[i]?.toLowerCase() === name)
      values.push(req.rawHeaders[i + 1] ?? '');
  return values.length > 1 ? null : values[0];
}
function guard(
  req: IncomingMessage,
  authority: string,
  originRequired: boolean
): number | null {
  const host = header(req, 'host');
  if (host === null || !host) return 400;
  if (!/^[A-Za-z0-9.:[\]-]+$/.test(host)) return 400;
  if (host !== authority) return 421;
  const origin = header(req, 'origin');
  if (origin === null) return 400;
  if (
    (originRequired && !origin) ||
    (origin !== undefined && origin !== `http://${authority}`)
  )
    return 403;
  for (const name of [
    'sec-fetch-site',
    'sec-fetch-mode',
    'sec-fetch-dest',
    'authorization',
    'content-type',
    'sec-websocket-protocol',
  ])
    if (header(req, name) === null) return 400;
  const site = header(req, 'sec-fetch-site');
  if (site && site !== 'same-origin' && site !== 'none') return 403;
  if (originRequired && site && site !== 'same-origin') return 403;
  const mode = header(req, 'sec-fetch-mode');
  const dest = header(req, 'sec-fetch-dest');
  if (originRequired && dest && dest !== 'empty') return 403;
  if (req.headers.upgrade && mode && mode !== 'websocket') return 403;
  if (
    req.method === 'POST' &&
    mode &&
    mode !== 'cors' &&
    mode !== 'same-origin'
  )
    return 403;
  return null;
}
function headers(res: ServerResponse, authority: string): void {
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader(
    'Content-Security-Policy',
    `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self' ws://${authority}; frame-ancestors 'none'; base-uri 'none'; object-src 'none'`
  );
}
function validPath(path: string, origin: URL): URL {
  const target = new URL(path, origin);
  if (
    !path.startsWith('/') ||
    path.startsWith('//') ||
    path.includes('\\') ||
    target.origin !== origin.origin
  )
    throw new Error('Invalid dashboard path');
  return target;
}
async function fetchAsset(
  origin: URL,
  path: string,
  method = 'GET',
  accept?: string
): Promise<Response> {
  let target = validPath(path, origin);
  for (let count = 0; ; count++) {
    const response = await fetch(target, {
      method,
      headers: accept ? { accept } : {},
      redirect: 'manual',
    });
    if (![301, 302, 303, 307, 308].includes(response.status)) return response;
    const location = response.headers.get('location');
    if (!location || count >= 5) throw new Error('Invalid dashboard redirect');
    const next = new URL(location, target);
    if (next.origin !== origin.origin)
      throw new Error('Dashboard redirect changed origin');
    target = next;
  }
}
const mime: Record<string, string> = {
  html: 'text/html',
  js: 'application/javascript',
  css: 'text/css',
  json: 'application/json',
  svg: 'image/svg+xml',
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  ico: 'image/x-icon',
  woff: 'font/woff',
  woff2: 'font/woff2',
};
function localAsset(dir: string, path: string): Response {
  const url = validPath(path, new URL('http://127.0.0.1'));
  let pathname = decodeURIComponent(url.pathname);
  if (!pathname.includes('.') || pathname.endsWith('/'))
    pathname = '/index.html';
  const root = resolve(dir);
  const file = resolve(root, `.${pathname}`);
  if (!file.startsWith(root + sep)) throw new Error('Invalid dashboard path');
  try {
    const content = readFileSync(file);
    return new Response(content, {
      headers: {
        'content-type':
          mime[file.split('.').pop() ?? ''] ?? 'application/octet-stream',
      },
    });
  } catch {
    return new Response('Not Found', { status: 404 });
  }
}
function launcher(runtime: string, url: string, launchToken: string): string {
  if (process.platform === 'win32')
    throw new Error(
      'Secure dashboard launcher requires Windows ACL and reparse-point protection'
    );
  const st = lstatSync(runtime);
  if (
    !st.isDirectory() ||
    st.isSymbolicLink() ||
    (st.mode & 0o077) !== 0 ||
    (typeof process.getuid === 'function' && st.uid !== process.getuid())
  )
    throw new Error('Coordinator runtime directory is not owner-protected');
  const path = join(runtime, `launcher-${token()}.html`);
  const fd = openSync(
    path,
    constants.O_CREAT |
      constants.O_EXCL |
      constants.O_WRONLY |
      constants.O_NOFOLLOW,
    0o600
  );
  try {
    writeFileSync(
      fd,
      `<!doctype html><meta charset="utf-8"><meta name="referrer" content="no-referrer"><script>location.replace(${JSON.stringify(`${url}/#launchToken=${launchToken}`)})</script>`
    );
  } catch (error) {
    try {
      unlinkSync(path);
    } catch {
      /* Preserve the original write error. */
    }
    throw error;
  } finally {
    closeSync(fd);
  }
  return path;
}
async function readJson(
  req: IncomingMessage,
  maxBytes = Infinity
): Promise<unknown> {
  let body = '';
  for await (const chunk of req) {
    body += chunk.toString();
    if (body.length > maxBytes) throw new Error('Request too large');
  }
  return JSON.parse(body);
}
function jsonOnly(req: IncomingMessage): boolean {
  return /^application\/json(?:\s*;|\s*$)/i.test(
    header(req, 'content-type') ?? ''
  );
}

export async function startHostedDashboardProxy(
  options: HostedProxyOptions
): Promise<HostedProxy> {
  const origin = new URL(options.origin ?? HOSTED_DASHBOARD_ORIGIN);
  if (
    origin.username ||
    origin.password ||
    !['http:', 'https:'].includes(origin.protocol) ||
    origin.pathname !== '/' ||
    origin.search ||
    origin.hash
  )
    throw new Error('Invalid dashboard origin');
  if (
    options.dev &&
    (origin.protocol !== 'http:' || origin.hostname !== '127.0.0.1')
  ) {
    throw new Error('Development assets must use a literal loopback origin');
  }
  const asset = (path: string, method = 'GET', accept?: string) =>
    options.assetDir
      ? Promise.resolve(localAsset(options.assetDir, path))
      : fetchAsset(origin, path, method, accept);
  const manifest = await asset('/han-dashboard-manifest.json');
  if (!manifest.ok)
    throw new Error('UPGRADE_REQUIRED: dashboard manifest missing');
  let info: unknown;
  try {
    info = await manifest.json();
  } catch {
    throw new Error('UPGRADE_REQUIRED: malformed dashboard manifest');
  }
  if (
    !info ||
    typeof info !== 'object' ||
    !('kind' in info) ||
    info.kind !== 'local-dashboard' ||
    !('transportVersion' in info) ||
    info.transportVersion !== 1 ||
    !('sourceRevision' in info) ||
    typeof info.sourceRevision !== 'string' ||
    !/^[a-f0-9]{40}$/i.test(info.sourceRevision)
  )
    throw new Error('UPGRADE_REQUIRED: incompatible dashboard manifest');
  let authority = '';
  let launchToken: string | null = token();
  let launchPath = '';
  const expires = Date.now() + TOKEN_LIFETIME;
  const accessTokens = new Set<string>();
  const sockets = new Set<WebSocket>();
  const connections = new Set<Socket>();
  let closing = false;
  const server = createServer(async (req, res) => {
    headers(res, authority);
    const path = req.url ?? '/';
    const pathname = path.split('?')[0];
    const failure = guard(req, authority, req.method === 'POST');
    if (failure) {
      res.writeHead(failure).end();
      return;
    }
    try {
      validPath(path, origin);
    } catch {
      res.writeHead(400).end();
      return;
    }
    if (pathname === '/_han/session') {
      if (req.method !== 'POST') {
        res.writeHead(405).end();
        return;
      }
      if (!jsonOnly(req)) {
        res.writeHead(415).end();
        return;
      }
      let payload: unknown;
      try {
        payload = await readJson(req, 16_384);
      } catch {
        res.writeHead(400).end();
        return;
      }
      const data = payload as {
        transportVersion?: unknown;
        launchToken?: unknown;
      } | null;
      if (
        !launchToken ||
        Date.now() >= expires ||
        data?.transportVersion !== 1 ||
        !equal(data?.launchToken, launchToken)
      ) {
        res.writeHead(401).end();
        return;
      }
      launchToken = null;
      try {
        unlinkSync(launchPath);
      } catch {
        /* Already removed. */
      }
      const accessToken = token();
      accessTokens.add(accessToken);
      res.setHeader('Cache-Control', 'no-store');
      res.setHeader('Content-Type', 'application/json');
      res.end(JSON.stringify({ accessToken }));
      return;
    }
    if (pathname === '/graphql') {
      if (req.method !== 'POST') {
        res.writeHead(405).end();
        return;
      }
      if (!jsonOnly(req)) {
        res.writeHead(415).end();
        return;
      }
      const authorization = header(req, 'authorization');
      if (
        !authorization ||
        ![...accessTokens].some((t) => equal(authorization, `Bearer ${t}`))
      ) {
        res.writeHead(401).end();
        return;
      }
      let payload: unknown;
      try {
        payload = await readJson(req);
      } catch {
        res.writeHead(400).end();
        return;
      }
      try {
        const controller = new AbortController();
        res.once('close', () => controller.abort());
        const upstream = await coordinatorRequest('/graphql', {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            ...(req.headers.accept ? { accept: req.headers.accept } : {}),
          },
          body: JSON.stringify(payload),
          signal: controller.signal,
        });
        res.statusCode = upstream.status;
        for (const [name, value] of upstream.headers)
          if (!stripped.has(name.toLowerCase())) res.setHeader(name, value);
        if (upstream.body)
          await pipeline(
            Readable.fromWeb(upstream.body as NodeReadableStream),
            res
          );
        else res.end();
      } catch (error) {
        if (!res.headersSent) res.writeHead(502);
        res.end(
          error instanceof CoordinatorSecurityError
            ? 'COORDINATOR_SECURITY_ERROR'
            : 'Coordinator unavailable'
        );
      }
      return;
    }
    if (
      pathname?.startsWith('/_han/') &&
      !(options.dev && pathname === '/_han/react-preamble.js')
    ) {
      res.writeHead(404).end();
      return;
    }
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      res.writeHead(405).end();
      return;
    }
    try {
      const upstream = await asset(path, req.method, req.headers.accept);
      res.statusCode = upstream.status;
      for (const [name, value] of upstream.headers)
        if (!stripped.has(name.toLowerCase())) res.setHeader(name, value);
      if (req.method === 'HEAD' || !upstream.body) res.end();
      else
        await pipeline(
          Readable.fromWeb(upstream.body as NodeReadableStream),
          res
        );
    } catch {
      if (!res.headersSent) res.writeHead(502);
      res.end('Dashboard asset unavailable');
    }
  });
  server.on('connection', (socket) => {
    connections.add(socket);
    socket.once('close', () => connections.delete(socket));
  });
  const websocket = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) =>
      protocols.has('graphql-transport-ws') ? 'graphql-transport-ws' : false,
  });
  const hmr = new WebSocketServer({
    noServer: true,
    handleProtocols: (protocols) =>
      protocols.has('vite-hmr') ? 'vite-hmr' : false,
  });
  server.on('upgrade', (req, socket, head) => {
    const failure = guard(req, authority, true);
    const protocol = header(req, 'sec-websocket-protocol');
    if (
      !failure &&
      options.dev &&
      origin.protocol === 'http:' &&
      origin.hostname === '127.0.0.1' &&
      (req.url === '/_han/vite-hmr' ||
        req.url?.startsWith('/_han/vite-hmr?')) &&
      protocol
        ?.split(',')
        .map((x) => x.trim())
        .includes('vite-hmr')
    ) {
      const target = new URL(req.url, origin);
      target.protocol = 'ws:';
      hmr.handleUpgrade(req, socket, head, (client) => {
        sockets.add(client);
        const upstream = new WebSocket(target, 'vite-hmr', {
          origin: origin.origin,
        });
        client.on('message', (data, binary) => {
          if (upstream.readyState === WebSocket.OPEN)
            upstream.send(data, { binary });
        });
        upstream.on('message', (data, binary) => {
          if (client.readyState === WebSocket.OPEN)
            client.send(data, { binary });
        });
        upstream.on('error', () => client.close(1011));
        upstream.on('close', () => client.close());
        client.on('error', () => client.terminate());
        client.on('close', () => {
          sockets.delete(client);
          if (upstream.readyState === WebSocket.CONNECTING)
            upstream.terminate();
          else upstream.close();
        });
      });
      return;
    }
    if (
      failure ||
      req.url !== '/graphql' ||
      !protocol
        ?.split(',')
        .map((x) => x.trim())
        .includes('graphql-transport-ws')
    ) {
      socket.end(
        `HTTP/1.1 ${failure ?? 403} Rejected\r\nConnection: close\r\n\r\n`
      );
      return;
    }
    websocket.handleUpgrade(req, socket, head, (client) => {
      sockets.add(client);
      let upstream: WebSocket | null = null;
      let initialized = false;
      let acknowledged = false;
      const timeout = setTimeout(
        () => client.close(4408, 'Connection initialisation timeout'),
        INIT_TIMEOUT
      );
      client.on('message', (message, binary) => {
        if (binary) {
          client.close(4400, 'Invalid message');
          return;
        }
        let data: { type?: unknown; payload?: { authorization?: unknown } };
        try {
          data = JSON.parse(message.toString());
        } catch {
          client.close(4400, 'Invalid message');
          return;
        }
        if (!initialized) {
          if (data?.type !== 'connection_init') {
            client.close(4401, 'Unauthorized');
            return;
          }
          if (
            ![...accessTokens].some((t) =>
              equal(data.payload?.authorization, `Bearer ${t}`)
            )
          ) {
            client.close(4401, 'Unauthorized');
            return;
          }
          initialized = true;
          clearTimeout(timeout);
          try {
            upstream = coordinatorWebSocket('/graphql', [
              'graphql-transport-ws',
            ]);
            upstream.on('open', () =>
              upstream?.send(JSON.stringify({ type: 'connection_init' }))
            );
            upstream.on('message', (value, isBinary) => {
              if (!isBinary) {
                try {
                  const payload = JSON.parse(value.toString()) as {
                    type?: string;
                  };
                  if (payload.type === 'connection_ack') acknowledged = true;
                } catch {
                  client.close(1011, 'Invalid coordinator message');
                  return;
                }
              }
              if (client.readyState === WebSocket.OPEN)
                client.send(value, { binary: isBinary });
            });
            upstream.on('error', () =>
              client.close(1011, 'Coordinator unavailable')
            );
            upstream.on('close', (code, reason) => {
              if (client.readyState === WebSocket.OPEN)
                client.close(
                  code >= 1000 &&
                    code !== 1005 &&
                    code !== 1006 &&
                    code !== 1015
                    ? code
                    : 1011,
                  reason
                );
            });
          } catch {
            client.close(1011, 'Coordinator unavailable');
          }
          return;
        }
        if (data?.type === 'connection_init') {
          client.close(4429, 'Too many initialisation requests');
          return;
        }
        if (
          !acknowledged ||
          !upstream ||
          upstream.readyState !== WebSocket.OPEN
        ) {
          client.close(4401, 'Unauthorized');
          return;
        }
        upstream.send(message, { binary: false });
      });
      client.on('error', () => client.terminate());
      client.on('close', () => {
        clearTimeout(timeout);
        sockets.delete(client);
        if (upstream) {
          if (upstream.readyState === WebSocket.CONNECTING)
            upstream.terminate();
          else upstream.close();
        }
      });
    });
  });
  await new Promise<void>((resolveBind, reject) => {
    server.once('error', reject);
    server.listen(options.port, '127.0.0.1', () => {
      server.removeListener('error', reject);
      resolveBind();
    });
  });
  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('Could not determine gateway port');
  }
  authority = `127.0.0.1:${address.port}`;
  const url = `http://${authority}`;
  try {
    launchPath = launcher(
      join(getCoordinatorDataDir(), 'runtime'),
      url,
      launchToken
    );
  } catch (error) {
    server.close();
    throw error;
  }
  const expiryTimer = setTimeout(() => {
    launchToken = null;
    try {
      unlinkSync(launchPath);
    } catch {
      /* Already consumed. */
    }
  }, TOKEN_LIFETIME);
  expiryTimer.unref();
  return {
    url,
    launcherUrl: pathToFileURL(launchPath).href,
    server,
    async close() {
      if (closing) return;
      closing = true;
      clearTimeout(expiryTimer);
      launchToken = null;
      accessTokens.clear();
      try {
        unlinkSync(launchPath);
      } catch {
        /* Already consumed. */
      }
      for (const socket of sockets) socket.terminate();
      for (const connection of connections) connection.destroy();
      websocket.close();
      hmr.close();
      await new Promise<void>((resolveClose) =>
        server.close(() => resolveClose())
      );
    },
  };
}
