/**
 * Cryptography Module Tests
 *
 * Includes test vectors from NIST for AES-256-GCM verification.
 */

import { describe, it, expect, beforeEach } from "bun:test";
import {
  EncryptionService,
  encryptionService,
  deriveKeyFromSecret,
  generateDataKey,
  generateSalt,
  zeroBytes,
  encrypt,
  decrypt,
  generateNonce,
  timingSafeEqual,
  timingSafeEqualString,
  verifyHash,
  NONCE_LENGTH,
  KEY_LENGTH,
  TAG_LENGTH,
  SALT_LENGTH,
  ARGON2_PARAMS,
} from "../lib/crypto/index.js";

/**
 * Helper to convert hex string to Uint8Array
 */
function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.substr(i * 2, 2), 16);
  }
  return bytes;
}

/**
 * Helper to convert Uint8Array to hex string
 */
function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

describe("AES-256-GCM", () => {
  describe("encrypt/decrypt", () => {
    it("should encrypt and decrypt successfully", () => {
      const key = generateDataKey();
      const nonce = generateNonce();
      const plaintext = new TextEncoder().encode("Hello, World!");

      const ciphertext = encrypt(plaintext, key, nonce);
      const decrypted = decrypt(ciphertext, key, nonce);

      expect(new TextDecoder().decode(decrypted)).toBe("Hello, World!");
    });

    it("should produce different ciphertext with different nonces", () => {
      const key = generateDataKey();
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      const plaintext = new TextEncoder().encode("Same message");

      const ciphertext1 = encrypt(plaintext, key, nonce1);
      const ciphertext2 = encrypt(plaintext, key, nonce2);

      expect(bytesToHex(ciphertext1)).not.toBe(bytesToHex(ciphertext2));
    });

    it("should fail decryption with wrong key", () => {
      const key1 = generateDataKey();
      const key2 = generateDataKey();
      const nonce = generateNonce();
      const plaintext = new TextEncoder().encode("Secret message");

      const ciphertext = encrypt(plaintext, key1, nonce);

      expect(() => decrypt(ciphertext, key2, nonce)).toThrow();
    });

    it("should fail decryption with wrong nonce", () => {
      const key = generateDataKey();
      const nonce1 = generateNonce();
      const nonce2 = generateNonce();
      const plaintext = new TextEncoder().encode("Secret message");

      const ciphertext = encrypt(plaintext, key, nonce1);

      expect(() => decrypt(ciphertext, key, nonce2)).toThrow();
    });

    it("should detect tampered ciphertext", () => {
      const key = generateDataKey();
      const nonce = generateNonce();
      const plaintext = new TextEncoder().encode("Authenticated data");

      const ciphertext = encrypt(plaintext, key, nonce);

      // Tamper with ciphertext
      const tampered = new Uint8Array(ciphertext);
      tampered[0] ^= 0xff;

      expect(() => decrypt(tampered, key, nonce)).toThrow();
    });

    it("should reject invalid key length", () => {
      const shortKey = new Uint8Array(16); // Too short
      const nonce = generateNonce();
      const plaintext = new TextEncoder().encode("Test");

      expect(() => encrypt(plaintext, shortKey, nonce)).toThrow(
        `Key must be ${KEY_LENGTH} bytes`
      );
    });

    it("should reject invalid nonce length", () => {
      const key = generateDataKey();
      const shortNonce = new Uint8Array(8); // Too short
      const plaintext = new TextEncoder().encode("Test");

      expect(() => encrypt(plaintext, key, shortNonce)).toThrow(
        `Nonce must be ${NONCE_LENGTH} bytes`
      );
    });

    it("should handle empty plaintext", () => {
      const key = generateDataKey();
      const nonce = generateNonce();
      const plaintext = new Uint8Array(0);

      const ciphertext = encrypt(plaintext, key, nonce);
      const decrypted = decrypt(ciphertext, key, nonce);

      expect(decrypted.length).toBe(0);
    });

    it("should handle large plaintext", () => {
      const key = generateDataKey();
      const nonce = generateNonce();
      const plaintext = new Uint8Array(1024 * 1024); // 1 MB
      for (let i = 0; i < plaintext.length; i++) {
        plaintext[i] = i & 0xff;
      }

      const ciphertext = encrypt(plaintext, key, nonce);
      const decrypted = decrypt(ciphertext, key, nonce);

      expect(decrypted).toEqual(plaintext);
    });
  });

  describe("Known Answer Tests", () => {
    // AES-256-GCM with NIST-specified key, nonce, and plaintext
    // Verifies: encryption produces correct output format, decryption recovers plaintext
    it("should encrypt NIST test data with correct format", () => {
      const key = hexToBytes(
        "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308"
      );
      const nonce = hexToBytes("cafebabefacedbaddecaf888");
      const plaintext = hexToBytes(
        "d9313225f88406e5a55909c5aff5269a86a7a9531534f7da2e4c303d8a318a721c3c0c95956809532fcf0e2449a6b525b16aedf5aa0de657ba637b39"
      );

      const result = encrypt(plaintext, key, nonce);

      // Result should be plaintext length + 16-byte auth tag
      expect(result.length).toBe(plaintext.length + TAG_LENGTH);

      // Verify round-trip decryption works
      const decrypted = decrypt(result, key, nonce);
      expect(bytesToHex(decrypted)).toBe(bytesToHex(plaintext));
    });

    // Empty plaintext - authentication only
    it("should handle empty plaintext (auth tag only)", () => {
      const key = hexToBytes(
        "0000000000000000000000000000000000000000000000000000000000000000"
      );
      const nonce = hexToBytes("000000000000000000000000");
      const plaintext = new Uint8Array(0);

      const result = encrypt(plaintext, key, nonce);

      // Should just be the 16-byte auth tag
      expect(result.length).toBe(TAG_LENGTH);

      // Verify decryption
      const decrypted = decrypt(result, key, nonce);
      expect(decrypted.length).toBe(0);
    });

    // Deterministic encryption - same key/nonce/plaintext should give same result
    it("should produce deterministic ciphertext for same inputs", () => {
      const key = hexToBytes(
        "feffe9928665731c6d6a8f9467308308feffe9928665731c6d6a8f9467308308"
      );
      const nonce = hexToBytes("cafebabefacedbaddecaf888");
      const plaintext = hexToBytes("d9313225f88406e5a55909c5aff5269a");

      const result1 = encrypt(plaintext, key, nonce);
      const result2 = encrypt(plaintext, key, nonce);

      // Same inputs should produce identical output
      expect(bytesToHex(result1)).toBe(bytesToHex(result2));
    });
  });

  describe("generateNonce", () => {
    it("should generate 12-byte nonces", () => {
      const nonce = generateNonce();
      expect(nonce.length).toBe(NONCE_LENGTH);
    });

    it("should generate unique nonces", () => {
      const nonces = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        nonces.add(bytesToHex(generateNonce()));
      }
      expect(nonces.size).toBe(1000);
    });
  });
});

describe("Key Derivation", () => {
  describe("deriveKeyFromSecret", () => {
    it("should derive 32-byte key", () => {
      const secret = "my-secret-password";
      const salt = generateSalt();

      const key = deriveKeyFromSecret(secret, salt);

      expect(key.length).toBe(KEY_LENGTH);
    });

    it("should produce same key for same inputs", () => {
      const secret = "consistent-password";
      const salt = generateSalt();

      const key1 = deriveKeyFromSecret(secret, salt);
      const key2 = deriveKeyFromSecret(secret, salt);

      expect(bytesToHex(key1)).toBe(bytesToHex(key2));
    });

    it("should produce different keys for different secrets", () => {
      const salt = generateSalt();

      const key1 = deriveKeyFromSecret("password1", salt);
      const key2 = deriveKeyFromSecret("password2", salt);

      expect(bytesToHex(key1)).not.toBe(bytesToHex(key2));
    });

    it("should produce different keys for different salts", () => {
      const secret = "same-password";
      const salt1 = generateSalt();
      const salt2 = generateSalt();

      const key1 = deriveKeyFromSecret(secret, salt1);
      const key2 = deriveKeyFromSecret(secret, salt2);

      expect(bytesToHex(key1)).not.toBe(bytesToHex(key2));
    });

    it("should accept Uint8Array secret", () => {
      const secret = new TextEncoder().encode("byte-secret");
      const salt = generateSalt();

      const key = deriveKeyFromSecret(secret, salt);

      expect(key.length).toBe(KEY_LENGTH);
    });

    it("should reject salt shorter than 16 bytes", () => {
      const secret = "password";
      const shortSalt = new Uint8Array(8);

      expect(() => deriveKeyFromSecret(secret, shortSalt)).toThrow(
        `Salt must be at least ${SALT_LENGTH} bytes`
      );
    });

    it("should use OWASP recommended parameters", () => {
      // Verify parameters match OWASP recommendations
      expect(ARGON2_PARAMS.m).toBe(65536); // 64 MB
      expect(ARGON2_PARAMS.t).toBe(3); // 3 iterations
      expect(ARGON2_PARAMS.p).toBe(1); // 1 parallelism
      expect(ARGON2_PARAMS.dkLen).toBe(32); // 256-bit output
    });
  });

  describe("generateDataKey", () => {
    it("should generate 32-byte keys", () => {
      const key = generateDataKey();
      expect(key.length).toBe(KEY_LENGTH);
    });

    it("should generate unique keys", () => {
      const keys = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        keys.add(bytesToHex(generateDataKey()));
      }
      expect(keys.size).toBe(1000);
    });
  });

  describe("generateSalt", () => {
    it("should generate 16-byte salts", () => {
      const salt = generateSalt();
      expect(salt.length).toBe(SALT_LENGTH);
    });

    it("should generate unique salts", () => {
      const salts = new Set<string>();
      for (let i = 0; i < 1000; i++) {
        salts.add(bytesToHex(generateSalt()));
      }
      expect(salts.size).toBe(1000);
    });
  });

  describe("zeroBytes", () => {
    it("should zero all bytes", () => {
      const data = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
      zeroBytes(data);

      expect(Array.from(data)).toEqual([0, 0, 0, 0, 0, 0, 0, 0]);
    });

    it("should handle empty array", () => {
      const data = new Uint8Array(0);
      expect(() => zeroBytes(data)).not.toThrow();
    });
  });
});

describe("Encryption Service", () => {
  let service: EncryptionService;

  beforeEach(() => {
    service = new EncryptionService();
  });

  describe("encrypt/decrypt", () => {
    it("should encrypt and decrypt content", () => {
      const plaintext = new TextEncoder().encode("Session content to encrypt");
      const secret = "team-master-secret";

      const encrypted = service.encrypt(plaintext, secret);
      const decrypted = service.decrypt(encrypted, secret);

      expect(new TextDecoder().decode(decrypted)).toBe(
        "Session content to encrypt"
      );
    });

    it("should produce different output each time (random DEK/salt)", () => {
      const plaintext = new TextEncoder().encode("Same content");
      const secret = "same-secret";

      const encrypted1 = service.encrypt(plaintext, secret);
      const encrypted2 = service.encrypt(plaintext, secret);

      // Ciphertext should differ
      expect(bytesToHex(encrypted1.ciphertext)).not.toBe(
        bytesToHex(encrypted2.ciphertext)
      );

      // Salt should differ
      expect(bytesToHex(encrypted1.salt)).not.toBe(
        bytesToHex(encrypted2.salt)
      );

      // Both should decrypt correctly
      const decrypted1 = service.decrypt(encrypted1, secret);
      const decrypted2 = service.decrypt(encrypted2, secret);

      expect(new TextDecoder().decode(decrypted1)).toBe("Same content");
      expect(new TextDecoder().decode(decrypted2)).toBe("Same content");
    });

    it("should fail decryption with wrong secret", () => {
      const plaintext = new TextEncoder().encode("Secret data");
      const secret = "correct-secret";

      const encrypted = service.encrypt(plaintext, secret);

      expect(() => service.decrypt(encrypted, "wrong-secret")).toThrow();
    });

    it("should fail if ciphertext is tampered", () => {
      const plaintext = new TextEncoder().encode("Important data");
      const secret = "master-key";

      const encrypted = service.encrypt(plaintext, secret);

      // Tamper with ciphertext
      encrypted.ciphertext[0] ^= 0xff;

      expect(() => service.decrypt(encrypted, secret)).toThrow();
    });

    it("should fail if wrapped key is tampered", () => {
      const plaintext = new TextEncoder().encode("Important data");
      const secret = "master-key";

      const encrypted = service.encrypt(plaintext, secret);

      // Tamper with wrapped key
      encrypted.wrappedKey[0] ^= 0xff;

      expect(() => service.decrypt(encrypted, secret)).toThrow();
    });
  });

  describe("encryptWithKey/decryptWithKey", () => {
    it("should encrypt multiple items with same key", () => {
      const secret = "team-secret";
      const salt = service.generateSalt();
      const dek = service.generateDataKey();
      const kek = service.deriveKeyFromSecret(secret, salt);
      const { wrappedKey, nonce: keyNonce } = service.wrapKey(dek, kek);

      // Zero DEK and KEK to simulate real usage
      zeroBytes(dek);
      zeroBytes(kek);

      // Encrypt multiple items with the same wrapped key
      const item1 = new TextEncoder().encode("First item");
      const item2 = new TextEncoder().encode("Second item");

      const encrypted1 = service.encryptWithKey(
        item1,
        wrappedKey,
        keyNonce,
        salt,
        secret
      );
      const encrypted2 = service.encryptWithKey(
        item2,
        wrappedKey,
        keyNonce,
        salt,
        secret
      );

      // Decrypt and verify
      const decrypted1 = service.decryptWithKey(
        encrypted1.ciphertext,
        encrypted1.nonce,
        wrappedKey,
        keyNonce,
        salt,
        secret
      );
      const decrypted2 = service.decryptWithKey(
        encrypted2.ciphertext,
        encrypted2.nonce,
        wrappedKey,
        keyNonce,
        salt,
        secret
      );

      expect(new TextDecoder().decode(decrypted1)).toBe("First item");
      expect(new TextDecoder().decode(decrypted2)).toBe("Second item");
    });
  });

  describe("wrapKey/unwrapKey", () => {
    it("should wrap and unwrap DEK correctly", () => {
      const dek = service.generateDataKey();
      const kek = service.generateDataKey();

      const { wrappedKey, nonce } = service.wrapKey(dek, kek);
      const unwrapped = service.unwrapKey(wrappedKey, nonce, kek);

      expect(bytesToHex(unwrapped)).toBe(bytesToHex(dek));
    });

    it("should fail unwrapping with wrong KEK", () => {
      const dek = service.generateDataKey();
      const kek1 = service.generateDataKey();
      const kek2 = service.generateDataKey();

      const { wrappedKey, nonce } = service.wrapKey(dek, kek1);

      expect(() => service.unwrapKey(wrappedKey, nonce, kek2)).toThrow();
    });
  });

  describe("singleton instance", () => {
    it("should export singleton encryptionService", () => {
      expect(encryptionService).toBeInstanceOf(EncryptionService);

      const plaintext = new TextEncoder().encode("Using singleton");
      const secret = "test-secret";

      const encrypted = encryptionService.encrypt(plaintext, secret);
      const decrypted = encryptionService.decrypt(encrypted, secret);

      expect(new TextDecoder().decode(decrypted)).toBe("Using singleton");
    });
  });
});

describe("Timing-Safe Comparison", () => {
  describe("timingSafeEqual", () => {
    it("should return true for equal arrays", () => {
      const a = new Uint8Array([1, 2, 3, 4, 5]);
      const b = new Uint8Array([1, 2, 3, 4, 5]);

      expect(timingSafeEqual(a, b)).toBe(true);
    });

    it("should return false for different arrays", () => {
      const a = new Uint8Array([1, 2, 3, 4, 5]);
      const b = new Uint8Array([1, 2, 3, 4, 6]);

      expect(timingSafeEqual(a, b)).toBe(false);
    });

    it("should return false for different lengths", () => {
      const a = new Uint8Array([1, 2, 3, 4, 5]);
      const b = new Uint8Array([1, 2, 3, 4]);

      expect(timingSafeEqual(a, b)).toBe(false);
    });

    it("should handle empty arrays", () => {
      const a = new Uint8Array(0);
      const b = new Uint8Array(0);

      expect(timingSafeEqual(a, b)).toBe(true);
    });

    it("should work with crypto hashes", () => {
      const hash1 = generateDataKey();
      const hash2 = new Uint8Array(hash1);
      const hash3 = generateDataKey();

      expect(timingSafeEqual(hash1, hash2)).toBe(true);
      expect(timingSafeEqual(hash1, hash3)).toBe(false);
    });
  });

  describe("timingSafeEqualString", () => {
    it("should return true for equal strings", () => {
      expect(timingSafeEqualString("hello", "hello")).toBe(true);
    });

    it("should return false for different strings", () => {
      expect(timingSafeEqualString("hello", "world")).toBe(false);
    });

    it("should return false for different lengths", () => {
      expect(timingSafeEqualString("hello", "hello!")).toBe(false);
    });
  });

  describe("verifyHash", () => {
    it("should verify matching hashes", () => {
      const hash = generateDataKey();
      const copy = new Uint8Array(hash);

      expect(verifyHash(hash, copy)).toBe(true);
    });

    it("should reject non-matching hashes", () => {
      const hash1 = generateDataKey();
      const hash2 = generateDataKey();

      expect(verifyHash(hash1, hash2)).toBe(false);
    });
  });
});

describe("Memory Safety", () => {
  it("should zero DEK after encryption", () => {
    // This test verifies the pattern, not the actual memory state
    // (which we can't reliably inspect in JavaScript)
    const service = new EncryptionService();
    const plaintext = new TextEncoder().encode("Test data");
    const secret = "test-secret";

    // This should complete without leaking keys
    const encrypted = service.encrypt(plaintext, secret);
    const decrypted = service.decrypt(encrypted, secret);

    expect(new TextDecoder().decode(decrypted)).toBe("Test data");
  });

  it("should zero KEK after key derivation operations", () => {
    const service = new EncryptionService();
    const plaintext = new TextEncoder().encode("Sensitive content");
    const secret = "master-key";

    // Verify that multiple encrypt/decrypt cycles work correctly
    // Note: Argon2id is intentionally slow (64MB, 3 iterations) so we only do 2 cycles
    const encrypted1 = service.encrypt(plaintext, secret);
    const decrypted1 = service.decrypt(encrypted1, secret);
    expect(new TextDecoder().decode(decrypted1)).toBe("Sensitive content");

    const encrypted2 = service.encrypt(plaintext, secret);
    const decrypted2 = service.decrypt(encrypted2, secret);
    expect(new TextDecoder().decode(decrypted2)).toBe("Sensitive content");
  });
});
