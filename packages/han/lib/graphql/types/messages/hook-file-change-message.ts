/**
 * GraphQL HookFileChangeMessage type
 *
 * A file change recording event.
 */

import { builder } from '../../builder.ts';
import { encodeGlobalId } from '../../node-registry.ts';
import { parseHookFileChangeMetadata } from './message-helpers.ts';
import {
  MessageInterface,
  type MessageWithSession,
} from './message-interface.ts';

const HookFileChangeMessageRef = builder.objectRef<MessageWithSession>(
  'HookFileChangeMessage'
);

export const HookFileChangeMessageType = HookFileChangeMessageRef.implement({
  description: 'A file change recording event',
  interfaces: [MessageInterface],
  isTypeOf: (obj) =>
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as MessageWithSession).type === 'han_event' &&
    (obj as MessageWithSession).toolName === 'hook_file_change',
  fields: (t) => ({
    id: t.id({
      description: 'Message global ID',
      resolve: (msg) => encodeGlobalId('Message', msg.id),
    }),
    timestamp: t.field({
      type: 'DateTime',
      description: 'When the file change was recorded',
      resolve: (msg) => msg.timestamp,
    }),
    rawJson: t.string({
      nullable: true,
      resolve: (msg) => msg.rawJson || null,
    }),
    recordedSessionId: t.string({
      nullable: true,
      description: 'Session ID where the change occurred',
      resolve: (msg) => parseHookFileChangeMetadata(msg.rawJson).sessionId,
    }),
    changeToolName: t.string({
      nullable: true,
      description: 'Tool that made the change (Edit, Write)',
      resolve: (msg) => parseHookFileChangeMetadata(msg.rawJson).toolName,
    }),
    filePath: t.string({
      nullable: true,
      description: 'Path to the changed file',
      resolve: (msg) => parseHookFileChangeMetadata(msg.rawJson).filePath,
    }),
  }),
});
