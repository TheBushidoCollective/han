/**
 * GraphQL HookValidationMessage type
 *
 * A per-directory validation hook result event.
 */

import { builder } from '../../builder.ts';
import { encodeGlobalId } from '../../node-registry.ts';
import { parseHookValidationMetadata } from './message-helpers.ts';
import {
  MessageInterface,
  type MessageWithSession,
} from './message-interface.ts';

const HookValidationMessageRef = builder.objectRef<MessageWithSession>(
  'HookValidationMessage'
);

export const HookValidationMessageType = HookValidationMessageRef.implement({
  description: 'A per-directory validation hook result event',
  interfaces: [MessageInterface],
  isTypeOf: (obj) =>
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as MessageWithSession).type === 'han_event' &&
    (obj as MessageWithSession).toolName === 'hook_validation',
  fields: (t) => ({
    id: t.id({
      description: 'Message global ID',
      resolve: (msg) => encodeGlobalId('Message', msg.id),
    }),
    timestamp: t.field({
      type: 'DateTime',
      description: 'When the validation completed',
      resolve: (msg) => msg.timestamp,
    }),
    rawJson: t.string({
      nullable: true,
      resolve: (msg) => msg.rawJson || null,
    }),
    plugin: t.string({
      nullable: true,
      description: 'Plugin running the validation',
      resolve: (msg) => parseHookValidationMetadata(msg.rawJson).plugin,
    }),
    hook: t.string({
      nullable: true,
      description: 'Validation hook name (e.g., lint, typecheck)',
      resolve: (msg) => parseHookValidationMetadata(msg.rawJson).hook,
    }),
    directory: t.string({
      nullable: true,
      description: 'Directory being validated',
      resolve: (msg) => {
        const dir = parseHookValidationMetadata(msg.rawJson).directory;
        return dir === '.' ? '(root)' : dir;
      },
    }),
    cached: t.boolean({
      description: 'Whether result was from cache',
      resolve: (msg) => parseHookValidationMetadata(msg.rawJson).cached,
    }),
    durationMs: t.int({
      nullable: true,
      description: 'Execution duration in milliseconds',
      resolve: (msg) => parseHookValidationMetadata(msg.rawJson).durationMs,
    }),
    exitCode: t.int({
      nullable: true,
      description: 'Exit code from the validation',
      resolve: (msg) => parseHookValidationMetadata(msg.rawJson).exitCode,
    }),
    success: t.boolean({
      description: 'Whether validation passed',
      resolve: (msg) => parseHookValidationMetadata(msg.rawJson).success,
    }),
    output: t.string({
      nullable: true,
      description: 'Validation output',
      resolve: (msg) => parseHookValidationMetadata(msg.rawJson).output,
    }),
    error: t.string({
      nullable: true,
      description: 'Error message if validation failed',
      resolve: (msg) => parseHookValidationMetadata(msg.rawJson).error,
    }),
  }),
});
