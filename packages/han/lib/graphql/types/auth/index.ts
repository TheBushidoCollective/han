/**
 * Auth GraphQL Types Index
 *
 * Re-exports all authentication-related GraphQL types.
 */

export {
  AuthResultType,
  LinkResultType,
  MagicLinkResultType,
  OAuthInitiateResultType,
  TokenPairType,
} from './auth-results.ts';
export { AuthSessionRef, AuthSessionType } from './auth-session.ts';
// Types
export { AuthUserRef, AuthUserType, OAuthProviderEnum } from './auth-user.ts';
export { OAuthConnectionRef, OAuthConnectionType } from './oauth-connection.ts';

// Register mutations and queries (side effects)
import './auth-mutations.ts';
import './auth-queries.ts';
