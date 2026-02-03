/**
 * GraphQL HookResultMessage type
 *
 * A hook execution result event with success/failure status.
 */

import { builder } from '../../builder.ts';
import { encodeGlobalId } from '../../node-registry.ts';
import { parseHookResultMetadata } from './message-helpers.ts';
import {
  MessageInterface,
  type MessageWithSession,
} from './message-interface.ts';

const HookResultMessageRef =
  builder.objectRef<MessageWithSession>('HookResultMessage');

export const HookResultMessageType = HookResultMessageRef.implement({
  description: 'A hook execution result event with success/failure status',
  interfaces: [MessageInterface],
  isTypeOf: (obj) =>
    (typeof obj === 'object' &&
      obj !== null &&
      'type' in obj &&
      // Han events with toolName "hook_result" OR legacy type "hook_result"
      (obj as MessageWithSession).type === 'han_event' &&
      (obj as MessageWithSession).toolName === 'hook_result') ||
    (obj as MessageWithSession).type === 'hook_result',
  fields: (t) => ({
    id: t.id({
      description: 'Message global ID',
      resolve: (msg) => encodeGlobalId('Message', msg.id),
    }),
    timestamp: t.field({
      type: 'DateTime',
      description: 'When the hook completed',
      resolve: (msg) => msg.timestamp,
    }),
    rawJson: t.string({
      nullable: true,
      resolve: (msg) => msg.rawJson || null,
    }),
    // Hook result-specific fields
    plugin: t.string({
      nullable: true,
      description: 'Plugin that owns the hook',
      resolve: (msg) => parseHookResultMetadata(msg.rawJson).plugin,
    }),
    hook: t.string({
      nullable: true,
      description: 'Name of the hook that was executed',
      resolve: (msg) => parseHookResultMetadata(msg.rawJson).hook,
    }),
    directory: t.string({
      nullable: true,
      description: 'Directory context for the hook',
      resolve: (msg) => {
        const dir = parseHookResultMetadata(msg.rawJson).directory;
        return dir === '.' ? '(root)' : dir;
      },
    }),
    cached: t.boolean({
      description: 'Whether this result was from cache',
      resolve: (msg) => parseHookResultMetadata(msg.rawJson).cached,
    }),
    durationMs: t.int({
      nullable: true,
      description: 'Execution duration in milliseconds',
      resolve: (msg) => parseHookResultMetadata(msg.rawJson).durationMs,
    }),
    exitCode: t.int({
      nullable: true,
      description: 'Exit code from the hook process',
      resolve: (msg) => parseHookResultMetadata(msg.rawJson).exitCode,
    }),
    success: t.boolean({
      description: 'Whether the hook succeeded',
      resolve: (msg) => parseHookResultMetadata(msg.rawJson).success,
    }),
    output: t.string({
      nullable: true,
      description: 'Hook output content',
      resolve: (msg) => parseHookResultMetadata(msg.rawJson).output,
    }),
    error: t.string({
      nullable: true,
      description: 'Error message if hook failed',
      resolve: (msg) => parseHookResultMetadata(msg.rawJson).error,
    }),
  }),
});
