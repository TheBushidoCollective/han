/**
 * AES-256-GCM Encryption
 *
 * Provides authenticated encryption with 256-bit keys and 96-bit nonces.
 * GCM mode provides both confidentiality and integrity.
 */

import { gcm } from "@noble/ciphers/aes.js";
import { randomBytes } from "@noble/ciphers/utils.js";

/** Nonce length in bytes (96 bits as recommended for GCM) */
export const NONCE_LENGTH = 12;

/** Key length in bytes (256 bits for AES-256) */
export const KEY_LENGTH = 32;

/** Authentication tag length in bytes (128 bits) */
export const TAG_LENGTH = 16;

/**
 * Encrypts plaintext using AES-256-GCM
 *
 * @param plaintext - Data to encrypt
 * @param key - 32-byte encryption key
 * @param nonce - 12-byte nonce (must be unique per key)
 * @param additionalData - Optional authenticated data (AAD)
 * @returns Ciphertext with appended authentication tag
 */
export function encrypt(
  plaintext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  additionalData?: Uint8Array
): Uint8Array {
  validateKey(key);
  validateNonce(nonce);

  const aes = gcm(key, nonce, additionalData);
  return aes.encrypt(plaintext);
}

/**
 * Decrypts ciphertext using AES-256-GCM
 *
 * @param ciphertext - Data to decrypt (includes auth tag)
 * @param key - 32-byte encryption key
 * @param nonce - 12-byte nonce used during encryption
 * @param additionalData - Optional authenticated data (AAD)
 * @returns Decrypted plaintext
 * @throws Error if authentication fails
 */
export function decrypt(
  ciphertext: Uint8Array,
  key: Uint8Array,
  nonce: Uint8Array,
  additionalData?: Uint8Array
): Uint8Array {
  validateKey(key);
  validateNonce(nonce);

  if (ciphertext.length < TAG_LENGTH) {
    throw new Error("Ciphertext too short - missing authentication tag");
  }

  const aes = gcm(key, nonce, additionalData);
  return aes.decrypt(ciphertext);
}

/**
 * Generates a cryptographically secure random nonce
 *
 * @returns 12-byte random nonce
 */
export function generateNonce(): Uint8Array {
  return randomBytes(NONCE_LENGTH);
}

/**
 * Validates that a key is the correct length
 */
function validateKey(key: Uint8Array): void {
  if (key.length !== KEY_LENGTH) {
    throw new Error(`Key must be ${KEY_LENGTH} bytes (got ${key.length})`);
  }
}

/**
 * Validates that a nonce is the correct length
 */
function validateNonce(nonce: Uint8Array): void {
  if (nonce.length !== NONCE_LENGTH) {
    throw new Error(`Nonce must be ${NONCE_LENGTH} bytes (got ${nonce.length})`);
  }
}
