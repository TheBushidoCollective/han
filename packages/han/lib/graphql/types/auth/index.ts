/**
 * Auth GraphQL Types Index
 *
 * Re-exports all authentication-related GraphQL types.
 */

// Types
export { AuthUserType, AuthUserRef, OAuthProviderEnum } from "./auth-user.ts";
export { AuthSessionType, AuthSessionRef } from "./auth-session.ts";
export { OAuthConnectionType, OAuthConnectionRef } from "./oauth-connection.ts";
export {
	TokenPairType,
	OAuthInitiateResultType,
	AuthResultType,
	MagicLinkResultType,
	LinkResultType,
} from "./auth-results.ts";

// Register mutations and queries (side effects)
import "./auth-mutations.ts";
import "./auth-queries.ts";
