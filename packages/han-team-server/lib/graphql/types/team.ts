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
import { SessionRef, type SessionData } from "./session.ts";

/**
 * Team member role within a team.
 *
 * @description Determines the permissions a user has within a specific team:
 * - `admin`: Can manage team membership and settings
 * - `member`: Standard team member, can view shared sessions
 */
export const TeamRoleEnum = builder.enumType("TeamRole", {
  description: "Role of a user within a team, determining their permissions",
  values: {
    ADMIN: {
      value: "admin",
      description: "Team administrator who can manage members, settings, and invites",
    },
    MEMBER: {
      value: "member",
      description: "Standard team member with access to shared sessions",
    },
  },
});

/**
 * Legacy TeamMemberRole enum for backwards compatibility.
 *
 * @deprecated Use TeamRole instead
 */
export const TeamMemberRoleEnum = builder.enumType("TeamMemberRole", {
  description: "Role of a user within a team, determining their permissions (legacy)",
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
  /** Organization this team belongs to (optional for standalone teams) */
  orgId?: string;
  /** Team display name */
  name: string;
  /** URL-safe slug for the team */
  slug: string;
  /** Team description */
  description: string | null;
  /** When the team was created */
  createdAt: Date;
  /** When the team was last updated */
  updatedAt?: Date;
  /** Whether the team is deleted (soft delete) */
  deletedAt?: Date | null;
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
  role: "admin" | "member";
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
 * Delete team payload data shape.
 */
export interface DeleteTeamPayloadData {
  success: boolean;
  teamId: string;
}

/**
 * Delete team payload object reference.
 */
export const DeleteTeamPayloadRef =
  builder.objectRef<DeleteTeamPayloadData>("DeleteTeamPayload");

/**
 * Remove member payload data shape.
 */
export interface RemoveMemberPayloadData {
  success: boolean;
  teamId: string;
  userId: string;
}

/**
 * Remove member payload object reference.
 */
export const RemoveMemberPayloadRef =
  builder.objectRef<RemoveMemberPayloadData>("RemoveMemberPayload");

/**
 * Team GraphQL type implementation.
 *
 * @description Implements the team entity with member connections.
 * Implements the Relay Node interface for global identification.
 */
export const TeamType = TeamRef.implement({
  description:
    "A team within an organization for grouping users and sharing sessions",
  fields: (t) => ({
    id: t.exposeID("id", {
      description: "Unique team identifier (UUID format)",
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
    myRole: t.field({
      type: TeamRoleEnum,
      description: "The current user's role in this team",
      resolve: async (team, _args, context) => {
        // Return the user's role in this team
        // In a real implementation, this would query team_members
        if (!context.user) {
          throw new Error("Authentication required");
        }

        // Find membership for current user
        const membership = context.user.teamIds?.includes(team.id);
        if (!membership) {
          throw new Error("Not a member of this team");
        }

        // For now, return member role
        // In real implementation, query the database
        return "member";
      },
    }),
    members: t.connection({
      type: TeamMemberRef,
      description: "Members of this team with their roles",
      resolve: async (team, args, context) => {
        // In a real implementation, this would query team_members
        // For now, return empty connection
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
        };
      },
    }),
    sessions: t.connection({
      type: SessionRef,
      description: "Sessions shared with this team",
      resolve: async (team, args, context) => {
        // In a real implementation, this would query synced_sessions
        // For now, return empty connection
        return {
          edges: [],
          pageInfo: {
            hasNextPage: false,
            hasPreviousPage: false,
            startCursor: null,
            endCursor: null,
          },
        };
      },
    }),
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
    user: t.field({
      type: UserRef,
      description: "The user who is a member of this team",
      resolve: (member) => {
        if (member.user) {
          return member.user;
        }
        // Return a stub user - in real implementation would load from DB
        return {
          id: member.userId,
          email: "",
          name: "",
          avatarUrl: null,
          createdAt: new Date(),
          lastLoginAt: null,
        };
      },
    }),
    role: t.field({
      type: TeamRoleEnum,
      description: "User's role within this team",
      resolve: (member) => member.role,
    }),
    joinedAt: t.field({
      type: "DateTime",
      description: "Timestamp when the user joined the team",
      resolve: (member) => member.joinedAt,
    }),
  }),
});

/**
 * Delete team payload type implementation.
 */
export const DeleteTeamPayloadType = DeleteTeamPayloadRef.implement({
  description: "Result of deleting a team",
  fields: (t) => ({
    success: t.exposeBoolean("success", {
      description: "Whether the team was successfully deleted",
    }),
    teamId: t.exposeString("teamId", {
      description: "ID of the deleted team",
    }),
  }),
});

/**
 * Remove member payload type implementation.
 */
export const RemoveMemberPayloadType = RemoveMemberPayloadRef.implement({
  description: "Result of removing a member from a team",
  fields: (t) => ({
    success: t.exposeBoolean("success", {
      description: "Whether the member was successfully removed",
    }),
    teamId: t.exposeString("teamId", {
      description: "ID of the team the member was removed from",
    }),
    userId: t.exposeString("userId", {
      description: "ID of the removed user",
    }),
  }),
});

/**
 * Check if a user is an admin of a team.
 *
 * @param userId - The user ID to check
 * @param teamId - The team ID to check
 * @param db - Database pool for queries
 * @returns Promise<boolean> - true if user is admin
 */
export async function isTeamAdmin(
  userId: string,
  teamId: string,
  db: import("pg").Pool
): Promise<boolean> {
  const result = await db.query(
    `SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2`,
    [userId, teamId]
  );

  if (result.rows.length === 0) {
    return false;
  }

  return result.rows[0].role === "admin";
}

/**
 * Check if a user is a member of a team.
 *
 * @param userId - The user ID to check
 * @param teamId - The team ID to check
 * @param db - Database pool for queries
 * @returns Promise<boolean> - true if user is a member
 */
export async function isTeamMember(
  userId: string,
  teamId: string,
  db: import("pg").Pool
): Promise<boolean> {
  const result = await db.query(
    `SELECT 1 FROM team_members WHERE user_id = $1 AND team_id = $2`,
    [userId, teamId]
  );

  return result.rows.length > 0;
}

/**
 * Get a user's role in a team.
 *
 * @param userId - The user ID to check
 * @param teamId - The team ID to check
 * @param db - Database pool for queries
 * @returns Promise<"admin" | "member" | null> - The user's role or null if not a member
 */
export async function getTeamRole(
  userId: string,
  teamId: string,
  db: import("pg").Pool
): Promise<"admin" | "member" | null> {
  const result = await db.query(
    `SELECT role FROM team_members WHERE user_id = $1 AND team_id = $2`,
    [userId, teamId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  return result.rows[0].role as "admin" | "member";
}

/**
 * Generate a URL-safe slug from a team name.
 *
 * @param name - The team name to convert
 * @returns URL-safe slug
 */
export function generateTeamSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .substring(0, 100);
}
