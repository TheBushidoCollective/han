/**
 * Coordinator GraphQL Server
 *
 * Sets up the GraphQL server with WebSocket subscriptions.
 * This is the central server that all clients connect to.
 */

import { execSync } from 'node:child_process';
import { createServer as createHttpServer, type Server } from 'node:http';
import { createServer as createHttpsServer } from 'node:https';
import { parse } from 'node:url';
import { useDeferStream } from '@graphql-yoga/plugin-defer-stream';
import { makeServer } from 'graphql-ws';
import { createYoga } from 'graphql-yoga';
import { WebSocketServer } from 'ws';
import {
  coordinator,
  deferredHooks,
  hookAttempts,
  type IndexResult,
  initDb,
  messages,
  watcher,
} from '../../db/index.ts';
import { createLoaders } from '../../graphql/loaders.ts';
import {
  type MessageEdgeData,
  publishSessionAdded,
  publishSessionHooksChanged,
  publishSessionMessageAdded,
  publishSessionUpdated,
} from '../../graphql/pubsub.ts';
import { schema } from '../../graphql/schema.ts';
import { globalSlotManager } from '../../graphql/types/slot-manager.ts';
import { createLogger } from '../../logger.ts';
import { checkAndRefreshCertificates, ensureCertificates } from './tls.ts';
import { COORDINATOR_PORT, type CoordinatorOptions } from './types.ts';

const log = createLogger('coordinator');

/**
 * Server state
 */
interface ServerState {
  httpServer: Server | null;
  wss: WebSocketServer | null;
  startedAt: Date | null;
  heartbeatInterval: NodeJS.Timeout | null;
  watchdogInterval: NodeJS.Timeout | null;
  pendingHooksInterval: NodeJS.Timeout | null;
  certRefreshInterval: NodeJS.Timeout | null;
  selfHealthCheckInterval: NodeJS.Timeout | null;
  lastActivity: number;
  processingHooks: boolean;
  activeWebSocketClients: number;
  consecutiveHealthFailures: number;
}

const state: ServerState = {
  httpServer: null,
  wss: null,
  startedAt: null,
  heartbeatInterval: null,
  watchdogInterval: null,
  pendingHooksInterval: null,
  certRefreshInterval: null,
  selfHealthCheckInterval: null,
  lastActivity: Date.now(),
  processingHooks: false,
  activeWebSocketClients: 0,
  consecutiveHealthFailures: 0,
};

// Watchdog constants
const WATCHDOG_INTERVAL_MS = 30000; // Check every 30 seconds
const WATCHDOG_TIMEOUT_MS = 120000; // Consider stuck after 2 minutes of no activity

// Self-health check constants
const SELF_HEALTH_CHECK_INTERVAL_MS = 15000; // Check own health every 15 seconds
const MAX_CONSECUTIVE_HEALTH_FAILURES = 3; // Restart after 3 consecutive failures

// Pending hooks processing
const PENDING_HOOKS_INTERVAL_MS = 5000; // Poll every 5 seconds

// Certificate refresh (for 6-day certificates)
// Check every 12 hours to match cert-server renewal schedule
const CERT_REFRESH_INTERVAL_MS = 12 * 60 * 60 * 1000; // 12 hours

/**
 * Update the last activity timestamp (called on any request/event)
 */
function recordActivity(): void {
  state.lastActivity = Date.now();
}

/**
 * Perform self-health check by calling own /health endpoint
 * Returns true if healthy, false otherwise
 */
async function performSelfHealthCheck(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 5000);

    // Use HTTPS with the coordinator FQDN (same as external health checks)
    const response = await fetch(
      `https://coordinator.local.han.guru:${COORDINATOR_PORT}/health`,
      {
        signal: controller.signal,
        // @ts-expect-error - Node.js/Bun fetch option for self-signed certs
        rejectUnauthorized: false,
      }
    );

    clearTimeout(timeoutId);

    if (response.ok) {
      const health = (await response.json()) as { status: string };
      return health.status === 'ok';
    }
    return false;
  } catch {
    return false;
  }
}

/**
 * Handle a failed self-health check
 * Tracks consecutive failures and triggers restart if threshold breached
 */
async function handleHealthCheckFailure(): Promise<void> {
  state.consecutiveHealthFailures++;
  log.warn(
    `Self-health check failed (${state.consecutiveHealthFailures}/${MAX_CONSECUTIVE_HEALTH_FAILURES})`
  );

  if (state.consecutiveHealthFailures >= MAX_CONSECUTIVE_HEALTH_FAILURES) {
    log.error(
      `Coordinator self-health check failed ${MAX_CONSECUTIVE_HEALTH_FAILURES} times, triggering restart...`
    );

    // Stop server gracefully
    stopServer();

    // Exit with code 1 to trigger daemon restart loop
    process.exit(1);
  }
}

/**
 * Check if the coordinator should stay alive despite inactivity
 * Returns true if there are reasons to keep the coordinator running:
 * - Active WebSocket clients (browse UI connected)
 * - Active sessions (non-completed sessions with recent activity)
 * - Running MCP servers
 */
async function shouldStayAlive(): Promise<boolean> {
  // Check for active WebSocket clients (browse UI)
  if (state.activeWebSocketClients > 0) {
    log.debug(
      `Keeping coordinator alive: ${state.activeWebSocketClients} WebSocket client(s) connected`
    );
    return true;
  }

  // Check for active sessions (sessions with status != 'completed')
  try {
    const { sessions: sessionsDb } = await import('../../db/index.ts');
    const activeSessions = await sessionsDb.list({
      status: 'active',
      limit: 1,
    });
    if (activeSessions.length > 0) {
      log.debug(
        `Keeping coordinator alive: found ${activeSessions.length} active session(s)`
      );
      return true;
    }
  } catch (error) {
    log.warn('Failed to check for active sessions:', error);
  }

  // Check for running MCP servers
  // TODO: Implement MCP server detection
  // This would require tracking MCP server processes or checking for active MCP connections

  return false;
}

/**
 * Process pending hooks in the background
 * This runs hooks that were deferred due to resource constraints
 */
async function processPendingHooks(): Promise<void> {
  // Prevent concurrent processing
  if (state.processingHooks) {
    log.debug('Pending hooks processor: already processing, skipping');
    return;
  }

  try {
    state.processingHooks = true;

    // Get all pending hooks
    const pending = deferredHooks.getAll();
    if (pending.length === 0) {
      return;
    }

    log.info(
      `Processing ${pending.length} pending hooks: ${pending.map((h) => `${h.hookSource}/${h.hookName}`).join(', ')}`
    );

    for (const hook of pending) {
      // Skip hooks with missing required fields
      if (!hook.id || !hook.sessionId || !hook.directory || !hook.command) {
        log.warn(`Skipping hook with missing fields: ${hook.hookName}`);
        continue;
      }

      const hookId = hook.id;
      const sessionId = hook.sessionId;
      const directory = hook.directory;
      const command = hook.command;
      const hookSource = hook.hookSource ?? '';
      const startTime = Date.now();

      // Update status to running
      deferredHooks.updateStatus(hookId, 'running');
      publishSessionHooksChanged(sessionId, hookSource, hook.hookName, 'run');

      try {
        // Execute the hook command
        const pluginRoot = hook.pluginRoot ?? '';
        const output = execSync(command, {
          cwd: directory,
          encoding: 'utf-8',
          timeout: 300000, // 5 minute timeout
          shell: '/bin/bash',
          env: {
            ...process.env,
            CLAUDE_PROJECT_DIR: directory,
            HAN_SESSION_ID: sessionId,
            ...(pluginRoot ? { CLAUDE_PLUGIN_ROOT: pluginRoot } : {}),
          },
        });

        const duration = Date.now() - startTime;

        // Mark as completed
        deferredHooks.complete(hookId, true, output.trim(), null, duration);

        // Reset failure counter on success
        hookAttempts.reset(sessionId, hookSource, hook.hookName, directory);

        log.info(
          `Hook ${hookSource}/${hook.hookName} in ${directory} completed successfully in ${duration}ms`
        );
        publishSessionHooksChanged(
          sessionId,
          hookSource,
          hook.hookName,
          'result'
        );
      } catch (error: unknown) {
        const stderr = (error as { stderr?: Buffer })?.stderr?.toString() || '';
        const stdout = (error as { stdout?: Buffer })?.stdout?.toString() || '';
        const duration = Date.now() - startTime;

        // Mark as failed
        deferredHooks.complete(
          hookId,
          false,
          stdout.trim(),
          stderr.trim(),
          duration
        );

        // Increment failure counter
        const attemptInfo = hookAttempts.increment(
          sessionId,
          hookSource,
          hook.hookName,
          directory
        );

        log.warn(
          `Hook ${hookSource}/${hook.hookName} failed (attempt ${attemptInfo.consecutiveFailures}/${attemptInfo.maxAttempts}): ${stderr.slice(0, 100)}`
        );
        publishSessionHooksChanged(
          sessionId,
          hookSource,
          hook.hookName,
          'result'
        );
      }

      // Record activity to keep watchdog happy
      recordActivity();
    }
  } catch (error) {
    log.error('Error processing pending hooks:', error);
  } finally {
    state.processingHooks = false;
  }
}

/**
 * Handle indexed data from the watcher
 * Publishes events to GraphQL subscriptions for real-time updates
 */
async function onDataIndexed(result: IndexResult): Promise<void> {
  if (result.error) {
    log.debug('Index result had error, skipping publish');
    return;
  }

  // Publish session events
  if (result.isNewSession) {
    publishSessionAdded(result.sessionId, null);
  }

  // Always publish session updated for any change
  publishSessionUpdated(result.sessionId);

  // Publish message added events for new messages
  if (result.messagesIndexed > 0) {
    // Fetch the newly indexed messages to include in the subscription payload
    try {
      const newMessages = await messages.list({
        sessionId: result.sessionId,
        limit: result.messagesIndexed,
        offset: Math.max(0, result.totalMessages - result.messagesIndexed),
      });

      // Publish each message with edge data for @prependEdge
      // Skip messages with parentId - they belong to a parent message
      for (let i = 0; i < newMessages.length; i++) {
        const msg = newMessages[i];

        // Skip messages with parentId - these are tool results that belong to a parent message
        if (msg.parentId) {
          continue;
        }

        const messageIndex = result.totalMessages - result.messagesIndexed + i;

        const edgeData: MessageEdgeData = {
          node: {
            id: msg.id,
            timestamp: msg.timestamp,
            type: msg.messageType,
            rawJson: msg.rawJson ?? '{}',
            projectDir: '', // Project dir is on session, not message
            sessionId: result.sessionId,
            lineNumber: msg.lineNumber,
            toolName: msg.toolName, // Required for han_event subtype resolution
          },
          cursor: Buffer.from(`cursor:${messageIndex}`).toString('base64'),
        };

        publishSessionMessageAdded(result.sessionId, messageIndex, edgeData);
      }
    } catch (error) {
      log.error('Failed to fetch messages for subscription:', error);
      publishSessionMessageAdded(result.sessionId, -1, null);
    }
  }
}

/**
 * Start the coordinator server
 */
export async function startServer(
  options: CoordinatorOptions = {}
): Promise<void> {
  const port = options.port ?? COORDINATOR_PORT;
  const startupStartTime = Date.now();

  if (state.httpServer) {
    log.info('Server already running');
    return;
  }

  log.info('Coordinator startup beginning...');

  // Initialize database
  const dbStartTime = Date.now();
  await initDb();
  log.info(`Database initialized in ${Date.now() - dbStartTime}ms`);

  // Acquire coordinator lock
  const acquired = coordinator.tryAcquire();
  if (!acquired) {
    throw new Error(
      'Failed to acquire coordinator lock - another instance may be running'
    );
  }
  log.info('Acquired coordinator lock');

  // Start heartbeat
  const heartbeatMs = coordinator.getHeartbeatInterval() * 1000;
  state.heartbeatInterval = setInterval(() => {
    if (!coordinator.updateHeartbeat()) {
      log.error('Failed to update heartbeat');
    }
  }, heartbeatMs);

  // Start watchdog timer to detect hangs and manage inactivity shutdown
  state.watchdogInterval = setInterval(async () => {
    const timeSinceActivity = Date.now() - state.lastActivity;
    if (timeSinceActivity > WATCHDOG_TIMEOUT_MS) {
      // Check if we should keep coordinator alive despite inactivity
      const keepAlive = await shouldStayAlive();
      if (keepAlive) {
        log.debug(
          `Watchdog: No activity for ${Math.round(timeSinceActivity / 1000)}s, but staying alive due to active connections/sessions`
        );
        return;
      }

      log.info(
        `Watchdog: No activity for ${Math.round(timeSinceActivity / 1000)}s and no active connections/sessions, shutting down...`
      );
      // Graceful shutdown - let the daemon restart when needed
      stopServer();
      process.exit(0);
    }
  }, WATCHDOG_INTERVAL_MS);

  // Record initial activity
  recordActivity();

  // Try to get TLS certificates for HTTPS support
  const tls = await ensureCertificates();
  const protocol = tls ? 'https' : 'http';
  const hostPattern = tls ? 'coordinator.local.han.guru' : '127.0.0.1';

  // Create GraphQL Yoga handler with DataLoader context
  const yoga = createYoga({
    schema,
    graphqlEndpoint: '/graphql',
    graphiql: true,
    plugins: [
      // biome-ignore lint/correctness/useHookAtTopLevel: This is a GraphQL Yoga plugin, not a React hook
      useDeferStream(), // Enable @defer and @stream directives
    ],
    cors: {
      origin: '*',
      credentials: false,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    },
    context: ({ request }) => ({
      request,
      loaders: createLoaders(),
    }),
  });

  // Create WebSocket server for subscriptions
  const wsServer = makeServer({ schema });

  // Create HTTP or HTTPS server based on TLS availability
  const httpServer = tls
    ? createHttpsServer({ cert: tls.cert, key: tls.key }, async (req, res) => {
        // Record activity on every request
        recordActivity();

        const pathname = parse(req.url || '/').pathname || '/';

        // Health endpoint
        if (pathname === '/health') {
          const uptime = state.startedAt
            ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
            : 0;

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'ok',
              pid: process.pid,
              uptime,
              version: process.env.HAN_VERSION || 'dev',
            })
          );
          return;
        }

        // GraphQL endpoint
        if (pathname === '/graphql') {
          // Handle CORS preflight
          if (req.method === 'OPTIONS') {
            const origin = req.headers.origin || '*';
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader(
              'Access-Control-Allow-Headers',
              'Content-Type, Authorization'
            );
            res.setHeader('Access-Control-Max-Age', '86400');
            res.statusCode = 204;
            res.end();
            return;
          }

          // Add CORS headers to all responses
          const origin = req.headers.origin || '*';
          res.setHeader('Access-Control-Allow-Origin', origin);

          try {
            const webRequest = await nodeToWebRequest(req);
            const webResponse = await yoga.fetch(webRequest);
            await sendWebResponse(res, webResponse);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            log.error('GraphQL error:', errorMessage);
            if (errorStack) {
              log.error('Stack:', errorStack);
            }
            res.statusCode = 500;
            res.end('Internal Server Error');
          }
          return;
        }

        // 404 for other routes
        res.statusCode = 404;
        res.end('Not Found');
      })
    : createHttpServer(async (req, res) => {
        // Record activity on every request
        recordActivity();

        const pathname = parse(req.url || '/').pathname || '/';

        // Health endpoint
        if (pathname === '/health') {
          const uptime = state.startedAt
            ? Math.floor((Date.now() - state.startedAt.getTime()) / 1000)
            : 0;

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              status: 'ok',
              pid: process.pid,
              uptime,
              version: process.env.HAN_VERSION || 'dev',
            })
          );
          return;
        }

        // GraphQL endpoint
        if (pathname === '/graphql') {
          // Handle CORS preflight
          if (req.method === 'OPTIONS') {
            const origin = req.headers.origin || '*';
            res.setHeader('Access-Control-Allow-Origin', origin);
            res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
            res.setHeader(
              'Access-Control-Allow-Headers',
              'Content-Type, Authorization'
            );
            res.setHeader('Access-Control-Max-Age', '86400');
            res.statusCode = 204;
            res.end();
            return;
          }

          // Add CORS headers to all responses
          const origin = req.headers.origin || '*';
          res.setHeader('Access-Control-Allow-Origin', origin);

          try {
            const webRequest = await nodeToWebRequest(req);
            const webResponse = await yoga.fetch(webRequest);
            await sendWebResponse(res, webResponse);
          } catch (error) {
            const errorMessage =
              error instanceof Error ? error.message : String(error);
            const errorStack = error instanceof Error ? error.stack : undefined;
            log.error('GraphQL error:', errorMessage);
            if (errorStack) {
              log.error('Stack:', errorStack);
            }
            res.statusCode = 500;
            res.end('Internal Server Error');
          }
          return;
        }

        // 404 for other routes
        res.statusCode = 404;
        res.end('Not Found');
      });

  // WebSocket handling
  const wss = new WebSocketServer({ noServer: true });

  httpServer.on('upgrade', (request, socket, head) => {
    // Record activity on WebSocket upgrades
    recordActivity();

    const pathname = parse(request.url || '/').pathname;

    if (pathname === '/graphql') {
      wss.handleUpgrade(request, socket, head, (ws) => {
        // Track active WebSocket connections
        state.activeWebSocketClients++;
        log.info(
          `WebSocket client connected (total: ${state.activeWebSocketClients})`
        );

        const closed = wsServer.opened(
          {
            protocol: ws.protocol,
            send: (data) => ws.send(data),
            close: (code, reason) => ws.close(code, reason),
            onMessage: (cb) => {
              ws.on('message', (data) => {
                // Record activity on every WebSocket message
                recordActivity();
                cb(data.toString());
              });
            },
          },
          { socket: ws, request }
        );

        ws.on('close', () => {
          // Untrack WebSocket connection
          state.activeWebSocketClients = Math.max(
            0,
            state.activeWebSocketClients - 1
          );
          log.info(
            `WebSocket client disconnected (remaining: ${state.activeWebSocketClients})`
          );
          closed();
        });
      });
    }
  });

  state.httpServer = httpServer;
  state.wss = wss;
  state.startedAt = new Date();

  // Start listening
  await new Promise<void>((resolve) => {
    httpServer.listen(port, '127.0.0.1', () => {
      log.info(
        `GraphQL server listening on ${protocol}://${hostPattern}:${port}/graphql`
      );
      if (tls) {
        log.info("HTTPS enabled with Let's Encrypt certificate");
      }
      resolve();
    });
  });

  // Start file watcher first to handle incremental updates
  const watcherStartTime = Date.now();
  log.info('Starting file watcher...');
  const watchPath = watcher.getDefaultPath();
  const watchStarted = await watcher.start(watchPath);

  if (watchStarted) {
    log.info(
      `Watching ${watchPath} (started in ${Date.now() - watcherStartTime}ms)`
    );

    // Register callback for instant event-driven updates
    // This is called directly from Rust when new messages are indexed
    watcher.setCallback((result) => {
      // Record activity from file watcher
      recordActivity();
      // Fire and forget - don't block the watcher callback
      void onDataIndexed(result);
    });
    log.info('Event-driven updates enabled');
  } else {
    log.error('Failed to start file watcher');
  }

  // Start global slot manager for cross-session resource coordination
  globalSlotManager.start();
  log.info('Global slot manager started');

  // Start pending hooks processor for deferred hook execution
  state.pendingHooksInterval = setInterval(() => {
    void processPendingHooks();
  }, PENDING_HOOKS_INTERVAL_MS);
  log.info('Pending hooks processor started');

  // Start self-health monitoring watchdog
  // This detects when the coordinator becomes unresponsive and triggers a restart
  state.selfHealthCheckInterval = setInterval(async () => {
    const healthy = await performSelfHealthCheck();
    if (healthy) {
      // Reset consecutive failures on successful check
      if (state.consecutiveHealthFailures > 0) {
        log.info('Self-health check recovered after failures');
        state.consecutiveHealthFailures = 0;
      }
    } else {
      await handleHealthCheckFailure();
    }
  }, SELF_HEALTH_CHECK_INTERVAL_MS);
  log.info(
    `Self-health monitoring started (checks every ${SELF_HEALTH_CHECK_INTERVAL_MS / 1000}s, restarts after ${MAX_CONSECUTIVE_HEALTH_FAILURES} failures)`
  );

  // Start certificate refresh for HTTPS servers (6-day cert hot-reload)
  // Only needed if TLS is enabled
  if (tls && state.httpServer) {
    state.certRefreshInterval = setInterval(() => {
      void checkAndRefreshCertificates(
        state.httpServer as import('node:https').Server
      );
    }, CERT_REFRESH_INTERVAL_MS);
    log.info(
      'Certificate refresh scheduler started (checks every 12 hours for 6-day cert rotation)'
    );
  }

  // Skip initial index to keep server responsive during startup
  // Sessions are indexed incrementally via file watcher
  // A full reindex can be triggered with: han index run --all
  const totalStartupTime = Date.now() - startupStartTime;
  log.info(
    `Coordinator ready in ${totalStartupTime}ms (run 'han index run --all' to index existing sessions)`
  );
}

/**
 * Stop the coordinator server
 */
export function stopServer(): void {
  if (state.heartbeatInterval) {
    clearInterval(state.heartbeatInterval);
    state.heartbeatInterval = null;
  }

  if (state.watchdogInterval) {
    clearInterval(state.watchdogInterval);
    state.watchdogInterval = null;
  }

  if (state.pendingHooksInterval) {
    clearInterval(state.pendingHooksInterval);
    state.pendingHooksInterval = null;
  }

  if (state.certRefreshInterval) {
    clearInterval(state.certRefreshInterval);
    state.certRefreshInterval = null;
  }

  if (state.selfHealthCheckInterval) {
    clearInterval(state.selfHealthCheckInterval);
    state.selfHealthCheckInterval = null;
  }

  // Callback is cleared automatically by watcher.stop()
  watcher.stop();
  globalSlotManager.stop();
  coordinator.release();

  if (state.wss) {
    state.wss.close();
    state.wss = null;
  }

  if (state.httpServer) {
    state.httpServer.close();
    state.httpServer = null;
  }

  state.startedAt = null;
  log.info('Server stopped');
}

/**
 * Get server uptime in seconds
 */
export function getUptime(): number {
  if (!state.startedAt) return 0;
  return Math.floor((Date.now() - state.startedAt.getTime()) / 1000);
}

/**
 * Convert Node.js request to Web API Request
 */
async function nodeToWebRequest(
  req: import('node:http').IncomingMessage
): Promise<Request> {
  const protocol = 'http';
  const host = req.headers.host || '127.0.0.1';
  const url = `${protocol}://${host}${req.url}`;

  const headers = new Headers();
  for (const [key, value] of Object.entries(req.headers)) {
    if (value) {
      if (Array.isArray(value)) {
        for (const v of value) {
          headers.append(key, v);
        }
      } else {
        headers.set(key, value);
      }
    }
  }

  let body: BodyInit | null = null;
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    const chunks: Buffer[] = [];
    for await (const chunk of req) {
      chunks.push(Buffer.from(chunk));
    }
    body = Buffer.concat(chunks);
  }

  return new Request(url, {
    method: req.method,
    headers,
    body,
  });
}

/**
 * Send Web API Response through Node.js response
 */
async function sendWebResponse(
  res: import('node:http').ServerResponse,
  webResponse: Response
): Promise<void> {
  res.statusCode = webResponse.status;
  res.statusMessage = webResponse.statusText;

  webResponse.headers.forEach((value, key) => {
    // Skip Transfer-Encoding - Node.js handles chunked encoding automatically
    // when using res.write() with streaming responses
    if (key.toLowerCase() === 'transfer-encoding') return;
    res.setHeader(key, value);
  });

  if (webResponse.body) {
    const reader = webResponse.body.getReader();
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      res.write(value);
    }
  }
  res.end();
}
