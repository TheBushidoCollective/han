/**
 * GraphQL Organization Type
 *
 * Represents an organization (tenant) in the Han Team Platform.
 * Organizations are the top-level container for teams and sessions.
 *
 * @description Each organization has:
 * - A unique slug for URL routing
 * - One or more teams for grouping users
 * - Members with role-based access
 * - Shared sessions viewable by team members
 *
 * Organizations provide multi-tenancy for enterprise deployments.
 */

import { builder } from "../builder.ts";
import { TeamRef, type TeamData } from "./team.ts";
import { UserRef, type UserData } from "./user.ts";

/**
 * Organization member role.
 *
 * @description Determines organization-wide permissions:
 * - `owner`: Organization owner, typically billing contact
 * - `admin`: Full administrative access
 * - `member`: Standard access to org resources
 * - `viewer`: Read-only access
 */
export const OrgMemberRoleEnum = builder.enumType("OrgMemberRole", {
  description:
    "Role of a user within an organization, determining their permissions",
  values: {
    OWNER: {
      value: "owner",
      description:
        "Organization owner with billing access and full administrative control",
    },
    ADMIN: {
      value: "admin",
      description:
        "Organization administrator who can manage teams and members",
    },
    MEMBER: {
      value: "member",
      description: "Standard organization member",
    },
    VIEWER: {
      value: "viewer",
      description: "Read-only access to organization resources",
    },
  },
});

/**
 * Organization data shape from the database.
 *
 * @description Maps to the `organizations` table in PostgreSQL.
 */
export interface OrgData {
  /** Unique organization identifier (UUID) */
  id: string;
  /** Organization display name */
  name: string;
  /** URL-safe organization slug (globally unique) */
  slug: string;
  /** URL to organization logo */
  logoUrl: string | null;
  /** When the organization was created */
  createdAt: Date;
  /** Billing plan (for subscription management) */
  plan: "free" | "team" | "enterprise";
}

/**
 * Organization membership data shape.
 *
 * @description Maps to the `org_members` junction table in PostgreSQL.
 */
export interface OrgMemberData {
  /** Unique membership identifier */
  id: string;
  /** User who is a member */
  userId: string;
  /** Organization the user belongs to */
  orgId: string;
  /** User's role within the organization */
  role: "owner" | "admin" | "member" | "viewer";
  /** When the user joined the organization */
  joinedAt: Date;
  /** User data (populated via join) */
  user?: UserData;
}

/**
 * Organization object reference for lazy type resolution.
 */
export const OrgRef = builder.objectRef<OrgData>("Organization");

/**
 * Organization member object reference.
 */
export const OrgMemberRef = builder.objectRef<OrgMemberData>("OrgMember");

/**
 * Billing plan enum type.
 *
 * @description Used for displaying and filtering by subscription tier.
 */
export const BillingPlanEnum = builder.enumType("BillingPlan", {
  description: "Subscription plan for an organization",
  values: {
    FREE: {
      value: "free",
      description: "Free tier with limited features and session retention",
    },
    TEAM: {
      value: "team",
      description: "Team plan with full analytics and extended retention",
    },
    ENTERPRISE: {
      value: "enterprise",
      description:
        "Enterprise plan with SSO, audit logs, and unlimited retention",
    },
  },
});

/**
 * Organization GraphQL type implementation.
 *
 * @description Implements the organization entity with team and member relationships.
 * Organizations are the root tenant boundary for all data access.
 */
export const OrgType = OrgRef.implement({
  description:
    "An organization (tenant) in the Han Team Platform containing teams and shared sessions",
  fields: (t) => ({
    id: t.exposeID("id", {
      description: "Unique organization identifier (UUID format)",
    }),
    name: t.exposeString("name", {
      description: "Organization display name",
    }),
    slug: t.exposeString("slug", {
      description:
        "URL-safe organization slug (e.g., 'acme-corp'), globally unique",
    }),
    logoUrl: t.string({
      nullable: true,
      description: "URL to organization logo image",
      resolve: (org) => org.logoUrl,
    }),
    createdAt: t.field({
      type: "DateTime",
      description: "Timestamp when the organization was created",
      resolve: (org) => org.createdAt,
    }),
    plan: t.field({
      type: BillingPlanEnum,
      description: "Current billing plan for the organization",
      resolve: (org) => org.plan,
    }),
    // Note: teams and members connections would be added with actual resolvers
  }),
});

/**
 * Organization member GraphQL type implementation.
 *
 * @description Represents a user's membership in an organization.
 */
export const OrgMemberType = OrgMemberRef.implement({
  description:
    "A user's membership in an organization with their role and join date",
  fields: (t) => ({
    id: t.exposeID("id", {
      description: "Unique membership identifier",
    }),
    userId: t.exposeString("userId", {
      description: "ID of the user who is a member",
    }),
    orgId: t.exposeString("orgId", {
      description: "ID of the organization the user belongs to",
    }),
    role: t.field({
      type: OrgMemberRoleEnum,
      description: "User's role within this organization",
      resolve: (member) => member.role,
    }),
    joinedAt: t.field({
      type: "DateTime",
      description: "Timestamp when the user joined the organization",
      resolve: (member) => member.joinedAt,
    }),
    user: t.field({
      type: UserRef,
      nullable: true,
      description: "The user who is a member of this organization",
      resolve: (member) => member.user ?? null,
    }),
  }),
});
