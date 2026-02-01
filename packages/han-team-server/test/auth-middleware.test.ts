/**
 * Tests for Authentication Middleware
 *
 * Tests JWT extraction, validation, and error responses.
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
  authMiddleware,
  optionalAuthMiddleware,
  getUser,
} from "../lib/auth/index.ts";

describe("authMiddleware", () => {
  const TEST_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";
  let authService: AuthService;
  let app: Hono;

  beforeEach(() => {
    resetAuthService();
    authService = initAuthService(TEST_SECRET);

    // Create test app with auth middleware
    app = new Hono();
    app.use("/protected/*", authMiddleware());
    app.get("/protected/resource", (c) => {
      const user = getUser(c);
      return c.json({ user });
    });
  });

  afterEach(() => {
    resetAuthService();
  });

  describe("missing token", () => {
    test("returns 401 with missing_token error when no Authorization header", async () => {
      const res = await app.request("/protected/resource");

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("missing_token");
      expect(body.message).toBe("Authorization header with Bearer token is required");
    });

    test("returns 401 with missing_token error for empty Authorization header", async () => {
      const res = await app.request("/protected/resource", {
        headers: { Authorization: "" },
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("missing_token");
    });

    test("returns 401 with missing_token error for non-Bearer auth", async () => {
      const res = await app.request("/protected/resource", {
        headers: { Authorization: "Basic dXNlcjpwYXNz" },
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("missing_token");
    });

    test("returns 401 with missing_token error for Bearer without token", async () => {
      const res = await app.request("/protected/resource", {
        headers: { Authorization: "Bearer " },
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("missing_token");
    });
  });

  describe("invalid token", () => {
    test("returns 401 with unauthorized error for malformed token", async () => {
      const res = await app.request("/protected/resource", {
        headers: { Authorization: "Bearer not.a.valid.jwt" },
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("unauthorized");
    });

    test("returns 401 with unauthorized error for tampered token", async () => {
      const token = await authService.signAccessToken("user-123");
      const tamperedToken = token.slice(0, -10) + "xxxxxxxxxx";

      const res = await app.request("/protected/resource", {
        headers: { Authorization: `Bearer ${tamperedToken}` },
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("unauthorized");
    });

    test("returns 401 with unauthorized error for refresh token (wrong type)", async () => {
      const refreshToken = await authService.signRefreshToken("user-123");

      const res = await app.request("/protected/resource", {
        headers: { Authorization: `Bearer ${refreshToken}` },
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("unauthorized");
      expect(body.message).toBe("Invalid token type. Access token required.");
    });
  });

  describe("expired token", () => {
    test("returns 401 with token_expired error", async () => {
      // Create an expired token using jose directly
      const jose = await import("jose");
      const secretKey = new TextEncoder().encode(TEST_SECRET);
      const expiredToken = await new jose.SignJWT({
        sub: "user-123",
        type: "access",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 86400 * 2)
        .setIssuer("han-team-platform")
        .setAudience("han-team-api")
        .setExpirationTime(Math.floor(Date.now() / 1000) - 86400)
        .sign(secretKey);

      const res = await app.request("/protected/resource", {
        headers: { Authorization: `Bearer ${expiredToken}` },
      });

      expect(res.status).toBe(401);

      const body = await res.json();
      expect(body.error).toBe("token_expired");
      expect(body.message).toBe("Access token has expired. Please refresh your token.");
    });
  });

  describe("valid token", () => {
    test("allows request with valid access token", async () => {
      const token = await authService.signAccessToken("user-123");

      const res = await app.request("/protected/resource", {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);
    });

    test("sets user context with id", async () => {
      const token = await authService.signAccessToken("user-456");

      const res = await app.request("/protected/resource", {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.user.id).toBe("user-456");
    });

    test("sets user context with email when present", async () => {
      const token = await authService.signAccessToken("user-123", "test@example.com");

      const res = await app.request("/protected/resource", {
        headers: { Authorization: `Bearer ${token}` },
      });

      expect(res.status).toBe(200);

      const body = await res.json();
      expect(body.user.id).toBe("user-123");
      expect(body.user.email).toBe("test@example.com");
    });

    test("handles token with extra whitespace", async () => {
      const token = await authService.signAccessToken("user-123");

      const res = await app.request("/protected/resource", {
        headers: { Authorization: `Bearer   ${token}  ` },
      });

      expect(res.status).toBe(200);
    });
  });
});

describe("optionalAuthMiddleware", () => {
  const TEST_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";
  let authService: AuthService;
  let app: Hono;

  beforeEach(() => {
    resetAuthService();
    authService = initAuthService(TEST_SECRET);

    // Create test app with optional auth middleware
    app = new Hono();
    app.use("/optional/*", optionalAuthMiddleware());
    app.get("/optional/resource", (c) => {
      const user = getUser(c);
      return c.json({ user: user || null, authenticated: !!user });
    });
  });

  afterEach(() => {
    resetAuthService();
  });

  test("allows request without token", async () => {
    const res = await app.request("/optional/resource");

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user).toBeNull();
    expect(body.authenticated).toBe(false);
  });

  test("sets user context with valid token", async () => {
    const token = await authService.signAccessToken("user-123", "test@example.com");

    const res = await app.request("/optional/resource", {
      headers: { Authorization: `Bearer ${token}` },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user.id).toBe("user-123");
    expect(body.user.email).toBe("test@example.com");
    expect(body.authenticated).toBe(true);
  });

  test("continues without user for invalid token", async () => {
    const res = await app.request("/optional/resource", {
      headers: { Authorization: "Bearer invalid.token.here" },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user).toBeNull();
    expect(body.authenticated).toBe(false);
  });

  test("continues without user for expired token", async () => {
    const jose = await import("jose");
    const secretKey = new TextEncoder().encode(TEST_SECRET);
    const expiredToken = await new jose.SignJWT({
      sub: "user-123",
      type: "access",
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt(Math.floor(Date.now() / 1000) - 86400 * 2)
      .setIssuer("han-team-platform")
      .setExpirationTime(Math.floor(Date.now() / 1000) - 86400)
      .sign(secretKey);

    const res = await app.request("/optional/resource", {
      headers: { Authorization: `Bearer ${expiredToken}` },
    });

    expect(res.status).toBe(200);

    const body = await res.json();
    expect(body.user).toBeNull();
    expect(body.authenticated).toBe(false);
  });
});
