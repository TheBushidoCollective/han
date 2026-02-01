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
  /** URL to user's avatar image */
  avatarUrl: string | null;
  /** When the user account was created */
  createdAt: Date;
  /** When the user last logged in */
  lastLoginAt: Date | null;
}

/**
 * User object reference for lazy type resolution.
 */
export const UserRef = builder.objectRef<UserData>("User");

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
    avatarUrl: t.string({
      nullable: true,
      description:
        "URL to user's avatar image, typically from OAuth provider or Gravatar",
      resolve: (user) => user.avatarUrl,
    }),
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
  }),
});
