/**
 * GraphQL SystemMessage type
 *
 * A system notification message with subtype and level.
 */

import { builder } from '../../builder.ts';
import { encodeGlobalId } from '../../node-registry.ts';
import {
  type ContentBlock,
  getMessageText,
  parseSystemMetadata,
} from './message-helpers.ts';
import {
  MessageInterface,
  type MessageWithSession,
} from './message-interface.ts';

const SystemMessageRef = builder.objectRef<MessageWithSession>('SystemMessage');

export const SystemMessageType = SystemMessageRef.implement({
  description: 'A system notification message with subtype and level',
  interfaces: [MessageInterface],
  isTypeOf: (obj) =>
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as MessageWithSession).type === 'system',
  fields: (t) => ({
    id: t.id({
      description: 'Message global ID',
      resolve: (msg) => encodeGlobalId('Message', msg.id),
    }),
    timestamp: t.field({
      type: 'DateTime',
      description: 'When the system message was sent',
      resolve: (msg) => msg.timestamp,
    }),
    content: t.string({
      nullable: true,
      description: 'System message content',
      resolve: (msg) => {
        const { text } = getMessageText(
          msg.content as string | ContentBlock[] | undefined
        );
        return text || null;
      },
    }),
    rawJson: t.string({
      nullable: true,
      resolve: (msg) => msg.rawJson || null,
    }),
    // System-specific fields
    subtype: t.string({
      nullable: true,
      description: "System message subtype (e.g., 'init', 'error', 'warning')",
      resolve: (msg) => parseSystemMetadata(msg.rawJson).subtype,
    }),
    level: t.string({
      nullable: true,
      description: "Message severity level (e.g., 'info', 'warning', 'error')",
      resolve: (msg) => parseSystemMetadata(msg.rawJson).level,
    }),
    isMeta: t.boolean({
      description: 'Whether this is a meta/internal system message',
      resolve: (msg) => parseSystemMetadata(msg.rawJson).isMeta,
    }),
  }),
});
