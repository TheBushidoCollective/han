/**
 * GraphQL User type for team platform
 *
 * Represents a user who can own sessions and belong to organizations.
 * In local mode, these fields are null/empty.
 * In hosted mode, populated from team platform authentication.
 */

import { builder } from "../../builder.ts";

/**
 * User data shape
 */
export interface UserData {
	id: string;
	email: string;
	name: string;
	avatarUrl?: string | null;
}

/**
 * User object reference for lazy type resolution
 */
export const UserRef = builder.objectRef<UserData>("User");

/**
 * User type implementation
 */
export const UserType = UserRef.implement({
	description: "A user in the team platform",
	fields: (t) => ({
		id: t.exposeID("id", { description: "User ID" }),
		email: t.exposeString("email", { description: "User email address" }),
		name: t.exposeString("name", { description: "User display name" }),
		avatarUrl: t.string({
			nullable: true,
			description: "URL to user avatar image",
			resolve: (user) => user.avatarUrl ?? null,
		}),
	}),
});
