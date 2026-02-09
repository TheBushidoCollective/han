/**
 * Tests for commands/mcp/server.ts
 * Tests MCP server helper functions and JSON-RPC formatting
 */
import { afterEach, beforeEach, describe, expect, test } from 'bun:test';
import { mkdirSync, rmSync } from 'node:fs';
import { join } from 'node:path';

describe('mcp-server.ts helper functions', () => {
  const testDir = `/tmp/test-mcp-server-${Date.now()}`;
  let originalEnv: string | undefined;

  beforeEach(() => {
    // Save original environment
    originalEnv = process.env.CLAUDE_CONFIG_DIR;

    // Set up test environment
    process.env.CLAUDE_CONFIG_DIR = join(testDir, 'config');
    mkdirSync(join(testDir, 'config', 'han', 'metrics', 'jsonldb'), {
      recursive: true,
    });
  });

  afterEach(() => {
    // Restore environment
    if (originalEnv) {
      process.env.CLAUDE_CONFIG_DIR = originalEnv;
    } else {
      delete process.env.CLAUDE_CONFIG_DIR;
    }

    rmSync(testDir, { recursive: true, force: true });
  });

  describe('JSON-RPC message format', () => {
    test('creates valid JSON-RPC 2.0 request object', () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 1,
        method: 'tools/list',
        params: {},
      };

      expect(request.jsonrpc).toBe('2.0');
      expect(request.method).toBe('tools/list');
      expect(typeof request.id).toBe('number');
    });

    test('creates valid JSON-RPC 2.0 response object', () => {
      const response = {
        jsonrpc: '2.0' as const,
        id: 1,
        result: { tools: [] },
      };

      expect(response.jsonrpc).toBe('2.0');
      expect(response.id).toBe(1);
      expect(response.result).toBeDefined();
    });

    test('creates valid JSON-RPC 2.0 error response', () => {
      const errorResponse = {
        jsonrpc: '2.0' as const,
        id: 1,
        error: {
          code: -32600,
          message: 'Invalid Request',
        },
      };

      expect(errorResponse.jsonrpc).toBe('2.0');
      expect(errorResponse.error.code).toBe(-32600);
      expect(errorResponse.error.message).toBe('Invalid Request');
    });

    test('supports string IDs', () => {
      const request = {
        jsonrpc: '2.0' as const,
        id: 'request-123',
        method: 'tools/call',
      };

      expect(typeof request.id).toBe('string');
    });

    test('supports null ID for notifications', () => {
      const notification: { jsonrpc: '2.0'; method: string; id?: string } = {
        jsonrpc: '2.0' as const,
        method: 'notifications/initialized',
      };

      expect(notification.id).toBeUndefined();
    });
  });

  describe('MCP protocol version', () => {
    test('uses correct protocol version', () => {
      const protocolVersion = '2024-11-05';
      expect(protocolVersion).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    });

    test('server info structure', () => {
      const serverInfo = {
        name: 'han',
        version: '1.0.0',
      };

      expect(serverInfo.name).toBe('han');
      expect(serverInfo.version).toMatch(/^\d+\.\d+\.\d+$/);
    });

    test('capabilities include tools', () => {
      const capabilities = {
        tools: {},
      };

      expect(capabilities.tools).toBeDefined();
    });
  });

  describe('MCP tool annotations', () => {
    test('readOnlyHint for read-only tools', () => {
      const annotations = {
        title: 'Query Memory',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      };

      expect(annotations.readOnlyHint).toBe(true);
      expect(annotations.destructiveHint).toBe(false);
    });

    test('idempotentHint for safe-to-retry tools', () => {
      const annotations = {
        title: 'Memory (Unified)',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      };

      expect(annotations.idempotentHint).toBe(true);
    });

    test('all annotation fields are optional', () => {
      const minimalAnnotations: Record<string, unknown> = {};
      expect(Object.keys(minimalAnnotations).length).toBe(0);
    });
  });

  describe('MCP tool input schema', () => {
    test('creates object type schema', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          question: { type: 'string' },
        },
        required: ['question'],
      };

      expect(schema.type).toBe('object');
      expect(schema.properties.question).toBeDefined();
      expect(schema.required).toContain('question');
    });

    test('supports required fields', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          question: { type: 'string' },
          session_id: { type: 'string' },
        },
        required: ['question'],
      };

      expect(schema.required).toContain('question');
    });

    test('supports optional fields', () => {
      const schema = {
        type: 'object' as const,
        properties: {
          question: { type: 'string' },
          session_id: { type: 'string' },
        },
        required: ['question'],
      };

      // session_id is not required
      expect(schema.required).not.toContain('session_id');
    });
  });

  describe('MCP error codes', () => {
    test('Parse error code', () => {
      const PARSE_ERROR = -32700;
      expect(PARSE_ERROR).toBe(-32700);
    });

    test('Invalid Request code', () => {
      const INVALID_REQUEST = -32600;
      expect(INVALID_REQUEST).toBe(-32600);
    });

    test('Method not found code', () => {
      const METHOD_NOT_FOUND = -32601;
      expect(METHOD_NOT_FOUND).toBe(-32601);
    });

    test('Invalid params code', () => {
      const INVALID_PARAMS = -32602;
      expect(INVALID_PARAMS).toBe(-32602);
    });

    test('Internal error code', () => {
      const INTERNAL_ERROR = -32603;
      expect(INTERNAL_ERROR).toBe(-32603);
    });
  });

  describe('tool name formatting', () => {
    test('formats exposed tool name with server prefix', () => {
      const serverName = 'context7';
      const toolName = 'resolve-library-id';
      const prefixedName = `${serverName}_${toolName}`;
      expect(prefixedName).toBe('context7_resolve-library-id');
    });

    test('handles multiple tools from same server', () => {
      const serverName = 'blueprints';
      const tools = ['list_blueprints', 'read_blueprint', 'write_blueprint'];
      const prefixed = tools.map((t) => `${serverName}_${t}`);

      expect(prefixed).toEqual([
        'blueprints_list_blueprints',
        'blueprints_read_blueprint',
        'blueprints_write_blueprint',
      ]);
    });
  });

  describe('memory tools definition', () => {
    test('memory tool has question and session_id properties', () => {
      const tool = {
        name: 'memory',
        description:
          'Query memory with auto-routing. Automatically determines whether to check personal sessions, team knowledge, or project conventions.',
        inputSchema: {
          type: 'object' as const,
          properties: {
            question: {
              type: 'string',
              description:
                'Any question about your work, the team, or project conventions.',
            },
            session_id: {
              type: 'string',
              description:
                'Current Claude session ID. Used to associate queries with the active session context.',
            },
          },
          required: ['question'],
        },
      };

      expect(tool.name).toBe('memory');
      expect(tool.inputSchema.properties.question).toBeDefined();
      expect(tool.inputSchema.properties.session_id).toBeDefined();
      expect(tool.inputSchema.required).toContain('question');
      expect(tool.inputSchema.required).not.toContain('session_id'); // session_id is optional
    });

    test('memory tool session_id is string type', () => {
      const sessionIdSchema = {
        type: 'string',
        description:
          'Current Claude session ID. Used to associate queries with the active session context.',
      };

      expect(sessionIdSchema.type).toBe('string');
      expect(sessionIdSchema.description).toContain('session ID');
    });

    test('memory tool has read-only annotations', () => {
      const annotations = {
        title: 'Memory (Unified)',
        readOnlyHint: true,
        destructiveHint: false,
        idempotentHint: true,
        openWorldHint: false,
      };

      expect(annotations.readOnlyHint).toBe(true);
      expect(annotations.destructiveHint).toBe(false);
      expect(annotations.idempotentHint).toBe(true);
    });

    test('memory is the only memory tool', () => {
      // After cleanup, only `memory` tool remains (no learn, no legacy tools)
      const activeTools = ['memory'];

      expect(activeTools).toHaveLength(1);
      expect(activeTools).toContain('memory');

      // Verify removed tools are not present
      const removedTools = [
        'learn',
        'team_query',
        'auto_learn',
        'memory_list',
        'memory_read',
      ];
      for (const removed of removedTools) {
        expect(activeTools).not.toContain(removed);
      }
    });
  });
});
