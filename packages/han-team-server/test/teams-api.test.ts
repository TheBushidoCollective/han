/**
 * Teams API Tests
 *
 * Comprehensive tests for team management, member management,
 * invite functionality, and role-based access control.
 */

import { describe, expect, it, beforeAll, beforeEach } from "bun:test";
import { printSchema, lexicographicSortSchema, execute, parse } from "graphql";
import { schema } from "../lib/graphql/schema.ts";
import type { GraphQLContext, UserContext } from "../lib/graphql/builder.ts";
import {
  generateInviteCode,
  createTeamInvite,
  isInviteValid,
} from "../lib/graphql/types/team-invite.ts";
import { generateTeamSlug } from "../lib/graphql/types/team.ts";

/**
 * Mock database pool with configurable responses for role-based access control testing.
 *
 * Supports mocking:
 * - isTeamAdmin() checks via team_members queries
 * - isTeamMember() checks via team_members queries
 * - getTeamRole() checks via team_members queries
 */
interface MockDbConfig {
  /** Map of user-team pairs to their roles. Key format: "userId:teamId" */
  memberships: Record<string, "admin" | "member">;
}

let mockDbConfig: MockDbConfig = { memberships: {} };

/**
 * Configure the mock database for a test.
 * Call this before executing queries that need specific membership state.
 */
function configureMockDb(config: Partial<MockDbConfig>) {
  mockDbConfig = { memberships: {}, ...config };
}

/**
 * Reset mock database to default state (no memberships).
 */
function resetMockDb() {
  mockDbConfig = { memberships: {} };
}

const mockDb = {
  query: async (sql: string, params: unknown[]) => {
    // Handle team_members queries for role/membership checks
    if (sql.includes("team_members") && sql.includes("user_id") && sql.includes("team_id")) {
      const userId = params[0] as string;
      const teamId = params[1] as string;
      const key = `${userId}:${teamId}`;
      const role = mockDbConfig.memberships[key];

      if (role) {
        // User is a member with this role
        if (sql.includes("SELECT role")) {
          return { rows: [{ role }] };
        }
        // Membership existence check
        return { rows: [{ exists: true }] };
      }
      // Not a member
      return { rows: [] };
    }

    // Default: empty result
    return { rows: [] };
  },
} as unknown as import("pg").Pool;

// Helper to create context with authenticated user
function createAuthContext(
  user: Partial<UserContext> = {}
): GraphQLContext {
  return {
    db: mockDb,
    env: "development",
    user: {
      id: user.id ?? "user-123",
      email: user.email ?? "test@example.com",
      name: user.name ?? "Test User",
      role: user.role ?? "member",
      orgId: user.orgId ?? "org-123",
      teamIds: user.teamIds ?? ["team-123"],
    },
  };
}

// Helper to create unauthenticated context
function createUnauthContext(): GraphQLContext {
  return {
    db: mockDb,
    env: "development",
    user: undefined,
  };
}

// Helper to execute GraphQL queries
async function executeQuery(
  query: string,
  context: GraphQLContext,
  variables: Record<string, unknown> = {}
) {
  const document = parse(query);
  return execute({
    schema,
    document,
    contextValue: context,
    variableValues: variables,
  });
}

describe("Teams API - Schema Structure", () => {
  it("should have Team type with required fields", () => {
    const typeMap = schema.getTypeMap();
    const teamType = typeMap.Team;
    expect(teamType).toBeDefined();

    // biome-ignore lint: Type assertion for testing
    const fields = (teamType as any).getFields();
    expect(fields.id).toBeDefined();
    expect(fields.name).toBeDefined();
    expect(fields.slug).toBeDefined();
    expect(fields.description).toBeDefined();
    expect(fields.createdAt).toBeDefined();
    expect(fields.myRole).toBeDefined();
    expect(fields.members).toBeDefined();
    expect(fields.sessions).toBeDefined();
  });

  it("should have TeamMember type with required fields", () => {
    const typeMap = schema.getTypeMap();
    const memberType = typeMap.TeamMember;
    expect(memberType).toBeDefined();

    // biome-ignore lint: Type assertion for testing
    const fields = (memberType as any).getFields();
    expect(fields.user).toBeDefined();
    expect(fields.role).toBeDefined();
    expect(fields.joinedAt).toBeDefined();
  });

  it("should have TeamInvite type with required fields", () => {
    const typeMap = schema.getTypeMap();
    const inviteType = typeMap.TeamInvite;
    expect(inviteType).toBeDefined();

    // biome-ignore lint: Type assertion for testing
    const fields = (inviteType as any).getFields();
    expect(fields.id).toBeDefined();
    expect(fields.code).toBeDefined();
    expect(fields.teamId).toBeDefined();
    expect(fields.createdBy).toBeDefined();
    expect(fields.createdAt).toBeDefined();
    expect(fields.expiresAt).toBeDefined();
  });

  it("should have TeamRole enum with ADMIN and MEMBER values", () => {
    const typeMap = schema.getTypeMap();
    const roleEnum = typeMap.TeamRole;
    expect(roleEnum).toBeDefined();

    // biome-ignore lint: Type assertion for testing
    const values = (roleEnum as any).getValues().map((v: any) => v.name);
    expect(values).toContain("ADMIN");
    expect(values).toContain("MEMBER");
  });

  it("should have User type with teams field", () => {
    const typeMap = schema.getTypeMap();
    const userType = typeMap.User;
    expect(userType).toBeDefined();

    // biome-ignore lint: Type assertion for testing
    const fields = (userType as any).getFields();
    expect(fields.teams).toBeDefined();
    expect(fields.tier).toBeDefined();
    expect(fields.githubUsername).toBeDefined();
  });
});

describe("Teams API - Query: me", () => {
  it("should return authenticated user", async () => {
    const query = `
      query {
        me {
          id
          email
          name
          tier
        }
      }
    `;

    const result = await executeQuery(query, createAuthContext());

    expect(result.errors).toBeUndefined();
    expect(result.data?.me).toBeDefined();
    expect(result.data?.me.id).toBe("user-123");
    expect(result.data?.me.email).toBe("test@example.com");
    expect(result.data?.me.tier).toBe("FREE");
  });

  it("should throw for unauthenticated user", async () => {
    const query = `
      query {
        me {
          id
        }
      }
    `;

    const result = await executeQuery(query, createUnauthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Authentication required");
  });
});

describe("Teams API - Query: team", () => {
  it("should return null for unauthenticated user", async () => {
    const query = `
      query {
        team(id: "team-123") {
          id
          name
        }
      }
    `;

    const result = await executeQuery(query, createUnauthContext());

    expect(result.errors).toBeUndefined();
    expect(result.data?.team).toBeNull();
  });

  it("should return null for non-member user", async () => {
    const query = `
      query {
        team(id: "other-team") {
          id
          name
        }
      }
    `;

    const result = await executeQuery(
      query,
      createAuthContext({ teamIds: ["team-123"] })
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.team).toBeNull();
  });
});

describe("Teams API - Query: teams", () => {
  it("should require authentication", async () => {
    const query = `
      query {
        teams(first: 10) {
          edges {
            node {
              id
            }
          }
        }
      }
    `;

    const result = await executeQuery(query, createUnauthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Authentication required");
  });

  it("should return Relay connection for authenticated user", async () => {
    const query = `
      query {
        teams(first: 10) {
          edges {
            node {
              id
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
          }
        }
      }
    `;

    const result = await executeQuery(query, createAuthContext());

    expect(result.errors).toBeUndefined();
    expect(result.data?.teams).toBeDefined();
    expect(result.data?.teams.edges).toEqual([]);
    expect(result.data?.teams.pageInfo).toBeDefined();
  });
});

describe("Teams API - Mutation: createTeam", () => {
  it("should require authentication", async () => {
    const mutation = `
      mutation {
        createTeam(name: "My Team") {
          id
          name
        }
      }
    `;

    const result = await executeQuery(mutation, createUnauthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Authentication required");
  });

  it("should create team for authenticated user", async () => {
    const mutation = `
      mutation {
        createTeam(name: "My Team") {
          id
          name
          slug
        }
      }
    `;

    const result = await executeQuery(mutation, createAuthContext());

    expect(result.errors).toBeUndefined();
    expect(result.data?.createTeam).toBeDefined();
    expect(result.data?.createTeam.name).toBe("My Team");
    expect(result.data?.createTeam.slug).toBe("my-team");
    expect(result.data?.createTeam.id).toBeDefined();
  });

  it("should reject empty team name", async () => {
    const mutation = `
      mutation {
        createTeam(name: "") {
          id
        }
      }
    `;

    const result = await executeQuery(mutation, createAuthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Team name is required");
  });

  it("should reject team name over 255 characters", async () => {
    const longName = "a".repeat(256);
    const mutation = `
      mutation CreateTeam($name: String!) {
        createTeam(name: $name) {
          id
        }
      }
    `;

    const result = await executeQuery(mutation, createAuthContext(), {
      name: longName,
    });

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("255 characters or less");
  });
});

describe("Teams API - Mutation: updateTeam", () => {
  it("should require authentication", async () => {
    const mutation = `
      mutation {
        updateTeam(id: "team-123", name: "New Name") {
          id
        }
      }
    `;

    const result = await executeQuery(mutation, createUnauthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Authentication required");
  });

  it("should reject non-member update", async () => {
    resetMockDb();
    const mutation = `
      mutation {
        updateTeam(id: "other-team", name: "New Name") {
          id
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Not a member");
  });

  it("should reject update from regular member (not admin)", async () => {
    // SECURITY TEST: Members should not be able to update team settings
    configureMockDb({
      memberships: { "user-123:team-123": "member" },
    });

    const mutation = `
      mutation {
        updateTeam(id: "team-123", name: "Updated Name") {
          id
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Only team admins can update");
    resetMockDb();
  });

  it("should update team for admin", async () => {
    // SECURITY TEST: Only admins can update team settings
    configureMockDb({
      memberships: { "user-123:team-123": "admin" },
    });

    const mutation = `
      mutation {
        updateTeam(id: "team-123", name: "Updated Name") {
          id
          name
          slug
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.updateTeam.name).toBe("Updated Name");
    expect(result.data?.updateTeam.slug).toBe("updated-name");
    resetMockDb();
  });
});

describe("Teams API - Mutation: deleteTeam", () => {
  it("should require authentication", async () => {
    const mutation = `
      mutation {
        deleteTeam(id: "team-123") {
          success
        }
      }
    `;

    const result = await executeQuery(mutation, createUnauthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Authentication required");
  });

  it("should reject non-member delete", async () => {
    resetMockDb();
    const mutation = `
      mutation {
        deleteTeam(id: "other-team") {
          success
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Not a member");
  });

  it("should reject delete from regular member (not admin)", async () => {
    // SECURITY TEST: Members should not be able to delete teams
    configureMockDb({
      memberships: { "user-123:team-123": "member" },
    });

    const mutation = `
      mutation {
        deleteTeam(id: "team-123") {
          success
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Only team admins can delete");
    resetMockDb();
  });

  it("should delete team for admin", async () => {
    // SECURITY TEST: Only admins can delete teams
    configureMockDb({
      memberships: { "user-123:team-123": "admin" },
    });

    const mutation = `
      mutation {
        deleteTeam(id: "team-123") {
          success
          teamId
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.deleteTeam.success).toBe(true);
    expect(result.data?.deleteTeam.teamId).toBe("team-123");
    resetMockDb();
  });
});

describe("Teams API - Mutation: createTeamInvite", () => {
  it("should require authentication", async () => {
    const mutation = `
      mutation {
        createTeamInvite(teamId: "team-123") {
          code
        }
      }
    `;

    const result = await executeQuery(mutation, createUnauthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Authentication required");
  });

  it("should reject non-member invite creation", async () => {
    resetMockDb();
    const mutation = `
      mutation {
        createTeamInvite(teamId: "other-team") {
          code
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Not a member");
  });

  it("should reject invite creation from regular member (not admin)", async () => {
    // SECURITY TEST: Members should not be able to create invites
    configureMockDb({
      memberships: { "user-123:team-123": "member" },
    });

    const mutation = `
      mutation {
        createTeamInvite(teamId: "team-123") {
          code
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Only team admins can create invites");
    resetMockDb();
  });

  it("should create invite for team admin", async () => {
    // SECURITY TEST: Only admins can create invites
    configureMockDb({
      memberships: { "user-123:team-123": "admin" },
    });

    const mutation = `
      mutation {
        createTeamInvite(teamId: "team-123") {
          id
          code
          teamId
          createdBy
          expiresAt
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ teamIds: ["team-123"] })
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.createTeamInvite).toBeDefined();
    expect(result.data?.createTeamInvite.code).toHaveLength(8);
    expect(result.data?.createTeamInvite.teamId).toBe("team-123");
    expect(result.data?.createTeamInvite.createdBy).toBe("user-123");
    expect(result.data?.createTeamInvite.expiresAt).toBeDefined();
    resetMockDb();
  });
});

describe("Teams API - Mutation: joinTeam", () => {
  it("should require authentication", async () => {
    const mutation = `
      mutation {
        joinTeam(code: "ABCD1234") {
          id
        }
      }
    `;

    const result = await executeQuery(mutation, createUnauthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Authentication required");
  });

  it("should reject invalid code format", async () => {
    const mutation = `
      mutation {
        joinTeam(code: "ABC") {
          id
        }
      }
    `;

    const result = await executeQuery(mutation, createAuthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Invalid invite code format");
  });

  it("should reject non-existent code", async () => {
    const mutation = `
      mutation {
        joinTeam(code: "ABCD1234") {
          id
        }
      }
    `;

    const result = await executeQuery(mutation, createAuthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Invite code not found");
  });
});

describe("Teams API - Mutation: updateTeamMember", () => {
  it("should require authentication", async () => {
    const mutation = `
      mutation {
        updateTeamMember(teamId: "team-123", userId: "user-456", role: MEMBER) {
          role
        }
      }
    `;

    const result = await executeQuery(mutation, createUnauthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Authentication required");
  });

  it("should reject non-member updates", async () => {
    resetMockDb();
    const mutation = `
      mutation {
        updateTeamMember(teamId: "other-team", userId: "user-456", role: MEMBER) {
          role
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Not a member");
  });

  it("should reject role change from regular member (not admin)", async () => {
    // SECURITY TEST: Members should not be able to change roles
    configureMockDb({
      memberships: { "user-123:team-123": "member" },
    });

    const mutation = `
      mutation {
        updateTeamMember(teamId: "team-123", userId: "user-456", role: ADMIN) {
          role
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Only team admins can change member roles");
    resetMockDb();
  });

  it("should reject self role change", async () => {
    // Configure user as admin to pass the admin check
    configureMockDb({
      memberships: { "user-123:team-123": "admin" },
    });

    const mutation = `
      mutation {
        updateTeamMember(teamId: "team-123", userId: "user-123", role: ADMIN) {
          role
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Cannot change your own role");
    resetMockDb();
  });

  it("should update member role for admin", async () => {
    // SECURITY TEST: Only admins can change roles
    configureMockDb({
      memberships: { "user-123:team-123": "admin" },
    });

    const mutation = `
      mutation {
        updateTeamMember(teamId: "team-123", userId: "user-456", role: ADMIN) {
          user {
            id
          }
          role
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.updateTeamMember.role).toBe("ADMIN");
    resetMockDb();
  });
});

describe("Teams API - Mutation: removeTeamMember", () => {
  it("should require authentication", async () => {
    const mutation = `
      mutation {
        removeTeamMember(teamId: "team-123", userId: "user-456") {
          success
        }
      }
    `;

    const result = await executeQuery(mutation, createUnauthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Authentication required");
  });

  it("should reject non-member removal", async () => {
    resetMockDb();
    const mutation = `
      mutation {
        removeTeamMember(teamId: "other-team", userId: "user-456") {
          success
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Not a member");
  });

  it("should reject member removal from regular member (not admin)", async () => {
    // SECURITY TEST: Members should not be able to remove other members
    configureMockDb({
      memberships: { "user-123:team-123": "member" },
    });

    const mutation = `
      mutation {
        removeTeamMember(teamId: "team-123", userId: "user-456") {
          success
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Only team admins can remove members");
    resetMockDb();
  });

  it("should reject self removal", async () => {
    // Configure user as admin to pass the admin check
    configureMockDb({
      memberships: { "user-123:team-123": "admin" },
    });

    const mutation = `
      mutation {
        removeTeamMember(teamId: "team-123", userId: "user-123") {
          success
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Cannot remove yourself");
    resetMockDb();
  });

  it("should remove member for admin", async () => {
    // SECURITY TEST: Only admins can remove members
    configureMockDb({
      memberships: { "user-123:team-123": "admin" },
    });

    const mutation = `
      mutation {
        removeTeamMember(teamId: "team-123", userId: "user-456") {
          success
          teamId
          userId
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeUndefined();
    expect(result.data?.removeTeamMember.success).toBe(true);
    expect(result.data?.removeTeamMember.userId).toBe("user-456");
    resetMockDb();
  });
});

describe("Teams API - Mutation: updateProfile", () => {
  it("should require authentication", async () => {
    const mutation = `
      mutation {
        updateProfile(displayName: "New Name") {
          name
        }
      }
    `;

    const result = await executeQuery(mutation, createUnauthContext());

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Authentication required");
  });

  it("should update display name", async () => {
    const mutation = `
      mutation {
        updateProfile(displayName: "New Name") {
          id
          name
        }
      }
    `;

    const result = await executeQuery(mutation, createAuthContext());

    expect(result.errors).toBeUndefined();
    expect(result.data?.updateProfile.name).toBe("New Name");
  });

  it("should reject display name over 255 characters", async () => {
    const longName = "a".repeat(256);
    const mutation = `
      mutation UpdateProfile($displayName: String) {
        updateProfile(displayName: $displayName) {
          name
        }
      }
    `;

    const result = await executeQuery(mutation, createAuthContext(), {
      displayName: longName,
    });

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("255 characters or less");
  });
});

describe("Teams API - Invite Code Utilities", () => {
  it("should generate 8-character invite code", () => {
    const code = generateInviteCode();
    expect(code).toHaveLength(8);
    // Should only contain unambiguous characters
    expect(code).toMatch(/^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]+$/);
  });

  it("should generate unique invite codes", () => {
    const codes = new Set<string>();
    for (let i = 0; i < 100; i++) {
      codes.add(generateInviteCode());
    }
    // All codes should be unique
    expect(codes.size).toBe(100);
  });

  it("should create invite with 24-hour expiry", () => {
    const invite = createTeamInvite("team-123", "user-123");

    expect(invite.teamId).toBe("team-123");
    expect(invite.createdBy).toBe("user-123");
    expect(invite.code).toHaveLength(8);
    expect(invite.usedAt).toBeNull();
    expect(invite.usedBy).toBeNull();

    // Check expiry is approximately 24 hours in the future
    const diff = invite.expiresAt.getTime() - invite.createdAt.getTime();
    const twentyFourHours = 24 * 60 * 60 * 1000;
    expect(diff).toBe(twentyFourHours);
  });

  it("should validate unexpired invite as valid", () => {
    const invite = createTeamInvite("team-123", "user-123");
    expect(isInviteValid(invite)).toBe(true);
  });

  it("should validate used invite as invalid", () => {
    const invite = createTeamInvite("team-123", "user-123");
    invite.usedAt = new Date();
    invite.usedBy = "other-user";
    expect(isInviteValid(invite)).toBe(false);
  });

  it("should validate expired invite as invalid", () => {
    const invite = createTeamInvite("team-123", "user-123");
    // Set expiry to the past
    invite.expiresAt = new Date(Date.now() - 1000);
    expect(isInviteValid(invite)).toBe(false);
  });
});

describe("Teams API - Team Slug Generation", () => {
  it("should generate lowercase slug", () => {
    expect(generateTeamSlug("My Team")).toBe("my-team");
  });

  it("should replace special characters with hyphens", () => {
    expect(generateTeamSlug("Team @ Corp!")).toBe("team-corp");
  });

  it("should trim leading/trailing hyphens", () => {
    expect(generateTeamSlug("---Team---")).toBe("team");
  });

  it("should collapse multiple hyphens", () => {
    expect(generateTeamSlug("Team    Name")).toBe("team-name");
  });

  it("should truncate long names to 100 characters", () => {
    const longName = "a".repeat(150);
    const slug = generateTeamSlug(longName);
    expect(slug.length).toBeLessThanOrEqual(100);
  });
});

describe("Teams API - Schema SDL", () => {
  it("should include all team mutations in SDL", () => {
    const sortedSchema = lexicographicSortSchema(schema);
    const sdl = printSchema(sortedSchema);

    // Check mutation names exist (format may vary)
    expect(sdl).toContain("createTeam(");
    expect(sdl).toContain("name: String!");
    expect(sdl).toContain("updateTeam(");
    expect(sdl).toContain("deleteTeam(");
    expect(sdl).toContain("createTeamInvite(");
    expect(sdl).toContain("teamId: String!");
    expect(sdl).toContain("joinTeam(");
    expect(sdl).toContain("code: String!");
    expect(sdl).toContain("updateTeamMember(");
    expect(sdl).toContain("removeTeamMember(");
    expect(sdl).toContain("updateProfile(");
  });

  it("should include teams query with Relay connection", () => {
    const sortedSchema = lexicographicSortSchema(schema);
    const sdl = printSchema(sortedSchema);

    expect(sdl).toContain("teams(");
    expect(sdl).toContain("first: Int");
    expect(sdl).toContain("after: String");
    // Pothos generates QueryTeamsConnection instead of TeamConnection
    expect(sdl).toContain("QueryTeamsConnection");
  });
});

/**
 * Security Tests for Role-Based Access Control
 *
 * These tests verify that admin-only operations are properly protected
 * and that regular members cannot perform privileged operations.
 */
describe("Teams API - Security: Role-Based Access Control", () => {
  it("should verify database lookup for membership (IDOR protection)", async () => {
    // SECURITY TEST: Even if headers claim membership, database must verify
    resetMockDb(); // No memberships in database

    const mutation = `
      mutation {
        updateTeam(id: "team-123", name: "Hacked Name") {
          id
        }
      }
    `;

    // User claims to be member via teamIds, but database has no record
    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "attacker", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Not a member");
  });

  it("should prevent privilege escalation via updateTeamMember", async () => {
    // SECURITY TEST: Members cannot promote themselves to admin
    configureMockDb({
      memberships: { "user-123:team-123": "member" },
    });

    const mutation = `
      mutation {
        updateTeamMember(teamId: "team-123", userId: "user-456", role: ADMIN) {
          role
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: "user-123", teamIds: ["team-123"] })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Only team admins can change member roles");
    resetMockDb();
  });

  it("should protect all admin-only mutations from regular members", async () => {
    // SECURITY TEST: Comprehensive check of all admin-only operations
    configureMockDb({
      memberships: { "user-123:team-123": "member" },
    });

    const adminOnlyMutations = [
      {
        name: "updateTeam",
        mutation: `mutation { updateTeam(id: "team-123", name: "New") { id } }`,
        expectedError: "Only team admins can update",
      },
      {
        name: "deleteTeam",
        mutation: `mutation { deleteTeam(id: "team-123") { success } }`,
        expectedError: "Only team admins can delete",
      },
      {
        name: "createTeamInvite",
        mutation: `mutation { createTeamInvite(teamId: "team-123") { code } }`,
        expectedError: "Only team admins can create invites",
      },
      {
        name: "updateTeamMember",
        mutation: `mutation { updateTeamMember(teamId: "team-123", userId: "user-456", role: ADMIN) { role } }`,
        expectedError: "Only team admins can change member roles",
      },
      {
        name: "removeTeamMember",
        mutation: `mutation { removeTeamMember(teamId: "team-123", userId: "user-456") { success } }`,
        expectedError: "Only team admins can remove members",
      },
    ];

    for (const { mutation, expectedError } of adminOnlyMutations) {
      const result = await executeQuery(
        mutation,
        createAuthContext({ id: "user-123", teamIds: ["team-123"] })
      );

      expect(result.errors).toBeDefined();
      expect(result.errors?.[0].message).toContain(expectedError);
    }

    resetMockDb();
  });
});

/**
 * Security Tests for Invite Code Protection
 *
 * These tests verify rate limiting and lockout mechanisms for invite codes.
 */
describe("Teams API - Security: Invite Code Protection", () => {
  it("should enforce lockout after multiple failed attempts", async () => {
    // Import the lockout utilities
    const { checkInviteLockout, recordInviteFailure, clearInviteLockout } =
      await import("../lib/middleware/rate-limit.ts");

    const testUserId = `lockout-test-${Date.now()}`;

    // Start clean
    clearInviteLockout(testUserId);

    // Record failures up to threshold
    for (let i = 0; i < 4; i++) {
      const result = recordInviteFailure(testUserId);
      expect(result.isLocked).toBe(false);
    }

    // 5th failure should trigger lockout
    const finalResult = recordInviteFailure(testUserId);
    expect(finalResult.isLocked).toBe(true);
    expect(finalResult.retryAfter).toBeGreaterThan(0);

    // Verify lockout status
    const lockoutStatus = checkInviteLockout(testUserId);
    expect(lockoutStatus.isLocked).toBe(true);

    // Cleanup
    clearInviteLockout(testUserId);
  });

  it("should clear lockout after clearInviteLockout is called", async () => {
    const { checkInviteLockout, recordInviteFailure, clearInviteLockout } =
      await import("../lib/middleware/rate-limit.ts");

    const testUserId = `clear-lockout-test-${Date.now()}`;

    // Trigger lockout
    for (let i = 0; i < 5; i++) {
      recordInviteFailure(testUserId);
    }

    const lockedStatus = checkInviteLockout(testUserId);
    expect(lockedStatus.isLocked).toBe(true);

    // Clear the lockout
    clearInviteLockout(testUserId);

    const clearedStatus = checkInviteLockout(testUserId);
    expect(clearedStatus.isLocked).toBe(false);
  });

  it("should report lockout status in joinTeam mutation errors", async () => {
    const { recordInviteFailure, clearInviteLockout } =
      await import("../lib/middleware/rate-limit.ts");

    // Use a unique user ID for this test
    const testUserId = `join-lockout-test-${Date.now()}`;

    // Simulate lockout by recording 5 failures
    for (let i = 0; i < 5; i++) {
      recordInviteFailure(testUserId);
    }

    const mutation = `
      mutation {
        joinTeam(code: "ABCD1234") {
          id
        }
      }
    `;

    const result = await executeQuery(
      mutation,
      createAuthContext({ id: testUserId })
    );

    expect(result.errors).toBeDefined();
    expect(result.errors?.[0].message).toContain("Too many failed attempts");

    // Cleanup
    clearInviteLockout(testUserId);
  });
});
