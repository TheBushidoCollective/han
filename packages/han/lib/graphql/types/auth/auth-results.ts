/**
 * Authentication Result Types
 *
 * GraphQL types for auth mutation results.
 */

import { builder } from "../../builder.ts";
import type { AuthUser, TokenPair, OAuthConnection } from "../../../auth/types.ts";
import { AuthUserRef } from "./auth-user.ts";
import { OAuthConnectionRef } from "./oauth-connection.ts";

/**
 * Token pair for client storage
 */
interface TokenPairPayload {
	accessToken: string;
	refreshToken: string;
	accessTokenExpiresAt: Date;
	refreshTokenExpiresAt: Date;
}

/**
 * TokenPair type ref
 */
export const TokenPairRef = builder.objectRef<TokenPairPayload>("TokenPair");

/**
 * TokenPair type implementation
 */
export const TokenPairType = TokenPairRef.implement({
	description: "JWT token pair for authentication",
	fields: (t) => ({
		accessToken: t.exposeString("accessToken", {
			description: "Short-lived access token (1 hour)",
		}),
		refreshToken: t.exposeString("refreshToken", {
			description: "Long-lived refresh token (7 days)",
		}),
		accessTokenExpiresAt: t.field({
			type: "DateTime",
			description: "When the access token expires",
			resolve: (pair) => pair.accessTokenExpiresAt,
		}),
		refreshTokenExpiresAt: t.field({
			type: "DateTime",
			description: "When the refresh token expires",
			resolve: (pair) => pair.refreshTokenExpiresAt,
		}),
	}),
});

/**
 * OAuth initiation result
 */
interface OAuthInitiatePayload {
	authorizationUrl: string;
	state: string;
	codeVerifier: string;
}

/**
 * OAuthInitiateResult type ref
 */
export const OAuthInitiateResultRef = builder.objectRef<OAuthInitiatePayload>("OAuthInitiateResult");

/**
 * OAuthInitiateResult type implementation
 */
export const OAuthInitiateResultType = OAuthInitiateResultRef.implement({
	description: "Result of initiating an OAuth flow",
	fields: (t) => ({
		authorizationUrl: t.exposeString("authorizationUrl", {
			description: "URL to redirect the user to for authorization",
		}),
		state: t.exposeString("state", {
			description: "State parameter for CSRF protection (store and verify on callback)",
		}),
		codeVerifier: t.exposeString("codeVerifier", {
			description: "PKCE code verifier (store securely and send with token exchange)",
		}),
	}),
});

/**
 * Auth result payload
 */
interface AuthResultPayload {
	success: boolean;
	user: AuthUser | null;
	tokens: TokenPair | null;
	error: string | null;
}

/**
 * AuthResult type ref
 */
export const AuthResultRef = builder.objectRef<AuthResultPayload>("AuthResult");

/**
 * AuthResult type implementation
 */
export const AuthResultType = AuthResultRef.implement({
	description: "Result of an authentication operation",
	fields: (t) => ({
		success: t.exposeBoolean("success", {
			description: "Whether the authentication succeeded",
		}),
		user: t.field({
			type: AuthUserRef,
			nullable: true,
			description: "The authenticated user (if successful)",
			resolve: (result) => result.user,
		}),
		tokens: t.field({
			type: TokenPairRef,
			nullable: true,
			description: "JWT tokens (if successful)",
			resolve: (result) => result.tokens as TokenPairPayload | null,
		}),
		error: t.string({
			nullable: true,
			description: "Error message (if failed)",
			resolve: (result) => result.error,
		}),
	}),
});

/**
 * Magic link result payload
 */
interface MagicLinkResultPayload {
	success: boolean;
	message: string;
}

/**
 * MagicLinkResult type ref
 */
export const MagicLinkResultRef = builder.objectRef<MagicLinkResultPayload>("MagicLinkResult");

/**
 * MagicLinkResult type implementation
 */
export const MagicLinkResultType = MagicLinkResultRef.implement({
	description: "Result of requesting a magic link",
	fields: (t) => ({
		success: t.exposeBoolean("success", {
			description: "Whether the magic link was sent",
		}),
		message: t.exposeString("message", {
			description: "Status message or error",
		}),
	}),
});

/**
 * Link result payload
 */
interface LinkResultPayload {
	success: boolean;
	connection: OAuthConnection | null;
	error: string | null;
}

/**
 * LinkResult type ref
 */
export const LinkResultRef = builder.objectRef<LinkResultPayload>("LinkResult");

/**
 * LinkResult type implementation
 */
export const LinkResultType = LinkResultRef.implement({
	description: "Result of linking an OAuth provider to an account",
	fields: (t) => ({
		success: t.exposeBoolean("success", {
			description: "Whether the linking succeeded",
		}),
		connection: t.field({
			type: OAuthConnectionRef,
			nullable: true,
			description: "The new OAuth connection (if successful)",
			resolve: (result) => result.connection,
		}),
		error: t.string({
			nullable: true,
			description: "Error message (if failed)",
			resolve: (result) => result.error,
		}),
	}),
});
