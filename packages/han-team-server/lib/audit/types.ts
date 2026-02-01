/**
 * Audit Logging Types
 *
 * Type definitions for tamper-evident audit logging system.
 */

/**
 * Actions that are logged in the audit system
 */
export type AuditAction =
  | "session.view"
  | "session.export"
  | "session.decrypt"
  | "key.rotate"
  | "key.access"
  | "user.login"
  | "user.logout"
  | "team.create"
  | "team.update"
  | "member.add"
  | "member.remove"
  // GDPR data export events
  | "gdpr.export_request"
  | "gdpr.export_complete"
  | "gdpr.export_download"
  | "gdpr.export_failed"
  // GDPR account deletion events
  | "gdpr.deletion_request"
  | "gdpr.deletion_confirm"
  | "gdpr.deletion_cancel"
  | "gdpr.deletion_complete";

/**
 * Resource types that can be audited
 */
export type AuditResourceType =
  | "session"
  | "encryption_key"
  | "user"
  | "team"
  | "team_member"
  | "api_key";

/**
 * Input for creating a new audit log entry
 */
export interface AuditEventInput {
  userId: string;
  teamId?: string;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId?: string;
  ipAddress?: string;
  userAgent?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Stored audit log entry
 */
export interface AuditLogEntry {
  id: bigint;
  eventHash: Buffer;
  prevHash: Buffer;
  userId: string;
  teamId: string | null;
  action: AuditAction;
  resourceType: AuditResourceType;
  resourceId: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  metadata: Record<string, unknown>;
  createdAt: Date;
}

/**
 * Result of hash chain verification
 */
export interface VerificationResult {
  valid: boolean;
  startId: bigint;
  endId: bigint;
  entriesVerified: number;
  brokenAt?: bigint;
  expectedHash?: string;
  actualHash?: string;
  error?: string;
}

/**
 * Query options for compliance reporting
 */
export interface AuditQueryOptions {
  userId?: string;
  teamId?: string;
  action?: AuditAction;
  resourceType?: AuditResourceType;
  resourceId?: string;
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Compliance report summary
 */
export interface ComplianceReport {
  period: {
    start: Date;
    end: Date;
  };
  totalEvents: number;
  eventsByAction: Record<AuditAction, number>;
  eventsByUser: Array<{
    userId: string;
    count: number;
  }>;
  eventsByResourceType: Record<AuditResourceType, number>;
  hashChainValid: boolean;
  generatedAt: Date;
}

/**
 * Archive operation result
 */
export interface ArchiveResult {
  success: boolean;
  archivedCount: number;
  beforeDate: Date;
  error?: string;
}
