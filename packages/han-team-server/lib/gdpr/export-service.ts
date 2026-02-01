/**
 * Data Export Service for GDPR Compliance
 *
 * Implements the Right to Data Portability (Article 20 GDPR).
 * Allows users to export all their personal data in a portable format.
 *
 * Features:
 * - Queues export jobs for async processing
 * - Includes profile, teams, sessions (decrypted), and audit logs
 * - Encrypts exports with user-provided passphrase
 * - Rate limits: 1 export per day per user
 * - Exports expire after 7 days
 */

import type { Pool } from "pg";
import { createHash, randomBytes, pbkdf2Sync, createCipheriv, timingSafeEqual } from "crypto";
import archiver from "archiver";
import { Writable } from "stream";
import { getAuditService } from "../audit/index.ts";
import {
  getSessionEncryptionService,
  type EncryptedSessionRecord,
} from "../services/session-encryption-service.ts";
import type {
  DataExport,
  DataExportResult,
  DataExportStatus,
  ExportArchive,
  ExportProfile,
  ExportTeam,
  ExportSession,
  ExportAuditEvent,
  GdprOperationContext,
} from "./types.ts";

/**
 * Export rate limit: 1 per day (in milliseconds)
 */
const EXPORT_RATE_LIMIT_MS = 24 * 60 * 60 * 1000;

/**
 * Export expiration: 7 days (in milliseconds)
 */
const EXPORT_EXPIRATION_MS = 7 * 24 * 60 * 60 * 1000;

/**
 * PBKDF2 iterations for key derivation
 */
const PBKDF2_ITERATIONS = 100000;

/**
 * Hash passphrase for storage (we only store a hash)
 */
function hashPassphrase(passphrase: string): string {
  return createHash("sha256").update(passphrase).digest("hex");
}

/**
 * Verify passphrase hash using timing-safe comparison
 * Prevents timing attacks by ensuring constant-time comparison
 */
function verifyPassphraseHash(passphrase: string, storedHash: string): boolean {
  const providedHash = hashPassphrase(passphrase);
  try {
    return timingSafeEqual(
      Buffer.from(providedHash, "hex"),
      Buffer.from(storedHash, "hex")
    );
  } catch {
    // If buffer lengths differ or other error, return false
    return false;
  }
}

/**
 * Derive encryption key from passphrase using PBKDF2
 */
function deriveKey(passphrase: string, salt: Buffer): Buffer {
  return pbkdf2Sync(passphrase, salt, PBKDF2_ITERATIONS, 32, "sha256");
}

/**
 * Encrypt data with AES-256-GCM using derived key
 */
function encryptWithPassphrase(
  data: Buffer,
  passphrase: string
): { encrypted: Buffer; salt: Buffer; iv: Buffer; authTag: Buffer } {
  const salt = randomBytes(16);
  const iv = randomBytes(12);
  const key = deriveKey(passphrase, salt);

  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(data), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return { encrypted, salt, iv, authTag };
}

/**
 * Export Service - Handles data export operations
 */
export class ExportService {
  private db: Pool;
  private auditService = getAuditService();
  private sessionEncryptionService = getSessionEncryptionService();

  constructor(db: Pool) {
    this.db = db;
  }

  /**
   * Request a data export
   *
   * @param userId - User requesting export
   * @param passphrase - Passphrase for encrypting the export
   * @param context - Operation context for audit
   * @returns Export request result
   */
  async requestExport(
    userId: string,
    passphrase: string,
    context: GdprOperationContext
  ): Promise<DataExportResult> {
    // Check rate limit
    const rateLimitCheck = await this.checkRateLimit(userId);
    if (!rateLimitCheck.allowed) {
      throw new ExportRateLimitError(
        `Export rate limit exceeded. Next export available in ${rateLimitCheck.retryAfterHours} hours.`
      );
    }

    // Validate passphrase
    if (!passphrase || passphrase.length < 8) {
      throw new ExportValidationError(
        "Passphrase must be at least 8 characters"
      );
    }

    // Hash passphrase for storage
    const passphraseHash = hashPassphrase(passphrase);

    // Create export record
    const expiresAt = new Date(Date.now() + EXPORT_EXPIRATION_MS);

    const result = await this.db.query<{
      id: string;
      user_id: string;
      status: DataExportStatus;
      format: "zip" | "json";
      passphrase_hash: string | null;
      file_path: string | null;
      file_size_bytes: number | null;
      download_count: number;
      max_downloads: number;
      error_message: string | null;
      requested_at: Date;
      started_at: Date | null;
      completed_at: Date | null;
      expires_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `INSERT INTO data_exports (
        user_id, status, format, passphrase_hash, expires_at
      ) VALUES ($1, 'queued', 'zip', $2, $3)
      RETURNING *`,
      [userId, passphraseHash, expiresAt]
    );

    const exportRecord = this.mapExportRow(result.rows[0]);

    // Update rate limit
    await this.updateRateLimit(userId);

    // Audit log
    await this.auditService.log({
      eventType: "export.request",
      userId,
      metadata: {
        exportId: exportRecord.id,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      success: true,
    });

    return {
      export: exportRecord,
      estimatedWaitMinutes: 5, // Estimate for queue processing
    };
  }

  /**
   * Get export by ID
   */
  async getExport(exportId: string, userId: string): Promise<DataExport | null> {
    const result = await this.db.query<{
      id: string;
      user_id: string;
      status: DataExportStatus;
      format: "zip" | "json";
      passphrase_hash: string | null;
      file_path: string | null;
      file_size_bytes: number | null;
      download_count: number;
      max_downloads: number;
      error_message: string | null;
      requested_at: Date;
      started_at: Date | null;
      completed_at: Date | null;
      expires_at: Date | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM data_exports WHERE id = $1 AND user_id = $2`,
      [exportId, userId]
    );

    if (result.rows.length === 0) {
      return null;
    }

    return this.mapExportRow(result.rows[0]);
  }

  /**
   * Process a queued export (called by background job)
   *
   * @param exportId - Export to process
   * @param passphrase - Original passphrase (from job queue)
   * @param userId - User ID for IDOR protection (must own the export)
   * @returns Encrypted archive data
   */
  async processExport(
    exportId: string,
    passphrase: string,
    userId: string
  ): Promise<Buffer> {
    // SECURITY: Verify export belongs to the requesting user (IDOR protection)
    const ownershipCheck = await this.db.query<{ user_id: string }>(
      `SELECT user_id FROM data_exports WHERE id = $1`,
      [exportId]
    );

    if (ownershipCheck.rows.length === 0) {
      throw new ExportNotFoundError("Export not found");
    }

    if (ownershipCheck.rows[0].user_id !== userId) {
      // Don't reveal whether the export exists - return same error
      throw new ExportNotFoundError("Export not found");
    }

    // Mark as processing
    await this.db.query(
      `UPDATE data_exports SET status = 'processing', started_at = CURRENT_TIMESTAMP
       WHERE id = $1 AND user_id = $2`,
      [exportId, userId]
    );

    try {
      // Get export record (already verified ownership above)
      const exportResult = await this.db.query<{
        id: string;
        user_id: string;
        passphrase_hash: string;
      }>(
        `SELECT id, user_id, passphrase_hash FROM data_exports WHERE id = $1 AND user_id = $2`,
        [exportId, userId]
      );

      if (exportResult.rows.length === 0) {
        throw new Error("Export not found");
      }

      const { passphrase_hash: storedHash } = exportResult.rows[0];

      // Verify passphrase using timing-safe comparison to prevent timing attacks
      if (!verifyPassphraseHash(passphrase, storedHash)) {
        throw new Error("Invalid passphrase");
      }

      // Collect all user data (userId already verified via ownership check)
      const archive = await this.collectUserData(userId);

      // Create ZIP archive
      const zipBuffer = await this.createZipArchive(archive);

      // Encrypt with passphrase
      const { encrypted, salt, iv, authTag } = encryptWithPassphrase(
        zipBuffer,
        passphrase
      );

      // Create final encrypted package
      // Format: salt (16) + iv (12) + authTag (16) + encrypted data
      const finalBuffer = Buffer.concat([salt, iv, authTag, encrypted]);

      // Store file path (in production, upload to S3/GCS)
      const filePath = `/exports/${exportId}.enc`;
      const fileSizeBytes = finalBuffer.length;

      // Mark as completed
      await this.db.query(
        `UPDATE data_exports SET
          status = 'completed',
          file_path = $2,
          file_size_bytes = $3,
          completed_at = CURRENT_TIMESTAMP
        WHERE id = $1`,
        [exportId, filePath, fileSizeBytes]
      );

      // Audit log
      await this.auditService.log({
        eventType: "export.complete",
        userId,
        metadata: {
          exportId,
          fileSizeBytes,
        },
        success: true,
      });

      return finalBuffer;
    } catch (error) {
      // Mark as failed
      const errorMessage = error instanceof Error ? error.message : "Unknown error";
      await this.db.query(
        `UPDATE data_exports SET status = 'failed', error_message = $2
         WHERE id = $1`,
        [exportId, errorMessage]
      );

      throw error;
    }
  }

  /**
   * Record a download attempt
   */
  async recordDownload(
    exportId: string,
    userId: string,
    context: GdprOperationContext
  ): Promise<{ success: boolean; remaining: number }> {
    const result = await this.db.query<{
      download_count: number;
      max_downloads: number;
      status: string;
      expires_at: Date;
    }>(
      `UPDATE data_exports SET download_count = download_count + 1
       WHERE id = $1 AND user_id = $2 AND status = 'completed'
         AND (expires_at IS NULL OR expires_at > CURRENT_TIMESTAMP)
         AND download_count < max_downloads
       RETURNING download_count, max_downloads, status, expires_at`,
      [exportId, userId]
    );

    if (result.rows.length === 0) {
      // Check if export exists but is expired or maxed out
      const checkResult = await this.db.query(
        `SELECT status, download_count, max_downloads, expires_at
         FROM data_exports WHERE id = $1 AND user_id = $2`,
        [exportId, userId]
      );

      if (checkResult.rows.length === 0) {
        throw new ExportNotFoundError("Export not found");
      }

      const { status, download_count, max_downloads, expires_at } = checkResult.rows[0];

      if (status !== "completed") {
        throw new ExportNotReadyError(`Export is ${status}`);
      }

      if (expires_at && new Date(expires_at) < new Date()) {
        throw new ExportExpiredError("Export has expired");
      }

      if (download_count >= max_downloads) {
        throw new ExportDownloadLimitError("Download limit reached");
      }

      throw new Error("Unknown error");
    }

    const { download_count, max_downloads } = result.rows[0];

    // Audit log
    await this.auditService.log({
      eventType: "export.download",
      userId,
      metadata: {
        exportId,
        downloadCount: download_count,
        maxDownloads: max_downloads,
        ipAddress: context.ipAddress,
        userAgent: context.userAgent,
        requestId: context.requestId,
      },
      success: true,
    });

    return {
      success: true,
      remaining: max_downloads - download_count,
    };
  }

  /**
   * Collect all user data for export
   */
  private async collectUserData(userId: string): Promise<ExportArchive> {
    // Get user profile
    const userResult = await this.db.query<{
      id: string;
      email: string;
      name: string | null;
      github_id: string | null;
      github_username: string | null;
      avatar_url: string | null;
      subscription_status: string | null;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT id, email, name, github_id, github_username, avatar_url,
              subscription_status, created_at, updated_at
       FROM users WHERE id = $1`,
      [userId]
    );

    if (userResult.rows.length === 0) {
      throw new Error("User not found");
    }

    const user = userResult.rows[0];

    const profile: ExportProfile = {
      id: user.id,
      email: user.email,
      name: user.name,
      githubId: user.github_id,
      githubUsername: user.github_username,
      avatarUrl: user.avatar_url,
      createdAt: user.created_at.toISOString(),
      updatedAt: user.updated_at.toISOString(),
      tier: user.subscription_status ?? "free",
    };

    // Get team memberships
    const teamsResult = await this.db.query<{
      team_id: string;
      team_name: string;
      team_slug: string;
      role: string;
      joined_at: Date;
    }>(
      `SELECT t.id as team_id, t.name as team_name, t.slug as team_slug,
              tm.role, tm.created_at as joined_at
       FROM team_members tm
       JOIN teams t ON t.id = tm.team_id
       WHERE tm.user_id = $1`,
      [userId]
    );

    const teams: ExportTeam[] = teamsResult.rows.map((row) => ({
      teamId: row.team_id,
      teamName: row.team_name,
      teamSlug: row.team_slug,
      role: row.role,
      joinedAt: row.joined_at.toISOString(),
    }));

    // Get sessions with decrypted content
    const sessionsResult = await this.db.query<{
      id: string;
      session_id: string;
      project_path: string | null;
      summary: string | null;
      started_at: Date | null;
      encrypted_content: string;
      nonce: string;
      auth_tag: string;
      key_id: string;
      secrets_redacted: boolean;
      metadata: Record<string, unknown>;
    }>(
      `SELECT ss.id, ss.session_id, ss.project_path, ss.summary, ss.started_at,
              ss.encrypted_content, ss.nonce, ss.auth_tag, ss.key_id,
              ss.secrets_redacted, ss.metadata
       FROM synced_sessions ss
       WHERE ss.user_id = $1
       ORDER BY ss.started_at DESC NULLS LAST`,
      [userId]
    );

    const sessions: ExportSession[] = [];

    for (const row of sessionsResult.rows) {
      // Decrypt session content if available
      let messages: unknown[] = [];
      try {
        if (row.encrypted_content) {
          const record: EncryptedSessionRecord = {
            sessionId: row.session_id,
            projectPath: row.project_path ?? "",
            encryptedContent: row.encrypted_content,
            nonce: row.nonce,
            authTag: row.auth_tag,
            keyId: row.key_id,
            secretsRedacted: row.secrets_redacted,
            redactedSecretTypes: [],
            createdAt: new Date(),
            updatedAt: new Date(),
          };

          const decrypted = await this.sessionEncryptionService.decryptSession(
            record,
            { userId }
          );
          messages = decrypted.data.messages;
        }
      } catch (error) {
        // Include placeholder if decryption fails
        messages = [{ error: "Failed to decrypt session content" }];
      }

      sessions.push({
        sessionId: row.session_id,
        projectPath: row.project_path,
        summary: row.summary,
        startedAt: row.started_at?.toISOString() ?? null,
        messages,
        metadata: row.metadata ?? {},
      });
    }

    // Get audit log for this user
    const auditEvents = await this.auditService.query({
      userId,
      limit: 10000, // Get all events
    });

    const auditLog: ExportAuditEvent[] = auditEvents.map((event) => ({
      id: event.id,
      eventType: event.eventType,
      timestamp: event.timestamp.toISOString(),
      success: event.success,
      metadata: event.metadata,
    }));

    return {
      exportedAt: new Date().toISOString(),
      exportedBy: userId,
      version: "1.0.0",
      profile,
      teams,
      sessions,
      auditLog,
    };
  }

  /**
   * Create ZIP archive from export data
   */
  private async createZipArchive(archive: ExportArchive): Promise<Buffer> {
    return new Promise((resolve, reject) => {
      const chunks: Buffer[] = [];

      const writableStream = new Writable({
        write(chunk, _encoding, callback) {
          chunks.push(chunk);
          callback();
        },
      });

      const zip = archiver("zip", { zlib: { level: 9 } });

      zip.on("error", reject);

      writableStream.on("finish", () => {
        resolve(Buffer.concat(chunks));
      });

      zip.pipe(writableStream);

      // Add profile.json
      zip.append(JSON.stringify(archive.profile, null, 2), {
        name: "profile.json",
      });

      // Add teams.json
      zip.append(JSON.stringify(archive.teams, null, 2), {
        name: "teams.json",
      });

      // Add sessions
      for (const session of archive.sessions) {
        const filename = `sessions/session-${session.sessionId}.json`;
        zip.append(JSON.stringify(session, null, 2), { name: filename });
      }

      // Add audit-log.json
      zip.append(JSON.stringify(archive.auditLog, null, 2), {
        name: "audit-log.json",
      });

      zip.finalize();
    });
  }

  /**
   * Check rate limit for export requests
   */
  private async checkRateLimit(
    userId: string
  ): Promise<{ allowed: boolean; retryAfterHours: number }> {
    const result = await this.db.query<{ last_request_at: Date }>(
      `SELECT last_request_at FROM gdpr_rate_limits
       WHERE user_id = $1 AND operation_type = 'export'`,
      [userId]
    );

    if (result.rows.length === 0) {
      return { allowed: true, retryAfterHours: 0 };
    }

    const lastRequest = result.rows[0].last_request_at;
    const timeSince = Date.now() - lastRequest.getTime();

    if (timeSince < EXPORT_RATE_LIMIT_MS) {
      const retryAfterMs = EXPORT_RATE_LIMIT_MS - timeSince;
      const retryAfterHours = Math.ceil(retryAfterMs / (60 * 60 * 1000));
      return { allowed: false, retryAfterHours };
    }

    return { allowed: true, retryAfterHours: 0 };
  }

  /**
   * Update rate limit tracking
   */
  private async updateRateLimit(userId: string): Promise<void> {
    await this.db.query(
      `INSERT INTO gdpr_rate_limits (user_id, operation_type, last_request_at)
       VALUES ($1, 'export', CURRENT_TIMESTAMP)
       ON CONFLICT (user_id, operation_type)
       DO UPDATE SET last_request_at = CURRENT_TIMESTAMP, request_count = gdpr_rate_limits.request_count + 1`,
      [userId]
    );
  }

  /**
   * Map database row to DataExport type
   */
  private mapExportRow(row: {
    id: string;
    user_id: string;
    status: DataExportStatus;
    format: "zip" | "json";
    passphrase_hash: string | null;
    file_path: string | null;
    file_size_bytes: number | null;
    download_count: number;
    max_downloads: number;
    error_message: string | null;
    requested_at: Date;
    started_at: Date | null;
    completed_at: Date | null;
    expires_at: Date | null;
    created_at: Date;
    updated_at: Date;
  }): DataExport {
    return {
      id: row.id,
      userId: row.user_id,
      status: row.status,
      format: row.format,
      passphraseHash: row.passphrase_hash,
      filePath: row.file_path,
      fileSizeBytes: row.file_size_bytes,
      downloadCount: row.download_count,
      maxDownloads: row.max_downloads,
      errorMessage: row.error_message,
      requestedAt: row.requested_at,
      startedAt: row.started_at,
      completedAt: row.completed_at,
      expiresAt: row.expires_at,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }
}

/**
 * Export-related errors
 */
export class ExportError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ExportError";
  }
}

export class ExportRateLimitError extends ExportError {
  constructor(message: string) {
    super(message);
    this.name = "ExportRateLimitError";
  }
}

export class ExportValidationError extends ExportError {
  constructor(message: string) {
    super(message);
    this.name = "ExportValidationError";
  }
}

export class ExportNotFoundError extends ExportError {
  constructor(message: string) {
    super(message);
    this.name = "ExportNotFoundError";
  }
}

export class ExportNotReadyError extends ExportError {
  constructor(message: string) {
    super(message);
    this.name = "ExportNotReadyError";
  }
}

export class ExportExpiredError extends ExportError {
  constructor(message: string) {
    super(message);
    this.name = "ExportExpiredError";
  }
}

export class ExportDownloadLimitError extends ExportError {
  constructor(message: string) {
    super(message);
    this.name = "ExportDownloadLimitError";
  }
}

/**
 * Singleton instance
 */
let _exportService: ExportService | null = null;

/**
 * Initialize export service
 */
export function initExportService(db: Pool): ExportService {
  _exportService = new ExportService(db);
  return _exportService;
}

/**
 * Get export service instance
 */
export function getExportService(): ExportService {
  if (!_exportService) {
    throw new Error(
      "ExportService not initialized. Call initExportService first."
    );
  }
  return _exportService;
}

/**
 * Reset export service (for testing)
 */
export function resetExportService(): void {
  _exportService = null;
}
