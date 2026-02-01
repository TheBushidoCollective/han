/**
 * AuthSession GraphQL Type
 *
 * Represents an active user session.
 */

import { builder } from "../../builder.ts";
import type { UserSession } from "../../../auth/types.ts";
import { getUser } from "../../../auth/middleware.ts";
import { AuthUserRef } from "./auth-user.ts";

/**
 * AuthSession type ref
 */
export const AuthSessionRef = builder.objectRef<UserSession>("AuthSession");

/**
 * AuthSession type implementation
 */
export const AuthSessionTypeImpl = AuthSessionRef.implement({
	description: "An active user session",
	fields: (t) => ({
		id: t.exposeID("id", {
			description: "Unique session identifier",
		}),
		user: t.field({
			type: AuthUserRef,
			description: "The user this session belongs to",
			resolve: (session) => {
				const user = getUser(session.userId);
				if (!user) {
					throw new Error("User not found for session");
				}
				return user;
			},
		}),
		expiresAt: t.field({
			type: "DateTime",
			description: "When this session expires",
			resolve: (session) => session.expiresAt,
		}),
		createdAt: t.field({
			type: "DateTime",
			description: "When this session was created",
			resolve: (session) => session.createdAt,
		}),
		deviceInfo: t.string({
			nullable: true,
			description: "Device information (browser, platform)",
			resolve: (session) => {
				if (!session.deviceInfo) return null;
				const info = session.deviceInfo;
				const parts: string[] = [];
				if (info.browser) parts.push(info.browser as string);
				if (info.platform) parts.push(info.platform as string);
				return parts.length > 0 ? parts.join(" on ") : null;
			},
		}),
		ipAddress: t.string({
			nullable: true,
			description: "IP address of the session",
			resolve: (session) => session.ipAddress,
		}),
		isActive: t.boolean({
			description: "Whether this session is still active",
			resolve: (session) => !session.revokedAt && session.expiresAt > new Date(),
		}),
	}),
});

// Export as named type
export { AuthSessionTypeImpl as AuthSessionType };
