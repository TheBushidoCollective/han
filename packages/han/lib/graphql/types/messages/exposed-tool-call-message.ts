/**
 * GraphQL ExposedToolCallMessage type
 *
 * An exposed tool call event.
 */

import { builder } from '../../builder.ts';
import { encodeGlobalId } from '../../node-registry.ts';
import { ExposedToolResultType } from './exposed-tool-result.ts';
import { parseMcpToolCallMetadata } from './message-helpers.ts';
import {
  MessageInterface,
  type MessageWithSession,
} from './message-interface.ts';

const ExposedToolCallMessageRef = builder.objectRef<MessageWithSession>(
  'ExposedToolCallMessage'
);

export const ExposedToolCallMessageType = ExposedToolCallMessageRef.implement({
  description: 'An exposed tool call event',
  interfaces: [MessageInterface],
  isTypeOf: (obj) =>
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as MessageWithSession).type === 'han_event' &&
    'toolName' in obj &&
    (obj as MessageWithSession).toolName === 'exposed_tool_call',
  fields: (t) => ({
    id: t.id({
      description: 'Message global ID',
      resolve: (msg) => encodeGlobalId('Message', msg.id),
    }),
    timestamp: t.field({
      type: 'DateTime',
      description: 'When the tool was called',
      resolve: (msg) => msg.timestamp,
    }),
    rawJson: t.string({
      nullable: true,
      resolve: (msg) => msg.rawJson || null,
    }),
    tool: t.string({
      nullable: true,
      description: 'Name of the exposed tool',
      resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).tool,
    }),
    prefixedName: t.string({
      nullable: true,
      description: 'Full prefixed tool name',
      resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).prefixedName,
    }),
    input: t.string({
      nullable: true,
      description: 'Tool input as JSON string',
      resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).input,
    }),
    callId: t.string({
      nullable: true,
      description: 'Correlation ID to match with result',
      resolve: (msg) => parseMcpToolCallMetadata(msg.rawJson).callId,
    }),
    // Result loaded via DataLoader
    result: t.field({
      type: ExposedToolResultType,
      nullable: true,
      description:
        'The result of this tool call (if available). Loaded via DataLoader from paired events.',
      resolve: async (msg, _args, context) => {
        const callId = parseMcpToolCallMetadata(msg.rawJson).callId;
        if (!callId) return null;

        const pairedEvents =
          await context.loaders.sessionPairedEventsLoader.load(msg.sessionId);
        return pairedEvents.exposedResultByCallId.get(callId) ?? null;
      },
    }),
  }),
});
