/**
 * Tests for Session Sync GraphQL Functionality
 *
 * Tests the syncSession mutation, sessions query, and session query.
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { graphql } from "graphql";
import { schema } from "../lib/graphql/schema.ts";
import type { GraphQLContext } from "../lib/graphql/builder.ts";
import {
  getSessionEncryptionService,
  resetSessionEncryptionService,
} from "../lib/services/index.ts";
import { resetEncryptionService } from "../lib/crypto/index.ts";
import { clearSessionStore } from "../lib/api/sessions/session-store.ts";

// Set test mode
process.env.NODE_ENV = "test";

// Test master key (base64 encoded 32 bytes)
const TEST_MASTER_KEY = Buffer.from(
  "01234567890123456789012345678901"
).toString("base64");

// Mock database pool
const mockDb = {} as any;

// Helper to create context
function createContext(user?: {
  id: string;
  email: string;
  role: "admin" | "manager" | "member" | "viewer";
  orgId: string;
  teamIds?: string[];
}): GraphQLContext {
  return {
    db: mockDb,
    user: user
      ? {
          id: user.id,
          email: user.email,
          role: user.role,
          orgId: user.orgId,
          teamIds: user.teamIds,
        }
      : undefined,
    env: "development",
  };
}

describe("Session Sync GraphQL", () => {
  beforeEach(async () => {
    // Reset singletons
    resetEncryptionService();
    resetSessionEncryptionService();
    clearSessionStore();

    // Initialize encryption service
    const encryptionService = getSessionEncryptionService();
    await encryptionService.initialize(TEST_MASTER_KEY);
  });

  describe("syncSession mutation", () => {
    const SYNC_MUTATION = `
      mutation SyncSession($input: SyncSessionInput!) {
        syncSession(input: $input) {
          session {
            id
            ownerId
            projectPath
            status
            visibility
            messageCount
            summary
          }
          secretsRedacted
        }
      }
    `;

    test("should require authentication", async () => {
      const result = await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "test-session-1",
            projectPath: "/home/user/project",
            messages: [],
          },
        },
        contextValue: createContext(),
      });

      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain("Authentication required");
    });

    test("should sync session successfully", async () => {
      const context = createContext({
        id: "user-123",
        email: "user@example.com",
        role: "member",
        orgId: "org-456",
        teamIds: ["team-789"],
      });

      const result = await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "test-session-2",
            projectPath: "/home/user/project",
            summary: "Test session summary",
            messages: [
              {
                type: "user",
                content: "Hello",
                timestamp: "2024-01-01T00:00:00Z",
              },
            ],
          },
        },
        contextValue: context,
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();

      const payload = result.data!.syncSession as any;
      expect(payload.session.id).toBe("test-session-2");
      expect(payload.session.ownerId).toBe("user-123");
      expect(payload.session.projectPath).toBe("/home/user/project");
      expect(payload.session.status).toBe("ACTIVE"); // Enum name, not value
      expect(payload.session.visibility).toBe("PRIVATE"); // Enum name, not value
      expect(payload.session.messageCount).toBe(1);
      expect(payload.session.summary).toBe("Test session summary");
      expect(payload.secretsRedacted).toBe(0);
    });

    test("should detect and redact secrets", async () => {
      const context = createContext({
        id: "user-123",
        email: "user@example.com",
        role: "member",
        orgId: "org-456",
      });

      const result = await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "test-session-secrets",
            projectPath: "/home/user/project",
            messages: [
              {
                type: "user",
                content: "My AWS key is AKIAIOSFODNN7EXAMPLE",
                timestamp: "2024-01-01T00:00:00Z",
              },
            ],
          },
        },
        contextValue: context,
      });

      expect(result.errors).toBeUndefined();
      const payload = result.data!.syncSession as any;
      expect(payload.secretsRedacted).toBeGreaterThan(0);
    });

    test("should validate sessionId length", async () => {
      const context = createContext({
        id: "user-123",
        email: "user@example.com",
        role: "member",
        orgId: "org-456",
      });

      const result = await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "a".repeat(300), // Exceeds 256 char limit
            projectPath: "/home/user/project",
            messages: [],
          },
        },
        contextValue: context,
      });

      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain("256");
    });

    test("should prevent non-owner from updating session", async () => {
      // First, sync as user-123
      const ownerContext = createContext({
        id: "user-123",
        email: "user@example.com",
        role: "member",
        orgId: "org-456",
      });

      await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "owned-session",
            projectPath: "/home/user/project",
            messages: [],
          },
        },
        contextValue: ownerContext,
      });

      // Now try to update as different user
      const otherContext = createContext({
        id: "other-user",
        email: "other@example.com",
        role: "member",
        orgId: "org-456",
      });

      const result = await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "owned-session",
            projectPath: "/home/other/project",
            messages: [],
          },
        },
        contextValue: otherContext,
      });

      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain("permission");
    });

    test("should allow admin to update any session", async () => {
      // First, sync as regular user
      const userContext = createContext({
        id: "user-123",
        email: "user@example.com",
        role: "member",
        orgId: "org-456",
      });

      await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "admin-test-session",
            projectPath: "/home/user/project",
            messages: [],
          },
        },
        contextValue: userContext,
      });

      // Now update as admin
      const adminContext = createContext({
        id: "admin-user",
        email: "admin@example.com",
        role: "admin",
        orgId: "org-456",
      });

      const result = await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "admin-test-session",
            projectPath: "/home/admin/project",
            messages: [],
          },
        },
        contextValue: adminContext,
      });

      expect(result.errors).toBeUndefined();
    });

    test("should handle metadata", async () => {
      const context = createContext({
        id: "user-123",
        email: "user@example.com",
        role: "member",
        orgId: "org-456",
      });

      const result = await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "metadata-session",
            projectPath: "/home/user/project",
            messages: [],
            metadata: {
              gitBranch: "main",
              gitCommit: "abc123",
              inputTokens: 100,
              outputTokens: 200,
            },
          },
        },
        contextValue: context,
      });

      expect(result.errors).toBeUndefined();
      expect(result.data).toBeDefined();
    });
  });

  describe("sessions query", () => {
    const SESSIONS_QUERY = `
      query GetSessions($first: Int, $after: String) {
        sessions(first: $first, after: $after) {
          edges {
            cursor
            node {
              id
              ownerId
              projectPath
            }
          }
          pageInfo {
            hasNextPage
            hasPreviousPage
            startCursor
            endCursor
          }
        }
      }
    `;

    const SYNC_MUTATION = `
      mutation SyncSession($input: SyncSessionInput!) {
        syncSession(input: $input) {
          session { id }
        }
      }
    `;

    test("should require authentication", async () => {
      const result = await graphql({
        schema,
        source: SESSIONS_QUERY,
        contextValue: createContext(),
      });

      expect(result.errors).toBeDefined();
      expect(result.errors![0].message).toContain("Authentication required");
    });

    test("should return empty list for new user", async () => {
      const context = createContext({
        id: "new-user",
        email: "new@example.com",
        role: "member",
        orgId: "org-456",
      });

      const result = await graphql({
        schema,
        source: SESSIONS_QUERY,
        contextValue: context,
      });

      expect(result.errors).toBeUndefined();
      const sessions = result.data!.sessions as any;
      expect(sessions.edges).toHaveLength(0);
      expect(sessions.pageInfo.hasNextPage).toBe(false);
    });

    test("should return user's sessions", async () => {
      const context = createContext({
        id: "user-with-sessions",
        email: "user@example.com",
        role: "member",
        orgId: "org-456",
      });

      // Sync some sessions
      await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "list-session-1",
            projectPath: "/project1",
            messages: [],
          },
        },
        contextValue: context,
      });

      await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "list-session-2",
            projectPath: "/project2",
            messages: [],
          },
        },
        contextValue: context,
      });

      // Query sessions
      const result = await graphql({
        schema,
        source: SESSIONS_QUERY,
        contextValue: context,
      });

      expect(result.errors).toBeUndefined();
      const sessions = result.data!.sessions as any;
      expect(sessions.edges.length).toBeGreaterThanOrEqual(2);
    });

    test("should support pagination", async () => {
      const context = createContext({
        id: "paginated-user",
        email: "paginated@example.com",
        role: "member",
        orgId: "org-456",
      });

      // Sync 5 sessions
      for (let i = 0; i < 5; i++) {
        await graphql({
          schema,
          source: SYNC_MUTATION,
          variableValues: {
            input: {
              sessionId: `page-session-${i}`,
              projectPath: `/project${i}`,
              messages: [],
            },
          },
          contextValue: context,
        });
      }

      // Get first 2
      const firstPage = await graphql({
        schema,
        source: SESSIONS_QUERY,
        variableValues: { first: 2 },
        contextValue: context,
      });

      expect(firstPage.errors).toBeUndefined();
      const firstPageData = firstPage.data!.sessions as any;
      expect(firstPageData.edges).toHaveLength(2);
      expect(firstPageData.pageInfo.hasNextPage).toBe(true);

      // Get next page
      const secondPage = await graphql({
        schema,
        source: SESSIONS_QUERY,
        variableValues: {
          first: 2,
          after: firstPageData.pageInfo.endCursor,
        },
        contextValue: context,
      });

      expect(secondPage.errors).toBeUndefined();
      const secondPageData = secondPage.data!.sessions as any;
      expect(secondPageData.edges).toHaveLength(2);
      expect(secondPageData.pageInfo.hasPreviousPage).toBe(true);
    });

    test("should only show own sessions", async () => {
      const user1Context = createContext({
        id: "user-1",
        email: "user1@example.com",
        role: "member",
        orgId: "org-456",
      });

      const user2Context = createContext({
        id: "user-2",
        email: "user2@example.com",
        role: "member",
        orgId: "org-456",
      });

      // User 1 syncs a session
      await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "user1-session",
            projectPath: "/user1/project",
            messages: [],
          },
        },
        contextValue: user1Context,
      });

      // User 2 syncs a session
      await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "user2-session",
            projectPath: "/user2/project",
            messages: [],
          },
        },
        contextValue: user2Context,
      });

      // User 1 should only see their session
      const user1Sessions = await graphql({
        schema,
        source: SESSIONS_QUERY,
        contextValue: user1Context,
      });

      expect(user1Sessions.errors).toBeUndefined();
      const user1Data = user1Sessions.data!.sessions as any;
      const user1SessionIds = user1Data.edges.map((e: any) => e.node.id);
      expect(user1SessionIds).toContain("user1-session");
      expect(user1SessionIds).not.toContain("user2-session");
    });
  });

  describe("session query", () => {
    const SESSION_QUERY = `
      query GetSession($id: String!) {
        session(id: $id) {
          id
          ownerId
          projectPath
          summary
          messageCount
        }
      }
    `;

    const SYNC_MUTATION = `
      mutation SyncSession($input: SyncSessionInput!) {
        syncSession(input: $input) {
          session { id }
        }
      }
    `;

    test("should return null for unauthenticated user", async () => {
      const result = await graphql({
        schema,
        source: SESSION_QUERY,
        variableValues: { id: "some-session" },
        contextValue: createContext(),
      });

      expect(result.errors).toBeUndefined();
      expect(result.data!.session).toBeNull();
    });

    test("should return null for non-existent session", async () => {
      const context = createContext({
        id: "user-123",
        email: "user@example.com",
        role: "member",
        orgId: "org-456",
      });

      const result = await graphql({
        schema,
        source: SESSION_QUERY,
        variableValues: { id: "non-existent" },
        contextValue: context,
      });

      expect(result.errors).toBeUndefined();
      expect(result.data!.session).toBeNull();
    });

    test("should return session for owner", async () => {
      const context = createContext({
        id: "session-owner",
        email: "owner@example.com",
        role: "member",
        orgId: "org-456",
      });

      // Sync a session
      await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "owner-session",
            projectPath: "/owner/project",
            summary: "Owner's session",
            messages: [
              { type: "user", content: "Hello", timestamp: "2024-01-01T00:00:00Z" },
            ],
          },
        },
        contextValue: context,
      });

      // Query the session
      const result = await graphql({
        schema,
        source: SESSION_QUERY,
        variableValues: { id: "owner-session" },
        contextValue: context,
      });

      expect(result.errors).toBeUndefined();
      const session = result.data!.session as any;
      expect(session).not.toBeNull();
      expect(session.id).toBe("owner-session");
      expect(session.ownerId).toBe("session-owner");
      expect(session.projectPath).toBe("/owner/project");
      expect(session.summary).toBe("Owner's session");
      expect(session.messageCount).toBe(1);
    });

    test("should return null for non-owner without access", async () => {
      const ownerContext = createContext({
        id: "owner-123",
        email: "owner@example.com",
        role: "member",
        orgId: "org-456",
      });

      // Sync a session as owner
      await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "private-session",
            projectPath: "/owner/project",
            messages: [],
          },
        },
        contextValue: ownerContext,
      });

      // Try to access as different user
      const otherContext = createContext({
        id: "other-user",
        email: "other@example.com",
        role: "member",
        orgId: "org-456",
      });

      const result = await graphql({
        schema,
        source: SESSION_QUERY,
        variableValues: { id: "private-session" },
        contextValue: otherContext,
      });

      expect(result.errors).toBeUndefined();
      expect(result.data!.session).toBeNull();
    });

    test("should allow admin to access any session", async () => {
      const userContext = createContext({
        id: "regular-user",
        email: "user@example.com",
        role: "member",
        orgId: "org-456",
      });

      // Sync a session as regular user
      await graphql({
        schema,
        source: SYNC_MUTATION,
        variableValues: {
          input: {
            sessionId: "admin-accessible",
            projectPath: "/user/project",
            messages: [],
          },
        },
        contextValue: userContext,
      });

      // Access as admin
      const adminContext = createContext({
        id: "admin-user",
        email: "admin@example.com",
        role: "admin",
        orgId: "org-456",
      });

      const result = await graphql({
        schema,
        source: SESSION_QUERY,
        variableValues: { id: "admin-accessible" },
        contextValue: adminContext,
      });

      expect(result.errors).toBeUndefined();
      expect(result.data!.session).not.toBeNull();
    });
  });

  describe("Schema validation", () => {
    test("should have syncSession mutation in schema", () => {
      const mutationType = schema.getMutationType();
      expect(mutationType).toBeDefined();
      const fields = mutationType!.getFields();
      expect(fields.syncSession).toBeDefined();
    });

    test("should have sessions query in schema", () => {
      const queryType = schema.getQueryType();
      expect(queryType).toBeDefined();
      const fields = queryType!.getFields();
      expect(fields.sessions).toBeDefined();
    });

    test("should have session query in schema", () => {
      const queryType = schema.getQueryType();
      expect(queryType).toBeDefined();
      const fields = queryType!.getFields();
      expect(fields.session).toBeDefined();
    });

    test("should have SyncSessionPayload type", () => {
      const typeMap = schema.getTypeMap();
      expect(typeMap.SyncSessionPayload).toBeDefined();
    });

    test("should have SyncSessionInput input type", () => {
      const typeMap = schema.getTypeMap();
      expect(typeMap.SyncSessionInput).toBeDefined();
    });

    test("should have MessageInput input type", () => {
      const typeMap = schema.getTypeMap();
      expect(typeMap.MessageInput).toBeDefined();
    });
  });
});
