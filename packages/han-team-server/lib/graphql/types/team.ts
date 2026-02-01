/**
 * GraphQL Team Type
 *
 * Represents a team within an organization. Teams group users together
 * for sharing sessions and collaborative analytics viewing.
 *
 * @description Teams are the primary unit of session sharing. When a user
 * shares a session, they can choose which teams have access. Team members
 * can view shared sessions and their analytics.
 */

import { builder } from "../builder.ts";
import { UserRef, type UserData } from "./user.ts";

/**
 * Team member role within a team.
 *
 * @description Determines the permissions a user has within a specific team:
 * - `owner`: Created the team, can delete it and manage all members
 * - `admin`: Can manage team membership and settings
 * - `member`: Standard team member, can view shared sessions
 */
export const TeamMemberRoleEnum = builder.enumType("TeamMemberRole", {
  description: "Role of a user within a team, determining their permissions",
  values: {
    OWNER: {
      value: "owner",
      description: "Team owner with full administrative control",
    },
    ADMIN: {
      value: "admin",
      description: "Team administrator who can manage members and settings",
    },
    MEMBER: {
      value: "member",
      description: "Standard team member with access to shared sessions",
    },
  },
});

/**
 * Team data shape from the database.
 *
 * @description Maps to the `teams` table in PostgreSQL.
 */
export interface TeamData {
  /** Unique team identifier (UUID) */
  id: string;
  /** Organization this team belongs to */
  orgId: string;
  /** Team display name */
  name: string;
  /** URL-safe slug for the team */
  slug: string;
  /** Team description */
  description: string | null;
  /** When the team was created */
  createdAt: Date;
}

/**
 * Team membership data shape.
 *
 * @description Maps to the `team_members` junction table in PostgreSQL.
 */
export interface TeamMemberData {
  /** Unique membership identifier */
  id: string;
  /** User who is a member */
  userId: string;
  /** Team the user belongs to */
  teamId: string;
  /** User's role within the team */
  role: "owner" | "admin" | "member";
  /** When the user joined the team */
  joinedAt: Date;
  /** User data (populated via join) */
  user?: UserData;
}

/**
 * Team object reference for lazy type resolution.
 */
export const TeamRef = builder.objectRef<TeamData>("Team");

/**
 * Team member object reference.
 */
export const TeamMemberRef = builder.objectRef<TeamMemberData>("TeamMember");

/**
 * Team GraphQL type implementation.
 *
 * @description Implements the team entity with member connections.
 * Teams belong to an organization and contain multiple members.
 */
export const TeamType = TeamRef.implement({
  description:
    "A team within an organization for grouping users and sharing sessions",
  fields: (t) => ({
    id: t.exposeID("id", {
      description: "Unique team identifier (UUID format)",
    }),
    orgId: t.exposeString("orgId", {
      description: "ID of the organization this team belongs to",
    }),
    name: t.exposeString("name", {
      description: "Team display name shown in the UI",
    }),
    slug: t.exposeString("slug", {
      description:
        "URL-safe team slug for use in URLs (e.g., 'engineering-core')",
    }),
    description: t.string({
      nullable: true,
      description: "Optional team description explaining its purpose",
      resolve: (team) => team.description,
    }),
    createdAt: t.field({
      type: "DateTime",
      description: "Timestamp when the team was created",
      resolve: (team) => team.createdAt,
    }),
    // Note: members connection would be added with actual resolver
    // that queries the team_members junction table
  }),
});

/**
 * Team member GraphQL type implementation.
 *
 * @description Represents a user's membership in a team, including their role
 * and when they joined.
 */
export const TeamMemberType = TeamMemberRef.implement({
  description: "A user's membership in a team with their role and join date",
  fields: (t) => ({
    id: t.exposeID("id", {
      description: "Unique membership identifier",
    }),
    userId: t.exposeString("userId", {
      description: "ID of the user who is a member",
    }),
    teamId: t.exposeString("teamId", {
      description: "ID of the team the user belongs to",
    }),
    role: t.field({
      type: TeamMemberRoleEnum,
      description: "User's role within this team",
      resolve: (member) => member.role,
    }),
    joinedAt: t.field({
      type: "DateTime",
      description: "Timestamp when the user joined the team",
      resolve: (member) => member.joinedAt,
    }),
    user: t.field({
      type: UserRef,
      nullable: true,
      description: "The user who is a member of this team",
      resolve: (member) => member.user ?? null,
    }),
  }),
});
