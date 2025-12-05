#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';
import { MetricsStorage } from './storage.js';
import type {
  CompleteTaskParams,
  FailTaskParams,
  QueryMetricsParams,
  StartTaskParams,
  UpdateTaskParams,
} from './types.js';

/**
 * MCP Server for Agent Task Tracking and Metrics
 */
class MetricsServer {
  private server: Server;
  private storage: MetricsStorage;

  constructor() {
    this.server = new Server(
      {
        name: 'han-metrics',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.storage = new MetricsStorage();
    this.setupToolHandlers();

    // Handle errors
    this.server.onerror = (error) => {
      console.error('[MCP Error]', error);
    };

    // Handle cleanup
    process.on('SIGINT', () => {
      this.storage.close();
      process.exit(0);
    });
  }

  private setupToolHandlers() {
    // List available tools
    this.server.setRequestHandler(ListToolsRequestSchema, async () => ({
      tools: [
        {
          name: 'start_task',
          description:
            'Start tracking a new task. Returns a task_id for future updates. Use this when beginning work on a feature, fix, or refactoring.',
          inputSchema: {
            type: 'object',
            properties: {
              description: {
                type: 'string',
                description: 'Clear description of the task being performed',
              },
              type: {
                type: 'string',
                enum: ['implementation', 'fix', 'refactor', 'research'],
                description: 'Type of task being performed',
              },
              estimated_complexity: {
                type: 'string',
                enum: ['simple', 'moderate', 'complex'],
                description: 'Optional estimated complexity of the task',
              },
            },
            required: ['description', 'type'],
          },
        },
        {
          name: 'update_task',
          description:
            'Update a task with progress notes or status changes. Use this to log incremental progress.',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'The task ID returned from start_task',
              },
              status: {
                type: 'string',
                description: 'Optional status update',
              },
              notes: {
                type: 'string',
                description: 'Progress notes or observations',
              },
            },
            required: ['task_id'],
          },
        },
        {
          name: 'complete_task',
          description:
            'Mark a task as completed with outcome assessment. Use this when finishing a task successfully or partially.',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'The task ID returned from start_task',
              },
              outcome: {
                type: 'string',
                enum: ['success', 'partial', 'failure'],
                description: 'Outcome of the task',
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description:
                  'Confidence level (0-1) in the success of this task. Used for calibration.',
              },
              files_modified: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional list of files modified during this task',
              },
              tests_added: {
                type: 'number',
                description: 'Optional count of tests added',
              },
              notes: {
                type: 'string',
                description: 'Optional completion notes',
              },
            },
            required: ['task_id', 'outcome', 'confidence'],
          },
        },
        {
          name: 'fail_task',
          description:
            'Mark a task as failed with detailed reason and attempted solutions. Use when unable to complete a task.',
          inputSchema: {
            type: 'object',
            properties: {
              task_id: {
                type: 'string',
                description: 'The task ID returned from start_task',
              },
              reason: {
                type: 'string',
                description: 'Reason for failure',
              },
              confidence: {
                type: 'number',
                minimum: 0,
                maximum: 1,
                description: 'Optional confidence in the failure assessment',
              },
              attempted_solutions: {
                type: 'array',
                items: { type: 'string' },
                description: 'Optional list of solutions that were attempted',
              },
              notes: {
                type: 'string',
                description: 'Optional additional notes',
              },
            },
            required: ['task_id', 'reason'],
          },
        },
        {
          name: 'query_metrics',
          description:
            'Query task metrics and performance data. Use this to generate reports or analyze agent performance over time.',
          inputSchema: {
            type: 'object',
            properties: {
              period: {
                type: 'string',
                enum: ['day', 'week', 'month'],
                description: 'Optional time period to filter by',
              },
              task_type: {
                type: 'string',
                enum: ['implementation', 'fix', 'refactor', 'research'],
                description: 'Optional filter by task type',
              },
              outcome: {
                type: 'string',
                enum: ['success', 'partial', 'failure'],
                description: 'Optional filter by outcome',
              },
            },
          },
        },
      ],
    }));

    // Handle tool calls
    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        switch (request.params.name) {
          case 'start_task': {
            const params = request.params
              .arguments as unknown as StartTaskParams;
            const result = this.storage.startTask(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'update_task': {
            const params = request.params
              .arguments as unknown as UpdateTaskParams;
            const result = this.storage.updateTask(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'complete_task': {
            const params = request.params
              .arguments as unknown as CompleteTaskParams;
            const result = this.storage.completeTask(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'fail_task': {
            const params = request.params
              .arguments as unknown as FailTaskParams;
            const result = this.storage.failTask(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          case 'query_metrics': {
            const params = request.params
              .arguments as unknown as QueryMetricsParams;
            const result = this.storage.queryMetrics(params);
            return {
              content: [
                {
                  type: 'text',
                  text: JSON.stringify(result, null, 2),
                },
              ],
            };
          }

          default:
            throw new McpError(
              ErrorCode.MethodNotFound,
              `Unknown tool: ${request.params.name}`
            );
        }
      } catch (error) {
        if (error instanceof McpError) {
          throw error;
        }

        throw new McpError(
          ErrorCode.InternalError,
          `Tool execution failed: ${error instanceof Error ? error.message : String(error)}`
        );
      }
    });
  }

  async run() {
    const transport = new StdioServerTransport();
    await this.server.connect(transport);
    console.error('Han Metrics MCP server running on stdio');
  }
}

// Start server
const server = new MetricsServer();
server.run().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
