/**
 * Audit Logging Service for Han Team Platform
 *
 * Records security-relevant events for compliance and forensics.
 *
 * NOTE: This is a stub interface. Full implementation in unit-04-audit-logging.
 */

/**
 * Audit event categories
 */
export type AuditEventCategory =
  | "session"
  | "auth"
  | "team"
  | "encryption"
  | "export"
  | "admin";

/**
 * Audit event types
 */
export type AuditEventType =
  // Session events
  | "session.sync"
  | "session.view"
  | "session.delete"
  | "session.export"
  // Auth events
  | "auth.login"
  | "auth.logout"
  | "auth.token_refresh"
  | "auth.failed_login"
  // Team events
  | "team.create"
  | "team.update"
  | "team.delete"
  | "team.member_add"
  | "team.member_remove"
  // Encryption events
  | "encryption.key_create"
  | "encryption.key_rotate"
  | "encryption.key_revoke"
  | "encryption.decrypt"
  // Export events
  | "export.request"
  | "export.complete"
  | "export.download"
  // Admin events
  | "admin.config_change"
  | "admin.user_suspend"
  | "admin.data_purge";

/**
 * Audit event severity levels
 */
export type AuditSeverity = "info" | "warning" | "critical";

/**
 * Audit event metadata
 */
export interface AuditEventMetadata {
  /** IP address of the request */
  ipAddress?: string;
  /** User agent string */
  userAgent?: string;
  /** Request ID for correlation */
  requestId?: string;
  /** Resource ID being accessed */
  resourceId?: string;
  /** Resource type */
  resourceType?: string;
  /** Additional context */
  [key: string]: string | number | boolean | undefined;
}

/**
 * Audit event record
 */
export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: AuditEventType;
  category: AuditEventCategory;
  severity: AuditSeverity;
  userId: string | null;
  teamId: string | null;
  metadata: AuditEventMetadata;
  success: boolean;
  errorMessage?: string;
}

/**
 * Options for logging an audit event
 */
export interface LogEventOptions {
  eventType: AuditEventType;
  userId?: string;
  teamId?: string;
  metadata?: AuditEventMetadata;
  success?: boolean;
  errorMessage?: string;
}

/**
 * Query options for retrieving audit events
 */
export interface AuditQueryOptions {
  userId?: string;
  teamId?: string;
  eventTypes?: AuditEventType[];
  categories?: AuditEventCategory[];
  startDate?: Date;
  endDate?: Date;
  limit?: number;
  offset?: number;
}

/**
 * Get category from event type
 */
function getCategoryFromType(eventType: AuditEventType): AuditEventCategory {
  const prefix = eventType.split(".")[0];
  switch (prefix) {
    case "session":
      return "session";
    case "auth":
      return "auth";
    case "team":
      return "team";
    case "encryption":
      return "encryption";
    case "export":
      return "export";
    case "admin":
      return "admin";
    default:
      return "session";
  }
}

/**
 * Get severity from event type
 */
function getSeverityFromType(eventType: AuditEventType): AuditSeverity {
  // Critical events
  if (
    eventType.includes("delete") ||
    eventType.includes("revoke") ||
    eventType.includes("suspend") ||
    eventType.includes("purge") ||
    eventType === "auth.failed_login"
  ) {
    return "critical";
  }

  // Warning events
  if (
    eventType.includes("export") ||
    eventType.includes("rotate") ||
    eventType.includes("remove")
  ) {
    return "warning";
  }

  return "info";
}

/**
 * Audit Service
 *
 * Records and queries security-relevant events.
 */
export class AuditService {
  private events: AuditEvent[] = [];
  private maxInMemoryEvents = 10000;

  /**
   * Log an audit event
   */
  async log(options: LogEventOptions): Promise<AuditEvent> {
    const event: AuditEvent = {
      id: crypto.randomUUID(),
      timestamp: new Date(),
      eventType: options.eventType,
      category: getCategoryFromType(options.eventType),
      severity: getSeverityFromType(options.eventType),
      userId: options.userId || null,
      teamId: options.teamId || null,
      metadata: options.metadata || {},
      success: options.success ?? true,
      errorMessage: options.errorMessage,
    };

    // In production, this would write to database
    // For stub, store in memory
    this.events.push(event);

    // Trim old events if over limit
    if (this.events.length > this.maxInMemoryEvents) {
      this.events = this.events.slice(-this.maxInMemoryEvents);
    }

    // Log to console in development
    if (process.env.NODE_ENV !== "production") {
      const emoji =
        event.severity === "critical"
          ? "X"
          : event.severity === "warning"
            ? "!"
            : "-";
      console.log(
        `[AUDIT ${emoji}] ${event.eventType} user=${event.userId || "anonymous"} success=${event.success}`
      );
    }

    return event;
  }

  /**
   * Query audit events
   */
  async query(options: AuditQueryOptions = {}): Promise<AuditEvent[]> {
    let results = [...this.events];

    // Apply filters
    if (options.userId) {
      results = results.filter((e) => e.userId === options.userId);
    }
    if (options.teamId) {
      results = results.filter((e) => e.teamId === options.teamId);
    }
    if (options.eventTypes?.length) {
      results = results.filter((e) => options.eventTypes!.includes(e.eventType));
    }
    if (options.categories?.length) {
      results = results.filter((e) => options.categories!.includes(e.category));
    }
    if (options.startDate) {
      results = results.filter((e) => e.timestamp >= options.startDate!);
    }
    if (options.endDate) {
      results = results.filter((e) => e.timestamp <= options.endDate!);
    }

    // Sort by timestamp descending
    results.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    // Apply pagination
    const offset = options.offset || 0;
    const limit = options.limit || 100;
    return results.slice(offset, offset + limit);
  }

  /**
   * Get recent events for a user
   */
  async getRecentForUser(
    userId: string,
    limit = 10
  ): Promise<AuditEvent[]> {
    return this.query({ userId, limit });
  }

  /**
   * Get recent events for a team
   */
  async getRecentForTeam(
    teamId: string,
    limit = 10
  ): Promise<AuditEvent[]> {
    return this.query({ teamId, limit });
  }

  /**
   * Count events by type in a time range
   */
  async countByType(
    startDate: Date,
    endDate: Date
  ): Promise<Record<AuditEventType, number>> {
    const events = await this.query({ startDate, endDate, limit: 100000 });
    const counts: Partial<Record<AuditEventType, number>> = {};

    for (const event of events) {
      counts[event.eventType] = (counts[event.eventType] || 0) + 1;
    }

    return counts as Record<AuditEventType, number>;
  }
}

/**
 * Singleton instance
 */
let _instance: AuditService | null = null;

/**
 * Get the audit service instance
 */
export function getAuditService(): AuditService {
  if (!_instance) {
    _instance = new AuditService();
  }
  return _instance;
}
