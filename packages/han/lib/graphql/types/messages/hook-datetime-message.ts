/**
 * GraphQL HookDatetimeMessage type
 *
 * A datetime injection event.
 */

import { builder } from '../../builder.ts';
import { encodeGlobalId } from '../../node-registry.ts';
import { parseHookDatetimeMetadata } from './message-helpers.ts';
import {
  MessageInterface,
  type MessageWithSession,
} from './message-interface.ts';

const HookDatetimeMessageRef = builder.objectRef<MessageWithSession>(
  'HookDatetimeMessage'
);

export const HookDatetimeMessageType = HookDatetimeMessageRef.implement({
  description: 'A datetime injection event',
  interfaces: [MessageInterface],
  isTypeOf: (obj) =>
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as MessageWithSession).type === 'han_event' &&
    (obj as MessageWithSession).toolName === 'hook_datetime',
  fields: (t) => ({
    id: t.id({
      description: 'Message global ID',
      resolve: (msg) => encodeGlobalId('Message', msg.id),
    }),
    timestamp: t.field({
      type: 'DateTime',
      description: 'When the datetime was injected',
      resolve: (msg) => msg.timestamp,
    }),
    rawJson: t.string({
      nullable: true,
      resolve: (msg) => msg.rawJson || null,
    }),
    plugin: t.string({
      nullable: true,
      description: 'Plugin injecting the datetime',
      resolve: (msg) => parseHookDatetimeMetadata(msg.rawJson).plugin,
    }),
    datetime: t.string({
      nullable: true,
      description: 'The datetime string that was output',
      resolve: (msg) => parseHookDatetimeMetadata(msg.rawJson).datetime,
    }),
    durationMs: t.int({
      nullable: true,
      description: 'Duration in milliseconds',
      resolve: (msg) => parseHookDatetimeMetadata(msg.rawJson).durationMs,
    }),
  }),
});
