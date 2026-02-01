/**
 * GraphQL Access Check Types
 *
 * Types and utilities for permission checking in GraphQL resolvers.
 * Provides field-level authorization for hosted mode.
 */

import type { PermissionResult } from "../../permissions/index.ts";
import { builder, type GraphQLContext } from "../builder.ts";

/**
 * Access check result exposed to GraphQL
 */
export interface AccessCheckData {
	allowed: boolean;
	reason: string;
	accessLevel: string;
}

/**
 * Access Check result type for GraphQL
 */
const AccessCheckRef = builder.objectRef<AccessCheckData>("AccessCheck");

export const AccessCheckType = AccessCheckRef.implement({
	description: "Result of an access permission check",
	fields: (t) => ({
		allowed: t.exposeBoolean("allowed", {
			description: "Whether access is allowed",
		}),
		reason: t.exposeString("reason", {
			description: "Reason for the permission decision",
		}),
		accessLevel: t.exposeString("accessLevel", {
			description: "The access level granted (none, read, write, maintain, admin)",
		}),
	}),
});

/**
 * Check if the current context is in local mode
 */
export function isLocalMode(context: GraphQLContext): boolean {
	return context.mode !== "hosted";
}

/**
 * Check if the current context has an authenticated user
 */
export function hasAuthenticatedUser(context: GraphQLContext): boolean {
	return !!context.user && !!context.permissions;
}

/**
 * Require authentication in hosted mode
 * Throws if not authenticated when needed
 */
export function requireAuth(context: GraphQLContext): void {
	if (isLocalMode(context)) {
		return; // Local mode doesn't need auth
	}

	if (!hasAuthenticatedUser(context)) {
		throw new Error("Authentication required");
	}
}

/**
 * Check session access and throw if denied
 */
export async function requireSessionAccess(
	context: GraphQLContext,
	session: { sessionId: string; repoRemote?: string; projectPath?: string },
): Promise<void> {
	if (isLocalMode(context)) {
		return; // Local mode allows all access
	}

	if (!context.permissions) {
		throw new Error("Authentication required to access sessions");
	}

	const result = await context.permissions.canViewSession({
		sessionId: session.sessionId,
		repoRemote: session.repoRemote,
		projectPath: session.projectPath,
	});

	if (!result.allowed) {
		throw new Error(`Access denied: ${result.reason}`);
	}
}

/**
 * Check session access and return result (non-throwing)
 */
export async function checkSessionAccess(
	context: GraphQLContext,
	session: { sessionId: string; repoRemote?: string; projectPath?: string },
): Promise<PermissionResult> {
	if (isLocalMode(context)) {
		return {
			allowed: true,
			accessLevel: "admin",
			reason: "Local mode - all access allowed",
			source: "override",
		};
	}

	if (!context.permissions) {
		return {
			allowed: false,
			accessLevel: "none",
			reason: "Authentication required",
			source: "default",
		};
	}

	return context.permissions.canViewSession({
		sessionId: session.sessionId,
		repoRemote: session.repoRemote,
		projectPath: session.projectPath,
	});
}

/**
 * Filter a list of sessions based on access
 * Only checks in hosted mode
 */
export async function filterSessionsByAccess<
	T extends { sessionId: string; repoRemote?: string; projectPath?: string },
>(context: GraphQLContext, sessions: T[]): Promise<T[]> {
	if (isLocalMode(context)) {
		return sessions; // Local mode - return all
	}

	if (!context.permissions) {
		return []; // No auth - return none
	}

	const results = await Promise.all(
		sessions.map(async (session) => {
			const result = await context.permissions?.canViewSession({
				sessionId: session.sessionId,
				repoRemote: session.repoRemote,
				projectPath: session.projectPath,
			});
			return { session, allowed: result.allowed };
		}),
	);

	return results.filter((r) => r.allowed).map((r) => r.session);
}
