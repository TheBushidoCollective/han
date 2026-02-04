/**
 * GraphQL HookReferenceMessage type
 *
 * A hook reference injection event (must-read-first files).
 */

import { builder } from '../../builder.ts';
import { encodeGlobalId } from '../../node-registry.ts';
import { parseHookReferenceMetadata } from './message-helpers.ts';
import {
  MessageInterface,
  type MessageWithSession,
} from './message-interface.ts';

const HookReferenceMessageRef = builder.objectRef<MessageWithSession>(
  'HookReferenceMessage'
);

export const HookReferenceMessageType = HookReferenceMessageRef.implement({
  description: 'A hook reference injection event (must-read-first files)',
  interfaces: [MessageInterface],
  isTypeOf: (obj) =>
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as MessageWithSession).type === 'han_event' &&
    (obj as MessageWithSession).toolName === 'hook_reference',
  fields: (t) => ({
    id: t.id({
      description: 'Message global ID',
      resolve: (msg) => encodeGlobalId('Message', msg.id),
    }),
    timestamp: t.field({
      type: 'DateTime',
      description: 'When the reference was injected',
      resolve: (msg) => msg.timestamp,
    }),
    rawJson: t.string({
      nullable: true,
      resolve: (msg) => msg.rawJson || null,
    }),
    plugin: t.string({
      nullable: true,
      description: 'Plugin that injected the reference',
      resolve: (msg) => parseHookReferenceMetadata(msg.rawJson).plugin,
    }),
    filePath: t.string({
      nullable: true,
      description: 'Path to the referenced file',
      resolve: (msg) => parseHookReferenceMetadata(msg.rawJson).filePath,
    }),
    reason: t.string({
      nullable: true,
      description: 'Reason for must-read-first requirement',
      resolve: (msg) => parseHookReferenceMetadata(msg.rawJson).reason,
    }),
    success: t.boolean({
      description: 'Whether the file was found and injected',
      resolve: (msg) => parseHookReferenceMetadata(msg.rawJson).success,
    }),
    durationMs: t.int({
      nullable: true,
      description: 'Duration in milliseconds',
      resolve: (msg) => parseHookReferenceMetadata(msg.rawJson).durationMs,
    }),
  }),
});
