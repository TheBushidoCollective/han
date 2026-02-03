/**
 * GraphQL SummaryMessage type
 *
 * A context summary message in a session.
 */

import { builder } from '../../builder.ts';
import { encodeGlobalId } from '../../node-registry.ts';
import {
  type ContentBlockData,
  ContentBlockInterface,
  parseContentBlocks,
} from '../content-block.ts';
import { type ContentBlock, getMessageText } from './message-helpers.ts';
import {
  isUserMessageActuallySummary,
  MessageInterface,
  type MessageWithSession,
} from './message-interface.ts';

/**
 * Check if a summary message is a compact/auto-compaction summary
 * Compact summaries are generated automatically when context gets too large
 * Also includes continuation summaries from context overflow
 */
function isCompactSummary(msg: MessageWithSession): boolean {
  // Check for continuation summaries (user messages that are actually summaries)
  if (msg.type === 'user') {
    const content =
      typeof msg.content === 'string'
        ? msg.content
        : Array.isArray(msg.content)
          ? msg.content
              .filter((c) => c.type === 'text')
              .map((c) => c.text || '')
              .join('')
          : '';
    if (
      content.includes(
        'This session is being continued from a previous conversation'
      )
    ) {
      return true;
    }
  }

  if (!msg.rawJson) return false;
  try {
    const parsed = JSON.parse(msg.rawJson);
    // Check for auto-compact indicators in the raw JSON
    // Claude Code uses "auto_compact" or similar flags, or the summary type field
    if (parsed.type === 'auto_compact' || parsed.type === 'compact') {
      return true;
    }
    // Also check for compact indicator in message metadata
    if (parsed.is_compact || parsed.isCompact || parsed.auto_compacted) {
      return true;
    }
    // Check if it's a summary that starts with specific markers
    const content = parsed.message?.content || parsed.summary || '';
    if (typeof content === 'string') {
      // Auto-compact summaries often have specific patterns
      if (
        content.includes('[Auto-compacted]') ||
        content.includes('[Context compacted]') ||
        content.includes(
          'This session is being continued from a previous conversation'
        )
      ) {
        return true;
      }
    }
    return false;
  } catch {
    return false;
  }
}

const SummaryMessageRef =
  builder.objectRef<MessageWithSession>('SummaryMessage');

export const SummaryMessageType = SummaryMessageRef.implement({
  description: 'A context summary message in a session',
  interfaces: [MessageInterface],
  isTypeOf: (obj) => {
    if (typeof obj !== 'object' || obj === null || !('type' in obj))
      return false;
    const msg = obj as MessageWithSession;
    // Normal summary type
    if (msg.type === 'summary') return true;
    // User messages that are continuation summaries
    if (msg.type === 'user' && isUserMessageActuallySummary(msg)) return true;
    return false;
  },
  fields: (t) => ({
    id: t.id({
      description: 'Message global ID',
      resolve: (msg) => encodeGlobalId('Message', msg.id),
    }),
    timestamp: t.field({
      type: 'DateTime',
      description: 'When the summary was created',
      resolve: (msg) => msg.timestamp,
    }),
    isCompactSummary: t.boolean({
      description:
        'Whether this is an auto-compaction summary (context was automatically condensed)',
      resolve: (msg) => isCompactSummary(msg),
    }),
    content: t.string({
      nullable: true,
      description: 'Summary text content',
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
    contentBlocks: t.field({
      type: [ContentBlockInterface],
      resolve: (msg): ContentBlockData[] => {
        if (!msg.rawJson) return [];
        try {
          const parsed = JSON.parse(msg.rawJson);
          const content = parsed.message?.content;
          return parseContentBlocks(content, { sessionId: msg.sessionId });
        } catch {
          if (msg.content && typeof msg.content === 'string') {
            return [{ type: 'TEXT', text: msg.content }];
          }
          return [];
        }
      },
    }),
  }),
});
