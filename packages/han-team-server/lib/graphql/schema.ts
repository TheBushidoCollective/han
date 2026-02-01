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
import { getEncryptionService } from "../crypto/encryption-service.ts";

// Import all types to register them with the builder (side effects)
import {
  ApiInfoType,
  AuthErrorType,
  BaseErrorType,
  BillingInfoType,
  BillingPlanEnum,
CheckoutSessionResultType,
  DeleteTeamPayloadRef,
  DeleteTeamPayloadType,
  ErrorCodeEnum,
  FieldErrorType,
  RemoveMemberPayloadRef,
  RemoveMemberPayloadType,
  TeamInviteRef,
  TeamInviteType,
  TeamMemberRef,
  TeamMemberRoleEnum,
  TeamMemberType,
  TeamMembershipRef,
  TeamMembershipType,
  TeamRef,
  TeamRoleEnum,
  TeamType,
  UserRef,
  UserTierEnum,
  UserType,
  ValidationErrorType,
  OrgMemberRoleEnum,
  OrgMemberType,
  OrgRef,
  OrgType,
  PriceIntervalEnum,
  SessionRef,
  SessionStatusEnum,
  SessionType,
  SessionVisibilityEnum,
SubscriptionStatusEnum,
  createTeamInvite,
  generateTeamSlug,
  getApiInfo,
  isTeamAdmin,
  isTeamMember,
} from "./types/index.ts";

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
 * @description Returns the authenticated user or throws if not authenticated.
 * Use this to get current user details and team memberships.
 */
builder.queryField("me", (t) =>
  t.field({
    type: UserRef,
    description:
      "Get the currently authenticated user. Throws if not authenticated. Returns user with team memberships.",
    resolve: async (_parent, _args, context) => {
      if (!context.user) {
        throw new Error("Authentication required");
      }
      // Return user data from context
      return {
        id: context.user.id,
        email: context.user.email,
        name: context.user.name ?? context.user.email.split("@")[0],
        avatarUrl: null,
        tier: "free" as const,
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

      // In a real implementation, check team membership and query database
      // For now, check if user has team in their teamIds
      if (!context.user.teamIds?.includes(args.id)) {
        return null;
      }

      // Return placeholder team data
      // In real implementation, query the database
      return null;
    },
  })
);

/**
 * Teams query.
 *
 * @description Fetch teams the authenticated user belongs to.
 * Returns a Relay connection.
 */
builder.queryField("teams", (t) =>
  t.connection({
    type: TeamRef,
    description:
      "Get teams the authenticated user belongs to. Returns a Relay connection.",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        throw new Error("Authentication required");
      }

      // In a real implementation, query team_members for user's teams
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
  })
);

/**
 * Session query by ID.
 *
 * @description Fetch a specific session by ID. Requires authentication
 * and appropriate visibility/ownership.
 */
builder.queryField("session", (t) =>
  t.field({
    type: SessionRef,
    nullable: true,
    args: {
      id: t.arg.string({
        required: true,
        description: "Session ID (UUID format, matches local session ID)",
      }),
    },
    description:
      "Get a session by ID. Requires authentication and view permission (owner, team member, or org member based on visibility).",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        return null;
      }
      // Would query database and check visibility
      return null;
    },
  })
);

// =============================================================================
// Root Mutation Fields
// =============================================================================

// Import auth service for token operations
import { getAuthService, AuthError } from "../auth/index.ts";

/**
 * Token refresh mutation result type.
 */
const RefreshTokenResultType = builder.objectType(
  builder.objectRef<{
    accessToken: string;
    refreshToken: string;
    expiresIn: number;
  }>("RefreshTokenResult"),
  {
    description: "Result of a successful token refresh operation",
    fields: (t) => ({
      accessToken: t.exposeString("accessToken", {
        description: "New JWT access token (valid for 24 hours)",
      }),
      refreshToken: t.exposeString("refreshToken", {
        description: "New refresh token (valid for 30 days)",
      }),
      expiresIn: t.exposeInt("expiresIn", {
        description: "Access token expiration time in seconds (86400 = 24 hours)",
      }),
    }),
  }
);

/**
 * Refresh token mutation.
 *
 * @description Exchange a valid refresh token for new access and refresh tokens.
 * This implements token rotation for security - old refresh tokens are invalidated.
 */
builder.mutationField("refreshToken", (t) =>
  t.field({
    type: RefreshTokenResultType,
    nullable: true,
    args: {
      refreshToken: t.arg.string({
        required: true,
        description: "Current refresh token to exchange for new tokens",
      }),
    },
    description:
      "Exchange a refresh token for new access and refresh tokens. Returns null if token is invalid or expired.",
    resolve: async (_parent, args, _context) => {
      try {
        const authService = getAuthService();

        // Verify the refresh token
        const result = await authService.verifyRefreshToken(args.refreshToken);

        // Issue new tokens
        const accessToken = await authService.signAccessToken(
          result.userId,
          result.email
        );
        const newRefreshToken = await authService.signRefreshToken(result.userId);

        return {
          accessToken,
          refreshToken: newRefreshToken,
          expiresIn: 86400, // 24 hours
        };
      } catch (error) {
        if (error instanceof AuthError) {
          // Token is invalid, expired, or wrong type
          console.error(`Token refresh failed: ${error.code} - ${error.message}`);
          return null;
        }
        console.error("Unexpected error during token refresh:", error);
        return null;
      }
    },
  })
);

/**
 * Create team mutation.
 *
 * @description Creates a new team with the authenticated user as admin.
 * Provisions encryption key for the team via EncryptionService.
 */
builder.mutationField("createTeam", (t) =>
  t.field({
    type: TeamRef,
    args: {
      name: t.arg.string({
        required: true,
        description: "Team name (1-255 characters)",
      }),
    },
    description:
      "Create a new team. The authenticated user becomes the team admin. Provisions encryption key for the team.",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        throw new Error("Authentication required");
      }

      // Validate team name
      if (!args.name || args.name.trim().length === 0) {
        throw new Error("Team name is required");
      }
      if (args.name.length > 255) {
        throw new Error("Team name must be 255 characters or less");
      }

      const teamId = crypto.randomUUID();
      const slug = generateTeamSlug(args.name);

      // Provision encryption key for the team
      const encryptionService = getEncryptionService();
      if (encryptionService.isAvailable()) {
        await encryptionService.getOrCreateKey({ teamId });
      }

      // In a real implementation:
      // 1. Insert team into teams table
      // 2. Insert team_members record for creator as admin
      // For now, return the team data
      return {
        id: teamId,
        name: args.name.trim(),
        slug,
        description: null,
        createdAt: new Date(),
      };
    },
  })
);

/**
 * Update team mutation.
 *
 * @description Updates team name/settings. Admin only.
 */
builder.mutationField("updateTeam", (t) =>
  t.field({
    type: TeamRef,
    args: {
      id: t.arg.string({
        required: true,
        description: "Team ID to update",
      }),
      name: t.arg.string({
        required: true,
        description: "New team name",
      }),
    },
    description: "Update team name. Only team admins can update team settings.",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        throw new Error("Authentication required");
      }

      // SECURITY: Verify team membership via database lookup (not just headers)
      const membershipCheck = await isTeamMember(
        context.user.id,
        args.id,
        context.db
      );
      if (!membershipCheck) {
        throw new Error("Not a member of this team");
      }

      // SECURITY: Verify user is admin before allowing update
      const adminCheck = await isTeamAdmin(context.user.id, args.id, context.db);
      if (!adminCheck) {
        throw new Error("Only team admins can update team settings");
      }

      // Validate name
      if (!args.name || args.name.trim().length === 0) {
        throw new Error("Team name is required");
      }

      const slug = generateTeamSlug(args.name);

      // In real implementation, update database
      return {
        id: args.id,
        name: args.name.trim(),
        slug,
        description: null,
        createdAt: new Date(),
      };
    },
  })
);

/**
 * Delete team mutation.
 *
 * @description Soft-deletes a team. Admin only.
 */
builder.mutationField("deleteTeam", (t) =>
  t.field({
    type: DeleteTeamPayloadRef,
    args: {
      id: t.arg.string({
        required: true,
        description: "Team ID to delete",
      }),
    },
    description:
      "Soft-delete a team. Only team admins can delete teams. Sessions are preserved but unlinked.",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        throw new Error("Authentication required");
      }

      // SECURITY: Verify team membership via database lookup (not just headers)
      const membershipCheck = await isTeamMember(
        context.user.id,
        args.id,
        context.db
      );
      if (!membershipCheck) {
        throw new Error("Not a member of this team");
      }

      // SECURITY: Verify user is admin before allowing delete
      const adminCheck = await isTeamAdmin(context.user.id, args.id, context.db);
      if (!adminCheck) {
        throw new Error("Only team admins can delete teams");
      }

      return {
        success: true,
        teamId: args.id,
      };
    },
  })
);

/**
 * Create team invite mutation.
 *
 * @description Creates an invite code valid for 24 hours. Admin only.
 */
builder.mutationField("createTeamInvite", (t) =>
  t.field({
    type: TeamInviteRef,
    args: {
      teamId: t.arg.string({
        required: true,
        description: "Team ID to create invite for",
      }),
    },
    description:
      "Create an invite code for the team. Valid for 24 hours. Only team admins can create invites.",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        throw new Error("Authentication required");
      }

      // SECURITY: Verify team membership via database lookup (not just headers)
      const membershipCheck = await isTeamMember(
        context.user.id,
        args.teamId,
        context.db
      );
      if (!membershipCheck) {
        throw new Error("Not a member of this team");
      }

      // SECURITY: Verify user is admin before allowing invite creation
      const adminCheck = await isTeamAdmin(
        context.user.id,
        args.teamId,
        context.db
      );
      if (!adminCheck) {
        throw new Error("Only team admins can create invites");
      }

      // Create the invite
      const invite = createTeamInvite(args.teamId, context.user.id);

      // In real implementation, save invite to database
      return invite;
    },
  })
);

/**
 * Join team mutation.
 *
 * @description Joins a team using an invite code.
 * SECURITY: Rate limited to 5 attempts/min with lockout after 5 failures.
 */
builder.mutationField("joinTeam", (t) =>
  t.field({
    type: TeamRef,
    args: {
      code: t.arg.string({
        required: true,
        description: "8-character invite code",
      }),
    },
    description:
      "Join a team using an invite code. The code must be valid (not expired or used). Rate limited to prevent brute force attacks.",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        throw new Error("Authentication required");
      }

      // SECURITY: Check if user is locked out due to too many failed attempts
      // Import at module level would be better, but keeping inline for demonstration
      const { checkInviteLockout, recordInviteFailure, clearInviteLockout } =
        await import("../middleware/rate-limit.ts");

      const lockoutStatus = checkInviteLockout(context.user.id);
      if (lockoutStatus.isLocked) {
        throw new Error(
          `Too many failed attempts. Try again in ${lockoutStatus.retryAfter} seconds.`
        );
      }

      // Validate code format
      if (!args.code || args.code.length !== 8) {
        // Record failure for lockout tracking
        const result = recordInviteFailure(context.user.id);
        if (result.isLocked) {
          throw new Error(
            `Too many failed attempts. Account locked for ${result.retryAfter} seconds.`
          );
        }
        throw new Error("Invalid invite code format");
      }

      // In a real implementation:
      // 1. Look up invite by code
      // 2. Check if not expired and not used
      // 3. Look up team
      // 4. Add user as member
      // 5. Mark invite as used
      // 6. On success: clearInviteLockout(context.user.id)

      // For now, record failure and throw since we can't actually look up the invite
      const result = recordInviteFailure(context.user.id);
      if (result.isLocked) {
        throw new Error(
          `Too many failed attempts. Account locked for ${result.retryAfter} seconds.`
        );
      }
      throw new Error("Invite code not found");
    },
  })
);

/**
 * Valid team roles for runtime validation.
 */
const VALID_TEAM_ROLES = ["admin", "member"] as const;

/**
 * Update team member mutation.
 *
 * @description Changes a team member's role. Admin only.
 */
builder.mutationField("updateTeamMember", (t) =>
  t.field({
    type: TeamMemberRef,
    args: {
      teamId: t.arg.string({
        required: true,
        description: "Team ID",
      }),
      userId: t.arg.string({
        required: true,
        description: "User ID to update",
      }),
      role: t.arg({
        type: TeamRoleEnum,
        required: true,
        description: "New role for the user",
      }),
    },
    description:
      "Update a team member's role. Only team admins can change member roles.",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        throw new Error("Authentication required");
      }

      // SECURITY: Runtime validation of role enum to prevent mass assignment
      const roleValue = args.role as string;
      if (!VALID_TEAM_ROLES.includes(roleValue as "admin" | "member")) {
        throw new Error("Invalid role value");
      }

      // SECURITY: Verify team membership via database lookup (not just headers)
      const membershipCheck = await isTeamMember(
        context.user.id,
        args.teamId,
        context.db
      );
      if (!membershipCheck) {
        throw new Error("Not a member of this team");
      }

      // SECURITY: Verify user is admin before allowing role changes
      const adminCheck = await isTeamAdmin(
        context.user.id,
        args.teamId,
        context.db
      );
      if (!adminCheck) {
        throw new Error("Only team admins can change member roles");
      }

      // Can't change own role to prevent lockout
      if (args.userId === context.user.id) {
        throw new Error("Cannot change your own role");
      }

      // In real implementation, update database
      return {
        id: crypto.randomUUID(),
        userId: args.userId,
        teamId: args.teamId,
        role: roleValue as "admin" | "member",
        joinedAt: new Date(),
      };
    },
  })
);

/**
 * Remove team member mutation.
 *
 * @description Removes a member from the team. Admin only.
 */
builder.mutationField("removeTeamMember", (t) =>
  t.field({
    type: RemoveMemberPayloadRef,
    args: {
      teamId: t.arg.string({
        required: true,
        description: "Team ID",
      }),
      userId: t.arg.string({
        required: true,
        description: "User ID to remove",
      }),
    },
    description:
      "Remove a member from the team. Only team admins can remove members.",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        throw new Error("Authentication required");
      }

      // SECURITY: Verify team membership via database lookup (not just headers)
      const membershipCheck = await isTeamMember(
        context.user.id,
        args.teamId,
        context.db
      );
      if (!membershipCheck) {
        throw new Error("Not a member of this team");
      }

      // SECURITY: Verify user is admin before allowing member removal
      const adminCheck = await isTeamAdmin(
        context.user.id,
        args.teamId,
        context.db
      );
      if (!adminCheck) {
        throw new Error("Only team admins can remove members");
      }

      // Can't remove self
      if (args.userId === context.user.id) {
        throw new Error("Cannot remove yourself from the team");
      }

      // In real implementation, delete from team_members
      return {
        success: true,
        teamId: args.teamId,
        userId: args.userId,
      };
    },
  })
);

/**
 * Update profile mutation.
 *
 * @description Updates the authenticated user's display name.
 */
builder.mutationField("updateProfile", (t) =>
  t.field({
    type: UserRef,
    args: {
      displayName: t.arg.string({
        required: false,
        description: "New display name (null to keep current)",
      }),
    },
    description: "Update the authenticated user's profile (display name).",
    resolve: async (_parent, args, context) => {
      // Authentication check
      if (!context.user) {
        throw new Error("Authentication required");
      }

      // Validate display name if provided
      if (args.displayName !== undefined && args.displayName !== null) {
        if (args.displayName.length > 255) {
          throw new Error("Display name must be 255 characters or less");
        }
      }

      // In real implementation, update database
      return {
        id: context.user.id,
        email: context.user.email,
        name: args.displayName ?? context.user.name ?? context.user.email.split("@")[0],
        avatarUrl: null,
        tier: "free" as const,
        createdAt: new Date(),
        lastLoginAt: new Date(),
      };
    },
  })
);

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
  UserTierEnum,
  TeamType,
  TeamMemberType,
  TeamMemberRoleEnum,
  TeamRoleEnum,
  TeamInviteType,
  TeamMembershipType,
  DeleteTeamPayloadType,
  RemoveMemberPayloadType,
  OrgType,
  OrgMemberType,
  OrgMemberRoleEnum,
  BillingPlanEnum,
  SessionType,
  SessionStatusEnum,
  SessionVisibilityEnum,
  ApiInfoType,
  // Billing types
  BillingInfoType,
  CheckoutSessionResultType,
  PriceIntervalEnum,
  SubscriptionStatusEnum,
  UserTierEnum,
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
 * - Team management (create, update, delete, invite, join)
 * - Team member management (update role, remove)
 * - Session viewing and sharing
 * - Structured error handling
 *
 * All types have descriptions for self-documentation via introspection.
 */
export const schema = builder.toSchema();
