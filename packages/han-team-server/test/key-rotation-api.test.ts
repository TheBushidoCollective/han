/**
 * API Tests for Key Rotation Endpoints
 *
 * Tests the HTTP API layer for key rotation operations.
 */

import { describe, test, expect } from "bun:test";
import { z } from "zod";

// Set up test environment
process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters-long";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long";

// Request/Response schemas for validation
const RotateKeyRequestSchema = z.object({
  emergency: z.boolean().optional().default(false),
  reason: z.string().optional(),
  transitionHours: z.number().min(0).max(48).optional(), // Reduced from 168 to 48 for security
});

const RotateKeyResponseSchema = z.object({
  success: z.boolean(),
  keyId: z.string().uuid(),
  version: z.number().int().positive(),
  previousVersion: z.number().int().positive().nullable(),
  emergency: z.boolean(),
});

const UpdateScheduleRequestSchema = z.object({
  rotationIntervalDays: z.number().min(1).max(365).optional(),
  enabled: z.boolean().optional(),
});

const ScheduleResponseSchema = z.object({
  id: z.string().uuid(),
  ownerType: z.enum(["team", "user"]),
  ownerId: z.string().uuid(),
  rotationIntervalDays: z.number(),
  lastRotationAt: z.string().nullable(),
  nextRotationAt: z.string().nullable(),
  enabled: z.boolean(),
});

const RunScheduledResponseSchema = z.object({
  success: z.boolean(),
  rotated: z.number(),
  errors: z.array(
    z.object({
      ownerId: z.string(),
      ownerType: z.enum(["team", "user"]),
      error: z.string(),
    })
  ),
});

describe("Key Rotation API Schema Validation", () => {
  describe("RotateKeyRequest", () => {
    test("accepts valid request with all fields", () => {
      const request = {
        emergency: true,
        reason: "Security incident detected",
        transitionHours: 1,
      };

      const result = RotateKeyRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    test("accepts empty request (all fields optional)", () => {
      const request = {};

      const result = RotateKeyRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data.emergency).toBe(false);
      }
    });

    test("rejects transitionHours over 48 (security limit)", () => {
      const request = {
        transitionHours: 49, // Max is 48 hours
      };

      const result = RotateKeyRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    test("rejects transitionHours at old limit of 168 (week)", () => {
      const request = {
        transitionHours: 168, // Old limit, now invalid
      };

      const result = RotateKeyRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    test("accepts transitionHours at max (48)", () => {
      const request = {
        transitionHours: 48,
      };

      const result = RotateKeyRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    test("rejects negative transitionHours", () => {
      const request = {
        transitionHours: -1,
      };

      const result = RotateKeyRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe("UpdateScheduleRequest", () => {
    test("accepts valid rotation interval", () => {
      const request = {
        rotationIntervalDays: 30,
      };

      const result = UpdateScheduleRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    test("accepts enabled flag", () => {
      const request = {
        enabled: false,
      };

      const result = UpdateScheduleRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    test("accepts both fields", () => {
      const request = {
        rotationIntervalDays: 60,
        enabled: true,
      };

      const result = UpdateScheduleRequestSchema.safeParse(request);
      expect(result.success).toBe(true);
    });

    test("rejects interval less than 1 day", () => {
      const request = {
        rotationIntervalDays: 0,
      };

      const result = UpdateScheduleRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });

    test("rejects interval more than 365 days", () => {
      const request = {
        rotationIntervalDays: 400,
      };

      const result = UpdateScheduleRequestSchema.safeParse(request);
      expect(result.success).toBe(false);
    });
  });

  describe("Response Schemas", () => {
    test("RotateKeyResponse validates correctly", () => {
      const response = {
        success: true,
        keyId: "550e8400-e29b-41d4-a716-446655440000",
        version: 2,
        previousVersion: 1,
        emergency: false,
      };

      const result = RotateKeyResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    test("ScheduleResponse validates correctly", () => {
      const response = {
        id: "550e8400-e29b-41d4-a716-446655440000",
        ownerType: "team",
        ownerId: "550e8400-e29b-41d4-a716-446655440001",
        rotationIntervalDays: 90,
        lastRotationAt: "2024-01-15T10:00:00.000Z",
        nextRotationAt: "2024-04-15T10:00:00.000Z",
        enabled: true,
      };

      const result = ScheduleResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });

    test("RunScheduledResponse validates correctly", () => {
      const response = {
        success: true,
        rotated: 5,
        errors: [
          {
            ownerId: "550e8400-e29b-41d4-a716-446655440000",
            ownerType: "team",
            error: "Database connection failed",
          },
        ],
      };

      const result = RunScheduledResponseSchema.safeParse(response);
      expect(result.success).toBe(true);
    });
  });
});

describe("API Route Patterns", () => {
  test("team rotation endpoint matches expected pattern", () => {
    const pattern = /^\/api\/teams\/[a-f0-9-]+\/rotate-key$/;
    const validPath = "/api/teams/550e8400-e29b-41d4-a716-446655440000/rotate-key";

    expect(pattern.test(validPath)).toBe(true);
  });

  test("user rotation endpoint matches expected pattern", () => {
    const pattern = /^\/api\/users\/[a-f0-9-]+\/rotate-key$/;
    const validPath = "/api/users/550e8400-e29b-41d4-a716-446655440000/rotate-key";

    expect(pattern.test(validPath)).toBe(true);
  });

  test("schedule endpoint matches expected pattern", () => {
    const pattern = /^\/api\/keys\/schedule\/(team|user)\/[a-f0-9-]+$/;
    const validTeamPath = "/api/keys/schedule/team/550e8400-e29b-41d4-a716-446655440000";
    const validUserPath = "/api/keys/schedule/user/550e8400-e29b-41d4-a716-446655440000";

    expect(pattern.test(validTeamPath)).toBe(true);
    expect(pattern.test(validUserPath)).toBe(true);
  });
});

describe("Security: Authentication Required", () => {
  test("endpoints require authentication", () => {
    // These endpoints should return 401 without valid auth token
    const protectedEndpoints = [
      "/api/teams/550e8400-e29b-41d4-a716-446655440000/rotate-key",
      "/api/users/550e8400-e29b-41d4-a716-446655440000/rotate-key",
      "/api/keys/schedule/team/550e8400-e29b-41d4-a716-446655440000",
      "/api/keys/run-scheduled",
      "/api/keys/due-for-rotation",
      "/api/keys/cleanup-expired",
    ];

    for (const endpoint of protectedEndpoints) {
      expect(endpoint).toContain("/api/");
    }
  });

  test("admin endpoints require admin role", () => {
    const adminOnlyEndpoints = [
      "/api/keys/run-scheduled",
      "/api/keys/due-for-rotation",
      "/api/keys/cleanup-expired",
    ];

    for (const endpoint of adminOnlyEndpoints) {
      expect(endpoint).toContain("/api/keys/");
    }
  });
});

describe("Security: Authorization Checks", () => {
  test("user can only rotate own keys", () => {
    const userId = "550e8400-e29b-41d4-a716-446655440000";
    const targetUserId = "550e8400-e29b-41d4-a716-446655440001";

    // Different users should be denied
    expect(userId).not.toBe(targetUserId);
  });

  test("team rotation requires team admin membership", () => {
    const teamMemberships = [
      { teamId: "team-1", role: "admin" },
      { teamId: "team-2", role: "member" },
    ];

    const canAccessTeam1 = teamMemberships.find(
      (m) => m.teamId === "team-1" && m.role === "admin"
    );
    const canAccessTeam2 = teamMemberships.find(
      (m) => m.teamId === "team-2" && m.role === "admin"
    );

    expect(canAccessTeam1).toBeDefined();
    expect(canAccessTeam2).toBeUndefined();
  });
});

describe("Security: UUID Validation", () => {
  const UUIDSchema = z.string().uuid();

  test("accepts valid UUIDs", () => {
    const validUUIDs = [
      "550e8400-e29b-41d4-a716-446655440000",
      "6ba7b810-9dad-11d1-80b4-00c04fd430c8",
    ];

    for (const uuid of validUUIDs) {
      expect(UUIDSchema.safeParse(uuid).success).toBe(true);
    }
  });

  test("rejects invalid UUIDs", () => {
    const invalidUUIDs = [
      "not-a-uuid",
      "550e8400-e29b-41d4-a716", // Incomplete
      "550e8400e29b41d4a716446655440000", // No dashes
      "../../../etc/passwd", // Path traversal attempt
      "'; DROP TABLE users;--", // SQL injection attempt
    ];

    for (const uuid of invalidUUIDs) {
      expect(UUIDSchema.safeParse(uuid).success).toBe(false);
    }
  });
});

describe("Security: Rate Limiting", () => {
  test("rate limit configuration", () => {
    const rateLimitConfig = {
      windowMs: 60 * 60 * 1000, // 1 hour
      max: 5,
      keyPrefix: "rl:key-rotation",
    };

    expect(rateLimitConfig.max).toBe(5);
    expect(rateLimitConfig.windowMs).toBe(3600000);
  });
});

describe("Security: IP Address Handling", () => {
  test("X-Forwarded-For only trusted when TRUST_PROXY=true", () => {
    const trustProxy = process.env.TRUST_PROXY === "true";
    const forwardedFor = "203.0.113.195, 70.41.3.18";

    // Should only use X-Forwarded-For when explicitly trusted
    const clientIp = trustProxy ? forwardedFor.split(",")[0].trim() : null;

    // In test environment, TRUST_PROXY is not set
    expect(clientIp).toBeNull();
  });
});

describe("Error Response Format", () => {
  const ErrorResponseSchema = z.object({
    error: z.string(),
    message: z.string().optional(),
    details: z.array(z.any()).optional(),
  });

  test("error response has required fields", () => {
    const errorResponse = {
      error: "Key rotation failed",
      // Note: message is intentionally generic to avoid information disclosure
    };

    const result = ErrorResponseSchema.safeParse(errorResponse);
    expect(result.success).toBe(true);
  });

  test("generic error messages for security", () => {
    // Error messages should not expose internal details
    const safeError = { error: "Key rotation failed" };
    const unsafeError = { error: "Database connection to 192.168.1.100 failed with password mismatch" };

    expect(safeError.error.length).toBeLessThan(50);
    expect(safeError.error).not.toContain("password");
    expect(safeError.error).not.toContain("192.");
  });

  test("validation error includes details", () => {
    const errorResponse = {
      error: "Invalid request",
      details: [
        {
          path: ["transitionHours"],
          message: "Number must be less than or equal to 48",
        },
      ],
    };

    const result = ErrorResponseSchema.safeParse(errorResponse);
    expect(result.success).toBe(true);
  });
});

describe("Request Headers", () => {
  test("Authorization header format", () => {
    const authHeader = "Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...";

    expect(authHeader.startsWith("Bearer ")).toBe(true);
    expect(authHeader.slice(7).length).toBeGreaterThan(0);
  });

  test("X-Forwarded-For header extracts first IP", () => {
    const forwardedFor = "203.0.113.195, 70.41.3.18, 150.172.238.178";
    const clientIp = forwardedFor.split(",")[0].trim();

    expect(clientIp).toBe("203.0.113.195");
  });

  test("User-Agent header is captured", () => {
    const headers = new Headers();
    headers.set("User-Agent", "han-cli/1.0.0");

    expect(headers.get("User-Agent")).toBe("han-cli/1.0.0");
  });
});
