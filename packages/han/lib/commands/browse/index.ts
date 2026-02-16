/**
 * Entry point for the browse command
 *
 * Starts a simple web server that:
 * - Serves static files in production mode (from out/)
 * - Uses Bun dev server with live reload in development mode
 *
 * The frontend connects directly to the coordinator daemon
 * for GraphQL queries and subscriptions.
 */

import { type ChildProcess, spawn } from 'node:child_process';
import {
  cpSync,
  existsSync,
  mkdtempSync,
  readFileSync,
  rmSync,
} from 'node:fs';
import { createServer } from 'node:http';
import { platform, tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath, parse } from 'node:url';
import { isDevMode } from '../../shared.ts';
import {
  ensureCoordinator,
  getBrowsePort,
  getCoordinatorPort,
  isCoordinatorRunning,
} from '../coordinator/index.ts';
import type { BrowseOptions } from './types.ts';

/**
 * HTML page to show when coordinator is not running
 * Embedded as string to work in compiled binary
 */
const COORDINATOR_UNAVAILABLE_HTML = `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Han Dashboard</title>
    <style>
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%);
            min-height: 100vh;
            display: flex;
            align-items: center;
            justify-content: center;
            color: #e0e0e0;
        }
        .container { text-align: center; padding: 2rem; max-width: 500px; }
        .logo { font-size: 4rem; margin-bottom: 1.5rem; }
        h1 { font-size: 1.5rem; font-weight: 500; margin-bottom: 1rem; color: #fff; }
        .message { font-size: 1.1rem; color: #a0a0a0; line-height: 1.6; margin-bottom: 2rem; }
        .hint { font-size: 0.9rem; color: #666; border-top: 1px solid #333; padding-top: 1.5rem; }
        code { background: rgba(255, 255, 255, 0.1); padding: 0.2rem 0.5rem; border-radius: 4px; font-family: 'SF Mono', Monaco, monospace; }
        .pulse { animation: pulse 2s ease-in-out infinite; }
        @keyframes pulse { 0%, 100% { opacity: 0.6; } 50% { opacity: 1; } }
    </style>
</head>
<body>
    <div class="container">
        <div class="logo pulse">&#128526;</div>
        <h1>Han Dashboard</h1>
        <p class="message">Start a Claude Code session to see the active dashboard</p>
        <p class="hint">Or run <code>han coordinator start</code> to start the backend manually</p>
    </div>
    <script>
        setInterval(() => {
            fetch('/api/health')
                .then(r => r.json())
                .then(data => { if (data.coordinatorRunning) window.location.reload(); })
                .catch(() => {});
        }, 5000);
    </script>
</body>
</html>`;

const __dirname = dirname(fileURLToPath(import.meta.url));

/**
 * Get the browse-client directory
 */
function getBrowseClientDir(): string {
  // Navigate from packages/han/lib/commands/browse to packages/browse-client
  return join(__dirname, '..', '..', '..', '..', 'browse-client');
}

// Schema regeneration removed - GraphQL schema now managed by Rust coordinator

/**
 * Start relay-compiler in watch mode
 */
function startRelayCompiler(clientDir: string): ChildProcess | null {
  try {
    const child = spawn('npx', ['relay-compiler', '--watch'], {
      cwd: clientDir,
      stdio: ['ignore', 'pipe', 'pipe'],
      env: { ...process.env },
    });

    child.stdout?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      if (output) {
        // Only log meaningful output, skip empty lines
        for (const line of output.split('\n')) {
          if (line.trim()) {
            console.log(`[relay] ${line}`);
          }
        }
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const output = data.toString().trim();
      // Filter out noise but keep important errors
      if (output && !output.includes('Watching for changes')) {
        console.error(`[relay] ${output}`);
      }
    });

    child.on('error', (err) => {
      console.error('[relay] Failed to start:', err.message);
    });

    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.error(`[relay] Exited with code ${code}`);
      }
    });

    console.log('[dev] Started relay-compiler --watch');
    return child;
  } catch (error) {
    console.error('[dev] Failed to start relay-compiler:', error);
    return null;
  }
}

/**
 * Open a URL in the default browser
 */
export async function openBrowser(url: string): Promise<boolean> {
  const plat = platform();

  let cmd: string;
  let args: string[];

  if (plat === 'darwin') {
    cmd = 'open';
    args = [url];
  } else if (plat === 'win32') {
    cmd = 'cmd';
    args = ['/c', 'start', '', url];
  } else {
    cmd = 'xdg-open';
    args = [url];
  }

  return new Promise((resolve) => {
    try {
      const child = spawn(cmd, args, {
        stdio: 'ignore',
        detached: true,
      });
      child.unref();
      resolve(true);
    } catch {
      resolve(false);
    }
  });
}

/**
 * Get MIME type for a file extension
 */
function getMimeType(filePath: string): string {
  const ext = filePath.split('.').pop()?.toLowerCase();
  const mimeTypes: Record<string, string> = {
    html: 'text/html',
    js: 'application/javascript',
    css: 'text/css',
    json: 'application/json',
    png: 'image/png',
    jpg: 'image/jpeg',
    jpeg: 'image/jpeg',
    gif: 'image/gif',
    svg: 'image/svg+xml',
    ico: 'image/x-icon',
    woff: 'font/woff',
    woff2: 'font/woff2',
    ttf: 'font/ttf',
  };
  return mimeTypes[ext || ''] || 'application/octet-stream';
}

/**
 * Start the Han system browser
 *
 * - In development: Uses Bun with live reload
 * - In production: Serves static files from out/
 *
 * The frontend connects directly to the coordinator daemon
 * for GraphQL.
 */
export async function browse(options: BrowseOptions = {}): Promise<void> {
  const { port = getBrowsePort(), local = false } = options;
  const coordinatorPort = getCoordinatorPort();
  const devMode = isDevMode();

  // Ensure coordinator is running (lazy start if needed)
  console.log('[han] Ensuring coordinator is running...');
  let coordinatorRunning = false;
  let coordinatorProtocol: 'http' | 'https' = 'http';
  let coordinatorHost = '127.0.0.1';
  try {
    const coordinatorStatus = await ensureCoordinator(coordinatorPort);
    coordinatorRunning = coordinatorStatus.running;
    if (coordinatorRunning) {
      // Detect if coordinator is using HTTPS (TLS via coordinator.local.han.guru)
      const { checkHealthHttps } = await import('../coordinator/health.ts');
      const healthCheck = await checkHealthHttps(coordinatorStatus.port);
      if (healthCheck) {
        coordinatorProtocol = healthCheck.protocol;
        coordinatorHost = healthCheck.host;
        const tlsNote =
          healthCheck.protocol === 'https' ? ' (TLS enabled)' : '';
        console.log(
          `[han] Coordinator ready at ${coordinatorProtocol}://${coordinatorHost}:${coordinatorStatus.port}/graphql${tlsNote}`
        );
      } else {
        console.log(
          `[han] Coordinator ready at http://127.0.0.1:${coordinatorStatus.port}/graphql`
        );
      }
    }
  } catch (error) {
    console.error('[han] Failed to start coordinator:', error);
    console.log(
      '[han] Dashboard will show placeholder until coordinator is available'
    );
  }

  // If not local mode, open remote dashboard and return
  if (!local) {
    const dashboardUrl = 'https://dashboard.local.han.guru';
    console.log(`[han] Opening remote dashboard at ${dashboardUrl}`);
    await openBrowser(dashboardUrl);
    return;
  }

  const clientDir = getBrowseClientDir();

  // Check if browse-client exists
  if (!existsSync(clientDir)) {
    throw new Error(`browse-client not found at ${clientDir}`);
  }

  // Dev mode: spawn Vite dev server with HMR
  if (devMode) {
    console.log(`[han] Starting Vite dev server with HMR...`);

    // Start relay-compiler in watch mode alongside Vite
    const relayProcess = startRelayCompiler(clientDir);

    // GraphQL schema is now managed by the Rust coordinator.
    // Schema regeneration from TypeScript types has been removed.

    // Spawn Vite dev server
    const viteProcess = spawn(
      'npx',
      ['vite', '--port', String(port), '--open'],
      {
        cwd: clientDir,
        stdio: 'inherit',
        env: { ...process.env },
      }
    );

    viteProcess.on('error', (err) => {
      console.error('[vite] Failed to start:', err.message);
      process.exit(1);
    });

    // Graceful shutdown
    let isShuttingDown = false;
    const shutdown = () => {
      if (isShuttingDown) return;
      isShuttingDown = true;
      console.log('\nShutting down...');

      if (relayProcess) {
        try {
          relayProcess.kill('SIGTERM');
          setTimeout(() => {
            if (relayProcess && !relayProcess.killed) {
              relayProcess.kill('SIGKILL');
            }
          }, 2000);
        } catch {
          // Process already dead
        }
      }

      try {
        viteProcess.kill('SIGTERM');
        setTimeout(() => {
          if (!viteProcess.killed) viteProcess.kill('SIGKILL');
        }, 2000);
      } catch {
        // Process already dead
      }

      process.exit(0);
    };

    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);

    // Wait for Vite process to exit
    await new Promise<void>((resolve) => {
      viteProcess.on('exit', () => resolve());
    });

    return;
  }

  // Production mode: Bun.build() and serve static files
  console.log(`[han] Starting production browse server...`);

  // Skip per-request coordinator checks in test environments
  const skipCoordinatorCheck = process.env.HAN_SKIP_COORDINATOR_CHECK === '1';

  const server = createServer();
  const outDir = join(clientDir, '.browse-out');

  // Build function - uses Bun.build() with HTML entrypoint
  async function buildBundle(): Promise<boolean> {
    try {
      const pagesDir = join(clientDir, 'src', 'pages');

      const { relayPlugin } = await import(
        join(clientDir, 'build', 'relay-plugin.ts')
      );
      const { pagesPlugin } = await import(
        join(clientDir, 'build', 'pages-plugin.ts')
      );
      const { rnwCompatPlugin } = await import(
        join(clientDir, 'build', 'rnw-compat-plugin.ts')
      );

      const tmpOut = mkdtempSync(join(tmpdir(), 'han-browse-'));

      const result = await Bun.build({
        entrypoints: [join(clientDir, 'index.html')],
        outdir: tmpOut,
        root: clientDir,
        target: 'browser',
        splitting: true,
        minify: true,
        sourcemap: 'none',
        publicPath: '/',
        naming: {
          chunk: 'chunk-[name]-[hash].[ext]',
          entry: '[dir]/[name].[ext]',
          asset: '[name]-[hash].[ext]',
        },
        plugins: [
          rnwCompatPlugin(),
          relayPlugin({ devMode: false }),
          pagesPlugin({ pagesDir, clientRoot: clientDir }),
        ],
        define: {
          'process.env.NODE_ENV': JSON.stringify('production'),
          global: 'globalThis',
          __GRAPHQL_URL__: JSON.stringify(
            `${coordinatorProtocol}://${coordinatorHost}:${coordinatorPort}/graphql`
          ),
          __GRAPHQL_WS_URL__: JSON.stringify(
            `${coordinatorProtocol === 'https' ? 'wss' : 'ws'}://${coordinatorHost}:${coordinatorPort}/graphql`
          ),
        },
        loader: {
          '.css': 'css',
          '.svg': 'file',
          '.png': 'file',
          '.jpg': 'file',
          '.jpeg': 'file',
          '.gif': 'file',
          '.woff': 'file',
          '.woff2': 'file',
        },
      });

      if (!result.success) {
        console.error('[bun] Build failed:');
        for (const log of result.logs) {
          console.error('  ', log.level, log.message);
        }
        rmSync(tmpOut, { recursive: true, force: true });
        return false;
      }

      if (existsSync(outDir)) {
        rmSync(outDir, { recursive: true, force: true });
      }
      cpSync(tmpOut, outDir, { recursive: true });
      rmSync(tmpOut, { recursive: true, force: true });
      return true;
    } catch (error) {
      console.error('[bun] Build exception:', error);
      return false;
    }
  }

  console.log('[bun] Building browse-client...');
  const buildStart = performance.now();
  if (!(await buildBundle())) {
    throw new Error('Bundle failed');
  }
  console.log(
    `[bun] Built in ${(performance.now() - buildStart).toFixed(0)}ms`
  );

  // Check if we're in a test environment
  const isTestEnvironment =
    process.env.HAN_NO_DEV_WATCHERS === '1' ||
    process.env.CI ||
    process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.TEST_WORKER_INDEX !== undefined;

  server.on('request', async (req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    const pathname = parsedUrl.pathname || '/';

    if (pathname === '/api/health') {
      const coordRunning = await isCoordinatorRunning(coordinatorPort);
      res.setHeader('Content-Type', 'application/json');
      res.end(
        JSON.stringify({
          status: 'ok',
          coordinatorRunning: coordRunning,
          coordinatorPort,
        })
      );
      return;
    }

    const coordRunning =
      skipCoordinatorCheck ||
      coordinatorRunning ||
      (await isCoordinatorRunning(coordinatorPort));

    if (!coordRunning && !pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'text/html');
      res.end(COORDINATOR_UNAVAILABLE_HTML);
      return;
    }

    const hasExtension = pathname.includes('.') && !pathname.endsWith('/');
    const filePath = hasExtension
      ? join(outDir, pathname)
      : join(outDir, 'index.html');

    if (existsSync(filePath)) {
      res.setHeader('Content-Type', getMimeType(filePath));
      res.setHeader('Cache-Control', 'max-age=31536000');
      res.end(readFileSync(filePath));
      return;
    }

    const indexPath = join(outDir, 'index.html');
    if (existsSync(indexPath)) {
      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(readFileSync(indexPath));
      return;
    }

    res.statusCode = 404;
    res.end('Not Found');
  });

  server.listen(port, async () => {
    const serverUrl = `http://localhost:${port}`;
    console.log(`Han Browser running at ${serverUrl}`);
    if (coordinatorRunning) {
      console.log(
        `GraphQL available at ${coordinatorProtocol}://${coordinatorHost}:${coordinatorPort}/graphql`
      );
    }
    console.log('Press Ctrl+C to stop');

    if (!isTestEnvironment) {
      openBrowser(serverUrl).then((opened) => {
        if (opened) {
          console.log('Browser opened');
        } else {
          console.log(
            `Could not open browser automatically. Visit ${serverUrl} manually.`
          );
        }
      });
    }
  });

  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) return;
    isShuttingDown = true;
    console.log('\nShutting down...');
    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  process.on('uncaughtException', (error) => {
    console.error('[browse] Uncaught exception:', error);
    shutdown();
  });

  while (!isShuttingDown) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
