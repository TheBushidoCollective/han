/**
 * Hash Chain Calculation for Audit Logs
 *
 * Implements cryptographic hash chain for tamper-evident logging.
 * Each entry's hash includes the previous entry's hash, creating
 * an unbreakable chain where any modification is detectable.
 */

import { createHash } from "node:crypto";
import type { AuditEventInput } from "./types.ts";

/**
 * Genesis hash - the initial hash for the first entry in the chain.
 * This is a well-known constant that represents "no previous entry".
 */
export const GENESIS_HASH = Buffer.from(
  "0000000000000000000000000000000000000000000000000000000000000000",
  "hex"
);

/**
 * Payload structure for hash calculation.
 * This defines the canonical format that must be used consistently.
 *
 * [SECURITY FIX - MEDIUM] Now includes ip_address, user_agent, and metadata
 * to prevent these fields from being tampered with undetected.
 */
interface HashPayload {
  prev_hash: string;
  user_id: string;
  team_id: string | null;
  action: string;
  resource_type: string;
  resource_id: string | null;
  ip_address: string | null;
  user_agent: string | null;
  metadata: string; // JSON stringified for deterministic hashing
  timestamp: string;
}

/**
 * Canonicalize metadata for deterministic hashing.
 * Sorts object keys recursively to ensure consistent output.
 */
function canonicalizeMetadata(
  metadata: Record<string, unknown> | undefined
): string {
  if (!metadata || Object.keys(metadata).length === 0) {
    return "{}";
  }

  // Deep sort keys for deterministic serialization
  const sortObject = (obj: unknown): unknown => {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    if (Array.isArray(obj)) {
      return obj.map(sortObject);
    }
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(obj as Record<string, unknown>).sort()) {
      sorted[key] = sortObject((obj as Record<string, unknown>)[key]);
    }
    return sorted;
  };

  return JSON.stringify(sortObject(metadata));
}

/**
 * Calculate the SHA-256 hash for an audit log entry.
 *
 * The hash includes:
 * - Previous entry's hash (for chain integrity)
 * - User ID (who performed the action)
 * - Team ID (if applicable)
 * - Action type
 * - Resource type and ID
 * - IP address (for forensics)
 * - User agent (for forensics)
 * - Metadata (custom fields)
 * - Timestamp (ISO 8601 format)
 *
 * [SECURITY FIX - MEDIUM] Now includes ip_address, user_agent, and metadata
 * to prevent these fields from being tampered with undetected.
 *
 * @param entry - The audit event data
 * @param prevHash - Hash of the previous entry (or GENESIS_HASH for first)
 * @param timestamp - The exact timestamp of the event
 * @returns SHA-256 hash as a Buffer
 */
export function calculateEventHash(
  entry: AuditEventInput,
  prevHash: Buffer,
  timestamp: Date
): Buffer {
  const payload: HashPayload = {
    prev_hash: prevHash.toString("hex"),
    user_id: entry.userId,
    team_id: entry.teamId ?? null,
    action: entry.action,
    resource_type: entry.resourceType,
    resource_id: entry.resourceId ?? null,
    ip_address: entry.ipAddress ?? null,
    user_agent: entry.userAgent ?? null,
    metadata: canonicalizeMetadata(entry.metadata),
    timestamp: timestamp.toISOString(),
  };

  // Use JSON.stringify with sorted keys for deterministic output
  const canonicalJson = JSON.stringify(payload, Object.keys(payload).sort());

  return createHash("sha256").update(canonicalJson).digest();
}

/**
 * Verify that a stored entry's hash is correct.
 *
 * This recalculates the hash from the entry data and compares
 * it to the stored hash value.
 *
 * [SECURITY FIX - MEDIUM] Now includes ip_address, user_agent, and metadata
 * in verification to detect tampering of these fields.
 *
 * @param entry - The stored audit log entry
 * @param prevHash - Hash of the previous entry
 * @returns True if the hash matches, false if tampered
 */
export function verifyEntryHash(
  entry: {
    userId: string;
    teamId: string | null;
    action: string;
    resourceType: string;
    resourceId: string | null;
    ipAddress?: string | null;
    userAgent?: string | null;
    metadata?: Record<string, unknown>;
    createdAt: Date;
    eventHash: Buffer;
  },
  prevHash: Buffer
): boolean {
  const input: AuditEventInput = {
    userId: entry.userId,
    teamId: entry.teamId ?? undefined,
    action: entry.action as AuditEventInput["action"],
    resourceType: entry.resourceType as AuditEventInput["resourceType"],
    resourceId: entry.resourceId ?? undefined,
    ipAddress: entry.ipAddress ?? undefined,
    userAgent: entry.userAgent ?? undefined,
    metadata: entry.metadata,
  };

  const expectedHash = calculateEventHash(input, prevHash, entry.createdAt);

  return entry.eventHash.equals(expectedHash);
}

/**
 * Format a hash buffer as a hex string for display.
 */
export function formatHash(hash: Buffer): string {
  return hash.toString("hex");
}

/**
 * Parse a hex string back to a Buffer.
 */
export function parseHash(hex: string): Buffer {
  return Buffer.from(hex, "hex");
}
