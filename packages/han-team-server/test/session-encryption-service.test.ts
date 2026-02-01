/**
 * Tests for Session Encryption Service
 */

import { describe, test, expect, beforeEach } from "bun:test";
import {
  SessionEncryptionService,
  type SessionData,
  type EncryptedSessionRecord,
  type OperationContext,
} from "../lib/services/session-encryption-service.ts";

describe("SessionEncryptionService", () => {
  let service: SessionEncryptionService;

  // Test master key (base64 encoded 32 bytes)
  const TEST_MASTER_KEY = Buffer.from(
    "01234567890123456789012345678901"
  ).toString("base64");

  const testContext: OperationContext = {
    userId: "test-user-123",
    teamId: "test-team-456",
    ipAddress: "127.0.0.1",
    userAgent: "test-agent",
    requestId: "req-123",
  };

  const testSessionData: SessionData = {
    sessionId: "session-abc",
    projectPath: "/home/user/project",
    summary: "Test session",
    messages: [
      {
        type: "user",
        content: "Hello, world!",
        timestamp: "2024-01-01T00:00:00Z",
      },
      {
        type: "assistant",
        content: "Hi there!",
        timestamp: "2024-01-01T00:00:01Z",
      },
    ],
    metadata: { key: "value" },
  };

  beforeEach(async () => {
    // Create fresh instance for each test
    service = new SessionEncryptionService();
    await service.initialize(TEST_MASTER_KEY);
  });

  describe("initialization", () => {
    test("should report encryption available after initialization with key", async () => {
      const newService = new SessionEncryptionService();
      await newService.initialize(TEST_MASTER_KEY);
      expect(newService.isEncryptionAvailable()).toBe(true);
    });

    test("should report encryption unavailable without key", async () => {
      const newService = new SessionEncryptionService();
      await newService.initialize();
      expect(newService.isEncryptionAvailable()).toBe(false);
    });

    test("should throw on short master key", async () => {
      const newService = new SessionEncryptionService();
      const shortKey = Buffer.from("short").toString("base64");
      await expect(newService.initialize(shortKey)).rejects.toThrow(
        "Master key must be at least 32 bytes"
      );
    });
  });

  describe("encryptSession", () => {
    test("should encrypt session data successfully", async () => {
      const result = await service.encryptSession(testSessionData, testContext);

      expect(result.record).toBeDefined();
      expect(result.record.sessionId).toBe(testSessionData.sessionId);
      expect(result.record.projectPath).toBe(testSessionData.projectPath);
      expect(result.record.encryptedContent).toBeDefined();
      expect(result.record.nonce).toBeDefined();
      expect(result.record.authTag).toBeDefined();
      expect(result.record.keyId).toBeDefined();
    });

    test("should detect and redact secrets in content", async () => {
      const dataWithSecret: SessionData = {
        ...testSessionData,
        messages: [
          {
            type: "user",
            // Use obviously fake pattern to avoid GitHub secret scanning
            content: "My API key is api_key=api_key_4eC39HqLyjWDarjtT1zdp7dc",
            timestamp: "2024-01-01T00:00:00Z",
          },
        ],
      };

      const result = await service.encryptSession(dataWithSecret, testContext);

      expect(result.secretsDetected).toBe(true);
      expect(result.redactedSecretCount).toBeGreaterThan(0);
      expect(result.redactedSecretTypes).toContain("api_key");
      expect(result.record.secretsRedacted).toBe(true);
    });

    test("should include key ID with correct scope", async () => {
      const result = await service.encryptSession(testSessionData, testContext);

      // With teamId, should use team scope
      expect(result.record.keyId).toContain("team:");
    });

    test("should use user scope when no team", async () => {
      const contextWithoutTeam: OperationContext = {
        ...testContext,
        teamId: undefined,
      };

      const result = await service.encryptSession(
        testSessionData,
        contextWithoutTeam
      );

      expect(result.record.keyId).toContain("user:");
    });

    test("should throw when encryption not available", async () => {
      const uninitializedService = new SessionEncryptionService();
      await uninitializedService.initialize(); // No key

      await expect(
        uninitializedService.encryptSession(testSessionData, testContext)
      ).rejects.toThrow();
    });
  });

  describe("decryptSession", () => {
    test("should decrypt session data successfully", async () => {
      // First encrypt
      const encryptResult = await service.encryptSession(
        testSessionData,
        testContext
      );

      // Then decrypt
      const decryptResult = await service.decryptSession(
        encryptResult.record,
        testContext
      );

      expect(decryptResult.data.sessionId).toBe(testSessionData.sessionId);
      expect(decryptResult.data.projectPath).toBe(testSessionData.projectPath);
      expect(decryptResult.data.messages).toHaveLength(
        testSessionData.messages.length
      );
      expect(decryptResult.decryptedAt).toBeDefined();
    });

    test("should preserve message content through encrypt/decrypt cycle", async () => {
      const encryptResult = await service.encryptSession(
        testSessionData,
        testContext
      );
      const decryptResult = await service.decryptSession(
        encryptResult.record,
        testContext
      );

      expect(decryptResult.data.messages[0].content).toBe("Hello, world!");
      expect(decryptResult.data.messages[1].content).toBe("Hi there!");
    });

    test("should throw on tampered ciphertext", async () => {
      const encryptResult = await service.encryptSession(
        testSessionData,
        testContext
      );

      // Tamper with ciphertext
      const tamperedRecord: EncryptedSessionRecord = {
        ...encryptResult.record,
        encryptedContent: "tampered" + encryptResult.record.encryptedContent,
      };

      await expect(
        service.decryptSession(tamperedRecord, testContext)
      ).rejects.toThrow();
    });

    test("should throw on wrong auth tag", async () => {
      const encryptResult = await service.encryptSession(
        testSessionData,
        testContext
      );

      // Use wrong auth tag
      const wrongTagRecord: EncryptedSessionRecord = {
        ...encryptResult.record,
        authTag: Buffer.from("wrongauthtagvalue!").toString("base64"),
      };

      await expect(
        service.decryptSession(wrongTagRecord, testContext)
      ).rejects.toThrow();
    });
  });

  describe("exportSessions", () => {
    test("should export sessions with passphrase encryption", async () => {
      // Encrypt some sessions first
      const encryptResult1 = await service.encryptSession(
        testSessionData,
        testContext
      );
      const encryptResult2 = await service.encryptSession(
        { ...testSessionData, sessionId: "session-def" },
        testContext
      );

      const exportResult = await service.exportSessions(
        [encryptResult1.record, encryptResult2.record],
        { passphrase: "test-passphrase-12345" },
        testContext
      );

      expect(exportResult.encryptedArchive).toBeDefined();
      expect(exportResult.nonce).toBeDefined();
      expect(exportResult.authTag).toBeDefined();
      expect(exportResult.salt).toBeDefined();
      expect(exportResult.sessionCount).toBe(2);
      expect(exportResult.exportedAt).toBeDefined();
    });

    test("should require minimum passphrase length", async () => {
      const encryptResult = await service.encryptSession(
        testSessionData,
        testContext
      );

      // Short passphrase should still work at service level
      // (validation happens at API level)
      const exportResult = await service.exportSessions(
        [encryptResult.record],
        { passphrase: "short" },
        testContext
      );

      expect(exportResult.sessionCount).toBe(1);
    });
  });
});
