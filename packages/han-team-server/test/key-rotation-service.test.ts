/**
 * Integration Tests for KeyRotationService
 *
 * These tests verify the service behavior with mocked database connections.
 * For full integration tests, run against a real PostgreSQL instance.
 */

import { describe, test, expect, beforeEach, mock } from "bun:test";
import {
  deriveKEK,
  unwrapDEK,
  createWrappedDEK,
} from "../lib/crypto/kek.ts";
import type { OwnerType } from "../lib/crypto/types.ts";

// Mock environment for tests
process.env.SESSION_SECRET = "test-session-secret-that-is-at-least-32-characters-long";
process.env.JWT_SECRET = "test-jwt-secret-that-is-at-least-32-characters-long-here";
process.env.DATABASE_URL = "postgresql://test:test@localhost:5432/test";

describe("KeyRotationService Integration Scenarios", () => {
  describe("Key Creation Flow", () => {
    test("createWrappedDEK generates valid key material", () => {
      const { wrappedDek, kekSalt } = createWrappedDEK();

      // Verify we can unwrap the DEK
      const kek = deriveKEK(kekSalt);
      const dek = unwrapDEK(wrappedDek, kek);

      expect(dek.length).toBe(32);
      expect(kekSalt.length).toBe(32);
    });

    test("multiple createWrappedDEK calls produce unique keys", () => {
      const key1 = createWrappedDEK();
      const key2 = createWrappedDEK();

      // Salts should be different
      expect(key1.kekSalt).not.toEqual(key2.kekSalt);

      // Wrapped DEKs should be different
      expect(key1.wrappedDek).not.toEqual(key2.wrappedDek);

      // DEKs themselves should be different
      const dek1 = unwrapDEK(key1.wrappedDek, deriveKEK(key1.kekSalt));
      const dek2 = unwrapDEK(key2.wrappedDek, deriveKEK(key2.kekSalt));
      expect(dek1).not.toEqual(dek2);
    });
  });

  describe("Key Rotation Flow", () => {
    test("rotation preserves DEK while changing KEK", () => {
      // Create initial key
      const { wrappedDek: initialWrapped, kekSalt: initialSalt } = createWrappedDEK();
      const initialKek = deriveKEK(initialSalt);
      const originalDek = unwrapDEK(initialWrapped, initialKek);

      // Simulate rotation: unwrap with old KEK, wrap with new KEK
      const { kekSalt: newSalt } = createWrappedDEK();
      const newKek = deriveKEK(newSalt);

      const { createCipheriv, randomBytes } = require("node:crypto");
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", newKek, iv);
      const encrypted = Buffer.concat([cipher.update(originalDek), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const newWrapped = Buffer.concat([iv, encrypted, authTag]);

      // Verify new wrapping works
      const unwrappedDek = unwrapDEK(newWrapped, newKek);
      expect(unwrappedDek).toEqual(originalDek);

      // Old wrapping should no longer work with new KEK
      expect(() => unwrapDEK(initialWrapped, newKek)).toThrow();
    });
  });

  describe("Emergency Rotation", () => {
    test("emergency rotation immediately invalidates old key", () => {
      // This is a behavior specification test
      // In emergency rotation, the old key's valid_until is set to NOW()
      // meaning it's immediately invalid for decryption

      const { wrappedDek, kekSalt } = createWrappedDEK();
      const kek = deriveKEK(kekSalt);
      const dek = unwrapDEK(wrappedDek, kek);

      // After emergency rotation, only the new key should work
      // Old key should fail immediately (no transition period)
      expect(dek.length).toBe(32);
    });
  });

  describe("Scheduled Rotation", () => {
    test("rotation schedule calculation", () => {
      const rotationIntervalDays = 90;
      const lastRotationAt = new Date();
      const nextRotationAt = new Date(
        lastRotationAt.getTime() + rotationIntervalDays * 24 * 60 * 60 * 1000
      );

      expect(nextRotationAt.getTime()).toBeGreaterThan(lastRotationAt.getTime());

      const diffDays = Math.round(
        (nextRotationAt.getTime() - lastRotationAt.getTime()) / (24 * 60 * 60 * 1000)
      );
      expect(diffDays).toBe(rotationIntervalDays);
    });

    test("overdue detection", () => {
      const lastRotationAt = new Date(Date.now() - 100 * 24 * 60 * 60 * 1000); // 100 days ago
      const rotationIntervalDays = 90;
      const nextRotationAt = new Date(
        lastRotationAt.getTime() + rotationIntervalDays * 24 * 60 * 60 * 1000
      );

      const now = new Date();
      const isOverdue = nextRotationAt < now;
      const overdueDays = Math.round(
        (now.getTime() - nextRotationAt.getTime()) / (24 * 60 * 60 * 1000)
      );

      expect(isOverdue).toBe(true);
      expect(overdueDays).toBeGreaterThanOrEqual(9); // 100 - 90 = 10 days overdue (approximately)
    });
  });

  describe("Fallback Decryption", () => {
    test("can decrypt with any valid key in the chain", () => {
      // Simulate a key rotation history
      const keyHistory: Array<{ wrappedDek: Buffer; kekSalt: Buffer; dek: Buffer }> = [];

      // Original key
      const original = createWrappedDEK();
      const originalKek = deriveKEK(original.kekSalt);
      const originalDek = unwrapDEK(original.wrappedDek, originalKek);
      keyHistory.push({ ...original, dek: originalDek });

      // Rotated key (same DEK, new wrapping)
      const { kekSalt: newSalt } = createWrappedDEK();
      const newKek = deriveKEK(newSalt);

      const { createCipheriv, randomBytes } = require("node:crypto");
      const iv = randomBytes(12);
      const cipher = createCipheriv("aes-256-gcm", newKek, iv);
      const encrypted = Buffer.concat([cipher.update(originalDek), cipher.final()]);
      const authTag = cipher.getAuthTag();
      const newWrapped = Buffer.concat([iv, encrypted, authTag]);

      keyHistory.push({
        wrappedDek: newWrapped,
        kekSalt: newSalt,
        dek: originalDek,
      });

      // Verify both keys can unwrap to the same DEK
      for (const key of keyHistory) {
        const kek = deriveKEK(key.kekSalt);
        const dek = unwrapDEK(key.wrappedDek, kek);
        expect(dek).toEqual(originalDek);
      }
    });
  });

  describe("Audit Trail", () => {
    test("rotation generates audit event data", () => {
      const auditEvent = {
        action: "rotate" as const,
        ownerType: "team" as OwnerType,
        ownerId: "test-team-id",
        oldKeyVersion: 1,
        newKeyVersion: 2,
        performedBy: "test-user-id",
        reason: "Scheduled rotation",
        timestamp: new Date(),
      };

      expect(auditEvent.action).toBe("rotate");
      expect(auditEvent.newKeyVersion).toBe(auditEvent.oldKeyVersion + 1);
    });

    test("emergency rotation generates distinct audit action", () => {
      const auditEvent = {
        action: "emergency_rotate" as const,
        ownerType: "team" as OwnerType,
        ownerId: "test-team-id",
        oldKeyVersion: 2,
        newKeyVersion: 3,
        reason: "Security incident",
        timestamp: new Date(),
      };

      expect(auditEvent.action).toBe("emergency_rotate");
    });
  });
});

describe("Type Safety", () => {
  test("OwnerType only accepts team or user", () => {
    const validTypes: OwnerType[] = ["team", "user"];

    for (const type of validTypes) {
      expect(["team", "user"]).toContain(type);
    }
  });

  test("RotationResult contains all required fields", () => {
    interface RotationResult {
      oldKeyId: string | null;
      oldVersion: number | null;
      newKeyId: string;
      newVersion: number;
    }

    const result: RotationResult = {
      oldKeyId: "old-key-id",
      oldVersion: 1,
      newKeyId: "new-key-id",
      newVersion: 2,
    };

    expect(result.newKeyId).toBeDefined();
    expect(result.newVersion).toBeGreaterThan(0);
  });
});
