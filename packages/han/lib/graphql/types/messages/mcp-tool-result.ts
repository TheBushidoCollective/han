/**
 * GraphQL McpToolResult type
 *
 * MCP tool result (inline, not a separate event).
 */

import { builder } from '../../builder.ts';
import type { McpResultEventData } from '../../loaders.ts';

/**
 * McpToolResult type for inline display on McpToolCallEvent
 */
export const McpToolResultType = builder
  .objectRef<McpResultEventData>('McpToolResult')
  .implement({
    description: 'MCP tool result (inline, not a separate event)',
    fields: (t) => ({
      id: t.exposeString('id', { description: 'Event ID' }),
      timestamp: t.field({
        type: 'DateTime',
        description: 'When the result was recorded',
        resolve: (data) => data.timestamp,
      }),
      callId: t.exposeString('callId', {
        description: 'Call ID for correlation',
      }),
      success: t.boolean({
        description: 'Whether call succeeded',
        resolve: (data) => data.success,
      }),
      durationMs: t.int({
        description: 'Execution duration in milliseconds',
        resolve: (data) => data.durationMs,
      }),
      result: t.string({
        nullable: true,
        description: 'Result as JSON string (if success)',
        resolve: (data) => data.result ?? null,
      }),
      error: t.string({
        nullable: true,
        description: 'Error message (if failed)',
        resolve: (data) => data.error ?? null,
      }),
    }),
  });
