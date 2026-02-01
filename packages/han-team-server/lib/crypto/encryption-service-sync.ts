/**
 * Synchronous Encryption Service for Han Team Platform
 *
 * Provides envelope encryption using @noble/ciphers for AES-256-GCM
 * and @noble/hashes for Argon2id key derivation.
 *
 * This service is designed for in-process encryption of session data
 * where synchronous operations are preferred.
 */

import {
  encrypt as aesEncrypt,
  decrypt as aesDecrypt,
  generateNonce,
  KEY_LENGTH,
} from "./aes-gcm.ts";
import {
  deriveKeyFromSecret,
  generateDataKey,
  generateSalt,
  zeroBytes,
} from "./key-derivation.ts";

/**
 * Encrypted envelope containing wrapped DEK and encrypted content
 */
export interface EncryptedData {
  /** Encrypted content */
  ciphertext: Uint8Array;
  /** Nonce used for content encryption */
  nonce: Uint8Array;
  /** Wrapped DEK (encrypted with KEK) */
  wrappedKey: Uint8Array;
  /** Nonce used for key wrapping */
  keyNonce: Uint8Array;
  /** Salt used for KEK derivation */
  salt: Uint8Array;
}

/**
 * Result of key wrapping operation
 */
export interface WrappedKeyResult {
  wrappedKey: Uint8Array;
  nonce: Uint8Array;
}

/**
 * Result of encryption with pre-wrapped key
 */
export interface EncryptedWithKeyResult {
  ciphertext: Uint8Array;
  nonce: Uint8Array;
}

/**
 * Synchronous Encryption Service
 *
 * Handles envelope encryption for session data using:
 * - Argon2id for key derivation
 * - AES-256-GCM for encryption
 */
export class EncryptionService {
  /**
   * Encrypt plaintext with envelope encryption
   *
   * Flow:
   * 1. Generate random DEK (Data Encryption Key)
   * 2. Derive KEK (Key Encryption Key) from secret using Argon2id
   * 3. Encrypt content with DEK
   * 4. Wrap (encrypt) DEK with KEK
   * 5. Zero sensitive key material
   *
   * @param plaintext - Data to encrypt
   * @param secret - Master secret for key derivation
   * @returns Encrypted envelope with wrapped key
   */
  encrypt(plaintext: Uint8Array, secret: string): EncryptedData {
    // Generate random keys and salt
    const salt = generateSalt();
    const dek = generateDataKey();
    const contentNonce = generateNonce();

    // Derive KEK from secret
    const kek = deriveKeyFromSecret(secret, salt);

    try {
      // Encrypt content with DEK
      const ciphertext = aesEncrypt(plaintext, dek, contentNonce);

      // Wrap DEK with KEK
      const { wrappedKey, nonce: keyNonce } = this.wrapKey(dek, kek);

      return {
        ciphertext,
        nonce: contentNonce,
        wrappedKey,
        keyNonce,
        salt,
      };
    } finally {
      // Zero sensitive key material
      zeroBytes(dek);
      zeroBytes(kek);
    }
  }

  /**
   * Decrypt an encrypted envelope
   *
   * @param encrypted - Encrypted envelope
   * @param secret - Master secret used during encryption
   * @returns Decrypted plaintext
   */
  decrypt(encrypted: EncryptedData, secret: string): Uint8Array {
    // Derive KEK from secret
    const kek = deriveKeyFromSecret(secret, encrypted.salt);

    try {
      // Unwrap DEK
      const dek = this.unwrapKey(encrypted.wrappedKey, encrypted.keyNonce, kek);

      try {
        // Decrypt content
        return aesDecrypt(encrypted.ciphertext, dek, encrypted.nonce);
      } finally {
        zeroBytes(dek);
      }
    } finally {
      zeroBytes(kek);
    }
  }

  /**
   * Encrypt with a pre-wrapped key
   *
   * Used for encrypting multiple items with the same key
   * to avoid repeated key derivation overhead.
   *
   * @param plaintext - Data to encrypt
   * @param wrappedKey - Previously wrapped DEK
   * @param keyNonce - Nonce used for key wrapping
   * @param salt - Salt used for KEK derivation
   * @param secret - Master secret for key derivation
   * @returns Encrypted content and nonce
   */
  encryptWithKey(
    plaintext: Uint8Array,
    wrappedKey: Uint8Array,
    keyNonce: Uint8Array,
    salt: Uint8Array,
    secret: string
  ): EncryptedWithKeyResult {
    // Derive KEK
    const kek = deriveKeyFromSecret(secret, salt);

    try {
      // Unwrap DEK
      const dek = this.unwrapKey(wrappedKey, keyNonce, kek);

      try {
        // Encrypt content
        const contentNonce = generateNonce();
        const ciphertext = aesEncrypt(plaintext, dek, contentNonce);

        return {
          ciphertext,
          nonce: contentNonce,
        };
      } finally {
        zeroBytes(dek);
      }
    } finally {
      zeroBytes(kek);
    }
  }

  /**
   * Decrypt with a pre-wrapped key
   *
   * @param ciphertext - Encrypted content
   * @param contentNonce - Nonce used for content encryption
   * @param wrappedKey - Previously wrapped DEK
   * @param keyNonce - Nonce used for key wrapping
   * @param salt - Salt used for KEK derivation
   * @param secret - Master secret for key derivation
   * @returns Decrypted plaintext
   */
  decryptWithKey(
    ciphertext: Uint8Array,
    contentNonce: Uint8Array,
    wrappedKey: Uint8Array,
    keyNonce: Uint8Array,
    salt: Uint8Array,
    secret: string
  ): Uint8Array {
    // Derive KEK
    const kek = deriveKeyFromSecret(secret, salt);

    try {
      // Unwrap DEK
      const dek = this.unwrapKey(wrappedKey, keyNonce, kek);

      try {
        // Decrypt content
        return aesDecrypt(ciphertext, dek, contentNonce);
      } finally {
        zeroBytes(dek);
      }
    } finally {
      zeroBytes(kek);
    }
  }

  /**
   * Wrap (encrypt) a DEK with a KEK
   *
   * @param dek - Data Encryption Key to wrap
   * @param kek - Key Encryption Key
   * @returns Wrapped key and nonce
   */
  wrapKey(dek: Uint8Array, kek: Uint8Array): WrappedKeyResult {
    const nonce = generateNonce();
    const wrappedKey = aesEncrypt(dek, kek, nonce);
    return { wrappedKey, nonce };
  }

  /**
   * Unwrap (decrypt) a wrapped DEK
   *
   * @param wrappedKey - Wrapped DEK
   * @param nonce - Nonce used during wrapping
   * @param kek - Key Encryption Key
   * @returns Unwrapped DEK
   */
  unwrapKey(
    wrappedKey: Uint8Array,
    nonce: Uint8Array,
    kek: Uint8Array
  ): Uint8Array {
    return aesDecrypt(wrappedKey, kek, nonce);
  }

  /**
   * Generate a random salt
   */
  generateSalt(): Uint8Array {
    return generateSalt();
  }

  /**
   * Generate a random data encryption key
   */
  generateDataKey(): Uint8Array {
    return generateDataKey();
  }

  /**
   * Derive a key from a secret
   */
  deriveKeyFromSecret(secret: string, salt: Uint8Array): Uint8Array {
    return deriveKeyFromSecret(secret, salt);
  }
}

/**
 * Timing-safe comparison of two byte arrays
 *
 * Prevents timing attacks by always comparing all bytes
 * regardless of where the first difference occurs.
 *
 * @param a - First byte array
 * @param b - Second byte array
 * @returns true if arrays are equal
 */
export function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }

  let result = 0;
  for (let i = 0; i < a.length; i++) {
    result |= a[i] ^ b[i];
  }
  return result === 0;
}

/**
 * Timing-safe comparison of two strings
 *
 * @param a - First string
 * @param b - Second string
 * @returns true if strings are equal
 */
export function timingSafeEqualString(a: string, b: string): boolean {
  const encoder = new TextEncoder();
  return timingSafeEqual(encoder.encode(a), encoder.encode(b));
}

/**
 * Verify a hash in constant time
 *
 * @param expected - Expected hash value
 * @param actual - Actual hash value
 * @returns true if hashes match
 */
export function verifyHash(
  expected: Uint8Array,
  actual: Uint8Array
): boolean {
  return timingSafeEqual(expected, actual);
}

/**
 * Singleton instance of the encryption service
 */
export const encryptionService = new EncryptionService();
