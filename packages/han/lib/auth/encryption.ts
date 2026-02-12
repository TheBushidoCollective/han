/**
 * Token Encryption
 *
 * AES-256-GCM encryption for storing OAuth tokens at rest.
 * Uses Node.js crypto module for cryptographic operations.
 */

import { createCipheriv, createDecipheriv, randomBytes } from 'node:crypto';

/**
 * Encryption algorithm: AES-256-GCM
 * - 256-bit key
 * - 96-bit (12 bytes) IV/nonce
 * - 128-bit (16 bytes) auth tag
 */
const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 12;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypted data format:
 * [IV (12 bytes)][Auth Tag (16 bytes)][Ciphertext]
 */

/**
 * Encrypt a plaintext string using AES-256-GCM
 *
 * @param plaintext - The text to encrypt
 * @param key - 32-byte encryption key (hex or base64 encoded)
 * @returns Buffer containing IV + auth tag + ciphertext
 */
export function encrypt(plaintext: string, key: string): Buffer {
  // Decode the key (support both hex and base64)
  const keyBuffer = decodeKey(key);

  if (keyBuffer.length !== 32) {
    throw new Error(
      `Encryption key must be 32 bytes (256 bits), got ${keyBuffer.length}`
    );
  }

  // Generate random IV
  const iv = randomBytes(IV_LENGTH);

  // Create cipher
  const cipher = createCipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });

  // Encrypt
  const encrypted = Buffer.concat([
    cipher.update(plaintext, 'utf8'),
    cipher.final(),
  ]);

  // Get auth tag
  const authTag = cipher.getAuthTag();

  // Combine: IV + Auth Tag + Ciphertext
  return Buffer.concat([iv, authTag, encrypted]);
}

/**
 * Decrypt an encrypted buffer using AES-256-GCM
 *
 * @param encrypted - Buffer containing IV + auth tag + ciphertext
 * @param key - 32-byte encryption key (hex or base64 encoded)
 * @returns Decrypted plaintext string
 */
export function decrypt(encrypted: Buffer, key: string): string {
  // Decode the key
  const keyBuffer = decodeKey(key);

  if (keyBuffer.length !== 32) {
    throw new Error(
      `Encryption key must be 32 bytes (256 bits), got ${keyBuffer.length}`
    );
  }

  // Minimum length: IV + Auth Tag + at least 1 byte of ciphertext
  if (encrypted.length < IV_LENGTH + AUTH_TAG_LENGTH + 1) {
    throw new Error('Encrypted data is too short');
  }

  // Extract components
  const iv = encrypted.subarray(0, IV_LENGTH);
  const authTag = encrypted.subarray(IV_LENGTH, IV_LENGTH + AUTH_TAG_LENGTH);
  const ciphertext = encrypted.subarray(IV_LENGTH + AUTH_TAG_LENGTH);

  // Create decipher
  const decipher = createDecipheriv(ALGORITHM, keyBuffer, iv, {
    authTagLength: AUTH_TAG_LENGTH,
  });
  decipher.setAuthTag(authTag);

  // Decrypt
  const decrypted = Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]);

  return decrypted.toString('utf8');
}

/**
 * Decode an encryption key from hex or base64 format
 *
 * @param key - Key string in hex or base64 format
 * @returns Buffer containing the raw key bytes
 */
function decodeKey(key: string): Buffer {
  // Try hex first (64 chars for 32 bytes)
  if (/^[0-9a-fA-F]{64}$/.test(key)) {
    return Buffer.from(key, 'hex');
  }

  // Try base64 (44 chars for 32 bytes with padding)
  if (/^[A-Za-z0-9+/]{43}=?$/.test(key) || /^[A-Za-z0-9+/]{44}$/.test(key)) {
    return Buffer.from(key, 'base64');
  }

  // Assume raw key (not recommended but supported)
  return Buffer.from(key, 'utf8');
}

/**
 * Generate a random encryption key
 *
 * @returns Hex-encoded 32-byte key
 */
export function generateEncryptionKey(): string {
  return randomBytes(32).toString('hex');
}

/**
 * Hash a value using SHA-256
 * Used for token lookup without storing the actual token
 *
 * @param value - Value to hash
 * @returns Hex-encoded hash
 */
export function hashSHA256(value: string): string {
  const { createHash } = require('node:crypto');
  return createHash('sha256').update(value).digest('hex');
}

/**
 * Generate a cryptographically secure random token
 *
 * @param length - Number of bytes (default: 32)
 * @returns URL-safe base64 encoded token
 */
export function generateSecureToken(length = 32): string {
  return randomBytes(length)
    .toString('base64')
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=+$/, '');
}
