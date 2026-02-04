/**
 * GraphQL HookScriptMessage type
 *
 * A generic script execution event (bash/cat commands).
 */

import { builder } from '../../builder.ts';
import { encodeGlobalId } from '../../node-registry.ts';
import { parseHookScriptMetadata } from './message-helpers.ts';
import {
  MessageInterface,
  type MessageWithSession,
} from './message-interface.ts';

const HookScriptMessageRef =
  builder.objectRef<MessageWithSession>('HookScriptMessage');

export const HookScriptMessageType = HookScriptMessageRef.implement({
  description: 'A generic script execution event (bash/cat commands)',
  interfaces: [MessageInterface],
  isTypeOf: (obj) =>
    typeof obj === 'object' &&
    obj !== null &&
    'type' in obj &&
    (obj as MessageWithSession).type === 'han_event' &&
    (obj as MessageWithSession).toolName === 'hook_script',
  fields: (t) => ({
    id: t.id({
      description: 'Message global ID',
      resolve: (msg) => encodeGlobalId('Message', msg.id),
    }),
    timestamp: t.field({
      type: 'DateTime',
      description: 'When the script executed',
      resolve: (msg) => msg.timestamp,
    }),
    rawJson: t.string({
      nullable: true,
      resolve: (msg) => msg.rawJson || null,
    }),
    plugin: t.string({
      nullable: true,
      description: 'Plugin running the script',
      resolve: (msg) => parseHookScriptMetadata(msg.rawJson).plugin,
    }),
    command: t.string({
      nullable: true,
      description: 'The command that was executed',
      resolve: (msg) => parseHookScriptMetadata(msg.rawJson).command,
    }),
    durationMs: t.int({
      nullable: true,
      description: 'Execution duration in milliseconds',
      resolve: (msg) => parseHookScriptMetadata(msg.rawJson).durationMs,
    }),
    exitCode: t.int({
      nullable: true,
      description: 'Exit code from the script',
      resolve: (msg) => parseHookScriptMetadata(msg.rawJson).exitCode,
    }),
    success: t.boolean({
      description: 'Whether the script succeeded',
      resolve: (msg) => parseHookScriptMetadata(msg.rawJson).success,
    }),
    output: t.string({
      nullable: true,
      description: 'Script output',
      resolve: (msg) => parseHookScriptMetadata(msg.rawJson).output,
    }),
  }),
});
