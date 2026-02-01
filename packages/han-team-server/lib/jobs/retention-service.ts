/**
 * Retention Service
 *
 * Manages session retention based on user subscription tier.
 * FREE users: 30-day retention
 * PRO users: 365-day retention
 *
 * @description Sessions are soft-deleted (marked with deleted_at timestamp)
 * rather than hard deleted. This allows for:
 * - Grace period for users to upgrade
 * - Audit trail
 * - Easy restoration if needed
 */

import type { Pool } from "pg";
import { BillingService, type UserTier } from "../billing/billing-service.ts";
import { getAuditService } from "../audit/index.ts";

/**
 * Retention configuration per tier
 */
export const RETENTION_DAYS: Record<UserTier, number> = {
  free: 30,
  pro: 365,
};

/**
 * Batch processing configuration
 */
export const BATCH_SIZE = 100;

/**
 * Result of a cleanup operation
 */
export interface CleanupResult {
  /** Total sessions soft-deleted */
  deletedCount: number;
  /** Number of batches processed */
  batchesProcessed: number;
  /** Sessions deleted per user tier */
  byTier: {
    free: number;
    pro: number;
  };
  /** Timestamp when cleanup was run */
  timestamp: Date;
  /** Duration of cleanup in milliseconds */
  durationMs: number;
  /** Whether this was a dry run */
  dryRun: boolean;
  /** Errors encountered (session IDs that failed, capped at MAX_ERRORS_TRACKED) */
  errors: string[];
  /** Total number of errors (may exceed errors.length if capped) */
  errorCount: number;
}

/**
 * Session record for cleanup
 */
interface SessionToCleanup {
  id: string;
  userId: string;
  keyId: string | null;
  createdAt: Date;
}

/**
 * Job status for metrics exposure
 */
export interface RetentionJobStatus {
  lastRun: Date | null;
  lastResult: CleanupResult | null;
  isRunning: boolean;
  nextScheduledRun: Date | null;
}

/**
 * Retention Service
 *
 * Enforces session retention limits based on user subscription tier.
 */
/**
 * Maximum number of errors to track before truncating.
 * Prevents OOM from unbounded error array growth.
 */
const MAX_ERRORS_TRACKED = 100;

export class RetentionService {
  private db: Pool;
  private jobStatus: RetentionJobStatus = {
    lastRun: null,
    lastResult: null,
    isRunning: false,
    nextScheduledRun: null,
  };
  /** Mutex lock for preventing concurrent cleanup runs */
  private cleanupLock: Promise<void> | null = null;

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Get retention days for a user based on their subscription tier
   */
  async getRetentionDays(userId: string): Promise<number> {
    // Query user's subscription status directly from database
    // This avoids dependency on BillingService singleton which may not be initialized
    const result = await this.db.query(
      `SELECT subscription_status FROM users WHERE id = $1`,
      [userId]
    );

    const status = result.rows[0]?.subscription_status || "none";
    const tier = BillingService.getUserTier(status);

    return RETENTION_DAYS[tier];
  }

  /**
   * Get all users with sessions that may need cleanup
   */
  private async getUsersWithSessions(): Promise<
    Array<{ userId: string; tier: UserTier }>
  > {
    const result = await this.db.query(`
      SELECT DISTINCT
        ss.user_id as "userId",
        COALESCE(u.subscription_status, 'none') as subscription_status
      FROM synced_sessions ss
      JOIN users u ON ss.user_id = u.id
      WHERE ss.deleted_at IS NULL
    `);

    return result.rows.map((row) => ({
      userId: row.userId,
      tier: BillingService.getUserTier(row.subscription_status),
    }));
  }

  /**
   * Get expired sessions for a user
   *
   * @param userId - User ID
   * @param cutoffDate - Sessions created before this date are expired
   * @param limit - Maximum sessions to return (for batch processing)
   */
  private async getExpiredSessions(
    userId: string,
    cutoffDate: Date,
    limit: number
  ): Promise<SessionToCleanup[]> {
    const result = await this.db.query(
      `SELECT id, user_id as "userId", key_id as "keyId", created_at as "createdAt"
       FROM synced_sessions
       WHERE user_id = $1
         AND created_at < $2
         AND deleted_at IS NULL
       ORDER BY created_at ASC
       LIMIT $3`,
      [userId, cutoffDate, limit]
    );

    return result.rows.map((row) => ({
      id: row.id,
      userId: row.userId,
      keyId: row.keyId,
      createdAt: new Date(row.createdAt),
    }));
  }

  /**
   * Soft delete a session
   *
   * @param sessionId - Session ID to delete
   * @param dryRun - If true, don't actually delete
   */
  private async softDeleteSession(
    sessionId: string,
    dryRun: boolean
  ): Promise<void> {
    if (dryRun) {
      return;
    }

    await this.db.query(
      `UPDATE synced_sessions
       SET deleted_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND deleted_at IS NULL`,
      [sessionId]
    );
  }

  /**
   * Clean up DEK reference for a deleted session
   *
   * When a session is soft-deleted, we don't delete the encryption key
   * immediately (it may be used by other sessions). Instead, we just
   * ensure the session's encrypted content is properly marked for cleanup.
   *
   * Note: Hard delete of orphaned DEKs should be handled by a separate job.
   */
  private async cleanupDekReference(
    _sessionId: string,
    _keyId: string | null,
    _dryRun: boolean
  ): Promise<void> {
    // For soft delete, we don't need to do anything with the DEK reference.
    // The key_id remains in the session record for potential restoration.
    // A separate hard-delete job would handle actual key cleanup.
  }

  /**
   * Log session expiration to audit trail
   */
  private async logSessionExpiration(
    session: SessionToCleanup,
    tier: UserTier,
    dryRun: boolean
  ): Promise<void> {
    if (dryRun) {
      return;
    }

    const auditService = getAuditService();
    await auditService.log({
      // Use 'session.delete' as session.expired is not in the current type
      eventType: "session.delete",
      userId: session.userId,
      metadata: {
        resourceId: session.id,
        resourceType: "session",
        reason: "retention_expired",
        tier,
        sessionAge: Math.floor(
          (Date.now() - session.createdAt.getTime()) / (1000 * 60 * 60 * 24)
        ),
      },
      success: true,
    });
  }

  /**
   * Main cleanup method - enforces retention for all users
   *
   * Uses a mutex lock to prevent concurrent cleanup runs.
   *
   * @param dryRun - If true, simulates cleanup without actually deleting
   * @throws Error if cleanup is already running (race condition prevented)
   */
  async cleanupExpiredSessions(dryRun = false): Promise<CleanupResult> {
    // CRITICAL-1 FIX: Atomic check-and-set with mutex lock
    if (this.cleanupLock) {
      throw new Error("Cleanup is already running");
    }

    // Create lock promise before any async work
    let releaseLock: () => void;
    this.cleanupLock = new Promise((resolve) => {
      releaseLock = resolve;
    });

    const startTime = Date.now();
    this.jobStatus.isRunning = true;

    const result: CleanupResult = {
      deletedCount: 0,
      batchesProcessed: 0,
      byTier: { free: 0, pro: 0 },
      timestamp: new Date(),
      durationMs: 0,
      dryRun,
      errors: [],
      errorCount: 0,
    };

    try {
      // Get all users with sessions
      const users = await this.getUsersWithSessions();

      for (const { userId, tier } of users) {
        const retentionDays = RETENTION_DAYS[tier];
        const cutoffDate = new Date();
        cutoffDate.setDate(cutoffDate.getDate() - retentionDays);

        // Process in batches
        let hasMore = true;
        while (hasMore) {
          const expiredSessions = await this.getExpiredSessions(
            userId,
            cutoffDate,
            BATCH_SIZE
          );

          if (expiredSessions.length === 0) {
            hasMore = false;
            continue;
          }

          result.batchesProcessed++;

          for (const session of expiredSessions) {
            try {
              // Soft delete the session
              await this.softDeleteSession(session.id, dryRun);

              // Clean up DEK reference (for future hard delete)
              await this.cleanupDekReference(session.id, session.keyId, dryRun);

              // Log to audit trail
              await this.logSessionExpiration(session, tier, dryRun);

              result.deletedCount++;
              result.byTier[tier]++;
            } catch (error) {
              // MEDIUM-2 FIX: Track total error count separately, cap stored errors
              result.errorCount++;
              if (result.errors.length < MAX_ERRORS_TRACKED) {
                result.errors.push(session.id);
              }
              // MEDIUM-3 FIX: Sanitize error messages, don't log full error objects
              const errorMessage =
                error instanceof Error ? error.message : "Unknown error";
              console.error(
                `Failed to delete session ${session.id}: ${errorMessage}`
              );
            }
          }

          // If we got less than batch size, we're done with this user
          if (expiredSessions.length < BATCH_SIZE) {
            hasMore = false;
          }
        }
      }
    } finally {
      result.durationMs = Date.now() - startTime;
      this.jobStatus.isRunning = false;
      this.jobStatus.lastRun = result.timestamp;
      this.jobStatus.lastResult = result;
      // Release mutex lock
      this.cleanupLock = null;
      releaseLock!();
    }

    return result;
  }

  /**
   * Get current job status for metrics
   */
  getJobStatus(): RetentionJobStatus {
    return { ...this.jobStatus };
  }

  /**
   * Set next scheduled run time (called by scheduler)
   */
  setNextScheduledRun(date: Date | null): void {
    this.jobStatus.nextScheduledRun = date;
  }

  /**
   * Get sessions that would be affected by cleanup (for dry run preview)
   *
   * @param limit - Maximum sessions to preview
   */
  async previewCleanup(limit = 100): Promise<{
    sessions: Array<{
      id: string;
      userId: string;
      tier: UserTier;
      createdAt: Date;
      daysOld: number;
      retentionDays: number;
    }>;
    totalCount: number;
  }> {
    // Get count of all expired sessions
    const countResult = await this.db.query(`
      WITH user_retention AS (
        SELECT
          id as user_id,
          CASE
            WHEN subscription_status IN ('active', 'trialing') THEN 365
            ELSE 30
          END as retention_days
        FROM users
      )
      SELECT COUNT(*) as total
      FROM synced_sessions ss
      JOIN user_retention ur ON ss.user_id = ur.user_id
      WHERE ss.deleted_at IS NULL
        AND ss.created_at < CURRENT_TIMESTAMP - (ur.retention_days || ' days')::INTERVAL
    `);

    // Get sample of expired sessions
    const sessionsResult = await this.db.query(
      `
      WITH user_retention AS (
        SELECT
          id as user_id,
          CASE
            WHEN subscription_status IN ('active', 'trialing') THEN 365
            ELSE 30
          END as retention_days,
          CASE
            WHEN subscription_status IN ('active', 'trialing') THEN 'pro'
            ELSE 'free'
          END as tier
        FROM users
      )
      SELECT
        ss.id,
        ss.user_id as "userId",
        ur.tier,
        ss.created_at as "createdAt",
        EXTRACT(DAY FROM CURRENT_TIMESTAMP - ss.created_at) as "daysOld",
        ur.retention_days as "retentionDays"
      FROM synced_sessions ss
      JOIN user_retention ur ON ss.user_id = ur.user_id
      WHERE ss.deleted_at IS NULL
        AND ss.created_at < CURRENT_TIMESTAMP - (ur.retention_days || ' days')::INTERVAL
      ORDER BY ss.created_at ASC
      LIMIT $1
    `,
      [limit]
    );

    return {
      sessions: sessionsResult.rows.map((row) => ({
        id: row.id,
        userId: row.userId,
        tier: row.tier as UserTier,
        createdAt: new Date(row.createdAt),
        daysOld: Math.floor(row.daysOld),
        retentionDays: row.retentionDays,
      })),
      totalCount: parseInt(countResult.rows[0]?.total || "0", 10),
    };
  }
}

/**
 * Singleton instance
 */
let retentionServiceInstance: RetentionService | null = null;

/**
 * Get retention service singleton
 */
export function getRetentionService(): RetentionService {
  if (!retentionServiceInstance) {
    throw new Error(
      "RetentionService not initialized. Call initRetentionService first."
    );
  }
  return retentionServiceInstance;
}

/**
 * Initialize retention service singleton
 */
export function initRetentionService(db: Pool): RetentionService {
  retentionServiceInstance = new RetentionService(db);
  return retentionServiceInstance;
}

/**
 * Reset retention service singleton (for testing)
 */
export function resetRetentionService(): void {
  retentionServiceInstance = null;
}
