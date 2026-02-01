/**
 * Admin Routes
 *
 * Administrative endpoints for the Han Team Platform.
 * All routes require admin role authentication.
 */

import type { Hono, Context } from "hono";
import { HTTPException } from "hono/http-exception";
import { getRequiredAuthUser, requireAdmin } from "../middleware/index.ts";
import { customRateLimit } from "../middleware/rate-limit.ts";
import { getRetentionService, getScheduler } from "../jobs/index.ts";
import { getAuditService } from "../audit/index.ts";
import { z } from "zod";

/**
 * Mask a user ID for safe exposure in preview responses.
 * Shows first 4 and last 4 characters with asterisks in between.
 */
function maskUserId(userId: string): string {
  if (userId.length <= 8) {
    return "****";
  }
  return `${userId.slice(0, 4)}****${userId.slice(-4)}`;
}

/**
 * Retention run request schema
 */
const retentionRunSchema = z.object({
  dry_run: z.boolean().optional().default(false),
});

/**
 * Rate limit configuration for admin endpoints
 * More restrictive than default to prevent abuse (10 req/min)
 */
const adminRateLimit = customRateLimit(10, 60);

/**
 * POST /api/v1/admin/retention/run
 *
 * Manually trigger retention cleanup job.
 * Requires admin role.
 *
 * Query parameters:
 * - dry_run: If true, simulates cleanup without actually deleting (default: false)
 */
async function runRetentionHandler(c: Context): Promise<Response> {
  const user = getRequiredAuthUser(c);
  const auditService = getAuditService();

  // Parse query parameters
  const dryRun = c.req.query("dry_run") === "true";

  console.log(
    `[Admin] Retention job triggered by user ${user.id} (dry_run: ${dryRun})`
  );

  try {
    const retentionService = getRetentionService();

    // Check if job is already running
    const status = retentionService.getJobStatus();
    if (status.isRunning) {
      throw new HTTPException(409, {
        message: "Retention job is already running",
      });
    }

    // Run the job
    const result = await retentionService.cleanupExpiredSessions(dryRun);

    // HIGH-1 FIX: Add audit logging for admin-triggered data purge
    await auditService.log({
      eventType: "admin.data_purge",
      userId: user.id,
      metadata: {
        dry_run: dryRun,
        deleted_count: result.deletedCount,
        batches_processed: result.batchesProcessed,
        duration_ms: result.durationMs,
        error_count: result.errorCount,
        trigger: "manual",
      },
      success: true,
    });

    return c.json({
      success: true,
      result: {
        deleted_count: result.deletedCount,
        batches_processed: result.batchesProcessed,
        by_tier: result.byTier,
        duration_ms: result.durationMs,
        dry_run: result.dryRun,
        errors_count: result.errorCount,
        timestamp: result.timestamp.toISOString(),
      },
    });
  } catch (error) {
    // HIGH-1 FIX: Audit log failed purge attempts
    const errorMessage =
      error instanceof Error ? error.message : "Unknown error";
    await auditService.log({
      eventType: "admin.data_purge",
      userId: user.id,
      metadata: {
        dry_run: dryRun,
        trigger: "manual",
      },
      success: false,
      errorMessage,
    });

    if (error instanceof HTTPException) {
      throw error;
    }

    console.error("[Admin] Retention job failed:", errorMessage);
    throw new HTTPException(500, {
      message: "Retention job failed",
    });
  }
}

/**
 * GET /api/v1/admin/retention/status
 *
 * Get current retention job status.
 * Requires admin role.
 */
async function retentionStatusHandler(c: Context): Promise<Response> {
  try {
    const retentionService = getRetentionService();
    const status = retentionService.getJobStatus();

    const schedulerStatus = getScheduler().getStatus();

    return c.json({
      job: {
        is_running: status.isRunning,
        last_run: status.lastRun?.toISOString() ?? null,
        next_scheduled_run: status.nextScheduledRun?.toISOString() ?? null,
        last_result: status.lastResult
          ? {
              deleted_count: status.lastResult.deletedCount,
              batches_processed: status.lastResult.batchesProcessed,
              by_tier: status.lastResult.byTier,
              duration_ms: status.lastResult.durationMs,
              dry_run: status.lastResult.dryRun,
              errors_count: status.lastResult.errorCount,
              timestamp: status.lastResult.timestamp.toISOString(),
            }
          : null,
      },
      scheduler: {
        enabled: schedulerStatus.enabled,
        is_running: schedulerStatus.isRunning,
        retention_hour_utc: schedulerStatus.config.retentionHour,
        retention_minute: schedulerStatus.config.retentionMinute,
        next_run_in_ms: schedulerStatus.nextRunIn,
      },
    });
  } catch (error) {
    console.error("[Admin] Failed to get retention status:", error);
    throw new HTTPException(500, {
      message: "Failed to get retention status",
    });
  }
}

/**
 * GET /api/v1/admin/retention/preview
 *
 * Preview sessions that would be affected by cleanup.
 * Requires admin role.
 *
 * Query parameters:
 * - limit: Maximum sessions to preview (default: 100, max: 1000)
 */
async function retentionPreviewHandler(c: Context): Promise<Response> {
  const limitParam = c.req.query("limit");
  const parsed = parseInt(limitParam || "100", 10);
  const limit = isNaN(parsed) ? 100 : Math.min(1000, Math.max(1, parsed));

  try {
    const retentionService = getRetentionService();
    const preview = await retentionService.previewCleanup(limit);

    return c.json({
      total_count: preview.totalCount,
      preview_limit: limit,
      sessions: preview.sessions.map((s) => ({
        id: s.id,
        // HIGH-2 FIX: Mask user ID to prevent exposure of raw identifiers
        user_id: maskUserId(s.userId),
        tier: s.tier,
        created_at: s.createdAt.toISOString(),
        days_old: s.daysOld,
        retention_days: s.retentionDays,
      })),
    });
  } catch (error) {
    console.error("[Admin] Failed to get retention preview:", error);
    throw new HTTPException(500, {
      message: "Failed to get retention preview",
    });
  }
}

/**
 * Register admin routes
 */
export function registerAdminRoutes(app: Hono): void {
  // Apply admin authentication and rate limiting to all admin routes
  app.use("/api/v1/admin/*", requireAdmin());
  app.use("/api/v1/admin/*", adminRateLimit);

  // Retention endpoints
  app.post("/api/v1/admin/retention/run", runRetentionHandler);
  app.get("/api/v1/admin/retention/status", retentionStatusHandler);
  app.get("/api/v1/admin/retention/preview", retentionPreviewHandler);
}
