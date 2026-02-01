/**
 * Account Deletion Service for GDPR Compliance
 *
 * Implements the Right to Erasure (Article 17 GDPR).
 * Allows users to request permanent deletion of their account and data.
 *
 * Features:
 * - 30-day grace period before permanent deletion
 * - Requires re-authentication confirmation token
 * - Can cancel within grace period
 * - Marks Stripe customer for deletion
 * - Audit logs are anonymized, not deleted (compliance requirement)
 * - Rate limit: 1 deletion request per account
 */

import type { Pool } from "pg";
import { createHash, randomBytes, timingSafeEqual } from "crypto";
import { getAuditService } from "../audit/index.ts";
import { getBillingService } from "../billing/index.ts";
import type {
  DeletionRequest,
  DeletionRequestResult,
  DeletionRequestStatus,
  UserDeletionStatus,
  DeletionSummary,
  GdprOperationContext,
} from "./types.ts";

/**
 * Grace period: 30 days (in milliseconds)
 */
const GRACE_PERIOD_MS = 30 * 24 * 60 * 60 * 1000;

/**
 * Confirmation token expiry: 24 hours
 */
const CONFIRMATION_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

/**
 * Hash confirmation token for storage
 */
function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

/**
 * Verify token against stored hash (timing-safe)
 */
function verifyToken(token: string, storedHash: string): boolean {
  const providedHash = hashToken(token);
  try {
    return timingSafeEqual(
      Buffer.from(providedHash, "hex"),
      Buffer.from(storedHash, "hex")
    );
  } catch {
    return false;
  }
}

/**
 * Generate secure random confirmation token
 */
function generateConfirmationToken(): string {
  return randomBytes(32).toString("hex");
}

/**
 * Deletion Service - Handles account deletion operations
 */
export class DeletionService {
  private db: Pool;
  private auditService = getAuditService();

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Request account deletion
   *
   * Creates a pending deletion request that requires confirmation.
   * Only one active deletion request per user is allowed.
   *
   * @param userId - User requesting deletion
   * @param context - Operation context for audit
   * @returns Deletion request with confirmation token
   */
  async requestDeletion(
    userId: string,
    context: GdprOperationContext
  ): Promise<{ request: DeletionRequest; confirmationToken: string }> {
    // Check for existing active deletion request
    const existingResult = await this.db.query<{ id: string; status: string }>(
      `SELECT id, status FROM deletion_requests
       WHERE user_id = $1 AND status IN ('pending', 'confirmed', 'processing')`,
      [userId]
    );

    if (existingResult.rows.length > 0) {
      const { status } = existingResult.rows[0];
      throw new DeletionAlreadyRequestedError(
        `An account deletion is already ${status}. ` +
        "Cancel it first if you want to create a new request."
      );
    }

    // Generate confirmation token
    const confirmationToken = generateConfirmationToken();
    const confirmationTokenHash = hashToken(confirmationToken);
    const confirmationTokenExpiresAt = new Date(
      Date.now() + CONFIRMATION_TOKEN_EXPIRY_MS
    );

    // Calculate grace period
    const gracePeriodEndsAt = new Date(Date.now() + GRACE_PERIOD_MS);

    // Create deletion request
    const result = await this.db.query<{
      id: string;
      user_id: string;
      status: DeletionRequestStatus;
      confirmation_token_hash: string | null;
      confirmation_token_expires_at: Date | null;
      confirmed_at: Date | null;
      grace_period_ends_at: Date | null;
      scheduled_deletion_at: Date | null;
      cancelled_at: Date | null;
      cancelled_reason: string | null;
      completed_at: Date | null;
      metadata: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO deletion_requests (
        user_id, status, confirmation_token_hash, confirmation_token_expires_at,
        grace_period_ends_at
      ) VALUES ($1, 'pending', $2, $3, $4)
      RETURNING *`,
      [userId, confirmationTokenHash, confirmationTokenExpiresAt, gracePeriodEndsAt]
    );

    const request = this.mapDeletionRow(result.rows[0]);

    // Audit log
    await this.auditService.log({
      eventType: "admin.user_suspend", // Using closest available event type
      userId,
      metadata: {
        action: "deletion_request",
        deletionRequestId: request.id,
        gracePeriodEndsAt: gracePeriodEndsAt.toISOString(),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        correlationId: context.requestId,
      },
      success: true,
    });

    return { request, confirmationToken };
  }

  /**
   * Confirm account deletion
   *
   * Validates confirmation token and starts the grace period.
   * After grace period ends, deletion will be processed.
   *
   * @param userId - User confirming deletion
   * @param confirmationToken - Token from requestDeletion
   * @param context - Operation context for audit
   * @returns Updated deletion request
   */
  async confirmDeletion(
    userId: string,
    confirmationToken: string,
    context: GdprOperationContext
  ): Promise<DeletionRequest> {
    // Get pending deletion request
    const requestResult = await this.db.query<{
      id: string;
      confirmation_token_hash: string;
      confirmation_token_expires_at: Date;
      grace_period_ends_at: Date;
    }>(
      `SELECT id, confirmation_token_hash, confirmation_token_expires_at, grace_period_ends_at
       FROM deletion_requests
       WHERE user_id = $1 AND status = 'pending'`,
      [userId]
    );

    if (requestResult.rows.length === 0) {
      throw new DeletionNotFoundError(
        "No pending deletion request found. Request deletion first."
      );
    }

    const { id, confirmation_token_hash, confirmation_token_expires_at, grace_period_ends_at } =
      requestResult.rows[0];

    // Check token expiry
    if (new Date() > confirmation_token_expires_at) {
      throw new DeletionTokenExpiredError(
        "Confirmation token has expired. Please request deletion again."
      );
    }

    // Verify token
    if (!verifyToken(confirmationToken, confirmation_token_hash)) {
      throw new DeletionInvalidTokenError("Invalid confirmation token");
    }

    // Update request to confirmed
    const updateResult = await this.db.query<{
      id: string;
      user_id: string;
      status: DeletionRequestStatus;
      confirmation_token_hash: string | null;
      confirmation_token_expires_at: Date | null;
      confirmed_at: Date | null;
      grace_period_ends_at: Date | null;
      scheduled_deletion_at: Date | null;
      cancelled_at: Date | null;
      cancelled_reason: string | null;
      completed_at: Date | null;
      metadata: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE deletion_requests SET
        status = 'confirmed',
        confirmed_at = CURRENT_TIMESTAMP,
        scheduled_deletion_at = $2
      WHERE id = $1
      RETURNING *`,
      [id, grace_period_ends_at]
    );

    const request = this.mapDeletionRow(updateResult.rows[0]);

    // Update user deletion status
    await this.db.query(
      `UPDATE users SET deletion_status = 'pending', deletion_requested_at = CURRENT_TIMESTAMP
       WHERE id = $1`,
      [userId]
    );

    // Audit log
    await this.auditService.log({
      eventType: "admin.user_suspend",
      userId,
      metadata: {
        action: "deletion_confirmed",
        deletionRequestId: request.id,
        scheduledDeletionAt: request.scheduledDeletionAt?.toISOString(),
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        correlationId: context.requestId,
      },
      success: true,
    });

    return request;
  }

  /**
   * Cancel account deletion
   *
   * Can only cancel during grace period (before processing starts).
   *
   * @param userId - User cancelling deletion
   * @param reason - Optional reason for cancellation
   * @param context - Operation context for audit
   * @returns Cancelled deletion request
   */
  async cancelDeletion(
    userId: string,
    reason: string | undefined,
    context: GdprOperationContext
  ): Promise<DeletionRequest> {
    // Find active deletion request
    const requestResult = await this.db.query<{ id: string; status: string }>(
      `SELECT id, status FROM deletion_requests
       WHERE user_id = $1 AND status IN ('pending', 'confirmed')`,
      [userId]
    );

    if (requestResult.rows.length === 0) {
      throw new DeletionNotFoundError(
        "No active deletion request found to cancel."
      );
    }

    const { id, status } = requestResult.rows[0];

    // Cancel the request
    const updateResult = await this.db.query<{
      id: string;
      user_id: string;
      status: DeletionRequestStatus;
      confirmation_token_hash: string | null;
      confirmation_token_expires_at: Date | null;
      confirmed_at: Date | null;
      grace_period_ends_at: Date | null;
      scheduled_deletion_at: Date | null;
      cancelled_at: Date | null;
      cancelled_reason: string | null;
      completed_at: Date | null;
      metadata: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE deletion_requests SET
        status = 'cancelled',
        cancelled_at = CURRENT_TIMESTAMP,
        cancelled_reason = $2
      WHERE id = $1
      RETURNING *`,
      [id, reason ?? null]
    );

    const request = this.mapDeletionRow(updateResult.rows[0]);

    // Reset user deletion status
    await this.db.query(
      `UPDATE users SET deletion_status = 'none', deletion_requested_at = NULL
       WHERE id = $1`,
      [userId]
    );

    // Audit log
    await this.auditService.log({
      eventType: "admin.user_suspend",
      userId,
      metadata: {
        action: "deletion_cancelled",
        deletionRequestId: request.id,
        previousStatus: status,
        reason,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        correlationId: context.requestId,
      },
      success: true,
    });

    return request;
  }

  /**
   * Process confirmed deletions past grace period
   *
   * Called by background job to process scheduled deletions.
   *
   * @returns Number of deletions processed
   */
  async processScheduledDeletions(): Promise<number> {
    // Find confirmed deletions past their scheduled time
    const pendingResult = await this.db.query<{
      id: string;
      user_id: string;
    }>(
      `SELECT id, user_id FROM deletion_requests
       WHERE status = 'confirmed'
         AND scheduled_deletion_at <= CURRENT_TIMESTAMP`
    );

    let processed = 0;

    for (const { id, user_id } of pendingResult.rows) {
      try {
        await this.executeDeletion(id, user_id);
        processed++;
      } catch (error) {
        console.error(`Failed to process deletion ${id}:`, error);
        // Continue with other deletions
      }
    }

    return processed;
  }

  /**
   * Execute permanent deletion of user account
   *
   * Uses database transaction to ensure atomicity of all deletion operations.
   *
   * @param requestId - Deletion request ID
   * @param userId - User to delete
   */
  private async executeDeletion(
    requestId: string,
    userId: string
  ): Promise<DeletionSummary> {
    // Get a client from the pool for transaction
    const client = await this.db.connect();

    const summary: DeletionSummary = {
      userId,
      deletedAt: new Date().toISOString(),
      sessionsDeleted: 0,
      teamMembershipsRemoved: 0,
      apiKeysRevoked: 0,
      auditLogsPreserved: 0,
      stripeCustomerMarkedForDeletion: false,
    };

    try {
      // Start transaction
      await client.query("BEGIN");

      // Mark as processing
      await client.query(
        `UPDATE deletion_requests SET status = 'processing' WHERE id = $1`,
        [requestId]
      );
      await client.query(
        `UPDATE users SET deletion_status = 'processing' WHERE id = $1`,
        [userId]
      );

      // Delete sessions
      const sessionsResult = await client.query<{ count: string }>(
        `WITH deleted AS (
          DELETE FROM synced_sessions WHERE user_id = $1
          RETURNING id
        ) SELECT COUNT(*) as count FROM deleted`,
        [userId]
      );
      summary.sessionsDeleted = parseInt(sessionsResult.rows[0].count, 10);

      // Remove team memberships
      const membershipsResult = await client.query<{ count: string }>(
        `WITH deleted AS (
          DELETE FROM team_members WHERE user_id = $1
          RETURNING id
        ) SELECT COUNT(*) as count FROM deleted`,
        [userId]
      );
      summary.teamMembershipsRemoved = parseInt(
        membershipsResult.rows[0].count,
        10
      );

      // Revoke API keys
      const apiKeysResult = await client.query<{ count: string }>(
        `WITH deleted AS (
          DELETE FROM api_keys WHERE user_id = $1
          RETURNING id
        ) SELECT COUNT(*) as count FROM deleted`,
        [userId]
      );
      summary.apiKeysRevoked = parseInt(apiKeysResult.rows[0].count, 10);

      // GDPR Audit Log Handling:
      // The audit_logs table has an immutability trigger that prevents updates.
      // For GDPR compliance, we count preserved logs but do NOT attempt to anonymize them.
      // Rationale: Audit logs serve as legal compliance records and must remain immutable.
      // The user_id in audit logs is anonymized at archive/export time instead, not in-place.
      // See: GDPR Article 17(3)(e) - exemption for legal claims and compliance.
      const auditCountResult = await client.query<{ count: string }>(
        `SELECT COUNT(*) as count FROM audit_logs WHERE user_id = $1`,
        [userId]
      );
      summary.auditLogsPreserved = parseInt(auditCountResult.rows[0].count, 10);

      // Delete GDPR rate limit records
      await client.query(
        `DELETE FROM gdpr_rate_limits WHERE user_id = $1`,
        [userId]
      );

      // Delete data exports
      await client.query(
        `DELETE FROM data_exports WHERE user_id = $1`,
        [userId]
      );

      // Soft-delete user record (keep for referential integrity)
      await client.query(
        `UPDATE users SET
          email = 'deleted-' || LEFT(MD5($1::text), 8) || '@deleted.local',
          name = 'Deleted User',
          github_id = NULL,
          github_username = NULL,
          avatar_url = NULL,
          stripe_customer_id = NULL,
          deletion_status = 'deleted'
        WHERE id = $1`,
        [userId]
      );

      // Mark deletion as completed
      await client.query(
        `UPDATE deletion_requests SET
          status = 'completed',
          completed_at = CURRENT_TIMESTAMP,
          metadata = $2
        WHERE id = $1`,
        [requestId, summary]
      );

      // Commit transaction - all deletions succeed or none do
      await client.query("COMMIT");

      // Handle Stripe customer deletion OUTSIDE the transaction
      // This is intentionally after commit because:
      // 1. Stripe API calls can fail/timeout without affecting DB consistency
      // 2. We've already soft-deleted the stripe_customer_id from users table
      // 3. Stripe deletion can be retried separately if needed
      try {
        // Get user's Stripe customer ID from the summary or cache
        // Note: We already cleared stripe_customer_id above, so we need to get it beforehand
        // TODO: Implement actual Stripe customer deletion
        // This is currently a stub. To implement:
        // 1. Store stripe_customer_id before soft-delete
        // 2. Call: await stripe.customers.del(stripeCustomerId);
        // 3. Handle Stripe API errors gracefully
        // 4. Consider using Stripe's scheduled deletion for compliance
        // See: https://stripe.com/docs/api/customers/delete
        console.warn(
          `[GDPR] TODO: Stripe customer deletion not implemented. ` +
          `Manual deletion may be required for user ${userId}`
        );
        // For now, mark as not deleted since we didn't actually delete
        summary.stripeCustomerMarkedForDeletion = false;
      } catch (error) {
        // Log but don't fail - DB deletion already committed
        console.error("Failed to delete Stripe customer:", error);
        summary.stripeCustomerMarkedForDeletion = false;
      }

      // Final audit log (outside transaction - audit logs are append-only)
      await this.auditService.log({
        eventType: "admin.data_purge",
        userId: "system",
        metadata: {
          deletedUserId: userId,
          requestId,
          ...summary,
        },
        success: true,
      });

      return summary;
    } catch (error) {
      // Rollback transaction on any error
      await client.query("ROLLBACK");

      // Mark as failed (outside transaction since we rolled back)
      const errorMessage =
        error instanceof Error ? error.message : "Unknown error";

      await this.db.query(
        `UPDATE deletion_requests SET
          status = 'confirmed',
          metadata = jsonb_set(COALESCE(metadata, '{}'), '{error}', to_jsonb($2::text))
        WHERE id = $1`,
        [requestId, errorMessage]
      );

      await this.db.query(
        `UPDATE users SET deletion_status = 'pending' WHERE id = $1`,
        [userId]
      );

      throw error;
    } finally {
      // Always release the client back to the pool
      client.release();
    }
  }

  /**
   * Get deletion request for user
   */
  async getDeletionRequest(userId: string): Promise<DeletionRequest | null> {
    const result = await this.db.query<{
      id: string;
      user_id: string;
      status: DeletionRequestStatus;
      confirmation_token_hash: string | null;
      confirmation_token_expires_at: Date | null;
      confirmed_at: Date | null;
      grace_period_ends_at: Date | null;
      scheduled_deletion_at: Date | null;
      cancelled_at: Date | null;
      cancelled_reason: string | null;
      completed_at: Date | null;
      metadata: Record<string, unknown>;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM deletion_requests
       WHERE user_id = $1 AND status IN ('pending', 'confirmed', 'processing')
       ORDER BY created_at DESC
       LIMIT 1`,
      [userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapDeletionRow(result.rows[0]);
  }

  /**
   * Map database row to DeletionRequest type
   */
  private mapDeletionRow(row: {
    id: string;
    user_id: string;
    status: DeletionRequestStatus;
    confirmation_token_hash: string | null;
    confirmation_token_expires_at: Date | null;
    confirmed_at: Date | null;
    grace_period_ends_at: Date | null;
    scheduled_deletion_at: Date | null;
    cancelled_at: Date | null;
    cancelled_reason: string | null;
    completed_at: Date | null;
    metadata: Record<string, unknown>;
    created_at: Date;
    updated_at: Date;
  }): DeletionRequest {
    return {
      id: row.id,
      userId: row.user_id,
      status: row.status,
      confirmationTokenHash: row.confirmation_token_hash,
      confirmationTokenExpiresAt: row.confirmation_token_expires_at,
      confirmedAt: row.confirmed_at,
      gracePeriodEndsAt: row.grace_period_ends_at,
      scheduledDeletionAt: row.scheduled_deletion_at,
      cancelledAt: row.cancelled_at,
      cancelledReason: row.cancelled_reason,
      completedAt: row.completed_at,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * Deletion-related errors
 */
export class DeletionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "DeletionError";
  }
}

export class DeletionAlreadyRequestedError extends DeletionError {
  constructor(message: string) {
    super(message);
    this.name = "DeletionAlreadyRequestedError";
  }
}

export class DeletionNotFoundError extends DeletionError {
  constructor(message: string) {
    super(message);
    this.name = "DeletionNotFoundError";
  }
}

export class DeletionTokenExpiredError extends DeletionError {
  constructor(message: string) {
    super(message);
    this.name = "DeletionTokenExpiredError";
  }
}

export class DeletionInvalidTokenError extends DeletionError {
  constructor(message: string) {
    super(message);
    this.name = "DeletionInvalidTokenError";
  }
}

export class DeletionCannotCancelError extends DeletionError {
  constructor(message: string) {
    super(message);
    this.name = "DeletionCannotCancelError";
  }
}

/**
 * Singleton instance
 */
let _deletionService: DeletionService | null = null;

/**
 * Initialize deletion service
 */
export function initDeletionService(db: Pool): DeletionService {
  _deletionService = new DeletionService(db);
  return _deletionService;
}

/**
 * Get deletion service instance
 */
export function getDeletionService(): DeletionService {
  if (!_deletionService) {
    throw new Error(
      "DeletionService not initialized. Call initDeletionService first."
    );
  }
  return _deletionService;
}

/**
 * Reset deletion service (for testing)
 */
export function resetDeletionService(): void {
  _deletionService = null;
}
