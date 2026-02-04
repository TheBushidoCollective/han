/**
 * GraphQL MessageSearchResult type
 *
 * A search result from searching session messages.
 */

import { builder } from '../../builder.ts';

/**
 * MessageSearchResult data interface
 */
export interface MessageSearchResultData {
  messageId: string;
  messageIndex: number;
  preview: string;
  matchContext: string;
}

export const MessageSearchResultType =
  builder.objectRef<MessageSearchResultData>('MessageSearchResult');

MessageSearchResultType.implement({
  description: 'A search result from searching session messages',
  fields: (t) => ({
    messageId: t.exposeString('messageId', {
      description: 'The message ID',
    }),
    messageIndex: t.exposeInt('messageIndex', {
      description:
        'The 0-based index of the message in the session (for jumping)',
    }),
    preview: t.exposeString('preview', {
      description: 'Preview text showing match context',
    }),
    matchContext: t.exposeString('matchContext', {
      description: 'The matched text with surrounding context',
    }),
  }),
});
