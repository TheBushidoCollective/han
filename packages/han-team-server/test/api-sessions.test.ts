/**
 * Tests for Session API Endpoints
 */

import { describe, test, expect, beforeEach } from "bun:test";
import { Hono } from "hono";
import { registerSessionRoutes } from "../lib/api/sessions/index.ts";
import {
  getSessionEncryptionService,
  resetSessionEncryptionService,
} from "../lib/services/index.ts";
import { resetEncryptionService } from "../lib/crypto/index.ts";
import { clearSessionStore } from "../lib/api/sessions/session-store.ts";
import { resetRateLimiter } from "../lib/api/middleware/index.ts";

// Set test mode for token validation
process.env.NODE_ENV = "test";

describe("Session API", () => {
  let app: Hono;

  // Test master key (base64 encoded 32 bytes)
  const TEST_MASTER_KEY = Buffer.from(
    "01234567890123456789012345678901"
  ).toString("base64");

  // Test auth tokens
  const USER_TOKEN = "test:user-123:team-456:false";
  const ADMIN_TOKEN = "test:admin-user:team-456:true";
  const OTHER_USER_TOKEN = "test:other-user:other-team:false";

  beforeEach(async () => {
    // Reset singletons
    resetEncryptionService();
    resetSessionEncryptionService();
    clearSessionStore();
    resetRateLimiter();

    // Initialize encryption service
    const encryptionService = getSessionEncryptionService();
    await encryptionService.initialize(TEST_MASTER_KEY);

    // Create app with session routes
    app = new Hono();
    registerSessionRoutes(app);
  });

  describe("POST /api/sessions/sync", () => {
    test("should require authentication", async () => {
      const res = await app.request("/api/sessions/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: "test-session",
          projectPath: "/test/path",
          messages: [],
        }),
      });

      expect(res.status).toBe(401);
    });

    test("should validate request body", async () => {
      const res = await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          // Missing required fields
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation_error");
    });

    test("should sync session successfully", async () => {
      const res = await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "session-sync-test",
          projectPath: "/home/user/project",
          summary: "Test session",
          messages: [
            {
              type: "user",
              content: "Hello",
              timestamp: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.sessionId).toBe("session-sync-test");
      expect(body.encrypted).toBe(true);
    });

    test("should detect and redact secrets", async () => {
      const res = await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "session-with-secrets",
          projectPath: "/home/user/project",
          messages: [
            {
              type: "user",
              content: "My API key is AKIAIOSFODNN7EXAMPLE",
              timestamp: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      });

      expect(res.status).toBe(201);
      const body = await res.json();
      expect(body.secretsRedacted).toBe(true);
      expect(body.redactedSecretTypes).toContain("aws_key");
    });

    test("should prevent another user from overwriting session (IDOR fix)", async () => {
      // First, user-123 syncs a session
      await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "session-owned-by-user-123",
          projectPath: "/home/user/project",
          messages: [],
        }),
      });

      // Now, other-user tries to overwrite it
      const res = await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OTHER_USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "session-owned-by-user-123",
          projectPath: "/home/other/project",
          messages: [{ type: "user", content: "Hijacked!", timestamp: "2024-01-01T00:00:00Z" }],
        }),
      });

      expect(res.status).toBe(403);
      const body = await res.json();
      expect(body.error).toBe("forbidden");
    });

    test("should allow admin to update any session", async () => {
      // First, user-123 syncs a session
      await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "session-admin-can-update",
          projectPath: "/home/user/project",
          messages: [],
        }),
      });

      // Admin can update it
      const res = await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${ADMIN_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "session-admin-can-update",
          projectPath: "/home/admin/project",
          messages: [],
        }),
      });

      expect(res.status).toBe(201);
    });

    test("should enforce input size limits", async () => {
      const res = await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "a".repeat(300), // Exceeds 256 char limit
          projectPath: "/home/user/project",
          messages: [],
        }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("256");
    });
  });

  describe("GET /api/sessions/:id", () => {
    test("should require authentication", async () => {
      const res = await app.request("/api/sessions/session-sync-test");
      expect(res.status).toBe(401);
    });

    test("should return 404 for non-existent session", async () => {
      const res = await app.request("/api/sessions/non-existent", {
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
      });

      expect(res.status).toBe(404);
    });

    test("should retrieve synced session", async () => {
      // First sync a session
      await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "session-retrieve-test",
          projectPath: "/home/user/project",
          messages: [
            {
              type: "user",
              content: "Test message",
              timestamp: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      });

      // Then retrieve it
      const res = await app.request("/api/sessions/session-retrieve-test", {
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sessionId).toBe("session-retrieve-test");
      expect(body.messages).toHaveLength(1);
      expect(body.messages[0].content).toBe("Test message");
    });

    test("should deny access to other user's session", async () => {
      // First sync a session as user-123
      await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "session-access-test",
          projectPath: "/home/user/project",
          messages: [],
        }),
      });

      // Try to retrieve as other-user
      const res = await app.request("/api/sessions/session-access-test", {
        headers: { Authorization: `Bearer ${OTHER_USER_TOKEN}` },
      });

      expect(res.status).toBe(403);
    });

    test("should allow admin access to any session", async () => {
      // First sync a session as user-123
      await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "session-admin-test",
          projectPath: "/home/user/project",
          messages: [],
        }),
      });

      // Retrieve as admin
      const res = await app.request("/api/sessions/session-admin-test", {
        headers: { Authorization: `Bearer ${ADMIN_TOKEN}` },
      });

      expect(res.status).toBe(200);
    });
  });

  describe("GET /api/sessions", () => {
    test("should require authentication", async () => {
      const res = await app.request("/api/sessions");
      expect(res.status).toBe(401);
    });

    test("should list user's sessions", async () => {
      const res = await app.request("/api/sessions", {
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sessions).toBeDefined();
      expect(body.pagination).toBeDefined();
      expect(body.pagination.limit).toBe(20);
    });

    test("should support pagination", async () => {
      const res = await app.request("/api/sessions?limit=5&offset=0", {
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.pagination.limit).toBe(5);
      expect(body.pagination.offset).toBe(0);
    });

    test("should not include encrypted content in list", async () => {
      const res = await app.request("/api/sessions", {
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();

      // Check that sessions don't have encrypted content
      for (const session of body.sessions) {
        expect(session.encryptedContent).toBeUndefined();
        expect(session.messages).toBeUndefined();
        // Should have metadata fields
        expect(session.sessionId).toBeDefined();
        expect(session.projectPath).toBeDefined();
        expect(session.createdAt).toBeDefined();
      }
    });

    test("should only show user's own sessions (not other users)", async () => {
      // Sync as user-123
      await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "user-123-session",
          projectPath: "/home/user/project",
          messages: [],
        }),
      });

      // Sync as other-user
      await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${OTHER_USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "other-user-session",
          projectPath: "/home/other/project",
          messages: [],
        }),
      });

      // List as user-123 - should only see own session
      const res = await app.request("/api/sessions", {
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      const sessionIds = body.sessions.map((s: { sessionId: string }) => s.sessionId);
      expect(sessionIds).toContain("user-123-session");
      expect(sessionIds).not.toContain("other-user-session");
    });
  });

  describe("POST /api/sessions/export", () => {
    // Valid passphrase meeting complexity requirements
    const VALID_PASSPHRASE = "SecureP@ssw0rd1234";

    test("should require authentication", async () => {
      const res = await app.request("/api/sessions/export", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passphrase: VALID_PASSPHRASE }),
      });

      expect(res.status).toBe(401);
    });

    test("should validate passphrase length", async () => {
      const res = await app.request("/api/sessions/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({ passphrase: "short" }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.error).toBe("validation_error");
      expect(body.message).toContain("16");
    });

    test("should require passphrase complexity", async () => {
      // All lowercase, no complexity
      const res = await app.request("/api/sessions/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({ passphrase: "alllowercasepassphrase" }),
      });

      expect(res.status).toBe(400);
      const body = await res.json();
      expect(body.message).toContain("lowercase");
    });

    test("should export sessions with complex passphrase", async () => {
      // First sync a session
      await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "session-export-test",
          projectPath: "/home/user/project",
          messages: [
            {
              type: "user",
              content: "Export test",
              timestamp: "2024-01-01T00:00:00Z",
            },
          ],
        }),
      });

      // Export sessions with complex passphrase
      const res = await app.request("/api/sessions/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          passphrase: VALID_PASSPHRASE,
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.success).toBe(true);
      expect(body.encryptedArchive).toBeDefined();
      expect(body.nonce).toBeDefined();
      expect(body.authTag).toBeDefined();
      expect(body.salt).toBeDefined();
      expect(body.sessionCount).toBeGreaterThan(0);
    });

    test("should export specific sessions", async () => {
      // Sync a session first
      await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "specific-export-test",
          projectPath: "/home/user/project",
          messages: [],
        }),
      });

      const res = await app.request("/api/sessions/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${USER_TOKEN}`,
        },
        body: JSON.stringify({
          passphrase: VALID_PASSPHRASE,
          sessionIds: ["specific-export-test"],
        }),
      });

      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body.sessionCount).toBe(1);
    });
  });

  describe("Rate Limiting", () => {
    test("should include rate limit headers", async () => {
      const res = await app.request("/api/sessions", {
        headers: { Authorization: `Bearer ${USER_TOKEN}` },
      });

      expect(res.status).toBe(200);
      expect(res.headers.get("X-RateLimit-Limit")).toBeDefined();
      expect(res.headers.get("X-RateLimit-Remaining")).toBeDefined();
      expect(res.headers.get("X-RateLimit-Reset")).toBeDefined();
    });

    test("should rate limit export endpoint", async () => {
      // Use a unique user for this rate limit test
      const RATE_LIMIT_USER_TOKEN = "test:rate-limit-user:team-456:false";

      // First sync a session so export has something to export
      await app.request("/api/sessions/sync", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RATE_LIMIT_USER_TOKEN}`,
        },
        body: JSON.stringify({
          sessionId: "rate-limit-test",
          projectPath: "/home/user/project",
          messages: [],
        }),
      });

      // Export 5 times (the limit) - check remaining headers decrease
      let remaining = 5;
      for (let i = 0; i < 5; i++) {
        const exportRes = await app.request("/api/sessions/export", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${RATE_LIMIT_USER_TOKEN}`,
          },
          body: JSON.stringify({ passphrase: "SecureP@ssw0rd1234" }),
        });
        // All 5 should succeed (status 200)
        expect(exportRes.status).toBe(200);
        remaining--;
        expect(exportRes.headers.get("X-RateLimit-Remaining")).toBe(String(remaining));
      }

      // 6th request should be rate limited
      const res = await app.request("/api/sessions/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${RATE_LIMIT_USER_TOKEN}`,
        },
        body: JSON.stringify({ passphrase: "SecureP@ssw0rd1234" }),
      });

      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("rate_limited");
      expect(res.headers.get("Retry-After")).toBeDefined();
    });
  });
});

describe("Security - Token Validation", () => {
  test("should reject test tokens in production mode", async () => {
    // Save original env
    const originalEnv = process.env.NODE_ENV;
    process.env.NODE_ENV = "production";

    const app = new Hono();
    registerSessionRoutes(app);

    const res = await app.request("/api/sessions", {
      headers: { Authorization: "Bearer test:user-123:team-456:true" },
    });

    expect(res.status).toBe(401);

    // Restore env
    process.env.NODE_ENV = originalEnv;
  });
});
