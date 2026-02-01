/**
 * GraphQL Authentication Middleware
 *
 * Extracts and validates JWT from request headers,
 * populates auth context for resolvers.
 */

import type { GraphQLContext } from "../graphql/builder.ts";
import { verifyAccessToken, extractSessionId } from "./jwt.ts";
import {
	getSession,
	isSessionValid,
	parseDeviceInfo,
} from "./session-manager.ts";
import {
	checkRateLimit,
	recordAttempt,
	RATE_LIMIT_CONFIGS,
	RATE_LIMIT_KEYS,
	getClientIP,
} from "./rate-limiter.ts";
import type { AuthConfig, AuthContext, AuthUser } from "./types.ts";

/**
 * In-memory user store for development
 * In production, this should be backed by a database
 */
const userStore = new Map<string, AuthUser>();

/**
 * Get a user by ID
 */
export function getUser(userId: string): AuthUser | null {
	return userStore.get(userId) || null;
}

/**
 * Create or update a user
 */
export function upsertUser(user: AuthUser): AuthUser {
	userStore.set(user.id, user);
	return user;
}

/**
 * Find user by email
 */
export function getUserByEmail(email: string): AuthUser | null {
	const normalizedEmail = email.toLowerCase();
	for (const user of userStore.values()) {
		if (user.email?.toLowerCase() === normalizedEmail) {
			return user;
		}
	}
	return null;
}

/**
 * Extract bearer token from Authorization header
 */
export function extractBearerToken(request: Request): string | null {
	const authHeader = request.headers.get("authorization");
	if (!authHeader) return null;

	const match = authHeader.match(/^Bearer\s+(.+)$/i);
	return match ? match[1] : null;
}

/**
 * Create auth context from request
 *
 * @param request - HTTP request
 * @param config - Auth configuration
 * @returns Auth context with user and session
 */
export async function createAuthContext(
	request: Request,
	config: AuthConfig,
): Promise<AuthContext> {
	const token = extractBearerToken(request);

	if (!token) {
		return { user: null, session: null };
	}

	// Verify the access token
	const payload = await verifyAccessToken(token, config);
	if (!payload) {
		return { user: null, session: null };
	}

	// Get the session
	const session = getSession(payload.sid);
	if (!session || !isSessionValid(session)) {
		return { user: null, session: null };
	}

	// Get the user
	const user = getUser(payload.sub);
	if (!user) {
		return { user: null, session: null };
	}

	return { user, session };
}

/**
 * GraphQL context factory with auth
 *
 * @param config - Auth configuration
 * @returns Context factory function
 */
export function createContextFactory(config: AuthConfig) {
	return async (request: Request): Promise<Partial<GraphQLContext>> => {
		const auth = await createAuthContext(request, config);

		return {
			request,
			// auth is added separately, loaders are added by the GraphQL handler
		};
	};
}

/**
 * Check if the current request is authenticated
 */
export function isAuthenticated(context: GraphQLContext & { auth?: AuthContext }): boolean {
	return context.auth?.user !== null;
}

/**
 * Get the current user from context (throws if not authenticated)
 */
export function requireAuth(context: GraphQLContext & { auth?: AuthContext }): AuthUser {
	if (!context.auth?.user) {
		throw new Error("Authentication required");
	}
	return context.auth.user;
}

/**
 * Rate limit check for GraphQL mutations
 */
export function checkMutationRateLimit(
	request: Request,
	mutationName: string,
): { allowed: boolean; retryAfterMs?: number } {
	const ip = getClientIP(request);

	// Use different configs based on mutation
	switch (mutationName) {
		case "requestMagicLink": {
			// Rate limit by IP for magic link requests
			const key = RATE_LIMIT_KEYS.oauthInitiate(ip);
			return checkRateLimit(key, RATE_LIMIT_CONFIGS.oauthInitiate);
		}
		case "initiateOAuth": {
			const key = RATE_LIMIT_KEYS.oauthInitiate(ip);
			return checkRateLimit(key, RATE_LIMIT_CONFIGS.oauthInitiate);
		}
		case "refreshSession": {
			// Rate limit is handled by session ID in the mutation itself
			return { allowed: true };
		}
		default:
			return { allowed: true };
	}
}

/**
 * Create a new user from OAuth or magic link
 */
export function createUser(
	email: string | null,
	displayName: string | null,
	avatarUrl: string | null,
): AuthUser {
	const now = new Date();
	const user: AuthUser = {
		id: crypto.randomUUID(),
		email: email?.toLowerCase() || null,
		displayName,
		avatarUrl,
		createdAt: now,
		updatedAt: now,
	};

	userStore.set(user.id, user);
	return user;
}

/**
 * Update user profile
 */
export function updateUser(
	userId: string,
	updates: Partial<Pick<AuthUser, "email" | "displayName" | "avatarUrl">>,
): AuthUser | null {
	const user = userStore.get(userId);
	if (!user) return null;

	if (updates.email !== undefined) {
		user.email = updates.email?.toLowerCase() || null;
	}
	if (updates.displayName !== undefined) {
		user.displayName = updates.displayName;
	}
	if (updates.avatarUrl !== undefined) {
		user.avatarUrl = updates.avatarUrl;
	}

	user.updatedAt = new Date();
	return user;
}

/**
 * Get user statistics (for monitoring)
 */
export function getUserStats(): {
	totalUsers: number;
	usersWithEmail: number;
} {
	let withEmail = 0;

	for (const user of userStore.values()) {
		if (user.email) withEmail++;
	}

	return {
		totalUsers: userStore.size,
		usersWithEmail: withEmail,
	};
}
