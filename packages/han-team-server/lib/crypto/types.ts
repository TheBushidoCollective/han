/**
 * Cryptographic Types for Session Encryption
 *
 * Defines types for the envelope encryption scheme:
 * - Master Secret (from environment)
 * - Key Encryption Key (KEK) - derived from master secret + salt
 * - Data Encryption Key (DEK) - encrypts actual session data
 */

export type OwnerType = "team" | "user";

export interface EncryptionKey {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  version: number;
  wrappedDek: Buffer;
  kekSalt: Buffer;
  algorithm: string;
  active: boolean;
  createdAt: Date;
  rotatedAt: Date | null;
  expiresAt: Date | null;
  validUntil: Date | null;
  isEmergencyRotated: boolean;
}

export interface KeyAuditEntry {
  id: string;
  keyId: string | null;
  ownerType: OwnerType;
  ownerId: string;
  action: KeyAuditAction;
  performedBy: string | null;
  oldKeyVersion: number | null;
  newKeyVersion: number | null;
  reason: string | null;
  ipAddress: string | null;
  userAgent: string | null;
  createdAt: Date;
}

export type KeyAuditAction =
  | "create"
  | "rotate"
  | "deactivate"
  | "emergency_rotate";

export interface KeyRotationSchedule {
  id: string;
  ownerType: OwnerType;
  ownerId: string;
  rotationIntervalDays: number;
  lastRotationAt: Date | null;
  nextRotationAt: Date | null;
  enabled: boolean;
  createdAt: Date;
  updatedAt: Date;
}

export interface RotationResult {
  oldKeyId: string | null;
  oldVersion: number | null;
  newKeyId: string;
  newVersion: number;
}

export interface KeysDueForRotation {
  ownerType: OwnerType;
  ownerId: string;
  currentKeyId: string;
  currentVersion: number;
  lastRotationAt: Date | null;
  overdueDays: number;
}

export interface RotateKeyOptions {
  emergency?: boolean;
  transitionHours?: number;
  reason?: string;
  performedBy?: string;
  ipAddress?: string;
  userAgent?: string;
}

export interface CreateKeyOptions {
  ownerId: string;
  ownerType: OwnerType;
  rotationIntervalDays?: number;
}

export interface UnwrapOptions {
  ownerId: string;
  ownerType: OwnerType;
}

/**
 * Cryptographic constants
 */
export const CRYPTO_CONSTANTS = {
  /** Length of DEK in bytes (256 bits for AES-256) */
  DEK_LENGTH: 32,

  /** Length of KEK salt in bytes */
  KEK_SALT_LENGTH: 32,

  /** Algorithm for symmetric encryption */
  SYMMETRIC_ALGORITHM: "aes-256-gcm",

  /** IV length for AES-GCM */
  IV_LENGTH: 12,

  /** Auth tag length for AES-GCM */
  AUTH_TAG_LENGTH: 16,

  /** PBKDF2 iterations for KEK derivation */
  PBKDF2_ITERATIONS: 100000,

  /** Default transition period in hours for key rotation */
  DEFAULT_TRANSITION_HOURS: 24,

  /** Default rotation interval in days */
  DEFAULT_ROTATION_INTERVAL_DAYS: 90,
} as const;
