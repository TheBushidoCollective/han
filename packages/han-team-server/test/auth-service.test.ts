/**
 * Tests for AuthService
 *
 * Tests JWT token signing, verification, and error handling.
 */

import { describe, test, expect, beforeEach, afterEach } from "bun:test";
import * as jose from "jose";

// Set up test environment before imports
process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters-long";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";

import {
  AuthService,
  resetAuthService,
  AuthError,
} from "../lib/auth/index.ts";

describe("AuthService", () => {
  const TEST_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";
  let authService: AuthService;

  beforeEach(() => {
    resetAuthService();
    authService = new AuthService(TEST_SECRET);
  });

  afterEach(() => {
    resetAuthService();
  });

  describe("constructor", () => {
    test("creates instance with valid secret", () => {
      const service = new AuthService(TEST_SECRET);
      expect(service).toBeInstanceOf(AuthService);
    });

    test("throws error for short secret", () => {
      expect(() => new AuthService("short")).toThrow(
        "JWT secret must be at least 32 characters"
      );
    });

    test("throws error for secret exactly 31 characters", () => {
      expect(() => new AuthService("a".repeat(31))).toThrow(
        "JWT secret must be at least 32 characters"
      );
    });

    test("accepts secret exactly 32 characters", () => {
      const service = new AuthService("a".repeat(32));
      expect(service).toBeInstanceOf(AuthService);
    });
  });

  describe("signAccessToken", () => {
    test("signs access token with user ID", async () => {
      const token = await authService.signAccessToken("user-123");

      expect(token).toBeTypeOf("string");
      expect(token.split(".")).toHaveLength(3); // JWT has 3 parts
    });

    test("signs access token with email", async () => {
      const token = await authService.signAccessToken("user-123", "test@example.com");

      const result = await authService.verifyToken(token);
      expect(result.email).toBe("test@example.com");
    });

    test("access token has correct type claim", async () => {
      const token = await authService.signAccessToken("user-123");

      const result = await authService.verifyToken(token);
      expect(result.payload.type).toBe("access");
    });

    test("access token has correct subject claim", async () => {
      const token = await authService.signAccessToken("user-456");

      const result = await authService.verifyToken(token);
      expect(result.payload.sub).toBe("user-456");
      expect(result.userId).toBe("user-456");
    });

    test("access token has issued at time", async () => {
      const beforeSign = Math.floor(Date.now() / 1000);
      const token = await authService.signAccessToken("user-123");
      const afterSign = Math.floor(Date.now() / 1000);

      const result = await authService.verifyToken(token);
      expect(result.payload.iat).toBeGreaterThanOrEqual(beforeSign);
      expect(result.payload.iat).toBeLessThanOrEqual(afterSign);
    });

    test("access token expires in 24 hours", async () => {
      const token = await authService.signAccessToken("user-123");

      const result = await authService.verifyToken(token);
      const expectedExp = result.payload.iat + 24 * 60 * 60; // 24 hours in seconds
      expect(result.payload.exp).toBe(expectedExp);
    });
  });

  describe("signRefreshToken", () => {
    test("signs refresh token with user ID", async () => {
      const token = await authService.signRefreshToken("user-123");

      expect(token).toBeTypeOf("string");
      expect(token.split(".")).toHaveLength(3);
    });

    test("refresh token has correct type claim", async () => {
      const token = await authService.signRefreshToken("user-123");

      const result = await authService.verifyToken(token);
      expect(result.payload.type).toBe("refresh");
    });

    test("refresh token has correct subject claim", async () => {
      const token = await authService.signRefreshToken("user-789");

      const result = await authService.verifyToken(token);
      expect(result.payload.sub).toBe("user-789");
      expect(result.userId).toBe("user-789");
    });

    test("refresh token expires in 30 days", async () => {
      const token = await authService.signRefreshToken("user-123");

      const result = await authService.verifyToken(token);
      const expectedExp = result.payload.iat + 30 * 24 * 60 * 60; // 30 days in seconds
      expect(result.payload.exp).toBe(expectedExp);
    });

    test("refresh token does not include email", async () => {
      const token = await authService.signRefreshToken("user-123");

      const result = await authService.verifyToken(token);
      expect(result.email).toBeUndefined();
    });
  });

  describe("verifyToken", () => {
    test("verifies valid access token", async () => {
      const token = await authService.signAccessToken("user-123", "test@example.com");

      const result = await authService.verifyToken(token);

      expect(result.userId).toBe("user-123");
      expect(result.email).toBe("test@example.com");
      expect(result.payload.type).toBe("access");
    });

    test("verifies valid refresh token", async () => {
      const token = await authService.signRefreshToken("user-456");

      const result = await authService.verifyToken(token);

      expect(result.userId).toBe("user-456");
      expect(result.payload.type).toBe("refresh");
    });

    test("throws AuthError for invalid token format", async () => {
      try {
        await authService.verifyToken("invalid.token.format");
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe("unauthorized");
      }
    });

    test("throws AuthError for tampered token", async () => {
      const token = await authService.signAccessToken("user-123");
      const tamperedToken = token.slice(0, -5) + "xxxxx";

      try {
        await authService.verifyToken(tamperedToken);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe("unauthorized");
      }
    });

    test("throws AuthError for token signed with wrong secret", async () => {
      const otherService = new AuthService("other-secret-that-is-at-least-32-characters");
      const token = await otherService.signAccessToken("user-123");

      try {
        await authService.verifyToken(token);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe("unauthorized");
      }
    });

    test("throws AuthError with token_expired code for expired token", async () => {
      // Create an expired token manually using jose
      const secretKey = new TextEncoder().encode(TEST_SECRET);
      const expiredToken = await new jose.SignJWT({
        sub: "user-123",
        type: "access",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt(Math.floor(Date.now() / 1000) - 86400 * 2) // 2 days ago
        .setIssuer("han-team-platform")
        .setAudience("han-team-api")
        .setExpirationTime(Math.floor(Date.now() / 1000) - 86400) // Expired 1 day ago
        .sign(secretKey);

      try {
        await authService.verifyToken(expiredToken);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe("token_expired");
        expect((error as AuthError).message).toBe("Token has expired");
      }
    });

    test("throws AuthError for wrong issuer", async () => {
      const secretKey = new TextEncoder().encode(TEST_SECRET);
      const wrongIssuerToken = await new jose.SignJWT({
        sub: "user-123",
        type: "access",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer("wrong-issuer")
        .setAudience("han-team-api")
        .setExpirationTime("1h")
        .sign(secretKey);

      try {
        await authService.verifyToken(wrongIssuerToken);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe("unauthorized");
      }
    });

    test("throws AuthError for wrong audience", async () => {
      const secretKey = new TextEncoder().encode(TEST_SECRET);
      const wrongAudienceToken = await new jose.SignJWT({
        sub: "user-123",
        type: "access",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer("han-team-platform")
        .setAudience("wrong-audience")
        .setExpirationTime("1h")
        .sign(secretKey);

      try {
        await authService.verifyToken(wrongAudienceToken);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe("unauthorized");
      }
    });

    test("throws AuthError for token without subject", async () => {
      const secretKey = new TextEncoder().encode(TEST_SECRET);
      const noSubjectToken = await new jose.SignJWT({
        type: "access",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer("han-team-platform")
        .setAudience("han-team-api")
        .setExpirationTime("1h")
        .sign(secretKey);

      try {
        await authService.verifyToken(noSubjectToken);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe("unauthorized");
        expect((error as AuthError).message).toBe("Token missing subject claim");
      }
    });

    test("throws AuthError for token without type", async () => {
      const secretKey = new TextEncoder().encode(TEST_SECRET);
      const noTypeToken = await new jose.SignJWT({
        sub: "user-123",
      })
        .setProtectedHeader({ alg: "HS256" })
        .setIssuedAt()
        .setIssuer("han-team-platform")
        .setAudience("han-team-api")
        .setExpirationTime("1h")
        .sign(secretKey);

      try {
        await authService.verifyToken(noTypeToken);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe("unauthorized");
        expect((error as AuthError).message).toBe("Token missing type claim");
      }
    });
  });

  describe("verifyAccessToken", () => {
    test("verifies valid access token", async () => {
      const token = await authService.signAccessToken("user-123");

      const result = await authService.verifyAccessToken(token);

      expect(result.userId).toBe("user-123");
      expect(result.payload.type).toBe("access");
    });

    test("throws AuthError for refresh token", async () => {
      const token = await authService.signRefreshToken("user-123");

      try {
        await authService.verifyAccessToken(token);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe("invalid_token_type");
        expect((error as AuthError).message).toBe("Expected access token");
      }
    });
  });

  describe("verifyRefreshToken", () => {
    test("verifies valid refresh token", async () => {
      const token = await authService.signRefreshToken("user-123");

      const result = await authService.verifyRefreshToken(token);

      expect(result.userId).toBe("user-123");
      expect(result.payload.type).toBe("refresh");
    });

    test("throws AuthError for access token", async () => {
      const token = await authService.signAccessToken("user-123");

      try {
        await authService.verifyRefreshToken(token);
        expect.unreachable("Should have thrown");
      } catch (error) {
        expect(error).toBeInstanceOf(AuthError);
        expect((error as AuthError).code).toBe("invalid_token_type");
        expect((error as AuthError).message).toBe("Expected refresh token");
      }
    });
  });
});

describe("AuthError", () => {
  test("has correct name", () => {
    const error = new AuthError("unauthorized", "test message");
    expect(error.name).toBe("AuthError");
  });

  test("has code property", () => {
    const error = new AuthError("token_expired", "Token expired");
    expect(error.code).toBe("token_expired");
  });

  test("has message property", () => {
    const error = new AuthError("missing_token", "No token provided");
    expect(error.message).toBe("No token provided");
  });

  test("is instance of Error", () => {
    const error = new AuthError("unauthorized", "test");
    expect(error).toBeInstanceOf(Error);
  });
});
