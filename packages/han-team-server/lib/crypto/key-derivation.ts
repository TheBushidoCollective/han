/**
 * Key Derivation using Argon2id
 *
 * OWASP recommended parameters for password hashing:
 * - Memory: 64 MB (65536 KB)
 * - Iterations: 3
 * - Parallelism: 1
 * - Hash length: 32 bytes (256 bits for AES-256)
 */

import { argon2id } from "@noble/hashes/argon2.js";
import { randomBytes } from "@noble/ciphers/utils.js";

/**
 * Argon2id parameters following OWASP recommendations
 * @see https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html
 */
export const ARGON2_PARAMS = {
  /** Memory cost in KB (64 MB) */
  m: 65536,
  /** Time cost (iterations) */
  t: 3,
  /** Parallelism factor */
  p: 1,
  /** Output hash length in bytes (256 bits for AES-256) */
  dkLen: 32,
} as const;

/** Salt length in bytes (128 bits recommended minimum) */
export const SALT_LENGTH = 16;

/**
 * Derives a Key Encryption Key (KEK) from a secret using Argon2id
 *
 * @param secret - The input secret (password, master key, etc.)
 * @param salt - Random salt (must be unique per key derivation)
 * @returns 32-byte derived key suitable for AES-256
 */
export function deriveKeyFromSecret(
  secret: Uint8Array | string,
  salt: Uint8Array
): Uint8Array {
  if (salt.length < SALT_LENGTH) {
    throw new Error(`Salt must be at least ${SALT_LENGTH} bytes`);
  }

  const secretBytes =
    typeof secret === "string" ? new TextEncoder().encode(secret) : secret;

  return argon2id(secretBytes, salt, ARGON2_PARAMS);
}

/**
 * Generates a cryptographically secure random salt
 *
 * @returns 16-byte random salt
 */
export function generateSalt(): Uint8Array {
  return randomBytes(SALT_LENGTH);
}

/**
 * Generates a random Data Encryption Key (DEK)
 *
 * @returns 32-byte random key suitable for AES-256
 */
export function generateDataKey(): Uint8Array {
  return randomBytes(32);
}

/**
 * Securely zeros a byte array in memory
 * This helps prevent keys from lingering in memory after use
 *
 * @param data - The byte array to zero
 */
export function zeroBytes(data: Uint8Array): void {
  data.fill(0);
}
