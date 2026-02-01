/**
 * Authentication Mutations
 *
 * GraphQL mutations for authentication operations.
 */

import { builder } from "../../builder.ts";
import { OAuthProviderEnum, } from "./auth-user.ts";
import {
	AuthResultType,
	MagicLinkResultType,
	OAuthInitiateResultType,
	LinkResultType,
} from "./auth-results.ts";
import {
	initiateOAuth,
	completeOAuth,
	requestMagicLink,
	verifyMagicLinkToken,
	consumeMagicLinkToken,
	createSession,
	refreshSession,
	revokeSession,
	revokeAllUserSessions,
	getAuthConfig,
	createUser,
	getUserByEmail,
	checkRateLimit,
	recordAttempt,
	RATE_LIMIT_CONFIGS,
	RATE_LIMIT_KEYS,
	getClientIP,
	parseDeviceInfo,
	type OAuthProvider,
} from "../../../auth/index.ts";

/**
 * Safely get auth config, returning null if not configured
 */
function getAuthConfigSafe() {
	try {
		return getAuthConfig();
	} catch {
		return null;
	}
}

/**
 * Add auth mutations to the schema
 */
builder.mutationFields((t) => ({
	/**
	 * Initiate OAuth flow
	 */
	initiateOAuth: t.field({
		type: OAuthInitiateResultType,
		args: {
			provider: t.arg({ type: OAuthProviderEnum, required: true }),
		},
		description: "Initiate OAuth flow with a provider. Returns URL to redirect user to.",
		resolve: (_parent, args, context) => {
			const config = getAuthConfigSafe();
			if (!config) {
				throw new Error("Authentication is not configured");
			}

			// Rate limit check
			const ip = context.request ? getClientIP(context.request) : "unknown";
			const rateLimitKey = RATE_LIMIT_KEYS.oauthInitiate(ip);
			const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIGS.oauthInitiate);

			if (!rateCheck.allowed) {
				throw new Error(
					`Too many requests. Please try again in ${Math.ceil((rateCheck.retryAfterMs || 0) / 1000)} seconds.`
				);
			}

			recordAttempt(rateLimitKey, RATE_LIMIT_CONFIGS.oauthInitiate, true);

			const provider = args.provider as OAuthProvider;
			return initiateOAuth(provider, config);
		},
	}),

	/**
	 * Complete OAuth flow
	 */
	completeOAuth: t.field({
		type: AuthResultType,
		args: {
			provider: t.arg({ type: OAuthProviderEnum, required: true }),
			code: t.arg.string({ required: true }),
			state: t.arg.string({ required: true }),
			codeVerifier: t.arg.string({ required: true }),
		},
		description: "Complete OAuth flow after user authorization",
		resolve: async (_parent, args, context) => {
			const config = getAuthConfigSafe();
			if (!config) {
				return { success: false, user: null, tokens: null, error: "Authentication is not configured" };
			}

			try {
				const provider = args.provider as OAuthProvider;
				const oauthResult = await completeOAuth(
					provider,
					args.code,
					args.codeVerifier,
					config
				);

				// Find or create user
				let user = oauthResult.providerEmail
					? getUserByEmail(oauthResult.providerEmail)
					: null;

				if (!user) {
					user = createUser(
						oauthResult.providerEmail,
						oauthResult.providerUsername,
						null // Avatar URL could be fetched from provider
					);
				}

				// Create session
				const deviceInfo = context.request
					? parseDeviceInfo(context.request.headers.get("user-agent") || undefined)
					: undefined;
				const ipAddress = context.request
					? getClientIP(context.request)
					: undefined;

				const { session, tokens } = await createSession(
					user,
					config,
					deviceInfo,
					ipAddress
				);

				return {
					success: true,
					user,
					tokens,
					error: null,
				};
			} catch (error) {
				return {
					success: false,
					user: null,
					tokens: null,
					error: error instanceof Error ? error.message : "OAuth completion failed",
				};
			}
		},
	}),

	/**
	 * Request magic link
	 */
	requestMagicLink: t.field({
		type: MagicLinkResultType,
		args: {
			email: t.arg.string({ required: true }),
		},
		description: "Request a magic link to be sent to the specified email",
		resolve: async (_parent, args, _context) => {
			const config = getAuthConfigSafe();
			if (!config) {
				return { success: false, message: "Authentication is not configured" };
			}

			// Rate limit by email
			const rateLimitKey = RATE_LIMIT_KEYS.magicLink(args.email);
			const rateCheck = checkRateLimit(rateLimitKey, RATE_LIMIT_CONFIGS.magicLink);

			if (!rateCheck.allowed) {
				return {
					success: false,
					message: `Too many requests. Please try again in ${Math.ceil((rateCheck.retryAfterMs || 0) / 60000)} minutes.`,
				};
			}

			const result = await requestMagicLink(
				args.email,
				config.oauthCallbackUrl.replace("/auth/callback", "")
			);

			recordAttempt(rateLimitKey, RATE_LIMIT_CONFIGS.magicLink, result.success);

			return result;
		},
	}),

	/**
	 * Verify magic link
	 */
	verifyMagicLink: t.field({
		type: AuthResultType,
		args: {
			token: t.arg.string({ required: true }),
		},
		description: "Verify a magic link token and create a session",
		resolve: async (_parent, args, context) => {
			const config = getAuthConfigSafe();
			if (!config) {
				return { success: false, user: null, tokens: null, error: "Authentication is not configured" };
			}

			// Verify token
			const tokenRecord = verifyMagicLinkToken(args.token);
			if (!tokenRecord) {
				return {
					success: false,
					user: null,
					tokens: null,
					error: "Invalid or expired magic link",
				};
			}

			// Consume the token
			if (!consumeMagicLinkToken(args.token)) {
				return {
					success: false,
					user: null,
					tokens: null,
					error: "Magic link has already been used",
				};
			}

			// Find or create user
			let user = getUserByEmail(tokenRecord.email);
			if (!user) {
				user = createUser(tokenRecord.email, null, null);
			}

			// Create session
			const deviceInfo = context.request
				? parseDeviceInfo(context.request.headers.get("user-agent") || undefined)
				: undefined;
			const ipAddress = context.request
				? getClientIP(context.request)
				: undefined;

			const { session, tokens } = await createSession(
				user,
				config,
				deviceInfo,
				ipAddress
			);

			return {
				success: true,
				user,
				tokens,
				error: null,
			};
		},
	}),

	/**
	 * Refresh session
	 */
	refreshSession: t.field({
		type: AuthResultType,
		args: {
			refreshToken: t.arg.string({ required: true }),
		},
		description: "Refresh an existing session using a refresh token",
		resolve: async (_parent, args, _context) => {
			const config = getAuthConfigSafe();
			if (!config) {
				return { success: false, user: null, tokens: null, error: "Authentication is not configured" };
			}

			const tokens = await refreshSession(args.refreshToken, config);
			if (!tokens) {
				return {
					success: false,
					user: null,
					tokens: null,
					error: "Invalid or expired refresh token",
				};
			}

			return {
				success: true,
				user: null, // User info not returned on refresh
				tokens,
				error: null,
			};
		},
	}),

	/**
	 * Revoke session
	 */
	revokeSession: t.field({
		type: "Boolean",
		args: {
			sessionId: t.arg.id({ required: true }),
		},
		description: "Revoke a specific session",
		resolve: (_parent, args, context) => {
			// Get current user from context (would need to be implemented with actual auth)
			// For now, we'll need the user ID to be passed or extracted from context
			const authContext = (context as any).auth;
			if (!authContext?.user) {
				throw new Error("Authentication required");
			}

			return revokeSession(String(args.sessionId), authContext.user.id);
		},
	}),

	/**
	 * Revoke all sessions
	 */
	revokeAllSessions: t.field({
		type: "Boolean",
		description: "Revoke all sessions for the current user",
		resolve: (_parent, _args, context) => {
			const authContext = (context as any).auth;
			if (!authContext?.user) {
				throw new Error("Authentication required");
			}

			const revoked = revokeAllUserSessions(authContext.user.id);
			return revoked > 0;
		},
	}),

	/**
	 * Link OAuth provider to existing account
	 */
	linkOAuthProvider: t.field({
		type: LinkResultType,
		args: {
			provider: t.arg({ type: OAuthProviderEnum, required: true }),
			code: t.arg.string({ required: true }),
			state: t.arg.string({ required: true }),
			codeVerifier: t.arg.string({ required: true }),
		},
		description: "Link an OAuth provider to the current user's account",
		resolve: async (_parent, args, context) => {
			const config = getAuthConfigSafe();
			if (!config) {
				return { success: false, connection: null, error: "Authentication is not configured" };
			}

			const authContext = (context as any).auth;
			if (!authContext?.user) {
				return { success: false, connection: null, error: "Authentication required" };
			}

			try {
				const provider = args.provider as OAuthProvider;
				const _oauthResult = await completeOAuth(
					provider,
					args.code,
					args.codeVerifier,
					config
				);

				// TODO: Store OAuth connection in database
				// For now, return success without actual storage
				return {
					success: true,
					connection: null, // Would return the created connection
					error: null,
				};
			} catch (error) {
				return {
					success: false,
					connection: null,
					error: error instanceof Error ? error.message : "Failed to link provider",
				};
			}
		},
	}),

	/**
	 * Unlink OAuth provider from account
	 */
	unlinkOAuthProvider: t.field({
		type: "Boolean",
		args: {
			connectionId: t.arg.id({ required: true }),
		},
		description: "Remove an OAuth provider connection from the current user's account",
		resolve: (_parent, _args, context) => {
			const authContext = (context as any).auth;
			if (!authContext?.user) {
				throw new Error("Authentication required");
			}

			// TODO: Remove OAuth connection from database
			// For now, return true
			return true;
		},
	}),
}));
