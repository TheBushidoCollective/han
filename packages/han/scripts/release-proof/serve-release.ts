import { existsSync, readdirSync, readFileSync, statSync } from 'node:fs';
import { createServer, type ServerResponse } from 'node:http';
import { basename, join, resolve } from 'node:path';

// Parse arguments
let assetDir = '';
let tag = 'v3.23.0';
let installerPath = '';
let port = 0;
const holdAssets = new Set<string>();
const corruptAssets = new Set<string>();

for (let i = 2; i < Bun.argv.length; i++) {
  const arg = Bun.argv[i];
  if (arg === '--tag' && i + 1 < Bun.argv.length) {
    tag = Bun.argv[++i];
  } else if (arg.startsWith('--tag=')) {
    tag = arg.slice('--tag='.length);
  } else if (arg === '--installer' && i + 1 < Bun.argv.length) {
    installerPath = Bun.argv[++i];
  } else if (arg.startsWith('--installer=')) {
    installerPath = arg.slice('--installer='.length);
  } else if (arg === '--port' && i + 1 < Bun.argv.length) {
    port = parseInt(Bun.argv[++i], 10);
  } else if (arg.startsWith('--port=')) {
    port = parseInt(arg.slice('--port='.length), 10);
  } else if (arg === '--hold' && i + 1 < Bun.argv.length) {
    holdAssets.add(Bun.argv[++i]);
  } else if (arg.startsWith('--hold=')) {
    holdAssets.add(arg.slice('--hold='.length));
  } else if (arg === '--corrupt' && i + 1 < Bun.argv.length) {
    corruptAssets.add(Bun.argv[++i]);
  } else if (arg.startsWith('--corrupt=')) {
    corruptAssets.add(arg.slice('--corrupt='.length));
  } else if (!arg.startsWith('-')) {
    assetDir = arg;
  }
}

if (!assetDir) {
  console.error('Usage: bun serve-release.ts <assetDir> --tag <tag>');
  process.exit(1);
}

const resolvedAssetDir = resolve(assetDir);
if (!existsSync(resolvedAssetDir)) {
  console.error(`Asset directory not found: ${resolvedAssetDir}`);
  process.exit(1);
}

// Build assets list
const files = readdirSync(resolvedAssetDir);
const assets = files.map((file) => ({
  name: file,
  size: statSync(join(resolvedAssetDir, file)).size,
  browser_download_url: `http://127.0.0.1:PORT/TheBushidoCollective/han/releases/download/${tag}/${file}`,
}));

interface RequestLogEntry {
  method: string;
  pathname: string;
  time: number;
}
const requestLog: RequestLogEntry[] = [];
const heldWaiters = new Map<string, Array<() => void>>();

const server = createServer((req, res: ServerResponse) => {
  const url = new URL(req.url ?? '/', `http://127.0.0.1:${serverPort}`);
  const pathname = url.pathname;

  requestLog.push({
    method: req.method ?? 'GET',
    pathname,
    time: Date.now(),
  });

  // GET /__log: request log as JSON lines
  if (req.method === 'GET' && pathname === '/__log') {
    res.writeHead(200, { 'Content-Type': 'application/x-ndjson' });
    res.end(requestLog.map((r) => JSON.stringify(r)).join('\n'));
    return;
  }

  // POST /__release/<asset>: release held asset
  if (req.method === 'POST' && pathname.startsWith('/__release/')) {
    const assetToRelease = pathname.slice('/__release/'.length);
    const waiters = heldWaiters.get(assetToRelease);
    if (waiters && waiters.length > 0) {
      for (const wake of waiters) wake();
      heldWaiters.delete(assetToRelease);
    }
    holdAssets.delete(assetToRelease);
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ released: assetToRelease }));
    return;
  }

  // 1. GitHub API latest release
  if (
    pathname === '/repos/TheBushidoCollective/han/releases/latest' ||
    pathname.endsWith('/releases/latest')
  ) {
    const payload = {
      tag_name: tag,
      name: tag,
      draft: false,
      prerelease: false,
      assets: assets.map((a) => ({
        ...a,
        browser_download_url: a.browser_download_url.replace(
          'PORT',
          String(serverPort)
        ),
      })),
    };
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(payload));
    return;
  }

  // 2. Install script
  if (pathname === '/install.sh') {
    const scriptPath =
      process.env.HAN_PROOF_INSTALLER ||
      installerPath ||
      resolve(import.meta.dir, '../../../../website/public/install.sh');
    if (existsSync(scriptPath)) {
      res.writeHead(200, { 'Content-Type': 'text/x-shellscript' });
      res.end(readFileSync(scriptPath));
      return;
    }
  }

  // 3. Release download assets
  const downloadMatch = pathname.match(
    /\/releases\/download\/([^/]+)\/([^/]+)$/
  );
  if (downloadMatch) {
    const reqTag = downloadMatch[1];
    const fileName = downloadMatch[2];
    const expectedTag = `v${version.replace(/^v/, '')}`;
    if (reqTag !== expectedTag && reqTag !== version) {
      res
        .writeHead(404)
        .end(
          `Not Found (tag mismatch: expected ${expectedTag}, got ${reqTag})`
        );
      return;
    }
    const filePath = join(resolvedAssetDir, fileName);
    const respondWithAsset = () => {
      if (existsSync(filePath)) {
        let bytes = readFileSync(filePath);
        if (corruptAssets.has(fileName)) {
          // Corrupt one byte
          bytes = Buffer.from(bytes);
          bytes[0] ^= 0xff;
        }
        res.writeHead(200, { 'Content-Type': 'application/octet-stream' });
        res.end(bytes);
      } else {
        res.writeHead(404).end('Not Found');
      }
    };

    if (holdAssets.has(fileName)) {
      let list = heldWaiters.get(fileName);
      if (!list) {
        list = [];
        heldWaiters.set(fileName, list);
      }
      list.push(respondWithAsset);
      return;
    }

    respondWithAsset();
    return;
  }

  res.writeHead(404).end('Not Found');
});

const { promise, resolve: resolveListen } = Promise.withResolvers<void>();
server.listen(port, '127.0.0.1', () => resolveListen());
await promise;

const addr = server.address();
const serverPort = typeof addr === 'object' && addr ? addr.port : port;

console.log(`SERVE_RELEASE_PORT=${serverPort}`);
console.log(`SERVE_RELEASE_URL=http://127.0.0.1:${serverPort}`);

// Keep process running until terminated
process.on('SIGTERM', () => server.close());
process.on('SIGINT', () => server.close());
