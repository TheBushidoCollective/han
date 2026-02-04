/**
 * GraphQL QueueOperationMessage type
 *
 * A queue state change operation.
 */

import { builder } from '../../builder.ts';
import { encodeGlobalId } from '../../node-registry.ts';
import { parseQueueOperationMetadata } from './message-helpers.ts';
import {
  MessageInterface,
  type MessageWithSession,
} from './message-interface.ts';

const QueueOperationMessageRef = builder.objectRef<MessageWithSession>(
  'QueueOperationMessage'
);

export const QueueOperationMessageType = QueueOperationMessageRef.implement({
  description: 'A queue state change operation',
  interfaces: [MessageInterface],
  isTypeOf: (obj) =>
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as MessageWithSession).type === 'queue-operation',
  fields: (t) => ({
    id: t.id({
      description: 'Message global ID',
      resolve: (msg) => encodeGlobalId('Message', msg.id),
    }),
    timestamp: t.field({
      type: 'DateTime',
      description: 'When the queue operation occurred',
      resolve: (msg) => msg.timestamp,
    }),
    rawJson: t.string({
      nullable: true,
      resolve: (msg) => msg.rawJson || null,
    }),
    // Queue operation-specific fields
    operation: t.string({
      nullable: true,
      description:
        "Type of queue operation (e.g., 'enqueue', 'dequeue', 'clear')",
      resolve: (msg) => parseQueueOperationMetadata(msg.rawJson).operation,
    }),
    queueSessionId: t.string({
      nullable: true,
      description: 'Session ID involved in the queue operation',
      resolve: (msg) => parseQueueOperationMetadata(msg.rawJson).queueSessionId,
    }),
  }),
});
