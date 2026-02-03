/**
 * GraphQL HookExecution Connection Types
 *
 * Relay-style pagination for hook executions.
 */

import type { HookExecution } from '../../api/hooks.ts';
import { builder } from '../builder.ts';
import { HookExecutionType } from './hook-execution.ts';
import { type Connection, type Edge, PageInfoType } from './pagination.ts';

/**
 * Type for hook execution connection data
 */
export type HookExecutionConnectionData = Connection<HookExecution>;

export const HookExecutionEdgeType = builder
  .objectRef<Edge<HookExecution>>('HookExecutionEdge')
  .implement({
    description: 'An edge in a hook execution connection',
    fields: (t) => ({
      node: t.field({
        type: HookExecutionType,
        description: 'The hook execution at this edge',
        resolve: (edge) => edge.node,
      }),
      cursor: t.exposeString('cursor', {
        description: 'Cursor for this edge',
      }),
    }),
  });

export const HookExecutionConnectionType = builder
  .objectRef<HookExecutionConnectionData>('HookExecutionConnection')
  .implement({
    description: 'A paginated list of hook executions',
    fields: (t) => ({
      edges: t.field({
        type: [HookExecutionEdgeType],
        description: 'List of hook execution edges',
        resolve: (conn) => conn.edges,
      }),
      pageInfo: t.field({
        type: PageInfoType,
        description: 'Pagination information',
        resolve: (conn) => conn.pageInfo,
      }),
      totalCount: t.exposeInt('totalCount', {
        description: 'Total number of hook executions',
      }),
    }),
  });
