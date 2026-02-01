/**
 * Key Encryption Key (KEK) Derivation and Operations
 *
 * Derives KEKs from master secret using PBKDF2.
 * Provides wrap/unwrap operations for DEKs.
 */

import {
  createCipheriv,
  createDecipheriv,
  pbkdf2Sync,
  randomBytes,
} from "node:crypto";
import { getConfig } from "../config/schema.ts";
import { CRYPTO_CONSTANTS } from "./types.ts";

/**
 * Zero out a buffer to prevent sensitive data from lingering in memory
 */
export function zeroBuffer(buffer: Buffer): void {
  buffer.fill(0);
}

/**
 * Derives a Key Encryption Key from the master secret and salt
 */
export function deriveKEK(salt: Buffer): Buffer {
  const config = getConfig();
  const masterSecret = config.SESSION_SECRET;

  return pbkdf2Sync(
    masterSecret,
    salt,
    CRYPTO_CONSTANTS.PBKDF2_ITERATIONS,
    CRYPTO_CONSTANTS.DEK_LENGTH,
    "sha256"
  );
}

/**
 * Generates a new KEK salt
 */
export function generateKEKSalt(): Buffer {
  return randomBytes(CRYPTO_CONSTANTS.KEK_SALT_LENGTH);
}

/**
 * Generates a new Data Encryption Key
 */
export function generateDEK(): Buffer {
  return randomBytes(CRYPTO_CONSTANTS.DEK_LENGTH);
}

/**
 * Wraps (encrypts) a DEK with a KEK
 * Returns: IV (12 bytes) + ciphertext + authTag (16 bytes)
 */
export function wrapDEK(dek: Buffer, kek: Buffer): Buffer {
  const iv = randomBytes(CRYPTO_CONSTANTS.IV_LENGTH);
  const cipher = createCipheriv(CRYPTO_CONSTANTS.SYMMETRIC_ALGORITHM, kek, iv);

  const encrypted = Buffer.concat([cipher.update(dek), cipher.final()]);
  const authTag = cipher.getAuthTag();

  return Buffer.concat([iv, encrypted, authTag]);
}

/**
 * Unwraps (decrypts) a wrapped DEK using a KEK
 * Input format: IV (12 bytes) + ciphertext + authTag (16 bytes)
 */
export function unwrapDEK(wrappedDek: Buffer, kek: Buffer): Buffer {
  const iv = wrappedDek.subarray(0, CRYPTO_CONSTANTS.IV_LENGTH);
  const authTag = wrappedDek.subarray(-CRYPTO_CONSTANTS.AUTH_TAG_LENGTH);
  const ciphertext = wrappedDek.subarray(
    CRYPTO_CONSTANTS.IV_LENGTH,
    -CRYPTO_CONSTANTS.AUTH_TAG_LENGTH
  );

  const decipher = createDecipheriv(
    CRYPTO_CONSTANTS.SYMMETRIC_ALGORITHM,
    kek,
    iv
  );
  decipher.setAuthTag(authTag);

  return Buffer.concat([decipher.update(ciphertext), decipher.final()]);
}

/**
 * Re-wraps a DEK with a new KEK
 * Used during key rotation to change the wrapping key
 *
 * SECURITY: DEK is zeroed after use to minimize exposure in memory
 */
export function rewrapDEK(
  wrappedDek: Buffer,
  oldKek: Buffer,
  newKek: Buffer
): Buffer {
  const dek = unwrapDEK(wrappedDek, oldKek);
  try {
    return wrapDEK(dek, newKek);
  } finally {
    // Zero the DEK buffer to prevent it from lingering in memory
    zeroBuffer(dek);
  }
}

/**
 * Creates a new wrapped DEK with a fresh KEK
 * Returns both the wrapped DEK and the salt used to derive the KEK
 *
 * SECURITY: DEK and KEK are zeroed after use
 */
export function createWrappedDEK(): { wrappedDek: Buffer; kekSalt: Buffer } {
  const kekSalt = generateKEKSalt();
  const kek = deriveKEK(kekSalt);
  const dek = generateDEK();

  try {
    const wrappedDek = wrapDEK(dek, kek);
    return { wrappedDek, kekSalt };
  } finally {
    // Zero sensitive key material
    zeroBuffer(dek);
    zeroBuffer(kek);
  }
}
