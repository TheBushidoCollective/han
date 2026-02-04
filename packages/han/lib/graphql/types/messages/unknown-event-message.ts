/**
 * GraphQL UnknownEventMessage type
 *
 * A fallback message type for unknown or future event types.
 */

import { builder } from '../../builder.ts';
import { encodeGlobalId } from '../../node-registry.ts';
import {
  MessageInterface,
  type MessageWithSession,
} from './message-interface.ts';

const UnknownEventMessageRef = builder.objectRef<MessageWithSession>(
  'UnknownEventMessage'
);

export const UnknownEventMessageType = UnknownEventMessageRef.implement({
  description:
    'A fallback message type for unknown or future event types. Contains raw JSON for debugging.',
  interfaces: [MessageInterface],
  isTypeOf: (obj) => {
    // This is the catch-all for any unknown types
    if (typeof obj !== 'object' || obj === null) return false;
    const msg = obj as MessageWithSession;

    // Match if we don't have a more specific type
    const knownTypes = [
      'user',
      'assistant',
      'summary',
      'system',
      'file-history-snapshot',
      'hook_run',
      'hook_result',
      'queue-operation',
    ];
    if (knownTypes.includes(msg.type)) return false;
    if (msg.type === 'han_event') {
      const knownEventTypes = [
        'hook_run',
        'hook_result',
        'hook_reference',
        'hook_validation',
        'hook_validation_cache',
        'hook_script',
        'hook_datetime',
        'hook_file_change',
        'queue_operation',
        'mcp_tool_call',
        'mcp_tool_result',
        'exposed_tool_call',
        'exposed_tool_result',
        'memory_query',
        'memory_learn',
        'sentiment_analysis',
      ];
      return !knownEventTypes.includes(msg.toolName ?? '');
    }
    return true;
  },
  fields: (t) => ({
    id: t.id({
      description: 'Message global ID',
      resolve: (msg) => encodeGlobalId('Message', msg.id),
    }),
    timestamp: t.field({
      type: 'DateTime',
      description: 'When the event occurred',
      resolve: (msg) => msg.timestamp,
    }),
    rawJson: t.string({
      nullable: true,
      description: 'Raw JSON for debugging unknown types',
      resolve: (msg) => msg.rawJson || null,
    }),
    messageType: t.string({
      nullable: true,
      description: 'The original message type',
      resolve: (msg) => msg.type ?? null,
    }),
    eventType: t.string({
      nullable: true,
      description: 'The event subtype if han_event',
      resolve: (msg) => msg.toolName ?? null,
    }),
  }),
});
