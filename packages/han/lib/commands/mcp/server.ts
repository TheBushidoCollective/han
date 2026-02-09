import { createInterface } from 'node:readline';
import { isMemoryEnabled } from '../../config/han-settings.ts';
import { getOrCreateEventLogger } from '../../events/logger.ts';
import {
  formatMemoryAgentResult,
  type MemoryQueryParams,
  queryMemoryAgent,
} from '../../memory/memory-agent.ts';
import { type BackendPool, createBackendPool } from './backend-pool.ts';
import { getExposedMcpServers } from './exposed-tools.ts';

interface JsonRpcRequest {
  jsonrpc: '2.0';
  id?: string | number;
  method: string;
  params?: Record<string, unknown>;
}

interface JsonRpcResponse {
  jsonrpc: '2.0';
  id?: string | number;
  result?: unknown;
  error?: {
    code: number;
    message: string;
    data?: unknown;
  };
}

interface McpToolAnnotations {
  title?: string;
  readOnlyHint?: boolean;
  destructiveHint?: boolean;
  idempotentHint?: boolean;
  openWorldHint?: boolean;
}

interface McpTool {
  name: string;
  description: string;
  annotations?: McpToolAnnotations;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

export function handleInitialize(): unknown {
  return {
    protocolVersion: '2024-11-05',
    capabilities: {
      tools: {},
    },
    serverInfo: {
      name: 'han',
      version: '1.0.0',
    },
  };
}

// Unified memory tool (auto-routes to Personal, Team, or Rules)
const UNIFIED_MEMORY_TOOLS: McpTool[] = [
  {
    name: 'memory',
    description:
      "Query memory with auto-routing. Automatically determines whether to check personal sessions, team knowledge, or project conventions. Use this as the primary entry point for all memory queries. Examples: 'what was I working on?', 'who knows about authentication?', 'how do we handle errors?'",
    annotations: {
      title: 'Memory (Unified)',
      readOnlyHint: true,
      destructiveHint: false,
      idempotentHint: true,
      openWorldHint: false,
    },
    inputSchema: {
      type: 'object',
      properties: {
        question: {
          type: 'string',
          description:
            'Any question about your work, the team, or project conventions. The system will automatically route to the appropriate memory layer.',
        },
        session_id: {
          type: 'string',
          description:
            'Current Claude session ID. Used to associate queries with the active session context.',
        },
      },
      required: ['question'],
    },
  },
];

// Lazy-load backend pool for exposed MCP servers
let exposedBackendPool: BackendPool | null = null;

function getExposedBackendPool(): BackendPool {
  if (!exposedBackendPool) {
    exposedBackendPool = createBackendPool();
    const exposedServers = getExposedMcpServers();
    for (const server of exposedServers) {
      exposedBackendPool.registerBackend({
        id: server.serverName,
        type: server.type === 'http' ? 'http' : 'stdio',
        command: server.command,
        args: server.args,
        url: server.url,
        env: server.env,
      });
    }
  }
  return exposedBackendPool;
}

// Interface to map prefixed tool names back to server/original name
interface ExposedToolMapping {
  serverId: string;
  originalName: string;
}

// Cache for exposed tools (avoids re-fetching on every tools/list)
let exposedToolMappings: Map<string, ExposedToolMapping> | null = null;
let exposedToolsCache: McpTool[] | null = null;

/**
 * Get tools from all exposed MCP servers with prefixed names
 * Example: context7 server's "resolve-library-id" becomes "context7_resolve-library-id"
 */
async function getExposedTools(): Promise<{
  tools: McpTool[];
  mappings: Map<string, ExposedToolMapping>;
}> {
  // Return cached if available
  if (exposedToolsCache && exposedToolMappings) {
    return { tools: exposedToolsCache, mappings: exposedToolMappings };
  }

  const exposedServers = getExposedMcpServers();
  if (exposedServers.length === 0) {
    exposedToolMappings = new Map();
    exposedToolsCache = [];
    return { tools: [], mappings: new Map() };
  }

  const pool = getExposedBackendPool();
  const allTools: McpTool[] = [];
  const mappings = new Map<string, ExposedToolMapping>();

  for (const server of exposedServers) {
    try {
      const tools = await pool.getTools(server.serverName);
      for (const tool of tools) {
        // Prefix tool name with server name
        const prefixedName = `${server.serverName}_${tool.name}`;
        allTools.push({
          ...tool,
          name: prefixedName,
          description: `[${server.serverName}] ${tool.description}`,
        });
        mappings.set(prefixedName, {
          serverId: server.serverName,
          originalName: tool.name,
        });
      }
    } catch (error) {
      // Log error but continue with other servers
      console.error(
        `Failed to get tools from ${server.serverName}:`,
        error instanceof Error ? error.message : String(error)
      );
    }
  }

  exposedToolMappings = mappings;
  exposedToolsCache = allTools;
  return { tools: allTools, mappings };
}

async function handleToolsList(): Promise<unknown> {
  const memoryEnabled = isMemoryEnabled();
  const { tools: exposedTools } = await getExposedTools();

  const allTools = [
    ...exposedTools,
    ...(memoryEnabled ? UNIFIED_MEMORY_TOOLS : []),
  ];

  return { tools: allTools };
}

async function handleToolsCall(params: {
  name: string;
  arguments?: Record<string, unknown>;
}): Promise<unknown> {
  const args = params.arguments || {};

  // Check if this is an exposed tool (from backend MCP servers)
  if (exposedToolMappings?.has(params.name)) {
    const mapping = exposedToolMappings.get(params.name);
    if (mapping) {
      const eventLogger = getOrCreateEventLogger();
      const startTime = Date.now();

      // Log exposed tool call event
      const callId = eventLogger?.logExposedToolCall(
        mapping.serverId,
        mapping.originalName,
        params.name,
        args
      );

      try {
        const pool = getExposedBackendPool();
        const result = await pool.callTool(
          mapping.serverId,
          mapping.originalName,
          args
        );

        // Log exposed tool result event
        const durationMs = Date.now() - startTime;
        if (callId) {
          eventLogger?.logExposedToolResult(
            mapping.serverId,
            mapping.originalName,
            params.name,
            callId,
            true,
            durationMs,
            result
          );
        }

        return result;
      } catch (error) {
        const message = error instanceof Error ? error.message : String(error);

        // Log exposed tool error event
        const durationMs = Date.now() - startTime;
        if (callId) {
          eventLogger?.logExposedToolResult(
            mapping.serverId,
            mapping.originalName,
            params.name,
            callId,
            false,
            durationMs,
            undefined,
            message
          );
        }

        return {
          content: [
            {
              type: 'text',
              text: `Error calling ${params.name}: ${message}`,
            },
          ],
          isError: true,
        };
      }
    }
  }

  // Check if this is the unified memory tool
  if (params.name === 'memory') {
    // Block if memory is disabled
    if (!isMemoryEnabled()) {
      return {
        content: [
          {
            type: 'text',
            text: 'Memory system is disabled. Enable it in han.yml with: memory:\n  enabled: true',
          },
        ],
        isError: true,
      };
    }
    try {
      const memoryParams = args as unknown as MemoryQueryParams;
      // Add projectPath from cwd for context-aware plugin discovery
      memoryParams.projectPath = process.cwd();
      const startTime = Date.now();
      const result = await queryMemoryAgent(memoryParams);
      const durationMs = Date.now() - startTime;

      // Log memory query event - derive source from searched layers
      const eventLogger = getOrCreateEventLogger();
      const primarySource =
        result.searchedLayers.length === 1
          ? (result.searchedLayers[0] as
              | 'personal'
              | 'team'
              | 'rules'
              | undefined)
          : result.searchedLayers.length > 1
            ? ('combined' as 'personal' | 'team' | 'rules' | undefined)
            : undefined;
      eventLogger?.logMemoryQuery(
        memoryParams.question,
        primarySource,
        result.success,
        durationMs
      );

      const formatted = formatMemoryAgentResult(result);
      return {
        content: [
          {
            type: 'text',
            text: formatted,
          },
        ],
        isError: !result.success,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      return {
        content: [
          {
            type: 'text',
            text: `Error executing memory: ${message}`,
          },
        ],
        isError: true,
      };
    }
  }

  throw {
    code: -32602,
    message: `Unknown tool: ${params.name}`,
  };
}

async function handleRequest(
  request: JsonRpcRequest
): Promise<JsonRpcResponse> {
  try {
    let result: unknown;

    switch (request.method) {
      case 'initialize':
        result = handleInitialize();
        break;
      case 'initialized':
        // Notification, no response needed
        return { jsonrpc: '2.0', id: request.id, result: {} };
      case 'ping':
        // Simple ping/pong for health checks
        result = {};
        break;
      case 'tools/list':
        result = await handleToolsList();
        break;
      case 'tools/call':
        result = await handleToolsCall(
          request.params as {
            name: string;
            arguments?: Record<string, unknown>;
          }
        );
        break;
      default:
        throw {
          code: -32601,
          message: `Method not found: ${request.method}`,
        };
    }

    return {
      jsonrpc: '2.0',
      id: request.id,
      result,
    };
  } catch (error) {
    const errorObj =
      typeof error === 'object' && error !== null && 'code' in error
        ? (error as { code: number; message: string })
        : { code: -32603, message: String(error) };

    return {
      jsonrpc: '2.0',
      id: request.id,
      error: errorObj,
    };
  }
}

function sendResponse(response: JsonRpcResponse): void {
  const json = JSON.stringify(response);
  process.stdout.write(`${json}\n`);
}

// Re-export coordinator readiness check from client layer
// Any code using CoordinatorClient automatically gets coordinator readiness,
// but this export is available for code that needs explicit control
export { ensureCoordinatorReady as waitForCoordinator } from '../coordinator/client.ts';

export async function startMcpServer(): Promise<void> {
  // Setup signal handlers for graceful shutdown
  process.on('SIGINT', () => process.exit(0));
  process.on('SIGTERM', () => process.exit(0));

  // Try to start coordinator in background (non-blocking)
  // This warms it up early so it's ready when first GraphQL request comes
  // Also started by SessionStart hook - whichever runs first wins
  import('../coordinator/client.ts').then(({ ensureCoordinatorReady }) => {
    ensureCoordinatorReady().catch(() => {
      // Ignore - will be retried on first GraphQL request if needed
    });
  });

  const rl = createInterface({
    input: process.stdin,
    terminal: false,
  });

  for await (const line of rl) {
    if (!line.trim()) continue;

    try {
      const request = JSON.parse(line) as JsonRpcRequest;
      const response = await handleRequest(request);

      // Only send response if there's an id (not a notification)
      if (request.id !== undefined) {
        sendResponse(response);
      }
    } catch (error) {
      // JSON parse error
      sendResponse({
        jsonrpc: '2.0',
        error: {
          code: -32700,
          message: 'Parse error',
          data: String(error),
        },
      });
    }
  }
}
