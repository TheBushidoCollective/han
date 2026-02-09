/**
 * Authentication Queries
 *
 * GraphQL queries for authentication state.
 */

import { builder } from '../../builder.ts';
import { AuthSessionRef } from './auth-session.ts';
import { AuthUserRef } from './auth-user.ts';

/**
 * Add auth queries to the schema
 */
builder.queryFields((t) => ({
  /**
   * Get the current authenticated user
   */
  viewer: t.field({
    type: AuthUserRef,
    nullable: true,
    description:
      'The currently authenticated user, or null if not authenticated',
    resolve: (_parent, _args, context) => {
      const authContext = context.auth;
      return authContext?.user || null;
    },
  }),

  /**
   * Get the current session
   */
  currentSession: t.field({
    type: AuthSessionRef,
    nullable: true,
    description:
      'The current authentication session, or null if not authenticated',
    resolve: (_parent, _args, context) => {
      const authContext = context.auth;
      return authContext?.session || null;
    },
  }),

  /**
   * Get all sessions for the current user
   */
  mySessions: t.field({
    type: [AuthSessionRef],
    description: 'All active sessions for the current user',
    resolve: async (_parent, _args, context) => {
      const authContext = context.auth;
      if (!authContext?.user) {
        return [];
      }

      const { getUserSessions } = await import(
        '../../../auth/session-manager.ts'
      );
      return getUserSessions(authContext.user.id);
    },
  }),
}));
