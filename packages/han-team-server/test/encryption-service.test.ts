/**
 * Tests for Encryption Service
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  EncryptionService,
  EncryptionNotAvailableError,
  getEncryptionService,
  resetEncryptionService,
} from "../lib/crypto/encryption-service.ts";

describe("EncryptionService", () => {
  // Test master key (base64 encoded 32 bytes)
  const TEST_MASTER_KEY = Buffer.from(
    "01234567890123456789012345678901"
  ).toString("base64");

  describe("initialization", () => {
    test("should initialize with master key", async () => {
      const service = new EncryptionService();
      await service.initialize(TEST_MASTER_KEY);
      expect(service.isAvailable()).toBe(true);
    });

    test("should initialize without master key (unavailable mode)", async () => {
      const service = new EncryptionService();
      await service.initialize();
      expect(service.isAvailable()).toBe(false);
    });

    test("should reject short master key", async () => {
      const service = new EncryptionService();
      const shortKey = Buffer.from("short").toString("base64");
      await expect(service.initialize(shortKey)).rejects.toThrow(
        "Master key must be at least 32 bytes"
      );
    });
  });

  describe("encrypt", () => {
    let service: EncryptionService;

    beforeEach(async () => {
      service = new EncryptionService();
      await service.initialize(TEST_MASTER_KEY);
    });

    test("should encrypt plaintext", async () => {
      const plaintext = "Hello, World!";
      const envelope = await service.encrypt(plaintext, { userId: "user-1" });

      expect(envelope.ciphertext).toBeDefined();
      expect(envelope.nonce).toBeDefined();
      expect(envelope.authTag).toBeDefined();
      expect(envelope.keyId).toBeDefined();
      expect(envelope.algorithm).toBe("aes-256-gcm");
    });

    test("should produce different ciphertext for same plaintext", async () => {
      const plaintext = "Hello, World!";
      const envelope1 = await service.encrypt(plaintext, { userId: "user-1" });
      const envelope2 = await service.encrypt(plaintext, { userId: "user-1" });

      expect(envelope1.ciphertext).not.toBe(envelope2.ciphertext);
      expect(envelope1.nonce).not.toBe(envelope2.nonce);
    });

    test("should use team scope key ID when teamId provided", async () => {
      const envelope = await service.encrypt("test", { teamId: "team-123" });
      expect(envelope.keyId).toBe("team:team-123");
    });

    test("should use user scope key ID when only userId provided", async () => {
      const envelope = await service.encrypt("test", { userId: "user-456" });
      expect(envelope.keyId).toBe("user:user-456");
    });

    test("should throw when not initialized", async () => {
      const uninitService = new EncryptionService();
      await expect(
        uninitService.encrypt("test", { userId: "user-1" })
      ).rejects.toThrow(EncryptionNotAvailableError);
    });
  });

  describe("decrypt", () => {
    let service: EncryptionService;

    beforeEach(async () => {
      service = new EncryptionService();
      await service.initialize(TEST_MASTER_KEY);
    });

    test("should decrypt encrypted content", async () => {
      const plaintext = "Secret message!";
      const envelope = await service.encrypt(plaintext, { userId: "user-1" });
      const decrypted = await service.decrypt(envelope, { userId: "user-1" });

      expect(decrypted).toBe(plaintext);
    });

    test("should decrypt with AAD", async () => {
      const plaintext = "Message with context";
      const aad = "session-123";
      const envelope = await service.encrypt(plaintext, {
        userId: "user-1",
        aad,
      });
      const decrypted = await service.decrypt(envelope, {
        userId: "user-1",
        aad,
      });

      expect(decrypted).toBe(plaintext);
    });

    test("should fail with wrong AAD", async () => {
      const plaintext = "Message with context";
      const envelope = await service.encrypt(plaintext, {
        userId: "user-1",
        aad: "session-123",
      });

      await expect(
        service.decrypt(envelope, { userId: "user-1", aad: "wrong-session" })
      ).rejects.toThrow();
    });

    test("should fail with tampered ciphertext", async () => {
      const envelope = await service.encrypt("test", { userId: "user-1" });

      const tamperedEnvelope = {
        ...envelope,
        ciphertext: Buffer.from("tampered").toString("base64"),
      };

      await expect(
        service.decrypt(tamperedEnvelope, { userId: "user-1" })
      ).rejects.toThrow();
    });

    test("should fail with wrong auth tag", async () => {
      const envelope = await service.encrypt("test", { userId: "user-1" });

      const tamperedEnvelope = {
        ...envelope,
        authTag: Buffer.from("0123456789abcdef").toString("base64"),
      };

      await expect(
        service.decrypt(tamperedEnvelope, { userId: "user-1" })
      ).rejects.toThrow();
    });
  });

  describe("getOrCreateKey", () => {
    let service: EncryptionService;

    beforeEach(async () => {
      service = new EncryptionService();
      await service.initialize(TEST_MASTER_KEY);
    });

    test("should return key metadata for team scope", async () => {
      const key = await service.getOrCreateKey({ teamId: "team-123" });

      expect(key.id).toBe("team:team-123");
      expect(key.teamId).toBe("team-123");
      expect(key.userId).toBeNull();
      expect(key.status).toBe("active");
    });

    test("should return key metadata for user scope", async () => {
      const key = await service.getOrCreateKey({ userId: "user-456" });

      expect(key.id).toBe("user:user-456");
      expect(key.userId).toBe("user-456");
      expect(key.teamId).toBeNull();
    });
  });

  describe("singleton", () => {
    beforeEach(() => {
      resetEncryptionService();
    });

    test("should return same instance", () => {
      const instance1 = getEncryptionService();
      const instance2 = getEncryptionService();
      expect(instance1).toBe(instance2);
    });
  });
});
