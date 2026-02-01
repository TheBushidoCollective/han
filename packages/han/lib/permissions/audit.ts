/**
 * Permission Audit Logger
 *
 * Logs permission decisions for security auditing and debugging.
 * Writes to a JSONL file in the han data directory.
 */

import { appendFileSync, mkdirSync } from "node:fs";
import { join } from "node:path";
import { getClaudeConfigDir } from "../config/claude-settings.ts";
import type { AuditLogEntry } from "./types.ts";

/**
 * Get the audit log file path
 */
function getAuditLogPath(): string {
	const configDir = getClaudeConfigDir();
	if (!configDir) {
		throw new Error("Could not determine Claude config directory");
	}

	const hanDir = join(configDir, "han");
	try {
		mkdirSync(hanDir, { recursive: true });
	} catch (err) {
		if ((err as NodeJS.ErrnoException).code !== "EEXIST") {
			throw err;
		}
	}

	// Use date-based log files for easier rotation
	const date = new Date().toISOString().split("T")[0];
	return join(hanDir, `permission-audit-${date}.jsonl`);
}

/**
 * Write an audit log entry
 *
 * @param entry - The audit log entry to write
 */
export function writeAuditLog(entry: Omit<AuditLogEntry, "id" | "timestamp">): void {
	const fullEntry: AuditLogEntry = {
		...entry,
		id: crypto.randomUUID(),
		timestamp: new Date().toISOString(),
	};

	try {
		const logPath = getAuditLogPath();
		appendFileSync(logPath, `${JSON.stringify(fullEntry)}\n`);
	} catch (error) {
		// Log to console if file write fails - don't throw
		console.error("[Audit] Failed to write audit log:", error);
		console.error("[Audit] Entry:", JSON.stringify(fullEntry));
	}
}

/**
 * Log a permission denied event
 */
export function logPermissionDenied(
	userId: string,
	targetType: AuditLogEntry["targetType"],
	targetId: string,
	reason: string,
	metadata?: Record<string, unknown>,
): void {
	writeAuditLog({
		eventType: "permission_denied",
		userId,
		targetType,
		targetId,
		reason,
		metadata,
	});
}

/**
 * Log a permission granted event (for sensitive access)
 */
export function logPermissionGranted(
	userId: string,
	targetType: AuditLogEntry["targetType"],
	targetId: string,
	reason: string,
	metadata?: Record<string, unknown>,
): void {
	writeAuditLog({
		eventType: "permission_granted",
		userId,
		targetType,
		targetId,
		reason,
		metadata,
	});
}

/**
 * Log a permission check failure (API error, etc.)
 */
export function logPermissionCheckFailed(
	userId: string,
	targetType: AuditLogEntry["targetType"],
	targetId: string,
	reason: string,
	metadata?: Record<string, unknown>,
): void {
	writeAuditLog({
		eventType: "permission_check_failed",
		userId,
		targetType,
		targetId,
		reason,
		metadata,
	});
}

/**
 * Audit logger instance with convenient methods
 */
export const auditLogger = {
	denied: logPermissionDenied,
	granted: logPermissionGranted,
	failed: logPermissionCheckFailed,
	write: writeAuditLog,
};
