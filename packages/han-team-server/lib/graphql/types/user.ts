/**
 * GraphQL User Type
 *
 * Represents a user in the Han Team Platform. Users belong to organizations
 * and can view sessions shared within their teams.
 *
 * @description Users are authenticated via OAuth or magic link. Each user has:
 * - A unique ID and email address
 * - Display name and optional avatar
 * - Role-based permissions within their organization
 * - Access to sessions based on team membership
 */

import { builder } from "../builder.ts";

/**
 * User tier enum for subscription levels.
 */
export const UserTierEnum = builder.enumType("UserTier", {
  description: "Subscription tier for a user account",
  values: {
    FREE: {
      value: "free",
      description: "Free tier with limited features",
    },
    PRO: {
      value: "pro",
      description: "Pro tier with extended features",
    },
    TEAM: {
      value: "team",
      description: "Team tier with collaboration features",
    },
    ENTERPRISE: {
      value: "enterprise",
      description: "Enterprise tier with full features",
    },
  },
});

/**
 * User data shape from the database.
 *
 * @description Maps to the `users` table in PostgreSQL.
 */
export interface UserData {
  /** Unique user identifier (UUID) */
  id: string;
  /** User's email address (unique) */
  email: string;
  /** User's display name */
  name: string;
  /** GitHub ID for OAuth users */
  githubId?: string;
  /** GitHub username for OAuth users */
  githubUsername?: string;
  /** URL to user's avatar image */
  avatarUrl: string | null;
  /** User's subscription tier */
  tier?: "free" | "pro" | "team" | "enterprise";
  /** When the user account was created */
  createdAt: Date;
  /** When the user last logged in */
  lastLoginAt: Date | null;
}

/**
 * Team membership data for user's teams field.
 */
export interface TeamMembershipData {
  /** Team ID */
  teamId: string;
  /** Team name */
  teamName: string;
  /** User's role in the team */
  role: "admin" | "member";
  /** When the user joined the team */
  joinedAt: Date;
}

/**
 * User object reference for lazy type resolution.
 */
export const UserRef = builder.objectRef<UserData>("User");

/**
 * Team membership object reference.
 */
export const TeamMembershipRef =
  builder.objectRef<TeamMembershipData>("TeamMembership");

/**
 * Team membership type for user's teams list.
 */
export const TeamMembershipType = TeamMembershipRef.implement({
  description: "A user's membership in a team",
  fields: (t) => ({
    teamId: t.exposeString("teamId", {
      description: "ID of the team",
    }),
    teamName: t.exposeString("teamName", {
      description: "Name of the team",
    }),
    role: t.string({
      description: "User's role in the team",
      resolve: (membership) => membership.role,
    }),
    joinedAt: t.field({
      type: "DateTime",
      description: "When the user joined the team",
      resolve: (membership) => membership.joinedAt,
    }),
  }),
});

/**
 * User GraphQL type implementation.
 *
 * @description Implements the Relay Node interface for global identification.
 * All fields have descriptions for schema documentation.
 */
export const UserType = UserRef.implement({
  description:
    "A user account in the Han Team Platform. Users authenticate via OAuth or magic link and can view sessions shared within their teams.",
  fields: (t) => ({
    id: t.exposeID("id", {
      description: "Unique user identifier (UUID format)",
    }),
    email: t.exposeString("email", {
      description:
        "User's email address, used for authentication and notifications",
    }),
    name: t.exposeString("name", {
      description: "User's display name shown in the UI",
    }),
    githubUsername: t.string({
      nullable: true,
      description: "User's GitHub username if authenticated via GitHub OAuth",
      resolve: (user) => user.githubUsername ?? null,
    }),
    displayName: t.string({
      nullable: true,
      description: "User's custom display name (alias for name field)",
      resolve: (user) => user.name || null,
    }),
    avatarUrl: t.string({
      nullable: true,
      description:
        "URL to user's avatar image, typically from OAuth provider or Gravatar",
      resolve: (user) => user.avatarUrl,
    }),
    // tier field is defined in billing.ts with BillingService lookup
    createdAt: t.field({
      type: "DateTime",
      description: "Timestamp when the user account was created",
      resolve: (user) => user.createdAt,
    }),
    lastLoginAt: t.field({
      type: "DateTime",
      nullable: true,
      description:
        "Timestamp of the user's most recent login, null if never logged in",
      resolve: (user) => user.lastLoginAt,
    }),
    teams: t.field({
      type: [TeamMembershipRef],
      description: "Teams the user belongs to with their roles",
      resolve: async (user, _args, context) => {
        // In a real implementation, this would query team_members
        // joined with teams table
        // For now, return empty array
        return [];
      },
    }),
  }),
});

/**
 * Get a user by ID from the database.
 *
 * @param userId - The user ID to fetch
 * @param db - Database pool for queries
 * @returns Promise<UserData | null>
 */
export async function getUserById(
  userId: string,
  db: import("pg").Pool
): Promise<UserData | null> {
  const result = await db.query(
    `SELECT id, email, name, github_id, github_username, avatar_url, created_at, updated_at
     FROM users WHERE id = $1`,
    [userId]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name || row.email.split("@")[0],
    githubId: row.github_id,
    githubUsername: row.github_username,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    lastLoginAt: row.updated_at,
  };
}

/**
 * Get user's team memberships.
 *
 * @param userId - The user ID to fetch teams for
 * @param db - Database pool for queries
 * @returns Promise<TeamMembershipData[]>
 */
export async function getUserTeamMemberships(
  userId: string,
  db: import("pg").Pool
): Promise<TeamMembershipData[]> {
  const result = await db.query(
    `SELECT tm.team_id, t.name as team_name, tm.role, tm.created_at as joined_at
     FROM team_members tm
     JOIN teams t ON t.id = tm.team_id
     WHERE tm.user_id = $1
     ORDER BY tm.created_at DESC`,
    [userId]
  );

  return result.rows.map((row) => ({
    teamId: row.team_id,
    teamName: row.team_name,
    role: row.role as "admin" | "member",
    joinedAt: row.joined_at,
  }));
}

/**
 * Update a user's display name.
 *
 * @param userId - The user ID to update
 * @param displayName - The new display name
 * @param db - Database pool for queries
 * @returns Promise<UserData | null>
 */
export async function updateUserDisplayName(
  userId: string,
  displayName: string | null,
  db: import("pg").Pool
): Promise<UserData | null> {
  const result = await db.query(
    `UPDATE users SET name = COALESCE($2, name), updated_at = NOW()
     WHERE id = $1
     RETURNING id, email, name, github_id, github_username, avatar_url, created_at, updated_at`,
    [userId, displayName]
  );

  if (result.rows.length === 0) {
    return null;
  }

  const row = result.rows[0];
  return {
    id: row.id,
    email: row.email,
    name: row.name || row.email.split("@")[0],
    githubId: row.github_id,
    githubUsername: row.github_username,
    avatarUrl: row.avatar_url,
    createdAt: row.created_at,
    lastLoginAt: row.updated_at,
  };
}
