/**
 * Tests for API Middleware
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";
import {
  requireAuth,
  requireDecryptionAccess,
  buildOperationContext,
  hasKeyAccess,
  type AuthenticatedContext,
} from "../lib/api/middleware/decryption-access.ts";
import {
  resetRateLimiter,
  rateLimit,
} from "../lib/api/middleware/rate-limiter.ts";
import {
  errorHandler,
  onErrorHandler,
  ValidationError,
  NotFoundError,
  ForbiddenError,
} from "../lib/api/middleware/error-handler.ts";
import { EncryptionNotAvailableError } from "../lib/crypto/index.ts";
import { DecryptionError } from "../lib/services/index.ts";

// Ensure we're in test mode
process.env.NODE_ENV = "test";

describe("Middleware", () => {
  beforeEach(() => {
    resetRateLimiter();
  });

  describe("requireAuth", () => {
    test("should reject request without authorization header", async () => {
      const app = new Hono();
      app.use("/*", requireAuth);
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test");
      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("unauthorized");
    });

    test("should reject request with invalid token format", async () => {
      const app = new Hono();
      app.use("/*", requireAuth);
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer invalid-token" },
      });
      expect(res.status).toBe(401);
    });

    test("should accept valid test token in test mode", async () => {
      const app = new Hono();
      app.use("/*", requireAuth);
      app.get("/test", (c) => {
        const auth = c.get("auth");
        return c.json({ userId: auth.userId });
      });

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer test:user-123:team-456:false" },
      });
      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.userId).toBe("user-123");
    });

    test("should set operation context", async () => {
      const app = new Hono();
      app.use("/*", requireAuth);
      app.get("/test", (c) => {
        const ctx = c.get("operationContext");
        return c.json({
          userId: ctx.userId,
          teamId: ctx.teamId,
        });
      });

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer test:user-123:team-456:false" },
      });
      const body = await res.json();

      expect(body.userId).toBe("user-123");
      expect(body.teamId).toBe("team-456");
    });

    test("should reject test tokens in production mode", async () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = "production";

      const app = new Hono();
      app.use("/*", requireAuth);
      app.get("/test", (c) => c.json({ ok: true }));

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer test:user-123:team-456:true" },
      });
      expect(res.status).toBe(401);

      process.env.NODE_ENV = originalEnv;
    });
  });

  describe("requireDecryptionAccess", () => {
    test("should allow admin access to any team", async () => {
      const app = new Hono();
      app.use("/*", requireAuth);
      app.get(
        "/team/:teamId",
        requireDecryptionAccess("team"),
        (c) => c.json({ ok: true })
      );

      const res = await app.request("/team/other-team", {
        headers: { Authorization: "Bearer test:admin-user::true" },
      });
      expect(res.status).toBe(200);
    });

    test("should deny non-member access to team", async () => {
      const app = new Hono();
      app.use("/*", requireAuth);
      app.get(
        "/team/:teamId",
        requireDecryptionAccess("team"),
        (c) => c.json({ ok: true })
      );

      const res = await app.request("/team/other-team", {
        headers: { Authorization: "Bearer test:user-123:my-team:false" },
      });
      expect(res.status).toBe(403);
    });

    test("should allow member access to their team", async () => {
      const app = new Hono();
      app.use("/*", requireAuth);
      app.get(
        "/team/:teamId",
        requireDecryptionAccess("team"),
        (c) => c.json({ ok: true })
      );

      const res = await app.request("/team/my-team", {
        headers: { Authorization: "Bearer test:user-123:my-team:false" },
      });
      expect(res.status).toBe(200);
    });
  });

  describe("hasKeyAccess", () => {
    const userAuth: AuthenticatedContext = {
      userId: "user-123",
      teamIds: ["team-456", "team-789"],
      isAdmin: false,
    };

    const adminAuth: AuthenticatedContext = {
      userId: "admin-user",
      teamIds: [],
      isAdmin: true,
    };

    test("should allow access to own user key", async () => {
      const result = await hasKeyAccess(userAuth, "user:user-123");
      expect(result).toBe(true);
    });

    test("should deny access to other user key", async () => {
      const result = await hasKeyAccess(userAuth, "user:other-user");
      expect(result).toBe(false);
    });

    test("should allow access to team key for member", async () => {
      const result = await hasKeyAccess(userAuth, "team:team-456");
      expect(result).toBe(true);
    });

    test("should deny access to non-member team key", async () => {
      const result = await hasKeyAccess(userAuth, "team:other-team");
      expect(result).toBe(false);
    });

    test("should deny global key access to non-admin (security fix)", async () => {
      const result = await hasKeyAccess(userAuth, "global:default");
      expect(result).toBe(false);
    });

    test("should allow global key access to admin", async () => {
      const result = await hasKeyAccess(adminAuth, "global:default");
      expect(result).toBe(true);
    });

    test("should allow admin access to any key", async () => {
      expect(await hasKeyAccess(adminAuth, "user:any-user")).toBe(true);
      expect(await hasKeyAccess(adminAuth, "team:any-team")).toBe(true);
    });
  });

  describe("errorHandler", () => {
    test("should return 400 for ValidationError", async () => {
      const app = new Hono();
      app.onError(onErrorHandler);
      app.get("/test", () => {
        throw new ValidationError("Invalid input");
      });

      const res = await app.request("/test");
      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("validation_error");
      expect(body.message).toBe("Invalid input");
    });

    test("should return 404 for NotFoundError", async () => {
      const app = new Hono();
      app.onError(onErrorHandler);
      app.get("/test", () => {
        throw new NotFoundError("Resource not found");
      });

      const res = await app.request("/test");
      expect(res.status).toBe(404);

      const body = await res.json();
      expect(body.error).toBe("not_found");
    });

    test("should return 403 for ForbiddenError", async () => {
      const app = new Hono();
      app.onError(onErrorHandler);
      app.get("/test", () => {
        throw new ForbiddenError("Access denied");
      });

      const res = await app.request("/test");
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error).toBe("forbidden");
    });

    test("should return 503 for EncryptionNotAvailableError", async () => {
      const app = new Hono();
      app.onError(onErrorHandler);
      app.get("/test", () => {
        throw new EncryptionNotAvailableError("Key not provisioned");
      });

      const res = await app.request("/test");
      expect(res.status).toBe(503);

      const body = await res.json();
      expect(body.error).toBe("service_unavailable");
      // Should not leak internal details
      expect(body.message).not.toContain("Key");
    });

    test("should return 403 for DecryptionError", async () => {
      const app = new Hono();
      app.onError(onErrorHandler);
      app.get("/test", () => {
        throw new DecryptionError("Failed to decrypt");
      });

      const res = await app.request("/test");
      expect(res.status).toBe(403);

      const body = await res.json();
      expect(body.error).toBe("access_denied");
      // Should not leak decryption details
      expect(body.message).not.toContain("decrypt");
    });

    test("should sanitize sensitive error messages", async () => {
      const app = new Hono();
      app.onError(onErrorHandler);
      app.get("/test", () => {
        throw new Error("Database connection failed: password incorrect");
      });

      const res = await app.request("/test");
      expect(res.status).toBe(500);

      const body = await res.json();
      // Should not expose database/password info
      expect(body.message).not.toContain("Database");
      expect(body.message).not.toContain("password");
    });

    test("should include requestId in response", async () => {
      const app = new Hono();
      app.onError(onErrorHandler);
      app.get("/test", () => {
        throw new ValidationError("Test error");
      });

      const res = await app.request("/test", {
        headers: { "x-request-id": "req-12345" },
      });

      const body = await res.json();
      expect(body.requestId).toBe("req-12345");
    });
  });

  describe("IP Address Handling", () => {
    test("should not trust X-Forwarded-For by default", async () => {
      const app = new Hono();
      app.use("/*", requireAuth);
      app.get("/test", (c) => {
        const ctx = c.get("operationContext");
        return c.json({ ipAddress: ctx.ipAddress });
      });

      const res = await app.request("/test", {
        headers: {
          Authorization: "Bearer test:user-123:team-456:false",
          "X-Forwarded-For": "1.2.3.4, 5.6.7.8",
        },
      });

      const body = await res.json();
      // Should NOT use the spoofed IP
      expect(body.ipAddress).not.toBe("1.2.3.4");
      expect(body.ipAddress).toBe("direct-connection");
    });
  });

  describe("Rate Limiting", () => {
    test("should rate limit after max requests", async () => {
      const app = new Hono();
      app.use("/*", requireAuth);
      app.get(
        "/test",
        rateLimit({ maxRequests: 3, windowMs: 60000 }),
        (c) => c.json({ ok: true })
      );

      // First 3 requests should succeed
      for (let i = 0; i < 3; i++) {
        const res = await app.request("/test", {
          headers: { Authorization: "Bearer test:user-123:team-456:false" },
        });
        expect(res.status).toBe(200);
      }

      // 4th request should be rate limited
      const res = await app.request("/test", {
        headers: { Authorization: "Bearer test:user-123:team-456:false" },
      });
      expect(res.status).toBe(429);
      const body = await res.json();
      expect(body.error).toBe("rate_limited");
    });

    test("should include rate limit headers", async () => {
      const app = new Hono();
      app.use("/*", requireAuth);
      app.get(
        "/test",
        rateLimit({ maxRequests: 10, windowMs: 60000 }),
        (c) => c.json({ ok: true })
      );

      const res = await app.request("/test", {
        headers: { Authorization: "Bearer test:user-123:team-456:false" },
      });

      expect(res.headers.get("X-RateLimit-Limit")).toBe("10");
      expect(res.headers.get("X-RateLimit-Remaining")).toBe("9");
      expect(res.headers.get("X-RateLimit-Reset")).toBeDefined();
    });

    test("should rate limit per user", async () => {
      const app = new Hono();
      app.use("/*", requireAuth);
      app.get(
        "/test",
        rateLimit({ maxRequests: 2, windowMs: 60000 }),
        (c) => c.json({ ok: true })
      );

      // User 1 exhausts their limit
      for (let i = 0; i < 2; i++) {
        await app.request("/test", {
          headers: { Authorization: "Bearer test:user-1::false" },
        });
      }

      // User 1 is now rate limited
      const res1 = await app.request("/test", {
        headers: { Authorization: "Bearer test:user-1::false" },
      });
      expect(res1.status).toBe(429);

      // User 2 should still be able to make requests
      const res2 = await app.request("/test", {
        headers: { Authorization: "Bearer test:user-2::false" },
      });
      expect(res2.status).toBe(200);
    });
  });
});
