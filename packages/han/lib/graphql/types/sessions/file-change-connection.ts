/**
 * GraphQL FileChange Connection Types
 *
 * Relay-style pagination for file changes.
 */

import type { SessionFileChange as FileChangeData } from '../../../db/index.ts';
import { builder } from '../../builder.ts';
import { type Connection, type Edge, PageInfoType } from '../pagination.ts';
import { FileChangeType } from './file-change.ts';

/**
 * Type for file change connection data
 */
export type FileChangeConnectionData = Connection<FileChangeData>;

export const FileChangeEdgeType = builder
  .objectRef<Edge<FileChangeData>>('FileChangeEdge')
  .implement({
    description: 'An edge in a file change connection',
    fields: (t) => ({
      node: t.field({
        type: FileChangeType,
        description: 'The file change at this edge',
        resolve: (edge) => edge.node,
      }),
      cursor: t.exposeString('cursor', {
        description: 'Cursor for this edge',
      }),
    }),
  });

export const FileChangeConnectionType = builder
  .objectRef<FileChangeConnectionData>('FileChangeConnection')
  .implement({
    description: 'A paginated list of file changes',
    fields: (t) => ({
      edges: t.field({
        type: [FileChangeEdgeType],
        description: 'List of file change edges',
        resolve: (conn) => conn.edges,
      }),
      pageInfo: t.field({
        type: PageInfoType,
        description: 'Pagination information',
        resolve: (conn) => conn.pageInfo,
      }),
      totalCount: t.exposeInt('totalCount', {
        description: 'Total number of file changes',
      }),
    }),
  });
