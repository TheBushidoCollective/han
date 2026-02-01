/**
 * Tests for Token Refresh Endpoint
 *
 * Tests POST /api/v1/auth/refresh for token exchange.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import { Hono } from "hono";

// Set up test environment before imports
process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters-long";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";

import {
  AuthService,
  initAuthService,
  resetAuthService,
} from "../lib/auth/index.ts";
import { registerAuthRoutes } from "../lib/api/auth/index.ts";
import { resetRateLimiter } from "../lib/api/middleware/index.ts";

describe("POST /api/v1/auth/refresh", () => {
  const TEST_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";
  let authService: AuthService;
  let app: Hono;

  beforeEach(() => {
    resetAuthService();
    resetRateLimiter(); // Reset rate limiter between tests
    authService = initAuthService(TEST_SECRET);

    app = new Hono();
    registerAuthRoutes(app);
  });

  afterEach(() => {
    resetAuthService();
    resetRateLimiter();
  });

  describe("successful refresh", () => {
    test("exchanges valid refresh token for access token", async () => {
      const refreshToken = await authService.signRefreshToken("user-123");

      const res = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.access_token).toBeTypeOf("string");
      expect(body.refresh_token).toBeTypeOf("string"); // Token rotation
      expect(body.token_type).toBe("Bearer");
      expect(body.expires_in).toBe(86400); // 24 hours
    });

    test("returns a new refresh token (token rotation)", async () => {
      const refreshToken = await authService.signRefreshToken("user-123");

      // Wait a moment to ensure different iat timestamp
      await new Promise((resolve) => setTimeout(resolve, 1100));

      const res = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();

      // Should return a new refresh token
      expect(body.refresh_token).toBeTypeOf("string");
      expect(body.refresh_token).not.toBe(refreshToken); // Should be different due to new iat

      // New refresh token should be valid
      const result = await authService.verifyRefreshToken(body.refresh_token);
      expect(result.userId).toBe("user-123");
      expect(result.payload.type).toBe("refresh");
    });

    test("returned access token is valid", async () => {
      const refreshToken = await authService.signRefreshToken("user-456");

      const res = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();

      // Verify the returned access token works
      const result = await authService.verifyAccessToken(body.access_token);
      expect(result.userId).toBe("user-456");
      expect(result.payload.type).toBe("access");
    });

    test("preserves user ID in new access token", async () => {
      const userId = "user-with-long-id-12345";
      const refreshToken = await authService.signRefreshToken(userId);

      const res = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      const result = await authService.verifyAccessToken(body.access_token);
      expect(result.userId).toBe(userId);
    });
  });

  describe("missing token", () => {
    test("returns 401 with missing_token for missing body", async () => {
      const res = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({}),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("missing_token");
      expect(body.message).toBe("refresh_token is required in request body");
    });

    test("returns 400 for invalid JSON", async () => {
      const res = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: "not json",
      });

      expect(res.status).toBe(400);

      const body = await res.json();
      expect(body.error).toBe("validation_error");
      expect(body.message).toBe("Invalid JSON body");
    });

    test("returns 401 for null refresh_token", async () => {
      const res = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: null }),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("missing_token");
    });

    test("returns 401 for empty string refresh_token", async () => {
      const res = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: "" }),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("missing_token");
    });
  });

  describe("invalid token", () => {
    test("returns 401 with unauthorized for malformed token", async () => {
      const res = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: "not.a.valid.jwt" }),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("unauthorized");
    });

    test("returns 401 with unauthorized for access token (wrong type)", async () => {
      const accessToken = await authService.signAccessToken("user-123");

      const res = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: accessToken }),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("unauthorized");
      expect(body.message).toBe("Invalid token type. Refresh token required.");
    });

    test("returns 401 with unauthorized for tampered token", async () => {
      const refreshToken = await authService.signRefreshToken("user-123");
      const tamperedToken = refreshToken.slice(0, -10) + "xxxxxxxxxx";

      const res = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: tamperedToken }),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("unauthorized");
    });
  });

  describe("expired token", () => {
    test("returns 401 with token_expired for expired refresh token", async () => {
      const jose = await import("jose");
      const secretKey = new TextEncoder().encode(TEST_SECRET);
      const expiredToken = await new jose.SignJWT({
        sub: "user-123",
        type: "refresh",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 86400 * 35) // 35 days ago
        .setIssuer("han-team-platform")
        .setAudience("han-team-api")
        .setExpirationTime(Math.floor(Date.now() / 1000) - 86400 * 5) // Expired 5 days ago
        .sign(secretKey);

      const res = await app.request("/api/v1/auth/refresh", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ refresh_token: expiredToken }),
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("token_expired");
      expect(body.message).toBe("Refresh token has expired. Please log in again.");
    });
  });
});
