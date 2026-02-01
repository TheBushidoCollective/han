/**
 * Key Rotation Service
 *
 * Manages encryption key lifecycle including rotation, scheduled rotation,
 * and emergency key invalidation.
 *
 * Key rotation flow:
 * 1. Generate new KEK salt
 * 2. Derive new KEK from master secret + new salt
 * 3. Fetch current wrapped DEK
 * 4. Unwrap DEK with old KEK
 * 5. Re-wrap DEK with new KEK
 * 6. Atomically: mark old key inactive, insert new key
 * 7. Log audit event
 */

import type pg from "pg";
import { getDbConnection } from "../db/index.ts";
import {
  deriveKEK,
  generateKEKSalt,
  unwrapDEK,
  wrapDEK,
  createWrappedDEK,
  zeroBuffer,
} from "../crypto/kek.ts";
import {
  CRYPTO_CONSTANTS,
  type OwnerType,
  type EncryptionKey,
  type RotationResult,
  type RotateKeyOptions,
  type KeysDueForRotation,
  type KeyRotationSchedule,
  type CreateKeyOptions,
} from "../crypto/types.ts";

export class KeyRotationService {
  private db: pg.Pool | null = null;

  private async getDb(): Promise<pg.Pool> {
    if (!this.db) {
      this.db = await getDbConnection();
    }
    return this.db;
  }

  /**
   * Creates a new encryption key for an owner
   */
  async createKey(options: CreateKeyOptions): Promise<EncryptionKey> {
    const db = await this.getDb();
    const { wrappedDek, kekSalt } = createWrappedDEK();

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Insert the key
      const keyResult = await client.query<{
        id: string;
        version: number;
        created_at: Date;
      }>(
        `INSERT INTO encryption_keys (
          owner_type, owner_id, version, wrapped_dek, kek_salt, active
        ) VALUES ($1, $2, 1, $3, $4, true)
        RETURNING id, version, created_at`,
        [options.ownerType, options.ownerId, wrappedDek, kekSalt]
      );

      const key = keyResult.rows[0];

      // Create rotation schedule
      const rotationInterval =
        options.rotationIntervalDays ??
        CRYPTO_CONSTANTS.DEFAULT_ROTATION_INTERVAL_DAYS;

      await client.query(
        `INSERT INTO key_rotation_schedules (
          owner_type, owner_id, rotation_interval_days, last_rotation_at, next_rotation_at
        ) VALUES ($1, $2, $3, NOW(), NOW() + ($3 || ' days')::INTERVAL)`,
        [options.ownerType, options.ownerId, rotationInterval]
      );

      // Log creation
      await client.query(
        `INSERT INTO key_audit_log (
          key_id, owner_type, owner_id, action, new_key_version
        ) VALUES ($1, $2, $3, 'create', $4)`,
        [key.id, options.ownerType, options.ownerId, key.version]
      );

      await client.query("COMMIT");

      return {
        id: key.id,
        ownerType: options.ownerType,
        ownerId: options.ownerId,
        version: key.version,
        wrappedDek,
        kekSalt,
        algorithm: CRYPTO_CONSTANTS.SYMMETRIC_ALGORITHM,
        active: true,
        createdAt: key.created_at,
        rotatedAt: null,
        expiresAt: null,
        validUntil: null,
        isEmergencyRotated: false,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Rotates an encryption key for an owner
   *
   * This generates a new KEK and re-wraps the existing DEK.
   * The old key remains valid for decryption during the transition period.
   */
  async rotateKey(
    ownerId: string,
    ownerType: OwnerType,
    options: RotateKeyOptions = {}
  ): Promise<RotationResult> {
    const db = await this.getDb();
    const transitionHours =
      options.transitionHours ?? CRYPTO_CONSTANTS.DEFAULT_TRANSITION_HOURS;

    const client = await db.connect();
    try {
      await client.query("BEGIN");

      // Get current active key with row lock
      const currentKeyResult = await client.query<{
        id: string;
        version: number;
        wrapped_dek: Buffer;
        kek_salt: Buffer;
      }>(
        `SELECT id, version, wrapped_dek, kek_salt
         FROM encryption_keys
         WHERE owner_type = $1 AND owner_id = $2 AND active = true
         FOR UPDATE`,
        [ownerType, ownerId]
      );

      if (currentKeyResult.rows.length === 0) {
        throw new Error(
          `No active key found for ${ownerType}:${ownerId}. Create a key first.`
        );
      }

      const currentKey = currentKeyResult.rows[0];

      // Derive old KEK and unwrap DEK
      const oldKek = deriveKEK(currentKey.kek_salt);
      const dek = unwrapDEK(currentKey.wrapped_dek, oldKek);

      // Generate new KEK and re-wrap DEK
      const newKekSalt = generateKEKSalt();
      const newKek = deriveKEK(newKekSalt);
      let newWrappedDek: Buffer;
      try {
        newWrappedDek = wrapDEK(dek, newKek);
      } finally {
        // SECURITY: Zero sensitive key material as soon as possible
        zeroBuffer(dek);
        zeroBuffer(oldKek);
        zeroBuffer(newKek);
      }

      // Get next version number
      const versionResult = await client.query<{ next_version: number }>(
        `SELECT COALESCE(MAX(version), 0) + 1 as next_version
         FROM encryption_keys
         WHERE owner_type = $1 AND owner_id = $2`,
        [ownerType, ownerId]
      );
      const newVersion = versionResult.rows[0].next_version;

      // Deactivate old key
      const validUntil = options.emergency
        ? new Date() // Immediate invalidation
        : new Date(Date.now() + transitionHours * 60 * 60 * 1000);

      await client.query(
        `UPDATE encryption_keys
         SET active = false,
             rotated_at = NOW(),
             valid_until = $3,
             is_emergency_rotated = $4
         WHERE id = $1`,
        [currentKey.id, ownerType, validUntil, options.emergency ?? false]
      );

      // Insert new active key
      const newKeyResult = await client.query<{ id: string }>(
        `INSERT INTO encryption_keys (
          owner_type, owner_id, version, wrapped_dek, kek_salt, active
        ) VALUES ($1, $2, $3, $4, $5, true)
        RETURNING id`,
        [ownerType, ownerId, newVersion, newWrappedDek, newKekSalt]
      );

      const newKeyId = newKeyResult.rows[0].id;

      // Log the rotation
      const action = options.emergency ? "emergency_rotate" : "rotate";
      await client.query(
        `INSERT INTO key_audit_log (
          key_id, owner_type, owner_id, action, performed_by,
          old_key_version, new_key_version, reason, ip_address, user_agent
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::inet, $10)`,
        [
          newKeyId,
          ownerType,
          ownerId,
          action,
          options.performedBy ?? null,
          currentKey.version,
          newVersion,
          options.reason ?? null,
          options.ipAddress ?? null,
          options.userAgent ?? null,
        ]
      );

      // Update rotation schedule
      await client.query(
        `UPDATE key_rotation_schedules
         SET last_rotation_at = NOW(),
             next_rotation_at = NOW() + (rotation_interval_days || ' days')::INTERVAL
         WHERE owner_type = $1 AND owner_id = $2`,
        [ownerType, ownerId]
      );

      await client.query("COMMIT");

      return {
        oldKeyId: currentKey.id,
        oldVersion: currentKey.version,
        newKeyId,
        newVersion,
      };
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }

  /**
   * Gets all valid keys for an owner, ordered by version (newest first)
   *
   * Includes active key and any keys still in transition period.
   * Used for decryption where we try each key in order.
   */
  async getValidKeys(
    ownerId: string,
    ownerType: OwnerType
  ): Promise<EncryptionKey[]> {
    const db = await this.getDb();

    const result = await db.query<{
      id: string;
      version: number;
      wrapped_dek: Buffer;
      kek_salt: Buffer;
      algorithm: string;
      active: boolean;
      created_at: Date;
      rotated_at: Date | null;
      expires_at: Date | null;
      valid_until: Date | null;
      is_emergency_rotated: boolean;
    }>(
      `SELECT id, version, wrapped_dek, kek_salt, algorithm, active,
              created_at, rotated_at, expires_at, valid_until, is_emergency_rotated
       FROM encryption_keys
       WHERE owner_type = $1
         AND owner_id = $2
         AND (
           active = true
           OR (valid_until IS NOT NULL AND valid_until > NOW())
         )
         AND is_emergency_rotated = false
       ORDER BY version DESC`,
      [ownerType, ownerId]
    );

    return result.rows.map((row) => ({
      id: row.id,
      ownerType,
      ownerId,
      version: row.version,
      wrappedDek: row.wrapped_dek,
      kekSalt: row.kek_salt,
      algorithm: row.algorithm,
      active: row.active,
      createdAt: row.created_at,
      rotatedAt: row.rotated_at,
      expiresAt: row.expires_at,
      validUntil: row.valid_until,
      isEmergencyRotated: row.is_emergency_rotated,
    }));
  }

  /**
   * Unwraps a DEK using any valid key for the owner
   *
   * Tries keys in order from newest to oldest until one works.
   * This provides backward compatibility during key rotation transitions.
   */
  async unwrapDEKWithFallback(
    wrappedDek: Buffer,
    ownerId: string,
    ownerType: OwnerType
  ): Promise<{ dek: Buffer; keyId: string; version: number }> {
    const validKeys = await this.getValidKeys(ownerId, ownerType);

    if (validKeys.length === 0) {
      throw new Error(`No valid keys found for ${ownerType}:${ownerId}`);
    }

    for (const key of validKeys) {
      try {
        const kek = deriveKEK(key.kekSalt);
        const dek = unwrapDEK(wrappedDek, kek);
        return { dek, keyId: key.id, version: key.version };
      } catch {
        // Try next key
        continue;
      }
    }

    throw new Error(
      `Failed to unwrap DEK with any valid key for ${ownerType}:${ownerId}`
    );
  }

  /**
   * Gets keys that are due for scheduled rotation
   */
  async getKeysDueForRotation(): Promise<KeysDueForRotation[]> {
    const db = await this.getDb();

    const result = await db.query<{
      owner_type: OwnerType;
      owner_id: string;
      current_key_id: string;
      current_version: number;
      last_rotation_at: Date | null;
      overdue_days: number;
    }>(
      `SELECT
         krs.owner_type,
         krs.owner_id,
         ek.id as current_key_id,
         ek.version as current_version,
         krs.last_rotation_at,
         EXTRACT(DAY FROM NOW() - krs.next_rotation_at)::INT as overdue_days
       FROM key_rotation_schedules krs
       JOIN encryption_keys ek ON ek.owner_type = krs.owner_type
                               AND ek.owner_id = krs.owner_id
                               AND ek.active = true
       WHERE krs.enabled = true
         AND krs.next_rotation_at <= NOW()
       ORDER BY krs.next_rotation_at ASC`
    );

    return result.rows.map((row) => ({
      ownerType: row.owner_type,
      ownerId: row.owner_id,
      currentKeyId: row.current_key_id,
      currentVersion: row.current_version,
      lastRotationAt: row.last_rotation_at,
      overdueDays: row.overdue_days,
    }));
  }

  /**
   * Runs scheduled key rotation for all overdue keys
   *
   * Returns the number of keys rotated.
   */
  async runScheduledRotation(): Promise<{
    rotated: number;
    errors: Array<{ ownerId: string; ownerType: OwnerType; error: string }>;
  }> {
    const dueKeys = await this.getKeysDueForRotation();
    const errors: Array<{
      ownerId: string;
      ownerType: OwnerType;
      error: string;
    }> = [];
    let rotated = 0;

    for (const key of dueKeys) {
      try {
        await this.rotateKey(key.ownerId, key.ownerType, {
          reason: `Scheduled rotation (${key.overdueDays} days overdue)`,
        });
        rotated++;
      } catch (error) {
        errors.push({
          ownerId: key.ownerId,
          ownerType: key.ownerType,
          error: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return { rotated, errors };
  }

  /**
   * Gets the rotation schedule for an owner
   */
  async getRotationSchedule(
    ownerId: string,
    ownerType: OwnerType
  ): Promise<KeyRotationSchedule | null> {
    const db = await this.getDb();

    const result = await db.query<{
      id: string;
      owner_type: OwnerType;
      owner_id: string;
      rotation_interval_days: number;
      last_rotation_at: Date | null;
      next_rotation_at: Date | null;
      enabled: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `SELECT * FROM key_rotation_schedules
       WHERE owner_type = $1 AND owner_id = $2`,
      [ownerType, ownerId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      ownerType: row.owner_type,
      ownerId: row.owner_id,
      rotationIntervalDays: row.rotation_interval_days,
      lastRotationAt: row.last_rotation_at,
      nextRotationAt: row.next_rotation_at,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Updates the rotation schedule for an owner
   */
  async updateRotationSchedule(
    ownerId: string,
    ownerType: OwnerType,
    options: {
      rotationIntervalDays?: number;
      enabled?: boolean;
    }
  ): Promise<KeyRotationSchedule> {
    const db = await this.getDb();

    const updates: string[] = [];
    const values: unknown[] = [ownerType, ownerId];
    let paramIndex = 3;

    if (options.rotationIntervalDays !== undefined) {
      updates.push(`rotation_interval_days = $${paramIndex++}`);
      values.push(options.rotationIntervalDays);
    }

    if (options.enabled !== undefined) {
      updates.push(`enabled = $${paramIndex++}`);
      values.push(options.enabled);
    }

    if (updates.length === 0) {
      const schedule = await this.getRotationSchedule(ownerId, ownerType);
      if (!schedule) throw new Error("Schedule not found");
      return schedule;
    }

    // Recalculate next_rotation_at if interval changed
    if (options.rotationIntervalDays !== undefined) {
      updates.push(
        `next_rotation_at = COALESCE(last_rotation_at, created_at) + ($${paramIndex++} || ' days')::INTERVAL`
      );
      values.push(options.rotationIntervalDays);
    }

    const result = await db.query<{
      id: string;
      owner_type: OwnerType;
      owner_id: string;
      rotation_interval_days: number;
      last_rotation_at: Date | null;
      next_rotation_at: Date | null;
      enabled: boolean;
      created_at: Date;
      updated_at: Date;
    }>(
      `UPDATE key_rotation_schedules
       SET ${updates.join(", ")}
       WHERE owner_type = $1 AND owner_id = $2
       RETURNING *`,
      values
    );

    const row = result.rows[0];
    return {
      id: row.id,
      ownerType: row.owner_type,
      ownerId: row.owner_id,
      rotationIntervalDays: row.rotation_interval_days,
      lastRotationAt: row.last_rotation_at,
      nextRotationAt: row.next_rotation_at,
      enabled: row.enabled,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  /**
   * Cleans up expired transition keys
   *
   * Keys that are past their valid_until date are no longer useful.
   */
  async cleanupExpiredKeys(): Promise<number> {
    const db = await this.getDb();

    const result = await db.query(
      `DELETE FROM encryption_keys
       WHERE active = false
         AND valid_until IS NOT NULL
         AND valid_until < NOW()
         AND is_emergency_rotated = false`
    );

    return result.rowCount ?? 0;
  }

  /**
   * Gets the active key for an owner
   */
  async getActiveKey(
    ownerId: string,
    ownerType: OwnerType
  ): Promise<EncryptionKey | null> {
    const db = await this.getDb();

    const result = await db.query<{
      id: string;
      version: number;
      wrapped_dek: Buffer;
      kek_salt: Buffer;
      algorithm: string;
      created_at: Date;
      rotated_at: Date | null;
      expires_at: Date | null;
      valid_until: Date | null;
      is_emergency_rotated: boolean;
    }>(
      `SELECT id, version, wrapped_dek, kek_salt, algorithm,
              created_at, rotated_at, expires_at, valid_until, is_emergency_rotated
       FROM encryption_keys
       WHERE owner_type = $1 AND owner_id = $2 AND active = true`,
      [ownerType, ownerId]
    );

    if (result.rows.length === 0) return null;

    const row = result.rows[0];
    return {
      id: row.id,
      ownerType,
      ownerId,
      version: row.version,
      wrappedDek: row.wrapped_dek,
      kekSalt: row.kek_salt,
      algorithm: row.algorithm,
      active: true,
      createdAt: row.created_at,
      rotatedAt: row.rotated_at,
      expiresAt: row.expires_at,
      validUntil: row.valid_until,
      isEmergencyRotated: row.is_emergency_rotated,
    };
  }
}

// Export singleton instance
export const keyRotationService = new KeyRotationService();
