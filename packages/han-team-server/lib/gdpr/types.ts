/**
 * GDPR Types - Shared type definitions for GDPR compliance features
 *
 * Defines types for data export and account deletion operations.
 */

/**
 * Status of a data export request
 */
export type DataExportStatus =
  | "queued"
  | "processing"
  | "completed"
  | "failed"
  | "expired";

/**
 * Status of an account deletion request
 */
export type DeletionRequestStatus =
  | "pending"
  | "confirmed"
  | "processing"
  | "completed"
  | "cancelled";

/**
 * User deletion status on the users table
 */
export type UserDeletionStatus =
  | "none"
  | "pending"
  | "processing"
  | "deleted";

/**
 * Data export record from database
 */
export interface DataExport {
  id: string;
  userId: string;
  status: DataExportStatus;
  format: "zip" | "json";
  passphraseHash: string | null;
  filePath: string | null;
  fileSizeBytes: number | null;
  downloadCount: number;
  maxDownloads: number;
  errorMessage: string | null;
  requestedAt: Date;
  startedAt: Date | null;
  completedAt: Date | null;
  expiresAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Account deletion request record from database
 */
export interface DeletionRequest {
  id: string;
  userId: string;
  status: DeletionRequestStatus;
  confirmationTokenHash: string | null;
  confirmationTokenExpiresAt: Date | null;
  confirmedAt: Date | null;
  gracePeriodEndsAt: Date | null;
  scheduledDeletionAt: Date | null;
  cancelledAt: Date | null;
  cancelledReason: string | null;
  completedAt: Date | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
  updatedAt: Date;
}

/**
 * Result of requesting a data export
 */
export interface DataExportResult {
  export: DataExport;
  estimatedWaitMinutes: number;
}

/**
 * Result of requesting account deletion
 */
export interface DeletionRequestResult {
  request: DeletionRequest;
  confirmationRequired: boolean;
  gracePeriodDays: number;
}

/**
 * Export data structure - profile.json
 */
export interface ExportProfile {
  id: string;
  email: string;
  name: string | null;
  githubId: string | null;
  githubUsername: string | null;
  avatarUrl: string | null;
  createdAt: string;
  updatedAt: string;
  tier: string;
}

/**
 * Export data structure - teams.json
 */
export interface ExportTeam {
  teamId: string;
  teamName: string;
  teamSlug: string;
  role: string;
  joinedAt: string;
}

/**
 * Export data structure - session files
 */
export interface ExportSession {
  sessionId: string;
  projectPath: string | null;
  summary: string | null;
  startedAt: string | null;
  messages: unknown[];
  metadata: Record<string, unknown>;
}

/**
 * Export data structure - audit-log.json
 */
export interface ExportAuditEvent {
  id: string;
  eventType: string;
  timestamp: string;
  success: boolean;
  metadata: Record<string, unknown>;
}

/**
 * Complete export archive structure
 */
export interface ExportArchive {
  exportedAt: string;
  exportedBy: string;
  version: string;
  profile: ExportProfile;
  teams: ExportTeam[];
  sessions: ExportSession[];
  auditLog: ExportAuditEvent[];
}

/**
 * Deletion summary - what was deleted
 */
export interface DeletionSummary {
  userId: string;
  deletedAt: string;
  sessionsDeleted: number;
  teamMembershipsRemoved: number;
  apiKeysRevoked: number;
  auditLogsPreserved: number; // Audit logs are anonymized, not deleted
  stripeCustomerMarkedForDeletion: boolean;
}

/**
 * GDPR operation context
 */
export interface GdprOperationContext {
  userId: string;
  ipAddress?: string;
  userAgent?: string;
  requestId?: string;
}
