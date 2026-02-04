/**
 * Session Connection Types
 *
 * Separated from session.ts to avoid circular dependencies when
 * project.ts and repo.ts need to reference SessionConnection type.
 *
 * This file defines:
 * - SessionRef (forward-declared, implemented in session.ts)
 * - SessionEdgeType
 * - SessionConnectionType
 */

import type { SessionDetail, SessionListItem } from '../../api/sessions.ts';
import { builder } from '../builder.ts';
import { type Connection, type Edge, PageInfoType } from './pagination.ts';

// =============================================================================
// Session Data Types
// =============================================================================

/**
 * Session type data - union of list item and detail
 */
export type SessionData = SessionListItem | SessionDetail;

/**
 * Forward-declared Session type ref - implemented in session.ts
 * This MUST be imported and used by session.ts to implement the type
 */
export const SessionRef = builder.objectRef<SessionData>('Session');

// =============================================================================
// Session Connection Types for Relay-style Pagination
// =============================================================================

/**
 * SessionEdge type for session connections
 */
export type SessionEdgeData = Edge<SessionData>;
const SessionEdgeRef = builder.objectRef<SessionEdgeData>('SessionEdge');

export const SessionEdgeType = SessionEdgeRef.implement({
  description: 'An edge in a session connection',
  fields: (t) => ({
    node: t.field({
      type: SessionRef,
      description: 'The session at this edge',
      resolve: (edge) => edge.node,
    }),
    cursor: t.exposeString('cursor', {
      description: 'Cursor for this edge',
    }),
  }),
});

/**
 * SessionConnection type for paginated sessions
 */
export type SessionConnectionData = Connection<SessionData>;
export const SessionConnectionRef =
  builder.objectRef<SessionConnectionData>('SessionConnection');

export const SessionConnectionType = SessionConnectionRef.implement({
  description: 'A paginated list of sessions',
  fields: (t) => ({
    edges: t.field({
      type: [SessionEdgeType],
      description: 'List of session edges',
      resolve: (conn) => conn.edges,
    }),
    pageInfo: t.field({
      type: PageInfoType,
      description: 'Pagination information',
      resolve: (conn) => conn.pageInfo,
    }),
    totalCount: t.exposeInt('totalCount', {
      description: 'Total number of sessions matching the query',
    }),
  }),
});
