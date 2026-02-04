/**
 * GraphQL Message Connection Types
 *
 * Relay-style pagination for messages.
 */

import { builder } from '../../builder.ts';
import { PageInfoType } from '../pagination.ts';
import {
  MessageInterface,
  type MessageWithSession,
} from './message-interface.ts';

/**
 * Type for message connection data
 */
export type MessageConnectionData = {
  edges: Array<{ node: MessageWithSession; cursor: string }>;
  pageInfo: {
    hasNextPage: boolean;
    hasPreviousPage: boolean;
    startCursor: string | null;
    endCursor: string | null;
  };
  totalCount: number;
};

export const MessageEdgeType = builder
  .objectRef<{ node: MessageWithSession; cursor: string }>('MessageEdge')
  .implement({
    description: 'An edge in a message connection',
    fields: (t) => ({
      node: t.field({
        type: MessageInterface,
        description: 'The message at this edge',
        resolve: (edge) => edge.node,
      }),
      cursor: t.exposeString('cursor', {
        description: 'Cursor for this edge',
      }),
    }),
  });

export const MessageConnectionType = builder
  .objectRef<{
    edges: Array<{ node: MessageWithSession; cursor: string }>;
    pageInfo: {
      hasNextPage: boolean;
      hasPreviousPage: boolean;
      startCursor: string | null;
      endCursor: string | null;
    };
    totalCount: number;
  }>('MessageConnection')
  .implement({
    description: 'A paginated list of messages',
    fields: (t) => ({
      edges: t.field({
        type: [MessageEdgeType],
        description: 'List of message edges',
        resolve: (conn) => conn.edges,
      }),
      pageInfo: t.field({
        type: PageInfoType,
        description: 'Pagination information',
        resolve: (conn) => conn.pageInfo,
      }),
      totalCount: t.exposeInt('totalCount', {
        description: 'Total number of messages in the session',
      }),
    }),
  });
