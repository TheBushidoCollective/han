/**
 * GraphQL Schema
 *
 * Combines all types and creates the executable schema for the Han Team Server.
 *
 * @description This module:
 * - Imports all GraphQL types to register them with the builder
 * - Defines root Query and Mutation fields
 * - Builds and exports the final executable schema
 *
 * The schema follows GraphQL best practices:
 * - All types have descriptions
 * - All fields have descriptions
 * - All arguments have descriptions
 * - Deprecated fields have deprecation reasons
 * - Authentication requirements are documented
 */

import { builder } from "./builder.ts";

// Import all types to register them with the builder (side effects)
import {
  ApiInfoType,
  AuthErrorType,
  BaseErrorType,
  BillingPlanEnum,
  ErrorCodeEnum,
  FieldErrorType,
  getApiInfo,
  MessageInput,
  OrgMemberRoleEnum,
  OrgMemberType,
  OrgRef,
  OrgType,
  SessionRef,
  SessionStatusEnum,
  SessionType,
  SessionVisibilityEnum,
  SyncSessionInput,
  SyncSessionPayloadType,
  TeamMemberRoleEnum,
  TeamMemberType,
  TeamRef,
  TeamType,
  UserRef,
  UserType,
  ValidationErrorType,
} from "./types/index.ts";

// Import resolvers to register query/mutation fields (side effects)
import "./resolvers/session-resolvers.ts";

// =============================================================================
// Root Query Fields
// =============================================================================

/**
 * API information query.
 *
 * @description Returns metadata about the API including version and features.
 * No authentication required.
 */
builder.queryField("apiInfo", (t) =>
  t.field({
    type: ApiInfoType,
    description:
      "Get API metadata including version, environment, and available features. No authentication required.",
    resolve: (_parent, _args, context) => getApiInfo(context.env),
  })
);

/**
 * Current user query.
 *
 * @description Returns the authenticated user or null if not authenticated.
 * Use this to check authentication status and get user details.
 */
builder.queryField("me", (t) =>
  t.field({
    type: UserRef,
    nullable: true,
    description:
      "Get the currently authenticated user. Returns null if not authenticated. Use this to verify auth status.",
    resolve: async (_parent, _args, context) => {
      if (!context.user) {
        return null;
      }
      // In a real implementation, this would query the database
      // For now, return mock data based on context
      return {
        id: context.user.id,
        email: context.user.email,
        name: context.user.name ?? context.user.email.split("@")[0],
        avatarUrl: null,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };
    },
  })
);

/**
 * Organization query by ID.
 *
 * @description Fetch a specific organization by ID. Requires authentication
 * and membership in the organization.
 */
builder.queryField("organization", (t) =>
  t.field({
    type: OrgRef,
    nullable: true,
    args: {
      id: t.arg.string({
        required: true,
        description: "Organization ID (UUID format)",
      }),
    },
    description:
      "Get an organization by ID. Requires authentication and organization membership.",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        return null;
      }
      // Authorization check (user must be member of org)
      if (context.user.orgId !== args.id) {
        return null;
      }
      // In a real implementation, query the database
      // Return placeholder for now
      return null;
    },
  })
);

/**
 * Team query by ID.
 *
 * @description Fetch a specific team by ID. Requires authentication
 * and team membership.
 */
builder.queryField("team", (t) =>
  t.field({
    type: TeamRef,
    nullable: true,
    args: {
      id: t.arg.string({
        required: true,
        description: "Team ID (UUID format)",
      }),
    },
    description:
      "Get a team by ID. Requires authentication and team membership.",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        return null;
      }
      // Authorization check would verify team membership
      // Return placeholder for now
      return null;
    },
  })
);

// Note: session and sessions queries are defined in resolvers/session-resolvers.ts
// Note: syncSession mutation is defined in resolvers/session-resolvers.ts

// =============================================================================
// Root Mutation Fields
// =============================================================================

/**
 * Update session visibility mutation.
 *
 * @description Change who can view a session. Only the session owner can modify.
 * @deprecated Use updateSessionSharing instead for more granular control
 */
builder.mutationField("updateSessionVisibility", (t) =>
  t.field({
    type: SessionRef,
    nullable: true,
    deprecationReason:
      "Use updateSessionSharing for granular team-level sharing control",
    args: {
      sessionId: t.arg.string({
        required: true,
        description: "ID of the session to update",
      }),
      visibility: t.arg({
        type: SessionVisibilityEnum,
        required: true,
        description: "New visibility setting for the session",
      }),
    },
    description:
      "Update session visibility. Only the session owner can modify. Deprecated: use updateSessionSharing instead.",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        return null;
      }
      // Would verify ownership and update
      return null;
    },
  })
);

// =============================================================================
// Export Schema
// =============================================================================

/**
 * Build and export the GraphQL schema.
 *
 * Export all types to prevent tree shaking (they need to be registered
 * with the builder via side effects).
 */
export {
  // Types
  UserType,
  TeamType,
  TeamMemberType,
  TeamMemberRoleEnum,
  OrgType,
  OrgMemberType,
  OrgMemberRoleEnum,
  BillingPlanEnum,
  SessionType,
  SessionStatusEnum,
  SessionVisibilityEnum,
  ApiInfoType,
  // Sync session types
  MessageInput,
  SyncSessionInput,
  SyncSessionPayloadType,
  // Error types
  ErrorCodeEnum,
  BaseErrorType,
  AuthErrorType,
  ValidationErrorType,
  FieldErrorType,
};

/**
 * The complete GraphQL schema for the Han Team Server.
 *
 * @description This schema includes:
 * - User authentication and profile queries
 * - Organization and team management
 * - Session viewing and sharing
 * - Structured error handling
 *
 * All types have descriptions for self-documentation via introspection.
 */
export const schema = builder.toSchema();
