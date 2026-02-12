/**
 * AuthUser GraphQL Type
 *
 * Represents an authenticated user with OAuth connections.
 */

import { getUserSessions } from '../../../auth/session-manager.ts';
import type { AuthUser as AuthUserType } from '../../../auth/types.ts';
import { builder } from '../../builder.ts';

/**
 * OAuth Provider enum
 */
export const OAuthProviderEnum = builder.enumType('OAuthProvider', {
  description: 'Supported OAuth providers',
  values: {
    GITHUB: { value: 'github' },
    GITLAB: { value: 'gitlab' },
  },
});

/**
 * AuthUser type ref
 */
export const AuthUserRef = builder.objectRef<AuthUserType>('AuthUser');

/**
 * AuthUser type implementation
 */
export const AuthUserTypeImpl = AuthUserRef.implement({
  description: 'An authenticated user',
  fields: (t) => ({
    id: t.exposeID('id', {
      description: 'Unique user identifier',
    }),
    email: t.string({
      nullable: true,
      description: "User's email address",
      resolve: (user) => user.email,
    }),
    displayName: t.string({
      nullable: true,
      description: "User's display name",
      resolve: (user) => user.displayName,
    }),
    avatarUrl: t.string({
      nullable: true,
      description: "URL to user's avatar image",
      resolve: (user) => user.avatarUrl,
    }),
    createdAt: t.field({
      type: 'DateTime',
      description: 'When the user account was created',
      resolve: (user) => user.createdAt,
    }),
    sessionCount: t.int({
      description: 'Number of active sessions',
      resolve: (user) => getUserSessions(user.id).length,
    }),
  }),
});

// Export as named type
export { AuthUserTypeImpl as AuthUserType };
