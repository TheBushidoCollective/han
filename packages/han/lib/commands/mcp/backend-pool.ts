/**
 * Backend Pool for MCP Orchestrator
 *
 * Manages lazy connections to backend MCP servers with:
 * - Connect on first use
 * - Automatic disconnect after idle timeout
 * - Tool definition caching separate from connections
 * - Support for stdio, HTTP, and Docker transports
 *
 * Configuration (han.yml):
 * ```yaml
 * orchestrator:
 *   backends:
 *     idle_timeout: 300  # 5 minutes (seconds)
 *     max_connections: 10
 * ```
 */

import { type ChildProcess, spawn } from 'node:child_process';
import {
  createInterface,
  type Interface as ReadlineInterface,
} from 'node:readline';
import { getMergedHanConfig } from '../../config/index.ts';

/**
 * MCP Tool definition from a backend server
 */
export interface McpTool {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
  annotations?: Record<string, unknown>;
}

/**
 * Transport types for MCP backend servers
 */
export type TransportType = 'stdio' | 'http' | 'docker';

/**
 * Backend server configuration
 */
export interface BackendConfig {
  /** Server identifier */
  id: string;
  /** Transport type */
  type: TransportType;
  /** Command for stdio transport */
  command?: string;
  /** Arguments for stdio transport */
  args?: string[];
  /** URL for HTTP transport */
  url?: string;
  /** Docker image for docker transport */
  image?: string;
  /** Docker container args */
  dockerArgs?: string[];
  /** Environment variables */
  env?: Record<string, string>;
}

/**
 * JSON-RPC request structure
 */
interface JsonRpcRequest {
  jsonrpc: '2.0';
  id: string | number;
  method: string;
  params?: Record<string, unknown>;
}

/**
 * JSON-RPC response structure
 */
interface JsonRpcResponse {
  jsonrpc: '2.0';
  id: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

/**
 * Active backend connection state
 */
interface BackendConnection {
  /** Server ID */
  serverId: string;
  /** Transport type */
  type: TransportType;
  /** Child process for stdio/docker */
  process?: ChildProcess;
  /** Readline interface for parsing responses */
  readline?: ReadlineInterface;
  /** Pending request resolvers */
  pendingRequests: Map<
    string | number,
    {
      resolve: (result: unknown) => void;
      reject: (error: Error) => void;
    }
  >;
  /** Last activity timestamp */
  lastActivity: number;
  /** Connection state */
  state: 'connecting' | 'connected' | 'disconnecting' | 'disconnected';
  /** Request counter for generating IDs */
  requestCounter: number;
  /** Idle timeout timer */
  idleTimer?: ReturnType<typeof setTimeout>;
}

/**
 * Backend Pool configuration from han.yml
 */
export interface BackendPoolConfig {
  /** Idle timeout in seconds (default: 300 = 5 minutes) */
  idle_timeout: number;
  /** Maximum concurrent connections (default: 10) */
  max_connections: number;
}

/**
 * Default pool configuration
 */
const DEFAULT_POOL_CONFIG: BackendPoolConfig = {
  idle_timeout: 300, // 5 minutes
  max_connections: 10,
};

/**
 * Get pool configuration from han.yml
 */
export function getPoolConfig(): BackendPoolConfig {
  const hanConfig = getMergedHanConfig();
  const orchestratorConfig = (hanConfig as Record<string, unknown>)
    .orchestrator as { backends?: Partial<BackendPoolConfig> } | undefined;

  return {
    idle_timeout:
      orchestratorConfig?.backends?.idle_timeout ??
      DEFAULT_POOL_CONFIG.idle_timeout,
    max_connections:
      orchestratorConfig?.backends?.max_connections ??
      DEFAULT_POOL_CONFIG.max_connections,
  };
}

/**
 * Backend Pool
 *
 * Manages lazy connections to backend MCP servers.
 * Connections are established on first use and automatically
 * disconnected after an idle timeout.
 */
export class BackendPool {
  /** Active backend connections */
  private backends: Map<string, BackendConnection> = new Map();

  /** Cached tool definitions (persist across connection cycles) */
  private toolCache: Map<string, McpTool[]> = new Map();

  /** Backend configurations */
  private configs: Map<string, BackendConfig> = new Map();

  /** Pool configuration */
  private poolConfig: BackendPoolConfig;

  constructor(config?: Partial<BackendPoolConfig>) {
    const baseConfig = getPoolConfig();
    this.poolConfig = {
      idle_timeout: config?.idle_timeout ?? baseConfig.idle_timeout,
      max_connections: config?.max_connections ?? baseConfig.max_connections,
    };
  }

  /**
   * Register a backend server configuration
   */
  registerBackend(config: BackendConfig): void {
    this.configs.set(config.id, config);
  }

  /**
   * Get tools from a backend server
   *
   * Returns cached tools if available, otherwise connects
   * to the backend, fetches tools, caches them, and schedules
   * idle disconnect.
   */
  async getTools(serverId: string): Promise<McpTool[]> {
    // Return cached tools if available
    const cached = this.toolCache.get(serverId);
    if (cached) {
      // Touch the connection to reset idle timer
      this.touchConnection(serverId);
      return cached;
    }

    // Connect and fetch tools
    await this.connect(serverId);
    const tools = await this.fetchTools(serverId);

    // Cache tools
    this.toolCache.set(serverId, tools);

    return tools;
  }

  /**
   * Call a tool on a backend server
   */
  async callTool(
    serverId: string,
    toolName: string,
    args: Record<string, unknown>
  ): Promise<unknown> {
    // Ensure connected
    await this.connect(serverId);

    const connection = this.backends.get(serverId);
    if (!connection || connection.state !== 'connected') {
      throw new Error(`Backend ${serverId} is not connected`);
    }

    // Send tool call request
    const result = await this.sendRequest(connection, 'tools/call', {
      name: toolName,
      arguments: args,
    });

    // Reset idle timer
    this.scheduleIdleDisconnect(serverId);

    return result;
  }

  /**
   * Connect to a backend server
   *
   * Lazy connection - only connects if not already connected.
   */
  async connect(serverId: string): Promise<void> {
    // Check if already connected
    const existing = this.backends.get(serverId);
    if (
      existing &&
      (existing.state === 'connected' || existing.state === 'connecting')
    ) {
      // Wait for connecting state to complete
      if (existing.state === 'connecting') {
        await this.waitForConnection(serverId);
      }
      return;
    }

    // Check max connections
    const activeCount = Array.from(this.backends.values()).filter(
      (b) => b.state === 'connected' || b.state === 'connecting'
    ).length;

    if (activeCount >= this.poolConfig.max_connections) {
      // Disconnect least recently used backend
      await this.evictLeastRecentlyUsed();
    }

    // Get backend config
    const config = this.configs.get(serverId);
    if (!config) {
      throw new Error(`Unknown backend: ${serverId}`);
    }

    // Create connection based on transport type
    const connection = await this.createConnection(config);
    this.backends.set(serverId, connection);

    // Initialize the connection (send initialize request)
    await this.initializeConnection(connection);

    // Schedule idle disconnect
    this.scheduleIdleDisconnect(serverId);
  }

  /**
   * Disconnect from a backend server
   */
  async disconnect(serverId: string): Promise<void> {
    const connection = this.backends.get(serverId);
    if (!connection) {
      return;
    }

    // Clear idle timer
    if (connection.idleTimer) {
      clearTimeout(connection.idleTimer);
      connection.idleTimer = undefined;
    }

    connection.state = 'disconnecting';

    // Reject pending requests
    for (const [, pending] of connection.pendingRequests) {
      pending.reject(new Error('Connection closed'));
    }
    connection.pendingRequests.clear();

    // Close transport
    if (connection.type === 'stdio' || connection.type === 'docker') {
      if (connection.readline) {
        connection.readline.close();
      }
      if (connection.process) {
        connection.process.kill('SIGTERM');
        // Give it a moment to clean up, then force kill if needed
        await new Promise<void>((resolve) => {
          const timeout = setTimeout(() => {
            if (connection.process && !connection.process.killed) {
              connection.process.kill('SIGKILL');
            }
            resolve();
          }, 1000);

          connection.process?.on('exit', () => {
            clearTimeout(timeout);
            resolve();
          });
        });
      }
    }

    connection.state = 'disconnected';
    this.backends.delete(serverId);
  }

  /**
   * Disconnect all backends
   */
  async disconnectAll(): Promise<void> {
    const serverIds = Array.from(this.backends.keys());
    await Promise.all(serverIds.map((id) => this.disconnect(id)));
  }

  /**
   * Clear cached tools for a backend
   */
  clearToolCache(serverId: string): void {
    this.toolCache.delete(serverId);
  }

  /**
   * Clear all tool caches
   */
  clearAllToolCaches(): void {
    this.toolCache.clear();
  }

  /**
   * Get pool statistics
   */
  getStats(): {
    activeConnections: number;
    cachedToolSets: number;
    registeredBackends: number;
  } {
    return {
      activeConnections: Array.from(this.backends.values()).filter(
        (b) => b.state === 'connected'
      ).length,
      cachedToolSets: this.toolCache.size,
      registeredBackends: this.configs.size,
    };
  }

  /**
   * Check if a backend is connected
   */
  isConnected(serverId: string): boolean {
    const connection = this.backends.get(serverId);
    return connection?.state === 'connected';
  }

  /**
   * Get list of connected backend IDs
   */
  getConnectedBackends(): string[] {
    return Array.from(this.backends.entries())
      .filter(([, conn]) => conn.state === 'connected')
      .map(([id]) => id);
  }

  // ========== Private Methods ==========

  /**
   * Create a connection based on transport type
   */
  private async createConnection(
    config: BackendConfig
  ): Promise<BackendConnection> {
    const connection: BackendConnection = {
      serverId: config.id,
      type: config.type,
      pendingRequests: new Map(),
      lastActivity: Date.now(),
      state: 'connecting',
      requestCounter: 0,
    };

    switch (config.type) {
      case 'stdio':
        await this.createStdioConnection(config, connection);
        break;
      case 'docker':
        await this.createDockerConnection(config, connection);
        break;
      case 'http':
        // HTTP connections don't need persistent process
        break;
      default:
        throw new Error(`Unsupported transport type: ${config.type}`);
    }

    return connection;
  }

  /**
   * Create stdio transport connection
   */
  private async createStdioConnection(
    config: BackendConfig,
    connection: BackendConnection
  ): Promise<void> {
    if (!config.command) {
      throw new Error(`Stdio backend ${config.id} requires a command`);
    }

    const proc = spawn(config.command, config.args || [], {
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...config.env },
    });

    connection.process = proc;

    // Setup readline for parsing JSON-RPC responses
    if (proc.stdout) {
      const rl = createInterface({
        input: proc.stdout,
        terminal: false,
      });

      connection.readline = rl;

      rl.on('line', (line) => {
        this.handleResponse(connection, line);
      });
    }

    // Handle stderr (log but don't fail)
    proc.stderr?.on('data', (data) => {
      process.stderr.write(`[${config.id}] ${data}`);
    });

    // Handle process exit
    proc.on('exit', (code) => {
      if (connection.state === 'connected') {
        process.stderr.write(
          `[${config.id}] Process exited unexpectedly with code ${code}\n`
        );
        connection.state = 'disconnected';
        // Reject any pending requests
        for (const [, pending] of connection.pendingRequests) {
          pending.reject(new Error(`Process exited with code ${code}`));
        }
        connection.pendingRequests.clear();
      }
    });

    proc.on('error', (err) => {
      process.stderr.write(`[${config.id}] Process error: ${err.message}\n`);
      connection.state = 'disconnected';
    });

    // Wait for process to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for ${config.id} to start`));
      }, 10000);

      // Consider it ready once stdout is available
      if (proc.stdout) {
        clearTimeout(timeout);
        resolve();
      } else {
        reject(new Error(`Failed to start ${config.id}`));
      }
    });
  }

  /**
   * Create Docker transport connection
   */
  private async createDockerConnection(
    config: BackendConfig,
    connection: BackendConnection
  ): Promise<void> {
    if (!config.image) {
      throw new Error(`Docker backend ${config.id} requires an image`);
    }

    // Build docker run command
    const dockerArgs = [
      'run',
      '--rm',
      '-i', // Interactive for stdin
    ];

    // Add environment variables
    if (config.env) {
      for (const [key, value] of Object.entries(config.env)) {
        dockerArgs.push('-e', `${key}=${value}`);
      }
    }

    // Add any custom docker args
    if (config.dockerArgs) {
      dockerArgs.push(...config.dockerArgs);
    }

    // Add image and command args
    dockerArgs.push(config.image);
    if (config.args) {
      dockerArgs.push(...config.args);
    }

    const proc = spawn('docker', dockerArgs, {
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    connection.process = proc;

    // Setup readline
    if (proc.stdout) {
      const rl = createInterface({
        input: proc.stdout,
        terminal: false,
      });

      connection.readline = rl;

      rl.on('line', (line) => {
        this.handleResponse(connection, line);
      });
    }

    // Handle stderr
    proc.stderr?.on('data', (data) => {
      process.stderr.write(`[${config.id}:docker] ${data}`);
    });

    // Handle process events
    proc.on('exit', (code) => {
      if (connection.state === 'connected') {
        connection.state = 'disconnected';
        for (const [, pending] of connection.pendingRequests) {
          pending.reject(
            new Error(`Docker container exited with code ${code}`)
          );
        }
        connection.pendingRequests.clear();
      }
    });

    proc.on('error', (err) => {
      process.stderr.write(`[${config.id}:docker] Error: ${err.message}\n`);
      connection.state = 'disconnected';
    });

    // Wait for container to be ready
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error(`Timeout waiting for Docker container ${config.id}`));
      }, 30000); // Docker can take longer to start

      if (proc.stdout) {
        clearTimeout(timeout);
        resolve();
      } else {
        reject(new Error(`Failed to start Docker container ${config.id}`));
      }
    });
  }

  /**
   * Handle incoming JSON-RPC response
   */
  private handleResponse(connection: BackendConnection, line: string): void {
    if (!line.trim()) {
      return;
    }

    try {
      const response = JSON.parse(line) as JsonRpcResponse;
      const pending = connection.pendingRequests.get(response.id);

      if (pending) {
        connection.pendingRequests.delete(response.id);

        if (response.error) {
          pending.reject(
            new Error(
              `${response.error.message} (code: ${response.error.code})`
            )
          );
        } else {
          pending.resolve(response.result);
        }
      }
    } catch {
      // Log parse errors but don't crash
      process.stderr.write(
        `[${connection.serverId}] Failed to parse response: ${line}\n`
      );
    }
  }

  /**
   * Send a JSON-RPC request
   */
  private async sendRequest(
    connection: BackendConnection,
    method: string,
    params?: Record<string, unknown>
  ): Promise<unknown> {
    if (connection.state !== 'connected') {
      throw new Error(`Connection ${connection.serverId} is not ready`);
    }

    connection.lastActivity = Date.now();
    const id = ++connection.requestCounter;

    const request: JsonRpcRequest = {
      jsonrpc: '2.0',
      id,
      method,
      params,
    };

    return new Promise((resolve, reject) => {
      connection.pendingRequests.set(id, { resolve, reject });

      // Set request timeout
      const timeout = setTimeout(() => {
        connection.pendingRequests.delete(id);
        reject(new Error(`Request timeout for ${method}`));
      }, 30000);

      // Send request
      if (connection.type === 'stdio' || connection.type === 'docker') {
        if (!connection.process?.stdin) {
          clearTimeout(timeout);
          reject(new Error('No stdin available'));
          return;
        }

        connection.process.stdin.write(
          `${JSON.stringify(request)}\n`,
          (err) => {
            if (err) {
              clearTimeout(timeout);
              connection.pendingRequests.delete(id);
              reject(err);
            }
          }
        );
      } else if (connection.type === 'http') {
        // HTTP transport - send via fetch
        const config = this.configs.get(connection.serverId);
        if (!config?.url) {
          clearTimeout(timeout);
          reject(new Error('No URL configured for HTTP backend'));
          return;
        }

        fetch(config.url, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(request),
        })
          .then((res) => res.json() as Promise<JsonRpcResponse>)
          .then((response) => {
            clearTimeout(timeout);
            connection.pendingRequests.delete(id);

            if (response.error) {
              reject(
                new Error(
                  `${response.error.message} (code: ${response.error.code})`
                )
              );
            } else {
              resolve(response.result);
            }
          })
          .catch((err) => {
            clearTimeout(timeout);
            connection.pendingRequests.delete(id);
            reject(err);
          });
      }
    });
  }

  /**
   * Initialize MCP connection (send initialize handshake)
   */
  private async initializeConnection(
    connection: BackendConnection
  ): Promise<void> {
    const result = await this.sendRequest(connection, 'initialize', {
      protocolVersion: '2024-11-05',
      capabilities: {},
      clientInfo: {
        name: 'han-orchestrator',
        version: '1.0.0',
      },
    });

    // Validate response
    if (!result || typeof result !== 'object') {
      throw new Error('Invalid initialize response');
    }

    connection.state = 'connected';

    // Send initialized notification
    const notificationRequest: JsonRpcRequest = {
      jsonrpc: '2.0',
      id: ++connection.requestCounter,
      method: 'initialized',
      params: {},
    };

    if (connection.type === 'stdio' || connection.type === 'docker') {
      connection.process?.stdin?.write(
        `${JSON.stringify(notificationRequest)}\n`
      );
    }
  }

  /**
   * Fetch tools from connected backend
   */
  private async fetchTools(serverId: string): Promise<McpTool[]> {
    const connection = this.backends.get(serverId);
    if (!connection || connection.state !== 'connected') {
      throw new Error(`Backend ${serverId} is not connected`);
    }

    const result = (await this.sendRequest(connection, 'tools/list')) as {
      tools?: McpTool[];
    };

    return result?.tools || [];
  }

  /**
   * Touch connection to reset idle timer
   */
  private touchConnection(serverId: string): void {
    const connection = this.backends.get(serverId);
    if (connection) {
      connection.lastActivity = Date.now();
      this.scheduleIdleDisconnect(serverId);
    }
  }

  /**
   * Schedule idle disconnect
   */
  private scheduleIdleDisconnect(serverId: string): void {
    const connection = this.backends.get(serverId);
    if (!connection) {
      return;
    }

    // Clear existing timer
    if (connection.idleTimer) {
      clearTimeout(connection.idleTimer);
    }

    // Set new timer
    const timeoutMs = this.poolConfig.idle_timeout * 1000;
    connection.idleTimer = setTimeout(() => {
      this.disconnect(serverId).catch((err) => {
        process.stderr.write(
          `[${serverId}] Error during idle disconnect: ${err.message}\n`
        );
      });
    }, timeoutMs);
  }

  /**
   * Wait for a connecting backend to finish connecting
   */
  private async waitForConnection(serverId: string): Promise<void> {
    const maxWait = 30000; // 30 seconds
    const checkInterval = 100;
    let waited = 0;

    while (waited < maxWait) {
      const connection = this.backends.get(serverId);
      if (!connection) {
        throw new Error(`Backend ${serverId} connection was lost`);
      }

      if (connection.state === 'connected') {
        return;
      }

      if (
        connection.state === 'disconnected' ||
        connection.state === 'disconnecting'
      ) {
        throw new Error(`Backend ${serverId} disconnected while waiting`);
      }

      await new Promise((resolve) => setTimeout(resolve, checkInterval));
      waited += checkInterval;
    }

    throw new Error(`Timeout waiting for ${serverId} to connect`);
  }

  /**
   * Evict least recently used connection
   */
  private async evictLeastRecentlyUsed(): Promise<void> {
    let oldest: { id: string; lastActivity: number } | null = null;

    for (const [id, connection] of this.backends) {
      if (connection.state === 'connected') {
        if (!oldest || connection.lastActivity < oldest.lastActivity) {
          oldest = { id, lastActivity: connection.lastActivity };
        }
      }
    }

    if (oldest) {
      await this.disconnect(oldest.id);
    }
  }
}

// Factory function for creating a pool instance
export function createBackendPool(
  config?: Partial<BackendPoolConfig>
): BackendPool {
  return new BackendPool(config);
}
