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
import { existsSync, readFileSync, watch, writeFileSync } from 'node:fs';
import { createServer } from 'node:http';
import { platform } from 'node:os';
import { dirname, extname, join } from 'node:path';
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

/**
 * Get the han package directory (packages/han)
 */
function getHanPackageDir(): string {
  // Navigate from packages/han/lib/commands/browse to packages/han
  return join(__dirname, '..', '..', '..');
}

/**
 * Regenerate schema.graphql from GraphQL type definitions
 * Called when graphql/*.ts files change in dev mode
 */
async function regenerateSchema(clientDir: string): Promise<boolean> {
  const hanDir = getHanPackageDir();
  const schemaPath = join(clientDir, 'schema.graphql');

  try {
    // Run the schema export script directly
    const proc = Bun.spawn(['bun', 'run', 'schema:export'], {
      cwd: hanDir,
      stdout: 'pipe',
      stderr: 'pipe',
    });

    const output = await new Response(proc.stdout).text();
    const stderr = await new Response(proc.stderr).text();
    await proc.exited;

    if (proc.exitCode !== 0) {
      console.error('[dev] Schema export failed:', stderr);
      return false;
    }

    // Write the schema to the client directory
    writeFileSync(schemaPath, output);
    console.log('[dev] Regenerated schema.graphql');
    return true;
  } catch (error) {
    console.error('[dev] Failed to regenerate schema:', error);
    return false;
  }
}

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
      // In local mode, always use HTTP (for offline scenarios like planes)
      // Otherwise, detect HTTPS for remote dashboard
      if (local) {
        console.log(
          `[han] Coordinator ready at http://127.0.0.1:${coordinatorStatus.port}/graphql`
        );
      } else {
        // Detect if coordinator is using HTTPS
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
    }
  } catch (error) {
    console.error('[han] Failed to start coordinator:', error);
    console.log(
      '[han] Dashboard will show placeholder until coordinator is available'
    );
  }

  // If not local mode, open remote dashboard with coordinator port and return
  if (!local) {
    const dashboardUrl = `https://dashboard.local.han.guru?coordinatorPort=${coordinatorPort}`;
    console.log(`[han] Opening remote dashboard at ${dashboardUrl}`);
    await openBrowser(dashboardUrl);
    return;
  }

  // Local mode: Start local dev server
  console.log(`[han] Starting browse server...`);
  console.log(`[han] Mode: ${devMode ? 'development' : 'production'}`);

  // Skip per-request coordinator checks in test environments
  // The coordinator is verified at startup; per-request checks can timeout
  const skipCoordinatorCheck = process.env.HAN_SKIP_COORDINATOR_CHECK === '1';

  const clientDir = getBrowseClientDir();

  // Check if browse-client exists
  if (!existsSync(clientDir)) {
    throw new Error(`browse-client not found at ${clientDir}`);
  }

  // Create HTTP server
  const server = createServer();

  // Build output directory
  const outDir = join(clientDir, '.browse-out');

  // Connected clients for live reload (dev mode only)
  const liveReloadClients = new Set<import('node:http').ServerResponse>();

  // Build function - always uses Bun.build() with HTML entrypoint
  async function buildBundle(): Promise<boolean> {
    try {
      const pagesDir = join(clientDir, 'src', 'pages');

      // Verify client directory exists
      if (!existsSync(clientDir)) {
        console.error(`[bun] Client directory not found: ${clientDir}`);
        return false;
      }

      const { relayPlugin } = await import(
        join(clientDir, 'build', 'relay-plugin.ts')
      );
      const { pagesPlugin } = await import(
        join(clientDir, 'build', 'pages-plugin.ts')
      );
      const { rnwCompatPlugin } = await import(
        join(clientDir, 'build', 'rnw-compat-plugin.ts')
      );

      const result = await Bun.build({
        entrypoints: [join(clientDir, 'index.html')],
        outdir: outDir,
        root: clientDir, // Resolve modules from browse-client directory
        target: 'browser',
        splitting: true,
        minify: !devMode,
        sourcemap: devMode ? 'inline' : 'none',
        publicPath: '/',
        plugins: [
          rnwCompatPlugin(),
          relayPlugin({ devMode }),
          pagesPlugin({ pagesDir, clientRoot: clientDir }),
        ],
        define: {
          'process.env.NODE_ENV': JSON.stringify(
            devMode ? 'development' : 'production'
          ),
          // Polyfill Node.js globals for React Native libraries
          global: 'globalThis',
          // Inject GraphQL URLs for the frontend to connect to coordinator
          // Use detected protocol and host (https://coordinator.local.han.guru if TLS enabled, http://127.0.0.1 otherwise)
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
        if (result.logs.length === 0) {
          console.error('  No build logs available - check for syntax errors');
        }
        for (const log of result.logs) {
          console.error('  ', log.level, log.message);
          if (log.position) {
            console.error(
              '    at',
              log.position.file,
              `line ${log.position.line}:${log.position.column}`
            );
          }
        }
        return false;
      }
      return true;
    } catch (error) {
      console.error('[bun] Build exception:', error);
      return false;
    }
  }

  // Build on startup
  console.log('[bun] Building browse-client...');
  const buildStart = performance.now();
  if (!(await buildBundle())) {
    throw new Error('Bundle failed');
  }
  console.log(
    `[bun] Built in ${(performance.now() - buildStart).toFixed(0)}ms`
  );

  // Track child processes for cleanup
  let relayProcess: ChildProcess | null = null;

  // Check if we're in a test environment - don't start dev watchers in tests
  // HAN_NO_DEV_WATCHERS is set explicitly for test runs
  const isTestEnvironment =
    process.env.HAN_NO_DEV_WATCHERS === '1' ||
    process.env.CI ||
    process.env.PLAYWRIGHT_TEST_BASE_URL ||
    process.env.TEST_WORKER_INDEX !== undefined;

  // Dev mode: watch for changes and start supporting processes
  // Skip in test environments to avoid interference with automated tests
  if (devMode && isTestEnvironment) {
    console.log('[dev] Skipping dev watchers in test environment');
  } else if (devMode) {
    const srcDir = join(clientDir, 'src');
    const hanDir = getHanPackageDir();
    const graphqlDir = join(hanDir, 'lib', 'graphql');

    // Start relay-compiler in watch mode
    relayProcess = startRelayCompiler(clientDir);

    // Watch GraphQL type definitions and regenerate schema on change
    if (existsSync(graphqlDir)) {
      let schemaTimeout: ReturnType<typeof setTimeout> | null = null;
      watch(graphqlDir, { recursive: true }, (_event, filename) => {
        if (!filename || !filename.endsWith('.ts')) return;
        if (schemaTimeout) clearTimeout(schemaTimeout);
        schemaTimeout = setTimeout(async () => {
          console.log(
            `\n[dev] GraphQL types changed (${filename}), regenerating schema...`
          );
          await regenerateSchema(clientDir);
          // Relay compiler in watch mode will pick up schema.graphql changes automatically
        }, 200);
      });
      console.log('[dev] Watching GraphQL types for schema changes');
    }

    // Watch frontend source and rebuild
    let buildTimeout: ReturnType<typeof setTimeout> | null = null;
    watch(srcDir, { recursive: true }, (_event, filename) => {
      if (!filename) return;
      if (buildTimeout) clearTimeout(buildTimeout);
      buildTimeout = setTimeout(async () => {
        console.log(`\n[bun] Rebuilding (${filename} changed)...`);
        const start = performance.now();
        if (await buildBundle()) {
          console.log(
            `[bun] Rebuilt in ${(performance.now() - start).toFixed(0)}ms`
          );
          // Notify live reload clients
          for (const client of liveReloadClients) {
            try {
              client.write('data: reload\n\n');
            } catch {
              liveReloadClients.delete(client);
            }
          }
        }
      }, 100);
    });

    console.log('[bun] Dev server ready with live reload');
  }

  // Add request handler to server
  server.on('request', async (req, res) => {
    const parsedUrl = parse(req.url || '/', true);
    const pathname = parsedUrl.pathname || '/';

    // Health check - includes coordinator status
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

    // Check if coordinator is running for serving frontend
    // Skip this check in test environments where coordinator is verified at startup
    const coordRunning =
      skipCoordinatorCheck ||
      coordinatorRunning ||
      (await isCoordinatorRunning(coordinatorPort));

    // If coordinator is not running, show placeholder page
    if (!coordRunning && !pathname.startsWith('/api/')) {
      res.setHeader('Content-Type', 'text/html');
      res.end(COORDINATOR_UNAVAILABLE_HTML);
      return;
    }

    // Live reload SSE endpoint (dev mode only)
    if (devMode && pathname === '/__live_reload') {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      liveReloadClients.add(res);
      res.write('data: connected\n\n');
      req.on('close', () => liveReloadClients.delete(res));
      return;
    }

    // Serve from bundled output directory
    const hasExtension = pathname.includes('.') && !pathname.endsWith('/');
    const filePath = hasExtension
      ? join(outDir, pathname)
      : join(outDir, 'index.html');

    if (existsSync(filePath)) {
      const ext = extname(filePath) || '.html';
      let content = readFileSync(filePath);

      // Inject live reload script into HTML (dev mode only)
      if (devMode && ext === '.html') {
        const html = content.toString('utf-8');
        const liveReloadScript = `
<script>
(function() {
  let es;
  function connect() {
    es = new EventSource('/__live_reload');
    es.onmessage = (e) => { if (e.data === 'reload') location.reload(); };
    es.onerror = () => { es.close(); setTimeout(connect, 2000); };
  }
  connect();
})();
</script>
</body>`;
        content = Buffer.from(html.replace('</body>', liveReloadScript));
      }

      res.setHeader('Content-Type', getMimeType(filePath));
      res.setHeader('Cache-Control', devMode ? 'no-cache' : 'max-age=31536000');
      res.end(content);
      return;
    }

    // SPA fallback
    const indexPath = join(outDir, 'index.html');
    if (existsSync(indexPath)) {
      let html = readFileSync(indexPath, 'utf-8');

      // Inject live reload script (dev mode only)
      if (devMode) {
        const liveReloadScript = `
<script>
(function() {
  let es;
  function connect() {
    es = new EventSource('/__live_reload');
    es.onmessage = (e) => { if (e.data === 'reload') location.reload(); };
    es.onerror = () => { es.close(); setTimeout(connect, 2000); };
  }
  connect();
})();
</script>
</body>`;
        html = html.replace('</body>', liveReloadScript);
      }

      res.setHeader('Content-Type', 'text/html');
      res.setHeader('Cache-Control', 'no-cache');
      res.end(html);
      return;
    }

    res.statusCode = 404;
    res.end('Not Found');
  });

  // Start server
  server.listen(port, async () => {
    const serverUrl = `http://localhost:${port}`;
    console.log(`Han Browser running at ${serverUrl}`);
    if (coordinatorRunning) {
      console.log(
        `GraphQL available at ${coordinatorProtocol}://${coordinatorHost}:${coordinatorPort}/graphql`
      );
    }
    if (devMode) {
      console.log('[dev] Bun live reload enabled');
    }
    console.log('Press Ctrl+C to stop');

    // Open browser
    openBrowser(serverUrl).then((opened) => {
      if (opened) {
        console.log('Browser opened');
      } else {
        console.log(
          `Could not open browser automatically. Visit ${serverUrl} manually.`
        );
      }
    });
  });

  // Setup graceful shutdown
  let isShuttingDown = false;
  const shutdown = () => {
    if (isShuttingDown) return; // Prevent multiple calls
    isShuttingDown = true;
    console.log('\nShutting down...');

    // Kill relay-compiler if running
    if (relayProcess) {
      try {
        relayProcess.kill('SIGTERM');
        // Force kill after 2 seconds if still running
        setTimeout(() => {
          if (relayProcess && !relayProcess.killed) {
            relayProcess.kill('SIGKILL');
          }
        }, 2000);
      } catch {
        // Process already dead
      }
    }

    // Close live reload connections
    for (const client of liveReloadClients) {
      try {
        client.end();
      } catch {
        // Ignore errors
      }
    }
    liveReloadClients.clear();

    server.close();
    process.exit(0);
  };

  process.on('SIGINT', shutdown);
  process.on('SIGTERM', shutdown);

  // Also handle uncaught exceptions gracefully
  process.on('uncaughtException', (error) => {
    console.error('[browse] Uncaught exception:', error);
    shutdown();
  });

  // Keep the process running using a simple polling approach
  // This properly responds to shutdown signals
  while (!isShuttingDown) {
    await new Promise((resolve) => setTimeout(resolve, 1000));
  }
}
