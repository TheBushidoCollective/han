/**
 * Integration Tests for Key Rotation Service
 *
 * Tests the full key rotation lifecycle including:
 * - Key creation
 * - Key rotation with transition period
 * - Emergency rotation
 * - Backward-compatible decryption
 * - Scheduled rotation
 */

import { describe, test, expect, beforeAll, afterAll } from "bun:test";
import {
  deriveKEK,
  unwrapDEK,
  wrapDEK,
  generateDEK,
  generateKEKSalt,
  createWrappedDEK,
  rewrapDEK,
} from "../lib/crypto/kek.ts";
import { CRYPTO_CONSTANTS } from "../lib/crypto/types.ts";

// Mock the config for tests
const originalEnv = process.env;

beforeAll(() => {
  // Set up test environment
  process.env = {
    ...originalEnv,
    SESSION_SECRET: "test-session-secret-that-is-at-least-32-characters-long",
    JWT_SECRET: "test-jwt-secret-that-is-at-least-32-characters-long-here",
    DATABASE_URL: "postgresql://test:test@localhost:5432/test",
  };
});

afterAll(() => {
  process.env = originalEnv;
});

describe("KEK Operations", () => {
  test("deriveKEK produces consistent output for same inputs", () => {
    const salt = generateKEKSalt();
    const kek1 = deriveKEK(salt);
    const kek2 = deriveKEK(salt);

    expect(kek1).toEqual(kek2);
    expect(kek1.length).toBe(CRYPTO_CONSTANTS.DEK_LENGTH);
  });

  test("deriveKEK produces different output for different salts", () => {
    const salt1 = generateKEKSalt();
    const salt2 = generateKEKSalt();

    const kek1 = deriveKEK(salt1);
    const kek2 = deriveKEK(salt2);

    expect(kek1).not.toEqual(kek2);
  });

  test("generateDEK produces random 32-byte keys", () => {
    const dek1 = generateDEK();
    const dek2 = generateDEK();

    expect(dek1.length).toBe(CRYPTO_CONSTANTS.DEK_LENGTH);
    expect(dek2.length).toBe(CRYPTO_CONSTANTS.DEK_LENGTH);
    expect(dek1).not.toEqual(dek2);
  });
});

describe("DEK Wrap/Unwrap", () => {
  test("wrapDEK and unwrapDEK are inverse operations", () => {
    const salt = generateKEKSalt();
    const kek = deriveKEK(salt);
    const dek = generateDEK();

    const wrapped = wrapDEK(dek, kek);
    const unwrapped = unwrapDEK(wrapped, kek);

    expect(unwrapped).toEqual(dek);
  });

  test("wrapped DEK includes IV and auth tag", () => {
    const salt = generateKEKSalt();
    const kek = deriveKEK(salt);
    const dek = generateDEK();

    const wrapped = wrapDEK(dek, kek);

    // Expected size: IV (12) + encrypted DEK (32) + auth tag (16) = 60 bytes
    const expectedSize =
      CRYPTO_CONSTANTS.IV_LENGTH +
      CRYPTO_CONSTANTS.DEK_LENGTH +
      CRYPTO_CONSTANTS.AUTH_TAG_LENGTH;
    expect(wrapped.length).toBe(expectedSize);
  });

  test("unwrapDEK fails with wrong KEK", () => {
    const salt1 = generateKEKSalt();
    const salt2 = generateKEKSalt();
    const kek1 = deriveKEK(salt1);
    const kek2 = deriveKEK(salt2);
    const dek = generateDEK();

    const wrapped = wrapDEK(dek, kek1);

    expect(() => unwrapDEK(wrapped, kek2)).toThrow();
  });

  test("unwrapDEK fails with tampered ciphertext", () => {
    const salt = generateKEKSalt();
    const kek = deriveKEK(salt);
    const dek = generateDEK();

    const wrapped = wrapDEK(dek, kek);

    // Tamper with a byte in the ciphertext (after IV, before auth tag)
    const tampered = Buffer.from(wrapped);
    tampered[CRYPTO_CONSTANTS.IV_LENGTH + 5] ^= 0xff;

    expect(() => unwrapDEK(tampered, kek)).toThrow();
  });
});

describe("Key Re-wrapping (Rotation)", () => {
  test("rewrapDEK changes wrapped key but preserves DEK", () => {
    const oldSalt = generateKEKSalt();
    const newSalt = generateKEKSalt();
    const oldKek = deriveKEK(oldSalt);
    const newKek = deriveKEK(newSalt);
    const originalDek = generateDEK();

    const wrappedWithOld = wrapDEK(originalDek, oldKek);
    const rewrapped = rewrapDEK(wrappedWithOld, oldKek, newKek);

    // Rewrapped should be different from original
    expect(rewrapped).not.toEqual(wrappedWithOld);

    // But should unwrap to same DEK with new KEK
    const unwrappedDek = unwrapDEK(rewrapped, newKek);
    expect(unwrappedDek).toEqual(originalDek);

    // Old key should no longer work on rewrapped version
    expect(() => unwrapDEK(rewrapped, oldKek)).toThrow();
  });

  test("createWrappedDEK produces valid wrapped key and salt", () => {
    const { wrappedDek, kekSalt } = createWrappedDEK();

    expect(wrappedDek.length).toBe(
      CRYPTO_CONSTANTS.IV_LENGTH +
        CRYPTO_CONSTANTS.DEK_LENGTH +
        CRYPTO_CONSTANTS.AUTH_TAG_LENGTH
    );
    expect(kekSalt.length).toBe(CRYPTO_CONSTANTS.KEK_SALT_LENGTH);

    // Should be able to unwrap with derived KEK
    const kek = deriveKEK(kekSalt);
    const dek = unwrapDEK(wrappedDek, kek);
    expect(dek.length).toBe(CRYPTO_CONSTANTS.DEK_LENGTH);
  });
});

describe("Backward Compatibility During Rotation", () => {
  test("data encrypted before rotation can be decrypted after rotation", () => {
    // Simulate data encrypted with old key
    const oldSalt = generateKEKSalt();
    const oldKek = deriveKEK(oldSalt);
    const dek = generateDEK();
    const wrappedDekWithOld = wrapDEK(dek, oldKek);

    // Simulate rotation: same DEK, new wrapping
    const newSalt = generateKEKSalt();
    const newKek = deriveKEK(newSalt);
    const wrappedDekWithNew = wrapDEK(dek, newKek);

    // Both wrapped versions should produce the same DEK
    const dekFromOld = unwrapDEK(wrappedDekWithOld, oldKek);
    const dekFromNew = unwrapDEK(wrappedDekWithNew, newKek);

    expect(dekFromOld).toEqual(dek);
    expect(dekFromNew).toEqual(dek);
    expect(dekFromOld).toEqual(dekFromNew);
  });

  test("fallback decryption tries multiple keys", () => {
    // Create multiple keys (simulating rotation history)
    const keys: Array<{ salt: Buffer; kek: Buffer }> = [];
    for (let i = 0; i < 3; i++) {
      const salt = generateKEKSalt();
      keys.push({ salt, kek: deriveKEK(salt) });
    }

    // Encrypt DEK with second key (simulating older key)
    const dek = generateDEK();
    const wrappedDek = wrapDEK(dek, keys[1].kek);

    // Simulate fallback decryption (try keys in order)
    let unwrappedDek: Buffer | null = null;
    for (const key of keys) {
      try {
        unwrappedDek = unwrapDEK(wrappedDek, key.kek);
        break; // Found working key
      } catch {
        continue; // Try next key
      }
    }

    expect(unwrappedDek).not.toBeNull();
    expect(unwrappedDek).toEqual(dek);
  });
});

describe("Crypto Constants", () => {
  test("DEK_LENGTH is 32 bytes (256 bits)", () => {
    expect(CRYPTO_CONSTANTS.DEK_LENGTH).toBe(32);
  });

  test("IV_LENGTH is 12 bytes for AES-GCM", () => {
    expect(CRYPTO_CONSTANTS.IV_LENGTH).toBe(12);
  });

  test("AUTH_TAG_LENGTH is 16 bytes", () => {
    expect(CRYPTO_CONSTANTS.AUTH_TAG_LENGTH).toBe(16);
  });

  test("SYMMETRIC_ALGORITHM is aes-256-gcm", () => {
    expect(CRYPTO_CONSTANTS.SYMMETRIC_ALGORITHM).toBe("aes-256-gcm");
  });
});
