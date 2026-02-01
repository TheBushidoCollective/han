/**
 * Key Rotation API Endpoints
 *
 * POST /api/teams/:id/rotate-key - Rotate team encryption key
 * POST /api/users/:id/rotate-key - Rotate user encryption key
 * GET /api/keys/schedule/:ownerType/:ownerId - Get rotation schedule
 * PUT /api/keys/schedule/:ownerType/:ownerId - Update rotation schedule
 * POST /api/keys/run-scheduled - Run scheduled rotations (admin/cron)
 * GET /api/keys/due-for-rotation - List keys due for rotation (admin)
 * POST /api/keys/cleanup-expired - Cleanup expired transition keys (admin)
 */

import type { Context, Hono } from "hono";
import { z } from "zod";
import { HTTPException } from "hono/http-exception";
import { keyRotationService } from "../../services/key-rotation-service.ts";
import type { OwnerType } from "../../crypto/types.ts";
import {
  auth,
  requireAuth,
  requireAdmin,
  rateLimit,
  getRequiredAuthUser,
  getClientInfo,
  canAccessTeamKeys,
  canAccessUserKeys,
} from "../../middleware/auth.ts";

/**
 * UUID validation schema
 */
const UUIDSchema = z.string().uuid("Invalid UUID format");

/**
 * Request body for key rotation
 * Note: Max transition hours reduced to 48 for security (was 168)
 */
const RotateKeyRequestSchema = z.object({
  emergency: z.boolean().optional().default(false),
  reason: z.string().optional(),
  transitionHours: z.number().min(0).max(48).optional(), // Max 48 hours (reduced from 168)
});

/**
 * Request body for schedule update
 */
const UpdateScheduleRequestSchema = z.object({
  rotationIntervalDays: z.number().min(1).max(365).optional(),
  enabled: z.boolean().optional(),
});

/**
 * Rate limit config for key rotation endpoints
 * Maximum 5 rotations per hour per user
 */
const KEY_ROTATION_RATE_LIMIT = {
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5,
  keyPrefix: "rl:key-rotation",
};

/**
 * Validate owner ID is a valid UUID
 */
function validateOwnerId(ownerId: string): void {
  const result = UUIDSchema.safeParse(ownerId);
  if (!result.success) {
    throw new HTTPException(400, { message: "Invalid owner ID format" });
  }
}

/**
 * Rotate team encryption key
 * POST /api/teams/:id/rotate-key
 */
async function rotateTeamKey(c: Context): Promise<Response> {
  const teamId = c.req.param("id");
  validateOwnerId(teamId);

  // Authorization check: user must be team admin
  const user = getRequiredAuthUser(c);
  if (!canAccessTeamKeys(user, teamId)) {
    throw new HTTPException(403, {
      message: "You must be a team admin to rotate team keys",
    });
  }

  // Parse and validate request body
  const body = await c.req.json().catch(() => ({}));
  const parseResult = RotateKeyRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      {
        error: "Invalid request",
        details: parseResult.error.issues,
      },
      400
    );
  }

  const { emergency, reason, transitionHours } = parseResult.data;
  const { ipAddress, userAgent } = getClientInfo(c);

  try {
    const result = await keyRotationService.rotateKey(teamId, "team", {
      emergency,
      reason,
      transitionHours,
      performedBy: user.id,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    });

    return c.json({
      success: true,
      keyId: result.newKeyId,
      version: result.newVersion,
      previousVersion: result.oldVersion,
      emergency,
    });
  } catch (error) {
    console.error("Key rotation failed:", error);

    if (error instanceof Error && error.message.includes("No active key")) {
      return c.json({ error: "No active key found for this team" }, 404);
    }

    // Generic error message to avoid information disclosure
    return c.json(
      {
        error: "Key rotation failed",
      },
      500
    );
  }
}

/**
 * Rotate user encryption key
 * POST /api/users/:id/rotate-key
 */
async function rotateUserKey(c: Context): Promise<Response> {
  const targetUserId = c.req.param("id");
  validateOwnerId(targetUserId);

  // Authorization check: user must be self or system admin
  const user = getRequiredAuthUser(c);
  if (!canAccessUserKeys(user, targetUserId)) {
    throw new HTTPException(403, {
      message: "You can only rotate your own keys",
    });
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = RotateKeyRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      {
        error: "Invalid request",
        details: parseResult.error.issues,
      },
      400
    );
  }

  const { emergency, reason, transitionHours } = parseResult.data;
  const { ipAddress, userAgent } = getClientInfo(c);

  try {
    const result = await keyRotationService.rotateKey(targetUserId, "user", {
      emergency,
      reason,
      transitionHours,
      performedBy: user.id,
      ipAddress: ipAddress ?? undefined,
      userAgent: userAgent ?? undefined,
    });

    return c.json({
      success: true,
      keyId: result.newKeyId,
      version: result.newVersion,
      previousVersion: result.oldVersion,
      emergency,
    });
  } catch (error) {
    console.error("Key rotation failed:", error);

    if (error instanceof Error && error.message.includes("No active key")) {
      return c.json({ error: "No active key found for this user" }, 404);
    }

    // Generic error message to avoid information disclosure
    return c.json(
      {
        error: "Key rotation failed",
      },
      500
    );
  }
}

/**
 * Get rotation schedule
 * GET /api/keys/schedule/:ownerType/:ownerId
 */
async function getSchedule(c: Context): Promise<Response> {
  const ownerType = c.req.param("ownerType") as OwnerType;
  const ownerId = c.req.param("ownerId");

  if (ownerType !== "team" && ownerType !== "user") {
    return c.json({ error: "Invalid owner type" }, 400);
  }

  validateOwnerId(ownerId);

  // Authorization check
  const user = getRequiredAuthUser(c);
  if (ownerType === "team" && !canAccessTeamKeys(user, ownerId)) {
    throw new HTTPException(403, { message: "Access denied" });
  }
  if (ownerType === "user" && !canAccessUserKeys(user, ownerId)) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  try {
    const schedule = await keyRotationService.getRotationSchedule(
      ownerId,
      ownerType
    );

    if (!schedule) {
      return c.json({ error: "Schedule not found" }, 404);
    }

    return c.json({
      id: schedule.id,
      ownerType: schedule.ownerType,
      ownerId: schedule.ownerId,
      rotationIntervalDays: schedule.rotationIntervalDays,
      lastRotationAt: schedule.lastRotationAt?.toISOString() ?? null,
      nextRotationAt: schedule.nextRotationAt?.toISOString() ?? null,
      enabled: schedule.enabled,
    });
  } catch (error) {
    console.error("Get schedule failed:", error);
    return c.json({ error: "Failed to get schedule" }, 500);
  }
}

/**
 * Update rotation schedule
 * PUT /api/keys/schedule/:ownerType/:ownerId
 */
async function updateSchedule(c: Context): Promise<Response> {
  const ownerType = c.req.param("ownerType") as OwnerType;
  const ownerId = c.req.param("ownerId");

  if (ownerType !== "team" && ownerType !== "user") {
    return c.json({ error: "Invalid owner type" }, 400);
  }

  validateOwnerId(ownerId);

  // Authorization check
  const user = getRequiredAuthUser(c);
  if (ownerType === "team" && !canAccessTeamKeys(user, ownerId)) {
    throw new HTTPException(403, { message: "Access denied" });
  }
  if (ownerType === "user" && !canAccessUserKeys(user, ownerId)) {
    throw new HTTPException(403, { message: "Access denied" });
  }

  const body = await c.req.json().catch(() => ({}));
  const parseResult = UpdateScheduleRequestSchema.safeParse(body);

  if (!parseResult.success) {
    return c.json(
      {
        error: "Invalid request",
        details: parseResult.error.issues,
      },
      400
    );
  }

  try {
    const schedule = await keyRotationService.updateRotationSchedule(
      ownerId,
      ownerType,
      parseResult.data
    );

    return c.json({
      id: schedule.id,
      ownerType: schedule.ownerType,
      ownerId: schedule.ownerId,
      rotationIntervalDays: schedule.rotationIntervalDays,
      lastRotationAt: schedule.lastRotationAt?.toISOString() ?? null,
      nextRotationAt: schedule.nextRotationAt?.toISOString() ?? null,
      enabled: schedule.enabled,
    });
  } catch (error) {
    console.error("Update schedule failed:", error);
    return c.json({ error: "Failed to update schedule" }, 500);
  }
}

/**
 * Run scheduled rotations
 * POST /api/keys/run-scheduled
 *
 * Admin-only endpoint for triggering scheduled rotation jobs.
 */
async function runScheduledRotations(c: Context): Promise<Response> {
  try {
    const result = await keyRotationService.runScheduledRotation();

    return c.json({
      success: true,
      rotated: result.rotated,
      errors: result.errors,
    });
  } catch (error) {
    console.error("Scheduled rotation failed:", error);
    return c.json({ error: "Failed to run scheduled rotations" }, 500);
  }
}

/**
 * Get keys due for rotation
 * GET /api/keys/due-for-rotation
 *
 * Admin-only endpoint.
 */
async function getDueForRotation(c: Context): Promise<Response> {
  try {
    const keys = await keyRotationService.getKeysDueForRotation();

    return c.json({
      count: keys.length,
      keys: keys.map((k) => ({
        ownerType: k.ownerType,
        ownerId: k.ownerId,
        currentVersion: k.currentVersion,
        lastRotationAt: k.lastRotationAt?.toISOString() ?? null,
        overdueDays: k.overdueDays,
      })),
    });
  } catch (error) {
    console.error("Get due for rotation failed:", error);
    return c.json({ error: "Failed to get keys due for rotation" }, 500);
  }
}

/**
 * Cleanup expired transition keys
 * POST /api/keys/cleanup-expired
 *
 * Admin-only endpoint.
 */
async function cleanupExpiredKeys(c: Context): Promise<Response> {
  try {
    const deleted = await keyRotationService.cleanupExpiredKeys();

    return c.json({
      success: true,
      deletedCount: deleted,
    });
  } catch (error) {
    console.error("Cleanup failed:", error);
    return c.json({ error: "Failed to cleanup expired keys" }, 500);
  }
}

/**
 * Register key rotation routes
 */
export function registerKeyRotationRoutes(app: Hono) {
  // Apply auth middleware to all key rotation routes
  app.use("/api/teams/*", auth());
  app.use("/api/users/*", auth());
  app.use("/api/keys/*", auth());

  // Team key rotation - requires auth + rate limiting
  app.post(
    "/api/teams/:id/rotate-key",
    requireAuth(),
    rateLimit(KEY_ROTATION_RATE_LIMIT),
    rotateTeamKey
  );

  // User key rotation - requires auth + rate limiting
  app.post(
    "/api/users/:id/rotate-key",
    requireAuth(),
    rateLimit(KEY_ROTATION_RATE_LIMIT),
    rotateUserKey
  );

  // Schedule management - requires auth
  app.get("/api/keys/schedule/:ownerType/:ownerId", requireAuth(), getSchedule);
  app.put(
    "/api/keys/schedule/:ownerType/:ownerId",
    requireAuth(),
    updateSchedule
  );

  // Admin-only endpoints
  app.post(
    "/api/keys/run-scheduled",
    requireAuth(),
    requireAdmin(),
    runScheduledRotations
  );
  app.get(
    "/api/keys/due-for-rotation",
    requireAuth(),
    requireAdmin(),
    getDueForRotation
  );
  app.post(
    "/api/keys/cleanup-expired",
    requireAuth(),
    requireAdmin(),
    cleanupExpiredKeys
  );
}
