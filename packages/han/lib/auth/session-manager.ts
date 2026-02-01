/**
 * Session Manager
 *
 * Handles session CRUD, token refresh, and revocation.
 * Sessions are tracked in the database for revocation support.
 */

import { randomUUID } from "node:crypto";
import { getTokenHash, createTokenPair, verifyRefreshToken } from "./jwt.ts";
import type {
	AuthConfig,
	AuthUser,
	DeviceInfo,
	TokenPair,
	UserSession,
} from "./types.ts";

/**
 * In-memory session store for development
 * In production, this should be backed by a database
 */
const sessionStore = new Map<string, UserSession>();
const sessionsByUser = new Map<string, Set<string>>();
const sessionsByTokenHash = new Map<string, string>();

/**
 * Parse device info from request headers
 *
 * @param userAgent - User-Agent header
 * @returns Parsed device info
 */
export function parseDeviceInfo(userAgent?: string): DeviceInfo {
	if (!userAgent) {
		return {};
	}

	const isMobile =
		/Mobile|Android|iPhone|iPad|iPod|Windows Phone/i.test(userAgent);

	let browser: string | undefined;
	if (/Chrome/i.test(userAgent)) browser = "Chrome";
	else if (/Firefox/i.test(userAgent)) browser = "Firefox";
	else if (/Safari/i.test(userAgent)) browser = "Safari";
	else if (/Edge/i.test(userAgent)) browser = "Edge";

	let platform: string | undefined;
	if (/Windows/i.test(userAgent)) platform = "Windows";
	else if (/Mac/i.test(userAgent)) platform = "macOS";
	else if (/Linux/i.test(userAgent)) platform = "Linux";
	else if (/Android/i.test(userAgent)) platform = "Android";
	else if (/iOS|iPhone|iPad/i.test(userAgent)) platform = "iOS";

	return {
		userAgent,
		platform,
		browser,
		isMobile,
	};
}

/**
 * Create a new session for a user
 *
 * @param user - Authenticated user
 * @param config - Auth configuration
 * @param deviceInfo - Optional device information
 * @param ipAddress - Optional client IP address
 * @returns Session and token pair
 */
export async function createSession(
	user: AuthUser,
	config: AuthConfig,
	deviceInfo?: DeviceInfo,
	ipAddress?: string,
): Promise<{ session: UserSession; tokens: TokenPair }> {
	const sessionId = randomUUID();
	const now = new Date();
	const refreshExpiry = config.refreshTokenExpiry || 604800;

	// Create token pair
	const tokens = await createTokenPair(
		user.id,
		sessionId,
		config,
		user.email || undefined,
	);

	// Create session record
	const session: UserSession = {
		id: sessionId,
		userId: user.id,
		tokenHash: getTokenHash(tokens.refreshToken),
		deviceInfo: deviceInfo as Record<string, unknown> | null,
		ipAddress: ipAddress || null,
		expiresAt: new Date(now.getTime() + refreshExpiry * 1000),
		revokedAt: null,
		createdAt: now,
	};

	// Store session
	sessionStore.set(sessionId, session);

	// Index by user
	if (!sessionsByUser.has(user.id)) {
		sessionsByUser.set(user.id, new Set());
	}
	sessionsByUser.get(user.id)?.add(sessionId);

	// Index by token hash
	sessionsByTokenHash.set(session.tokenHash, sessionId);

	return { session, tokens };
}

/**
 * Get a session by ID
 *
 * @param sessionId - Session ID
 * @returns Session or null
 */
export function getSession(sessionId: string): UserSession | null {
	return sessionStore.get(sessionId) || null;
}

/**
 * Get a session by token hash
 *
 * @param tokenHash - SHA-256 hash of refresh token
 * @returns Session or null
 */
export function getSessionByTokenHash(tokenHash: string): UserSession | null {
	const sessionId = sessionsByTokenHash.get(tokenHash);
	if (!sessionId) return null;
	return sessionStore.get(sessionId) || null;
}

/**
 * Get all sessions for a user
 *
 * @param userId - User ID
 * @returns Array of sessions
 */
export function getUserSessions(userId: string): UserSession[] {
	const sessionIds = sessionsByUser.get(userId);
	if (!sessionIds) return [];

	const sessions: UserSession[] = [];
	for (const id of sessionIds) {
		const session = sessionStore.get(id);
		if (session && !session.revokedAt) {
			sessions.push(session);
		}
	}

	return sessions;
}

/**
 * Check if a session is valid (not expired or revoked)
 *
 * @param session - Session to check
 * @returns true if valid
 */
export function isSessionValid(session: UserSession): boolean {
	if (session.revokedAt) return false;
	if (session.expiresAt < new Date()) return false;
	return true;
}

/**
 * Refresh a session using a refresh token
 *
 * @param refreshToken - Refresh token
 * @param config - Auth configuration
 * @returns New token pair or null if invalid
 */
export async function refreshSession(
	refreshToken: string,
	config: AuthConfig,
): Promise<TokenPair | null> {
	// Verify the refresh token
	const payload = await verifyRefreshToken(refreshToken, config);
	if (!payload) return null;

	// Get the session
	const tokenHash = getTokenHash(refreshToken);
	const session = getSessionByTokenHash(tokenHash);

	if (!session || !isSessionValid(session)) {
		return null;
	}

	// Create new tokens
	const newTokens = await createTokenPair(
		payload.sub,
		session.id,
		config,
		undefined, // Don't include email in refreshed token
	);

	// Update session with new token hash
	const newTokenHash = getTokenHash(newTokens.refreshToken);
	sessionsByTokenHash.delete(session.tokenHash);
	session.tokenHash = newTokenHash;
	sessionsByTokenHash.set(newTokenHash, session.id);

	// Update expiry
	const refreshExpiry = config.refreshTokenExpiry || 604800;
	session.expiresAt = new Date(Date.now() + refreshExpiry * 1000);

	return newTokens;
}

/**
 * Revoke a specific session
 *
 * @param sessionId - Session ID to revoke
 * @param userId - User ID (for authorization)
 * @returns true if revoked
 */
export function revokeSession(sessionId: string, userId: string): boolean {
	const session = sessionStore.get(sessionId);

	if (!session || session.userId !== userId) {
		return false;
	}

	session.revokedAt = new Date();
	return true;
}

/**
 * Revoke all sessions for a user
 *
 * @param userId - User ID
 * @returns Number of sessions revoked
 */
export function revokeAllUserSessions(userId: string): number {
	const sessionIds = sessionsByUser.get(userId);
	if (!sessionIds) return 0;

	let revoked = 0;
	const now = new Date();

	for (const id of sessionIds) {
		const session = sessionStore.get(id);
		if (session && !session.revokedAt) {
			session.revokedAt = now;
			revoked++;
		}
	}

	return revoked;
}

/**
 * Revoke all other sessions for a user (keep current)
 *
 * @param userId - User ID
 * @param currentSessionId - Session to keep
 * @returns Number of sessions revoked
 */
export function revokeOtherUserSessions(
	userId: string,
	currentSessionId: string,
): number {
	const sessionIds = sessionsByUser.get(userId);
	if (!sessionIds) return 0;

	let revoked = 0;
	const now = new Date();

	for (const id of sessionIds) {
		if (id === currentSessionId) continue;

		const session = sessionStore.get(id);
		if (session && !session.revokedAt) {
			session.revokedAt = now;
			revoked++;
		}
	}

	return revoked;
}

/**
 * Clean up expired and revoked sessions
 *
 * @returns Number of sessions cleaned up
 */
export function cleanupSessions(): number {
	const now = new Date();
	let cleaned = 0;

	for (const [id, session] of sessionStore.entries()) {
		// Clean sessions that have been revoked or expired for more than 24 hours
		const shouldClean =
			(session.revokedAt &&
				session.revokedAt.getTime() < now.getTime() - 86400000) ||
			(session.expiresAt.getTime() < now.getTime() - 86400000);

		if (shouldClean) {
			sessionStore.delete(id);
			sessionsByTokenHash.delete(session.tokenHash);

			const userSessions = sessionsByUser.get(session.userId);
			if (userSessions) {
				userSessions.delete(id);
				if (userSessions.size === 0) {
					sessionsByUser.delete(session.userId);
				}
			}

			cleaned++;
		}
	}

	return cleaned;
}

/**
 * Get session statistics (for monitoring)
 */
export function getSessionStats(): {
	totalSessions: number;
	activeSessions: number;
	revokedSessions: number;
	expiredSessions: number;
	uniqueUsers: number;
} {
	const now = new Date();
	let active = 0;
	let revoked = 0;
	let expired = 0;

	for (const session of sessionStore.values()) {
		if (session.revokedAt) {
			revoked++;
		} else if (session.expiresAt < now) {
			expired++;
		} else {
			active++;
		}
	}

	return {
		totalSessions: sessionStore.size,
		activeSessions: active,
		revokedSessions: revoked,
		expiredSessions: expired,
		uniqueUsers: sessionsByUser.size,
	};
}
