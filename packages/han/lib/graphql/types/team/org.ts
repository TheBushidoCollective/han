/**
 * GraphQL Organization type for team platform
 *
 * Represents an organization that users belong to.
 * Sessions can be scoped to an organization for team viewing.
 */

import { builder } from "../../builder.ts";
import { UserRef, type UserData } from "./user.ts";

/**
 * Organization data shape
 */
export interface OrgData {
	id: string;
	name: string;
	slug: string;
	logoUrl?: string | null;
}

/**
 * Team member role enum
 */
export const TeamMemberRoleEnum = builder.enumType("TeamMemberRole", {
	description: "Role of a team member within an organization",
	values: {
		ADMIN: { value: "admin", description: "Organization administrator" },
		MEMBER: { value: "member", description: "Full team member" },
		VIEWER: { value: "viewer", description: "Read-only viewer" },
	},
});

/**
 * Team member data shape
 */
export interface TeamMemberData {
	id: string;
	userId: string;
	orgId: string;
	role: "admin" | "member" | "viewer";
	user: UserData;
}

/**
 * Organization object reference
 */
export const OrgRef = builder.objectRef<OrgData>("Org");

/**
 * Team member object reference
 */
export const TeamMemberRef = builder.objectRef<TeamMemberData>("TeamMember");

/**
 * Organization type implementation
 */
export const OrgType = OrgRef.implement({
	description: "An organization that users belong to",
	fields: (t) => ({
		id: t.exposeID("id", { description: "Organization ID" }),
		name: t.exposeString("name", { description: "Organization name" }),
		slug: t.exposeString("slug", { description: "URL-safe organization slug" }),
		logoUrl: t.string({
			nullable: true,
			description: "URL to organization logo image",
			resolve: (org) => org.logoUrl ?? null,
		}),
	}),
});

/**
 * Team member type implementation
 */
export const TeamMemberType = TeamMemberRef.implement({
	description: "A member of an organization",
	fields: (t) => ({
		id: t.exposeID("id", { description: "Team member ID" }),
		userId: t.exposeString("userId", { description: "User ID" }),
		orgId: t.exposeString("orgId", { description: "Organization ID" }),
		role: t.field({
			type: TeamMemberRoleEnum,
			description: "Role within the organization",
			resolve: (member) => member.role,
		}),
		user: t.field({
			type: UserRef,
			description: "The user",
			resolve: (member) => member.user,
		}),
	}),
});
